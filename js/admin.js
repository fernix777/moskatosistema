// Módulo de administración
// La constante API_BASE_URL se importa desde auth.js

const adminModule = {
    verificarSesion: verificarSesion,
    actualizarEstadisticas: async function() {
        const elementosTotales = document.getElementById('totalVentas');
        const elementosProducto = document.getElementById('productoMasVendido');

        if (!elementosTotales || !elementosProducto) {
            console.error('No se encontraron los elementos del DOM necesarios para las estadísticas');
            return;
        }

        try {
            const token = sessionStorage.getItem('jwtToken');
            if (!token) {
                throw new Error('No se encontró el token de autenticación');
            }

            const headers = {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            };

            const [ventasResponse, productosResponse, categoriasResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/api/ventas`, { headers }),
                fetch(`${API_BASE_URL}/api/productos`, { headers }),
                fetch(`${API_BASE_URL}/api/categorias`, { headers })
            ]);

            if (!ventasResponse.ok || !productosResponse.ok || !categoriasResponse.ok) {
                throw new Error('Error al obtener datos del servidor');
            }

            const [ventas, productos, categorias] = await Promise.all([
                ventasResponse.json(),
                productosResponse.json(),
                categoriasResponse.json()
            ]);

            if (!Array.isArray(ventas) || !Array.isArray(productos)) {
                throw new Error('Formato de datos inválido');
            }

            const totalVentas = ventas.reduce((sum, venta) => {
                return sum + (typeof venta.total === 'number' ? venta.total : 0);
            }, 0);
            
            // Encontrar el producto más vendido
            const ventasPorProducto = {};
            ventas.forEach(venta => {
                if (Array.isArray(venta.detalles)) {
                    venta.detalles.forEach(detalle => {
                        if (detalle && typeof detalle.producto_id === 'number' && typeof detalle.cantidad === 'number') {
                            ventasPorProducto[detalle.producto_id] = (ventasPorProducto[detalle.producto_id] || 0) + detalle.cantidad;
                        }
                    });
                }
            });
            
            const productoMasVendidoId = Object.entries(ventasPorProducto)
                .sort(([,a], [,b]) => b - a)[0]?.[0];
            
            const productoMasVendido = productos.find(p => p.id === parseInt(productoMasVendidoId));

            // Actualizar el DOM de manera segura
            elementosTotales.textContent = `Total de Ventas: $${totalVentas.toFixed(2)}`;
            elementosProducto.textContent = `Producto más Vendido: ${productoMasVendido?.nombre || 'Sin ventas'}`;
        } catch (error) {
            console.error('Error al actualizar estadísticas:', error);
            elementosTotales.textContent = 'Error al cargar estadísticas';
            elementosProducto.textContent = 'Error al cargar estadísticas';
        }
    },
    manejarCreacionCategoria: async function(event) {
        event.preventDefault();
        const form = document.getElementById('formCategoria');
        const nombre = form.querySelector('[name="nombre"]').value;
        const errorDiv = document.getElementById('errorCategoria');
        errorDiv.textContent = ''; // Limpiar mensajes de error anteriores

        try {
            const token = sessionStorage.getItem('jwtToken');
            if (!token) {
                throw new Error('No se encontró el token de autenticación');
            }

            console.log('Enviando solicitud para crear categoría:', { nombre });
            const response = await fetch(`${API_BASE_URL}/api/categorias`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ nombre })
            });

            console.log('Respuesta del servidor:', response.status);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Error al crear la categoría');
            }

            console.log('Categoría creada:', data);
            alert('Categoría creada exitosamente');
            form.reset();
            await this.cargarCategorias();
            const modalInstance = bootstrap.Modal.getInstance(document.getElementById('modalCategoria'));
            if (modalInstance) {
                modalInstance.hide();
            }
        } catch (error) {
            console.error('Error al crear categoría:', error);
            errorDiv.textContent = error.message || 'Error al crear la categoría';
        }
    },

    async cargarCategorias() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/categorias`, {
                headers: {
                    'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Error al cargar las categorías');
            }

            const categorias = await response.json();
            const tbody = document.querySelector('#tablaCategorias tbody');
            tbody.innerHTML = '';

            categorias.forEach(categoria => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${categoria.id}</td>
                    <td>${categoria.nombre}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="adminModule.eliminarCategoria(${categoria.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error:', error);
            alert('No se pudieron cargar las categorías. Por favor, inténtelo de nuevo más tarde.');
        }
    },

    async eliminarCategoria(id) {
        if (!confirm('¿Está seguro de eliminar esta categoría?')) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/categorias/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                if (error.error === 'categoria_con_productos') {
                    throw new Error('No se puede eliminar la categoría porque tiene productos asociados');
                }
                throw new Error('Error al eliminar la categoría');
            }

            await this.cargarCategorias();
            alert('Categoría eliminada exitosamente');
        } catch (error) {
            alert(error.message);
        }
    },

    manejarCreacionProducto: async function(event) {
        event.preventDefault();
        const form = document.getElementById('formProducto');
        const errorDiv = document.getElementById('errorProducto');
        errorDiv.textContent = '';
        
        try {
            // Validar el formulario
            const datos = validarFormularioProducto(form);
            
            const token = sessionStorage.getItem('jwtToken');
            if (!token) {
                throw new Error('No se encontró el token de autenticación');
            }

            // Primero crear el producto
            const datosProducto = {
                nombre: datos.nombre,
                codigo_barras: datos.codigoBarras,
                categoria_id: parseInt(datos.categoria),
                stock: datos.stock,
                precio_costo: datos.precioCosto,
                precio_venta: datos.precioVenta
            };

            const response = await fetch(`${API_BASE_URL}/api/productos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(datosProducto)
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.mensaje || 'Error al crear el producto');
            }

            // Si hay una imagen, subirla
            const imagenInput = form.querySelector('[name="imagen"]');
            if (imagenInput.files && imagenInput.files[0]) {
                const formData = new FormData();
                formData.append('imagen', imagenInput.files[0]);

                const respuestaImagen = await fetch(`${API_BASE_URL}/api/productos/${data.id}/imagen`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                if (!respuestaImagen.ok) {
                    console.error('Error al subir la imagen');
                }
            }

            // Limpiar el formulario y cerrar el modal
            form.reset();
            const previewDiv = document.getElementById('previewImagen');
            if (previewDiv) {
                previewDiv.innerHTML = '';
            }
            
            await this.cargarProductos();
            bootstrap.Modal.getInstance(document.getElementById('modalProducto')).hide();
            alert('Producto creado exitosamente');
        } catch (error) {
            console.error('Error al crear producto:', error);
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
        }
    },

    cargarProductos: async function() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/productos`, {
                headers: {
                    'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Error al cargar los productos');
            }

            const productos = await response.json();
            const tbody = document.querySelector('#tablaProductos tbody');
            tbody.innerHTML = '';

            productos.forEach(producto => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><img src="${producto.imagen ? API_BASE_URL + producto.imagen : 'images/1744785567066-corona_caja.jpg'}" alt="${producto.nombre}" width="50"></td>
                    <td>${producto.codigo_barras || ''}</td>
                    <td>${producto.nombre}</td>
                    <td>${producto.categoria_nombre || 'Sin categoría'}</td>
                    <td>${producto.stock}</td>
                    <td>$${producto.precio_costo.toFixed(2)}</td>
                    <td>$${producto.precio_venta.toFixed(2)}</td>
                    <td>
                        <button class="btn btn-sm btn-warning me-1" onclick="adminModule.abrirModalEditarProducto(${producto.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="adminModule.eliminarProducto(${producto.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error:', error);
            alert('No se pudieron cargar los productos. Por favor, inténtelo de nuevo más tarde.');
        }
    },

    eliminarProducto: async function(id) {
        if (!confirm('¿Está seguro de eliminar este producto?')) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/productos/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Error al eliminar el producto');
            }

            await this.cargarProductos();
            alert('Producto eliminado exitosamente');
        } catch (error) {
            alert(error.message);
        }
    },

    // --- EDICIÓN DE PRODUCTO ---
    abrirModalEditarProducto: async function(id) {
        try {
            const token = sessionStorage.getItem('jwtToken');
            const response = await fetch(`${API_BASE_URL}/api/productos`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const productos = await response.json();
            const producto = productos.find(p => p.id === id);
            if (!producto) return alert('Producto no encontrado');

            // Cargar categorías en el select
            const catResp = await fetch(`${API_BASE_URL}/api/categorias`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const categorias = await catResp.json();
            const select = document.querySelector('#modalEditarProducto select[name="categoria"]');
            select.innerHTML = '<option value="">Seleccione una categoría</option>';
            categorias.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.nombre;
                if (c.id === producto.categoria_id) opt.selected = true;
                select.appendChild(opt);
            });

            // Llenar el formulario
            const form = document.getElementById('formEditarProducto');
            form.id.value = producto.id;
            form.nombre.value = producto.nombre;
            form.categoria.value = producto.categoria_id;
            form.codigoBarras.value = producto.codigo_barras;
            form.stock.value = producto.stock;
            form.precioCosto.value = producto.precio_costo;
            form.precioVenta.value = producto.precio_venta;
            document.getElementById('previewEditarImagen').innerHTML = producto.imagen ? `<img src='${API_BASE_URL + producto.imagen}' style='max-width:120px'>` : '';
            form.imagen.value = '';

            // Mostrar el modal
            const modal = new bootstrap.Modal(document.getElementById('modalEditarProducto'));
            modal.show();
        } catch (e) {
            alert('Error al cargar datos del producto');
        }
    },

    // Cargar usuarios
    async cargarUsuarios() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/usuarios`, {
                headers: {
                    'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Error al cargar los usuarios');
            }

            const usuarios = await response.json();
            const tbody = document.querySelector('#tablaUsuarios tbody');
            tbody.innerHTML = '';

            usuarios.forEach(usuario => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${usuario.username}</td>
                    <td><span class="badge ${usuario.rol === 'admin' ? 'bg-danger' : 'bg-primary'}">${usuario.rol}</span></td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="adminModule.eliminarUsuario(${usuario.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error:', error);
            alert('No se pudieron cargar los usuarios');
        }
    },

    // Manejar creación de usuario
    manejarCreacionUsuario: async function(event) {
        event.preventDefault();
        const form = event.target;
        const errorDiv = document.getElementById('errorUsuario');
        errorDiv.textContent = '';

        try {
            const token = sessionStorage.getItem('jwtToken');
            if (!token) {
                throw new Error('No se encontró el token de autenticación');
            }

            const datosUsuario = {
                username: form.username.value,
                password: form.password.value,
                rol: form.rol.value
            };

            const response = await fetch(`${API_BASE_URL}/api/usuarios`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(datosUsuario)
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Error al crear el usuario');
            }

            alert('Usuario creado exitosamente');
            form.reset();
            await this.cargarUsuarios();
            bootstrap.Modal.getInstance(document.getElementById('modalUsuario')).hide();
        } catch (error) {
            console.error('Error al crear usuario:', error);
            errorDiv.textContent = error.message;
        }
    },

    // Eliminar usuario
    eliminarUsuario: async function(id) {
        if (!confirm('¿Está seguro de eliminar este usuario?')) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/usuarios/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.mensaje || 'Error al eliminar el usuario');
            }

            await this.cargarUsuarios();
            alert('Usuario eliminado exitosamente');
        } catch (error) {
            alert(error.message);
        }
    }
};

// Función para cargar categorías en el select del formulario de productos
async function cargarCategoriasEnSelect() {
    try {
        console.log('Iniciando carga de categorías...');
        const token = sessionStorage.getItem('jwtToken');
        if (!token) {
            throw new Error('No hay token de autenticación');
        }

        const response = await fetch(`${API_BASE_URL}/api/categorias`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Error al cargar las categorías: ${response.status}`);
        }

        const categorias = await response.json();
        console.log('Categorías cargadas:', categorias);

        const selectCategorias = document.querySelector('#modalProducto select[name="categoria"]');
        if (!selectCategorias) {
            throw new Error('No se encontró el elemento select de categorías');
        }

        selectCategorias.innerHTML = '<option value="">Seleccione una categoría</option>';

        if (!Array.isArray(categorias) || categorias.length === 0) {
            console.log('No hay categorías disponibles');
            selectCategorias.innerHTML += '<option value="" disabled>No hay categorías disponibles</option>';
            return;
        }

        categorias.forEach(categoria => {
            const option = document.createElement('option');
            option.value = categoria.id;
            option.textContent = categoria.nombre;
            selectCategorias.appendChild(option);
        });

        console.log('Categorías cargadas exitosamente en el select');
    } catch (error) {
        console.error('Error al cargar categorías:', error);
        const selectCategorias = document.querySelector('#modalProducto select[name="categoria"]');
        if (selectCategorias) {
            selectCategorias.innerHTML = '<option value="">Error al cargar categorías</option>';
        }
        alert(`Error al cargar las categorías: ${error.message || 'Error desconocido'}`);
    }
}

