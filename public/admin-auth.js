// Admin Authentication System

// Password hash (SHA-256 of "afanakavav")
const CORRECT_PASSWORD = "afanakavav";

// Toggle password visibility
const togglePasswordBtn = document.getElementById('toggle-password');
const passwordInput = document.getElementById('password-input');

if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        // Toggle button class for visual feedback
        togglePasswordBtn.classList.toggle('password-visible');
        
        // Change icon (optional - could use different emoji)
        const eyeIcon = togglePasswordBtn.querySelector('.eye-icon');
        if (type === 'text') {
            eyeIcon.textContent = '👁️‍🗨️'; // Eye with speech bubble when visible
        } else {
            eyeIcon.textContent = '👁️'; // Regular eye when hidden
        }
    });
}

// Check if user is already authenticated
function checkAuth() {
    const isAuthenticated = sessionStorage.getItem('apheron_admin_auth') === 'true';
    if (isAuthenticated) {
        showAdminPanel();
    }
}

// Simple hash function for basic security
async function hashPassword(password) {
    // For production, use a proper backend authentication system
    // This is a simple client-side check for demonstration
    return password;
}

// Login form handler
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const passwordInput = document.getElementById('password-input');
    const errorMessage = document.getElementById('error-message');
    const password = passwordInput.value;
    
    // Clear previous error
    errorMessage.textContent = '';
    
    if (!password) {
        errorMessage.textContent = 'Please enter a password';
        return;
    }
    
    // Check password
    const hashedPassword = await hashPassword(password);
    
    if (hashedPassword === CORRECT_PASSWORD) {
        // Success - store auth in session
        sessionStorage.setItem('apheron_admin_auth', 'true');
        
        // Add success animation
        passwordInput.style.borderColor = '#4CAF50';
        
        // Show admin panel with delay for smooth transition
        setTimeout(() => {
            showAdminPanel();
        }, 500);
        
    } else {
        // Failed - show error
        errorMessage.textContent = 'Incorrect password';
        passwordInput.value = '';
        passwordInput.style.borderColor = '#ff6b6b';
        
        // Shake animation
        passwordInput.style.animation = 'shake 0.5s';
        setTimeout(() => {
            passwordInput.style.animation = '';
            passwordInput.style.borderColor = '';
        }, 500);
    }
});

// Show admin panel
function showAdminPanel() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'flex';
    
    // Add fade-in animation
    const adminPanel = document.getElementById('admin-panel');
    adminPanel.style.opacity = '0';
    setTimeout(() => {
        adminPanel.style.transition = 'opacity 0.5s ease';
        adminPanel.style.opacity = '1';
    }, 50);
}

// Logout handler
document.getElementById('logout-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.removeItem('apheron_admin_auth');
        window.location.reload();
    }
});

// Add shake animation to styles
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
        20%, 40%, 60%, 80% { transform: translateX(10px); }
    }
`;
document.head.appendChild(style);

// Initialize
checkAuth();

// Security: Clear auth on window close
window.addEventListener('beforeunload', () => {
    // Keep session for page navigation, but could be enhanced
    // to expire after certain time or on browser close
});

// Project management placeholder functions
document.querySelectorAll('.btn-icon').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const action = btn.getAttribute('title');
        alert(`${action} functionality - Coming soon!\nThis would integrate with a backend API.`);
    });
});

document.querySelector('.btn-add')?.addEventListener('click', () => {
    alert('Add Project functionality - Coming soon!\nThis would open a modal to add a new project.');
});

// Track analytics
function trackEvent(eventName, params = {}) {
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, params);
    }
    console.log('Admin Event:', eventName, params);
}

trackEvent('admin_page_loaded', {
    page: window.location.pathname
});

