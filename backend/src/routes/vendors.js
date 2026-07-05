import { Router } from 'express';
import { supabase } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /vendors  — shop owner onboarding
// { categorySlug, name, address, phone, lat, lng }
router.post('/', requireAuth, async (req, res) => {
  if (req.isAnonymous) {
    return res.status(403).json({
      error: 'Please sign in with phone/email before listing a shop, so you can manage it later.',
    });
  }

  const { categorySlug, name, address, phone, lat, lng } = req.body;
  if (!categorySlug || !name || lat == null || lng == null) {
    return res.status(400).json({ error: 'categorySlug, name, lat, lng are required' });
  }

  const { data: category } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', categorySlug)
    .single();

  if (!category) return res.status(404).json({ error: 'Unknown category' });

  const { data: vendor, error } = await supabase
    .from('vendors')
    .insert({
      owner_id: req.userId,
      category_id: category.id,
      name,
      address,
      phone,
      location: `SRID=4326;POINT(${lng} ${lat})`,
      verification_level: 1, // phone verified at this point via Supabase OTP sign-in
      source: 'owner_self',
      claim_status: 'claimed', // a real, signed-in person vouched for this in the app
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ vendor });
});

// GET /vendors/mine — a shop owner's own listings, for their dashboard
router.get('/mine', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('vendors')
    .select('id, name, address, verification_level, claim_status, is_active, created_at')
    .eq('owner_id', req.userId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ vendors: data });
});

// GET /vendors/verifications/pending — verification requests awaiting this
// owner's response, across all their shops. Powers the Account tab prompt.
router.get('/verifications/pending', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('verification_requests')
    .select('id, vendor_id, reported_status, created_at, vendors!inner(name, owner_id)')
    .eq('vendors.owner_id', req.userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });
  res.json({
    requests: data.map((r) => ({
      id: r.id,
      vendorId: r.vendor_id,
      vendorName: r.vendors?.name,
      reportedStatus: r.reported_status,
      createdAt: r.created_at,
    })),
  });
});

const PRESENCE_RADIUS_M = 150;

// POST /vendors/verifications/:id/respond
// { status: 'open'|'closed', lat?, lng? }
// The app captures the owner's current (foreground) location at response
// time; we compute distance to the shop server-side and file a
// vendor-source report with the presence flag set. See
// docs/VERIFICATION_FLOW.md for why weights differ by presence.
router.post('/verifications/:id/respond', requireAuth, async (req, res) => {
  const { status, lat, lng } = req.body;
  if (!['open', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'status must be open or closed' });
  }

  const { data: request } = await supabase
    .from('verification_requests')
    .select('id, vendor_id, status, vendors!inner(owner_id)')
    .eq('id', req.params.id)
    .single();

  if (!request) return res.status(404).json({ error: 'Verification request not found' });
  if (request.vendors?.owner_id !== req.userId) {
    return res.status(403).json({ error: 'Only the shop owner can respond to this' });
  }
  if (request.status !== 'pending') {
    return res.status(409).json({ error: 'This request was already handled' });
  }

  // Presence: compute distance from the owner's reported position to the
  // shop, using the same PostGIS machinery as the discovery query. If the
  // app couldn't get a location (permission denied etc.), presence is
  // false — an unverifiable claim shouldn't get the bonus.
  let wasPresent = false;
  if (lat != null && lng != null) {
    const { data: distance } = await supabase.rpc('vendor_distance_m', {
      p_vendor_id: request.vendor_id,
      p_lat: Number(lat),
      p_lng: Number(lng),
    });
    if (distance != null && Number(distance) <= PRESENCE_RADIUS_M) wasPresent = true;
  }

  const { data: report, error: reportError } = await supabase
    .from('status_reports')
    .insert({
      vendor_id: request.vendor_id,
      reporter_id: req.userId,
      status,
      source: 'vendor',
      reporter_reputation_snapshot: 50,
      reporter_was_present: wasPresent,
    })
    .select()
    .single();

  if (reportError) return res.status(409).json({ error: reportError.message });

  await supabase
    .from('verification_requests')
    .update({ status: 'responded', responded_at: new Date().toISOString() })
    .eq('id', request.id);

  res.json({ report, wasPresent });
});

export default router;
