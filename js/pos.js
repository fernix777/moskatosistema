// Surcharge Configuration
const SURCHARGE_PAYMENT_METHODS_CLIENT = ['tarjeta', 'transferencia']; // Ensure these match server
const SURCHARGE_RATE_CLIENT = 0.045; // 4.5%

// Variables globales
let productos = [];
let carrito = [];
let ventasEnEspera = [];
let cajaAbierta = JSON.parse(sessionStorage.getItem('cajaAbierta')) || false;
let saldoCaja = parseFloat(sessionStorage.getItem('saldoCaja')) || 0;
let clienteActual = null;
let facturaActual = null;
let facturaEditando = false;

// Obtener productos desde la API
fetch(`${API_BASE_URL}/api/productos`, {
    headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
    }
})
.then(response => {
    if (!response.ok) {
        console.error('Error de respuesta:', response.status, response.statusText);
        throw new Error(`Error al obtener productos: ${response.status}`);
    }
    return response.json();
})
.then(data => {
    console.log('Productos recibidos:', data);
    if (!Array.isArray(data)) {
        throw new Error('Formato de datos inválido');
    }
    productos = data;
    if (productos.length === 0) {
        const productGrid = document.getElementById('productGrid');
        productGrid.innerHTML = '<div class="col-12 text-center"><p>No hay productos disponibles</p></div>';
    } else {
        cargarProductos(productos);
    }
})
.catch(error => {
    console.error('Error al cargar productos:', error);
    const productGrid = document.getElementById('productGrid');
    productGrid.innerHTML = `
        <div class="col-12 text-center">
            <div class="alert alert-danger" role="alert">
                Error al cargar los productos: ${error.message}
            </div>
        </div>
    `;
});

// Funciones de caja
function abrirCaja(montoInicial) {
    if (cajaAbierta) {
        alert('La caja ya está abierta');
        return false;
    }
    if (!montoInicial || montoInicial <= 0) {
        alert('Por favor ingrese un monto inicial válido');
        return false;
    }
    cajaAbierta = true;
    saldoCaja = montoInicial;
    sessionStorage.setItem('cajaAbierta', 'true');
    sessionStorage.setItem('saldoCaja', montoInicial.toString());
    return true;
}

function cerrarCaja() {
    if (!cajaAbierta) {
        alert('La caja ya está cerrada');
        return null;
    }
    const resumen = {
        saldoFinal: saldoCaja,
        fecha: new Date().toISOString()
    };
    cajaAbierta = false;
    saldoCaja = 0;
    sessionStorage.removeItem('cajaAbierta');
    sessionStorage.removeItem('saldoCaja');
    return resumen;
}

