import { Router } from 'express';
import { supabase } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAgent } from '../middleware/requireAgent.js';

const router = Router();

// GET /admin/worklist — unclaimed/pending vendors ranked by recent user
// activity, i.e. exactly the "users have reviewed it, go sign them up" queue.
router.get('/worklist', requireAuth, requireAgent, async (_req, res) => {
  const { data, error } = await supabase
    .from('agent_worklist')
    .select('*')
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ worklist: data });
});

// PATCH /admin/vendors/:id/claim
// Called after an agent has physically visited and spoken to the vendor.
// { verificationLevel: 1|2, phone?, name?, address? }
router.patch('/vendors/:id/claim', requireAuth, requireAgent, async (req, res) => {
  const { id } = req.params;
  const { verificationLevel = 1, phone, name, address } = req.body;

  const updates = {
    claim_status: 'claimed',
    verification_level: verificationLevel,
    agent_visited_at: new Date().toISOString(),
    sourced_note: null, // the "please verify, sourced from Google" warning goes away
  };
  if (phone) updates.phone = phone;
  if (name) updates.name = name;
  if (address) updates.address = address;

  const { data, error } = await supabase
    .from('vendors')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ vendor: data });
});

// PATCH /admin/vendors/:id/flag-for-visit
// Manually escalate a listing into the visit queue outside the automatic
// report-count promotion (e.g. an agent spots it during unrelated fieldwork).
router.patch('/vendors/:id/flag-for-visit', requireAuth, requireAgent, async (req, res) => {
  const { data, error } = await supabase
    .from('vendors')
    .update({ claim_status: 'pending_agent_visit' })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ vendor: data });
});

// GET /admin/fraud-flags — unresolved fraud flags for agents to review,
// most recent first. See docs/FRAUD_DETECTION.md.
router.get('/fraud-flags', requireAuth, requireAgent, async (_req, res) => {
  const { data, error } = await supabase
    .from('fraud_flags')
    .select('id, flag_type, reporter_id, vendor_id, status_report_id, severity, details, created_at, vendors(name)')
    .is('reviewed_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  res.json({
    flags: data.map((f) => ({
      id: f.id,
      flagType: f.flag_type,
      reporterId: f.reporter_id,
      vendorId: f.vendor_id,
      vendorName: f.vendors?.name,
      severity: f.severity,
      details: f.details,
      createdAt: f.created_at,
    })),
  });
});

// PATCH /admin/fraud-flags/:id/resolve — mark reviewed after an agent has
// looked into it (whether or not any action was taken elsewhere).
router.patch('/fraud-flags/:id/resolve', requireAuth, requireAgent, async (req, res) => {
  const { error } = await supabase
    .from('fraud_flags')
    .update({ reviewed_at: new Date().toISOString(), reviewed_by: req.userId })
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
