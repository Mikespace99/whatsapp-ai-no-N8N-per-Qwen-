require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('⚠️ Manca SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Recupera appuntamenti (mappatura colonne corretta)
app.get('/api/appointments', async (req, res) => {
  try {
    let query = supabase.from('appointments').select('*');
    
    const { start_date, end_date } = req.query;
    if (start_date) query = query.gte('date', start_date);
    if (end_date) query = query.lte('date', end_date);

    query = query.order('date', { ascending: true }).order('start_time', { ascending: true });

    const { data, error } = await query;

    if (error) throw error;

    // Mappatura dei dati per adattarli al frontend
    const mappedData = (data || []).map(app => ({
      id: app.id,
      date: app.date,
      time: app.start_time, // Mappa start_time in time
      end_time: app.end_time,
      client_name: app.name, // Mappa name in client_name
      service: app.service,
      phone: app.phone,
      status: 'confirmed', // Default status poiché non esiste nel DB
      studio_id: app.studio_id
    }));

    res.json(mappedData);
  } catch (error) {
    console.error('Errore nel recupero appuntamenti:', error);
    res.status(500).json({ error: 'Errore nel recupero dati', details: error.message });
  }
});

// API: Impostazioni (Useremo studio_config per semplicità)
app.get('/api/settings', async (req, res) => {
  try {
    const { data, error } = await supabase.from('studio_config').select('*').eq('studio_id', 'default').single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data?.config || {});
  } catch (error) {
    console.error('Errore settings:', error);
    res.json({}); // Ritorna vuoto se non esiste
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const newConfig = req.body;
    const { data, error } = await supabase
      .from('studio_config')
      .upsert({ studio_id: 'default', config: newConfig, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Errore salvataggio settings:', error);
    res.status(500).json({ error: 'Errore salvataggio' });
  }
});

// Routes Frontend
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/agenda', (req, res) => res.sendFile(path.join(__dirname, 'public', 'agenda.html')));
app.get('/configurazione', (req, res) => res.sendFile(path.join(__dirname, 'public', 'configurazione.html')));
app.get('/statistiche', (req, res) => res.sendFile(path.join(__dirname, 'public', 'statistiche.html')));

app.listen(PORT, () => {
  console.log(`✅ Server attivo sulla porta ${PORT}`);
});
