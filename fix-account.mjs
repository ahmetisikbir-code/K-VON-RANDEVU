import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://remiwuslxbqlzuevecic.supabase.co',
  'sb_publishable_bWlpyQycwdlquuzoNBxNkg_1WiFqaOo'
);

const email = 'furkanbariss24@gmail.com';
const password = 'demo1234';

// Önce doktor hesabıyla giriş yap (admin panel yetkisi)
const { data: docAuth } = await supabase.auth.signInWithPassword({
  email: 'doktor@kivontr.com',
  password: 'kivon1234'
});

if (!docAuth?.session) {
  console.log('Doktor girişi başarısız.');
  process.exit(1);
}
console.log('Doktor girişi başarılı.');

// Doktorun session token'ı ile Supabase istemcisi oluştur
const authedSupabase = createClient(
  'https://remiwuslxbqlzuevecic.supabase.co',
  'sb_publishable_bWlpyQycwdlquuzoNBxNkg_1WiFqaOo',
  {
    global: { headers: { Authorization: `Bearer ${docAuth.session.access_token}` } }
  }
);

// Email'i onayla (auth.users tablosuna dogrudan erisim olmaz, RPC deneriz)
// Önce profili kontrol et
const { data: profile } = await authedSupabase
  .from('profiles')
  .select('id, full_name, role')
  .eq('id', docAuth.user.id)
  .maybeSingle();

console.log('Doktor profili:', profile?.role);

// Kullanıcının varlığını kontrol et
const { data: users } = await authedSupabase
  .from('profiles')
  .select('id, full_name, role')
  .order('created_at', { ascending: false })
  .limit(10);

console.log('Son profiller:', JSON.stringify(users));

// RPC ile email onayla (eğer exec_sql fonksiyonu varsa)
const { data: rpcResult, error: rpcError } = await authedSupabase.rpc('exec_sql', {
  query_text: `UPDATE auth.users SET email_confirmed_at = now() WHERE email = '${email}'`
});
if (rpcError) {
  console.log('RPC hatası (beklenen):', rpcError.message);
}
