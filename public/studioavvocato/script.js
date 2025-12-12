/**
 * Main JavaScript for Studio Legale Taiti website
 * Handles navigation, mobile menu, FAQ accordion, search, and UI interactions
 */

// ============================================
// Mobile Menu Toggle
// ============================================
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const navMenu = document.getElementById('navMenu');

if (mobileMenuToggle && navMenu) {
    mobileMenuToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        const isExpanded = navMenu.classList.contains('active');
        mobileMenuToggle.setAttribute('aria-expanded', isExpanded);
    });

    // Close menu when clicking on a nav link
    const navLinks = navMenu.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            mobileMenuToggle.setAttribute('aria-expanded', 'false');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!navMenu.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
            navMenu.classList.remove('active');
            mobileMenuToggle.setAttribute('aria-expanded', 'false');
        }
    });
}

// ============================================
// Smooth Scroll for Anchor Links
// ============================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#' || href === '#home') {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();
            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// ============================================
// Header Scroll Effect
// ============================================
const header = document.getElementById('header');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        header?.classList.add('scrolled');
    } else {
        header?.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
});

// ============================================
// FAQ Accordion
// ============================================
const faqQuestions = document.querySelectorAll('.faq-question');

faqQuestions.forEach(question => {
    question.addEventListener('click', () => {
        const faqItem = question.closest('.faq-item');
        const answer = faqItem.querySelector('.faq-answer');
        const isExpanded = question.getAttribute('aria-expanded') === 'true';

        // Close all other FAQ items
        faqQuestions.forEach(q => {
            if (q !== question) {
                q.setAttribute('aria-expanded', 'false');
                q.closest('.faq-item').querySelector('.faq-answer').classList.remove('active');
            }
        });

        // Toggle current FAQ item
        question.setAttribute('aria-expanded', !isExpanded);
        answer.classList.toggle('active', !isExpanded);
    });
});

// ============================================
// Cookie Consent Banner
// ============================================
const cookieConsent = document.getElementById('cookieConsent');
const acceptCookies = document.getElementById('acceptCookies');
const rejectCookies = document.getElementById('rejectCookies');

// Check if consent has been given
const cookieConsentGiven = localStorage.getItem('cookieConsent');

if (!cookieConsentGiven && cookieConsent) {
    cookieConsent.style.display = 'block';
}

if (acceptCookies) {
    acceptCookies.addEventListener('click', () => {
        localStorage.setItem('cookieConsent', 'accepted');
        cookieConsent.style.display = 'none';
        // Initialize analytics if needed
        initializeAnalytics();
    });
}

if (rejectCookies) {
    rejectCookies.addEventListener('click', () => {
        localStorage.setItem('cookieConsent', 'rejected');
        cookieConsent.style.display = 'none';
    });
}

// ============================================
// Modal Management
// ============================================
const modals = document.querySelectorAll('.modal');
const modalCloseButtons = document.querySelectorAll('.modal-close');

// Open modal from links
document.querySelectorAll('a[href^="#privacy-policy"], a[href^="#cookie-policy"], a[href^="#note-legali"]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);
        const modal = document.getElementById(targetId);
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    });
});

// Close modal
modalCloseButtons.forEach(button => {
    button.addEventListener('click', () => {
        const modal = button.closest('.modal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    });
});

// Close modal when clicking outside
modals.forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    });
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        modals.forEach(modal => {
            if (modal.style.display === 'block') {
                modal.style.display = 'none';
                document.body.style.overflow = '';
            }
        });
    }
});

// ============================================
// Internal Search Functionality
// ============================================
const searchBox = document.getElementById('searchBox');
const searchInput = document.getElementById('searchInput');
const searchClose = document.getElementById('searchClose');
const searchResults = document.getElementById('searchResults');

// Searchable content sections
const searchableSections = [
    { id: 'aree-attivita', title: 'Aree di Attività', selector: '.area-card' },
    { id: 'faq', title: 'FAQ', selector: '.faq-item' },
    { id: 'risorse', title: 'Risorse', selector: '.risorsa-card' }
];

// Open search box (can be triggered by a button or keyboard shortcut)
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K to open search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (searchBox) {
            searchBox.style.display = 'flex';
            searchInput?.focus();
        }
    }
});

// Close search box
if (searchClose) {
    searchClose.addEventListener('click', () => {
        if (searchBox) {
            searchBox.style.display = 'none';
            if (searchInput) searchInput.value = '';
            if (searchResults) searchResults.innerHTML = '';
        }
    });
}

// Close search on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && searchBox && searchBox.style.display === 'flex') {
        searchBox.style.display = 'none';
        if (searchInput) searchInput.value = '';
        if (searchResults) searchResults.innerHTML = '';
    }
});

