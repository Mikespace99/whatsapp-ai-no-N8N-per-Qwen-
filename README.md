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
  config/store.js            # lettura/scrittura configurazione studio (JSON su Supabase)
  context/store.js           # CONVERSATION CONTEXT + timer dei 10 minuti
  llm/
    intentExtraction.js      # blocco LLM: intent + entità
    interpretReply.js        # blocco INTERPRET: ACCETTA/RIFIUTA/NUOVE_PREFERENZE
  chrono/normalize.js        # blocco CHRONO: normalizzazione date
  rules/engine.js            # Business Rules Engine (orari, durata, esclusioni)
  calendar/
    search.js                # blocco CALENDAR: ricerca slot
    bookingsStore.js         # appuntamenti confermati (Supabase)
  whatsapp/client.js         # invio messaggi via Meta Cloud API (Graph API)
  flow/handler.js            # orchestratore: implementa l'intero flowchart
  supabase/
    client.js                # client Supabase condiviso (service role key)
  routes/
    webhook.js               # GET/POST /webhook/whatsapp (Meta Cloud API)
    admin.js                 # API di configurazione e agenda usate dal pannello
public/
  index.html                 # pannello di configurazione (+ anteprima chat)
  agenda.html                # agenda appuntamenti per il tenant
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
cp .env.example .env   # compila le chiavi (opzionale, su Render usa le Environment Variables)
npm run dev
```

Apri `http://localhost:3000/` per configurare lo studio (password definita in `ADMIN_PASSWORD`, lasciare vuota per accesso libero in sviluppo). Visita `/agenda` per vedere gli appuntamenti.

## Variabili d'ambiente

Tutte le chiavi vanno impostate come variabili d'ambiente. In sviluppo locale puoi usare un file `.env`, mentre su Render le inserisci direttamente nella sezione **Environment** del dashboard. Ecco le variabili richieste:

| Variabile | Descrizione |
|-----------|-------------|
| `SUPABASE_URL` | URL del tuo progetto Supabase (es. `https://xyz.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key di Supabase (la trovi in Settings > API) |
| `STUDIO_ID` | ID dello studio (lascia `default` per singolo tenant) |
| `ADMIN_PASSWORD` | Password per accedere al pannello admin e all'agenda |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone Number ID della WhatsApp Business API |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Business Account ID (opzionale) |
| `WHATSAPP_ACCESS_TOKEN` | Token di accesso permanente per la WhatsApp API |
| `WHATSAPP_VERIFY_TOKEN` | Token segreto per verificare il webhook (sceglilo tu) |
| `OPENAI_API_KEY` | Chiave API OpenAI per l'LLM |
| `PORT` | Porta del server (opzionale, default 3000) |

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
3. Imposta le variabili d'ambiente nella sezione **Environment** del dashboard di Render (vedi tabella sopra per l'elenco completo):
   - `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (obbligatori per salvare configurazione e appuntamenti)
   - `ADMIN_PASSWORD` (password per accedere al pannello)
   - `OPENAI_API_KEY`
   - `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`
4. Una volta online, apri `/` per configurare lo studio, `/agenda` per vedere gli appuntamenti, e collega il webhook Meta all'URL pubblico come descritto sopra.

**Nota importante:** Non serve un file `.env` su Render — tutte le variabili vanno inserite direttamente nella sezione Environment del servizio. Il codice legge automaticamente da `process.env`.

## Note su calendario e LLM

- Il calendario usa **Supabase** (`src/calendar/bookingsStore.js`) per salvare gli appuntamenti in modo persistente. La tabella `appointments` viene creata eseguendo lo script SQL in `supabase/schema.sql` nell'editor SQL di Supabase.
- La configurazione dello studio è salvata nella tabella `studio_config` (sempre su Supabase), quindi sopravvive ai redeploy senza bisogno di dischi persistenti.
- L'estrazione di intent/entità e l'interpretazione delle risposte usano
  l'API OpenAI (`OPENAI_API_KEY`). I prompt forzano una risposta in
  solo JSON per semplificare il parsing.
