import { Router } from 'express';
import { supabase } from '../db.js';
import { computeConfidence } from '../services/trustScore.js';

const router = Router();

// GET /nearby?category=cigarette&lat=18.52&lng=73.85&radius=3000
router.get('/', async (req, res) => {
  const { category, lat, lng, radius = 3000, limit = 20 } = req.query;

  if (!category || !lat || !lng) {
    return res.status(400).json({ error: 'category, lat, and lng are required' });
  }

  const { data: categoryRow, error: catError } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', category)
    .single();

  if (catError || !categoryRow) {
    return res.status(404).json({ error: `Unknown category: ${category}` });
  }

  const { data: vendors, error } = await supabase.rpc('nearby_vendors', {
    p_category_id: categoryRow.id,
    p_lat: Number(lat),
    p_lng: Number(lng),
    p_radius_m: Number(radius),
    p_limit: Number(limit),
  });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Enrich each vendor with a real confidence score computed from its
  // full recent report history (the RPC above only returns the latest one).
  const enriched = await Promise.all(
    vendors.map(async (v) => {
      const { data: reports } = await supabase
        .from('status_reports')
        .select('status, source, reporter_reputation_snapshot, reporter_was_present, flagged_suspicious, created_at')
        .eq('vendor_id', v.vendor_id)
        .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      const { confidence, status, reportCount, lastReportAt } = computeConfidence(
        reports || []
      );

      return {
        id: v.vendor_id,
        name: v.name,
        address: v.address,
        distanceMeters: Math.round(v.distance_m),
        verificationLevel: v.verification_level,
        claimStatus: v.claim_status,
        source: v.source,
        sourcedNote: v.sourced_note,
        latitude: v.latitude,
        longitude: v.longitude,
        status,
        confidence,
        reportCount,
        lastReportAt,
      };
    })
  );

  // Highest confidence first among "Open", closest distance breaks ties.
  enriched.sort((a, b) => {
    if (a.status === 'Open' && b.status !== 'Open') return -1;
    if (b.status === 'Open' && a.status !== 'Open') return 1;
    return a.distanceMeters - b.distanceMeters;
  });

  res.json({ category, vendors: enriched });
});

export default router;
