import express from 'express';
import sqlite3 from 'sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import multer from 'multer';
import fs from 'fs/promises';

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

// Configurar multer para el manejo de archivos
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, join(__dirname, 'images'));
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now();
        cb(null, uniqueSuffix + '-' + file.originalname.toLowerCase().replace(/\s+/g, '_'));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});

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

        // Tabla de ventas con usuario_id
        db.run(`CREATE TABLE IF NOT EXISTS ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            total REAL,
            metodo_pago TEXT,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
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

        // Tabla de clientes
        db.run(`CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            apellido TEXT NOT NULL,
            telefono TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE,
            direccion TEXT,
            puntos INTEGER DEFAULT 0,
            nivel TEXT DEFAULT 'Bronce',
            total_compras REAL DEFAULT 0,
            fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
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
    const { username, password, role } = req.body;

    db.get('SELECT * FROM usuarios WHERE username = ? AND rol = ?', [username, role], (err, user) => {
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

// Crear producto
app.post('/api/productos', autenticarToken, async (req, res) => {
    const { nombre, codigo_barras, categoria_id, stock, precio_costo, precio_venta } = req.body;

    // Validar datos requeridos
    if (!nombre || !codigo_barras || !categoria_id || typeof stock !== 'number' || 
        typeof precio_costo !== 'number' || typeof precio_venta !== 'number') {
        return res.status(400).json({ error: 'Faltan campos requeridos o son inválidos' });
    }

    try {
        // Verificar si el código de barras ya existe
        const existente = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM productos WHERE codigo_barras = ?', [codigo_barras], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (existente) {
            return res.status(400).json({ 
                error: 'codigo_barras_existente',
                mensaje: 'Ya existe un producto con este código de barras'
            });
        }

        // Insertar el producto
        const result = await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO productos (
                    nombre, codigo_barras, categoria_id, stock, 
                    precio_costo, precio_venta
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [nombre, codigo_barras, categoria_id, stock, precio_costo, precio_venta],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });

        // Obtener el producto creado
        const nuevoProducto = await new Promise((resolve, reject) => {
            db.get(
                `SELECT p.*, c.nombre as categoria_nombre 
                 FROM productos p 
                 LEFT JOIN categorias c ON p.categoria_id = c.id 
                 WHERE p.id = ?`,
                [result],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        res.status(201).json(nuevoProducto);
    } catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({ error: 'Error al crear el producto' });
    }
});

// Obtener producto por ID
app.get('/api/productos/:id', autenticarToken, (req, res) => {
    const id = req.params.id;
    db.get(`
        SELECT p.*, c.nombre as categoria_nombre 
        FROM productos p 
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE p.id = ?
    `, [id], (err, producto) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener el producto' });
        }
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json(producto);
    });
});

// Eliminar producto
app.delete('/api/productos/:id', autenticarToken, async (req, res) => {
    const id = req.params.id;

    try {
        // Verificar si el producto existe y si está siendo usado en alguna venta
        const [producto, ventasConProducto] = await Promise.all([
            new Promise((resolve, reject) => {
                db.get('SELECT * FROM productos WHERE id = ?', [id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            }),
            new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM detalles_venta WHERE producto_id = ?', [id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row?.count || 0);
                });
            })
        ]);

        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        if (ventasConProducto > 0) {
            return res.status(400).json({ 
                error: 'producto_con_ventas',
                mensaje: 'No se puede eliminar el producto porque tiene ventas asociadas'
            });
        }

        // Eliminar el producto
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM productos WHERE id = ?', [id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ mensaje: 'Producto eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ error: 'Error al eliminar el producto' });
    }
});

// Subir imagen de producto
app.post('/api/productos/:id/imagen', autenticarToken, upload.single('imagen'), async (req, res) => {
    const id = req.params.id;
    
    if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
    }

    try {
        // Obtener el producto
        const producto = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM productos WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!producto) {
            // Eliminar el archivo subido si el producto no existe
            await fs.unlink(req.file.path);
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        // Si el producto ya tenía una imagen, eliminarla
        if (producto.imagen) {
            const imagenAnterior = join(__dirname, producto.imagen);
            try {
                await fs.unlink(imagenAnterior);
            } catch (error) {
                console.error('Error al eliminar imagen anterior:', error);
            }
        }

        // Actualizar la ruta de la imagen en la base de datos
        const rutaImagen = '/images/' + req.file.filename;
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE productos SET imagen = ? WHERE id = ?',
                [rutaImagen, id],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ 
            mensaje: 'Imagen subida correctamente',
            ruta: rutaImagen
        });
    } catch (error) {
        // Si hay un error, eliminar el archivo subido
        try {
            await fs.unlink(req.file.path);
        } catch (unlinkError) {
            console.error('Error al eliminar archivo:', unlinkError);
        }
        
        console.error('Error al procesar imagen:', error);
        res.status(500).json({ error: 'Error al procesar la imagen' });
    }
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

