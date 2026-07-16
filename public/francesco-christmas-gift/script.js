/* ============================================================
   CHRISTMAS 2025: GIFT MY ENGLISH - JAVASCRIPT LOGIC
   Centralized CONFIG, Calculator, Gift Card Preview, Print
   ============================================================ */

// CONFIG OBJECT - Centralized Control
const CONFIG = {
    TARGET: 1900,
    RAISED: 1350, // Manual update - aggiorna questo valore quando ricevi un regalo
    GIFT_PRESETS: [10, 20, 50],
    METRICS: {
        pronunciation: 35,
        flow: 25,
        confidence: 40
    },
    PAYMENT_DATA: {
        IBAN: 'Rimosso — chiedimelo in privato',
        CAUSALE: 'Regalo corso inglese – obiettivo fluency',
        REVOLUT_LINK: 'https://revolut.me/francepide',
        PAYPAL_LINK: 'https://www.paypal.me/FrancescoPerone'
    }
};

// State Management
let selectedAmount = 0;
let selectedPackage = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

/**
 * Initialize the application
 * NLP Note: Immediate visual feedback builds trust and reduces friction
 */
function initializeApp() {
    updateProgressBar();
    updatePaymentData();
    updateSelectedTotal();
    updateGiftCardPreview();
    updateMobileStickyBar();
    
    // Initialize metrics (static values as per requirements)
    // Metrics are already set in CSS, but we can animate them on load
    animateMetrics();
}

/**
 * Update progress bar based on CONFIG.RAISED
 * Trust-building: Visual progress shows transparency
 */
function updateProgressBar() {
    const progressFill = document.getElementById('progressFill');
    const raisedAmount = document.getElementById('raisedAmount');
    const targetAmount = document.getElementById('targetAmount');
    
    if (progressFill && raisedAmount && targetAmount) {
        const percentage = Math.min((CONFIG.RAISED / CONFIG.TARGET) * 100, 100);
        progressFill.style.width = percentage + '%';
        // Format number: show decimals only if needed
        const raisedFormatted = CONFIG.RAISED % 1 === 0 ? CONFIG.RAISED.toString() : CONFIG.RAISED.toFixed(2);
        raisedAmount.textContent = '€' + raisedFormatted;
        targetAmount.textContent = '€' + CONFIG.TARGET;
    }
}

/**
 * Update payment data from CONFIG
 */
function updatePaymentData() {
    const ibanValue = document.getElementById('ibanValue');
    const causaleValue = document.getElementById('causaleValue');
    const revolutLink = document.getElementById('revolutLink');
    const paypalLink = document.getElementById('paypalLink');
    
    if (ibanValue) ibanValue.textContent = CONFIG.PAYMENT_DATA.IBAN;
    if (causaleValue) causaleValue.textContent = CONFIG.PAYMENT_DATA.CAUSALE;
    if (revolutLink) revolutLink.href = CONFIG.PAYMENT_DATA.REVOLUT_LINK;
    if (paypalLink) paypalLink.href = CONFIG.PAYMENT_DATA.PAYPAL_LINK;
}

/**
 * Select a package
 * NLP Note: Clear action feedback reduces decision paralysis
 */
