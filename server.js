import express from 'express';
import sqlite3 from 'sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 5502;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(express.json());
app.use(express.static(__dirname));

// Conectar a la base de datos SQLite
const db = new sqlite3.Database('tienda.db', (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err);
    } else {
        console.log('Conexión exitosa con la base de datos SQLite');
        inicializarBaseDeDatos();
    }
});

// Función para inicializar las tablas si no existen
function inicializarBaseDeDatos() {
    db.serialize(() => {
        // Tabla de usuarios
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            rol TEXT
        )`);

        // Tabla de categorías
        db.run(`CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT UNIQUE
        )`);

        // Tabla de productos
        db.run(`CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT,
            codigo_barras TEXT UNIQUE,
            categoria_id INTEGER,
            stock INTEGER,
            precio_costo REAL,
            precio_venta REAL,
            imagen TEXT,
            FOREIGN KEY (categoria_id) REFERENCES categorias(id)
        )`);

        // Tabla de ventas
        db.run(`CREATE TABLE IF NOT EXISTS ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            total REAL,
            metodo_pago TEXT
        )`);

        // Tabla de detalles de venta
        db.run(`CREATE TABLE IF NOT EXISTS detalles_venta (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venta_id INTEGER,
            producto_id INTEGER,
            cantidad INTEGER,
            precio_unitario REAL,
            FOREIGN KEY (venta_id) REFERENCES ventas(id),
            FOREIGN KEY (producto_id) REFERENCES productos(id)
        )`);
    });
}

// Middleware de autenticación
function autenticarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }

    jwt.verify(token, 'tu_clave_secreta', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
}

// Rutas de autenticación
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM usuarios WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Error en el servidor' });
        }
        if (!user) {
            return res.status(401).json({ error: 'credenciales_invalidas' });
        }

        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'credenciales_invalidas' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, rol: user.rol },
            'tu_clave_secreta',
            { expiresIn: '24h' }
        );

        res.json({ access_token: token });
    });
});

// Ruta protegida de ejemplo
app.get('/api/protected', autenticarToken, (req, res) => {
    res.json(req.user);
});

// Rutas de productos
app.get('/api/productos', autenticarToken, (req, res) => {
    db.all(`
        SELECT p.*, c.nombre as categoria_nombre 
        FROM productos p 
        LEFT JOIN categorias c ON p.categoria_id = c.id
    `, (err, productos) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener productos' });
        }
        res.json(productos);
    });
});

// Rutas de categorías
app.get('/api/categorias', autenticarToken, (req, res) => {
    db.all('SELECT * FROM categorias', (err, categorias) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener categorías' });
        }
        res.json(categorias);
    });
});

// Ruta para crear categoría
app.post('/api/categorias', autenticarToken, (req, res) => {
    const { nombre } = req.body;
    if (!nombre) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }

    db.run('INSERT INTO categorias (nombre) VALUES (?)', [nombre], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'La categoría ya existe' });
            }
            return res.status(500).json({ error: 'Error al crear la categoría' });
        }
        res.json({ id: this.lastID, nombre });
    });
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});