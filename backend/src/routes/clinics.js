import { Router } from 'express';
import supabase from '../lib/supabase.js';
import auth from '../middleware/auth.js';

const router = Router();

router.use(auth);

router.get('/my', async (req, res) => {
  try {
    let clinic = null;

    const { data: ownerClinic } = await supabase
      .from('clinics')
      .select('*')
      .eq('owner_id', req.user.id)
      .maybeSingle();

    if (ownerClinic) {
      return res.json({ success: true, data: ownerClinic });
    }

    const { data: doctor } = await supabase
      .from('doctors')
      .select('clinic_id')
      .eq('profile_id', req.user.id)
      .maybeSingle();

    if (doctor?.clinic_id) {
      const { data: doctorClinic } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', doctor.clinic_id)
        .single();

      if (doctorClinic) {
        clinic = doctorClinic;
      }
    }

    if (!clinic) {
      return res.status(404).json({ success: false, error: 'Klinik bulunamadı' });
    }

    return res.json({ success: true, data: clinic });
  } catch (err) {
    console.error('Get my clinic error:', err);
    return res.status(500).json({ success: false, error: 'Klinik bilgisi alınamadı' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: clinic, error: fetchError } = await supabase
      .from('clinics')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (fetchError || !clinic) {
      return res.status(404).json({ success: false, error: 'Klinik bulunamadı' });
    }

    if (clinic.owner_id !== req.user.id && req.user.profile?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Bu işlem için yetkiniz yok' });
    }

    const { name, address, phone, whatsapp_number } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;
    if (whatsapp_number !== undefined) updates.whatsapp_number = whatsapp_number;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('clinics')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Update clinic error:', err);
    return res.status(500).json({ success: false, error: 'Klinik güncellenemedi' });
  }
});

router.get('/:id/doctors', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (clinicError || !clinic) {
      return res.status(404).json({ success: false, error: 'Klinik bulunamadı' });
    }

    const isOwner = clinic.owner_id === req.user.id;
    let isDoctorInClinic = false;

    if (!isOwner && req.user.profile?.role !== 'admin') {
      const { data: doctor } = await supabase
        .from('doctors')
        .select('id')
        .eq('clinic_id', id)
        .eq('profile_id', req.user.id)
        .maybeSingle();
      isDoctorInClinic = !!doctor;
    }

    if (!isOwner && !isDoctorInClinic && req.user.profile?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Bu işlem için yetkiniz yok' });
    }

    const { data, error } = await supabase
      .from('doctors')
      .select('*, profile:profiles(*)')
      .eq('clinic_id', id);

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('List clinic doctors error:', err);
    return res.status(500).json({ success: false, error: 'Doktorlar alınamadı' });
  }
});

export default router;
