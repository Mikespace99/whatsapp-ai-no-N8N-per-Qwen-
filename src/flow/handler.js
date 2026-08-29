const ctxStore = require("../context/store");
const { extractIntent } = require("../llm/intentExtraction");
const { interpretReply } = require("../llm/interpretReply");
const { normalizeDate, daysFromToday } = require("../chrono/normalize");
const { searchAvailableSlots, labelSlot } = require("../calendar/search");
const bookingsStore = require("../calendar/bookingsStore");
const { sendWhatsAppMessage } = require("../whatsapp/client");

function render(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? ""));
}

function baseVars(config) {
  return {
    studio_name: config.studio.name,
    studio_phone: config.studio.phone,
    search_days: config.booking.search_days,
  };
}

/**
 * Entry point: chiamato dal webhook per ogni messaggio WhatsApp ricevuto.
 * Ritorna il testo (o i testi) di risposta da inviare all'utente.
 * Implementa fedelmente il flowchart fornito.
 */
async function processIncomingMessage({ phone, text, config }) {
  // TIME: salva timestamp data e ora messaggio
  const receivedAt = new Date();
  const ctx = ctxStore.getContext(phone);

  // Se siamo in attesa di una risposta a slot proposti, il messaggio in
  // arrivo è la "REPLY" del ramo WAIT -> REPLY -> INTERPRET.
  if (ctx.state === ctxStore.STATES.WAITING_REPLY) {
    ctxStore.clearReplyTimer(phone);
    return handleReplyToOffer({ phone, text, config, ctx, receivedAt });
  }

  // LLM: Intent + Entity Extraction
  let extracted;
  try {
    extracted = await extractIntent({
      message: text,
      studioConfig: config,
      previousPreferences: ctx.preferences,
    });
  } catch (err) {
    console.error("Errore estrazione intent:", err);
    return [
      "Scusa, ho avuto un problema a capire il messaggio. Puoi riformulare?",
    ];
  }

  const intent = extracted.intent;

  if (intent === "INFO") {
    return handleInfo({ config });
  }

  if (intent === "ALTRO") {
    return handleOther();
  }

  // intent === "BOOKING"
  return handleBooking({ phone, config, ctx, extracted, receivedAt });
}

// --- Flusso INFO ---
function handleInfo({ config }) {
  const hoursText = formatOpeningHours(config.opening_hours);
  const servicesText = config.services.map((s) => `- ${s.name} (${s.duration_minutes} min)`).join("\n");
  return [
    `${config.studio.name}\n${config.studio.address || ""}\nTel: ${config.studio.phone || "-"}\n\nOrari:\n${hoursText}\n\nServizi:\n${servicesText}`.trim(),
  ];
}

function formatOpeningHours(oh) {
  const labels = { mon: "Lun", tue: "Mar", wed: "Mer", thu: "Gio", fri: "Ven", sat: "Sab", sun: "Dom" };
  return Object.entries(labels)
    .map(([key, label]) => {
      const windows = oh[key] || [];
      if (!windows.length) return `${label}: chiuso`;
      return `${label}: ${windows.map((w) => `${w.start}-${w.end}`).join(", ")}`;
    })
    .join("\n");
}

// --- Flusso ALTRO ---
function handleOther() {
  return [
    "Posso aiutarti a prenotare un appuntamento o darti informazioni sullo studio. Cosa preferisci?",
  ];
}

// --- Flusso BOOKING (prima richiesta o NUOVE_PREFERENZE) ---
async function handleBooking({ phone, config, ctx, extracted, receivedAt }) {
  // CHRONO: normalizzazione date
  const { date } = normalizeDate(extracted.date_text, receivedAt);

  // UPDATE: aggiorna context con le nuove preferenze rilevate
  const preferences = {
    ...ctx.preferences,
    ...(date ? { date } : {}),
    ...(extracted.period ? { period: extracted.period } : {}),
    ...(extracted.service ? { service: extracted.service } : {}),
    ...(extracted.name ? { name: extracted.name } : {}),
  };
  ctxStore.updateContext(phone, { intent: "BOOKING", preferences });

  // LIMIT: data entro il limite configurato?
  if (date) {
    const diff = daysFromToday(date, receivedAt);
    if (diff > config.booking.search_days) {
      return [render(config.messages.limit_exceeded, baseVars(config))];
    }
  }

  return runCalendarSearchAndOffer({ phone, config, startFrom: preferences.date });
}

// --- CALENDAR -> RULES -> RESULT -> FOUND -> OFFER/NOSLOT ---
async function runCalendarSearchAndOffer({ phone, config, startFrom }) {
  const ctx = ctxStore.getContext(phone);

  const results = await searchAvailableSlots({
    config,
    preferences: ctx.preferences,
    rejectedSlots: ctx.rejected_slots,
    startFrom,
  });

  // RESULT: aggiorna context, salva risultati ricerca
  ctxStore.updateContext(phone, { search_results: results });

  // FOUND?
  if (!results.length) {
    ctxStore.resetContext(phone);
    return [render(config.messages.no_slots, baseVars(config))];
  }

  // OFFER: mostra i primi N slot (first_offer_slots)
  const n = config.booking.first_offer_slots;
  const proposed = results.slice(0, n);
  ctxStore.updateContext(phone, {
    proposed_slots: proposed,
    state: ctxStore.STATES.WAITING_REPLY,
  });

  // WAIT: timer configurato (reply_timeout_minutes)
  ctxStore.setReplyTimer(phone, config.booking.reply_timeout_minutes, (expiredPhone) =>
    handleExpire({ phone: expiredPhone, config })
  );

  const list = proposed
    .map((s, i) => `${i + 1}. ${labelSlot(s)}`)
    .join("\n");

  return [
    `${config.messages.offer_intro}\n${list}\n\n${config.messages.ask_reply}`,
  ];
}

