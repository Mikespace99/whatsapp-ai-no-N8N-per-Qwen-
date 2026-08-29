const { askForJSON } = require("./client");

/**
 * Blocco INTERPRET del flowchart: "LLM interpreta risposta".
 * Classifica la risposta dell'utente rispetto agli slot proposti in:
 * ACCETTA | RIFIUTA | NUOVE_PREFERENZE
 */
async function interpretReply({ message, proposedSlots }) {
  const slotsList = proposedSlots
    .map((s, i) => `${i + 1}. ${s.label}`)
    .join("\n");

  const system = `Sei il modulo che interpreta la risposta di un paziente dopo che gli
sono stati proposti alcuni slot di appuntamento su WhatsApp. Rispondi SOLO con un JSON,
nessun altro testo.

Formato di risposta:
{
  "choice": "ACCETTA" | "RIFIUTA" | "NUOVE_PREFERENZE",
  "selected_index": number | null,   // indice 1-based dello slot scelto se choice è ACCETTA
  "new_date_text": string | null,    // nuova espressione temporale se choice è NUOVE_PREFERENZE
  "new_period": "mattina" | "pomeriggio" | "sera" | null
}

Regole:
- "ACCETTA" se l'utente conferma o sceglie uno degli slot proposti (per numero, orario o giorno).
- "RIFIUTA" se l'utente dice esplicitamente che nessuno slot va bene, senza fornire nuove preferenze.
- "NUOVE_PREFERENZE" se l'utente rifiuta gli slot proposti ma indica altre preferenze di data/ora/periodo.`;

  const prompt = `Slot proposti:
${slotsList}

Risposta dell'utente: """${message}"""`;

  return askForJSON({ system, prompt, maxTokens: 300 });
}

module.exports = { interpretReply };
