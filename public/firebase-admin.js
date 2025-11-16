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
    orderBy,
    setDoc
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
        loadReviews();
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
    
    // Google Analytics tracking
    if (typeof gtag !== 'undefined') {
        gtag('event', 'admin_login_success', {
            page: 'admin_panel'
        });
    }
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

// Delete Project
async function deleteProject(projectId, projectTitle) {
    // Create custom confirmation toast
    const confirmed = confirm(`Are you sure you want to delete "${projectTitle}"?\n\nThis action cannot be undone.`);
    
    if (!confirmed) {
        return;
    }
    
    showLoading();
    try {
        await deleteDoc(doc(db, 'projects', projectId));
        console.log('Project deleted:', projectId);
        showToast('Deleted!', `"${projectTitle}" has been deleted successfully.`, 'success');
        
        // Google Analytics tracking
        if (typeof gtag !== 'undefined') {
            gtag('event', 'project_deleted', {
                project_title: projectTitle
            });
        }
        
        loadProjects(); // Reload projects
    } catch (error) {
        console.error('Error deleting project:', error);
        showToast('Error', 'Failed to delete project. Please try again.', 'error');
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

// ===========================
// PROJECT MODAL MANAGEMENT
// ===========================

let currentEditingProjectId = null;

// Modal Elements
const projectModal = document.getElementById('project-modal');
const modalTitle = document.getElementById('modal-title');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const projectForm = document.getElementById('project-form');
const modalSubmitBtn = document.getElementById('modal-submit-btn');

// Form Inputs
const titleInput = document.getElementById('project-title');
const descriptionInput = document.getElementById('project-description');
const urlInput = document.getElementById('project-url');
const iconInput = document.getElementById('project-icon');
const iconClassInput = document.getElementById('project-icon-class');
const statusInput = document.getElementById('project-status');
const orderInput = document.getElementById('project-order');

// Open Modal for Add Project
document.querySelector('.btn-add')?.addEventListener('click', () => {
    openModal('add');
});

// Open Modal for Edit Project
function editProject(projectId, project) {
    openModal('edit', projectId, project);
}

// Open Modal Function
function openModal(mode, projectId = null, project = null) {
    currentEditingProjectId = projectId;
    
    if (mode === 'add') {
        modalTitle.textContent = 'Add New Project';
        modalSubmitBtn.querySelector('.btn-text').textContent = 'Add Project';
        modalSubmitBtn.querySelector('.btn-icon').textContent = '✨';
        projectForm.reset();
    } else if (mode === 'edit' && project) {
        modalTitle.textContent = 'Edit Project';
        modalSubmitBtn.querySelector('.btn-text').textContent = 'Save Changes';
        modalSubmitBtn.querySelector('.btn-icon').textContent = '💾';
        
        // Populate form with existing data
        titleInput.value = project.title || '';
        descriptionInput.value = project.description || '';
        urlInput.value = project.url || '';
        iconInput.value = project.icon || '';
        iconClassInput.value = project.iconClass || '';
        statusInput.value = project.status || 'active';
        orderInput.value = project.order || 1;
    }
    
    projectModal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

// Close Modal Function
function closeModal() {
    projectModal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling
    projectForm.reset();
    currentEditingProjectId = null;
}

// Close Modal Event Listeners
modalCloseBtn.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);

// Close modal when clicking overlay
projectModal.querySelector('.project-modal-overlay').addEventListener('click', closeModal);

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && projectModal.style.display === 'flex') {
        closeModal();
    }
});

// Form Submit Handler
projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form values
    const projectData = {
        title: titleInput.value.trim(),
        description: descriptionInput.value.trim(),
        url: urlInput.value.trim(),
        icon: iconInput.value.trim(),
        iconClass: iconClassInput.value.trim() || '',
        status: statusInput.value,
        order: parseInt(orderInput.value) || 1
    };
    
    // Validate URL
    try {
        new URL(projectData.url);
    } catch (error) {
        showToast('Invalid URL', 'Please enter a valid URL starting with http:// or https://', 'error');
        urlInput.classList.add('error');
        setTimeout(() => urlInput.classList.remove('error'), 500);
        return;
    }
    
    showLoading();
    
    try {
        if (currentEditingProjectId) {
            // Update existing project
            await updateDoc(doc(db, 'projects', currentEditingProjectId), projectData);
            showToast('Success!', `"${projectData.title}" has been updated successfully.`, 'success');
            
            // Google Analytics tracking
            if (typeof gtag !== 'undefined') {
                gtag('event', 'project_updated', {
                    project_title: projectData.title,
                    project_status: projectData.status
                });
            }
        } else {
            // Add new project
            await addDoc(collection(db, 'projects'), projectData);
            showToast('Success!', `"${projectData.title}" has been added successfully.`, 'success');
            
            // Google Analytics tracking
            if (typeof gtag !== 'undefined') {
                gtag('event', 'project_added', {
                    project_title: projectData.title,
                    project_status: projectData.status
                });
            }
        }
        
        closeModal();
        loadProjects(); // Reload projects
        
    } catch (error) {
        console.error('Error saving project:', error);
        showToast('Error', 'Failed to save project. Please try again.', 'error');
        hideLoading();
    }
});

