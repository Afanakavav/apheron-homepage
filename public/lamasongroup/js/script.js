// ====================================
// NAVIGATION
// ====================================
const navToggle = document.getElementById("navToggle");
const navMenu = document.getElementById("navMenu");
const navLinks = document.querySelectorAll(".nav-link");
const header = document.getElementById("header");

// Mobile menu toggle
if (navToggle) {
  navToggle.addEventListener("click", () => {
    navMenu.classList.toggle("active");
    navToggle.classList.toggle("active");
  });
}

// Close menu when clicking on a link
navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navMenu.classList.remove("active");
    navToggle.classList.remove("active");
  });
});

// Header scroll effect
window.addEventListener("scroll", () => {
  if (window.scrollY > 50) {
    header.classList.add("scrolled");
  } else {
    header.classList.remove("scrolled");
  }
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    const href = this.getAttribute("href");
    if (href === "#") return;

    e.preventDefault();
    const target = document.querySelector(href);

    if (target) {
      const headerHeight = header.offsetHeight;
      const targetPosition = target.offsetTop - headerHeight;

      window.scrollTo({
        top: targetPosition,
        behavior: "smooth",
      });
    }
  });
});

// ====================================
// FAQ TOGGLE
// ====================================
const faqItems = document.querySelectorAll(".faq-item");

faqItems.forEach((item) => {
  const question = item.querySelector(".faq-question");

  question.addEventListener("click", () => {
    const isActive = item.classList.contains("active");

    // Close all FAQ items
    faqItems.forEach((faqItem) => {
      faqItem.classList.remove("active");
    });

    // Open clicked item if it wasn't active
    if (!isActive) {
      item.classList.add("active");
    }
  });
});

// ====================================
// PORTFOLIO FILTERS
// ====================================
const filterButtons = document.querySelectorAll(".filter-btn");
const portfolioItems = document.querySelectorAll(".portfolio-item");

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    // Remove active class from all buttons
    filterButtons.forEach((btn) => btn.classList.remove("active"));

    // Add active class to clicked button
    button.classList.add("active");

    // Get filter value
    const filterValue = button.getAttribute("data-filter");

    // Filter portfolio items
    portfolioItems.forEach((item) => {
      const category = item.getAttribute("data-category");

      if (filterValue === "all" || category === filterValue) {
        item.style.display = "block";
        setTimeout(() => {
          item.style.opacity = "1";
          item.style.transform = "scale(1)";
        }, 10);
      } else {
        item.style.opacity = "0";
        item.style.transform = "scale(0.8)";
        setTimeout(() => {
          item.style.display = "none";
        }, 300);
      }
    });
  });
});

// Add transition styles to portfolio items
portfolioItems.forEach((item) => {
  item.style.transition = "opacity 0.3s ease, transform 0.3s ease";
});

// ====================================
// EMAILJS INITIALIZATION
// ====================================
// Inizializza EmailJS quando la pagina è caricata
if (typeof emailjs !== "undefined") {
  // Sostituisci 'YOUR_PUBLIC_KEY' con la tua Public Key da EmailJS
  // La trovi su: Dashboard > Account > API Keys > Public Key
  emailjs.init("cVcAe6MvmwdmXfCXo");
} else {
  console.warn(
    "EmailJS non è stato caricato correttamente. Verifica che il CDN sia incluso nell'HTML."
  );
}

// ====================================
// PREVENTIVO FORM
// ====================================
const preventivoForm = document.getElementById("preventivoForm");