// Función para mostrar el modal de conteo de efectivo
function mostrarModalConteoEfectivo() {
    const modalHTML = `
        <div class="modal fade" id="conteoEfectivoModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Conteo de Efectivo</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="formConteoEfectivo">
                            <div class="mb-3">
                                <label class="form-label">Billetes de $1000:</label>
                                <input type="number" class="form-control conteo-input" data-denominacion="1000" min="0" value="0">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Billetes de $500:</label>
                                <input type="number" class="form-control conteo-input" data-denominacion="500" min="0" value="0">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Billetes de $200:</label>
                                <input type="number" class="form-control conteo-input" data-denominacion="200" min="0" value="0">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Billetes de $100:</label>
                                <input type="number" class="form-control conteo-input" data-denominacion="100" min="0" value="0">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Billetes de $50:</label>
                                <input type="number" class="form-control conteo-input" data-denominacion="50" min="0" value="0">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Billetes de $20:</label>
                                <input type="number" class="form-control conteo-input" data-denominacion="20" min="0" value="0">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Monedas y otros:</label>
                                <input type="number" class="form-control" id="monedasOtros" min="0" value="0" step="0.5">
                            </div>
                            <div class="alert alert-info">
                                <strong>Total en caja:</strong> <span id="totalConteo">$0.00</span>
                            </div>
                            <div class="alert alert-primary">
                                <strong>Saldo esperado:</strong> <span id="saldoEsperado">$${saldoCaja.toFixed(2)}</span>
                            </div>
                            <div class="alert alert-warning d-none" id="diferenciaCaja">
                                <strong>Diferencia:</strong> <span id="montoDiferencia">$0.00</span>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        <button type="button" class="btn btn-primary" onclick="imprimirArqueo()">Imprimir Arqueo</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Agregar el modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Mostrar el modal
    const modal = new bootstrap.Modal(document.getElementById('conteoEfectivoModal'));
    modal.show();

    // Configurar eventos para calcular el total
    const inputs = document.querySelectorAll('.conteo-input');
    const monedasOtros = document.getElementById('monedasOtros');
    
    const calcularTotal = () => {
        let total = 0;
        inputs.forEach(input => {
            const denominacion = parseInt(input.dataset.denominacion);
            const cantidad = parseInt(input.value) || 0;
            total += denominacion * cantidad;
        });
        total += parseFloat(monedasOtros.value) || 0;
        
        document.getElementById('totalConteo').textContent = `$${total.toFixed(2)}`;
        
        // Calcular diferencia
        const diferencia = total - saldoCaja;
        const diferenciaCaja = document.getElementById('diferenciaCaja');
        const montoDiferencia = document.getElementById('montoDiferencia');
        
        diferenciaCaja.classList.remove('d-none');
        montoDiferencia.textContent = `$${diferencia.toFixed(2)}`;
        
        if (diferencia < 0) {
            diferenciaCaja.className = 'alert alert-danger';
        } else if (diferencia > 0) {
            diferenciaCaja.className = 'alert alert-warning';
        } else {
            diferenciaCaja.className = 'alert alert-success';
        }
    };

    inputs.forEach(input => input.addEventListener('input', calcularTotal));
    monedasOtros.addEventListener('input', calcularTotal);

    // Limpiar el modal cuando se cierre
    document.getElementById('conteoEfectivoModal').addEventListener('hidden.bs.modal', function () {
        this.remove();
    });
}

// Función para imprimir el arqueo de caja
function imprimirArqueo() {
    const totalConteo = document.getElementById('totalConteo').textContent;
    const diferencia = document.getElementById('montoDiferencia').textContent;
    const fecha = new Date().toLocaleString();
    
    const contenido = `
        ===== ARQUEO DE CAJA =====
        Fecha: ${fecha}
        Saldo esperado: $${saldoCaja.toFixed(2)}
        Total contado: ${totalConteo}
        Diferencia: ${diferencia}
        ========================
    `;
    
    // Aquí puedes implementar la lógica de impresión
    console.log('Imprimiendo arqueo:', contenido);
    alert('Arqueo de caja impreso');
}

// Función para mostrar el histórico de ventas
function mostrarHistoricoVentas() {
    const modalHTML = `
        <div class="modal fade" id="historicoVentasModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Histórico de Ventas</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <div class="btn-group" role="group">
                                <button class="btn btn-outline-primary active" data-filter="hoy">Hoy</button>
                                <button class="btn btn-outline-primary" data-filter="semana">Esta Semana</button>
                                <button class="btn btn-outline-primary" data-filter="mes">Este Mes</button>
                            </div>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-striped">
                                <thead>
                                    <tr>
                                        <th>Hora</th>
                                        <th>Productos</th>
                                        <th>Total</th>
                                        <th>Método de Pago</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody id="tablaHistoricoVentas">
                                    <!-- Las ventas se cargarán aquí -->
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="2" class="text-end"><strong>Total:</strong></td>
                                        <td colspan="3"><strong id="totalVentasPeriodo">$0.00</strong></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Agregar el modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Obtener las ventas y mostrarlas
    const cargarVentas = async (filtro = 'hoy') => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/ventas?filtro=${filtro}`, {
                headers: {
                    'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
                }
            });

            if (!response.ok) throw new Error('Error al cargar las ventas');
            
            const ventas = await response.json();
            const tbody = document.getElementById('tablaHistoricoVentas');
            tbody.innerHTML = '';

            let totalPeriodo = 0;

            ventas.forEach(venta => {
                const fecha = new Date(venta.fecha);
                const tr = document.createElement('tr');
                const detalles = Array.isArray(venta.detalles) ? venta.detalles.length : 0;
                const total = parseFloat(venta.total);
                totalPeriodo += total;

                tr.innerHTML = `
                    <td>${fecha.toLocaleTimeString()}</td>
                    <td>${detalles} items</td>
                    <td>$${total.toFixed(2)}</td>
                    <td>${venta.metodo_pago || 'Efectivo'}</td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="verDetalleVenta(${venta.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="imprimirTicket(${venta.id})">
                            <i class="fas fa-print"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Actualizar el total del período
            document.getElementById('totalVentasPeriodo').textContent = `$${totalPeriodo.toFixed(2)}`;
        } catch (error) {
            console.error('Error al cargar ventas:', error);
            document.getElementById('tablaHistoricoVentas').innerHTML = `
                <tr><td colspan="5" class="text-center text-danger">Error al cargar las ventas</td></tr>
            `;
        }
    };

    // Configurar botones de filtro
    const modal = document.getElementById('historicoVentasModal');
    const botonesFilter = modal.querySelectorAll('[data-filter]');
    botonesFilter.forEach(boton => {
        boton.addEventListener('click', (e) => {
            botonesFilter.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            cargarVentas(e.target.dataset.filter);
        });
    });

    // Mostrar el modal y cargar las ventas iniciales
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
    cargarVentas('hoy');

    // Limpiar el modal cuando se cierre
    modal.addEventListener('hidden.bs.modal', function () {
        this.remove();
    });
}

