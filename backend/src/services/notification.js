import { sendMessage, sendTemplate } from './whatsapp.js';
import supabase from '../lib/supabase.js';

export async function sendAppointmentConfirmation(appointment, userPhone) {
  try {
    const formattedDate = new Date(appointment.appointment_date).toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const doctorName = appointment.doctor?.profile?.full_name || 'Doktor';
    const time = appointment.appointment_time?.substring(0, 5) || '';

    const message = `✅ Randevunuz Onaylandı!\n\n🏥 KIVON Randevu\n👨‍⚕️ Doktor: ${doctorName}\n📅 Tarih: ${formattedDate}\n⏰ Saat: ${time}\n🆔 Randevu No: ${appointment.id}\n\nRandevunuzdan 24 saat önce hatırlatma mesajı göndereceğiz.\nGeçmiş olsun! 🙏`;

    await sendMessage(userPhone, message);
  } catch (err) {
    console.error('sendAppointmentConfirmation error:', err);
    throw err;
  }
}

export async function sendAppointmentReminder(appointment) {
  try {
    const { data: patient } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', appointment.patient_id)
      .single();

    if (!patient?.phone) {
      console.warn('No phone number for patient:', appointment.patient_id);
      return;
    }

    const { data: doctor } = await supabase
      .from('doctors')
      .select('*, profile:profiles(*)')
      .eq('id', appointment.doctor_id)
      .single();

    const formattedDate = new Date(appointment.appointment_date).toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const doctorName = doctor?.profile?.full_name || 'Doktor';
    const time = appointment.appointment_time?.substring(0, 5) || '';

    const message = `🔔 Hatırlatma: Yarın randevunuz var!\n\n🏥 KIVON Randevu\n👨‍⚕️ Doktor: ${doctorName}\n📅 Tarih: ${formattedDate}\n⏰ Saat: ${time}\n\nLütfen zamanında gelmeyi unutmayın.`;

    await sendMessage(patient.phone, message);
  } catch (err) {
    console.error('sendAppointmentReminder error:', err);
  }
}

export async function notifyDoctor(appointment) {
  try {
    const { data: doctor } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', appointment.doctor_id)
      .single();

    if (!doctor?.phone) {
      console.warn('No phone number for doctor:', appointment.doctor_id);
      return;
    }

    const { data: patient } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', appointment.patient_id)
      .single();

    const formattedDate = new Date(appointment.appointment_date).toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const patientName = patient?.full_name || 'Hasta';
    const time = appointment.appointment_time?.substring(0, 5) || '';

    const message = `📋 Yeni Randevu Kaydı\n\n🏥 KIVON Randevu\n👤 Hasta: ${patientName}\n📅 Tarih: ${formattedDate}\n⏰ Saat: ${time}\n📝 Not: ${appointment.notes || 'Yok'}\n\nRandevuyu yönetmek için uygulamayı kullanabilirsiniz.`;

    await sendMessage(doctor.phone, message);
  } catch (err) {
    console.error('notifyDoctor error:', err);
  }
}
