import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import nearbyRouter from './routes/nearby.js';
import statusRouter from './routes/status.js';
import categoriesRouter from './routes/categories.js';
import vendorsRouter from './routes/vendors.js';
import adminRouter from './routes/admin.js';
import availabilityRouter from './routes/availability.js';
import notificationsRouter from './routes/notifications.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const origins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);

app.use(cors({ origin: origins.length ? origins : true }));
app.use(express.json());

// Generous global limit; status-report cooldown (5 min/vendor/user) is the
// real anti-abuse control and lives in the database trigger.
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/nearby', nearbyRouter);
app.use('/status', statusRouter);
app.use('/categories', categoriesRouter);
app.use('/vendors', vendorsRouter);
app.use('/admin', adminRouter);
app.use('/availability', availabilityRouter);
app.use('/notifications', notificationsRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`KLOMO backend listening on :${PORT}`);
});
