import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import appointmentRoutes from './routes/appointments.js';
import doctorRoutes from './routes/doctors.js';
import availabilityRoutes from './routes/availability.js';
import webhookRoutes from './routes/webhook.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Çok fazla istek gönderildi. Lütfen bekleyin.' },
});
app.use(limiter);

app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/whatsapp', webhookRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Sunucu hatası' });
});

app.listen(PORT, () => {
  console.log(`KIVON Randevu API running on port ${PORT}`);
});