// Perform search
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        
        if (query.length < 2) {
            if (searchResults) searchResults.innerHTML = '';
            return;
        }

        const results = [];
        
        searchableSections.forEach(section => {
            const sectionElement = document.getElementById(section.id);
            if (!sectionElement) return;

            const items = sectionElement.querySelectorAll(section.selector);
            items.forEach(item => {
                const text = item.textContent.toLowerCase();
                if (text.includes(query)) {
                    const title = item.querySelector('h3')?.textContent || 'Senza titolo';
                    const excerpt = item.textContent.substring(0, 150) + '...';
                    const sectionTitle = section.title;
                    
                    results.push({
                        title,
                        excerpt,
                        section: sectionTitle,
                        element: item,
                        sectionId: section.id
                    });
                }
            });
        });

        displaySearchResults(results);
    });
}

function displaySearchResults(results) {
    if (!searchResults) return;

    if (results.length === 0) {
        searchResults.innerHTML = '<p style="padding: 1rem; color: var(--color-text-light);">Nessun risultato trovato.</p>';
        return;
    }

    searchResults.innerHTML = results.map(result => `
        <div class="search-result-item" data-section="${result.sectionId}">
            <strong>${result.section}: ${result.title}</strong>
            <p style="font-size: 0.875rem; color: var(--color-text-light); margin-top: 0.5rem;">${result.excerpt}</p>
        </div>
    `).join('');

    // Add click handlers to results
    searchResults.querySelectorAll('.search-result-item').forEach((item, index) => {
        item.addEventListener('click', () => {
            const result = results[index];
            const sectionId = result.sectionId;
            const targetElement = result.element;

            // Close search box
            if (searchBox) searchBox.style.display = 'none';
            if (searchInput) searchInput.value = '';
            if (searchResults) searchResults.innerHTML = '';

            // Scroll to element
            const headerOffset = 80;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });

            // Highlight element briefly
            targetElement.style.transition = 'background-color 0.3s';
            targetElement.style.backgroundColor = 'rgba(212, 175, 55, 0.1)';
            setTimeout(() => {
                targetElement.style.backgroundColor = '';
            }, 2000);
        });
    });
}

// ============================================
// Google Analytics Integration
// ============================================
function initializeAnalytics() {
    const consent = localStorage.getItem('cookieConsent');
    if (consent !== 'accepted') return;

    // Analytics is loaded in the HTML head
    // Track custom events here
    trackPageView();
    trackScrollDepth();
    trackCTAClicks();
}

function trackPageView() {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'page_view', {
            page_title: document.title,
            page_location: window.location.href
        });
    }
}

function trackScrollDepth() {
    let scrollTracked = {
        25: false,
        50: false,
        75: false,
        100: false
    };

    window.addEventListener('scroll', () => {
        const scrollPercent = Math.round(
            (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
        );

        Object.keys(scrollTracked).forEach(threshold => {
            if (scrollPercent >= parseInt(threshold) && !scrollTracked[threshold]) {
                scrollTracked[threshold] = true;
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'scroll_depth', {
                        scroll_percent: threshold
                    });
                }
            }
        });
    });
}

function trackCTAClicks() {
    // Track CTA button clicks
    document.querySelectorAll('a[href^="tel:"], a[href^="mailto:"], .btn-primary, .btn-secondary').forEach(button => {
        button.addEventListener('click', (e) => {
            const href = button.getAttribute('href') || '';
            const text = button.textContent.trim();
            
            if (typeof gtag !== 'undefined') {
                gtag('event', 'cta_click', {
                    cta_type: href.startsWith('tel:') ? 'phone' : 
                              href.startsWith('mailto:') ? 'email' : 
                              'button',
                    cta_text: text,
                    cta_location: href
                });
            }
        });
    });
}

// ============================================
// Form Validation Helpers
// ============================================
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    const re = /^[\d\s\+\-\(\)]+$/;
    return re.test(phone) && phone.replace(/\D/g, '').length >= 8;
}

// ============================================
// Lazy Loading Images
// ============================================
if ('loading' in HTMLImageElement.prototype) {
    // Native lazy loading supported
    const images = document.querySelectorAll('img[loading="lazy"]');
    images.forEach(img => {
        img.src = img.dataset.src || img.src;
    });
} else {
    // Fallback for browsers that don't support lazy loading
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lazysizes/5.3.2/lazysizes.min.js';
    document.body.appendChild(script);
}

// ============================================
// Initialize on DOM Load
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize analytics if consent was already given
    const consent = localStorage.getItem('cookieConsent');
    if (consent === 'accepted') {
        initializeAnalytics();
    }

    // Add loading class removal
    document.body.classList.add('loaded');
});

// ============================================
// Accessibility Improvements
// ============================================
// Skip to main content link (can be added to HTML)
const skipLink = document.createElement('a');
skipLink.href = '#home';
skipLink.className = 'skip-link';
skipLink.textContent = 'Salta al contenuto principale';
skipLink.style.cssText = 'position: absolute; left: -9999px; z-index: 999; padding: 1rem; background: var(--color-primary); color: white; text-decoration: none;';
skipLink.addEventListener('focus', () => {
    skipLink.style.left = '1rem';
    skipLink.style.top = '1rem';
});
skipLink.addEventListener('blur', () => {
    skipLink.style.left = '-9999px';
});
document.body.insertBefore(skipLink, document.body.firstChild);

// Keyboard navigation for custom elements
document.querySelectorAll('.faq-question, .btn').forEach(element => {
    element.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            element.click();
        }
    });
});

