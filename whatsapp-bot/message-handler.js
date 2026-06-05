import supabase from './supabase.js';
import fs from 'fs';

const LOG_FILE = 'C:/Users/ahmet/AppData/Local/Temp/opencode/bot-log.txt';
const log = (msg) => { const t = new Date().toISOString(); const line = `[${t}] ${msg}\n`; try { fs.appendFileSync(LOG_FILE, line); } catch(e) {} };

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const INTENT = { GREETING: 'greeting', BOOK: 'book', CANCEL: 'cancel', INFO: 'info', OTHER: 'other' };

const GREETING_PHRASES = ['merhaba', 'selam', 'slm', 'mrb', 'hey', 'günaydın', 'gunaydin', 'tünaydın', 'tunaydin', 'iyi günler', 'iyi gunler', 'iyi akşamlar', 'iyi aksamlar', 'kolay gelsin', 'selamün aleyküm', 'selamun aleykum', 'sa'];
const BOOKING_TRIGGERS = ['randevu', 'rezervasyon', 'kayıt', 'kayit', 'sıra', 'sira', 'gün', 'gun', 'tarih', 'saat', 'yarın', 'yarin', 'bugün', 'bugun'];
const CANCEL_TRIGGERS = ['iptal', 'sil', 'kaldır', 'kaldir', 'geçersiz', 'gecersiz', 'ertele'];
const INFO_TRIGGERS = ['adres', 'saatler', 'çalışma', 'calisma', 'fiyat', 'hizmet', 'iletişim', 'iletisim', 'nerede', 'telefon', 'ulaşım', 'ulasim'];

function detectIntent(text) {
  const lower = text.toLowerCase().trim();

  const hasBooking = BOOKING_TRIGGERS.some(kw => lower.includes(kw));
  const hasCancel = CANCEL_TRIGGERS.some(kw => lower.includes(kw));
  const hasInfo = INFO_TRIGGERS.some(kw => lower.includes(kw));

  if (hasBooking) return INTENT.BOOK;
  if (hasCancel) return INTENT.CANCEL;
  if (hasInfo) return INTENT.INFO;

  const words = lower.split(/\s+/).filter(w => w.length > 0);
  const hasGreeting = GREETING_PHRASES.some(g => lower === g || lower.startsWith(g + ' ') || lower.endsWith(' ' + g) || lower.includes(' ' + g + ' '));
  if (hasGreeting && words.length <= 4) return INTENT.GREETING;

  return INTENT.OTHER;
}

