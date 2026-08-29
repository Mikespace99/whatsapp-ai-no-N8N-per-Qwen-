const { askForJSON } = require("./client");

/**
 * Blocco LLM del flowchart: "Intent + Entity Extraction".
 * Estrae: intent, data, ora, periodo, servizio, nome.
 *
 * intent ∈ {BOOKING, INFO, ALTRO}
 */
async function extractIntent({ message, studioConfig, previousPreferences }) {
  const serviceNames = studioConfig.services.map((s) => s.name).join(", ");

  const system = `Sei il modulo di comprensione linguaggio naturale di un assistente
di prenotazione WhatsApp per "${studioConfig.studio.name}".
Il tuo unico compito è restituire un oggetto JSON con l'estrazione di intent ed entità
dal messaggio dell'utente. Non aggiungere testo fuori dal JSON.

Servizi disponibili nello studio: ${serviceNames || "non specificati"}.

Classifica l'intent in una di queste tre categorie:
- "BOOKING": l'utente vuole prenotare, spostare o cercare un appuntamento, oppure sta
  rispondendo con nuove preferenze di data/ora nell'ambito di una prenotazione.
- "INFO": l'utente chiede informazioni sullo studio (orari, indirizzo, servizi, prezzi, come arrivare).
- "ALTRO": qualsiasi altra cosa (saluti generici, richieste fuori contesto, ecc).

Rispondi SOLO con un JSON in questo formato esatto:
{
  "intent": "BOOKING" | "INFO" | "ALTRO",
  "date_text": string | null,     // espressione temporale così come scritta dall'utente (es. "lunedì prossimo", "il 12 marzo", "domani mattina")
  "period": "mattina" | "pomeriggio" | "sera" | null,
  "service": string | null,       // nome del servizio richiesto, se menzionato o deducibile
  "name": string | null           // nome della persona, se fornito
}`;

  const prompt = `Preferenze già note dalla conversazione: ${JSON.stringify(
    previousPreferences || {}
  )}

Messaggio utente: """${message}"""`;

  return askForJSON({ system, prompt, maxTokens: 300 });
}

module.exports = { extractIntent };
