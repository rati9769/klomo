// Onboarding path B: bulk-seed vendors from Google Places so the app isn't
// empty on day one. Every row this script writes gets claim_status =
// 'unclaimed' and a sourced_note warning — nobody at the shop has confirmed
// anything yet. Path A (backend/scripts/manualOutreach.md) is the other
// half: an agent physically signing shops up, which starts them 'claimed'.
//
// Usage:
//   GOOGLE_PLACES_API_KEY=... node scripts/importFromGooglePlaces.js \
//     --lat 18.5204 --lng 73.8567 --radius 3000 --category cigarette
//
// Needs GOOGLE_PLACES_API_KEY and the Supabase service role env vars from
// .env (same as the main server). Google's free monthly credit ($200) covers
// several thousand of these calls — see docs/DEPLOYMENT.md for setup.

import { supabase } from '../src/db.js';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!GOOGLE_PLACES_API_KEY) {
  console.error('Missing GOOGLE_PLACES_API_KEY in the environment.');
  process.exit(1);
}

// Maps our category slugs to a Google Places "type" or text-search query.
// Places' typed search is more reliable than free text where a type exists.
const CATEGORY_QUERY = {
  cigarette: { type: 'convenience_store', keyword: 'cigarette paan shop' },
  chemist: { type: 'pharmacy' },
  water: { type: 'store', keyword: 'water can supplier' },
  petrol: { type: 'gas_station' },
  chai: { type: 'cafe', keyword: 'tea stall chai' },
  atm: { type: 'atm' },
  grocery: { type: 'grocery_or_supermarket' },
  medical_emergency: { type: 'hospital' },
  mechanic: { type: 'car_repair' },
  food: { type: 'restaurant', keyword: 'late night food' },
};

// Generic, honest starting descriptions — deliberately vague, since we
// haven't actually confirmed what a shop stocks. Refined once an agent visits.
const GENERIC_ITEM_GUESS = {
  cigarette: 'Likely stocks cigarettes/paan based on shop type — unconfirmed',
  chemist: 'Pharmacy — medicines and basic health items, unconfirmed stock',
  water: 'Likely sells packaged/canned drinking water — unconfirmed',
  petrol: 'Fuel station — services unconfirmed',
  chai: 'Tea/coffee stall — menu unconfirmed',
  atm: 'ATM — bank and cash availability unconfirmed',
  grocery: 'General grocery/kirana store — stock unconfirmed',
  medical_emergency: 'Medical facility — services and hours unconfirmed',
  mechanic: 'Vehicle repair — specific services unconfirmed',
  food: 'Food outlet — late-night hours unconfirmed',
};

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((arg, i, arr) => {
    if (arg.startsWith('--')) args[arg.slice(2)] = arr[i + 1];
  });
  return args;
}

async function fetchNearbyPlaces({ lat, lng, radius, type, keyword }) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('radius', radius);
  url.searchParams.set('key', GOOGLE_PLACES_API_KEY);
  if (type) url.searchParams.set('type', type);
  if (keyword) url.searchParams.set('keyword', keyword);

  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
    throw new Error(`Places API error: ${json.status} ${json.error_message || ''}`);
  }
  return json.results || [];
}

async function importCategory(categorySlug, { lat, lng, radius }) {
  const query = CATEGORY_QUERY[categorySlug];
  if (!query) throw new Error(`No Places query mapping for category "${categorySlug}"`);

  const { data: category } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', categorySlug)
    .single();
  if (!category) throw new Error(`Unknown category slug "${categorySlug}" in DB`);

  const places = await fetchNearbyPlaces({ lat, lng, radius, ...query });
  console.log(`Found ${places.length} candidates for "${categorySlug}"`);

  let inserted = 0;
  let skipped = 0;

  for (const place of places) {
    if (!place.geometry?.location) continue;

    // Upsert on google_place_id so re-running this script is safe and never
    // duplicates a listing or clobbers a since-claimed vendor.
    const { data: existing } = await supabase
      .from('vendors')
      .select('id, claim_status')
      .eq('google_place_id', place.place_id)
      .maybeSingle();

    if (existing) {
      skipped += 1;
      continue;
    }

    const { error } = await supabase.from('vendors').insert({
      category_id: category.id,
      name: place.name,
      address: place.vicinity || null,
      location: `SRID=4326;POINT(${place.geometry.location.lng} ${place.geometry.location.lat})`,
      source: 'google_places_import',
      claim_status: 'unclaimed',
      google_place_id: place.place_id,
      sourced_note:
        `Imported from Google. ${GENERIC_ITEM_GUESS[categorySlug]}. ` +
        `Nobody at this shop has confirmed it on KLOMO yet — please verify before relying on it.`,
      verification_level: 0,
    });

    if (error) {
      console.error(`  failed to insert ${place.name}:`, error.message);
    } else {
      inserted += 1;
    }
  }

  console.log(`"${categorySlug}": inserted ${inserted}, skipped ${skipped} already-known`);
}

async function main() {
  const args = parseArgs();
  const lat = Number(args.lat);
  const lng = Number(args.lng);
  const radius = Number(args.radius || 3000);
  const categories = args.category ? [args.category] : Object.keys(CATEGORY_QUERY);

  if (!lat || !lng) {
    console.error('Usage: node importFromGooglePlaces.js --lat <lat> --lng <lng> [--radius 3000] [--category cigarette]');
    process.exit(1);
  }

  for (const slug of categories) {
    await importCategory(slug, { lat, lng, radius });
    // Small delay to stay well under Places API rate limits.
    await new Promise((r) => setTimeout(r, 300));
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
