// ============================================
// MAIN JAVASCRIPT
// ============================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initScrollEffects();
    initProfessionisti();
    initServizi();
    initACBGallery();
    initContactForm();
    initInstitutionalLinks();
    initProfessionistiContatti();
    initBackToTop();
});

// ============================================
// NAVIGATION
// ============================================

function initNavigation() {
    const navbar = document.getElementById('navbar');
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const navMenu = document.getElementById('navMenu');
    const navLinks = document.querySelectorAll('.nav-link');
    
    // Mobile menu toggle
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            mobileMenuToggle.classList.toggle('active');
        });
    }
    
    // Close mobile menu when clicking a link
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            navMenu.classList.remove('active');
            mobileMenuToggle.classList.remove('active');
        });
    });
    
    // Navbar scroll effect
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        
        // Update active nav link
        updateActiveNavLink();
    });
    
    // Smooth scroll for anchor links
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    const navHeight = navbar.offsetHeight;
                    const targetPosition = targetElement.offsetTop - navHeight;
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
}

function updateActiveNavLink() {
    const sections = document.querySelectorAll('.section, .hero');
    const navLinks = document.querySelectorAll('.nav-link');
    const scrollPosition = window.scrollY + 100;
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        const sectionId = section.getAttribute('id');
        
        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${sectionId}`) {
                    link.classList.add('active');
                }
            });
        }
    });
}

// ============================================
// SCROLL EFFECTS
// ============================================

function initScrollEffects() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements for fade-in animation
    const animateElements = document.querySelectorAll('.feature-card, .professionista-card, .servizio-card, .info-card, .location-card');
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// ============================================
// PROFESSIONISTI
// ============================================

function initProfessionisti() {
    const grid = document.getElementById('professionistiGrid');
    if (!grid) return;
    
    professionisti.forEach(prof => {
        const card = document.createElement('div');
        card.className = 'professionista-card';
        card.innerHTML = `
            <img src="${prof.image}" alt="${prof.name}" class="professionista-image" onerror="this.src='images/placeholder-person.jpg'">
            <div class="professionista-info">
                <h3 class="professionista-name">${prof.name}</h3>
                <p class="professionista-role">${prof.role}</p>
                <p class="professionista-bio">${prof.bio}</p>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ============================================
// SERVIZI
// ============================================

function initServizi() {
    const grid = document.getElementById('serviziGrid');
    if (!grid) return;
    
    servizi.forEach(servizio => {
        const card = document.createElement('div');
        card.className = 'servizio-card';
        card.innerHTML = `
            <div class="servizio-icon">
                <i class="${servizio.icon}"></i>
            </div>
            <div class="servizio-content">
                <h3 class="servizio-title">${servizio.title}</h3>
                <p class="servizio-description">${servizio.description}</p>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ============================================
// ACB GALLERY
// ============================================

function initACBGallery() {
    const gallery = document.getElementById('acbGallery');
    if (!gallery) return;
    
    acbGallery.forEach(item => {
        const galleryItem = document.createElement('div');
        galleryItem.className = 'gallery-item';
        galleryItem.innerHTML = `
            <img src="${item.image}" alt="${item.caption}" onerror="this.parentElement.style.display='none'">
            <div class="gallery-caption">${item.caption}</div>
        `;
        gallery.appendChild(galleryItem);
    });
    
    // Download brochure handler
    const downloadBtn = document.getElementById('downloadBrochure');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            alert('La brochure sarà disponibile a breve. Contattaci per riceverla via email.');
            // In a real implementation, this would download a PDF
            // window.open('pdf/acb-brochure.pdf', '_blank');
        });
    }
}

// ============================================
// CONTACT FORM
// ============================================

function initContactForm() {
    const form = document.getElementById('appointmentForm');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const clientTypeInput = document.getElementById('clientType');
    const partitaIvaGroup = document.getElementById('partitaIvaGroup');
    
    if (!form) return;
    
    // Tab switching
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            tabButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const tabType = this.getAttribute('data-tab');
            clientTypeInput.value = tabType === 'new-client' ? 'new' : 'existing';
            
            // Show/hide Partita IVA field for existing clients
            if (tabType === 'existing-client') {
                partitaIvaGroup.style.display = 'block';
                partitaIvaGroup.querySelector('input').setAttribute('required', 'required');
            } else {
                partitaIvaGroup.style.display = 'none';
                partitaIvaGroup.querySelector('input').removeAttribute('required');
            }
        });
    });
    
    // Form submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = {
            nome: document.getElementById('nome').value,
            email: document.getElementById('email').value,
            telefono: document.getElementById('telefono').value,
            partitaIva: document.getElementById('partitaIva').value || null,
            tipologia: document.getElementById('tipologia').value,
            messaggio: document.getElementById('messaggio').value,
            preferenzaContatto: document.querySelector('input[name="preferenzaContatto"]:checked').value,
            clientType: clientTypeInput.value
        };
        
        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Invio in corso...';
        
        // Send email via EmailJS
        sendFormData(formData)
            .then(() => {
                showFormSuccess();
                form.reset();
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            })
            .catch((error) => {
                console.error('Error:', error);
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            });
    });
}

function showFormSuccess() {
    const successMsg = document.getElementById('formSuccess');
    const errorMsg = document.getElementById('formError');
    
    errorMsg.style.display = 'none';
    successMsg.style.display = 'flex';
    
    // Scroll to success message
    successMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Hide after 5 seconds
    setTimeout(() => {
        successMsg.style.display = 'none';
    }, 5000);
}

function showFormError() {
    const successMsg = document.getElementById('formSuccess');
    const errorMsg = document.getElementById('formError');
    
    successMsg.style.display = 'none';
    errorMsg.style.display = 'flex';
    
    // Scroll to error message
    errorMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Send form data via Firebase Cloud Functions
async function sendFormData(formData) {
    try {
        // URL della Cloud Function deployata (regione Europa)
        const functionUrl = 'https://europe-west1-apheron-homepage.cloudfunctions.net/sendAppointmentRequest';
        
        // Prepara i dati da inviare
        const requestData = {
            nome: formData.nome,
            email: formData.email,
            telefono: formData.telefono,
            partitaIva: formData.partitaIva || null,
            tipologia: formData.tipologia,
            messaggio: formData.messaggio,
            preferenzaContatto: formData.preferenzaContatto,
            clientType: formData.clientType,
        };

        // Chiama la Cloud Function via HTTP POST
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
        });

        const result = await response.json();
        
        if (response.ok && result.success) {
            return { success: true };
        } else {
            throw new Error(result.error || 'Email non inviata');
        }
    } catch (error) {
        console.error('Error submitting form:', error);
        showFormError();
        throw error;
    }
}

// ============================================
// INSTITUTIONAL LINKS
// ============================================

function initInstitutionalLinks() {
    const linksContainer = document.getElementById('institutionalLinks');
    if (!linksContainer) return;
    
    institutionalLinks.forEach(link => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.name}</a>`;
        linksContainer.appendChild(li);
    });
}

// ============================================
// PROFESSIONISTI CONTATTI
// ============================================

function initProfessionistiContatti() {
    const grid = document.getElementById('profContattiGrid');
    if (!grid) return;
    
    professionisti.forEach(prof => {
        const card = document.createElement('div');
        card.className = 'prof-contatto-card';
        
        let linksHTML = '';
        if (prof.email) {
            linksHTML += `<a href="mailto:${prof.email}"><i class="fas fa-envelope"></i> ${prof.email}</a>`;
        }
        if (prof.pec) {
            linksHTML += `<a href="mailto:${prof.pec}"><i class="fas fa-envelope-open-text"></i> PEC: ${prof.pec}</a>`;
        }
        
        card.innerHTML = `
            <div class="prof-contatto-name">${prof.name}</div>
            <div class="prof-contatto-role">${prof.role}</div>
            <div class="prof-contatto-links">
                ${linksHTML}
            </div>
        `;
        
        grid.appendChild(card);
    });
}

// ============================================
// BACK TO TOP BUTTON
// ============================================

function initBackToTop() {
    const backToTopBtn = document.getElementById('backToTop');
    if (!backToTopBtn) return;
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });
    
    backToTopBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Email validation
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Phone validation
function isValidPhone(phone) {
    const phoneRegex = /^[\d\s\+\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

// Format phone number
function formatPhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('39')) {
        return `+${cleaned.substring(0, 2)} ${cleaned.substring(2, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7)}`;
    }
    return phone;
}

