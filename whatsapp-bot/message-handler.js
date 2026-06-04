const EDGE_FUNCTION_URL = 'https://remiwuslxbqlzuevecic.supabase.co/functions/v1/whatsapp-webhook';

export async function handleMessage(msg, doctor) {
  const phone = msg.from.replace(/[^0-9]/g, '');
  const text = msg.body || '';

  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        message: text,
        doctorPhone: doctor?.whatsapp_number || ''
      })
    });

    const data = await res.json();
    return data.reply || 'Bir hata olustu.';
  } catch (err) {
    console.error('Edge Function hatasi:', err);
    return 'Sistem hatasi. Lutfen daha sonra tekrar deneyin.';
  }
}
