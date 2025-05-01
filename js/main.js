// Datos de ejemplo para productos y stock
const productos = [
    {
        id: 1,
        nombre: 'Whisky Premium',
        categoria: 'whisky',
        precio: 89.99,
        stock: 50,
        stockMinimo: 10,
        proveedor: 'Distribuidor A',
        ultimaCompra: '2024-01-15'
    },
    {
        id: 2,
        nombre: 'Vino Tinto Reserva',
        categoria: 'vinos',
        precio: 29.99,
        stock: 100,
        stockMinimo: 20,
        proveedor: 'Distribuidor B',
        ultimaCompra: '2024-01-10'
    }
];

// Registro de ventas
let registroVentas = [];

// Registro de movimientos de inventario
let movimientosInventario = [];

// Función para cargar la tabla de productos
function cargarTablaProductos() {
    const contenedor = document.querySelector('.tabla-productos tbody');
    if (!contenedor) return;

    contenedor.innerHTML = '';
    productos.forEach(producto => {
        const fila = `
            <tr class="${producto.stock <= producto.stockMinimo ? 'table-warning' : ''}">
                <td>${producto.id}</td>
                <td>${producto.nombre}</td>
                <td>${producto.categoria}</td>
                <td>$${producto.precio}</td>
                <td>${producto.stock}</td>
                <td>${producto.proveedor}</td>
                <td>
                    <button class="btn btn-sm btn-primary me-1" onclick="abrirModalEditar(${producto.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-success me-1" onclick="abrirModalStock(${producto.id})">
                        <i class="fas fa-boxes"></i>
                    </button>
                    <button class="btn btn-sm btn-info" onclick="registrarVenta(${producto.id})">
                        <i class="fas fa-cash-register"></i>
                    </button>
                </td>
            </tr>
        `;
        contenedor.insertAdjacentHTML('beforeend', fila);
    });
}

// Función para registrar una venta
function registrarVenta(productoId) {
    const producto = productos.find(p => p.id === productoId);
    if (!producto || producto.stock <= 0) {
        mostrarNotificacion('No hay stock disponible', 'danger');
        return;
    }

    const venta = {
        id: Date.now(),
        productoId: producto.id,
        cantidad: 1,
        precio: producto.precio,
        fecha: new Date().toISOString()
    };

    registroVentas.push(venta);
    producto.stock--;
    actualizarEstadisticas();
    cargarTablaProductos();
    mostrarNotificacion('Venta registrada correctamente');
}

// Función para actualizar stock
function actualizarStock(productoId, cantidad, tipo) {
    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;

    const movimiento = {
        id: Date.now(),
        productoId: producto.id,
        cantidad: cantidad,
        tipo: tipo,
        fecha: new Date().toISOString()
    };

    producto.stock = tipo === 'entrada' ? producto.stock + cantidad : producto.stock - cantidad;
    movimientosInventario.push(movimiento);
    cargarTablaProductos();
    actualizarEstadisticas();
}

// Función para actualizar estadísticas
function actualizarEstadisticas() {
    const totalVentas = registroVentas.reduce((total, venta) => total + venta.precio, 0);
    const productosPocoStock = productos.filter(p => p.stock <= p.stockMinimo).length;
    
    document.getElementById('total-ventas').textContent = `$${totalVentas.toFixed(2)}`;
    document.getElementById('productos-bajo-stock').textContent = productosPocoStock;
}

// Función para mostrar notificaciones
function mostrarNotificacion(mensaje, tipo = 'success') {
    const notificacion = document.createElement('div');
    notificacion.className = `alert alert-${tipo} position-fixed bottom-0 end-0 m-3`;
    notificacion.role = 'alert';
    notificacion.textContent = mensaje;
    document.body.appendChild(notificacion);

    setTimeout(() => {
        notificacion.remove();
    }, 3000);
}

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
    cargarTablaProductos();
    actualizarEstadisticas();
});