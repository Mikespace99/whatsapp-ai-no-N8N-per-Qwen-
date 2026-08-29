// Client per l'invio di messaggi tramite la Meta Cloud API (WhatsApp Business
// Platform), senza intermediari come Twilio.
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api

const GRAPH_VERSION = "v20.0";

function apiUrl() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;
}

/**
 * Invia un messaggio WhatsApp in uscita. `to` è il numero così come
 * fornito da Meta nei webhook in ingresso (solo cifre, con prefisso
 * internazionale, senza "+").
 */
async function sendWhatsAppMessage(to, body) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn("[whatsapp] Credenziali Meta Cloud API mancanti, messaggio non inviato:", body);
    return null;
  }

  const res = await fetch(apiUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[whatsapp] Errore invio messaggio:", res.status, errText);
  }

  return res.json().catch(() => null);
}

module.exports = { sendWhatsAppMessage };

