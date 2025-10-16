// APHERON - Advanced Interactive Effects
document.addEventListener('DOMContentLoaded', function() {
    
    // Initialize all features
    initializeLoadingScreen();
    initializeFAQ();
    initializeAnalytics();
    initializeA_BTesting();
    initializeGeolocation();
    initializeServiceWorker();
    initializePWA();
    initializeDownloadButton();
    
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
        navigator.serviceWorker.register('https://afanakavav.github.io/apheron-homepage/sw.js?v=3')
            .then(registration => {
                console.log('SW registered:', registration);
            })
            .catch(error => {
                console.log('SW registration failed:', error);
            });
    }
}

// PWA Installation
function initializePWA() {
    let deferredPrompt;
    const installBanner = document.getElementById('install-banner');
    const installBtn = document.getElementById('install-btn');
    const dismissBtn = document.getElementById('dismiss-install');
    
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
        console.log('App is already installed');
        return;
    }
    
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        window.deferredPrompt = e; // Save globally for download button
        
        // Show install banner after 3 seconds
        setTimeout(() => {
            if (!localStorage.getItem('install-banner-dismissed')) {
                installBanner.classList.add('show');
            }
        }, 3000);
    });
    
    // Install button click
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                
                if (outcome === 'accepted') {
                    trackEvent('pwa_install_accepted');
                    installBanner.classList.remove('show');
                } else {
                    trackEvent('pwa_install_declined');
                }
                
                deferredPrompt = null;
            }
        });
    }
    
    // Dismiss button click
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            installBanner.classList.remove('show');
            localStorage.setItem('install-banner-dismissed', 'true');
            trackEvent('pwa_install_dismissed');
        });
    }
    
    // Track app installed
    window.addEventListener('appinstalled', () => {
        trackEvent('pwa_installed');
        installBanner.classList.remove('show');
    });
    
    // Add to home screen instructions for iOS
    if (isIOS() && !isInStandaloneMode()) {
        showIOSInstructions();
    }
}

// Helper functions
function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isInStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches;
}

function showIOSInstructions() {
    // Show instructions for iOS users to add to home screen
    console.log('iOS detected - show add to home screen instructions');
}

// Download App Button
function initializeDownloadButton() {
    const downloadBtn = document.getElementById('download-app-btn');
    
    if (!downloadBtn) return;
    
    // Show button only on mobile devices
    if (!isMobileDevice()) {
        downloadBtn.style.display = 'none';
        return;
    }
    
    downloadBtn.addEventListener('click', () => {
        if (isIOS()) {
            showIOSInstallInstructions();
        } else if (isAndroid()) {
            triggerAndroidInstall();
        } else {
            showGenericInstructions();
        }
        
        trackEvent('download_app_clicked', { 
            device: getDeviceType(),
            platform: isIOS() ? 'ios' : isAndroid() ? 'android' : 'other'
        });
    });
}

// Helper functions for device detection
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function isAndroid() {
    return /Android/i.test(navigator.userAgent);
}

function getDeviceType() {
    if (isIOS()) return 'ios';
    if (isAndroid()) return 'android';
    return 'other';
}

// iOS Install Instructions
function showIOSInstallInstructions() {
    const modal = document.createElement('div');
    modal.className = 'ios-instructions-modal';
    modal.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Scarica l'app APHERON</h3>
                    <button class="modal-close">×</button>
                </div>
                <div class="modal-body">
                    <div class="instruction-step">
                        <div class="step-number">1</div>
                        <div class="step-text">Tocca il pulsante <strong>Condividi</strong> <span class="share-icon">⎋</span> nella barra inferiore</div>
                    </div>
                    <div class="instruction-step">
                        <div class="step-number">2</div>
                        <div class="step-text">Scorri e tocca <strong>"Aggiungi alla schermata Home"</strong></div>
                    </div>
                    <div class="instruction-step">
                        <div class="step-number">3</div>
                        <div class="step-text">Tocca <strong>"Aggiungi"</strong> per installare l'app</div>
                    </div>
                    <div class="instruction-note">
                        <p>L'app APHERON sarà disponibile sulla tua schermata Home!</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal handlers
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            modal.remove();
        }
    });
}

// Android Install
function triggerAndroidInstall() {
    // Try to trigger the PWA install prompt
    if (window.deferredPrompt) {
        window.deferredPrompt.prompt();
        window.deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                trackEvent('android_install_accepted');
            } else {
                trackEvent('android_install_declined');
            }
            window.deferredPrompt = null;
        });
    } else {
        // Fallback: show instructions
        showAndroidInstructions();
    }
}

// Android Instructions
function showAndroidInstructions() {
    const modal = document.createElement('div');
    modal.className = 'android-instructions-modal';
    modal.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Scarica l'app APHERON</h3>
                    <button class="modal-close">×</button>
                </div>
                <div class="modal-body">
                    <div class="instruction-step">
                        <div class="step-number">1</div>
                        <div class="step-text">Tocca il menu <span class="menu-icon">⋮</span> in alto a destra</div>
                    </div>
                    <div class="instruction-step">
                        <div class="step-number">2</div>
                        <div class="step-text">Seleziona <strong>"Aggiungi alla schermata Home"</strong></div>
                    </div>
                    <div class="instruction-step">
                        <div class="step-number">3</div>
                        <div class="step-text">Tocca <strong>"Aggiungi"</strong> per installare l'app</div>
                    </div>
                    <div class="instruction-note">
                        <p>L'app APHERON sarà disponibile sulla tua schermata Home!</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal handlers
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            modal.remove();
        }
    });
}

// Generic Instructions
function showGenericInstructions() {
    const modal = document.createElement('div');
    modal.className = 'generic-instructions-modal';
    modal.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Scarica l'app APHERON</h3>
                    <button class="modal-close">×</button>
                </div>
                <div class="modal-body">
                    <div class="instruction-note">
                        <p>Per installare l'app APHERON, cerca l'opzione <strong>"Aggiungi alla schermata Home"</strong> o <strong>"Installa app"</strong> nel menu del tuo browser.</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal handlers
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            modal.remove();
        }
    });
}