// Mostrar detalle de una venta en un modal
window.verDetalleVenta = async function(ventaId) {
    try {
        // Buscar la venta en la tabla ya cargada
        const filas = document.querySelectorAll('#tablaHistoricoVentas tr');
        let venta = null;
        for (const fila of filas) {
            const btn = fila.querySelector('button.btn-info');
            if (btn && btn.getAttribute('onclick') === `verDetalleVenta(${ventaId})`) {
                // Obtener datos de la venta desde la API para asegurar detalles completos
                const response = await fetch(`${API_BASE_URL}/api/ventas?filtro=hoy`, {
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
                    }
                });
                if (!response.ok) throw new Error('No se pudo obtener la venta');
                const ventas = await response.json();
                venta = ventas.find(v => v.id === ventaId);
                break;
            }
        }
        if (!venta) {
            alert('No se encontró la venta.');
            return;
        }
        // Construir tabla de productos
        let productosHTML = '';
        if (Array.isArray(venta.detalles) && venta.detalles.length > 0) {
            productosHTML = venta.detalles.map(det => `
                <tr>
                    <td>${det.producto_id}</td>
                    <td>${det.cantidad}</td>
                    <td>$${parseFloat(det.precio).toFixed(2)}</td>
                    <td>$${parseFloat(det.total).toFixed(2)}</td>
                </tr>
            `).join('');
        } else {
            productosHTML = '<tr><td colspan="4" class="text-center">Sin productos</td></tr>';
        }
        // Modal HTML
        const modalHTML = `
            <div class="modal fade" id="detalleVentaModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Detalle de Venta #${venta.id}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p><strong>Fecha:</strong> ${new Date(venta.fecha).toLocaleString()}</p>
                            <table class="table table-bordered">
                                <thead>
                                    <tr>
                                        <th>ID Producto</th>
                                        <th>Cantidad</th>
                                        <th>Precio Unitario</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${productosHTML}
                                </tbody>
                            </table>
                            <div class="text-end">
                                <strong>Total de la venta: $${parseFloat(venta.total).toFixed(2)}</strong>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        // Eliminar modal anterior si existe
        const anterior = document.getElementById('detalleVentaModal');
        if (anterior) anterior.remove();
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('detalleVentaModal'));
        modal.show();
        document.getElementById('detalleVentaModal').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    } catch (error) {
        alert('Error al mostrar el detalle de la venta');
    }
}

// Funciones de productos
function cargarProductos(productos) {
    const productGrid = document.getElementById('productGrid');
    productGrid.innerHTML = '';

    productos.forEach(producto => {
        const productoHTML = `
            <div class="col-md-3 col-sm-6 mb-3">
                <div class="card h-100">
                    <div class="card-body text-center">
                        ${producto.imagen ? 
                            `<img src="${API_BASE_URL}${producto.imagen}" alt="${producto.nombre}" class="img-fluid mb-3" style="max-height: 100px; object-fit: contain;">` :
                            `<div class="placeholder-image mb-3">
                                <i class="fas fa-box fa-3x text-secondary"></i>
                             </div>`
                        }
                        <h6 class="card-title">${producto.nombre}</h6>
                        <p class="card-text text-primary fw-bold">$${producto.precio_venta.toFixed(2)}</p>
                        <small class="text-muted d-block mb-2">${producto.codigo_barras || ''}</small>
                        <button class="btn btn-primary btn-sm" onclick="agregarAlCarrito(${producto.id})">
                            <i class="fas fa-plus"></i> Agregar
                        </button>
                    </div>
                </div>
            </div>
        `;
        productGrid.innerHTML += productoHTML;
    });
}

function buscarPorCodigo(codigo) {
    const producto = productos.find(p => p.codigo_barras === codigo);
    if (producto) {
        agregarAlCarrito(producto.id);
        return true;
    }
    return false;
}

// Funciones del carrito
function agregarAlCarrito(productoId) {
    if (!cajaAbierta) {
        alert('Debe abrir la caja antes de realizar ventas');
        return;
    }

    const producto = productos.find(p => p.id === productoId);
    const itemEnCarrito = carrito.find(item => item.productoId === productoId);

    if (itemEnCarrito) {
        itemEnCarrito.cantidad++;
    } else {
        carrito.push({
            productoId,
            nombre: producto.nombre,
            precio: producto.precio_venta,
            cantidad: 1
        });
    }

    actualizarCarrito();
}

function eliminarDelCarrito(productoId) {
    carrito = carrito.filter(item => item.productoId !== productoId);
    actualizarCarrito();
}

function actualizarCarrito() {
    const cartItems = document.getElementById('cartItems');
    cartItems.innerHTML = '';

    let subtotal = 0;

    carrito.forEach(item => {
        const total = item.precio * item.cantidad;
        subtotal += total;

        const itemHTML = `
            <tr>
                <td>${item.nombre}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-secondary" onclick="actualizarCantidad(${item.productoId}, ${item.cantidad - 1})">
                            <i class="fas fa-minus"></i>
                        </button>
                        <span class="btn btn-outline-secondary disabled">${item.cantidad}</span>
                        <button class="btn btn-outline-secondary" onclick="actualizarCantidad(${item.productoId}, ${item.cantidad + 1})">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </td>
                <td>$${item.precio.toFixed(2)}</td>
                <td>$${total.toFixed(2)}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="eliminarDelCarrito(${item.productoId})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        cartItems.innerHTML += itemHTML;
    });

    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('discounts').textContent = `$0.00`; // Assuming discounts are handled separately or not applicable here

    // Surcharge Calculation
    const paymentMethodSelect = document.getElementById('paymentMethod');
    const selectedPaymentMethod = paymentMethodSelect ? paymentMethodSelect.value : '';
    let surcharge = 0;
    let grandTotal = subtotal;

    if (SURCHARGE_PAYMENT_METHODS_CLIENT.includes(selectedPaymentMethod.toLowerCase())) {
        surcharge = parseFloat((subtotal * SURCHARGE_RATE_CLIENT).toFixed(2));
        grandTotal = parseFloat((subtotal + surcharge).toFixed(2));
    }

    // Display Surcharge
    const surchargeRow = document.getElementById('surchargeRow');
    const surchargeValueElement = document.getElementById('surchargeValue');

    if (surchargeRow && surchargeValueElement) {
        if (surcharge > 0) {
            surchargeValueElement.textContent = `$${surcharge.toFixed(2)}`;
            surchargeRow.style.display = ''; // Or 'table-row' if it's a tr
        } else {
            surchargeRow.style.display = 'none';
        }
    }
    
    document.getElementById('total').textContent = `$${grandTotal.toFixed(2)}`;
}

