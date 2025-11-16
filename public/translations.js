// Translations for APHERON Website
const translations = {
    en: {
        // Hero & Tagline
        tagline: "Apheron",
        heroSubtitle: "Websites, apps & digital systems for freelancers, startups & small businesses.",
        
        // About Me
        bioText: "Digital strategist who transforms ideas into reality.",
        badge1: "Web Development",
        badge2: "Digital Systems",
        badge3: "Fast Delivery",
        
        // Why Choose Me
        whyTitle: "Why Choose Me",
        whyItem1Title: "A New-Generation Digital Builder",
        whyItem1Text: "Concrete projects for freelancers and small businesses: websites, digital platforms and AI agents that satisfy customers and simplify work.",
        whyItem2Title: "Real Fast Result",
        whyItem2Text: "I bring speed, modern tools and hands-on execution. Clear scope, fast delivery, measurable results.",
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
        faq1Answer: "I focus on fast, practical execution, not long theory or endless planning.\n\nYou work directly with me: clear communication, modern tools and weekly progress.\n\nWe launch in 14 days, track every result and iterate fast.\n\nFormula I use:\n\nBuild <specific result> in <defined time> with <proven method>.",
        faq2Question: "Do you work with startups or enterprises?",
        faq2Answer: "I partner mainly with entrepreneurs, freelancers, and small-to-mid businesses. I also support early-stage startups building and launching their first product. My focus is simple: deliver fast, design around real needs, and build solutions that scale as your business grows.",
        faq3Question: "What's included in a strategy call?",
        faq3Answer: "A free 20-minute session to understand your needs and give you a clear action plan.\n\nWe evaluate your current digital setup, identify growth opportunities, and define priorities.\n\nNo sales pitch, just honest, practical guidance.\n\nIn 20 minutes, we cover:\n\n• Quick audit.\n\n• Growth opportunities.\n\n• ROI estimate and next steps.",
        
        // CTA
        ctaText: "Book a free 20-minute strategy call",
        ctaButton: "Book Now",
        whatsappMessage: "Hi Francesco, I'm interested in having a 20-minute strategy call. Best regards",
        
        // Footer
        copyright: "© 2025 APHERON. All rights reserved.",
        taglineFooter: "Apheron",
        contactLabel: "For inquiries:",
        downloadApp: "Download App",
        adminAccess: "Admin Access",
        googleBusinessText: "⭐ Rated on Google Business",
        googleBusinessLink: "https://share.google/NoV62Slr5oYRx4w6k"
    },
    it: {
        // Hero & Tagline
        tagline: "Apheron",
        heroSubtitle: "Siti web, app e sistemi digitali per liberi professionisti, startup e piccole aziende.",
        
        // About Me
        bioText: "Stratega digitale che trasforma idee in realtà.",
        badge1: "Sviluppo Web",
        badge2: "Sistemi Digitali",
        badge3: "Consegna Rapida",
        
        // Why Choose Me
        whyTitle: "Perché Scegliere Me",
        whyItem1Title: "Costruttore Digitale di Nuova Generazione",
        whyItem1Text: "Progetti per liberi professionisti e PMI: siti internet, gestionali e agenti IA che semplificano il lavoro e soddisfano i clienti.",
        whyItem2Title: "Real Fast Result",
        whyItem2Text: "Porto velocità, strumenti moderni ed esecuzione pratica. Obiettivi chiari, consegna rapida, risultati misurabili.",
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
        faq1Answer: "Mi concentro sull'esecuzione rapida e concreta, niente teoria infinita o tempi lunghi.\n\nLavori direttamente con me: comunicazione chiara, strumenti moderni, risultati misurabili.\n\nIl mio metodo:\n\nCostruiamo <risultato concreto> in <tempo definito> con <approccio testato>.",
        faq2Question: "Lavori con startup o aziende?",
        faq2Answer: "Collaboro principalmente con imprenditori, liberi professionisti e piccole-medie aziende. Supporto anche startup in fase iniziale che stanno costruendo e lanciando il loro primo prodotto. Il mio focus è semplice: consegnare velocemente, progettare intorno a bisogni reali, e costruire soluzioni che scalano man mano che il tuo business cresce.",
        faq3Question: "Cosa include una chiamata strategica?",
        faq3Answer: "Una sessione gratuita di 20 minuti per capire le tue esigenze e definire un piano chiaro.\n\nAnalizziamo la tua presenza digitale, individuiamo opportunità di crescita e stabilizziamo le priorità.\n\nNessuna vendita aggressiva, solo consigli pratici e diretti.\n\nIn 20 minuti facciamo:\n\n• Analisi veloce.\n\n• Opportunità di crescita.\n\n• Stima ROI e prossimi passi.",
        
        // CTA
        ctaText: "Prenota una chiamata strategica gratuita di 20 minuti",
        ctaButton: "Prenota Ora",
        whatsappMessage: "Ciao Francesco, sono interessato a fare una chiamata strategica di 20 minuti. Un saluto",
        
        // Footer
        copyright: "© 2025 APHERON. Tutti i diritti riservati.",
        taglineFooter: "Apheron",
        contactLabel: "Per informazioni:",
        downloadApp: "Scarica l'App",
        adminAccess: "Accesso Admin",
        googleBusinessText: "⭐ Valutato su Google Business",
        googleBusinessLink: "https://share.google/Dfx20UlYHGt4ghM5R"
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
        'admin-access': t.adminAccess,
        'google-business-text': t.googleBusinessText
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
    
    // Update WhatsApp link with translated message
    const whatsappLink = document.querySelector('[data-whatsapp-link]');
    if (whatsappLink && t.whatsappMessage) {
        const encodedMessage = encodeURIComponent(t.whatsappMessage);
        whatsappLink.href = `https://wa.me/353894040077?text=${encodedMessage}`;
    }
    
    // Update Google Business Profile link based on language
    const googleBusinessLink = document.querySelector('[data-google-business-link]');
    if (googleBusinessLink) {
        // Force update with the correct link for current language
        // Get link directly from translations object to ensure we use correct one
        const currentTranslation = translations[currentLang];
        const linkForCurrentLang = currentTranslation ? currentTranslation.googleBusinessLink : '';
        
        if (linkForCurrentLang && typeof linkForCurrentLang === 'string' && linkForCurrentLang.trim() !== '') {
            // Force update the href attribute
            googleBusinessLink.setAttribute('href', linkForCurrentLang.trim());
            googleBusinessLink.href = linkForCurrentLang.trim();
            googleBusinessLink.style.display = 'inline-flex';
        } else {
            googleBusinessLink.href = '#';
            googleBusinessLink.style.display = 'none';
        }
    }
    
    // Update button title attributes for tooltips
    const downloadAppBtn = document.querySelector('[data-translate-title="downloadApp"]');
    if (downloadAppBtn) {
        downloadAppBtn.setAttribute('title', t.downloadApp);
    }
    
    const adminAccessBtn = document.querySelector('[data-translate-title="adminAccess"]');
    if (adminAccessBtn) {
        adminAccessBtn.setAttribute('title', t.adminAccess);
    }
}

// Initialize on page load
function initializeTranslations() {
    const initLanguage = () => {
        // Ensure we have a valid language
        const savedLang = localStorage.getItem('apheron-lang');
        const defaultLang = savedLang && translations[savedLang] ? savedLang : 'en';
        currentLang = defaultLang;
        window.setLanguage(currentLang);
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLanguage);
    } else {
        initLanguage();
    }
}

// Call initialization
initializeTranslations();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { translations, setLanguage, currentLang };
}

