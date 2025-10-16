// APHERON - Advanced Interactive Effects
document.addEventListener('DOMContentLoaded', function() {
    
    // Initialize all features
    initializeLoadingScreen();
    initializeFAQ();
    initializeAnalytics();
    initializeA_BTesting();
    initializeGeolocation();
    initializeServiceWorker();
    
    // Parallax effect per il logo
    const logo = document.querySelector('.logo');
    const container = document.querySelector('.container');
    
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const rate = scrolled * -0.5;
        
        if (logo) {
            logo.style.transform = `translateY(${rate}px)`;
        }
    });
    
    // Sound effects per i click sui progetti
    const projectCards = document.querySelectorAll('.project-card');
    
    projectCards.forEach(card => {
        card.addEventListener('click', function(e) {
            // Crea un suono sottile (opzionale)
            createClickSound();
            
            // Effetto ripple
            createRippleEffect(e, this);
        });
    });
    
    // Sound effects per i CTA
    const ctaButtons = document.querySelectorAll('.cta-button');
    
    ctaButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            createClickSound();
            createRippleEffect(e, this);
        });
    });
    
    // Badge hover effects
    const badges = document.querySelectorAll('.badge');
    
    badges.forEach(badge => {
        badge.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px) scale(1.05)';
        });
        
        badge.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Typing effect per il tagline (opzionale)
    const tagline = document.querySelector('.tagline h1');
    if (tagline) {
        typeWriter(tagline, tagline.textContent, 100);
    }
    
    // Smooth scroll per i link interni
    const internalLinks = document.querySelectorAll('a[href^="#"]');
    internalLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Intersection Observer per animazioni on-scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // Osserva tutti gli elementi animabili
    const animatedElements = document.querySelectorAll('.bio-section, .quote-section, .projects-section, .cta-section');
    animatedElements.forEach(el => observer.observe(el));
    
    // Effetto magnetico per il logo
    if (logo) {
        logo.addEventListener('mousemove', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            this.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px)`;
        });
        
        logo.addEventListener('mouseleave', function() {
            this.style.transform = 'translate(0, 0)';
        });
    }
});

// Funzioni helper
function createClickSound() {
    // Crea un suono sottile usando Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
}

function createRippleEffect(event, element) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple');
    
    element.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

function typeWriter(element, text, speed) {
    element.textContent = '';
    let i = 0;
    
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    
    type();
}

// Aggiungi stili per il ripple effect
const style = document.createElement('style');
style.textContent = `
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(212, 175, 55, 0.3);
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    .animate-in {
        animation: fadeInUp 0.8s ease-out forwards;
    }
`;
document.head.appendChild(style);

// Advanced Features Implementation

// Loading Screen
function initializeLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }, 2000);
    }
}



// FAQ Accordion
function initializeFAQ() {
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const isExpanded = question.getAttribute('aria-expanded') === 'true';
            const answer = question.nextElementSibling;
            
            // Close all other FAQs
            faqQuestions.forEach(q => {
                q.setAttribute('aria-expanded', 'false');
                q.nextElementSibling.classList.remove('active');
            });
            
            // Toggle current FAQ
            if (!isExpanded) {
                question.setAttribute('aria-expanded', 'true');
                answer.classList.add('active');
                trackEvent('faq_opened', { question: question.textContent.trim() });
            }
        });
    });
}

// Analytics
function initializeAnalytics() {
    // Track page views
    trackEvent('page_view', {
        page: window.location.pathname,
        timestamp: new Date().toISOString()
    });
    
    // Track scroll depth
    let maxScroll = 0;
    window.addEventListener('scroll', () => {
        const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
        if (scrollPercent > maxScroll) {
            maxScroll = scrollPercent;
            if (maxScroll % 25 === 0) {
                trackEvent('scroll_depth', { depth: maxScroll });
            }
        }
    });
    
    // Track time on page
    const startTime = Date.now();
    window.addEventListener('beforeunload', () => {
        const timeOnPage = Math.round((Date.now() - startTime) / 1000);
        trackEvent('time_on_page', { seconds: timeOnPage });
    });
}

function trackEvent(eventName, data = {}) {
    // Google Analytics 4
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, data);
    }
    
    // Console log for development
    console.log('Event tracked:', eventName, data);
}

// A/B Testing
function initializeA_BTesting() {
    const ctaPrimary = document.getElementById('cta-primary');
    if (ctaPrimary) {
        const variant = Math.random() < 0.5 ? 'A' : 'B';
        
        if (variant === 'B') {
            ctaPrimary.textContent = 'Get Your Free AI Roadmap';
            ctaPrimary.href = '#roadmap';
        }
        
        trackEvent('ab_test_assigned', { variant: variant, test: 'cta_primary' });
    }
}

// Geolocation
function initializeGeolocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const country = getCountryFromCoordinates(position.coords.latitude, position.coords.longitude);
                trackEvent('geolocation_detected', { country: country });
                
                // Show location-specific content
                if (country === 'IT') {
                    showItalianContent();
                }
            },
            (error) => {
                console.log('Geolocation error:', error);
            }
        );
    }
}

function getCountryFromCoordinates(lat, lng) {
    // Simplified country detection (in real app, use reverse geocoding API)
    if (lat >= 35 && lat <= 47 && lng >= 6 && lng <= 19) {
        return 'IT';
    }
    return 'US';
}

function showItalianContent() {
    // Could show Italian-specific content or offers
    console.log('Showing Italian content');
}


// Service Worker
function initializeServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered:', registration);
            })
            .catch(error => {
                console.log('SW registration failed:', error);
            });
    }
}
