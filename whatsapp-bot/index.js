import 'dotenv/config';
import { startAllDoctors, getAllClients } from './client-manager.js';
import { startDailyReport } from './daily-report.js';

console.log('');
console.log('╔══════════════════════════════════════╗');
console.log('║   KIVON WhatsApp Randevu Asistani   ║');
console.log('╚══════════════════════════════════════╝');
console.log('');

startAllDoctors()
  .then(() => {
    console.log('\n✅ Bot baslatildi. Mesajlari dinliyor...');
    console.log('Durmak icin Ctrl+C');
    const clients = getAllClients();
    if (clients.length) startDailyReport(clients);
  })
  .catch(err => {
    console.error('❌ Baslatma hatasi:', err.message);
    process.exit(1);
  });

process.on('SIGINT', () => {
  console.log('\nBot durduruluyor...');
  process.exit(0);
});
