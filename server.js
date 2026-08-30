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

// API: Recupera appuntamenti
app.get('/api/appointments', async (req, res) => {
  try {
    let query = supabase.from('appointments').select('*');
    const { start_date, end_date } = req.query;
    if (start_date) query = query.gte('date', start_date);
    if (end_date) query = query.lte('date', end_date);
    query = query.order('date', { ascending: true }).order('start_time', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    const mappedData = (data || []).map(app => ({
      ...app,
      time: app.start_time,
      client_name: app.name,
      status: app.status || 'confirmed' 
    }));
    res.json(mappedData);
  } catch (error) {
    console.error('Errore fetch appuntamenti:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Crea nuovo appuntamento
app.post('/api/appointments', async (req, res) => {
  try {
    const { date, time, end_time, client_name, service, phone, status } = req.body;
    
    const newApp = {
      date,
      start_time: time,
      end_time: end_time || time, // Fallback se manca end_time
      name: client_name,
      phone,
      service,
      status: status || 'confirmed',
      studio_id: 'default'
    };

    const { data, error } = await supabase.from('appointments').insert([newApp]).select().single();
    if (error) throw error;
    
    res.json({ ...data, time: data.start_time, client_name: data.name });
  } catch (error) {
    console.error('Errore creazione appuntamento:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Modifica appuntamento esistente
app.patch('/api/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const fieldsToUpdate = {};
    if (updates.date) fieldsToUpdate.date = updates.date;
    if (updates.time) fieldsToUpdate.start_time = updates.time;
    if (updates.end_time) fieldsToUpdate.end_time = updates.end_time;
    if (updates.client_name) fieldsToUpdate.name = updates.client_name;
    if (updates.phone) fieldsToUpdate.phone = updates.phone;
    if (updates.service) fieldsToUpdate.service = updates.service;
    if (updates.status) fieldsToUpdate.status = updates.status;

    const { data, error } = await supabase
      .from('appointments')
      .update(fieldsToUpdate)
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;
    res.json({ ...data, time: data.start_time, client_name: data.name });
  } catch (error) {
    console.error('Errore modifica appuntamento:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Elimina appuntamento (Bonus)
app.delete('/api/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Errore eliminazione:', error);
    res.status(500).json({ error: error.message });
  }
});

// Settings APIs (mantenute)
app.get('/api/settings', async (req, res) => {
  try {
    const { data, error } = await supabase.from('studio_config').select('*').eq('studio_id', 'default').single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data?.config || {});
  } catch (error) { res.json({}); }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { data, error } = await supabase.from('studio_config').upsert({ studio_id: 'default', config: req.body, updated_at: new Date().toISOString() }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Routes Frontend (SPA)
app.get(['/', '/dashboard', '/agenda', '/configurazione', '/statistiche'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server attivo sulla porta ${PORT}`);
});
