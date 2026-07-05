import { supabase } from '../db.js';

/**
 * Chain after requireAuth. Confirms the caller's profile has is_agent = true
 * before letting them touch the agent worklist or claim vendors. Field
 * agents are flagged manually in Supabase (update profiles.is_agent) —
 * there's no self-serve way to become one, on purpose.
 */
export async function requireAgent(req, res, next) {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_agent')
    .eq('id', req.userId)
    .single();

  if (error || !data?.is_agent) {
    return res.status(403).json({ error: 'Agent access required' });
  }
  next();
}
