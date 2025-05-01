import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';

// Conectar a la base de datos SQLite
const db = new sqlite3.Database('tienda.db', (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err);
        return;
    }
    console.log('Conexión exitosa con la base de datos SQLite');
});

// Agregar columna metodo_pago a ventas si no existe
function agregarColumnaMetodoPago() {
    db.run(`
        ALTER TABLE ventas 
        ADD COLUMN metodo_pago TEXT
    `, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error al agregar columna metodo_pago:', err);
        } else {
            console.log('Columna metodo_pago agregada correctamente o ya existe');
        }
    });
}
agregarColumnaMetodoPago();

// Eliminar usuarios existentes y crear nuevos
db.run('DELETE FROM usuarios', (err) => {
    if (err) {
        console.error('Error al eliminar usuarios:', err);
        return;
    }
    console.log('Usuarios eliminados correctamente');

    // Crear nuevos usuarios
    const usuarios = [
        { username: 'admin', password: 'admin123', rol: 'admin' },
        { username: 'cajero1', password: 'cajero123', rol: 'cajero' }
    ];

    usuarios.forEach(usuario => {
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(usuario.password, salt);

        db.run(
            'INSERT INTO usuarios (username, password, rol) VALUES (?, ?, ?)',
            [usuario.username, hashedPassword, usuario.rol],
            (err) => {
                if (err) {
                    console.error(`Error al crear usuario ${usuario.username}:`, err);
                } else {
                    console.log(`Usuario ${usuario.username} creado correctamente`);
                }
            }
        );
    });

    // Cerrar la conexión después de un tiempo para asegurar que todas las operaciones se completen
    setTimeout(() => {
        db.close((err) => {
            if (err) {
                console.error('Error al cerrar la conexión:', err);
            } else {
                console.log('Conexión cerrada correctamente');
            }
        });
    }, 1000);
});