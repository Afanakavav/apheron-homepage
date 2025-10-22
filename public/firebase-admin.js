// Firebase Admin Panel Logic
import { 
    auth, 
    db,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy
} from './firebase-config.js';

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const adminPanel = document.getElementById('admin-panel');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const errorMessage = document.getElementById('error-message');
const logoutBtn = document.getElementById('logout-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const togglePasswordBtn = document.getElementById('toggle-password');

// Show/Hide Loading
function showLoading() {
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
}

// Toggle Password Visibility
if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePasswordBtn.classList.toggle('password-visible');
        
        const eyeIcon = togglePasswordBtn.querySelector('.eye-icon');
        if (type === 'text') {
            eyeIcon.textContent = '👁️‍🗨️';
        } else {
            eyeIcon.textContent = '👁️';
        }
    });
}

// Check Authentication State
onAuthStateChanged(auth, (user) => {
    hideLoading();
    if (user) {
        // User is signed in
        console.log('User signed in:', user.email);
        showAdminPanel();
        loadProjects();
    } else {
        // User is signed out
        console.log('User signed out');
        showLoginScreen();
    }
});

// Login Form Handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    // Clear previous error
    errorMessage.textContent = '';
    
    if (!email || !password) {
        errorMessage.textContent = 'Please enter both email and password';
        return;
    }
    
    showLoading();
    
    try {
        // Sign in with Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('Login successful:', userCredential.user.email);
        
        // Success animation
        emailInput.style.borderColor = '#4CAF50';
        passwordInput.style.borderColor = '#4CAF50';
        
        // Clear form
        emailInput.value = '';
        passwordInput.value = '';
        
        // The onAuthStateChanged listener will handle showing the admin panel
        
    } catch (error) {
        hideLoading();
        console.error('Login error:', error);
        
        // Show user-friendly error messages
        let errorMsg = 'Login failed. Please try again.';
        
        switch (error.code) {
            case 'auth/invalid-email':
                errorMsg = 'Invalid email address';
                break;
            case 'auth/user-disabled':
                errorMsg = 'This account has been disabled';
                break;
            case 'auth/user-not-found':
                errorMsg = 'No account found with this email';
                break;
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                errorMsg = 'Incorrect email or password';
                break;
            case 'auth/too-many-requests':
                errorMsg = 'Too many failed attempts. Please try again later';
                break;
        }
        
        errorMessage.textContent = errorMsg;
        passwordInput.value = '';
        passwordInput.style.borderColor = '#ff6b6b';
        emailInput.style.borderColor = '#ff6b6b';
        
        // Shake animation
        loginForm.style.animation = 'shake 0.5s';
        setTimeout(() => {
            loginForm.style.animation = '';
            passwordInput.style.borderColor = '';
            emailInput.style.borderColor = '';
        }, 500);
    }
});

// Logout Handler
logoutBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to logout?')) {
        showLoading();
        try {
            await signOut(auth);
            console.log('Logout successful');
        } catch (error) {
            console.error('Logout error:', error);
            alert('Error logging out. Please try again.');
            hideLoading();
        }
    }
});

// Show Login Screen
function showLoginScreen() {
    loginScreen.style.display = 'flex';
    adminPanel.style.display = 'none';
}

// Show Admin Panel
function showAdminPanel() {
    loginScreen.style.display = 'none';
    adminPanel.style.display = 'flex';
    
    // Add fade-in animation
    adminPanel.style.opacity = '0';
    setTimeout(() => {
        adminPanel.style.transition = 'opacity 0.5s ease';
        adminPanel.style.opacity = '1';
    }, 50);
}

