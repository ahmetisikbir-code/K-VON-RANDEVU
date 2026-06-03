import supabase from '../lib/supabase.js';

export default async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Yetkilendirme tokenı gerekli' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Geçersiz veya süresi dolmuş token' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    req.user = {
      ...user,
      profile: profile || {},
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ success: false, error: 'Kimlik doğrulama hatası' });
  }
}
