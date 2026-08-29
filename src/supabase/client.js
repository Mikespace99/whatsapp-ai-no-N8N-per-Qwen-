const { createClient } = require("@supabase/supabase-js");

let client = null;

/**
 * Client Supabase condiviso, usato solo lato server con la Service Role
 * Key (mai esposta al browser). Bypassa Row Level Security: adatto per
 * un backend fidato come questo.
 */
function getClient() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY mancanti nelle variabili d'ambiente."
      );
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

// ID dello studio corrente. Predisposto per il multi-tenant: in futuro
// potrà variare per richiesta (es. dedotto dal numero WhatsApp Business
// che ha ricevuto il messaggio) invece di essere fisso da env var.
const STUDIO_ID = process.env.STUDIO_ID || "default";

module.exports = { getClient, STUDIO_ID };