function actualizarCantidad(productoId, nuevaCantidad) {
    if (nuevaCantidad < 1) {
        eliminarDelCarrito(productoId);
        return;
    }

    const item = carrito.find(item => item.productoId === productoId);
    if (item) {
        item.cantidad = nuevaCantidad;
        actualizarCarrito();
    }
}

// Funciones de cliente y fidelización
function buscarCliente() {
    const searchValue = document.getElementById('customerSearch').value;
    if (!searchValue) return;

    const cliente = loyaltySystem.findCustomer(searchValue);
    if (cliente) {
        mostrarInfoCliente(cliente);
    } else {
        document.getElementById('customerInfo').classList.add('d-none');
        document.getElementById('newCustomerForm').classList.remove('d-none');
    }
}

function mostrarInfoCliente(cliente) {
    clienteActual = cliente;
    document.getElementById('newCustomerForm').classList.add('d-none');
    document.getElementById('customerInfo').classList.remove('d-none');

    document.getElementById('customerName').textContent = cliente.name;
    document.getElementById('customerLevel').textContent = cliente.level;
    document.getElementById('customerPoints').textContent = cliente.points;
    document.getElementById('customerDiscount').textContent = '0%';

    // Mostrar recompensas disponibles
    const recompensas = loyaltySystem.getAvailableRewards(cliente.id);
    const rewardsContainer = document.getElementById('availableRewards');
    rewardsContainer.innerHTML = recompensas.map(reward => `
        <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${reward.name}</h6>
                    <small class="text-muted">${reward.description}</small>
                </div>
                <button class="btn btn-sm btn-primary" onclick="canjearRecompensa(${reward.id})">
                    Canjear (${reward.pointsCost} pts)
                </button>
            </div>
        </div>
    `).join('');
}

function registrarCliente() {
    const newCustomer = {
        name: document.getElementById('newCustomerName').value,
        phone: document.getElementById('newCustomerPhone').value,
        email: document.getElementById('newCustomerEmail').value
    };

    const cliente = loyaltySystem.registerCustomer(newCustomer);
    if (cliente) {
        mostrarInfoCliente(cliente);
    }
}

function canjearRecompensa(rewardId) {
    if (!clienteActual) return;

    const resultado = loyaltySystem.redeemReward(clienteActual.id, rewardId);
    if (resultado) {
        mostrarInfoCliente(resultado.customer);
        alert(`¡Recompensa canjeada con éxito! ${resultado.reward.description}`);
    } else {
        alert('No se pudo canjear la recompensa');
    }
}

// Procesar venta con puntos
function procesarVentaConPuntos(total) {
    if (clienteActual) {
        const resultado = loyaltySystem.updatePoints(clienteActual.id, total);
        if (resultado) {
            alert(`¡Cliente ha ganado ${resultado.pointsEarned} puntos!`);
            clienteActual = resultado.customer;
        }
    }
}

