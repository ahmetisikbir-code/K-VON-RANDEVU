import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = 'sb_publishable_bWlpyQycwdlquuzoNBxNkg_1WiFqaOo';
const supabase = createClient(supabaseUrl, supabaseKey);

const SEND_HOUR = 8;
const SEND_MINUTE = 0;

function toIso(date) {
  return date.toISOString().split('T')[0];
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function startDailyReport(clients) {
  console.log(`Gunluk rapor planlandi: her gun ${String(SEND_HOUR).padStart(2,'0')}:${String(SEND_MINUTE).padStart(2,'0')}`);

  async function checkAndSend() {
    const now = new Date();
    if (now.getHours() !== SEND_HOUR || now.getMinutes() !== SEND_MINUTE) return;

    const today = toIso(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = toIso(tomorrow);
    const tomorrowLabel = formatDate(tomorrowIso);

    for (const { doctor, client } of clients) {
      const phone = doctor.whatsapp_number?.replace(/[^0-9]/g, '');
      if (!phone || !client.info) continue;

      try {
        const { data: todayAppts } = await supabase
          .from('appointments')
          .select('id, date, time, status, patient_name, patient_phone')
          .eq('doctor_id', doctor.id)
          .eq('date', today)
          .eq('status', 'confirmed')
          .order('time');

        const bizName = doctor.profile?.full_name || 'Isletme';
        let msg = `📋 ${bizName} - ${today} raporu\n\n`;
        if (!todayAppts || todayAppts.length === 0) {
          msg += 'Bugun randevu yok.\n';
        } else {
          todayAppts.forEach((a, i) => {
            const t = a.time ? a.time.slice(0, 5) : '--:--';
            msg += `${i+1}. ${t} - ${a.patient_name || 'Bilinmeyen'}\n`;
          });
          msg += `\nToplam: ${todayAppts.length} randevu`;
        }
        await client.sendMessage(`${phone}@c.us`, msg);
        console.log(`Rapor gonderildi: ${doctor.profile?.full_name}`);

        const { data: tomorrowAppts } = await supabase
          .from('appointments')
          .select('id, time, patient_name, patient_phone, whatsapp_chat_id')
          .eq('doctor_id', doctor.id)
          .eq('date', tomorrowIso)
          .eq('status', 'confirmed')
          .order('time');

        if (tomorrowAppts && tomorrowAppts.length) {
          for (const apt of tomorrowAppts) {
            const patientPhone = apt.patient_phone || apt.whatsapp_chat_id;
            if (!patientPhone) continue;
            const cleanPhone = patientPhone.replace(/[^0-9]/g, '');
            const time = apt.time ? apt.time.slice(0, 5) : '--:--';
            const hitap = apt.first_name ? `Sayın ${apt.first_name}` : (apt.patient_name || 'Değerli Hastamız');
            const reminder = `Merhaba ${hitap}, ${tomorrowLabel} ${time} randevunuzu hatırlatmak isteriz. Görüşmek üzere.`;
            try {
              await client.sendMessage(`${cleanPhone}@c.us`, reminder);
              console.log(`Hatirlatma gonderildi: ${cleanPhone}`);
            } catch (e) {
              console.error(`Hatirlatma hatasi ${cleanPhone}:`, e.message);
            }
          }
          console.log(`${tomorrowAppts.length} hasta hatirlatma gonderildi`);
        }
      } catch (e) {
        console.error(`Rapor hatasi ${doctor.profile?.full_name}:`, e.message);
      }
    }
  }

  setInterval(checkAndSend, 60000);
}
