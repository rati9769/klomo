import { Router } from 'express';
import { supabase } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /notifications/register-token  { token }
// Called after sign-in (never for anonymous sessions — see
// mobile/src/services/notifications.js) to store this device's Expo push
// token against the signed-in profile. Overwrites any previous token for
// this profile; a stale token from an old device just fails silently on
// send, which is an acceptable tradeoff for this simple a model.
router.post('/register-token', requireAuth, async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token is required' });
  }

  const { error } = await supabase
    .from('profiles')
    .update({ expo_push_token: token })
    .eq('id', req.userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
