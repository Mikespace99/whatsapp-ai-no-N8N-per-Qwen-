// Implementa il blocco CONVERSATION CONTEXT del flowchart.
// Per semplicità usa uno store in-memory per processo (Map).
// Su Render con più istanze/restart frequenti valuta di sostituirlo
// con Redis: l'interfaccia sotto è già isolata per farlo facilmente.

const STATES = {
  IDLE: "IDLE",
  WAITING_REPLY: "WAITING_REPLY",
  EXPIRED: "EXPIRED",
  DONE: "DONE",
};

const contexts = new Map(); // phone -> context
const timers = new Map(); // phone -> Timeout

function newContext(phone) {
  return {
    phone,
    intent: null,
    state: STATES.IDLE,
    preferences: {}, // { date, time, period, service, name }
    proposed_slots: [],
    rejected_slots: [],
    selected_slot: null,
    proposal_cycle: 0,
    updated_at: new Date().toISOString(),
  };
}

function getContext(phone) {
  if (!contexts.has(phone)) {
    contexts.set(phone, newContext(phone));
  }
  return contexts.get(phone);
}

function updateContext(phone, patch) {
  const ctx = getContext(phone);
  Object.assign(ctx, patch, { updated_at: new Date().toISOString() });
  contexts.set(phone, ctx);
  return ctx;
}

function resetContext(phone) {
  clearReplyTimer(phone);
  contexts.set(phone, newContext(phone));
  return contexts.get(phone);
}

// --- Gestione timer WAIT (10 minuti di default, da CONFIG.reply_timeout) ---

function setReplyTimer(phone, minutes, onExpire) {
  clearReplyTimer(phone);
  const ms = minutes * 60 * 1000;
  const t = setTimeout(() => {
    timers.delete(phone);
    onExpire(phone);
  }, ms);
  timers.set(phone, t);
}

function clearReplyTimer(phone) {
  if (timers.has(phone)) {
    clearTimeout(timers.get(phone));
    timers.delete(phone);
  }
}

module.exports = {
  STATES,
  getContext,
  updateContext,
  resetContext,
  setReplyTimer,
  clearReplyTimer,
};
