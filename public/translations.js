// Translations for APHERON Website
const translations = {
    en: {
        // Hero & Tagline
        tagline: "Unlock Human Intelligence",
        heroSubtitle: "Websites, apps & digital systems for freelancers, startups & small businesses.",
        
        // About Me
        bioText: "Digital strategist who transforms ideas into reality.",
        badge1: "Web Development",
        badge2: "Digital Systems",
        badge3: "Fast Delivery",
        
        // Why Choose Me
        whyTitle: "Why Choose Me",
        whyItem1Title: "A New-Generation Digital Builder",
        whyItem1Text: "Instead of years of legacy agency structure, I bring speed, modern tools, and hands-on execution. Clear scope, fast delivery, measurable results, without the agency overhead.",
        whyItem2Title: "Real Results, Fast",
        whyItem2Text: "Concrete projects for freelancers and small businesses. Websites, digital platforms and automations that generate clients and simplify work. Fast delivery, continuous support, measurable results.",
        whyItem3Title: "Strategic Vision",
        whyItem3Text: "I don't just build websites, I architect digital ecosystems that grow with your business.",
        
        // Recent Work
        recentWorkTitle: "Recent Work",
        recentWorkItem1: "Website redesign for a consulting business → +30% contact requests in 30 days",
        recentWorkItem2: "Booking platform prototype for a wellness professional",
        recentWorkItem3: "Brand + landing + automation setup for a creative project launch",
        
        // FAQ
        faqTitle: "Frequently Asked Questions",
        faq1Question: "What makes your approach different?",
        faq1Answer: "I use a modern, hands-on methodology that focuses on fast delivery and practical solutions. While others rely on complex agency structures, I bring direct execution, clear communication, and tools that actually work.",
        faq2Question: "Do you work with startups or enterprises?",
        faq2Answer: "I partner mainly with entrepreneurs, freelancers, and small-to-mid businesses. I also support early-stage startups building and launching their first product. My focus is simple: deliver fast, design around real needs, and build solutions that scale as your business grows.",
        faq3Question: "What's included in a strategy call?",
        faq3Answer: "A free 20-minute consultation where we analyze your current digital presence, identify opportunities, and create a roadmap for your digital transformation. No sales pitch, just practical advice.",
        
        // CTA
        ctaText: "Book a free 20-minute strategy call",
        ctaButton: "Book Now",
        
        // Footer
        copyright: "© 2025 APHERON. All rights reserved.",
        taglineFooter: "Unlock human intelligence",
        contactLabel: "For inquiries:",
        downloadApp: "Download App",
        adminAccess: "Admin Access"
    },
    it: {
        // Hero & Tagline
        tagline: "Sblocca l'Intelligenza Umana",
        heroSubtitle: "Siti web, app e sistemi digitali per liberi professionisti, startup e piccole aziende.",
        
        // About Me
        bioText: "Stratega digitale che trasforma idee in realtà.",
        badge1: "Sviluppo Web",
        badge2: "Sistemi Digitali",
        badge3: "Consegna Rapida",
        
        // Why Choose Me
        whyTitle: "Perché Scegliere Me",
        whyItem1Title: "Costruttore Digitale di Nuova Generazione",
        whyItem1Text: "Invece di anni di struttura legacy delle agenzie, porto velocità, strumenti moderni ed esecuzione pratica. Scope chiaro, consegna rapida, risultati misurabili, senza il sovraccarico dell'agenzia.",
        whyItem2Title: "Risultati Reali, Velocemente",
        whyItem2Text: "Progetti concreti per liberi professionisti e piccole aziende. Siti web, piattaforme digitali e automazioni che generano clienti e semplificano il lavoro. Consegna rapida, supporto continuo, risultati misurabili.",
        whyItem3Title: "Visione Strategica",
        whyItem3Text: "Non costruisco solo siti web, progetto ecosistemi digitali che crescono con il tuo business.",
        
        // Recent Work
        recentWorkTitle: "Lavori Recenti",
        recentWorkItem1: "Ridesign sito web per un'attività di consulenza → +30% richieste di contatto in 30 giorni",
        recentWorkItem2: "Prototipo piattaforma prenotazioni per un professionista del wellness",
        recentWorkItem3: "Brand + landing + setup automazioni per il lancio di un progetto creativo",
        
        // FAQ
        faqTitle: "Domande Frequenti",
        faq1Question: "Cosa rende il tuo approccio diverso?",
        faq1Answer: "Uso una metodologia moderna e pratica che si concentra su consegne rapide e soluzioni concrete. Mentre altri si affidano a strutture di agenzia complesse, porto esecuzione diretta, comunicazione chiara e strumenti che funzionano davvero.",
        faq2Question: "Lavori con startup o aziende?",
        faq2Answer: "Collaboro principalmente con imprenditori, liberi professionisti e piccole-medie aziende. Supporto anche startup in fase iniziale che stanno costruendo e lanciando il loro primo prodotto. Il mio focus è semplice: consegnare velocemente, progettare intorno a bisogni reali, e costruire soluzioni che scalano man mano che il tuo business cresce.",
        faq3Question: "Cosa include una chiamata strategica?",
        faq3Answer: "Una consulenza gratuita di 20 minuti in cui analizziamo la tua presenza digitale attuale, identifichiamo opportunità e creiamo una roadmap per la tua trasformazione digitale. Niente vendita, solo consigli pratici.",
        
        // CTA
        ctaText: "Prenota una chiamata strategica gratuita di 20 minuti",
        ctaButton: "Prenota Ora",
        
        // Footer
        copyright: "© 2025 APHERON. Tutti i diritti riservati.",
        taglineFooter: "Sblocca l'intelligenza umana",
        contactLabel: "Per informazioni:",
        downloadApp: "Scarica l'App",
        adminAccess: "Accesso Admin"
    }
};

