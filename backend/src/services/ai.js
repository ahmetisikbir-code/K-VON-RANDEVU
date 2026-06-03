import OpenAI from 'openai';
import supabase from '../lib/supabase.js';
import { getAvailableSlots, formatSlotsForAI } from './calendar.js';
import { sendAppointmentConfirmation, notifyDoctor } from './notification.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Sen KIVON Randevu Asistanısın. Kullanıcıların WhatsApp üzerinden randevu almasına yardım ediyorsun. Profesyonel, kibar ve yardımsever bir tonda Türkçe konuş. Kullanıcının adını öğrendiğinde kullan.

Yapabileceklerin:
1. Doktorları listeleme
2. Müsait randevu saatlerini gösterme
3. Randevu alma
4. Randevu iptal etme
5. Kullanıcının randevularını gösterme

Kullanıcıya adını sor, sonra ihtiyacını anlamaya çalış. Her adımda net ve kısa bilgi ver.`;

const tools = [
  {
    type: 'function',
    function: {
      name: 'get_doctors',
      description: 'Tüm doktorları listeler',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'Belirli bir doktor için belirli bir tarihteki müsait randevu saatlerini kontrol eder',
      parameters: {
        type: 'object',
        properties: {
          doctor_id: { type: 'string', description: 'Doktor ID' },
          date: { type: 'string', description: 'Tarih (YYYY-MM-DD formatında)' },
        },
        required: ['doctor_id', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_appointment',
      description: 'Randevu oluşturur',
      parameters: {
        type: 'object',
        properties: {
          doctor_id: { type: 'string', description: 'Doktor ID' },
          date: { type: 'string', description: 'Tarih (YYYY-MM-DD)' },
          time: { type: 'string', description: 'Saat (HH:mm formatında)' },
          user_phone: { type: 'string', description: 'Kullanıcı telefon numarası' },
          patient_name: { type: 'string', description: 'Hasta adı' },
        },
        required: ['doctor_id', 'date', 'time', 'user_phone', 'patient_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_appointment',
      description: 'Randevuyu iptal eder',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: { type: 'string', description: 'Randevu ID' },
        },
        required: ['appointment_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_appointments',
      description: 'Kullanıcının tüm randevularını listeler',
      parameters: {
        type: 'object',
        properties: {
          user_phone: { type: 'string', description: 'Kullanıcı telefon numarası' },
        },
        required: ['user_phone'],
      },
    },
  },
];

async function getDoctors() {
  const { data } = await supabase
    .from('doctors')
    .select('*, profile:profiles(full_name, email)');

  if (!data || data.length === 0) {
    return 'Henüz kayıtlı doktor bulunmamaktadır.';
  }

  let result = '👨‍⚕️ Doktorlarımız:\n\n';
  for (const doc of data) {
    result += `🆔 ${doc.id}\n👤 ${doc.profile?.full_name || 'İsimsiz Doktor'}\n🔬 ${doc.specialty || 'Genel'}\n💰 Ücret: ${doc.consultation_fee || '0'} TL\n\n`;
  }
  return result;
}

async function checkAvailability(doctorId, date) {
  const slots = await getAvailableSlots(doctorId, date);
  return formatSlotsForAI(slots);
}

async function bookAppointment(doctorId, date, time, userPhone, patientName) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', userPhone)
    .single();

  let patientId;
  if (!profile) {
    const { data: newProfile } = await supabase
      .from('profiles')
      .insert([
        {
          full_name: patientName,
          phone: userPhone,
          role: 'patient',
        },
      ])
      .select()
      .single();

    if (!newProfile) {
      return 'Randevu oluşturulamadı. Lütfen daha sonra tekrar deneyin.';
    }
    patientId = newProfile.id;
  } else {
    patientId = profile.id;
  }

  const { data: slot, error: slotError } = await supabase
    .from('availability')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('date', date)
    .eq('time', time)
    .eq('is_booked', false)
    .single();

  if (slotError || !slot) {
    return 'Seçilen zaman dilimi artık müsait değil. Lütfen başka bir saat seçin.';
  }

  const { data: appointment, error: apptError } = await supabase
    .from('appointments')
    .insert([
      {
        patient_id: patientId,
        doctor_id: doctorId,
        appointment_date: date,
        appointment_time: time,
        status: 'confirmed',
      },
    ])
    .select('*, doctor:doctors(*, profile:profiles(*)), patient:profiles(*)')
    .single();

  if (apptError) {
    return 'Randevu oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.';
  }

  await supabase
    .from('availability')
    .update({ is_booked: true, booked_by: patientId })
    .eq('id', slot.id);

  try {
    await sendAppointmentConfirmation(appointment, userPhone);
    await notifyDoctor(appointment);
  } catch (e) {
    console.error('Notification error after booking:', e);
  }

  const formattedDate = new Date(date).toLocaleDateString('tr-TR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `✅ Randevunuz başarıyla oluşturuldu!\n\n👤 ${patientName}\n📅 ${formattedDate}\n⏰ ${time.substring(0, 5)}\n\nSize WhatsApp üzerinden onay mesajı gönderdik. Geçmiş olsun! 🙏`;
}

async function cancelAppointment(appointmentId) {
  const { data: appointment, error: fetchError } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointmentId)
    .single();

  if (fetchError || !appointment) {
    return 'Randevu bulunamadı. Lütfen randevu numarasını kontrol edin.';
  }

  await supabase
    .from('availability')
    .update({ is_booked: false, booked_by: null })
    .eq('doctor_id', appointment.doctor_id)
    .eq('date', appointment.appointment_date)
    .eq('time', appointment.appointment_time);

  await supabase.from('appointments').delete().eq('id', appointmentId);

  return '✅ Randevunuz başarıyla iptal edildi. Başka bir randevu almak isterseniz yardımcı olmaktan mutluluk duyarız.';
}

async function getMyAppointments(userPhone) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', userPhone)
    .single();

  if (!profile) {
    return 'Henüz kayıtlı randevunuz bulunmamaktadır.';
  }

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, doctor:doctors(*, profile:profiles(full_name))')
    .eq('patient_id', profile.id)
    .order('appointment_date', { ascending: true });

  if (!appointments || appointments.length === 0) {
    return 'Henüz kayıtlı randevunuz bulunmamaktadır.';
  }

  let result = '📋 Randevularınız:\n\n';
  for (const appt of appointments) {
    const formattedDate = new Date(appt.appointment_date).toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const statusEmoji = appt.status === 'confirmed' ? '✅' : appt.status === 'cancelled' ? '❌' : '⏳';

    result += `${statusEmoji} Randevu #${appt.id}\n👨‍⚕️ ${appt.doctor?.profile?.full_name || 'Doktor'}\n📅 ${formattedDate}\n⏰ ${appt.appointment_time?.substring(0, 5)}\n📌 ${appt.status}\n\n`;
  }
  return result;
}