// Funciones de facturación
function editarFactura() {
    if (!facturaActual) {
        facturaActual = {
            rfc: document.getElementById('rfc').value,
            razonSocial: document.getElementById('razonSocial').value,
            direccionFiscal: document.getElementById('direccionFiscal').value,
            items: [...carrito],
            subtotal: parseFloat(document.getElementById('subtotal').textContent.replace('$', '')),
            descuentos: 0,
            total: parseFloat(document.getElementById('total').textContent.replace('$', ''))
        };
    }

    const inputs = document.querySelectorAll('#invoiceForm input, #invoiceForm textarea');
    if (!facturaEditando) {
        // Habilitar edición
        inputs.forEach(input => input.removeAttribute('readonly'));
        facturaEditando = true;
        document.querySelector('button[onclick="editarFactura()"]')
            .innerHTML = '<i class="fas fa-save"></i> Guardar';
    } else {
        // Guardar cambios
        if (document.getElementById('invoiceForm').checkValidity()) {
            facturaActual = {
                ...facturaActual,
                rfc: document.getElementById('rfc').value,
                razonSocial: document.getElementById('razonSocial').value,
                direccionFiscal: document.getElementById('direccionFiscal').value
            };
            inputs.forEach(input => input.setAttribute('readonly', 'true'));
            facturaEditando = false;
            document.querySelector('button[onclick="editarFactura()"]')
                .innerHTML = '<i class="fas fa-edit"></i> Editar';
        } else {
            alert('Por favor complete todos los campos requeridos correctamente');
        }
    }
}

