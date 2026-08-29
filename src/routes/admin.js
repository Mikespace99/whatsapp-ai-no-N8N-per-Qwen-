const express = require("express");
const { loadConfig, saveConfig } = require("../config/store");
const bookingsStore = require("../calendar/bookingsStore");

const router = express.Router();

// Auth semplice basata su password condivisa, passata come header
// "x-admin-password". Pensata per un piccolo studio con un solo pannello,
// non per multi-tenant.
function checkAuth(req, res, next) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return next(); // nessuna password configurata: accesso libero (solo per sviluppo locale)
  const provided = req.header("x-admin-password");
  if (provided !== expected) {
    return res.status(401).json({ error: "Password non valida" });
  }
  next();
}

router.get("/config", checkAuth, async (req, res) => {
  try {
    res.json(await loadConfig());
  } catch (err) {
    console.error("Errore lettura config:", err);
    res.status(500).json({ error: "Impossibile leggere la configurazione" });
  }
});

router.post("/config", checkAuth, async (req, res) => {
  try {
    const saved = await saveConfig(req.body);
    res.json(saved);
  } catch (err) {
    console.error("Errore salvataggio config:", err);
    res.status(400).json({ error: "Configurazione non valida" });
  }
});

router.get("/appointments", checkAuth, async (req, res) => {
  try {
    res.json(await bookingsStore.listAppointments());
  } catch (err) {
    console.error("Errore lettura appuntamenti:", err);
    res.status(500).json({ error: "Impossibile leggere gli appuntamenti" });
  }
});

router.post("/login", (req, res) => {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || req.body.password === expected) {
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false });
});

module.exports = router;