// Language management
let currentLang = localStorage.getItem('apheron-lang') || 'en';

// Make setLanguage globally accessible
window.setLanguage = function(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    localStorage.setItem('apheron-lang', lang);
    document.documentElement.lang = lang;
    updateContent();
};

function updateContent() {
    const t = translations[currentLang];
    if (!t) return;
    
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) {
            if (el.tagName === 'INPUT' || el.tagName === 'BUTTON') {
                if (el.type === 'button' || el.tagName === 'BUTTON') {
                    el.textContent = t[key];
                } else {
                    el.value = t[key];
                }
            } else if (el.tagName === 'A' && el.hasAttribute('href')) {
                // For links, update text content
                el.textContent = t[key];
            } else {
                el.textContent = t[key];
            }
        }
    });
    
    // Update elements with specific IDs
    const updates = {
        'tagline-h1': t.tagline,
        'hero-subtitle': t.heroSubtitle,
        'bio-text': t.bioText,
        'why-title': t.whyTitle,
        'why-item1-title': t.whyItem1Title,
        'why-item1-text': t.whyItem1Text,
        'why-item2-title': t.whyItem2Title,
        'why-item2-text': t.whyItem2Text,
        'why-item3-title': t.whyItem3Title,
        'why-item3-text': t.whyItem3Text,
        'recent-work-title': t.recentWorkTitle,
        'recent-work-item1': t.recentWorkItem1,
        'recent-work-item2': t.recentWorkItem2,
        'recent-work-item3': t.recentWorkItem3,
        'faq-title': t.faqTitle,
        'faq1-question': t.faq1Question,
        'faq1-answer': t.faq1Answer,
        'faq2-question': t.faq2Question,
        'faq2-answer': t.faq2Answer,
        'faq3-question': t.faq3Question,
        'faq3-answer': t.faq3Answer,
        'cta-text': t.ctaText,
        'cta-button': t.ctaButton,
        'copyright': t.copyright,
        'tagline-footer': t.taglineFooter,
        'contact-label': t.contactLabel,
        'download-app': t.downloadApp,
        'admin-access': t.adminAccess
    };
    
    Object.entries(updates).forEach(([id, text]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    });
    
    // Update badges
    const badges = document.querySelectorAll('.badge');
    if (badges.length >= 3) {
        badges[0].textContent = t.badge1;
        badges[1].textContent = t.badge2;
        badges[2].textContent = t.badge3;
    }
    
    // Update language toggle active state
    document.querySelectorAll('.lang-toggle').forEach(toggle => {
        if (toggle.dataset.lang === currentLang) {
            toggle.classList.add('active');
        } else {
            toggle.classList.remove('active');
        }
    });
}

// Initialize on page load
function initializeTranslations() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.setLanguage(currentLang);
        });
    } else {
        window.setLanguage(currentLang);
    }
}

// Call initialization
initializeTranslations();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { translations, setLanguage, currentLang };
}

