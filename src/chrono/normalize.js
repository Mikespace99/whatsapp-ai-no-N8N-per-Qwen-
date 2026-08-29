const chrono = require("chrono-node");

/**
 * Blocco CHRONO del flowchart: normalizza il testo temporale estratto
 * dall'LLM (date_text) in una data assoluta, usando l'ora del messaggio
 * come riferimento.
 *
 * Ritorna { date: "YYYY-MM-DD" | null, raw: parsedResult | null }
 */
function normalizeDate(dateText, referenceDate = new Date()) {
  if (!dateText) return { date: null, raw: null };

  const results = chrono.it.parse(dateText, referenceDate, { forwardDate: true });
  if (!results.length) {
    // fallback al parser inglese generico, utile per formati numerici tipo 12/03
    const fallback = chrono.parse(dateText, referenceDate, { forwardDate: true });
    if (!fallback.length) return { date: null, raw: null };
    const d = fallback[0].start.date();
    return { date: toISODate(d), raw: fallback[0] };
  }

  const d = results[0].start.date();
  return { date: toISODate(d), raw: results[0] };
}

function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function daysFromToday(isoDate, today = new Date()) {
  const d1 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, day] = isoDate.split("-").map(Number);
  const d2 = new Date(y, m - 1, day);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

module.exports = { normalizeDate, daysFromToday, toISODate };
