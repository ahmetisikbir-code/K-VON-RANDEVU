import { Router } from 'express';
import supabase from '../lib/supabase.js';

const router = Router();

const SECTOR_TYPES = ['doktor', 'kuaför', 'güzellik_salonu'];

router.post('/', async (req, res) => {
  try {
    const { ad, soyad, email, password, telefon, sektor } = req.body;

    if (!ad || !soyad || !email || !password) {
      return res.status(400).json({ success: false, error: 'Ad, soyad, email ve şifre gerekli' });
    }
    if (!sektor || !SECTOR_TYPES.includes(sektor)) {
      return res.status(400).json({ success: false, error: `Geçerli bir sektör seçin: ${SECTOR_TYPES.join(', ')}` });
    }

    const full_name = `${ad} ${soyad}`;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, phone: telefon, sector: sektor },
      },
    });

    if (authError) {
      return res.status(400).json({ success: false, error: authError.message });
    }

    if (!authData.user) {
      return res.status(500).json({ success: false, error: 'Kullanıcı oluşturulamadı' });
    }

    const profilePayload = {
      id: authData.user.id,
      email,
      first_name: ad,
      last_name: soyad,
      full_name,
      phone: telefon || '',
      sector: sektor,
      role: sektor === 'doktor' ? 'doctor' : sektor,
    };

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert(profilePayload)
      .select()
      .single();

    if (profileError) {
      console.error('Profile upsert error:', profileError);
    }

    return res.status(201).json({
      success: true,
      message: 'Kaydınız başarıyla oluşturuldu',
      user: authData.user,
      profile: profile || profilePayload,
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, error: 'Kayıt işlemi başarısız' });
  }
});

export default router;