// --- REPLY -> EXPIRE (timeout scaduto, nessuna risposta) ---
async function handleExpire({ phone, config }) {
  const ctx = ctxStore.getContext(phone);
  if (ctx.state !== ctxStore.STATES.WAITING_REPLY) return; // già gestito da una risposta arrivata giusto in tempo

  ctxStore.updateContext(phone, { state: ctxStore.STATES.EXPIRED });
  await sendWhatsAppMessage(phone, render(config.messages.expired, baseVars(config)));
  ctxStore.resetContext(phone);
}

// --- REPLY -> INTERPRET -> CHOICE ---
async function handleReplyToOffer({ phone, text, config, ctx }) {
  let interpretation;
  try {
    interpretation = await interpretReply({ message: text, proposedSlots: ctx.proposed_slots });
  } catch (err) {
    console.error("Errore interpretazione risposta:", err);
    return [
      "Scusa, non ho capito bene la tua risposta. Puoi indicare il numero dello slot o nuove preferenze?",
    ];
  }

  if (interpretation.choice === "ACCETTA") {
    return handleAccept({ phone, config, ctx, interpretation });
  }

  if (interpretation.choice === "RIFIUTA") {
    return handleReject({ phone, config, ctx });
  }

  // NUOVE_PREFERENZE -> torna a CHRONO con le nuove informazioni
  return handleNewPreferences({ phone, config, ctx, interpretation });
}

// --- ACCEPT -> VERIFY -> CREATE/CONFIRM oppure AGAIN ---
async function handleAccept({ phone, config, ctx, interpretation }) {
  const idx = (interpretation.selected_index || 1) - 1;
  const slot = ctx.proposed_slots[idx];

  if (!slot) {
    // indice non valido: richiedi chiarimento restando in attesa
    ctxStore.updateContext(phone, { state: ctxStore.STATES.WAITING_REPLY });
    ctxStore.setReplyTimer(phone, config.booking.reply_timeout_minutes, (p) =>
      handleExpire({ phone: p, config })
    );
    return ["Non ho capito quale slot preferisci: indica il numero (es. 1, 2 o 3)."];
  }

  // VERIFY: slot ancora libero?
  if (await bookingsStore.isSlotFree(slot)) {
    const appointment = await bookingsStore.createAppointment({
      slot,
      phone,
      name: ctx.preferences.name,
    });
    ctxStore.updateContext(phone, {
      selected_slot: appointment,
      state: ctxStore.STATES.DONE,
    });
    const confirmText = render(config.messages.confirmation, {
      ...baseVars(config),
      slot_label: labelSlot(slot),
    });
    ctxStore.resetContext(phone);
    return [confirmText];
  }

  // Slot non più libero -> AGAIN: nuova ricerca escludendo questo slot
  ctxStore.updateContext(phone, {
    rejected_slots: [...ctx.rejected_slots, slot],
  });
  const again = await runCalendarSearchAndOffer({ phone, config, startFrom: ctx.preferences.date });
  return [config.messages.slot_taken, ...again];
}

// --- REJECT -> CYCLE -> MAX -> AGAIN/NOSLOT ---
async function handleReject({ phone, config, ctx }) {
  const newRejected = [...ctx.rejected_slots, ...ctx.proposed_slots];
  const newCycle = ctx.proposal_cycle + 1;

  ctxStore.updateContext(phone, {
    rejected_slots: newRejected,
    proposal_cycle: newCycle,
  });

  if (newCycle >= config.booking.max_cycles) {
    ctxStore.resetContext(phone);
    return [render(config.messages.no_slots, baseVars(config))];
  }

  return runCalendarSearchAndOffer({ phone, config, startFrom: ctx.preferences.date });
}

// --- NUOVE_PREFERENZE -> CHRONO -> UPDATE -> LIMIT -> CALENDAR... ---
async function handleNewPreferences({ phone, config, ctx, interpretation }) {
  const { date } = normalizeDate(interpretation.new_date_text, new Date());
  const preferences = {
    ...ctx.preferences,
    ...(date ? { date } : {}),
    ...(interpretation.new_period ? { period: interpretation.new_period } : {}),
  };

  // Fix: gli slot già proposti in questo giro vanno esclusi dalla nuova
  // ricerca, altrimenti se le nuove preferenze non cambiano a sufficienza
  // il risultato, l'utente si rivede riproposti gli stessi slot.
  const rejected_slots = [...ctx.rejected_slots, ...ctx.proposed_slots];

  ctxStore.updateContext(phone, { preferences, rejected_slots });

  if (date) {
    const diff = daysFromToday(date);
    if (diff > config.booking.search_days) {
      ctxStore.resetContext(phone);
      return [render(config.messages.limit_exceeded, baseVars(config))];
    }
  }

  return runCalendarSearchAndOffer({ phone, config, startFrom: preferences.date });
}

module.exports = { processIncomingMessage };
