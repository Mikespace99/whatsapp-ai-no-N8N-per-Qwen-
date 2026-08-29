const { getClient, STUDIO_ID } = require("../supabase/client");

// Configurazione di default: rispecchia il blocco CONFIG del flowchart
// (search_days, reply_timeout, max_cycles, first_offer_slots) più tutte
// le informazioni che il medico/studio inserisce dalla landing page.
const DEFAULT_CONFIG = {
  studio: {
    name: "Studio Medico",
    address: "",
    phone: "",
    timezone: "Europe/Rome",
  },
  booking: {
    search_days: 30, // entro quanti giorni si può prenotare
    reply_timeout_minutes: 10, // WAIT: timer 10 minuti
    max_cycles: 2, // MAX: numero massimo di cicli di riproposta slot
    first_offer_slots: 3, // OFFER: quanti slot proporre alla volta
  },
  services: [
    { id: "visita-generale", name: "Visita generale", duration_minutes: 30 },
  ],
  opening_hours: {
    // 0 = domenica ... 6 = sabato. Ogni giorno è un array di fasce orarie.
    mon: [{ start: "09:00", end: "13:00" }, { start: "15:00", end: "19:00" }],
    tue: [{ start: "09:00", end: "13:00" }, { start: "15:00", end: "19:00" }],
    wed: [{ start: "09:00", end: "13:00" }],
    thu: [{ start: "09:00", end: "13:00" }, { start: "15:00", end: "19:00" }],
    fri: [{ start: "09:00", end: "13:00" }, { start: "15:00", end: "19:00" }],
    sat: [],
    sun: [],
  },
  exclusions: {
    // date singole chiuse (ferie, festività) in formato YYYY-MM-DD
    dates: [],
  },
  messages: {
    welcome:
      "Ciao! Sono l'assistente di prenotazione di {studio_name}. Dimmi pure quando vorresti prenotare.",
    limit_exceeded:
      "Al momento posso prenotare solo entro {search_days} giorni da oggi. Per date più lontane contatta lo studio allo {studio_phone}.",
    no_slots:
      "Non ho trovato disponibilità compatibili con le tue preferenze. Ti invito a contattare direttamente lo studio allo {studio_phone}.",
    offer_intro: "Ecco le prossime disponibilità:",
    ask_reply: "Rispondi con il numero dello slot che preferisci, oppure dimmi altre preferenze.",
    confirmation:
      "Perfetto, appuntamento confermato per {slot_label}. A presto!",
    expired:
      "Non ho ricevuto risposta entro il tempo previsto, la richiesta è scaduta. Scrivimi di nuovo quando vuoi prenotare.",
    slot_taken: "Quello slot è appena stato occupato, provo a cercarne un altro.",
  },
};

function deepMerge(target, source) {
  for (const key of Object.keys(source || {})) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      target[key] = deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

/**
 * Carica la configurazione dello studio da Supabase (tabella
 * studio_config). Se non esiste ancora una riga per questo studio_id,
 * la crea con i valori di default e la ritorna.
 */
async function loadConfig() {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("studio_config")
    .select("config")
    .eq("studio_id", STUDIO_ID)
    .maybeSingle();

  if (error) {
    console.error("Errore nel leggere la configurazione da Supabase:", error);
    return structuredClone(DEFAULT_CONFIG);
  }

  if (!data) {
    const initial = structuredClone(DEFAULT_CONFIG);
    await saveConfig(initial);
    return initial;
  }

  return deepMerge(structuredClone(DEFAULT_CONFIG), data.config);
}

/**
 * Salva (crea o aggiorna) la configurazione dello studio su Supabase.
 */
async function saveConfig(config) {
  const supabase = getClient();
  const { error } = await supabase.from("studio_config").upsert(
    {
      studio_id: STUDIO_ID,
      config,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "studio_id" }
  );

  if (error) {
    console.error("Errore nel salvare la configurazione su Supabase:", error);
    throw error;
  }

  return config;
}

module.exports = { loadConfig, saveConfig, DEFAULT_CONFIG };
