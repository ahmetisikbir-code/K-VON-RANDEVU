import 'dotenv/config';
import fs from 'fs';
import { startAllDoctors, getAllClients } from './client-manager.js';
import { startDailyReport } from './daily-report.js';

const logFile = 'C:/Users/ahmet/AppData/Local/Temp/opencode/bot-log.txt';
const log = (msg) => { const t = new Date().toISOString(); const line = `[${t}] ${msg}\n`; fs.appendFileSync(logFile, line); console.log(msg); }; log('=== BOT BASLIYOR ===');

log('');
log('╔══════════════════════════════════════╗');
log('║   KIVON WhatsApp Randevu Asistani   ║');
log('╚══════════════════════════════════════╝');
log('');

startAllDoctors()
  .then(() => {
    log('\n✅ Bot baslatildi. Mesajlari dinliyor...');
    log('Durmak icin Ctrl+C');
    const clients = getAllClients();
    if (clients.length) startDailyReport(clients);
  })
  .catch(err => {
    log('❌ Baslatma hatasi:' + err.message);
    process.exit(1);
  });

process.on('SIGINT', () => {
  log('\nBot durduruluyor...');
  process.exit(0);
});