// ===========================
// TOAST NOTIFICATIONS
// ===========================

function showToast(title, message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
    
    // Remove on click
    toast.addEventListener('click', () => {
        toast.classList.add('toast-exit');
        setTimeout(() => {
            toast.remove();
        }, 300);
    });
}

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

// ===========================
// REVIEWS MANAGEMENT
// ===========================

const REVIEWS_DOC_ID = 'reviews-data'; // Fixed document ID for reviews

// Load Reviews from Firestore
async function loadReviews() {
    try {
        const reviewsDoc = doc(db, 'reviews', REVIEWS_DOC_ID);
        const reviewsSnapshot = await getDocs(collection(db, 'reviews'));
        
        let reviewsData = null;
        reviewsSnapshot.forEach((doc) => {
            if (doc.id === REVIEWS_DOC_ID) {
                reviewsData = doc.data();
            }
        });
        
        // If no reviews data exists, create default
        if (!reviewsData) {
            reviewsData = {
                ratingValue: "5",
                reviewCount: "0"
            };
            await setDoc(doc(db, 'reviews', REVIEWS_DOC_ID), reviewsData);
        }
        
        // Display reviews in admin panel
        const displayRating = document.getElementById('display-rating');
        const displayCount = document.getElementById('display-count');
        
        if (displayRating) displayRating.textContent = reviewsData.ratingValue || '--';
        if (displayCount) displayCount.textContent = reviewsData.reviewCount || '--';
        
    } catch (error) {
        console.error('Error loading reviews:', error);
        // Set defaults on error
        const displayRating = document.getElementById('display-rating');
        const displayCount = document.getElementById('display-count');
        if (displayRating) displayRating.textContent = '--';
        if (displayCount) displayCount.textContent = '--';
    }
}

// Reviews Modal Elements
const editReviewsBtn = document.getElementById('edit-reviews-btn');
const reviewsModal = document.getElementById('reviews-modal');
const reviewsModalCloseBtn = document.getElementById('reviews-modal-close-btn');
const reviewsModalCancelBtn = document.getElementById('reviews-modal-cancel-btn');
const reviewsForm = document.getElementById('reviews-form');
const reviewRatingInput = document.getElementById('review-rating');
const reviewCountInput = document.getElementById('review-count');

// Open Reviews Modal
if (editReviewsBtn) {
    editReviewsBtn.addEventListener('click', async () => {
        try {
            // Load current reviews data
            const reviewsSnapshot = await getDocs(collection(db, 'reviews'));
            let reviewsData = null;
            reviewsSnapshot.forEach((doc) => {
                if (doc.id === REVIEWS_DOC_ID) {
                    reviewsData = doc.data();
                }
            });
            
            // Set form values
            if (reviewsData) {
                reviewRatingInput.value = reviewsData.ratingValue || '5';
                reviewCountInput.value = reviewsData.reviewCount || '0';
            } else {
                reviewRatingInput.value = '5';
                reviewCountInput.value = '0';
            }
            
            reviewsModal.style.display = 'flex';
        } catch (error) {
            console.error('Error opening reviews modal:', error);
            showToast('Error', 'Failed to load reviews data.', 'error');
        }
    });
}

// Close Reviews Modal
function closeReviewsModal() {
    reviewsModal.style.display = 'none';
    reviewsForm.reset();
}

if (reviewsModalCloseBtn) {
    reviewsModalCloseBtn.addEventListener('click', closeReviewsModal);
}

if (reviewsModalCancelBtn) {
    reviewsModalCancelBtn.addEventListener('click', closeReviewsModal);
}

// Close modal on overlay click
if (reviewsModal) {
    const overlay = reviewsModal.querySelector('.project-modal-overlay');
    if (overlay) {
        overlay.addEventListener('click', closeReviewsModal);
    }
}

// Save Reviews
if (reviewsForm) {
    reviewsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const ratingValue = parseFloat(reviewRatingInput.value);
        const reviewCount = parseInt(reviewCountInput.value);
        
        // Validation
        if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
            showToast('Error', 'Rating must be between 1.0 and 5.0', 'error');
            return;
        }
        
        if (isNaN(reviewCount) || reviewCount < 0) {
            showToast('Error', 'Review count must be 0 or greater', 'error');
            return;
        }
        
        showLoading();
        
        try {
            const reviewsData = {
                ratingValue: ratingValue.toString(),
                reviewCount: reviewCount.toString(),
                updatedAt: new Date().toISOString()
            };
            
            // Use setDoc with merge to create or update
            await setDoc(doc(db, 'reviews', REVIEWS_DOC_ID), reviewsData, { merge: true });
            
            showToast('Success', 'Reviews updated successfully!', 'success');
            
            // Google Analytics tracking
            if (typeof gtag !== 'undefined') {
                gtag('event', 'reviews_updated', {
                    rating_value: ratingValue,
                    review_count: reviewCount
                });
            }
            
            closeReviewsModal();
            loadReviews(); // Reload reviews display
            
        } catch (error) {
            console.error('Error saving reviews:', error);
            showToast('Error', 'Failed to save reviews. Please try again.', 'error');
        } finally {
            hideLoading();
        }
    });
}

console.log('Firebase Admin initialized');

