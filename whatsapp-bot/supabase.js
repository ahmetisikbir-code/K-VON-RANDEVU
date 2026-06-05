import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_publishable_bWlpyQycwdlquuzoNBxNkg_1WiFqaOo';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function getDoctors() {
  const doctorId = process.env.DOCTOR_ID;
  let query = supabase
    .from('doctors')
    .select('*, profile:profiles(*)');
  if (doctorId) {
    query = query.eq('id', doctorId);
  } else {
    query = query.not('whatsapp_number', 'is', null);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getDoctorByPhone(phone) {
  const { data, error } = await supabase
    .from('doctors')
    .select('*, profile:profiles(*)')
    .eq('whatsapp_number', phone)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getPatientByPhone(phone) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAvailableDoctors() {
  const { data, error } = await supabase
    .from('doctors')
    .select('*, profile:profiles(*)');
  if (error) throw error;
  return data;
}

export async function getAvailableSlots(doctorId, date) {
  const { data: slots, error } = await supabase
    .from('availability')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('date', date)
    .eq('is_booked', false)
    .order('start_time');
  if (error) throw error;

  const { data: appointments } = await supabase
    .from('appointments')
    .select('time')
    .eq('doctor_id', doctorId)
    .eq('date', date)
    .neq('status', 'cancelled');

  const bookedTimes = new Set((appointments || []).map(a => a.time));
  return (slots || []).filter(s => !bookedTimes.has(s.start_time));
}

export async function getAvailableDates(doctorId) {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('availability')
    .select('date')
    .eq('doctor_id', doctorId)
    .eq('is_booked', false)
    .gte('date', today)
    .order('date');
  if (error) throw error;
  const dates = [...new Set(data.map(s => s.date))];
  return dates.slice(0, 14);
}

export async function bookSlot(slotId, doctorId, date, time, patientPhone, patientName) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .upsert({
      phone: patientPhone,
      full_name: patientName || 'WhatsApp Hastasi',
      role: 'user'
    }, { onConflict: 'phone', ignoreDuplicates: false })
    .select()
    .maybeSingle();
  if (profileError) throw profileError;

  if (!profile) {
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', patientPhone)
      .maybeSingle();
    if (!existing) {
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          phone: patientPhone,
          full_name: patientName || 'WhatsApp Hastasi',
          role: 'user'
        })
        .select()
        .single();
      if (createError) throw createError;
      profile = newProfile;
    } else {
      profile = existing;
    }
  }

  const { error: bookError } = await supabase
    .from('availability')
    .update({ is_booked: true })
    .eq('id', slotId);
  if (bookError) throw bookError;

  const { data: appointment, error: apptError } = await supabase
    .from('appointments')
    .insert({
      doctor_id: doctorId,
      user_id: profile.id,
      slot_id: slotId,
      date,
      time,
      status: 'confirmed',
      whatsapp_chat_id: patientPhone
    })
    .select()
    .single();
  if (apptError) throw apptError;
  return appointment;
}

export async function getConversation(phone) {
  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .select('*')
    .eq('phone_number', phone)
    .maybeSingle();
  if (error) throw error;
  return data || { phone_number: phone, conversation_state: 'idle', context: {} };
}

export async function saveConversation(phone, state, context) {
  const { error } = await supabase
    .from('whatsapp_sessions')
    .upsert({
      phone_number: phone,
      conversation_state: state,
      context,
      updated_at: new Date().toISOString()
    }, { onConflict: 'phone_number' });
  if (error) throw error;
}

export default supabase;
