/**
 * Firebase Cloud Functions for Studio Legale Taiti + Studio Biancalani
 *
 * Functions:
 * - sendContactEmail: form contatto Studio Legale Taiti
 * - sendAppointmentRequest: richiesta appuntamento Studio Biancalani
 *
 * Config: Secret Manager (EMAIL_USER, EMAIL_PASS) - migrato da .env
 */

const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

const emailUserSecret = defineSecret("EMAIL_USER");
const emailPassSecret = defineSecret("EMAIL_PASS");

// Inizializza Firebase Admin (se non già inizializzato)
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Crea il transporter Nodemailer con le credenziali fornite
 * @param {string} emailUser - Email Gmail
 * @param {string} emailPassword - Password app Gmail
 * @return {nodemailer.Transporter} Trasporter Nodemailer
 */
function createTransporter(emailUser, emailPassword) {
  if (!emailUser || !emailPassword) {
    throw new Error("Email credentials not configured");
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: emailUser, pass: emailPassword },
  });
}

/**
 * Firebase Function: sendContactEmail (v2)
 *
 * Questa function viene chiamata dal client quando viene inviato il form di contatto.
 * Invia un'email di notifica all'avvocato.
 * Credenziali da Secret Manager (EMAIL_USER, EMAIL_PASS).
 */
exports.sendContactEmail = onCall(
  {
    region: "europe-west3",
    secrets: [emailUserSecret, emailPassSecret],
  },
  async (request) => {
    const data = request.data;

    // Validazione dei dati obbligatori
    if (!data.nome || !data.email || !data.messaggio) {
      throw new HttpsError("invalid-argument", "I campi nome, email e messaggio sono obbligatori");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new HttpsError("invalid-argument", "Formato email non valido");
    }

    if (data.messaggio.length > 5000) {
      throw new HttpsError("invalid-argument", "Il messaggio è troppo lungo (massimo 5000 caratteri)");
    }

    try {
      const transporter = createTransporter(
        emailUserSecret.value(),
        emailPassSecret.value()
      );

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
        from: `"Studio Legale Taiti" <${emailUserSecret.value()}>`,
        to: "francesco.perone00@gmail.com",
        replyTo: data.email,
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("Email inviata con successo:", info.messageId);

      return {
        success: true,
        messageId: info.messageId,
        message: "Email inviata con successo",
      };
    } catch (error) {
      console.error("Errore nell'invio dell'email:", error);
      throw new HttpsError("internal", "Errore nell'invio dell'email. Riprova più tardi.");
    }
  }
);

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
 * Cloud Function v2 - Richiesta appuntamento Studio Biancalani
 * Regione: europe-west1, CORS per apheron.io
 */
exports.sendAppointmentRequest = onRequest({
  runtime: "nodejs20",
  region: "europe-west1",
  cors: true,
  secrets: [emailUserSecret, emailPassSecret],
}, (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    nome, email, telefono, partitaIva, tipologia, messaggio,
    preferenzaContatto, clientType,
  } = req.body;

  if (!nome || !email || !telefono || !tipologia || !messaggio) {
    return res.status(400).json({
      error: "Dati mancanti. Verifica che tutti i campi obbligatori siano compilati.",
    });
  }

  const tipoCliente = clientType === "new" ? "Nuovo Cliente" : "Cliente Esistente";
  const dataRichiesta = new Date().toLocaleString("it-IT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const emailText = `
Richiesta di Appuntamento - ${tipoCliente}

DETTAGLI CLIENTE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Nome: ${nome}
Email: ${email}
Telefono: ${telefono}
${partitaIva ? `Partita IVA: ${partitaIva}` : ""}

RICHIESTA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tipologia: ${tipologia}
Preferenza Contatto: ${preferenzaContatto}

MESSAGGIO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${messaggio}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Data richiesta: ${dataRichiesta}
Inviato da: ${email}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Questa email è stata inviata automaticamente dal sito web
Studio Professionale Biancalani
www.apheron.io/studioprofessionalebiancalani
  `.trim();

  const emailHtml = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #003366; color: white; padding: 20px; text-align: center; }
    .content { background-color: #f9f9f9; padding: 20px; margin-top: 20px; }
    .section { margin-bottom: 20px; }
    .section-title { font-weight: bold; color: #003366; margin-bottom: 10px; font-size: 16px; }
    .field { margin-bottom: 8px; }
    .field-label { font-weight: bold; }
    .message-box { background-color: white; padding: 15px; border-left: 4px solid #0066CC; margin-top: 10px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">Richiesta di Appuntamento</h2>
      <p style="margin: 10px 0 0 0; font-size: 14px;">${tipoCliente}</p>
    </div>
    <div class="content">
      <div class="section">
        <div class="section-title">Dettagli Cliente</div>
        <div class="field"><span class="field-label">Nome:</span> ${nome}</div>
        <div class="field"><span class="field-label">Email:</span> <a href="mailto:${email}">${email}</a></div>
        <div class="field"><span class="field-label">Telefono:</span> <a href="tel:${telefono}">${telefono}</a></div>
        ${partitaIva ? `<div class="field"><span class="field-label">Partita IVA:</span> ${partitaIva}</div>` : ""}
      </div>
      <div class="section">
        <div class="section-title">Richiesta</div>
        <div class="field"><span class="field-label">Tipologia:</span> ${tipologia}</div>
        <div class="field"><span class="field-label">Preferenza Contatto:</span> ${preferenzaContatto}</div>
      </div>
      <div class="section">
        <div class="section-title">Messaggio</div>
        <div class="message-box">${messaggio.replace(/\n/g, "<br>")}</div>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0;">Data richiesta: ${dataRichiesta}</p>
      <p style="margin: 5px 0 0 0;">
        Questa email è stata inviata automaticamente dal sito web<br>
        <strong>Studio Professionale Biancalani</strong><br>
        <a href="https://apheron.io/studioprofessionalebiancalani" style="color: #0066CC;">www.apheron.io/studioprofessionalebiancalani</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const emailUser = emailUserSecret.value();
  const emailPass = emailPassSecret.value();
  if (!emailUser || !emailPass) {
    console.error("EMAIL_USER e EMAIL_PASS devono essere configurati in Secret Manager");
    return res.status(500).json({ error: "Configurazione email mancante" });
  }

  const transporter = createTransporter(emailUser, emailPass);
  const mailOptions = {
    from: `"Sito Web Studio Biancalani" <${emailUser}>`,
    to: "francesco.perone00@gmail.com",
    replyTo: email,
    subject: `Richiesta Appuntamento - ${tipoCliente} - ${nome}`,
    text: emailText,
    html: emailHtml,
  };

  transporter.sendMail(mailOptions)
    .then(() => {
      console.log("Email inviata con successo a francesco.perone00@gmail.com");
      return res.status(200).json({ success: true, message: "Email inviata con successo" });
    })
    .catch((error) => {
      console.error("Errore nell'invio email:", error);
      return res.status(500).json({
        error: "Errore nell'invio dell'email",
        details: error.message,
      });
    });
});