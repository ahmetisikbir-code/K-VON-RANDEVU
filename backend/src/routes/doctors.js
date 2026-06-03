import { Router } from 'express';
import supabase from '../lib/supabase.js';
import auth from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { specialty, search } = req.query;

    let query = supabase
      .from('doctors')
      .select('*, profile:profiles(*)');

    if (specialty) {
      query = query.ilike('specialty', `%${specialty}%`);
    }

    if (search) {
      query = query.or(`profile.full_name.ilike.%${search}%,specialty.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('List doctors error:', err);
    return res.status(500).json({ success: false, error: 'Doktorlar alınamadı' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('doctors')
      .select('*, profile:profiles(*)')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ success: false, error: 'Doktor bulunamadı' });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Get doctor error:', err);
    return res.status(500).json({ success: false, error: 'Doktor bilgisi alınamadı' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.id !== id && req.user.profile?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Bu işlem için yetkiniz yok' });
    }

    const { specialty, bio, consultation_fee, license_number, is_active } = req.body;
    const updates = {};
    if (specialty !== undefined) updates.specialty = specialty;
    if (bio !== undefined) updates.bio = bio;
    if (consultation_fee !== undefined) updates.consultation_fee = consultation_fee;
    if (license_number !== undefined) updates.license_number = license_number;
    if (is_active !== undefined) updates.is_active = is_active;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('doctors')
      .update(updates)
      .eq('id', id)
      .select('*, profile:profiles(*)')
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Update doctor error:', err);
    return res.status(500).json({ success: false, error: 'Doktor bilgisi güncellenemedi' });
  }
});

export default router;
