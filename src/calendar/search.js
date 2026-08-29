const rules = require("../rules/engine");
const bookingsStore = require("./bookingsStore");
const { toISODate } = require("../chrono/normalize");

/**
 * Blocco CALENDAR del flowchart: "Calendar Search - usa preferenze disponibili".
 * Cerca slot liberi a partire da una data preferita (o da oggi) fino a
 * config.booking.search_days, applicando il Business Rules Engine ed
 * escludendo gli slot già rifiutati dall'utente in questa conversazione.
 */
async function searchAvailableSlots({ config, preferences, rejectedSlots = [], startFrom }) {
  const searchDays = config.booking.search_days;
  const today = new Date();
  const start = startFrom ? new Date(startFrom) : today;

  const rangeStart = start < today ? today : start;
  const rangeEnd = new Date(start);
  rangeEnd.setDate(rangeEnd.getDate() + searchDays);

  // Un'unica query su tutto l'intervallo, invece di una per ogni giorno.
  const busyRows = await bookingsStore.getBusySlotsInRange(
    toISODate(rangeStart),
    toISODate(rangeEnd)
  );
  const busyByDate = {};
  for (const row of busyRows) {
    if (!busyByDate[row.date]) busyByDate[row.date] = [];
    busyByDate[row.date].push({
      start: rules.timeToMinutes(row.start_time),
      end: rules.timeToMinutes(row.end_time),
    });
  }

  const found = [];

  for (let i = 0; i <= searchDays && found.length < 20; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    if (d < new Date(today.getFullYear(), today.getMonth(), today.getDate())) continue;

    const isoDate = toISODate(d);
    const busy = busyByDate[isoDate] || [];

    const daySlots = rules.generateSlotsForDate({
      config,
      isoDate,
      serviceName: preferences.service,
      period: preferences.period,
      busySlots: busy,
    });

    for (const slot of daySlots) {
      const isRejected = rejectedSlots.some(
        (r) => r.date === slot.date && r.start === slot.start
      );
      if (!isRejected) found.push(slot);
    }
  }

  return rules.sortSlots(found);
}

function labelSlot(slot) {
  const d = new Date(slot.date + "T00:00:00");
  const dayNames = [
    "domenica",
    "lunedì",
    "martedì",
    "mercoledì",
    "giovedì",
    "venerdì",
    "sabato",
  ];
  const dayName = dayNames[d.getDay()];
  const [y, m, day] = slot.date.split("-");
  return `${dayName} ${day}/${m} alle ${slot.start}`;
}

module.exports = { searchAvailableSlots, labelSlot };
