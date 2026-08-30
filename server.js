require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurazione Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('⚠️ ATTENZIONE: Manca SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY nelle variabili d\'ambiente!');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API ROUTES ---

// 1. Recupera Appuntamenti (con mappatura colonne Supabase -> Frontend)
app.get('/api/appointments', async (req, res) => {
  try {
    let query = supabase.from('appointments').select('*');
    
    const { start_date, end_date } = req.query;
    if (start_date) query = query.gte('date', start_date);
    if (end_date) query = query.lte('date', end_date);

    // Ordinamento corretto
    query = query.order('date', { ascending: true }).order('start_time', { ascending: true });

    const { data, error } = await query;

    if (error) throw error;

    // Mappatura dati per il frontend
    const mappedData = (data || []).map(app => ({
      id: app.id,
      date: app.date,
      time: app.start_time,       // start_time -> time
      end_time: app.end_time,
      client_name: app.name,      // name -> client_name
      service: app.service,
      phone: app.phone,
      status: 'confirmed',        // Default status (non esiste nel DB)
      studio_id: app.studio_id
    }));

    res.json(mappedData);
  } catch (error) {
    console.error('❌ Errore API appuntamenti:', error.message);
    res.status(500).json({ error: 'Errore nel recupero dati', details: error.message });
  }
});

// 2. Recupera Impostazioni (da studio_config)
app.get('/api/settings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('studio_config')
      .select('*')
      .eq('studio_id', 'default')
      .single();
      
    if (error && error.code !== 'PGRST116') throw error; // Ignora "no rows"
    res.json(data?.config || {});
  } catch (error) {
    console.error('❌ Errore API settings:', error.message);
    res.json({}); 
  }
});

// 3. Salva Impostazioni
app.post('/api/settings', async (req, res) => {
  try {
    const newConfig = req.body;
    const { data, error } = await supabase
      .from('studio_config')
      .upsert({ 
        studio_id: 'default', 
        config: newConfig, 
        updated_at: new Date().toISOString() 
      })
      .select()
      .single();
      
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('❌ Errore salvataggio settings:', error.message);
    res.status(500).json({ error: 'Errore nel salvataggio' });
  }
});

// --- FRONTEND ROUTES (SPA) ---
// Tutte le rotte servono lo stesso file index.html che gestisce la navigazione via JS
const routes = ['/', '/dashboard', '/agenda', '/configurazione', '/statistiche'];
routes.forEach(route => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
});

// Avvio Server
app.listen(PORT, () => {
  console.log(`✅ Server attivo sulla porta ${PORT}`);
  console.log(`🌐 Applicazione accessibile su http://localhost:${PORT}`);
});
