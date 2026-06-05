import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client, LocalAuth } = require('whatsapp-web.js');
import qrcode from 'qrcode-terminal';
import { handleMessage } from './message-handler.js';
import { getDoctors } from './supabase.js';
import supabase from './supabase.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clients = [];

const LOG_FILE = 'C:/Users/ahmet/AppData/Local/Temp/opencode/bot-log.txt';
const log = (msg) => { const t = new Date().toISOString(); const line = `[${t}] ${msg}\n`; try { require('fs').appendFileSync(LOG_FILE, line); } catch(e) {} };

export async function startAllDoctors() {
  const doctors = await getDoctors();
  if (!doctors || doctors.length === 0) {
    log('WhatsApp bagli doktor bulunamadi.');
    return;
  }
  for (const doc of doctors) {
    await addDoctorClient(doc);
  }
}

export async function addDoctorClient(doctor) {
  const phone = doctor.whatsapp_number?.replace(/[^0-9]/g, '');
  if (!phone) {
    log('Atlanan: ' + doctor.profile?.full_name + ' (WhatsApp numarasi yok)');
    return;
  }

  log('Baslatiliyor: ' + doctor.profile?.full_name + ' (' + doctor.whatsapp_number + ')');

  const dataPath = join(__dirname, 'sessions', `doctor_${phone}`);

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath }),
    puppeteer: {
      headless: false,
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', async (qr) => {
    log('QR KOD: ' + doctor.profile?.full_name);
    log('Doktor: ' + doctor.profile?.full_name + ' - ' + (doctor.specialty || ''));
    log('Telefon: WhatsApp > Bagli cihazlar > Cihaz bagla');
    qrcode.generate(qr, { small: true });
    const qrPhone = `qr_${doctor.id}`;
    await supabase.from('whatsapp_sessions').upsert({
      phone_number: qrPhone, conversation_state: 'qr_pending',
      context: { qr_text: qr, doctor_name: doctor.profile?.full_name, doctor_id: doctor.id },
      updated_at: new Date().toISOString()
    }, { onConflict: 'phone_number' });
    log('QR Supabase\'e kaydedildi');
  });

  client.on('ready', async () => {
    log('Baglandi: ' + doctor.profile?.full_name);
    log('Mesajlari dinliyor...');
    log('Bot bilgisi: ' + (client.info?.wid?.user || '?'));
    const qrPhone = `qr_${doctor.id}`;
    await supabase.from('whatsapp_sessions').upsert({
      phone_number: qrPhone, conversation_state: 'connected',
      context: { connected: true, doctor_id: doctor.id, connected_at: new Date().toISOString() },
      updated_at: new Date().toISOString()
    }, { onConflict: 'phone_number' });
  });

  client.on('disconnected', async (reason) => {
    log('Baglanti koptu: ' + doctor.profile?.full_name + ' - ' + reason);
    const qrPhone = `qr_${doctor.id}`;
    await supabase.from('whatsapp_sessions').upsert({
      phone_number: qrPhone, conversation_state: 'disconnected',
      context: { reason, doctor_id: doctor.id, disconnected_at: new Date().toISOString() },
      updated_at: new Date().toISOString()
    }, { onConflict: 'phone_number' });
  });

  client.on('message', async (msg) => {
    log('GELEN MESAJ: from=' + msg.from + ' body=' + msg.body);
    if (msg.from && typeof msg.from === 'string' && (msg.from.endsWith('@c.us') || msg.from.includes('@lid'))) {
      try {
        log('Mesaj alindi: ' + msg.from + ' - ' + msg.body);
        const reply = await handleMessage(msg, doctor);
        await msg.reply(reply);
        log('Cevap gonderildi: ' + reply.slice(0, 50) + '...');
      } catch (err) {
        log('Mesaj hatasi: ' + (err?.message || JSON.stringify(err)));
      }
    } else {
      log('Atlanan mesaj (from format): ' + msg.from);
    }
  });

  client.on('auth_failure', (msg) => {
    log('Kimlik dogrulama hatasi: ' + doctor.profile?.full_name + ' - ' + msg);
  });

  try {
    await client.initialize();
    clients.push({ doctor, client });
  } catch (err) {
    log('Baslatma hatasi: ' + (err?.message || JSON.stringify(err)));
  }
  return client;
}

export function getAllClients() {
  return clients;
}
