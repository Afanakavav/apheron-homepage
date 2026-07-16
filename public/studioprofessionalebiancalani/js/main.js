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
    initInstitutionalLinks();
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
        
        // Nome su due righe: cognome (prima), nome (seconda) - centrati
        const nameBlock = `<div class="professionista-name-block">
            <span class="professionista-surname">${prof.surname}</span>
            <span class="professionista-givenname">${prof.givenName}</span>
        </div>`;
        // Ruolo su due righe - allineato a sinistra
        const roleBlock = (prof.roleLine1 || prof.roleLine2) ? `<div class="professionista-role-block">
            ${prof.roleLine1 ? `<span class="professionista-role-line1">${prof.roleLine1}</span>` : ''}
            ${prof.roleLine2 ? `<span class="professionista-role-line2">${prof.roleLine2}</span>` : ''}
        </div>` : '';
        // Descrizione (giustificata via CSS) - solo se presente
        const bioBlock = prof.bio ? `<p class="professionista-bio">${prof.bio.replace(/\n/g, '<br>')}</p>` : '';
        // Contatti: terzultima = email studio, penultima = "PEC:", ultima = indirizzo PEC
        let contactsHTML = '';
        if (prof.email) {
            contactsHTML += `<p class="professionista-contact"><i class="fas fa-envelope"></i> <a href="mailto:${prof.email}">${prof.email}</a></p>`;
        }
        if (prof.pec) {
            contactsHTML += `<p class="professionista-contact"><i class="fas fa-envelope-open-text"></i> PEC:</p>`;
            contactsHTML += `<p class="professionista-contact"><a href="mailto:${prof.pec}">${prof.pec}</a></p>`;
        }
        const contactsBlock = contactsHTML ? `<div class="professionista-contacts">${contactsHTML}</div>` : '';
        
        card.innerHTML = `
            <img src="${prof.image}" alt="${prof.name}" class="professionista-image" onerror="this.src='images/placeholder-person.jpg'">
            <div class="professionista-info">
                ${nameBlock}
                ${roleBlock}
                ${bioBlock}
                ${contactsBlock}
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
        const titleHTML = servizio.titleLine1 && servizio.titleLine2
            ? `${servizio.titleLine1}<br>${servizio.titleLine2}`
            : servizio.title;
        card.innerHTML = `
            <div class="servizio-icon">
                <i class="${servizio.icon}"></i>
            </div>
            <div class="servizio-content">
                <h3 class="servizio-title">${titleHTML}</h3>
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
