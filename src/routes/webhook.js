const express = require("express");
const { processIncomingMessage } = require("../flow/handler");
const { loadConfig } = require("../config/store");
const { sendWhatsAppMessage } = require("../whatsapp/client");

const router = express.Router();

// --- Verifica del webhook (richiesta una tantum da Meta quando lo configuri) ---
router.get("/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// --- Ricezione messaggi ---
router.post("/whatsapp", async (req, res) => {
  console.log("[WEBHOOK] payload ricevuto:", JSON.stringify(req.body));
  // Meta richiede una risposta 200 rapida: rispondiamo subito e processiamo
  // il messaggio in modo asincrono, inviando la risposta con una chiamata
  // separata alla Graph API.
  res.sendStatus(200);

  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) return; // es. notifiche di stato (consegnato/letto), da ignorare

    const from = message.from; // numero cifre, es. "391234567890"
    const text = message.text?.body?.trim();
    if (!text) return; // ignora messaggi non testuali (immagini, audio, ecc.)

    const config = await loadConfig();
    const replies = await processIncomingMessage({ phone: from, text, config });

    for (const reply of replies || []) {
      await sendWhatsAppMessage(from, reply);
    }
  } catch (err) {
    console.error("Errore nel flusso conversazionale:", err);
  }
});

module.exports = router;