// Obtener categoría por ID
app.get('/api/categorias/:id', autenticarToken, (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM categorias WHERE id = ?', [id], (err, categoria) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener la categoría' });
        }
        if (!categoria) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }
        res.json(categoria);
    });
});

// Actualizar categoría
app.put('/api/categorias/:id', autenticarToken, async (req, res) => {
    const id = req.params.id;
    const { nombre } = req.body;

    if (!nombre) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }

    try {
        // Verificar si la categoría existe
        const categoria = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM categorias WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!categoria) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        // Actualizar la categoría
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE categorias SET nombre = ? WHERE id = ?',
                [nombre, id],
                (err) => {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint failed')) {
                            reject(new Error('Ya existe una categoría con ese nombre'));
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve();
                    }
                }
            );
        });

        res.json({ id, nombre });
    } catch (error) {
        console.error('Error al actualizar categoría:', error);
        if (error.message === 'Ya existe una categoría con ese nombre') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Error al actualizar la categoría' });
    }
});

// Eliminar categoría
app.delete('/api/categorias/:id', autenticarToken, async (req, res) => {
    const id = req.params.id;

    try {
        // Verificar si la categoría existe
        const categoria = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM categorias WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!categoria) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        // Verificar si hay productos usando esta categoría
        const productosAsociados = await new Promise((resolve, reject) => {
            db.get(
                'SELECT COUNT(*) as count FROM productos WHERE categoria_id = ?',
                [id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row?.count || 0);
                }
            );
        });

        if (productosAsociados > 0) {
            return res.status(400).json({
                error: 'categoria_con_productos',
                mensaje: 'No se puede eliminar la categoría porque tiene productos asociados'
            });
        }

        // Eliminar la categoría
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM categorias WHERE id = ?', [id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ mensaje: 'Categoría eliminada correctamente' });
    } catch (error) {
        console.error('Error al eliminar categoría:', error);
        res.status(500).json({ error: 'Error al eliminar la categoría' });
    }
});

// Rutas de ventas
app.get('/api/ventas', autenticarToken, (req, res) => {
    const filtro = req.query.filtro || 'todo';
    let consulta = `
        SELECT v.*, 
               GROUP_CONCAT(json_object(
                   'producto_id', dv.producto_id,
                   'cantidad', dv.cantidad,
                   'precio', dv.precio_unitario,
                   'total', (dv.cantidad * dv.precio_unitario)
               )) as detalles
        FROM ventas v
        LEFT JOIN detalles_venta dv ON v.id = dv.venta_id
    `;

    // Aplicar filtros de fecha
    if (filtro === 'hoy') {
        consulta += " WHERE date(v.fecha) = date('now')";
    } else if (filtro === 'semana') {
        consulta += " WHERE v.fecha >= date('now', '-7 days')";
    } else if (filtro === 'mes') {
        consulta += " WHERE v.fecha >= date('now', '-30 days')";
    }

    consulta += ' GROUP BY v.id ORDER BY v.fecha DESC';

    db.all(consulta, [], (err, ventas) => {
        if (err) {
            console.error('Error al obtener ventas:', err);
            return res.status(500).json({ error: 'Error al obtener las ventas' });
        }

        // Procesar los detalles de JSON string a array
        ventas = ventas.map(venta => ({
            ...venta,
            detalles: venta.detalles ? JSON.parse(`[${venta.detalles}]`) : []
        }));

        res.json(ventas);
    });
});

// Ruta para crear venta
app.post('/api/ventas', autenticarToken, async (req, res) => {
    const { productos, total, metodo_pago } = req.body;
    const usuario_id = req.user.id; // Obtener el ID del usuario del token

    if (!Array.isArray(productos) || productos.length === 0 || !total) {
        return res.status(400).json({ error: 'datos_invalidos' });
    }

    // Verificar stock disponible
    try {
        for (const producto of productos) {
            const [stockActual] = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT stock FROM productos WHERE id = ?',
                    [producto.producto_id],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve([row?.stock || 0]);
                    }
                );
            });

            if (stockActual < producto.cantidad) {
                return res.status(400).json({ 
                    error: 'stock_insuficiente',
                    mensaje: `Stock insuficiente para el producto ID ${producto.producto_id}`
                });
            }
        }

        // Iniciar transacción
        await new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Insertar venta con usuario_id
        const ventaId = await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO ventas (usuario_id, total, metodo_pago, fecha) VALUES (?, ?, ?, datetime("now"))',
                [usuario_id, total, metodo_pago],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });

        // Insertar detalles y actualizar stock
        for (const producto of productos) {
            await Promise.all([
                new Promise((resolve, reject) => {
                    db.run(
                        'INSERT INTO detalles_venta (venta_id, producto_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
                        [ventaId, producto.producto_id, producto.cantidad, producto.precio_unitario],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                }),
                new Promise((resolve, reject) => {
                    db.run(
                        'UPDATE productos SET stock = stock - ? WHERE id = ?',
                        [producto.cantidad, producto.producto_id],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                })
            ]);
        }

        // Confirmar transacción
        await new Promise((resolve, reject) => {
            db.run('COMMIT', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ 
            id: ventaId,
            mensaje: 'Venta registrada exitosamente'
        });

    } catch (error) {
        // Rollback en caso de error
        await new Promise((resolve) => {
            db.run('ROLLBACK', () => resolve());
        });
        
        console.error('Error en la transacción:', error);
        return res.status(500).json({ 
            error: 'Error al procesar la venta',
            mensaje: error.message
        });
    }
});

