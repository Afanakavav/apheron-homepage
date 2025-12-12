/**
 * Form Handler for Studio Legale Taiti
 * Handles contact form submissions, validation, and Firestore integration
 */

import { getFirestore, getFunctions } from './firebase-config.js';

// ============================================
// Form Initialization
// ============================================
export function initContactForm() {
    const consulenzaForm = document.getElementById('consulenzaForm');
    
    if (!consulenzaForm) {
        console.warn('Contact form not found');
        return;
    }

    consulenzaForm.addEventListener('submit', handleFormSubmit);
    
    // Add real-time validation
    const formInputs = consulenzaForm.querySelectorAll('input, textarea, select');
    formInputs.forEach(input => {
        input.addEventListener('blur', () => validateField(input));
        input.addEventListener('input', () => clearFieldError(input));
    });
}

// ============================================
// Form Submission Handler
// ============================================
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const formMessage = document.getElementById('formMessage');
    
    // Disable submit button
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Invio in corso...';
    }

    // Clear previous messages
    if (formMessage) {
        formMessage.className = 'form-message';
        formMessage.textContent = '';
        formMessage.style.display = 'none';
    }

    // Validate form
    if (!validateForm(form)) {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Invia richiesta';
        }
        return;
    }

    // Get form data
    const formData = {
        nome: form.querySelector('#nome').value.trim(),
        email: form.querySelector('#email').value.trim(),
        telefono: form.querySelector('#telefono').value.trim(),
        tipologia: form.querySelector('#tipologia').value,
        messaggio: form.querySelector('#messaggio').value.trim(),
        privacy: form.querySelector('#privacy').checked,
        timestamp: new Date().toISOString(),
        source: 'website_contact_form'
    };

    try {
        // Get reCAPTCHA token (if configured)
        let recaptchaToken = null;
        if (typeof grecaptcha !== 'undefined' && grecaptcha.ready) {
            try {
                recaptchaToken = await getRecaptchaToken();
            } catch (error) {
                console.warn('reCAPTCHA not available:', error);
            }
        }

        // Save to Firestore
        const leadId = await saveLeadToFirestore(formData, recaptchaToken);

        // Send email via Firebase Function (optional)
        try {
            await sendEmailNotification(formData, leadId);
        } catch (error) {
            console.warn('Email notification failed, but lead was saved:', error);
            // Don't fail the form submission if email fails
        }

        // Track conversion event
        if (typeof gtag !== 'undefined') {
            gtag('event', 'lead_submit', {
                event_category: 'engagement',
                event_label: formData.tipologia || 'general',
                value: 1
            });
        }

        // Show success message
        showFormMessage('success', 'Richiesta inviata con successo. Ti contatteremo al più presto.');
        
        // Reset form
        form.reset();
        
        // Scroll to message
        if (formMessage) {
            formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

    } catch (error) {
        console.error('Error submitting form:', error);
        showFormMessage('error', 'Si è verificato un errore. Riprova più tardi o contattaci direttamente.');
    } finally {
        // Re-enable submit button
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Invia richiesta';
        }
    }
}

// ============================================
// Form Validation
// ============================================
function validateForm(form) {
    let isValid = true;
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
        if (!validateField(field)) {
            isValid = false;
        }
    });

    // Validate email format
    const emailField = form.querySelector('#email');
    if (emailField && emailField.value) {
        if (!validateEmail(emailField.value)) {
            showFieldError(emailField, 'Inserisci un indirizzo email valido');
            isValid = false;
        }
    }

    // Validate phone format
    const phoneField = form.querySelector('#telefono');
    if (phoneField && phoneField.value) {
        if (!validatePhone(phoneField.value)) {
            showFieldError(phoneField, 'Inserisci un numero di telefono valido');
            isValid = false;
        }
    }

    // Validate privacy checkbox
    const privacyField = form.querySelector('#privacy');
    if (privacyField && !privacyField.checked) {
        showFieldError(privacyField, 'È necessario accettare l\'informativa privacy');
        isValid = false;
    }

    return isValid;
}

