import { Router } from 'express';
import supabase from '../lib/supabase.js';
import auth from '../middleware/auth.js';

const router = Router();

router.post('/signup', async (req, res) => {
  try {
    const { email, password, full_name, phone } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email ve şifre gerekli' });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, phone },
      },
    });

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert([
        {
          id: data.user.id,
          email,
          full_name: full_name || '',
          phone: phone || '',
          role: 'patient',
        },
      ]);

      if (profileError) {
        console.error('Profile creation error:', profileError);
      }
    }

    return res.status(201).json({ success: true, data });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ success: false, error: 'Kayıt işlemi başarısız' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email ve şifre gerekli' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ success: false, error: 'Email veya şifre hatalı' });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, error: 'Giriş işlemi başarısız' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      await supabase.auth.admin.signOut(token);
    }

    return res.json({ success: true, data: null });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ success: false, error: 'Çıkış işlemi başarısız' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({ success: false, error: 'Profil bulunamadı' });
    }

    return res.json({ success: true, data: { user: req.user, profile } });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ success: false, error: 'Profil alınamadı' });
  }
});

router.put('/me', auth, async (req, res) => {
  try {
    const { full_name, phone, avatar_url } = req.body;
    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ success: false, error: 'Profil güncellenemedi' });
  }
});

router.post('/become-doctor', auth, async (req, res) => {
  try {
    const { specialty, bio, consultation_fee, license_number } = req.body;

    const { error: roleError } = await supabase
      .from('profiles')
      .update({ role: 'doctor', updated_at: new Date().toISOString() })
      .eq('id', req.user.id);

    if (roleError) {
      return res.status(400).json({ success: false, error: roleError.message });
    }

    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .insert([
        {
          id: req.user.id,
          specialty: specialty || 'Genel',
          bio: bio || '',
          consultation_fee: consultation_fee || 0,
          license_number: license_number || '',
        },
      ])
      .select()
      .single();

    if (doctorError) {
      await supabase
        .from('profiles')
        .update({ role: 'patient', updated_at: new Date().toISOString() })
        .eq('id', req.user.id);
      return res.status(400).json({ success: false, error: doctorError.message });
    }

    return res.status(201).json({ success: true, data: doctor });
  } catch (err) {
    console.error('Become doctor error:', err);
    return res.status(500).json({ success: false, error: 'Doktor kaydı oluşturulamadı' });
  }
});

export default router;
