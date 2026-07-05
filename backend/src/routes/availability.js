import { Router } from 'express';
import { supabase } from '../db.js';
import { computeConfidence } from '../services/trustScore.js';

const router = Router();

async function getNearbyVendorIds(categoryId, lat, lng, radiusM) {
  const { data, error } = await supabase.rpc('nearby_vendors', {
    p_category_id: categoryId,
    p_lat: Number(lat),
    p_lng: Number(lng),
    p_radius_m: Number(radiusM),
    p_limit: 200,
  });
  if (error) throw error;
  return (data || []).map((v) => v.vendor_id);
}

async function getReportsSince(vendorIds, sinceIso) {
  if (vendorIds.length === 0) return [];
  const { data, error } = await supabase
    .from('status_reports')
    .select('vendor_id, status, source, reporter_reputation_snapshot, reporter_was_present, flagged_suspicious, created_at')
    .in('vendor_id', vendorIds)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

function groupByVendor(reports) {
  const map = new Map();
  for (const r of reports) {
    if (!map.has(r.vendor_id)) map.set(r.vendor_id, []);
    map.get(r.vendor_id).push(r);
  }
  return map;
}

/**
 * Evaluates every vendor's confidence AS OF a given past hour by reusing
 * computeConfidence with `now` set to that hour — the same 45-minute-decay,
 * diminishing-corroboration math from docs/TRUST_SCORE.md, just replayed at
 * each point instead of only "right now." This is the whole Local
 * Availability Graph: no separate model, just the trust score sampled over
 * time. See docs/AVAILABILITY_GRAPH.md.
 */
function buildHourlySeries(vendorIds, reportsByVendor, hours) {
  const now = new Date();
  const series = [];

  for (let i = hours - 1; i >= 0; i--) {
    const hourMark = new Date(now.getTime() - i * 60 * 60 * 1000);
    let confidenceSum = 0;
    let openCount = 0;
    let vendorsWithData = 0;

    for (const vendorId of vendorIds) {
      const reports = reportsByVendor.get(vendorId) || [];
      const relevant = reports.filter((r) => new Date(r.created_at) <= hourMark);
      const { confidence, status, reportCount } = computeConfidence(relevant, hourMark);
      if (reportCount > 0) {
        vendorsWithData += 1;
        confidenceSum += confidence;
        if (status === 'Open') openCount += 1;
      }
    }

    series.push({
      hour: hourMark.toISOString(),
      hourLabel: hourMark.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      avgConfidence: vendorsWithData > 0 ? Math.round(confidenceSum / vendorsWithData) : 50,
      openPercentage:
        vendorsWithData > 0 ? Math.round((openCount / vendorsWithData) * 100) : null,
      vendorsReporting: vendorsWithData,
      totalVendors: vendorIds.length,
    });
  }

  return series;
}

// GET /availability/graph?category=chemist&lat=&lng=&radius=3000&hours=24
router.get('/graph', async (req, res) => {
  const { category, lat, lng, radius = 3000, hours = 24 } = req.query;
  if (!category || !lat || !lng) {
    return res.status(400).json({ error: 'category, lat, and lng are required' });
  }

  const { data: categoryRow } = await supabase
    .from('categories')
    .select('id, label, icon')
    .eq('slug', category)
    .single();
  if (!categoryRow) return res.status(404).json({ error: `Unknown category: ${category}` });

  try {
    const vendorIds = await getNearbyVendorIds(categoryRow.id, lat, lng, radius);
    const hoursNum = Math.min(Number(hours), 72);
    const since = new Date(Date.now() - (hoursNum + 6) * 60 * 60 * 1000).toISOString();
    const reports = await getReportsSince(vendorIds, since);
    const reportsByVendor = groupByVendor(reports);
    const series = buildHourlySeries(vendorIds, reportsByVendor, hoursNum);

    res.json({
      category: { slug: category, label: categoryRow.label, icon: categoryRow.icon },
      totalVendors: vendorIds.length,
      current: series[series.length - 1] || null,
      series,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /availability/pulse?lat=&lng=&radius=3000
// Area-wide, all-category snapshot — powers the home screen "Local Pulse"
// teaser and the full breakdown on LocalPulseScreen.
router.get('/pulse', async (req, res) => {
  const { lat, lng, radius = 3000 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, slug, label, icon')
    .order('sort_order', { ascending: true });
  if (catError) return res.status(500).json({ error: catError.message });

  try {
    const breakdown = await Promise.all(
      categories.map(async (cat) => {
        const vendorIds = await getNearbyVendorIds(cat.id, lat, lng, radius);
        if (vendorIds.length === 0) {
          return { slug: cat.slug, label: cat.label, icon: cat.icon, openPercentage: null, totalVendors: 0 };
        }
        const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
        const reports = await getReportsSince(vendorIds, since);
        const reportsByVendor = groupByVendor(reports);

        let openCount = 0;
        let vendorsWithData = 0;
        for (const vendorId of vendorIds) {
          const vendorReports = reportsByVendor.get(vendorId) || [];
          const { status, reportCount } = computeConfidence(vendorReports);
          if (reportCount > 0) {
            vendorsWithData += 1;
            if (status === 'Open') openCount += 1;
          }
        }

        return {
          slug: cat.slug,
          label: cat.label,
          icon: cat.icon,
          openPercentage: vendorsWithData > 0 ? Math.round((openCount / vendorsWithData) * 100) : null,
          totalVendors: vendorIds.length,
          vendorsReporting: vendorsWithData,
        };
      })
    );

    const withData = breakdown.filter((c) => c.openPercentage !== null);
    const overallPercentage =
      withData.length > 0
        ? Math.round(withData.reduce((sum, c) => sum + c.openPercentage, 0) / withData.length)
        : null;

    res.json({ overallPercentage, categories: breakdown });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
