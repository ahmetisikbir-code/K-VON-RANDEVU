import { Router } from 'express';
import supabase from '../lib/supabase.js';
import auth from '../middleware/auth.js';
import { sendAppointmentConfirmation, notifyDoctor } from '../services/notification.js';

const router = Router();

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { clinic_id } = req.query;
    const userRole = req.user.profile?.role;

    let userDoctorId = null;
    if (userRole === 'doctor') {
      const { data: doctorRecord } = await supabase
        .from('doctors')
        .select('id')
        .eq('profile_id', req.user.id)
        .maybeSingle();
      if (doctorRecord) {
        userDoctorId = doctorRecord.id;
      }
    }

    let query = supabase.from('appointments').select('*, doctor:doctors(*, profile:profiles(*), clinic:clinics(*)), patient:profiles(*)');

    if (userRole !== 'admin') {
      if (userRole === 'doctor') {
        if (userDoctorId) {
          query = query.eq('doctor_id', userDoctorId);
        } else {
          return res.json({ success: true, data: [] });
        }
      } else {
        query = query.eq('patient_id', req.user.id);
      }
    }

    if (clinic_id) {
      const { data: clinicDoctors } = await supabase
        .from('doctors')
        .select('id')
        .eq('clinic_id', clinic_id);

      if (clinicDoctors && clinicDoctors.length > 0) {
        query = query.in('doctor_id', clinicDoctors.map(d => d.id));
      } else {
        return res.json({ success: true, data: [] });
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
    const { doctor_id, clinic_id, appointment_date, appointment_time, notes, patient_name, patient_phone } = req.body;

    if (!appointment_date || !appointment_time) {
      return res.status(400).json({ success: false, error: 'Tarih ve saat gerekli' });
    }

    let actualDoctorId = doctor_id;

    if (!actualDoctorId && clinic_id) {
      const { data: clinicDoctors } = await supabase
        .from('doctors')
        .select('id')
        .eq('clinic_id', clinic_id)
        .limit(1);

      if (clinicDoctors && clinicDoctors.length > 0) {
        actualDoctorId = clinicDoctors[0].id;
      } else {
        return res.status(400).json({ success: false, error: 'Klinikte müsait doktor bulunamadı' });
      }
    }

    if (!actualDoctorId && req.user.profile?.role === 'doctor') {
      const { data: doctorRecord } = await supabase
        .from('doctors')
        .select('id')
        .eq('profile_id', req.user.id)
        .maybeSingle();
      if (doctorRecord) {
        actualDoctorId = doctorRecord.id;
      }
    }

    if (!actualDoctorId) {
      actualDoctorId = req.user.id;
    }

    let resolvedPatientId = null;
    let resolvedPatientName = null;
    let resolvedPatientPhone = null;

    if (patient_name || patient_phone) {
      if (patient_phone) {
        const phoneClean = patient_phone.replace(/[^0-9]/g, '');
        const { data: existingPatient } = await supabase
          .from('patients')
          .select('id, full_name')
          .eq('phone', phoneClean)
          .maybeSingle();

        if (existingPatient) {
          resolvedPatientId = existingPatient.id;
          resolvedPatientName = patient_name || existingPatient.full_name;
          resolvedPatientPhone = phoneClean;
          if (patient_name) {
            const parts = patient_name.split(/\s+/);
            await supabase.from('patients').update({
              full_name: patient_name,
              first_name: parts[0] || null,
              updated_at: new Date().toISOString()
            }).eq('id', existingPatient.id);
          }
        } else {
          const parts = (patient_name || 'Bilinmeyen').split(/\s+/);
          const { data: newPatient, error: createErr } = await supabase
            .from('patients')
            .insert({
              phone: phoneClean,
              full_name: patient_name || 'Bilinmeyen',
              first_name: parts[0] || null
            })
            .select()
            .single();

          if (!createErr && newPatient) {
            resolvedPatientId = newPatient.id;
            resolvedPatientName = patient_name || 'Bilinmeyen';
            resolvedPatientPhone = phoneClean;
          }
        }
      } else {
        resolvedPatientName = patient_name;
      }
    }

    const { data: slot, error: slotError } = await supabase
      .from('availability')
      .select('*')
      .eq('doctor_id', actualDoctorId)
      .eq('date', appointment_date)
      .eq('time', appointment_time)
      .eq('is_booked', false)
      .single();

    if (slotError || !slot) {
      return res.status(409).json({ success: false, error: 'Seçilen zaman dilimi müsait değil' });
    }

    const appointmentData = {
      doctor_id: actualDoctorId,
      appointment_date,
      appointment_time,
      date: appointment_date,
      time: appointment_time,
      notes: notes || '',
      status: 'confirmed',
    };

    if (resolvedPatientId !== null) {
      appointmentData.patient_id = resolvedPatientId;
    } else if (!patient_name && !patient_phone) {
      appointmentData.patient_id = req.user.id;
    }

    if (resolvedPatientName) appointmentData.patient_name = resolvedPatientName;
    if (resolvedPatientPhone) appointmentData.patient_phone = resolvedPatientPhone;

    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .insert([appointmentData])
      .select('*, doctor:doctors(*)')
      .single();

    if (apptError) {
      return res.status(400).json({ success: false, error: apptError.message });
    }

    const { error: bookError } = await supabase
      .from('availability')
      .update({ is_booked: true, booked_by: actualDoctorId })
      .eq('id', slot.id);

    if (bookError) {
      console.error('Failed to mark slot as booked:', bookError);
    }

    if (resolvedPatientPhone) {
      try {
        await sendAppointmentConfirmation(appointment, resolvedPatientPhone);
      } catch (notifError) {
        console.error('Notification error:', notifError);
      }
    }
    try {
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

    let isDoctorForAppointment = false;
    if (userRole === 'doctor') {
      const { data: doctorRecord } = await supabase
        .from('doctors')
        .select('id')
        .eq('profile_id', req.user.id)
        .maybeSingle();
      if (doctorRecord) {
        isDoctorForAppointment = existing.doctor_id === doctorRecord.id;
      }
    }

    if (existing.patient_id !== req.user.id && !isDoctorForAppointment && userRole !== 'admin') {
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

    let isDoctorForAppointment = false;
    if (userRole === 'doctor') {
      const { data: doctorRecord } = await supabase
        .from('doctors')
        .select('id')
        .eq('profile_id', req.user.id)
        .maybeSingle();
      if (doctorRecord) {
        isDoctorForAppointment = existing.doctor_id === doctorRecord.id;
      }
    }

    if (existing.patient_id !== req.user.id && !isDoctorForAppointment && userRole !== 'admin') {
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