if (preventivoForm) {
  preventivoForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Get form data
    const formData = new FormData(preventivoForm);
    const data = Object.fromEntries(formData);

    // Validate form
    if (
      !data.nome ||
      !data.telefono ||
      !data.email ||
      !data.messaggio ||
      !data.tipoServizio
    ) {
      alert("Per favore, compila tutti i campi obbligatori.");
      return;
    }

    if (!data.privacy) {
      alert("Devi accettare la privacy policy per inviare la richiesta.");
      return;
    }

    // Show loading state
    const submitButton = preventivoForm.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = "Invio in corso...";
    submitButton.disabled = true;

    try {
      // Verifica che EmailJS sia disponibile
      if (typeof emailjs === "undefined") {
        throw new Error("EmailJS non è disponibile. Usa il fallback mailto.");
      }

      // Configurazione EmailJS
      // IMPORTANTE: Sostituisci questi valori con quelli del tuo account EmailJS:
      // - SERVICE_ID: Il tuo Email Service ID (es. 'service_gmail')
      // - TEMPLATE_ID: Il tuo Template ID (es. 'template_xyz123')
      // - PUBLIC_KEY: La tua Public Key (già inizializzata sopra)

      const serviceID = "service_f2bwzx3"; // Da sostituire
      const templateID = "template_9t4yjhp"; // Da sostituire

      // Prepara i parametri per EmailJS
      const templateParams = {
        from_name: data.nome,
        from_email: data.email,
        phone: data.telefono,
        service_type: data.tipoServizio,
        address: data.indirizzo || "Non specificato",
        message: data.messaggio,
        to_email: "francesco.perone00@gmail.com", // Email destinatario
        reply_to: data.email, // Per permettere risposte dirette
      };

      // Invia l'email tramite EmailJS
      const response = await emailjs.send(
        serviceID,
        templateID,
        templateParams
      );

      if (response.status === 200) {
        // Successo!
        alert(
          "✅ Richiesta inviata con successo! Ti contatteremo entro 24 ore."
        );
        submitButton.textContent = originalText;
        submitButton.disabled = false;
        preventivoForm.reset();
      } else {
        throw new Error("Errore nell'invio dell'email");
      }
    } catch (error) {
      console.error("Error:", error);

      // Fallback a mailto: se EmailJS non funziona
      const mailtoLink = `mailto:francesco.perone00@gmail.com?subject=Richiesta Preventivo - ${
        data.tipoServizio
      }&body=Nome: ${data.nome}%0ATelefono: ${data.telefono}%0AEmail: ${
        data.email
      }%0AIndirizzo: ${data.indirizzo || "N/A"}%0A%0AMessaggio:%0A${
        data.messaggio
      }`;

      alert(
        "⚠️ EmailJS non configurato correttamente. Si aprirà il client email. Configura EmailJS seguendo le istruzioni nel codice per un invio automatico."
      );
      window.location.href = mailtoLink;

      submitButton.textContent = originalText;
      submitButton.disabled = false;
    }
  });
}

// ====================================
// INTERSECTION OBSERVER FOR ANIMATIONS
// ====================================
const observerOptions = {
  threshold: 0.1,
  rootMargin: "0px 0px -50px 0px",
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = "1";
      entry.target.style.transform = "translateY(0)";
    }
  });
}, observerOptions);

// Observe elements for fade-in animation
const animatedElements = document.querySelectorAll(
  ".servizio-card, .portfolio-item, .certificazione-card, .faq-item"
);
animatedElements.forEach((el) => {
  el.style.opacity = "0";
  el.style.transform = "translateY(20px)";
  el.style.transition = "opacity 0.6s ease, transform 0.6s ease";
  observer.observe(el);
});

// ====================================
// LAZY LOADING FOR IMAGES
// ====================================
if ("IntersectionObserver" in window) {
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute("data-src");
          imageObserver.unobserve(img);
        }
      }
    });
  });

  const lazyImages = document.querySelectorAll("img[data-src]");
  lazyImages.forEach((img) => imageObserver.observe(img));
}

// ====================================
// SCROLL TO TOP BUTTON (optional)
// ====================================
const createScrollToTop = () => {
  const button = document.createElement("button");
  button.innerHTML = "↑";
  button.className = "scroll-to-top";
  button.setAttribute("aria-label", "Torna su");
  button.style.cssText = `
        position: fixed;
        bottom: 90px;
        right: 20px;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: var(--primary-gold);
        color: white;
        border: none;
        font-size: 24px;
        cursor: pointer;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
        z-index: 998;
        box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
    `;

  document.body.appendChild(button);

  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
      button.style.opacity = "1";
      button.style.visibility = "visible";
    } else {
      button.style.opacity = "0";
      button.style.visibility = "hidden";
    }
  });

  button.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });
};

// Uncomment to enable scroll to top button
// createScrollToTop();

// ====================================
// FORM VALIDATION ENHANCEMENTS
// ====================================
const phoneInput = document.getElementById("telefono");
if (phoneInput) {
  phoneInput.addEventListener("input", (e) => {
    // Remove non-numeric characters except +, spaces, and hyphens
    e.target.value = e.target.value.replace(/[^\d+\s-]/g, "");
  });
}

const emailInput = document.getElementById("email");
if (emailInput) {
  emailInput.addEventListener("blur", (e) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (e.target.value && !emailRegex.test(e.target.value)) {
      e.target.style.borderColor = "#e74c3c";
      e.target.setCustomValidity("Inserisci un'email valida");
    } else {
      e.target.style.borderColor = "";
      e.target.setCustomValidity("");
    }
  });
}

// ====================================
// PERFORMANCE: Preload critical resources
// ====================================
window.addEventListener("load", () => {
  // Add loaded class to body for CSS transitions
  document.body.classList.add("loaded");
});

// ====================================
// CONSOLE MESSAGE
// ====================================
console.log(
  "%cL.A. Mason Group",
  "font-size: 20px; font-weight: bold; color: #D4AF37;"
);
console.log(
  "%cSito web sviluppato con cura per L.A. Mason Group Srl",
  "color: #666; font-size: 12px;"
);
