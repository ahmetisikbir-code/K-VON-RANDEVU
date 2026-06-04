import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = 'sb_publishable_bWlpyQycwdlquuzoNBxNkg_1WiFqaOo';
const supabase = createClient(supabaseUrl, supabaseKey);

const SEND_HOUR = 8;
const SEND_MINUTE = 0;

export function startDailyReport(clients) {
  console.log(`Gunluk rapor planlandi: her gun ${String(SEND_HOUR).padStart(2,'0')}:${String(SEND_MINUTE).padStart(2,'0')}`);

  async function checkAndSend() {
    const now = new Date();
    if (now.getHours() === SEND_HOUR && now.getMinutes() === SEND_MINUTE) {
      const today = now.toISOString().slice(0, 10);
      for (const { doctor, client } of clients) {
        const phone = doctor.whatsapp_number?.replace(/[^0-9]/g, '');
        if (!phone || !client.info) continue;
        try {
          const { data: appointments } = await supabase
            .from('appointments')
            .select('id, date, time, status, profiles(full_name, phone)')
            .eq('doctor_id', doctor.id)
            .eq('date', today)
            .eq('status', 'confirmed')
            .order('time');

          let msg = `📋 *${today} gunluk randevu raporu*\n\n`;
          if (!appointments || appointments.length === 0) {
            msg += 'Bugun randevu yok.\n';
          } else {
            appointments.forEach((a, i) => {
              const t = a.time ? a.time.slice(0, 5) : '--:--';
              const name = a.profiles?.full_name || 'Bilinmeyen';
              msg += `${i+1}. ${t} - ${name}\n`;
            });
            msg += `\nToplam: ${appointments.length} randevu`;
          }
          await client.sendMessage(`${phone}@c.us`, msg);
          console.log(`Rapor gonderildi: ${doctor.profile?.full_name}`);
        } catch (e) {
          console.error(`Rapor hatasi ${doctor.profile?.full_name}:`, e.message);
        }
      }
    }
  }

  setInterval(checkAndSend, 60000);
}
