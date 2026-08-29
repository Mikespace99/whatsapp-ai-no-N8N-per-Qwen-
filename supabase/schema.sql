-- Esegui questo script nell'SQL Editor di Supabase (Project > SQL Editor > New query).
-- Crea le due tabelle usate dal bot: configurazione studio e appuntamenti.
-- studio_id è già presente per predisporre il sistema al multi-tenant:
-- per ora resta sempre "default", in futuro basterà usare ID diversi per studio.

create extension if not exists "pgcrypto";

-- Configurazione dello studio (orari, servizi, esclusioni, messaggi, regole).
-- Una riga per studio: tutta la configurazione vive nel campo jsonb "config",
-- così puoi aggiungere nuovi campi in futuro senza modificare lo schema.
create table if not exists studio_config (
  studio_id  text primary key default 'default',
  config     jsonb not null,
  updated_at timestamptz not null default now()
);

-- Appuntamenti confermati (il "calendario"): una riga per prenotazione.
create table if not exists appointments (
  id         uuid primary key default gen_random_uuid(),
  studio_id  text not null default 'default',
  date       date not null,        -- es. 2026-07-31
  start_time text not null,        -- es. "09:30"
  end_time   text not null,        -- es. "10:00"
  service    text,
  phone      text not null,
  name       text,
  created_at timestamptz not null default now()
);

create index if not exists idx_appointments_studio_date
  on appointments (studio_id, date);

-- Nota sulla sicurezza: il bot usa la Service Role Key lato server (mai
-- esposta al client), quindi Row Level Security può restare disattivata
-- su queste tabelle. Se in futuro esponi letture dirette dal browser,
-- attiva RLS e crea policy dedicate.
