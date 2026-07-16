// ============================================
// CONFIGURAZIONE
// ============================================
const WHATSAPP_NUMBER = '353894040077';

// Template messaggi WhatsApp
const WHATSAPP_MESSAGES = {
    default: `Ciao Chiara! 😊 Ti contatto per una baby-sitter.
📍 Comune:
👶 Età bimbo/i:
🕒 Giorni & orari:
✅ Tipo richiesta (occasionale / giornata / weekend / serale):
📝 Note:`,

    serale: `Ciao Chiara! 😊 Ti contatto per una baby-sitter serale / weekend.
📍 Comune:
👶 Età bimbo/i:
🕒 Giorni & orari (serale / weekend):
✅ Tipo richiesta:
📝 Note:`,

    urgenza: `Ciao Chiara! 😊 Ti contatto per una baby-sitter URGENTE (oggi/domani).
📍 Comune:
👶 Età bimbo/i:
🕒 Giorni & orari:
✅ Tipo richiesta:
📝 Note:`
};

// ============================================
// FUNZIONE WHATSAPP
// ============================================
function openWhatsApp(type = 'default') {
    const message = WHATSAPP_MESSAGES[type] || WHATSAPP_MESSAGES.default;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
    
    // Apri WhatsApp
    window.open(whatsappUrl, '_blank');
    
    // Confetti minimal (solo se non c'è prefers-reduced-motion)
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        createConfetti();
    }
}

// ============================================
// CONFETTI MINIMAL
// ============================================
function createConfetti() {
    const confettiCount = 20;
    const colors = ['#20B2AA', '#FF6B6B', '#FFD93D', '#FFFFFF'];
    const duration = 900; // ms
    
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'fixed';
        confetti.style.width = '8px';
        confetti.style.height = '8px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.top = '-10px';
        confetti.style.borderRadius = '50%';
        confetti.style.pointerEvents = 'none';
        confetti.style.zIndex = '10000';
        confetti.style.opacity = '0.9';
        
        document.body.appendChild(confetti);
        
        // Animazione
        const angle = (Math.random() - 0.5) * Math.PI * 0.5;
        const velocity = 200 + Math.random() * 100;
        const x = Math.cos(angle) * velocity;
        const y = Math.sin(angle) * velocity + 300;
        
        confetti.animate([
            { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
            { transform: `translate(${x}px, ${y}px) rotate(360deg)`, opacity: 0 }
        ], {
            duration: duration,
            easing: 'ease-out'
        }).onfinish = () => {
            confetti.remove();
        };
    }
}

// ============================================
// SMOOTH SCROLL
// ============================================
function initSmoothScroll() {
    // Rispetta prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }
    
    // Smooth scroll per anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#' || href === '') return;
            
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// ============================================
// FADE-IN ON SCROLL
// ============================================
function initFadeInOnScroll() {
    // Rispetta prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        // Mostra tutto subito senza animazioni
        document.querySelectorAll('.fade-in').forEach(el => {
            el.classList.add('visible');
        });
        return;
    }
    
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Aggiungi classe fade-in agli elementi da animare
    const elementsToAnimate = document.querySelectorAll(
        '.trust-card, .process-step, .testimonianza-card, .faq-item, .rule-item, .checklist-item'
    );
    
    elementsToAnimate.forEach(el => {
        el.classList.add('fade-in');
        observer.observe(el);
    });
}

// ============================================
// STICKY BUTTON PULSE (delicato)
// ============================================
function initStickyButtonPulse() {
    // Rispetta prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }
    
    const stickyButton = document.querySelector('.sticky-whatsapp');
    if (!stickyButton) return;
    
    // Il pulse è già gestito via CSS, qui possiamo aggiungere logica extra se necessario
}

// ============================================
// INIZIALIZZAZIONE
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initSmoothScroll();
    initFadeInOnScroll();
    initStickyButtonPulse();
    
    // Aggiungi event listener per tutti i bottoni WhatsApp
    document.querySelectorAll('.btn-whatsapp, .btn-whatsapp-header, .sticky-whatsapp').forEach(btn => {
        btn.addEventListener('click', function(e) {
            // Se ha già un onclick, non fare nulla (gestito dall'attributo)
            if (this.onclick) return;
            
            // Altrimenti usa il default
            e.preventDefault();
            openWhatsApp('default');
        });
    });
    
    console.log('✅ Sito Chiara Caruso - Baby-sitter caricato correttamente');
});

// ============================================
// UTILITY: Prevenire scroll su mobile quando si apre WhatsApp
// ============================================
window.addEventListener('beforeunload', () => {
    // Salva scroll position se necessario
});