async function imprimirFactura() {
    if (!facturaActual) {
        alert('No hay datos de factura para imprimir');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/facturas/imprimir`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            },
            body: JSON.stringify(facturaActual)
        });

        if (!response.ok) throw new Error('Error al generar la impresión');

        // Simular impresión
        const contenido = generarContenidoFactura(facturaActual);
        const ventanaImpresion = window.open('', '_blank');
        ventanaImpresion.document.write(`
            <html>
                <head>
                    <title>Factura</title>
                    <style>
                        body { font-family: Arial, sans-serif; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { padding: 8px; border: 1px solid #ddd; }
                        .header { text-align: center; margin-bottom: 20px; }
                    </style>
                </head>
                <body>
                    ${contenido}
                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('Error al imprimir:', error);
        alert('Error al imprimir la factura');
    }
}

function continuarVenta() {
    const form = document.getElementById('invoiceForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const datosFactura = {
        rfc: document.getElementById('rfc').value,
        razonSocial: document.getElementById('razonSocial').value,
        direccionFiscal: document.getElementById('direccionFiscal').value
    };

    // Cerrar modal de facturación
    const modal = bootstrap.Modal.getInstance(document.getElementById('invoiceModal'));
    modal.hide();

    // Procesar venta con datos de factura
    procesarVenta(datosFactura);
}

function generarContenidoFactura(factura) {
    const fecha = new Date().toLocaleDateString();
    return `
        <div class="header">
            <h2>FACTURA</h2>
            <p>Fecha: ${fecha}</p>
        </div>
        <div class="cliente">
            <strong>RFC:</strong> ${factura.rfc}<br>
            <strong>Razón Social:</strong> ${factura.razonSocial}<br>
            <strong>Dirección Fiscal:</strong> ${factura.direccionFiscal}<br>
        </div>
        <table class="mt-4">
            <thead>
                <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio Unitario</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${factura.items.map(item => `
                    <tr>
                        <td>${item.nombre}</td>
                        <td>${item.cantidad}</td>
                        <td>$${item.precio.toFixed(2)}</td>
                        <td>$${(item.precio * item.cantidad).toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3" class="text-end"><strong>Subtotal:</strong></td>
                    <td>$${factura.subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                    <td colspan="3" class="text-end"><strong>Descuentos:</strong></td>
                    <td>$${factura.descuentos.toFixed(2)}</td>
                </tr>
                <tr>
                    <td colspan="3" class="text-end"><strong>Total:</strong></td>
                    <td>$${factura.total.toFixed(2)}</td>
                </tr>
            </tfoot>
        </table>
    `;
}

// Inicialización y eventos de caja
document.addEventListener('DOMContentLoaded', function() {
    const openDrawerBtn = document.getElementById('openDrawerBtn');
    if (openDrawerBtn) {
        openDrawerBtn.addEventListener('click', mostrarModalAbrirCaja);
    }

    // Verificar estado de la caja al cargar y actualizar los botones
    const estadoCaja = JSON.parse(sessionStorage.getItem('cajaAbierta')) || false;
    cajaAbierta = estadoCaja; // Actualizar la variable global
    saldoCaja = parseFloat(sessionStorage.getItem('saldoCaja')) || 0;

    if (estadoCaja) {
        document.getElementById('openDrawerBtn').classList.add('disabled');
        document.getElementById('closeDrawerBtn').classList.remove('disabled');
    } else {
        document.getElementById('openDrawerBtn').classList.remove('disabled');
        document.getElementById('closeDrawerBtn').classList.add('disabled');
    }

    // Botón de conteo de efectivo
    const cashCountBtn = document.getElementById('cashCountBtn');
    if (cashCountBtn) {
        cashCountBtn.addEventListener('click', mostrarModalConteoEfectivo);
    }

    // Agregar botón de histórico de ventas al modal de caja
    const drawerModal = document.querySelector('#drawerModal .modal-body .d-grid');
    if (drawerModal) {
        const historicoBtn = document.createElement('button');
        historicoBtn.className = 'btn btn-success';
        historicoBtn.innerHTML = '<i class="fas fa-history me-2"></i>Ver Ventas del Día';
        historicoBtn.onclick = mostrarHistoricoVentas;
        drawerModal.appendChild(historicoBtn);
    }
});

function mostrarModalAbrirCaja() {
    const modalHTML = `
        <div class="modal fade" id="abrirCajaModal" tabindex="-1" aria-labelledby="abrirCajaModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="abrirCajaModalLabel">Abrir Caja</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="montoInicial">Monto Inicial:</label>
                            <input type="number" class="form-control" id="montoInicial" min="0" step="0.01" required>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="confirmarAbrirCaja()">Abrir Caja</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Agregar el modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Mostrar el modal
    const modal = new bootstrap.Modal(document.getElementById('abrirCajaModal'));
    modal.show();

    // Limpiar el modal cuando se cierre
    document.getElementById('abrirCajaModal').addEventListener('hidden.bs.modal', function () {
        this.remove();
    });
}

function confirmarAbrirCaja() {
    const montoInicial = parseFloat(document.getElementById('montoInicial').value);
    if (abrirCaja(montoInicial)) {
        // Actualizar estado de los botones
        document.getElementById('openDrawerBtn').classList.add('disabled');
        document.getElementById('closeDrawerBtn').classList.remove('disabled');
        
        // Obtener y cerrar el modal
        const modalElement = document.getElementById('abrirCajaModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        
        if (modal) {
            modal.hide();
        }
        // Eliminar backdrop y modal del DOM después de un pequeño delay para asegurar que se ocultó
        setTimeout(() => {
            // Eliminar todos los backdrops
            document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
            // Eliminar el modal
            if (modalElement) modalElement.remove();
            // Limpiar clases del body
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }, 400);
    }
}

// Funciones de venta
function calcularCambio() {
    const total = parseFloat(document.getElementById('total').textContent.replace('$', ''));
    const efectivoRecibido = parseFloat(document.getElementById('cashAmount').value);

    if (isNaN(efectivoRecibido)) {
        document.getElementById('changeAmount').textContent = '$0.00';
        return;
    }

    const cambio = efectivoRecibido - total;
    document.getElementById('changeAmount').textContent = `$${Math.max(0, cambio).toFixed(2)}`;
}

async function procesarVenta(datosFactura = null) {
    if (!cajaAbierta) {
        alert('Debe abrir la caja antes de procesar la venta');
        return;
    }

    if (carrito.length === 0) {
        alert('El carrito está vacío');
        return;
    }

    const metodoPago = document.getElementById('paymentMethod').value;
    // const total = parseFloat(document.getElementById('total').textContent.replace('$', '')); // Total is now calculated server-side
    const requireInvoice = document.getElementById('requireInvoice').checked;

    if (metodoPago === 'cash') {
        // For cash payment, client-side validation of received amount against displayed total is still useful
        const displayedTotal = parseFloat(document.getElementById('total').textContent.replace('$', ''));
        const efectivoRecibido = parseFloat(document.getElementById('cashAmount').value);
        if (isNaN(efectivoRecibido) || efectivoRecibido < displayedTotal) {
            alert('Monto de efectivo inválido o insuficiente para el total mostrado.');
            return;
        }
    }

    if (requireInvoice && !clienteActual) {
        alert('Para generar una factura, primero debe seleccionar un cliente');
        const modalCliente = new bootstrap.Modal(document.getElementById('modalCliente'));
        modalCliente.show();
        return;
    }

    try {
        // Crear el objeto de venta
        const ventaData = {
            productos: carrito.map(item => ({
                producto_id: item.productoId,
                cantidad: item.cantidad,
                precio_unitario: item.precio
            })),
            // total: total, // REMOVED - Server will calculate
            metodo_pago: metodoPago,
            // datos_factura: datosFactura, // Keep if used for other invoice info not related to totals
            cliente_id: clienteActual?.id
        };
         // Include datosFactura only if it exists and is relevant
        if (datosFactura) {
            ventaData.datos_factura = datosFactura;
        }


        // Enviar venta al servidor
        const response = await fetch(`${API_BASE_URL}/api/ventas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            },
            body: JSON.stringify(ventaData)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.mensaje || 'Error al procesar la venta');
        }

        // Si se requiere factura, generarla
        if (requireInvoice && clienteActual) {
            try {
                const facturaResponse = await fetch(`${API_BASE_URL}/api/facturas/${data.id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
                    },
                    body: JSON.stringify({
                        clienteId: clienteActual.id
                    })
                });

                if (!facturaResponse.ok) {
                    const errorData = await facturaResponse.json();
                    throw new Error(errorData.mensaje || 'Error al generar la factura');
                }

                const facturaData = await facturaResponse.json();
                // Abrir la factura en una nueva ventana
                window.open(`${API_BASE_URL}${facturaData.url}`, '_blank');
            } catch (error) {
                console.error('Error al generar factura:', error);
                alert('Error al generar la factura: ' + error.message);
            }
        }

        // Actualizar saldo de caja
        if (metodoPago === 'cash') {
            saldoCaja += total;
            sessionStorage.setItem('saldoCaja', saldoCaja.toString());
        }

        // Limpiar carrito y formulario
        carrito = [];
        actualizarCarrito();
        document.getElementById('cashAmount').value = '';
        document.getElementById('changeAmount').textContent = '$0.00';
        document.getElementById('requireInvoice').checked = false;
        clienteActual = null;

        alert('Venta procesada con éxito');

        // Recargar productos
        const productosResponse = await fetch(`${API_BASE_URL}/api/productos`, {
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            }
        });

        if (!productosResponse.ok) {
            throw new Error('Error al actualizar productos');
        }

        const productosData = await productosResponse.json();
        productos = productosData;
        cargarProductos(productos);

    } catch (error) {
        console.error('Error:', error);
        alert(error.message || 'Error al procesar la venta');
    }
}

function continuarVenta() {
    const form = document.getElementById('invoiceForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const datosFactura = {
        rfc: document.getElementById('rfc').value,
        razonSocial: document.getElementById('razonSocial').value,
        direccionFiscal: document.getElementById('direccionFiscal').value
    };

    // Cerrar modal de facturación
    const modal = bootstrap.Modal.getInstance(document.getElementById('invoiceModal'));
    modal.hide();

    // Procesar venta con datos de factura
    procesarVenta(datosFactura);
}

function imprimirFactura(venta) {
    const contenido = `
        ==== FACTURA ====
        RFC: ${venta.datosFactura.rfc}
        Razón Social: ${venta.datosFactura.razonSocial}
        Dirección: ${venta.datosFactura.direccionFiscal}
        Fecha: ${new Date(venta.fecha).toLocaleString()}
        
        Productos:
        ${venta.items.map(item => 
            `${item.nombre} x${item.cantidad} - $${(item.precio * item.cantidad).toFixed(2)}`
        ).join('\n')}
        
        Subtotal: $${document.getElementById('subtotal').textContent.replace('$', '')}
        Descuento: $0.00
        Total: $${venta.total.toFixed(2)}
        
        Método de pago: ${venta.metodoPago}
        
        *Los precios ya incluyen IVA
        =================
    `;
    
    console.log('Imprimiendo factura:', contenido);
    // Aquí iría la lógica real de impresión
    alert('Factura generada con éxito');
}

function imprimirTicket(venta) {
    // Aquí iría la lógica para imprimir el ticket
    console.log('Imprimiendo ticket:', venta);
}

function ponerVentaEnEspera() {
    if (carrito.length === 0) {
        alert('El carrito está vacío');
        return;
    }

    ventasEnEspera.push([...carrito]);
    carrito = [];
    actualizarCarrito();
    alert('Venta puesta en espera');
}

function procesarDevolucion(numeroTicket, motivo) {
    // Aquí iría la lógica para procesar la devolución
    console.log('Procesando devolución:', { numeroTicket, motivo });
    alert('Devolución procesada con éxito');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Cargar productos
    cargarProductos(productos);

    // Lector de código de barras
    const barcodeInput = document.getElementById('barcodeInput');
    if (barcodeInput) {
        barcodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const codigo = barcodeInput.value;
                if (!buscarPorCodigo(codigo)) {
                    alert('Producto no encontrado');
                }
                barcodeInput.value = '';
                barcodeInput.focus();
            }
        });
    }

    // Búsqueda de productos
    const searchProductInput = document.getElementById('searchProduct');
    if (searchProductInput) {
        searchProductInput.addEventListener('input', (e) => {
            const busqueda = e.target.value.toLowerCase();
            const productosFiltrados = productos.filter(producto =>
                (producto.nombre && producto.nombre.toLowerCase().includes(busqueda)) ||
                (producto.codigo_barras && producto.codigo_barras.includes(busqueda))
            );
            cargarProductos(productosFiltrados);
        });
    }

    // Botones de acción
    const processSaleBtn = document.getElementById('processSale');
    if (processSaleBtn) processSaleBtn.addEventListener('click', procesarVenta);
    
    const clearCartBtn = document.getElementById('clearCart');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', () => {
            carrito = [];
            actualizarCarrito();
        });
    }

    const holdSaleBtn = document.getElementById('holdSale');
    if (holdSaleBtn) holdSaleBtn.addEventListener('click', ponerVentaEnEspera);

    const calculateChangeBtn = document.getElementById('calculateChange');
    if (calculateChangeBtn) calculateChangeBtn.addEventListener('click', calcularCambio);
    
    // Modal de devolución
    const processReturnBtn = document.getElementById('processReturn');
    if (processReturnBtn) {
        processReturnBtn.addEventListener('click', () => {
            const numeroTicket = document.getElementById('ticketNumber').value;
            const motivo = document.getElementById('returnReason').value;
            procesarDevolucion(numeroTicket, motivo);
        });
    }

    // Operaciones de caja
    const drawerButton = document.getElementById('drawerButton');
    if (drawerButton) {
        const drawerModalElement = document.getElementById('drawerModal');
        if (drawerModalElement) {
            const drawerModal = new bootstrap.Modal(drawerModalElement);
            drawerButton.addEventListener('click', () => {
                drawerModal.show();
            });

            const openDrawerBtn = document.getElementById('openDrawerBtn');
            if (openDrawerBtn) {
                openDrawerBtn.addEventListener('click', () => {
                    mostrarModalAbrirCaja();
                });
            }

            const closeDrawerBtn = document.getElementById('closeDrawerBtn');
            if (closeDrawerBtn) {
                closeDrawerBtn.addEventListener('click', () => {
                    const resumen = cerrarCaja();
                    if (resumen) {
                        alert(`Caja cerrada. Saldo final: $${resumen.saldoFinal.toFixed(2)}`);
                        drawerModal.hide();
                    }
                });
            }
        }
    }
    
    // Verificar estado de la caja al cargar
    const cajaAbierta = JSON.parse(sessionStorage.getItem('cajaAbierta')) || false;
    const openDrawerBtn = document.getElementById('openDrawerBtn');
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');

    if (openDrawerBtn && closeDrawerBtn) {
        if (cajaAbierta) {
            openDrawerBtn.classList.add('disabled');
            closeDrawerBtn.classList.remove('disabled');
        } else {
            openDrawerBtn.classList.remove('disabled');
            closeDrawerBtn.classList.add('disabled');
        }
    }

    // Event listener for payment method change
    const paymentMethodSelect = document.getElementById('paymentMethod');
    if (paymentMethodSelect) {
        paymentMethodSelect.addEventListener('change', actualizarCarrito);
    }
});

