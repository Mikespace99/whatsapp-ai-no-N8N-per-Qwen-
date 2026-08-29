// Blocco RULES del flowchart: "Business Rules Engine"
// durata servizio, orari apertura, esclusioni, ordinamento.

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function getServiceDuration(config, serviceName) {
  if (!serviceName) return config.services[0]?.duration_minutes || 30;
  const found = config.services.find(
    (s) => s.name.toLowerCase() === String(serviceName).toLowerCase()
  );
  return found ? found.duration_minutes : config.services[0]?.duration_minutes || 30;
}

function isExcluded(config, isoDate) {
  return config.exclusions.dates.includes(isoDate);
}

function openingWindowsFor(config, isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dayKey = DAY_KEYS[date.getDay()];
  return config.opening_hours[dayKey] || [];
}

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function periodFilter(period) {
  if (period === "mattina") return (mins) => mins < 13 * 60;
  if (period === "pomeriggio") return (mins) => mins >= 13 * 60 && mins < 18 * 60;
  if (period === "sera") return (mins) => mins >= 18 * 60;
  return () => true;
}

/**
 * Genera gli slot candidati per una singola data, applicando:
 * - orari di apertura
 * - durata del servizio
 * - esclusioni (giorni chiusi)
 * - filtro per periodo del giorno (mattina/pomeriggio/sera), se richiesto
 * - slot già occupati (busySlots: array di {start,end} in minuti da mezzanotte)
 */
function generateSlotsForDate({ config, isoDate, serviceName, period, busySlots = [] }) {
  if (isExcluded(config, isoDate)) return [];

  const duration = getServiceDuration(config, serviceName);
  const windows = openingWindowsFor(config, isoDate);
  const filterFn = periodFilter(period);

  const slots = [];
  for (const w of windows) {
    let cursor = timeToMinutes(w.start);
    const end = timeToMinutes(w.end);
    while (cursor + duration <= end) {
      if (filterFn(cursor)) {
        const slotEnd = cursor + duration;
        const overlaps = busySlots.some(
          (b) => cursor < b.end && slotEnd > b.start
        );
        if (!overlaps) {
          slots.push({
            date: isoDate,
            start: minutesToTime(cursor),
            end: minutesToTime(slotEnd),
            service: serviceName || config.services[0]?.name,
          });
        }
      }
      cursor += duration; // slot contigui, non sovrapposti
    }
  }
  return slots;
}

/**
 * Ordinamento: cronologico crescente (i più vicini nel tempo prima).
 */
function sortSlots(slots) {
  return [...slots].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.start < b.start ? -1 : 1;
  });
}

module.exports = {
  getServiceDuration,
  isExcluded,
  openingWindowsFor,
  generateSlotsForDate,
  sortSlots,
  timeToMinutes,
};
