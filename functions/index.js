/**
 * Firebase Cloud Functions for Studio Legale Taiti
 *
 * Function: sendContactEmail - Invia email quando viene compilato il form di contatto
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// Inizializza Firebase Admin (se non già inizializzato)
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Configura il transporter Nodemailer
 * Le credenziali vengono caricate dalle variabili d'ambiente di Firebase
 * @return {nodemailer.Transporter} Trasporter Nodemailer
 */
function createTransporter() {
  // Carica le credenziali dalle variabili d'ambiente
  const emailUser = functions.config().email?.user;
  const emailPassword = functions.config().email?.password;

  if (!emailUser || !emailPassword) {
    throw new Error("Email credentials not configured. Please set email.user and email.password using 'firebase functions:config:set'");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPassword, // App Password di Gmail
    },
  });
}

/**
 * Firebase Function: sendContactEmail
 *
 * Questa function viene chiamata dal client quando viene inviato il form di contatto.
 * Invia un'email di notifica all'avvocato.
 *
 * @param {Object} data - Dati del form
 * @param {string} data.nome - Nome del cliente
 * @param {string} data.email - Email del cliente
 * @param {string} data.telefono - Telefono del cliente (opzionale)
 * @param {string} data.tipologia - Tipologia di problema
 * @param {string} data.messaggio - Messaggio del cliente
 * @param {string} data.leadId - ID del documento salvato in Firestore
 * @param {Object} context - Contesto della chiamata
 * @returns {Promise<Object>} Risultato dell'invio email
 */
exports.sendContactEmail = functions.region("europe-west3").https.onCall(async (data, context) => {
  // Validazione dei dati obbligatori
  if (!data.nome || !data.email || !data.messaggio) {
    throwValidationError("I campi nome, email e messaggio sono obbligatori");
  }

  // Validazione formato email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    throwValidationError("Formato email non valido");
  }

  // Limita la lunghezza del messaggio per prevenire abusi
  if (data.messaggio.length > 5000) {
    throwValidationError("Il messaggio è troppo lungo (massimo 5000 caratteri)");
  }

  try {
    // Crea il transporter
    const transporter = createTransporter();

    // Prepara il contenuto dell'email
    const emailSubject = `Nuova richiesta consulenza - ${data.tipologia || "Generale"}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #1a3a5f; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f8f9fa; padding: 20px; margin-top: 20px; }
            .field { margin-bottom: 15px; }
            .label { font-weight: bold; color: #1a3a5f; }
            .value { margin-top: 5px; padding: 10px; background-color: white; border-left: 3px solid #d4af37; }
            .footer { margin-top: 20px; padding: 15px; background-color: #e9ecef; font-size: 12px; color: #6c757d; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Nuova Richiesta di Consulenza</h2>
              <p>Studio Legale Taiti - Sito Web</p>
            </div>
            <div class="content">
              <div class="field">
                <div class="label">Nome e Cognome:</div>
                <div class="value">${escapeHtml(data.nome)}</div>
              </div>
              <div class="field">
                <div class="label">Email:</div>
                <div class="value">${escapeHtml(data.email)}</div>
              </div>
              ${data.telefono ? `
              <div class="field">
                <div class="label">Telefono:</div>
                <div class="value">${escapeHtml(data.telefono)}</div>
              </div>
              ` : ""}
              ${data.tipologia ? `
              <div class="field">
                <div class="label">Tipologia:</div>
                <div class="value">${escapeHtml(data.tipologia)}</div>
              </div>
              ` : ""}
              <div class="field">
                <div class="label">Messaggio:</div>
                <div class="value">${escapeHtml(data.messaggio).replace(/\n/g, "<br>")}</div>
              </div>
              ${data.leadId ? `
              <div class="field">
                <div class="label">ID Lead (Firestore):</div>
                <div class="value">${data.leadId}</div>
              </div>
              ` : ""}
            </div>
            <div class="footer">
              <p>Questa email è stata generata automaticamente dal form di contatto del sito web.</p>
              <p>Data e ora: ${new Date().toLocaleString("it-IT", {timeZone: "Europe/Rome"})}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailText = `
Nuova richiesta di consulenza ricevuta dal sito web.

Nome: ${data.nome}
Email: ${data.email}
${data.telefono ? `Telefono: ${data.telefono}` : ""}
${data.tipologia ? `Tipologia: ${data.tipologia}` : ""}

Messaggio:
${data.messaggio}

${data.leadId ? `ID Lead (Firestore): ${data.leadId}` : ""}

Data e ora: ${new Date().toLocaleString("it-IT", {timeZone: "Europe/Rome"})}
    `;

    // Configura l'email
    const mailOptions = {
      from: `"Studio Legale Taiti" <${functions.config().email.user}>`,
      to: "francesco.perone00@gmail.com",
      replyTo: data.email, // Permette di rispondere direttamente al cliente
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    };

    // Invia l'email
    const info = await transporter.sendMail(mailOptions);

    console.log("Email inviata con successo:", info.messageId);

    return {
      success: true,
      messageId: info.messageId,
      message: "Email inviata con successo",
    };
  } catch (error) {
    console.error("Errore nell'invio dell'email:", error);

    // Non esporre dettagli dell'errore al client per sicurezza
    throw new functions.https.HttpsError(
        "internal",
        "Errore nell'invio dell'email. Riprova più tardi.",
    );
  }
});

/**
 * Funzione helper per escapare HTML e prevenire XSS
 * @param {string} text - Testo da escapare
 * @return {string} Testo escapato
 */
function escapeHtml(text) {
  if (!text) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  };
  return text.toString().replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Lancia HttpsError invalid-argument per validazione fallita
 * @param {string} message - Messaggio per il client
 * @throws {functions.https.HttpsError}
 */
function throwValidationError(message) {
  throw new functions.https.HttpsError("invalid-argument", message);
}