function validateField(field) {
    const value = field.type === 'checkbox' ? field.checked : field.value.trim();
    
    if (field.hasAttribute('required') && !value) {
        showFieldError(field, 'Questo campo è obbligatorio');
        return false;
    }

    if (field.type === 'email' && value && !validateEmail(value)) {
        showFieldError(field, 'Inserisci un indirizzo email valido');
        return false;
    }

    if (field.type === 'tel' && value && !validatePhone(value)) {
        showFieldError(field, 'Inserisci un numero di telefono valido');
        return false;
    }

    clearFieldError(field);
    return true;
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    // Basic phone validation - allows international format
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 8 && cleaned.length <= 15;
}

function showFieldError(field, message) {
    clearFieldError(field);
    
    field.classList.add('error');
    field.style.borderColor = 'var(--color-error)';
    
    const errorElement = document.createElement('span');
    errorElement.className = 'field-error';
    errorElement.textContent = message;
    errorElement.style.cssText = 'display: block; color: var(--color-error); font-size: 0.875rem; margin-top: 0.25rem;';
    
    field.parentElement.appendChild(errorElement);
}

function clearFieldError(field) {
    field.classList.remove('error');
    field.style.borderColor = '';
    
    const errorElement = field.parentElement.querySelector('.field-error');
    if (errorElement) {
        errorElement.remove();
    }
}

function showFormMessage(type, message) {
    const formMessage = document.getElementById('formMessage');
    if (!formMessage) return;

    formMessage.className = `form-message ${type}`;
    formMessage.textContent = message;
    formMessage.style.display = 'block';
}

// ============================================
// Firestore Integration
// ============================================
async function saveLeadToFirestore(formData, recaptchaToken = null) {
    const db = getFirestore();
    
    if (!db) {
        throw new Error('Firestore not initialized');
    }

    // Get Firestore FieldValue (compat version)
    const FieldValue = typeof firebase !== 'undefined' && firebase.firestore 
        ? firebase.firestore.FieldValue 
        : null;
    
    if (!FieldValue) {
        throw new Error('Firebase Firestore not available');
    }

    const leadData = {
        ...formData,
        recaptchaToken: recaptchaToken,
        status: 'new',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    };

    try {
        const docRef = await db.collection('leads').add(leadData);
        console.log('Lead saved with ID:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Error saving lead to Firestore:', error);
        throw error;
    }
}

// ============================================
// Email Notification via Firebase Function
// ============================================
async function sendEmailNotification(formData, leadId) {
    const functions = getFunctions();
    
    if (!functions) {
        console.warn('Functions not initialized, skipping email notification');
        return;
    }

    try {
        // Call Firebase Function to send email
        // Replace 'sendContactEmail' with your actual function name
        const sendEmail = functions.httpsCallable('sendContactEmail');
        
        const result = await sendEmail({
            leadId: leadId,
            nome: formData.nome,
            email: formData.email,
            telefono: formData.telefono,
            tipologia: formData.tipologia,
            messaggio: formData.messaggio,
            timestamp: formData.timestamp
        });

        console.log('Email notification sent:', result);
        return result;
    } catch (error) {
        console.error('Error sending email notification:', error);
        throw error;
    }
}

// ============================================
// reCAPTCHA v3 Integration
// ============================================
async function getRecaptchaToken() {
    return new Promise((resolve, reject) => {
        if (typeof grecaptcha === 'undefined' || !grecaptcha.ready) {
            reject(new Error('reCAPTCHA not loaded'));
            return;
        }

        grecaptcha.ready(() => {
            grecaptcha.execute('6LcWjScsAAAAACAXAETtkhF8gmaUZwT0PLk972Vl', { action: 'submit_contact_form' })
                .then((token) => {
                    resolve(token);
                })
                .catch((error) => {
                    reject(error);
                });
        });
    });
}

// ============================================
// Initialize on DOM Load
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initContactForm();
});

