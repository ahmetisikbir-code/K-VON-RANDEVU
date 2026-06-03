import supabase from '../lib/supabase.js';

export async function getAvailableSlots(doctorId, date) {
  try {
    const { data, error } = await supabase
      .from('availability')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('date', date)
      .eq('is_booked', false)
      .order('time', { ascending: true });

    if (error) {
      console.error('getAvailableSlots error:', error);
      throw error;
    }

    return data || [];
  } catch (err) {
    console.error('getAvailableSlots error:', err);
    throw err;
  }
}

export async function generateSlots(doctorId, startDate, endDate) {
  try {
    const { data, error } = await supabase.rpc('generate_availability', {
      p_doctor_id: doctorId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) {
      console.error('generateSlots error:', error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error('generateSlots error:', err);
    throw err;
  }
}

export async function isSlotAvailable(doctorId, date, time) {
  try {
    const { data, error } = await supabase
      .from('availability')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('date', date)
      .eq('time', time)
      .eq('is_booked', false)
      .single();

    if (error) {
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('isSlotAvailable error:', err);
    return false;
  }
}

export function formatSlotsForAI(slots) {
  if (!slots || slots.length === 0) {
    return 'Seçilen tarihte müsait randevu bulunmamaktadır.';
  }

  const grouped = {};
  for (const slot of slots) {
    if (!grouped[slot.date]) {
      grouped[slot.date] = [];
    }
    grouped[slot.date].push(slot.time);
  }

  let formatted = 'Müsait randevu saatleri:\n\n';
  for (const [date, times] of Object.entries(grouped)) {
    const formattedDate = new Date(date).toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    formatted += `${formattedDate}:\n`;
    for (const time of times) {
      formatted += `  ⏰ ${time.substring(0, 5)}\n`;
    }
    formatted += '\n';
  }

  return formatted;
}
