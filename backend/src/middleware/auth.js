import { supabase } from '../db.js';

/**
 * Verifies the bearer token issued by Supabase Auth (works identically for
 * anonymous and signed-in sessions — an anonymous user still has a valid
 * auth.uid()). We never see or store a password here; we're just asking
 * Supabase "is this token valid, and whose is it."
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  req.userId = data.user.id;
  req.isAnonymous = data.user.is_anonymous ?? false;
  next();
}
