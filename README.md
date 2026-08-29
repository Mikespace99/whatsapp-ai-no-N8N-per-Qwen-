# Agente di prenotazione WhatsApp

Applicazione Node.js/Express che implementa il flusso conversazionale del
diagramma fornito: un paziente scrive su WhatsApp, un LLM estrae
intent/entità, il sistema cerca disponibilità nel calendario dello studio
applicando le regole configurate, propone i primi slot e gestisce
accettazione, rifiuto o nuove preferenze — con timeout e cicli massimi.

Include una **landing page di configurazione** (`/admin`, alias `/`) dove il
medico/lo studio inserisce le proprie indicazioni — orari, servizi,
esclusioni, regole di prenotazione, testi dei messaggi — con un'anteprima
live di come risponderà il bot.

## Struttura

```
server.js                    # entry point Express
src/
  config/store.js            # lettura/scrittura configurazione studio (JSON)
  context/store.js           # CONVERSATION CONTEXT + timer dei 10 minuti
  llm/
    intentExtraction.js      # blocco LLM: intent + entità
    interpretReply.js        # blocco INTERPRET: ACCETTA/RIFIUTA/NUOVE_PREFERENZE
  chrono/normalize.js        # blocco CHRONO: normalizzazione date
  rules/engine.js            # Business Rules Engine (orari, durata, esclusioni)
  calendar/
    search.js                # blocco CALENDAR: ricerca slot
    bookingsStore.js         # appuntamenti confermati (in-memory)
  whatsapp/client.js         # invio messaggi via Meta Cloud API (Graph API)
  flow/handler.js            # orchestratore: implementa l'intero flowchart
  routes/
    webhook.js                # GET/POST /webhook/whatsapp (Meta Cloud API)
    admin.js                  # API di configurazione usate dalla landing page
public/index.html            # landing page di configurazione (+ anteprima chat)
```

## Come funziona il flusso (mappatura sul diagramma)

1. **MSG/TIME** → il webhook riceve il messaggio Twilio con timestamp.
2. **LLM** → `extractIntent` classifica `BOOKING | INFO | ALTRO` ed estrae
   data, ora, periodo, servizio, nome.
3. **INFO/ALTRO** → risposte dirette basate sulla configurazione dello studio.
4. **BOOKING** → `CHRONO` normalizza la data (`chrono-node`), il contesto
   viene aggiornato, si verifica il **LIMIT** (`search_days`).
5. **CALENDAR + RULES** → `searchAvailableSlots` genera gli slot liberi
   rispettando orari di apertura, durata servizio, esclusioni ed escludendo
   gli slot già rifiutati.
6. **FOUND** → se non ci sono slot, invito a contattare lo studio; altrimenti
   **OFFER** dei primi `first_offer_slots` e stato `WAITING_REPLY` con timer
   `reply_timeout_minutes`.
7. **REPLY/INTERPRET/CHOICE** → alla risposta (o allo scadere del timer),
   `interpretReply` classifica `ACCETTA | RIFIUTA | NUOVE_PREFERENZE`:
   - `ACCETTA` → **VERIFY** disponibilità → **CREATE** appuntamento e
     **CONFIRM**, oppure nuova ricerca se lo slot è appena stato occupato.
   - `RIFIUTA` → slot salvati come rifiutati, **CYCLE** incrementato,
     controllo **MAX** cicli, poi nuova ricerca o messaggio di chiusura.
   - `NUOVE_PREFERENZE` → si torna a `CHRONO` con le nuove preferenze.

## Configurazione locale

```bash
npm install
cp .env.example .env   # compila le chiavi
npm run dev
```

Apri `http://localhost:3000/admin` per configurare lo studio (password
definita in `ADMIN_PASSWORD`, lasciare vuota per accesso libero in sviluppo).

## Collegare WhatsApp (Meta Cloud API)

Nessun intermediario: il bot parla direttamente con la WhatsApp Business
Platform di Meta.

1. Crea un'app su [developers.facebook.com](https://developers.facebook.com/apps)
   e aggiungi il prodotto **WhatsApp**.
2. Nella sezione WhatsApp > API Setup trovi un **numero di test** già pronto
   (per iniziare subito) e il suo **Phone Number ID**: valorizza
   `WHATSAPP_PHONE_NUMBER_ID`. Genera un **token di accesso** (temporaneo per
   i test, permanente creando un System User in Business Manager per la
   produzione): valorizza `WHATSAPP_TOKEN`.
3. Scegli tu una stringa segreta a piacere per `WHATSAPP_VERIFY_TOKEN`.
4. Fai il deploy (vedi sotto), poi in **WhatsApp > Configuration** imposta:
   - **Callback URL**: `https://<tuo-dominio-render>/webhook/whatsapp`
   - **Verify token**: lo stesso valore di `WHATSAPP_VERIFY_TOKEN`
   Meta chiama questa URL in GET per verificarla: il server risponde in
   automatico se i due token coincidono.
5. In **Webhook fields**, iscriviti al campo `messages`.
6. Per uscire dal numero di test e usare il tuo numero business reale,
   completa la verifica dell'azienda in Meta Business Manager e aggiungi il
   numero in WhatsApp > API Setup.

Nota: con il numero di test, Meta consente di scrivere solo a numeri
aggiunti manualmente come destinatari "Allowed" nella dashboard, finché non
verifichi l'azienda.

## Deploy su Render

1. Carica questo repository su GitHub.
2. Su Render: **New → Blueprint**, seleziona il repo (usa `render.yaml`)
   oppure crea manualmente un **Web Service**:
   - Build command: `npm install`
   - Start command: `npm start`
3. Imposta le variabili d'ambiente (`ADMIN_PASSWORD`, `OPENAI_API_KEY`,
   `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`).
4. Se vuoi che la configurazione dello studio sopravviva ai redeploy,
   aggiungi un **Persistent Disk** montato sul percorso indicato da
   `DATA_DIR` (il blueprint `render.yaml` lo fa già).
5. Una volta online, apri `/admin`, configura lo studio e collega il webhook
   Meta all'URL pubblico come descritto sopra.

## Note su calendario e LLM

- Il calendario è in-memory (`src/calendar/bookingsStore.js`): utile per
  provare il flusso end-to-end. Per un uso reale, sostituiscilo con Google
  Calendar o il gestionale dello studio, mantenendo la stessa interfaccia
  (`getBusySlotsForDate`, `isSlotFree`, `createAppointment`).
- L'estrazione di intent/entità e l'interpretazione delle risposte usano
  l'API OpenAI (`OPENAI_API_KEY`). I prompt forzano una risposta in
  solo JSON per semplificare il parsing.
