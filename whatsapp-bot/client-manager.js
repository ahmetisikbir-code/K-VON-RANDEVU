import { Client } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { handleMessage } from './message-handler.js';
import { getDoctors, getDoctorByPhone } from './supabase.js';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clients = [];

function getSessionDir(phone) {
  const dir = join(__dirname, 'sessions', `doctor_${phone}`);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export async function startAllDoctors() {
  const doctors = await getDoctors();
  if (!doctors || doctors.length === 0) {
    console.log('WhatsApp bagli doktor bulunamadi.');
    return;
  }

  for (const doc of doctors) {
    await addDoctorClient(doc);
  }
}

export async function addDoctorClient(doctor) {
  const phone = doctor.whatsapp_number?.replace(/[^0-9]/g, '');
  if (!phone) {
    console.log(`Atlanan: ${doctor.profile?.full_name} (WhatsApp numarasi yok)`);
    return;
  }

  console.log(`Baslatiliyor: ${doctor.profile?.full_name} (${doctor.whatsapp_number})`);

  const sessionDir = getSessionDir(phone);

  const client = new Client({
    session: existsSync(join(sessionDir, 'session.json'))
      ? JSON.parse(readFileSync(join(sessionDir, 'session.json'), 'utf-8'))
      : undefined,
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', (qr) => {
    console.log(`\n========== QR KOD: ${doctor.profile?.full_name} ==========`);
    console.log(`Telefonunuzdan WhatsApp > Bagli cihazlar > Cihaz bagla`);
    console.log(`Doktor: ${doctor.profile?.full_name} - ${doctor.specialty || ''}`);
    qrcode.generate(qr, { small: true });
    console.log('========================================\n');
  });

  client.on('authenticated', (session) => {
    const sessionDir = getSessionDir(phone);
    writeFileSync(join(sessionDir, 'session.json'), JSON.stringify(session));
    console.log(`✅ Oturum kaydedildi: ${doctor.profile?.full_name}`);
  });

  client.on('ready', () => {
    console.log(`✅ Baglandi: ${doctor.profile?.full_name}`);
    console.log(`   Mesajlari dinliyor...`);
  });

  client.on('disconnected', (reason) => {
    console.log(`❌ Baglanti koptu: ${doctor.profile?.full_name} - ${reason}`);
  });

  client.on('message', async (msg) => {
    if (msg.from.endsWith('@c.us')) {
      try {
        const reply = await handleMessage(msg, doctor);
        await msg.reply(reply);
      } catch (err) {
        console.error('Mesaj hatasi:', err);
        await msg.reply('Bir hata olustu. Lutfen tekrar deneyin.');
      }
    }
  });

  client.on('auth_failure', (msg) => {
    console.error(`❌ Kimlik dogrulama hatasi: ${doctor.profile?.full_name} - ${msg}`);
  });

  try {
    await client.initialize();
    clients.push({ doctor, client });
  } catch (err) {
    console.error(`Baslatma hatasi: ${doctor.profile?.full_name}`, err.message);
  }

  return client;
}

export function getAllClients() {
  return clients;
}
