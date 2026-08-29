require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const webhookRoutes = require("./src/routes/webhook");
const adminRoutes = require("./src/routes/admin");

const app = express();
const PORT = process.env.PORT || 3000;

// Log diagnostico: stampa ogni richiesta in arrivo (utile per capire se
// Meta sta effettivamente chiamando il webhook).
app.use((req, res, next) => {
  console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

app.use(bodyParser.urlencoded({ extended: false })); // Twilio invia x-www-form-urlencoded
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/webhook", webhookRoutes);
app.use("/api", adminRoutes);

// La landing page (public/index.html) È il pannello di configurazione
// dello studio: qui il medico/lo studio inserisce orari, servizi ed
// esclusioni che il bot WhatsApp userà per rispondere.
app.get(["/", "/admin"], (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server avviato su porta ${PORT}`);
  console.log(`Webhook WhatsApp: POST /webhook/whatsapp`);
  console.log(`Pannello configurazione: GET /admin`);
});