function selectPackage(amount) {
    selectedAmount = amount;
    selectedPackage = amount;
    
    // Reset free amount input
    const freeAmountInput = document.getElementById('freeAmount');
    if (freeAmountInput) {
        freeAmountInput.value = '';
    }
    
    // Visual feedback: highlight selected package
    document.querySelectorAll('.package-card').forEach(card => {
        card.classList.remove('selected');
        if (parseFloat(card.dataset.amount) === amount) {
            card.classList.add('selected');
        }
    });
    
    updateSelectedTotal();
    updateGiftCardPreview();
    updateMobileStickyBar();
    
    // Smooth scroll to gift card section
    setTimeout(() => {
        document.getElementById('gift-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

/**
 * Update free amount input
 * NLP Note: Real-time feedback keeps user engaged
 */
function updateFreeAmount() {
    const freeAmountInput = document.getElementById('freeAmount');
    if (!freeAmountInput) return;
    
    const value = parseFloat(freeAmountInput.value) || 0;
    
    if (value >= 5) {
        selectedAmount = value;
        selectedPackage = null;
        
        // Remove selection from package cards
        document.querySelectorAll('.package-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        updateSelectedTotal();
        updateGiftCardPreview();
        updateMobileStickyBar();
    } else if (value > 0 && value < 5) {
        // Show validation message
        freeAmountInput.setCustomValidity('Importo minimo: €5');
    } else {
        freeAmountInput.setCustomValidity('');
        selectedAmount = 0;
        updateSelectedTotal();
        updateGiftCardPreview();
        updateMobileStickyBar();
    }
}

/**
 * Add preset amount to free amount input
 * NLP Note: Presets reduce cognitive load and increase conversion
 */
function addPreset(presetAmount, event) {
    const freeAmountInput = document.getElementById('freeAmount');
    if (!freeAmountInput) return;
    
    const currentValue = parseFloat(freeAmountInput.value) || 0;
    const newValue = currentValue + presetAmount;
    
    freeAmountInput.value = newValue.toFixed(2);
    
    // Trigger input event to update state
    freeAmountInput.dispatchEvent(new Event('input'));
    
    // Visual feedback
    if (event && event.target) {
        const presetBtn = event.target;
        presetBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            presetBtn.style.transform = '';
        }, 150);
    }
}

/**
 * Update selected total display
 */
function updateSelectedTotal() {
    const totalAmount = document.getElementById('totalAmount');
    const stickyTotal = document.getElementById('stickyTotal');
    
    const formattedAmount = '€' + selectedAmount.toFixed(2);
    
    if (totalAmount) {
        totalAmount.textContent = formattedAmount;
    }
    
    if (stickyTotal) {
        stickyTotal.textContent = formattedAmount;
    }
    
    // Show/hide selected total section
    const selectedTotalSection = document.getElementById('selectedTotal');
    if (selectedTotalSection) {
        if (selectedAmount > 0) {
            selectedTotalSection.style.display = 'block';
        } else {
            selectedTotalSection.style.display = 'none';
        }
    }
}

/**
 * Update gift card preview in real-time
 * NLP Note: Live preview creates emotional connection and urgency
 */
function updateGiftCardPreview() {
    const donorNameInput = document.getElementById('donorName');
    const anonymousCheckbox = document.getElementById('anonymousMode');
    const donorMessageInput = document.getElementById('donorMessage');
    
    const previewName = document.getElementById('previewName');
    const previewMessage = document.getElementById('previewMessage');
    const previewAmount = document.getElementById('previewAmount');
    
    // Determine name
    let displayName = 'Il tuo nome';
    if (anonymousCheckbox && anonymousCheckbox.checked) {
        displayName = 'Anonimo';
    } else if (donorNameInput && donorNameInput.value.trim()) {
        displayName = donorNameInput.value.trim();
    }
    
    // Determine message
    let displayMessage = 'Il tuo messaggio personale';
    if (donorMessageInput && donorMessageInput.value.trim()) {
        displayMessage = donorMessageInput.value.trim();
    }
    
    // Update preview
    if (previewName) {
        previewName.textContent = displayName;
    }
    
    if (previewMessage) {
        previewMessage.textContent = displayMessage;
    }
    
    if (previewAmount) {
        previewAmount.textContent = '€' + selectedAmount.toFixed(2);
    }
}

/**
 * Print gift card
 * NLP Note: Physical artifact (printable) increases perceived value
 */
function printGiftCard() {
    // Add printing class to body
    document.body.classList.add('printing');
    
    // Wait for styles to apply, then print
    setTimeout(() => {
        window.print();
        
        // Remove printing class after print dialog closes
        setTimeout(() => {
            document.body.classList.remove('printing');
        }, 1000);
    }, 100);
}

/**
 * Open gift card in fullscreen for screenshot
 */
function openFullscreen() {
    const giftCardPreview = document.getElementById('giftCardPreview');
    if (!giftCardPreview) return;
    
    // Create fullscreen overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--bg-main);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
    `;
    
    const clonedCard = giftCardPreview.cloneNode(true);
    clonedCard.style.cssText = `
        max-width: 600px;
        width: 100%;
        transform: scale(1.2);
    `;
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Chiudi';
    closeBtn.style.cssText = `
        position: absolute;
        top: 2rem;
        right: 2rem;
        padding: 1rem 2rem;
        background: var(--accent-gold);
        color: var(--bg-main);
        border: none;
        border-radius: 20px;
        font-weight: 600;
        cursor: pointer;
    `;
    closeBtn.onclick = () => {
        document.body.removeChild(overlay);
    };
    
    overlay.appendChild(clonedCard);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
}

/**
 * Copy text to clipboard
 * NLP Note: One-click copy reduces friction significantly
 */
function copyToClipboard(elementId, label, event) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // Handle both text content and href attributes
    let text = element.textContent ? element.textContent.trim() : '';
    if (!text && element.href) {
        text = element.href;
    }
    if (!text && element.value) {
        text = element.value;
    }
    
    const button = event && event.target ? event.target : null;
    
    // Use modern Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            if (button) showCopyFeedback(button, label);
        }).catch(err => {
            console.error('Failed to copy:', err);
            if (button) fallbackCopyToClipboard(text, button, label);
        });
    } else {
        if (button) fallbackCopyToClipboard(text, button, label);
    }
}

/**
 * Fallback copy method for older browsers
 */
function fallbackCopyToClipboard(text, button, label) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
        document.execCommand('copy');
        showCopyFeedback(button, label);
    } catch (err) {
        console.error('Fallback copy failed:', err);
        alert('Impossibile copiare. Seleziona manualmente il testo.');
    }
    
    document.body.removeChild(textArea);
}

/**
 * Show visual feedback when copying
 */
function showCopyFeedback(button, label) {
    const originalText = button.textContent;
    button.textContent = '✓ Copiato!';
    button.style.background = 'var(--accent-growth)';
    button.style.borderColor = 'var(--accent-growth)';
    button.style.color = 'var(--bg-main)';
    
    setTimeout(() => {
        button.textContent = originalText;
        button.style.background = '';
        button.style.borderColor = '';
        button.style.color = '';
    }, 2000);
}

/**
 * Update mobile sticky bar
 */
function updateMobileStickyBar() {
    const mobileStickyBar = document.getElementById('mobileStickyBar');
    if (!mobileStickyBar) return;
    
    if (selectedAmount > 0) {
        mobileStickyBar.style.display = 'block';
    } else {
        mobileStickyBar.style.display = 'none';
    }
}

/**
 * Animate metrics on page load
 * NLP Note: Visual progress indicators create motivation
 */
function animateMetrics() {
    const metricFills = document.querySelectorAll('.metric-fill');
    
    metricFills.forEach((fill, index) => {
        const width = fill.style.width;
        fill.style.width = '0%';
        
        setTimeout(() => {
            fill.style.transition = 'width 1.5s ease-out';
            fill.style.width = width;
        }, index * 200);
    });
}

// Handle window resize for mobile sticky bar visibility
window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
        const mobileStickyBar = document.getElementById('mobileStickyBar');
        if (mobileStickyBar) {
            mobileStickyBar.style.display = 'none';
        }
    } else {
        updateMobileStickyBar();
    }
});

// Smooth scroll behavior enhancement
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
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

// Add intersection observer for fade-in animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all cards for fade-in
document.querySelectorAll('.package-card, .metric-card, .method-card, .faq-item').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    observer.observe(card);
});

