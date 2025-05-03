// URL del servidor - cambia según el entorno
window.API_URL = 'https://moskatosistema-2.onrender.com';
window.API_BASE_URL = window.API_URL;

async function autenticarUsuario(username, password) {
    try {
        const response = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({username, password})
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Respuesta del backend:', errorData); // <-- Depuración
            throw new Error(errorData.error === 'credenciales_invalidas' ? 'Usuario o contraseña incorrectos' : 'Error de autenticación: ' + (errorData.mensaje || JSON.stringify(errorData)));
        }
        
        const { access_token } = await response.json();
        return access_token;
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

// Función para iniciar sesión
async function iniciarSesion(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    const token = await autenticarUsuario(username, password);
    
    if (token) {
        // Guardar el token en sessionStorage
        sessionStorage.setItem('jwtToken', token);
        
        // Obtener rol del token
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('Payload JWT:', payload); // <-- Agregado para depuración
        
        // Redirigir según rol
        if (payload.rol === 'admin') {
            window.location.href = 'dashboard.html';
        } else if (payload.rol === 'cajero') {
            window.location.href = 'pos.html';
        }
    } else {
        alert('Error de autenticación: Credenciales incorrectas');
    }
}

// Función para cerrar sesión
function cerrarSesion() {
    sessionStorage.removeItem('usuarioActual');
    window.location.href = 'index.html';
}

// Función para proteger rutas
async function verificarSesion() {
    const token = sessionStorage.getItem('jwtToken');
    
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        // Verificar token con el backend
        const response = await fetch(`${API_URL}/api/protected`, {
            headers: {'Authorization': `Bearer ${token}`}
        });
        
        if (!response.ok) throw new Error('Token inválido');
        
        const userData = await response.json();
        
        // Verificar acceso según rol
        const esPaginaAdmin = window.location.pathname.includes('dashboard.html');
        if (esPaginaAdmin && userData.rol !== 'admin') {
            window.location.href = 'pos.html';
        }
        
        // Mostrar información de usuario
        const userDisplay = document.querySelector('.navbar-text');
        if (userDisplay) {
            userDisplay.innerHTML = `<i class="fas fa-user"></i> ${userData.username}`;
        }
    } catch (error) {
        console.error('Error de verificación:', error);
        sessionStorage.removeItem('jwtToken');
        window.location.href = 'index.html';
    }
}