import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_KEY') || '';
const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'kivon_verify_2024';

async function sb(path, opts = {}) {
  const h = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: opts.method || 'GET', body: opts.body, headers: h });
  if (r.status === 204) return null;
  try { return await r.json(); } catch { return null; }
}

serve(async (req) => {
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === VERIFY_TOKEN) {
      return new Response(url.searchParams.get('hub.challenge'), { status: 200 });
    }
    return new Response('KIVON WA', { status: 200 });
  }

  if (req.method !== 'POST') return new Response('ok', { status: 200 });

  try {
    const body = await req.json();
    let from = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from || body?.phone;
    let text = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body || body?.message;
    if (!from || !text) return new Response(JSON.stringify({ reply: '' }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const phone = String(from).replace(/[^0-9]/g, '');
    const lower = String(text).toLowerCase().trim();

    let session;
    try { const s = await sb(`whatsapp_sessions?phone_number=eq.${phone}&select=*`); session = Array.isArray(s) ? s[0] : s; } catch { session = null; }

    const state = session?.conversation_state || 'idle';
    const ctx = session?.context || {};
    let reply = '', newState = 'idle', newCtx = {};

    if (state === 'idle' || state === 'awaiting_intent') {
      if (['randevu','merhaba','selam','iyi','gun'].some(w => lower.includes(w))) {
        const d = await sb('doctors?select=id,specialty,profile:profiles(full_name)');
        const list = Array.isArray(d) ? d : [];
        if (list.length) {
          reply = 'Doktorlar:\n' + list.map((x, i) => `${i+1}. ${x.profile?.full_name || '?'} - ${x.specialty || 'Genel'}`).join('\n') + '\n\nDoktor no:';
          newState = 'awaiting_doctor';
          newCtx = { doctors: list.map(x => ({ id: x.id, name: x.profile?.full_name, specialty: x.specialty })) };
        } else reply = 'Doktor yok.';
      } else { reply = '"randevu" yazin.'; newState = 'awaiting_intent'; }
    } else if (state === 'awaiting_doctor') {
      const doc = ctx.doctors?.[parseInt(text) - 1];
      if (!doc) { reply = 'Gecerli no.'; newState = 'awaiting_doctor'; newCtx = ctx; }
      else {
        const today = new Date().toISOString().split('T')[0];
        const slots = await sb(`availability?doctor_id=eq.${doc.id}&is_booked=eq.false&select=date&order=date.asc&date=gte.${today}`);
        const dates = [...new Set((Array.isArray(slots) ? slots : []).map(s => s.date))].slice(0, 14);
        if (!dates.length) { reply = 'Musait gun yok.'; }
        else {
          reply = `${doc.name} gunler:\n` + dates.map((d, i) => { const p = d.split('-'); return `${i+1}. ${p[2]}.${p[1]}.${p[0]}`; }).join('\n') + '\n\nGun:';
          newState = 'awaiting_date'; newCtx = { ...ctx, selectedDoctor: doc, availableDates: dates };
        }
      }
    } else if (state === 'awaiting_date') {
      const date = ctx.availableDates?.[parseInt(text) - 1];
      if (!date) { reply = 'Gecerli gun.'; newState = 'awaiting_date'; newCtx = ctx; }
      else {
        const slots = await sb(`availability?doctor_id=eq.${ctx.selectedDoctor.id}&date=eq.${date}&is_booked=eq.false&order=start_time.asc`);
        const list = Array.isArray(slots) ? slots : [];
        if (!list.length) { reply = 'Musait saat yok.'; }
        else {
          reply = `${date}:\n` + list.map((s, i) => `${i+1}. ${String(s.start_time).slice(0,5)}`).join('\n') + '\n\nSaat:';
          newState = 'awaiting_time'; newCtx = { ...ctx, selectedDate: date, availableSlots: list };
        }
      }
    } else if (state === 'awaiting_time') {
      const slot = ctx.availableSlots?.[parseInt(text) - 1];
      if (!slot) { reply = 'Gecerli saat.'; newState = 'awaiting_time'; newCtx = ctx; }
      else {
        newCtx = { ...ctx, selectedSlot: slot };
        reply = `${ctx.selectedDoctor.name}\n${ctx.selectedDate}\n${String(slot.start_time).slice(0,5)}\n\nAdiniz:`;
        newState = 'awaiting_name';
      }
    } else if (state === 'awaiting_name') {
      if (text.length < 2) { reply = 'En az 2 harf.'; newState = 'awaiting_name'; newCtx = ctx; }
      else {
        newCtx = { ...ctx, patientName: text };
        reply = `Onay: ${ctx.selectedDoctor.name} / ${ctx.selectedDate} / ${String(ctx.availableSlots.find(s => s.id === ctx.selectedSlot.id)?.start_time).slice(0,5)}\nevet/hayir?`;
        newState = 'awaiting_confirm';
      }
    } else if (state === 'awaiting_confirm') {
      if (lower.includes('evet')) {
        try {
          await sb(`availability?id=eq.${ctx.selectedSlot.id}`, { method: 'PATCH', body: JSON.stringify({ is_booked: true }) });
          const existing = await sb(`patients?phone=eq.${phone}&select=id`);
          let patient = Array.isArray(existing) && existing.length ? existing[0] : null;
          if (!patient) {
            const created = await sb('patients', { method: 'POST', body: JSON.stringify({ phone, full_name: ctx.patientName || 'Hasta' }), headers: { Prefer: 'return=representation' } });
            patient = Array.isArray(created) ? created[0] : created;
          }
          await sb('appointments', { method: 'POST', body: JSON.stringify({ doctor_id: ctx.selectedDoctor.id, slot_id: ctx.selectedSlot.id, date: ctx.selectedDate, time: ctx.selectedSlot.start_time, status: 'confirmed', whatsapp_chat_id: phone, patient_name: String(ctx.patientName || 'Hasta'), patient_phone: String(phone), patient_id: patient?.id || null }) });
          reply = `Randevu alindi!\n${ctx.selectedDoctor.name}\n${ctx.selectedDate}\n${String(ctx.selectedSlot.start_time).slice(0,5)}`;
          newState = 'idle'; newCtx = {};
        } catch (e) { reply = 'Hata. Tekrar.'; newState = 'idle'; newCtx = {}; }
      } else { reply = 'Iptal.'; newState = 'idle'; }
    } else { reply = '"randevu" yazin.'; newState = 'awaiting_intent'; }

    try {
      const existing = await sb(`whatsapp_sessions?phone_number=eq.${phone}&select=id`);
      const row = Array.isArray(existing) && existing.length ? existing[0] : null;
      if (row) {
        await sb(`whatsapp_sessions?id=eq.${row.id}`, { method: 'PATCH', body: JSON.stringify({ conversation_state: newState, context: newCtx, updated_at: new Date().toISOString() }) });
      } else {
        await sb('whatsapp_sessions', { method: 'POST', body: JSON.stringify({ phone_number: phone, conversation_state: newState, context: newCtx, updated_at: new Date().toISOString() }) });
      }
    } catch (e) { console.error('Save error:', e.message); }

    return new Response(JSON.stringify({ reply }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ reply: 'Hata.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
});
