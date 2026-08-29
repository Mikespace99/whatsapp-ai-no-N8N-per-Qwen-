# WhatsApp Booking Agent con AI e State Machine

Sistema di prenotazione appuntamenti via WhatsApp con assistente AI, state machine conversazionale e pannello di gestione per studi medici/professionisti.

## Caratteristiche

- **Assistente WhatsApp AI**: Gestisce prenotazioni in linguaggio naturale usando LLM (OpenAI GPT)
- **State Machine Conversazionale**: Flusso strutturato con gestione stati (INFO, BOOKING, WAITING_REPLY, ecc.)
- **Calendario Intelligente**: Generazione slot basata su orari, servizi ed esclusioni configurate
- **Pannello Configurazione**: Interfaccia web per impostare orari, servizi, messaggi e regole
- **Agenda con Calendario**: Visualizzazione appuntamenti con calendario interattivo e modifica orari lavorativi
- **Multi-tenant Ready**: Architettura predisposta per più studi (attualmente singolo tenant)

## Struttura

```
├── server.js                 # Server Express principale
├── public/
│   ├── index.html           # Pannello configurazione
│   └── agenda.html          # Agenda con calendario
├── src/
│   ├── calendar/            # Gestione calendario e slot
│   ├── chrono/              # Normalizzazione date
│   ├── config/              # Store configurazione
│   ├── context/             # Context conversazioni
│   ├── flow/                # State machine handler
│   ├── llm/                 # Client OpenAI e interpretazione
│   ├── routes/              # Route webhook e API admin
│   ├── rules/               # Motore regole
│   ├── supabase/            # Client Supabase
│   └── whatsapp/            # Client WhatsApp API
├── supabase/
│   └── schema.sql           # Schema database
├── render.yaml              # Configurazione deploy Render
└── .env.example             # Template variabili ambiente
```

## Deploy su Render

### 1. Prepara il Database Supabase

1. Crea un progetto su [supabase.com](https://supabase.com)
2. Vai su SQL Editor ed esegui lo script in `supabase/schema.sql`
3. Copia:
   - **Project URL** (Settings > General)
   - **Service Role Key** (Settings > API)

### 2. Configura WhatsApp Business API

1. Crea un'app su [Meta for Developers](https://developers.facebook.com)
2. Aggiungi prodotto WhatsApp
3. Ottieni:
   - **Access Token** (WhatsApp > API Setup)
   - **Phone Number ID** (WhatsApp > API Setup)
   - **Verify Token** (creane uno tu per il webhook)

### 3. Deploy su Render

1. Crea nuovo servizio **Web Service** su [render.com](https://render.com)
2. Connetti il repository GitHub
3. Imposta:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Aggiungi tutte le variabili d'ambiente dalla sezione **Environment**:

| Chiave | Valore |
|--------|--------|
| `PORT` | `3000` |
| `ADMIN_PASSWORD` | La tua password sicura |
| `OPENAI_API_KEY` | `sk-...` (da platform.openai.com) |
| `OPENAI_MODEL` | `gpt-4o-mini` |
| `WHATSAPP_ACCESS_TOKEN` | `EAA...` |
| `WHATSAPP_PHONE_NUMBER_ID` | ID numerico |
| `WHATSAPP_VERIFY_TOKEN` | Il tuo token segreto |
| `SUPABASE_URL` | `https://...supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbG...` |
| `STUDIO_ID` | `default` |

5. Deploy!

### 4. Configura Webhook WhatsApp

1. Nel dashboard Meta WhatsApp, imposta:
   - **Callback URL**: `https://tuioapp.onrender.com/webhook/whatsapp`
   - **Verify Token**: Quello configurato in `WHATSAPP_VERIFY_TOKEN`
2. Sottoscrivi gli eventi: `messages`, `message_template_status_update`

## Utilizzo

### Pannello Configurazione (`/`)

Accedi con la password impostata in `ADMIN_PASSWORD` per:
- Configurare informazioni studio (nome, indirizzo, telefono)
- Definire servizi e durate
- Impostare orari di apertura giornalieri
- Aggiungere esclusioni (ferie, festività)
- Personalizzare messaggi del bot
- Regolare parametri prenotazione (giorni ricercabili, timeout, ecc.)

### Agenda (`/agenda`)

Visualizza e gestisci gli appuntamenti:
- **Tab Calendario**: Vista mensile con indicatori visivi
  - Giorni chiusi (weekend/esclusioni/orari vuoti)
  - Giorni con appuntamenti
  - Click su un giorno per filtrare la lista
  - Pulsante "Modifica Orari Lavorativi" per cambiare giorni/orari
- **Tab Lista Appuntamenti**: Tabella dettagliata con filtri data
  - Statistiche (oggi, settimana, totale)
  - Filtri per intervallo date
  - Dettagli: data, ora, paziente, telefono, servizio

### Flusso WhatsApp

Il bot gestisce tre intenti principali:
1. **INFO**: Risponde con orari, indirizzo e servizi
2. **BOOKING**: Guida l'utente nella prenotazione
3. **ALTRO**: Reindirizza verso INFO o BOOKING

Durante il booking:
- Estrae preferenze (data, periodo, servizio, nome)
- Cerca slot disponibili nel calendario
- Propone fino a N slot (configurabile)
- Attende risposta con timeout
- Conferma o ripropone in base alla scelta

## Troubleshooting

### Il bot non salva appuntamenti su Supabase

1. Verifica che `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` siano corretti in Environment
2. Controlla i log su Render per errori di connessione
3. Assicurati che lo schema SQL sia stato eseguito correttamente
4. Verifica che la tabella `appointments` esista

### Webhook non riceve messaggi

1. Controlla che l'URL callback su Meta sia corretto (https, nessun trailing slash extra)
2. Verifica che `WHATSAPP_VERIFY_TOKEN` corrisponda esattamente
3. Controlla i log Render per richieste in arrivo (`/webhook/whatsapp`)
4. Assicurati che gli eventi `messages` siano sottoscritti

### Errori LLM / OpenAI

1. Verifica che `OPENAI_API_KEY` sia valida e abbia credito
2. Controlla i limiti rate dell'API
3. Vedi i log per errori specifici

## Sviluppo Locale

```bash
# Clona e installa
git clone <repo>
cd whatsapp-booking-agent
npm install

# Crea .env locale
cp .env.example .env
# Modifica .env con le tue chiavi

# Avvia server
npm start

# Accedi a:
# - http://localhost:3000 (configurazione)
# - http://localhost:3000/agenda (agenda)
# - POST http://localhost:3000/webhook/whatsapp (webhook)
```

## Stack Tecnologico

- **Backend**: Node.js, Express
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4o-mini
- **WhatsApp**: Meta Cloud API
- **Frontend**: HTML5, CSS3, Vanilla JS
- **Deploy**: Render

## License

MIT