// Función para validar el formulario de productos
function validarFormularioProducto(form) {
    const precioCosto = parseFloat(form.querySelector('[name="precioCosto"]').value);
    const precioVenta = parseFloat(form.querySelector('[name="precioVenta"]').value);
    const stock = parseInt(form.querySelector('[name="stock"]').value);
    const categoria = form.querySelector('[name="categoria"]').value;
    const nombre = form.querySelector('[name="nombre"]').value.trim();
    const codigoBarras = form.querySelector('[name="codigoBarras"]').value.trim();

    if (!nombre) {
        throw new Error('El nombre del producto es requerido');
    }
    if (!codigoBarras) {
        throw new Error('El código de barras es requerido');
    }
    if (!categoria) {
        throw new Error('Debe seleccionar una categoría');
    }
    if (isNaN(stock) || stock < 0) {
        throw new Error('El stock debe ser un número mayor o igual a 0');
    }
    if (isNaN(precioCosto) || precioCosto <= 0) {
        throw new Error('El precio de costo debe ser un número mayor a 0');
    }
    if (isNaN(precioVenta) || precioVenta <= 0) {
        throw new Error('El precio de venta debe ser un número mayor a 0');
    }
    if (precioVenta <= precioCosto) {
        throw new Error('El precio de venta debe ser mayor al precio de costo');
    }

    return {
        nombre,
        codigoBarras,
        categoria,
        stock,
        precioCosto,
        precioVenta
    };
}

