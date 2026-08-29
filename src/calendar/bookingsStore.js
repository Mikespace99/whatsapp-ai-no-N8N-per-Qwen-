const { getClient, STUDIO_ID } = require("../supabase/client");

/**
 * Recupera tutti gli appuntamenti confermati in un intervallo di date
 * [startIso, endIso], per limitare le query fatte durante una ricerca
 * (una sola chiamata invece di una per ogni giorno controllato).
 */
async function getBusySlotsInRange(startIso, endIso) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("date, start_time, end_time")
    .eq("studio_id", STUDIO_ID)
    .gte("date", startIso)
    .lte("date", endIso);

  if (error) {
    console.error("Errore nel leggere gli appuntamenti da Supabase:", error);
    return [];
  }
  return data || [];
}

/**
 * Verifica che uno specifico slot sia ancora libero (usato nel passo
 * VERIFY prima di confermare una prenotazione).
 */
async function isSlotFree(slot) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id")
    .eq("studio_id", STUDIO_ID)
    .eq("date", slot.date)
    .eq("start_time", slot.start)
    .limit(1);

  if (error) {
    console.error("Errore nel verificare lo slot su Supabase:", error);
    // In caso di errore è più sicuro considerare lo slot NON libero,
    // per evitare doppie prenotazioni con stato incerto.
    return false;
  }
  return !data || data.length === 0;
}

/**
 * Crea un nuovo appuntamento confermato.
 */
async function createAppointment({ slot, phone, name }) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("appointments")
    .insert({
      studio_id: STUDIO_ID,
      date: slot.date,
      start_time: slot.start,
      end_time: slot.end,
      service: slot.service || null,
      phone,
      name: name || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Errore nel creare l'appuntamento su Supabase:", error);
    throw error;
  }

  return {
    date: data.date,
    start: data.start_time,
    end: data.end_time,
    service: data.service,
    phone: data.phone,
    name: data.name,
    createdAt: data.created_at,
  };
}

/**
 * Lista completa degli appuntamenti (usata dal pannello admin).
 */
async function listAppointments() {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("studio_id", STUDIO_ID)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Errore nel leggere gli appuntamenti da Supabase:", error);
    return [];
  }
  return data || [];
}

module.exports = {
  getBusySlotsInRange,
  isSlotFree,
  createAppointment,
  listAppointments,
};
