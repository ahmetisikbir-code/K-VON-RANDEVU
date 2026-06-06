import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const URL = process.env.SUPABASE_URL || 'https://remiwuslxbqlzuevecic.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_bWlpyQycwdlquuzoNBxNkg_1WiFqaOo';

const sup = createClient(URL, SERVICE_KEY);
const anon = createClient(URL, ANON_KEY);

const CLINIC_ID = 'acbc2f0b-2178-47d8-9695-14ec4b5b61e3';
const results = [];

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, status: 'PASS' });
  } catch (e) {
    results.push({ name, status: 'FAIL', error: e.message, details: e.details || '' });
  }
}

// TEST 1: Anon ile doctors SELECT
await test('TEST 1: Anon ile doctors SELECT (en az 2 doktor)', async () => {
  const { data, error } = await anon
    .from('doctors')
    .select('id, specialty, working_hours, profile:profiles(full_name, phone)')
    .eq('clinic_id', CLINIC_ID);
  if (error) throw error;
  const count = data?.length || 0;
  console.log(`  -> ${count} doktor bulundu`);
  if (count < 2) throw new Error(`Beklenen: en az 2 doktor, bulunan: ${count}`);
});

// TEST 2: Anon ile clinics SELECT
await test('TEST 2: Anon ile clinics SELECT (en az 1 klinik)', async () => {
  const { data, error } = await anon.from('clinics').select('*');
  if (error) throw error;
  const count = data?.length || 0;
  console.log(`  -> ${count} klinik bulundu`);
  if (count < 1) throw new Error(`Beklenen: en az 1 klinik, bulunan: ${count}`);
});

// TEST 3: Authenticated (service_role) ile INSERT doctors
await test('TEST 3: Service role ile INSERT doctors', async () => {
  const { data, error } = await sup
    .from('doctors')
    .insert({ clinic_id: CLINIC_ID, specialty: 'test-specialty', working_hours: {} })
    .select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Insert sonucu data yok');
  console.log(`  -> Doktor eklendi: ${data[0].id}`);
  // Cleanup
  const { error: delErr } = await sup.from('doctors').delete().eq('id', data[0].id);
  if (delErr) console.log(`  -> Temizlik hatasi (ignored): ${delErr.message}`);
  else console.log('  -> Temizlik basarili');
});

// TEST 4: Bot sorgusu (whatsapp not null)
await test('TEST 4: Bot sorgusu (whatsapp not null) - en az 1 doktor', async () => {
  const { data, error } = await anon
    .from('doctors')
    .select('profile:profiles(full_name)')
    .eq('clinic_id', CLINIC_ID)
    .not('whatsapp_number', 'is', null);
  if (error) throw error;
  const count = data?.length || 0;
  console.log(`  -> ${count} doktorun whatsapp numarasi var`);
  if (count < 1) throw new Error(`Beklenen: en az 1 doktor, bulunan: ${count}`);
});

// TEST 5: Randevu sayisi kontrol
await test('TEST 5: Randevu sayisi kontrol', async () => {
  const { count, error } = await sup
    .from('appointments')
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  const total = count || 0;
  console.log(`  -> Toplam randevu: ${total}`);
  if (total > 50) {
    console.log('  -> UYARI: 50+ randevu var, temizleme önerilir');
    throw new Error(`50+ randevu (${total} adet) - temizleme önerilir`);
  }
});

console.log('\n========== TEST RAPORU ==========');
for (const r of results) {
  const icon = r.status === 'PASS' ? '✓' : '✗';
  console.log(`${icon} ${r.name}`);
  if (r.error) console.log(`   Hata: ${r.error}`);
  if (r.details) console.log(`   Detay: ${r.details}`);
}
console.log('================================\n');

const reportLines = [
  '# Test Raporu',
  '',
  '| Test | Durum | Detay |',
  '|------|-------|-------|',
];
for (const r of results) {
  const detail = r.error ? `Hata: ${r.error}${r.details ? ' - ' + r.details : ''}` : '';
  const status = r.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
  reportLines.push(`| ${r.name} | ${status} | ${detail} |`);
}
reportLines.push('');
reportLines.push(`*Rapor tarihi: ${new Date().toISOString()}*`);

writeFileSync('C:\\Users\\ahmet\\OneDrive\\Belgeler\\kivon-randevu\\test_raporu.md', reportLines.join('\n'), 'utf8');
console.log('Rapor test_raporu.md dosyasina yazildi.');
