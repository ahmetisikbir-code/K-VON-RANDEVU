import { Router } from 'express';
import supabase from '../lib/supabase.js';
import auth from '../middleware/auth.js';
import { sendAppointmentConfirmation, notifyDoctor } from '../services/notification.js';

const router = Router();

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const userRole = req.user.profile?.role;
    let query = supabase.from('appointments').select('*, doctor:doctors(*), patient:profiles(*)');

    if (userRole !== 'admin') {
      if (userRole === 'doctor') {
        query = query.eq('doctor_id', req.user.id);
      } else {
        query = query.eq('patient_id', req.user.id);
      }
    }

    const { data, error } = await query.order('appointment_date', { ascending: true });

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('List appointments error:', err);
    return res.status(500).json({ success: false, error: 'Randevular alınamadı' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { doctor_id, appointment_date, appointment_time, notes } = req.body;

    if (!doctor_id || !appointment_date || !appointment_time) {
      return res.status(400).json({ success: false, error: 'Doktor, tarih ve saat gerekli' });
    }

    const { data: slot, error: slotError } = await supabase
      .from('availability')
      .select('*')
      .eq('doctor_id', doctor_id)
      .eq('date', appointment_date)
      .eq('time', appointment_time)
      .eq('is_booked', false)
      .single();

    if (slotError || !slot) {
      return res.status(409).json({ success: false, error: 'Seçilen zaman dilimi müsait değil' });
    }

    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .insert([
        {
          patient_id: req.user.id,
          doctor_id,
          appointment_date,
          appointment_time,
          notes: notes || '',
          status: 'confirmed',
        },
      ])
      .select('*, doctor:doctors(*), patient:profiles(*)')
      .single();

    if (apptError) {
      return res.status(400).json({ success: false, error: apptError.message });
    }

    const { error: bookError } = await supabase
      .from('availability')
      .update({ is_booked: true, booked_by: req.user.id })
      .eq('id', slot.id);

    if (bookError) {
      console.error('Failed to mark slot as booked:', bookError);
    }

    try {
      const userPhone = req.user.profile?.phone;
      if (userPhone) {
        await sendAppointmentConfirmation(appointment, userPhone);
      }
      await notifyDoctor(appointment);
    } catch (notifError) {
      console.error('Notification error:', notifError);
    }

    return res.status(201).json({ success: true, data: appointment });
  } catch (err) {
    console.error('Create appointment error:', err);
    return res.status(500).json({ success: false, error: 'Randevu oluşturulamadı' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const userRole = req.user.profile?.role;

    const { data: existing, error: fetchError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ success: false, error: 'Randevu bulunamadı' });
    }

    if (existing.patient_id !== req.user.id && existing.doctor_id !== req.user.id && userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Bu randevuyu güncelleme yetkiniz yok' });
    }

    if (userRole === 'patient' || existing.patient_id === req.user.id) {
      if (status && status !== 'cancelled') {
        return res.status(403).json({ success: false, error: 'Sadece iptal edebilirsiniz' });
      }
    }

    const updates = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    if (status === 'cancelled') {
      await supabase
        .from('availability')
        .update({ is_booked: false, booked_by: null })
        .eq('doctor_id', existing.doctor_id)
        .eq('date', existing.appointment_date)
        .eq('time', existing.appointment_time);
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Update appointment error:', err);
    return res.status(500).json({ success: false, error: 'Randevu güncellenemedi' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.profile?.role;

    const { data: existing, error: fetchError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ success: false, error: 'Randevu bulunamadı' });
    }

    if (existing.patient_id !== req.user.id && existing.doctor_id !== req.user.id && userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Bu randevuyu iptal etme yetkiniz yok' });
    }

    await supabase
      .from('availability')
      .update({ is_booked: false, booked_by: null })
      .eq('doctor_id', existing.doctor_id)
      .eq('date', existing.appointment_date)
      .eq('time', existing.appointment_time);

    const { error } = await supabase.from('appointments').delete().eq('id', id);

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data: { message: 'Randevu iptal edildi' } });
  } catch (err) {
    console.error('Delete appointment error:', err);
    return res.status(500).json({ success: false, error: 'Randevu iptal edilemedi' });
  }
});

export default router;