const functionMap = {
  get_doctors: getDoctors,
  check_availability: async (args) => checkAvailability(args.doctor_id, args.date),
  book_appointment: async (args) => bookAppointment(args.doctor_id, args.date, args.time, args.user_phone, args.patient_name),
  cancel_appointment: async (args) => cancelAppointment(args.appointment_id),
  get_my_appointments: async (args) => getMyAppointments(args.user_phone),
};

export async function processMessage(session, messageText) {
  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    if (session.state !== 'idle' && session.data?.conversationHistory) {
      messages.push(...session.data.conversationHistory);
    }

    messages.push({ role: 'user', content: messageText });

    const response = await openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages,
      tools,
      tool_choice: 'auto',
    });

    const choice = response.choices[0];
    const message = choice.message;

    if (message.tool_calls) {
      messages.push(message);

      for (const toolCall of message.tool_calls) {
        const fnName = toolCall.function.name;
        const fnArgs = JSON.parse(toolCall.function.arguments);
        const fn = functionMap[fnName];

        if (fn) {
          const result = await fn(fnArgs);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result,
          });
        }
      }

      const secondResponse = await openai.chat.completions.create({
        model: 'gpt-4-1106-preview',
        messages,
        temperature: 0.7,
      });

      const text = secondResponse.choices[0].message.content;

      session.state = 'idle';
      session.data = {
        ...session.data,
        conversationHistory: messages.slice(-6),
      };

      return { text, actions: [] };
    }

    const text = message.content;

    session.data = {
      ...session.data,
      conversationHistory: messages.slice(-6),
    };

    return { text, actions: [] };
  } catch (err) {
    console.error('AI processMessage error:', err);
    return {
      text: 'Üzgünüm, bir hata oluştu. Lütfen daha sonra tekrar deneyiniz.',
      actions: [],
    };
  }
}
