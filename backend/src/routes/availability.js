import { Router } from 'express';
import supabase from '../lib/supabase.js';
import auth from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { doctor_id, date, start_date, end_date } = req.query;

    if (!doctor_id) {
      return res.status(400).json({ success: false, error: 'Doktor ID gerekli' });
    }

    let query = supabase
      .from('availability')
      .select('*')
      .eq('doctor_id', doctor_id)
      .eq('is_booked', false)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (date) {
      query = query.eq('date', date);
    }

    if (start_date) {
      query = query.gte('date', start_date);
    }

    if (end_date) {
      query = query.lte('date', end_date);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Get availability error:', err);
    return res.status(500).json({ success: false, error: 'Müsaitlik bilgisi alınamadı' });
  }
});

router.post('/generate', auth, async (req, res) => {
  try {
    const { start_date, end_date } = req.body;

    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, error: 'Başlangıç ve bitiş tarihi gerekli' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (!profile || (profile.role !== 'doctor' && profile.role !== 'admin')) {
      return res.status(403).json({ success: false, error: 'Sadece doktorlar müsaitlik oluşturabilir' });
    }

    const { data: doctor } = await supabase
      .from('doctors')
      .select('id')
      .eq('id', req.user.id)
      .single();

    if (!doctor) {
      return res.status(400).json({ success: false, error: 'Önce doktor kaydı oluşturmalısınız' });
    }

    const { data, error } = await supabase.rpc('generate_availability', {
      p_doctor_id: req.user.id,
      p_start_date: start_date,
      p_end_date: end_date,
    });

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(201).json({ success: true, data });
  } catch (err) {
    console.error('Generate availability error:', err);
    return res.status(500).json({ success: false, error: 'Müsaitlik oluşturulamadı' });
  }
});

export default router;
