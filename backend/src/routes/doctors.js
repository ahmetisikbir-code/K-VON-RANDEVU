import { Router } from 'express';
import supabase from '../lib/supabase.js';
import auth from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { specialty, search, clinic_id } = req.query;

    let query = supabase
      .from('doctors')
      .select('*, profile:profiles(*), clinic:clinics(*)');

    if (specialty) {
      query = query.ilike('specialty', `%${specialty}%`);
    }

    if (search) {
      query = query.or(`profile.full_name.ilike.%${search}%,specialty.ilike.%${search}%`);
    }

    if (clinic_id) {
      query = query.eq('clinic_id', clinic_id);
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
      .select('*, profile:profiles(*), clinic:clinics(*)')
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

router.post('/', auth, async (req, res) => {
  try {
    const { clinic_id, full_name, specialty, working_hours, services, holidays, address, phone, avatar_url, whatsapp_number, break_start, break_end, gender } = req.body;

    if (!clinic_id || !full_name) {
      return res.status(400).json({ success: false, error: 'Klinik ve doktor adı gerekli' });
    }

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('owner_id')
      .eq('id', clinic_id)
      .single();

    if (clinicError || !clinic) {
      return res.status(404).json({ success: false, error: 'Klinik bulunamadı' });
    }

    if (clinic.owner_id !== req.user.id && req.user.profile?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Bu klinikte doktor ekleme yetkiniz yok' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert([{ full_name, role: 'doctor' }])
      .select()
      .single();

    if (profileError) {
      return res.status(400).json({ success: false, error: profileError.message });
    }

    const doctorData = {
      profile_id: profile.id,
      clinic_id,
    };
    if (specialty !== undefined) doctorData.specialty = specialty;
    if (working_hours !== undefined) doctorData.working_hours = working_hours;
    if (services !== undefined) doctorData.services = services;
    if (holidays !== undefined) doctorData.holidays = holidays;
    if (address !== undefined) doctorData.address = address;
    if (phone !== undefined) doctorData.phone = phone;
    if (avatar_url !== undefined) doctorData.avatar_url = avatar_url;
    if (whatsapp_number !== undefined) doctorData.whatsapp_number = whatsapp_number;
    if (break_start !== undefined) doctorData.break_start = break_start;
    if (break_end !== undefined) doctorData.break_end = break_end;
    if (gender !== undefined) doctorData.gender = gender;

    const { data, error } = await supabase
      .from('doctors')
      .insert([doctorData])
      .select('*, profile:profiles(*), clinic:clinics(*)')
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(201).json({ success: true, data });
  } catch (err) {
    console.error('Create doctor error:', err);
    return res.status(500).json({ success: false, error: 'Doktor kaydı oluşturulamadı' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: doctor, error: fetchError } = await supabase
      .from('doctors')
      .select('profile_id, clinic_id')
      .eq('id', id)
      .single();

    if (fetchError || !doctor) {
      return res.status(404).json({ success: false, error: 'Doktor bulunamadı' });
    }

    const isDoctorSelf = doctor.profile_id === req.user.id;

    let isClinicOwner = false;
    if (doctor.clinic_id) {
      const { data: clinic } = await supabase
        .from('clinics')
        .select('owner_id')
        .eq('id', doctor.clinic_id)
        .single();
      isClinicOwner = clinic?.owner_id === req.user.id;
    }

    if (!isDoctorSelf && !isClinicOwner && req.user.profile?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Bu işlem için yetkiniz yok' });
    }

    const { specialty, working_hours, services, holidays, address, phone, avatar_url, whatsapp_number, break_start, break_end, gender, bio, consultation_fee, license_number, is_active } = req.body;
    const updates = {};
    if (specialty !== undefined) updates.specialty = specialty;
    if (working_hours !== undefined) updates.working_hours = working_hours;
    if (services !== undefined) updates.services = services;
    if (holidays !== undefined) updates.holidays = holidays;
    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (whatsapp_number !== undefined) updates.whatsapp_number = whatsapp_number;
    if (break_start !== undefined) updates.break_start = break_start;
    if (break_end !== undefined) updates.break_end = break_end;
    if (gender !== undefined) updates.gender = gender;
    if (bio !== undefined) updates.bio = bio;
    if (consultation_fee !== undefined) updates.consultation_fee = consultation_fee;
    if (license_number !== undefined) updates.license_number = license_number;
    if (is_active !== undefined) updates.is_active = is_active;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('doctors')
      .update(updates)
      .eq('id', id)
      .select('*, profile:profiles(*), clinic:clinics(*)')
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

router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: doctor, error: fetchError } = await supabase
      .from('doctors')
      .select('profile_id, clinic_id')
      .eq('id', id)
      .single();

    if (fetchError || !doctor) {
      return res.status(404).json({ success: false, error: 'Doktor bulunamadı' });
    }

    let isClinicOwner = false;
    if (doctor.clinic_id) {
      const { data: clinic } = await supabase
        .from('clinics')
        .select('owner_id')
        .eq('id', doctor.clinic_id)
        .single();
      isClinicOwner = clinic?.owner_id === req.user.id;
    }

    if (!isClinicOwner && req.user.profile?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Bu işlem için yetkiniz yok' });
    }

    const { error } = await supabase.from('doctors').delete().eq('id', id);

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data: { message: 'Doktor silindi' } });
  } catch (err) {
    console.error('Delete doctor error:', err);
    return res.status(500).json({ success: false, error: 'Doktor silinemedi' });
  }
});

export default router;