// Load Projects from Firestore
async function loadProjects() {
    showLoading();
    try {
        const projectsCollection = collection(db, 'projects');
        const q = query(projectsCollection, orderBy('order', 'asc'));
        const querySnapshot = await getDocs(q);
        
        const projectsGrid = document.querySelector('.projects-grid');
        projectsGrid.innerHTML = ''; // Clear existing projects
        
        if (querySnapshot.empty) {
            projectsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 2rem;">No projects yet. Click "Add Project" to create one.</p>';
            hideLoading();
            return;
        }
        
        querySnapshot.forEach((docSnap) => {
            const project = docSnap.data();
            const projectId = docSnap.id;
            
            const projectCard = createProjectCard(project, projectId);
            projectsGrid.appendChild(projectCard);
        });
        
        // Update stats
        updateStats(querySnapshot.size);
        
        hideLoading();
    } catch (error) {
        console.error('Error loading projects:', error);
        alert('Error loading projects. Please refresh the page.');
        hideLoading();
    }
}

// Create Project Card Element
function createProjectCard(project, projectId) {
    const card = document.createElement('div');
    card.className = `admin-project-card ${project.status === 'coming-soon' ? 'coming-soon' : ''}`;
    
    const statusClass = project.status === 'active' ? 'active' : 'coming-soon';
    const statusText = project.status === 'active' ? 'Active' : 'Coming Soon';
    
    card.innerHTML = `
        <div class="project-status ${statusClass}">${statusText}</div>
        <div class="project-icon ${project.iconClass || ''}">${project.icon}</div>
        <h3>${project.title}</h3>
        <p>${project.description}</p>
        <div class="project-meta">
            <span class="meta-item">🔗 <a href="${project.url}" target="_blank">${project.url}</a></span>
        </div>
        <div class="card-actions">
            <button class="btn-icon btn-edit" data-id="${projectId}" title="Edit">✏️</button>
            <button class="btn-icon btn-view" data-url="${project.url}" title="View">👁️</button>
            <button class="btn-icon danger btn-delete" data-id="${projectId}" title="Delete">🗑️</button>
        </div>
    `;
    
    // Add event listeners
    card.querySelector('.btn-edit').addEventListener('click', () => editProject(projectId, project));
    card.querySelector('.btn-view').addEventListener('click', () => window.open(project.url, '_blank'));
    card.querySelector('.btn-delete').addEventListener('click', () => deleteProject(projectId, project.title));
    
    return card;
}

// Edit Project (Placeholder - to be implemented)
function editProject(projectId, project) {
    alert(`Edit Project functionality coming soon!\n\nProject: ${project.title}\nID: ${projectId}\n\nThis will open a modal to edit project details.`);
}

// Delete Project
async function deleteProject(projectId, projectTitle) {
    if (!confirm(`Are you sure you want to delete "${projectTitle}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    showLoading();
    try {
        await deleteDoc(doc(db, 'projects', projectId));
        console.log('Project deleted:', projectId);
        alert(`"${projectTitle}" has been deleted successfully.`);
        loadProjects(); // Reload projects
    } catch (error) {
        console.error('Error deleting project:', error);
        alert('Error deleting project. Please try again.');
        hideLoading();
    }
}

// Update Stats
function updateStats(totalProjects) {
    const activeCount = document.querySelectorAll('.admin-project-card:not(.coming-soon)').length;
    const comingSoonCount = totalProjects - activeCount;
    
    const statValues = document.querySelectorAll('.stat-value');
    if (statValues[0]) statValues[0].textContent = activeCount;
    if (statValues[1]) statValues[1].textContent = comingSoonCount;
    if (statValues[2]) statValues[2].textContent = '--'; // Views coming soon
}

// Add Project Button Handler
document.querySelector('.btn-add')?.addEventListener('click', () => {
    alert('Add Project functionality coming soon!\n\nThis will open a modal to create a new project with:\n- Title\n- Description\n- URL\n- Icon\n- Status (Active/Coming Soon)');
});

// Add shake animation to styles if not exists
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
        20%, 40%, 60%, 80% { transform: translateX(10px); }
    }
`;
document.head.appendChild(style);

console.log('Firebase Admin initialized');

