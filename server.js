require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurazione Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Usa la Service Role Key per operazioni admin

if (!supabaseUrl || !supabaseKey) {
  console.error('⚠️ Manca SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY nelle variabili d\'ambiente!');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API ROUTES ---

// Recupera appuntamenti (con filtri opzionali)
app.get('/api/appointments', async (req, res) => {
  try {
    let query = supabase.from('appointments').select('*');
    
    // Filtri opzionali dalla query string
    const { start_date, end_date, status } = req.query;
    
    if (start_date) query = query.gte('date', start_date);
    if (end_date) query = query.lte('date', end_date);
    if (status) query = query.eq('status', status);

    query = query.order('date', { ascending: true }).order('time', { ascending: true });

    const { data, error } = await query;

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Errore nel recupero appuntamenti:', error);
    res.status(500).json({ error: 'Errore nel recupero dati' });
  }
});

// Recupera impostazioni (orari lavorativi)
app.get('/api/settings', async (req, res) => {
  try {
    const { data, error } = await supabase.from('settings').select('*').single();
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows found
    
    res.json(data || { working_hours: {} });
  } catch (error) {
    console.error('Errore nel recupero impostazioni:', error);
    res.status(500).json({ error: 'Errore nel recupero impostazioni' });
  }
});

// Aggiorna impostazioni
app.post('/api/settings', async (req, res) => {
  try {
    const newSettings = req.body;
    // Assumiamo che ci sia una sola riga di impostazioni con id=1 o usiamo upsert
    const { data, error } = await supabase
      .from('settings')
      .upsert({ id: 1, ...newSettings }) // Sovrascrive se esiste, crea se no
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Errore salvataggio impostazioni:', error);
    res.status(500).json({ error: 'Errore nel salvataggio' });
  }
});

// Crea nuovo appuntamento (usato dal bot o manualmente)
app.post('/api/appointments', async (req, res) => {
  try {
    const appointment = req.body;
    const { data, error } = await supabase
      .from('appointments')
      .insert([appointment])
      .select()
      .single();
      
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Errore creazione appuntamento:', error);
    res.status(500).json({ error: 'Errore nella creazione' });
  }
});

// --- FRONTEND ROUTES ---

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/agenda', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'agenda.html'));
});

app.get('/configurazione', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'configurazione.html'));
});

app.get('/statistiche', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'statistiche.html'));
});

// Avvio server
app.listen(PORT, () => {
  console.log(`✅ Server attivo sulla porta ${PORT}`);
  console.log(`🌐 Dashboard: http://localhost:${PORT}/dashboard`);
});
