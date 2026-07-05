import { Router } from 'express';
import { supabase } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /categories — the tap grid on the home screen
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('categories')
    .select('slug, label, icon')
    .order('sort_order', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ categories: data });
});

// GET /categories/trending?geohash=te7u — "Most sought after" toggle
router.get('/trending', async (req, res) => {
  const { geohash } = req.query;

  let query = supabase
    .from('trending_categories')
    .select('category_id, taps, categories(slug, label, icon)')
    .order('taps', { ascending: false })
    .limit(8);

  if (geohash) query = query.eq('city_geohash', geohash);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({
    trending: data.map((row) => ({
      slug: row.categories?.slug,
      label: row.categories?.label,
      icon: row.categories?.icon,
      taps: row.taps,
    })),
  });
});

// GET /categories/recent — "You looked for" toggle (requires auth so it's
// scoped to the caller only — RLS on search_events also enforces this).
router.get('/recent', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('search_events')
    .select('created_at, categories(slug, label, icon)')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return res.status(500).json({ error: error.message });

  // De-dupe by category, keep most recent occurrence
  const seen = new Set();
  const recent = [];
  for (const row of data) {
    const slug = row.categories?.slug;
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    recent.push({ slug, label: row.categories?.label, icon: row.categories?.icon });
  }

  res.json({ recent });
});

// POST /categories/log-search  { categorySlug, geohash }
// Called every time a user taps a category, powers both toggles above.
router.post('/log-search', requireAuth, async (req, res) => {
  const { categorySlug, geohash } = req.body;

  const { data: category } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', categorySlug)
    .single();

  if (!category) return res.status(404).json({ error: 'Unknown category' });

  const { error } = await supabase.from('search_events').insert({
    user_id: req.userId,
    category_id: category.id,
    city_geohash: geohash || null,
  });

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ ok: true });
});

export default router;