// Funciones de cliente
async function buscarCliente() {
    const telefono = document.getElementById('telefonoBuscar').value;
    if (!telefono) {
        alert('Por favor ingrese un número de teléfono');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/clientes/buscar/${telefono}`, {
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            }
        });

        const data = await response.json();

        if (response.status === 404) {
            // Cliente no encontrado, mostrar formulario de registro
            document.getElementById('clienteInfo').classList.add('d-none');
            document.getElementById('formNuevoCliente').classList.remove('d-none');
            document.getElementById('telefonoCliente').value = telefono;
            return;
        }

        if (!response.ok) {
            throw new Error(data.mensaje || 'Error al buscar cliente');
        }

        mostrarInfoCliente(data);
    } catch (error) {
        console.error('Error:', error);
        alert(error.message || 'Error al buscar el cliente');
    }
}

function mostrarInfoCliente(cliente) {
    clienteActual = cliente;
    document.getElementById('formNuevoCliente').classList.add('d-none');
    document.getElementById('clienteInfo').classList.remove('d-none');

    document.getElementById('clienteNombre').textContent = `${cliente.nombre} ${cliente.apellido}`;
    document.getElementById('clienteTelefono').textContent = cliente.telefono;
    document.getElementById('clienteEmail').textContent = cliente.email || 'No especificado';
    document.getElementById('clienteDireccion').textContent = cliente.direccion || 'No especificada';
    document.getElementById('clientePuntos').textContent = cliente.puntos;
    document.getElementById('clienteNivel').textContent = cliente.nivel;
}

async function registrarCliente(event) {
    event.preventDefault();

    const datosCliente = {
        nombre: document.getElementById('nombreCliente').value,
        apellido: document.getElementById('apellidoCliente').value,
        telefono: document.getElementById('telefonoCliente').value,
        email: document.getElementById('emailCliente').value,
        direccion: document.getElementById('direccionCliente').value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/clientes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            },
            body: JSON.stringify(datosCliente)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al registrar el cliente');
        }

        const cliente = await response.json();
        mostrarInfoCliente(cliente);
        alert('Cliente registrado exitosamente');
    } catch (error) {
        console.error('Error:', error);
        alert(error.message);
    }
}

// Inicialización y eventos
document.addEventListener('DOMContentLoaded', function() {
    // ...existing code...

    // Configurar el botón de cliente
    const customerBtn = document.getElementById('customerBtn');
    if (customerBtn) {
        customerBtn.addEventListener('click', () => {
            const modalCliente = new bootstrap.Modal(document.getElementById('modalCliente'));
            modalCliente.show();
        });
    }

    // ...existing code...
});