// Rutas de usuarios
app.get('/api/usuarios', autenticarToken, (req, res) => {
    if (req.user.rol !== 'admin') {
        return res.status(403).json({ error: 'No autorizado' });
    }

    db.all('SELECT id, username, rol FROM usuarios', (err, usuarios) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener usuarios' });
        }
        res.json(usuarios);
    });
});

app.post('/api/usuarios', autenticarToken, async (req, res) => {
    if (req.user.rol !== 'admin') {
        return res.status(403).json({ error: 'No autorizado' });
    }

    const { username, password, rol } = req.body;

    if (!username || !password || !rol) {
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    if (rol !== 'admin' && rol !== 'cajero') {
        return res.status(400).json({ error: 'Rol inválido' });
    }

    try {
        // Verificar si el usuario ya existe
        const usuarioExistente = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM usuarios WHERE username = ?', [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (usuarioExistente) {
            return res.status(400).json({ error: 'El nombre de usuario ya existe' });
        }

        // Hashear la contraseña
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);

        // Insertar el nuevo usuario
        const result = await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO usuarios (username, password, rol) VALUES (?, ?, ?)',
                [username, hashedPassword, rol],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });

        res.status(201).json({
            id: result,
            username,
            rol
        });
    } catch (error) {
        console.error('Error al crear usuario:', error);
        res.status(500).json({ error: 'Error al crear el usuario' });
    }
});

// Eliminar usuario
app.delete('/api/usuarios/:id', autenticarToken, async (req, res) => {
    if (req.user.rol !== 'admin') {
        return res.status(403).json({ error: 'No autorizado' });
    }

    const id = req.params.id;

    try {
        // Verificar si el usuario existe
        const usuario = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM usuarios WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // No permitir eliminar el propio usuario
        if (usuario.id === req.user.id) {
            return res.status(400).json({ 
                error: 'No se puede eliminar el usuario actual' 
            });
        }

        // Verificar si hay ventas asociadas
        const ventasAsociadas = await new Promise((resolve, reject) => {
            db.get(
                'SELECT COUNT(*) as count FROM ventas WHERE usuario_id = ?',
                [id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row?.count || 0);
                }
            );
        });

        if (ventasAsociadas > 0) {
            return res.status(400).json({
                error: 'usuario_con_ventas',
                mensaje: 'No se puede eliminar el usuario porque tiene ventas registradas'
            });
        }

        // Eliminar el usuario
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM usuarios WHERE id = ?', [id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ mensaje: 'Usuario eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ error: 'Error al eliminar el usuario' });
    }
});

// Rutas de clientes
app.get('/api/clientes', autenticarToken, (req, res) => {
    db.all('SELECT * FROM clientes', (err, clientes) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener clientes' });
        }
        res.json(clientes);
    });
});

// Buscar cliente por teléfono
app.get('/api/clientes/buscar/:telefono', autenticarToken, (req, res) => {
    const telefono = req.params.telefono;
    db.get('SELECT * FROM clientes WHERE telefono = ?', [telefono], (err, cliente) => {
        if (err) {
            return res.status(500).json({ error: 'Error al buscar cliente' });
        }
        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        res.json(cliente);
    });
});

// Crear cliente
app.post('/api/clientes', autenticarToken, async (req, res) => {
    const { nombre, apellido, telefono, email, direccion } = req.body;

    if (!nombre || !apellido || !telefono) {
        return res.status(400).json({ error: 'Nombre, apellido y teléfono son requeridos' });
    }

    try {
        // Verificar si el teléfono ya existe
        const clienteExistente = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM clientes WHERE telefono = ?', [telefono], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (clienteExistente) {
            return res.status(400).json({ error: 'Ya existe un cliente con ese teléfono' });
        }

        // Verificar si el email ya existe (si se proporcionó)
        if (email) {
            const emailExistente = await new Promise((resolve, reject) => {
                db.get('SELECT id FROM clientes WHERE email = ?', [email], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (emailExistente) {
                return res.status(400).json({ error: 'Ya existe un cliente con ese email' });
            }
        }

        // Insertar el nuevo cliente
        const result = await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO clientes (nombre, apellido, telefono, email, direccion) VALUES (?, ?, ?, ?, ?)',
                [nombre, apellido, telefono, email, direccion],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });

        // Obtener el cliente creado
        const nuevoCliente = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM clientes WHERE id = ?', [result], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        res.status(201).json(nuevoCliente);
    } catch (error) {
        console.error('Error al crear cliente:', error);
        res.status(500).json({ error: 'Error al crear el cliente' });
    }
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});