function parseRelativeDate(text) {
  const lower = text.toLowerCase().trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (lower === 'bugün' || lower === 'bugun') return new Date(today);
  if (lower.includes('yarın') || lower.includes('yarin')) {
    const d = new Date(today); d.setDate(d.getDate() + 1); return d;
  }
  if (lower.includes('öbür gün') || lower.includes('obur gun')) {
    const d = new Date(today); d.setDate(d.getDate() + 2); return d;
  }

  const gunMap = { 'pazartesi': 1, 'salı': 2, 'sali': 2, 'çarşamba': 3, 'carsamba': 3, 'perşembe': 4, 'persembe': 4, 'cuma': 5, 'cumartesi': 6, 'pazar': 7 };
  for (const [gun, targetDay] of Object.entries(gunMap)) {
    if (lower.includes(gun)) {
      const diff = (targetDay - today.getDay() + 7) % 7 || 7;
      const d = new Date(today); d.setDate(d.getDate() + diff); return d;
    }
  }

  const matchGun = lower.match(/(\d+)\s*g[uü]n\s*sonra/);
  if (matchGun) { const d = new Date(today); d.setDate(d.getDate() + parseInt(matchGun[1])); return d; }

  const matchHafta = lower.match(/(\d+)\s*hafta\s*sonra/);
  if (matchHafta) { const d = new Date(today); d.setDate(d.getDate() + parseInt(matchHafta[1]) * 7); return d; }

  return null;
}

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseExplicitDate(text) {
  const m = text.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    let y = m[3]; if (y.length === 2) y = '20' + y;
    const d = new Date(parseInt(y), parseInt(m[2]) - 1, parseInt(m[1]));
    if (!isNaN(d.getTime())) return d;
  }
  const isom = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isom) {
    const d = new Date(parseInt(isom[1]), parseInt(isom[2]) - 1, parseInt(isom[3]));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function parseTimeFromText(text) {
  const hm = text.match(/(\d{1,2}):(\d{2})/);
  if (hm) {
    const h = parseInt(hm[1]), m = parseInt(hm[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  const hr = text.match(/(?:saat\s*)(\d{1,2})/i);
  if (hr) {
    const h = parseInt(hr[1]);
    if (h >= 8 && h <= 22) return `${String(h).padStart(2,'0')}:00`;
  }
  return null;
}

function extractDateFromText(text) {
  const explicit = parseExplicitDate(text);
  if (explicit) return toLocalDateStr(explicit);
  const relative = parseRelativeDate(text);
  if (relative) return toLocalDateStr(relative);
  return null;
}

function extractTimeFromText(text) {
  return parseTimeFromText(text);
}

function buildSystemPrompt(doctor) {
  const businessName = doctor?.profile?.full_name || 'İşletme';
  const sector = doctor?.sector || doctor?.specialty || 'genel';
  let info = `İşletme: ${businessName}\nSektör: ${sector}`;
  if (doctor?.working_hours) info += `\nÇalışma saatleri: ${doctor.working_hours}`;
  if (doctor?.address) info += `\nAdres: ${doctor.address}`;
  if (doctor?.services) info += `\nHizmetler: ${doctor.services}`;
  if (doctor?.phone) info += `\nTelefon: ${doctor.phone}`;

  return `Sen ${businessName} için profesyonel bir dijital asistansın.

İşletme bilgileri:
${info}

Görevin: Kullanıcının sorularını nazik ve profesyonel bir şekilde yanıtlamak.

Kurallar:
- Kullanıcıya doğal ve samimi Türkçe ile yanıt ver
- Kısa ve öz cevaplar ver (en fazla 2-3 cümle)
- Kullanıcı randevu almak istiyorsa randevu için yönlendir
- Fiyat bilgisi isterse: "Fiyat bilgisi için işletmemizle iletişime geçebilirsiniz" de
- Telefon numarası isteme, zorlama
- Samimi ve yardımsever ol
- İşletme hakkında bilinmeyen bir şey sorulursa: "Bu konuda size yardımcı olamıyorum. Randevu veya hizmetlerimiz hakkında bilgi almak ister misiniz?" de`;
}

async function callGroqForReply(messages, doctor) {
  if (!GROQ_API_KEY) return 'Sistem yapılandırılmamış.';
  try {
    const systemMsg = { role: 'system', content: buildSystemPrompt(doctor) };
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: GROQ_MODEL, messages: [systemMsg, ...messages], temperature: 0.3, max_tokens: 512 })
    });
    if (!res.ok) {
      const errText = await res.text();
      log('Groq hatasi: ' + res.status + ' ' + errText.slice(0, 200));
      return 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.';
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'Nasıl yardımcı olabilirim?';
  } catch (err) {
    log('Groq iletisim: ' + err.message);
    return 'Bir hata oluştu.';
  }
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

async function getAvailableSlots(doctorId, date) {
  const { data: slots } = await supabase
    .from('availability')
    .select('id, start_time')
    .eq('doctor_id', doctorId)
    .eq('date', date)
    .eq('is_booked', false)
    .order('start_time');

  const { data: appointments } = await supabase
    .from('appointments')
    .select('time')
    .eq('doctor_id', doctorId)
    .eq('date', date)
    .neq('status', 'cancelled');

  const bookedTimes = new Set((appointments || []).map(a => a.time));
  return (slots || []).filter(s => !bookedTimes.has(s.start_time));
}

async function findOrCreatePatient(phone, name) {
  let searchPhone = phone.replace(/[^0-9]/g, '');

  let { data: patient } = await supabase
    .from('patients')
    .select('id, full_name')
    .eq('phone', searchPhone)
    .maybeSingle();

  if (patient) {
    if (name && name !== patient.full_name) {
      const parts = name.split(/\s+/);
      await supabase.from('patients').update({ full_name: name, first_name: parts[0] || null, updated_at: new Date().toISOString() }).eq('id', patient.id);
    }
    return patient;
  }

  const parts = (name || '').split(/\s+/);
  const { data: newPatient, error } = await supabase
    .from('patients')
    .insert({ phone: searchPhone, full_name: name || 'Bilinmeyen', first_name: parts[0] || null })
    .select()
    .single();

  if (error) { log('Patient create: ' + JSON.stringify(error)); return null; }
  return newPatient;
}

async function handleBookingFlow(doctor, phone, state, userText) {
  const step = state?.step || 'idle';

  if (step === 'idle' || step === 'awaiting_details') {
    let date = extractDateFromText(userText);
    let time = extractTimeFromText(userText);

    if (date && time) {
      const { data: existing } = await supabase
        .from('appointments')
        .select('id')
        .eq('doctor_id', doctor.id)
        .eq('date', date)
        .eq('time', time)
        .neq('status', 'cancelled')
        .maybeSingle();
      if (existing) {
        state.step = 'awaiting_details';
        return { reply: `Üzgünüm, ${formatDate(date)} ${time} için randevu dolu. Başka bir saat veya gün düşünür müsünüz?`, state, bookingConfirmed: false };
      }
      state.step = 'awaiting_name';
      state.bookingDate = date;
      state.bookingTime = time;
      return { reply: `${formatDate(date)} ${time} için randevu alıyoruz. Adınızı ve soyadınızı yazar mısınız?`, state, bookingConfirmed: false };
    }

    if (date && !time) {
      const slots = await getAvailableSlots(doctor.id, date);
      if (!slots.length) {
        state.step = 'awaiting_details';
        return { reply: `${formatDate(date)} için boş saat bulunamadı. Başka bir gün düşünür müsünüz?`, state, bookingConfirmed: false };
      }
      state.step = 'awaiting_time';
      state.bookingDate = date;
      state.availableSlots = slots;
      const times = slots.map((s, i) => `${i+1}. ${String(s.start_time).slice(0, 5)}`).join('\n');
      return { reply: `${formatDate(date)} için uygun saatler:\n${times}\n\nLütfen bir saat seçin (1-${slots.length}):`, state, bookingConfirmed: false };
    }

    state.step = 'awaiting_details';
    return { reply: 'Hangi gün için randevu almak istersiniz? (Örn: yarın, pazartesi, 15.06.2026)', state, bookingConfirmed: false };
  }

  if (step === 'awaiting_time') {
    const freshSlots = await getAvailableSlots(doctor.id, state.bookingDate);
    if (!freshSlots.length) {
      state.step = 'idle';
      return { reply: `${formatDate(state.bookingDate)} için uygun saat kalmadı. Lütfen başka bir gün deneyin.`, state, bookingConfirmed: false };
    }
    const slotIdx = parseInt(userText.match(/\d+/)?.[0] || '') - 1;
    let slot = freshSlots[slotIdx];
    if (!slot) {
      slot = freshSlots.find(s => String(s.start_time).slice(0, 5) === userText.trim().slice(0, 5));
    }
    if (!slot) {
      const times = freshSlots.map((s, i) => `${i+1}. ${String(s.start_time).slice(0, 5)}`).join('\n');
      return { reply: `Lütfen listeden bir saat seçin (1-${freshSlots.length}):\n${times}`, state, bookingConfirmed: false };
    }
    state.bookingTime = String(slot.start_time).slice(0, 5);
    state.step = 'awaiting_name';
    return { reply: `${formatDate(state.bookingDate)} ${state.bookingTime} için randevu. Adınızı ve soyadınızı yazar mısınız?`, state, bookingConfirmed: false };
  }

  if (step === 'awaiting_name') {
    const raw = userText.replace(/[^a-zA-ZÇçĞğİıÖöŞşÜü\s]/g, '').trim();
    if (!raw || raw.length < 2) {
      return { reply: 'Adınızı ve soyadınızı alabilir miyim?', state, bookingConfirmed: false };
    }
    const parts = raw.split(/\s+/);
    state.patientName = raw;
    state.firstName = parts[0];
    state.step = 'awaiting_confirm';
    return { reply: `Onay: ${formatDate(state.bookingDate)} ${state.bookingTime} - Sayın ${parts[0]}\nOnaylıyor musunuz? (evet/hayır)`, state, bookingConfirmed: false };
  }

  if (step === 'awaiting_confirm') {
    const lower = userText.toLowerCase().trim();
    if (lower.includes('evet') || lower.includes('onay') || lower.includes('tamam') || lower.includes('olur') || lower.includes('kesin')) {
      const { data: existing } = await supabase
        .from('appointments')
        .select('id')
        .eq('doctor_id', doctor.id)
        .eq('date', state.bookingDate)
        .eq('time', state.bookingTime)
        .neq('status', 'cancelled')
        .maybeSingle();
      if (existing) {
        state.step = 'idle';
        return { reply: `Üzgünüm, ${formatDate(state.bookingDate)} ${state.bookingTime} az önce başkası tarafından alındı. Lütfen yeni bir randevu için tekrar dener misiniz?`, state, bookingConfirmed: false };
      }

      const patient = await findOrCreatePatient(phone, state.patientName);
      const patientId = patient?.id || null;

      let slotId = state.availableSlots?.find(s => String(s.start_time).slice(0, 5) === state.bookingTime)?.id;
      if (!slotId && state.bookingDate && state.bookingTime) {
        const { data: directSlot } = await supabase
          .from('availability')
          .select('id')
          .eq('doctor_id', doctor.id)
          .eq('date', state.bookingDate)
          .eq('start_time', state.bookingTime)
          .eq('is_booked', false)
          .maybeSingle();
        if (directSlot) slotId = directSlot.id;
      }
      if (slotId) {
        const { error: slotErr } = await supabase.from('availability').update({ is_booked: true }).eq('id', slotId);
        if (slotErr) log('Slot hatasi: ' + JSON.stringify(slotErr));
      }

      if (patient && state.firstName) {
        await supabase.from('patients').update({ first_name: state.firstName, full_name: state.patientName, updated_at: new Date().toISOString() }).eq('id', patient.id);
      }

      const { error } = await supabase.from('appointments').insert({
        doctor_id: doctor.id,
        slot_id: slotId || null,
        date: state.bookingDate,
        time: state.bookingTime,
        status: 'confirmed',
        patient_name: state.patientName,
        patient_phone: phone,
        whatsapp_chat_id: phone,
        patient_id: patientId,
        first_name: state.firstName || null
      });

      if (error) {
        log('Kayit hatasi: ' + JSON.stringify(error));
        state.step = 'idle';
        return { reply: 'Randevu kaydı sırasında bir hata oluştu. Lütfen tekrar deneyin.', state, bookingConfirmed: false };
      }

      state.step = 'idle';
      const displayName = state.firstName ? `Sayın ${state.firstName}` : state.patientName;
      return { reply: `Randevunuz onaylandı ${displayName}!\n${formatDate(state.bookingDate)} ${state.bookingTime}\nGörüşmek üzere.`, state, bookingConfirmed: true };
    }

    state.step = 'idle';
    return { reply: 'Randevu talebiniz iptal edildi. Başka bir konuda yardımcı olabilir miyim?', state, bookingConfirmed: false };
  }

  return { reply: 'Nasıl yardımcı olabilirim?', state, bookingConfirmed: false };
}

async function handleCancel(doctor, phone, userText) {
  const date = extractDateFromText(userText);
  const query = supabase.from('appointments').select('id, slot_id, date, time').eq('doctor_id', doctor.id).neq('status', 'cancelled');
  if (date) query.eq('date', date);
  if (!date) query.eq('patient_phone', phone);
  query.order('date', { ascending: false }).limit(1).maybeSingle();

  const { data: appointment } = await query;
  if (!appointment) return 'Size ait iptal edilebilecek aktif randevu bulamadım.';
  if (appointment.slot_id) await supabase.from('availability').update({ is_booked: false }).eq('id', appointment.slot_id);
  await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appointment.id);
  return `${formatDate(appointment.date)} ${String(appointment.time).slice(0, 5)} randevunuz iptal edildi.`;
}

async function getPhoneFromMessage(msg) {
  try {
    if (typeof msg.getContact === 'function') {
      const contact = await msg.getContact();
      if (contact) {
        const num = String(contact.number || '').replace(/[^0-9]/g, '');
        if (num && num.length > 5) return num;
        const pushname = String(contact.pushname || contact.name || '').trim();
        if (pushname) state = state || {}; if (!state) state = {}; if (!state.pushName) state = state || {}; state.pushName = pushname;
      }
    }
  } catch (e) {
    log('getPhoneFromMessage getContact error: ' + e.message);
  }

  try {
    if (msg._data) {
      const data = msg._data;
      const phoneCandidates = [
        data.phoneNumber, data.whatsappNumber, data.contactPhone,
        data.from?.phoneNumber, data.from?.whatsappNumber,
        data.notifyName && typeof data.notifyName === 'object' ? null : null
      ];
      for (const candidate of phoneCandidates) {
        if (candidate) {
          const num = String(candidate).replace(/[^0-9]/g, '');
          if (num && num.length > 5 && num.length < 16) return num;
        }
      }
      if (data.participant) {
        const num = String(data.participant).replace(/[^0-9]/g, '');
        if (num && num.length > 5 && num.length < 16) return num;
      }
    }
  } catch (e) {}

  try {
    if (msg.author) {
      const num = msg.author.replace(/[^0-9]/g, '');
      if (num && num.length > 5 && num.length < 16) return num;
    }
  } catch (e) {}

  const rawJid = msg.from || '';
  const numeric = rawJid.replace(/[^0-9]/g, '');
  const atIndex = rawJid.indexOf('@');
  const userPart = atIndex > 0 ? rawJid.substring(0, atIndex) : rawJid;
  const numericUser = userPart.replace(/[^0-9]/g, '');
  if (numericUser) {
    if (numericUser.length > 5 && numericUser.length < 16) return numericUser;
    return numericUser;
  }
  return numeric;
}

export async function handleMessage(msg, doctor) {
  const phone = await getPhoneFromMessage(msg);
  const text = msg.body || '';

  try {
    let { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('phone_number', phone)
      .maybeSingle();

    if (!session) {
      const { data: ns, error } = await supabase
        .from('whatsapp_sessions')
        .insert({ phone_number: phone, conversation_state: 'idle', context: { messages: [], state: { step: 'idle' } } })
        .select()
        .single();
      if (error) { log('Session olusturma: ' + JSON.stringify(error)); return 'Bir hata oluştu.'; }
      session = ns;
    }

    const context = session?.context || {};
    const state = context.state || {};
    if (!state.step) state.step = 'idle';
    const messages = context.messages || [];

    let reply;

    if (state.step !== 'idle') {
      log('Aktif akis: step=' + state.step + ' mesaj=' + text);
      const result = await handleBookingFlow(doctor, phone, state, text);
      reply = result.reply;
    } else {
      const intent = detectIntent(text);
      log('Intent: ' + intent + ' mesaj=' + text);

      if (intent === INTENT.GREETING) {
        const name = doctor?.profile?.full_name || '';
        const spec = doctor?.specialty || '';
        reply = `Merhaba! Ben ${name} - ${spec} dijital asistanıyım. Size nasıl yardımcı olabilirim?\n\nRandevu alabilir, bilgi alabilir veya mevcut randevunuzu sorgulayabilirsiniz.`;
      } else if (intent === INTENT.CANCEL) {
        reply = await handleCancel(doctor, phone, text);
      } else if (intent === INTENT.BOOK) {
        log('Randevu akisi baslatiliyor');
        const result = await handleBookingFlow(doctor, phone, state, text);
        reply = result.reply;
      } else {
        log('AI yaniti: ' + text);
        const contextMessages = messages.slice(-10);
        reply = await callGroqForReply([...contextMessages, { role: 'user', content: text }], doctor);
      }
    }

    messages.push({ role: 'user', content: text }, { role: 'assistant', content: reply });
    await supabase.from('whatsapp_sessions').update({
      context: { messages: messages.slice(-20), state, last_message_at: new Date().toISOString() },
      updated_at: new Date().toISOString()
    }).eq('phone_number', phone);

    return reply;
  } catch (err) {
    log('Islem hatasi: ' + (err?.message || JSON.stringify(err)));
    return 'Bir hata oluştu. Lütfen tekrar deneyin.';
  }
}