// Función para previsualizar imagen
document.addEventListener('DOMContentLoaded', function() {
    const imagenInput = document.querySelector('#modalProducto [name="imagen"]');
    if (imagenInput) {
        imagenInput.addEventListener('change', function() {
            const previewDiv = document.getElementById('previewImagen');
            previewDiv.innerHTML = '';
            
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.style.maxWidth = '200px';
                    img.style.maxHeight = '200px';
                    img.className = 'img-thumbnail mt-2';
                    previewDiv.appendChild(img);
                };
                reader.readAsDataURL(this.files[0]);
            }
        });
    }

    const formEditar = document.getElementById('formEditarProducto');
    if (formEditar) {
        formEditar.addEventListener('submit', async function(e) {
            e.preventDefault();
            const errorDiv = document.getElementById('errorEditarProducto');
            errorDiv.textContent = '';
            try {
                const id = formEditar.id.value;
                const datos = {
                    nombre: formEditar.nombre.value,
                    codigo_barras: formEditar.codigoBarras.value,
                    categoria_id: parseInt(formEditar.categoria.value),
                    stock: parseInt(formEditar.stock.value),
                    precio_costo: parseFloat(formEditar.precioCosto.value),
                    precio_venta: parseFloat(formEditar.precioVenta.value)
                };
                const token = sessionStorage.getItem('jwtToken');
                // Actualizar datos básicos
                const resp = await fetch(`${API_BASE_URL}/api/productos/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(datos)
                });
                if (!resp.ok) throw new Error('Error al actualizar el producto');
                // Si hay imagen, subirla
                if (formEditar.imagen.files && formEditar.imagen.files[0]) {
                    const formData = new FormData();
                    formData.append('imagen', formEditar.imagen.files[0]);
                    const imgResp = await fetch(`${API_BASE_URL}/api/productos/${id}/imagen`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    });
                    if (!imgResp.ok) throw new Error('Error al actualizar la imagen');
                }
                // Cerrar modal y recargar productos
                bootstrap.Modal.getInstance(document.getElementById('modalEditarProducto')).hide();
                await adminModule.cargarProductos();
                alert('Producto actualizado correctamente');
            } catch (err) {
                errorDiv.textContent = err.message || 'Error al actualizar';
            }
        });
        // Previsualización de imagen
        formEditar.imagen.addEventListener('change', function() {
            const previewDiv = document.getElementById('previewEditarImagen');
            previewDiv.innerHTML = '';
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.style.maxWidth = '200px';
                    img.style.maxHeight = '200px';
                    img.className = 'img-thumbnail mt-2';
                    previewDiv.appendChild(img);
                };
                reader.readAsDataURL(this.files[0]);
            }
        });
    }
});