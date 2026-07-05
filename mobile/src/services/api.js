import { getAccessToken } from './supabase';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

async function request(path, { method = 'GET', body } = {}) {
  let token = null;
  try {
    token = await getAccessToken();
  } catch (e) {
    // Don't let a failed session bootstrap break endpoints that don't even
    // need auth (categories, nearby, etc.) — just proceed without a token.
    // If the endpoint DOES require one, the backend's 401 below carries a
    // clearer explanation than a generic thrown error would here.
    console.warn('getAccessToken failed:', e.message);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(
        `Not signed in (${json.error || 'missing session'}). This usually means the app couldn't create an anonymous session — check that "Anonymous Sign-Ins" is enabled in your Supabase project, or sign in with email from the Account tab.`
      );
    }
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json;
}

export const api = {
  categories: () => request('/categories'),
  trending: (geohash) => request(`/categories/trending${geohash ? `?geohash=${geohash}` : ''}`),
  recent: () => request('/categories/recent'),
  logSearch: (categorySlug, geohash) =>
    request('/categories/log-search', { method: 'POST', body: { categorySlug, geohash } }),

  nearby: ({ category, lat, lng, radius }) =>
    request(`/nearby?category=${category}&lat=${lat}&lng=${lng}&radius=${radius || 3000}`),

  reportStatus: (vendorId, status, source = 'user') =>
    request('/status/report', { method: 'POST', body: { vendorId, status, source } }),

  registerVendor: (payload) => request('/vendors', { method: 'POST', body: payload }),
  myVendors: () => request('/vendors/mine'),

  // Vendor status verification — see docs/VERIFICATION_FLOW.md
  pendingVerifications: () => request('/vendors/verifications/pending'),
  respondToVerification: (id, payload) =>
    request(`/vendors/verifications/${id}/respond`, { method: 'POST', body: payload }),

  // Push notifications — see docs/PUSH_NOTIFICATIONS.md
  registerPushToken: (token) => request('/notifications/register-token', { method: 'POST', body: { token } }),

  // Agent-only — requires profiles.is_agent = true for the signed-in user.
  agentWorklist: () => request('/admin/worklist'),
  claimVendor: (vendorId, payload) =>
    request(`/admin/vendors/${vendorId}/claim`, { method: 'PATCH', body: payload }),
  flagVendorForVisit: (vendorId) =>
    request(`/admin/vendors/${vendorId}/flag-for-visit`, { method: 'PATCH' }),

  // Local Availability Graph — see docs/AVAILABILITY_GRAPH.md
  availabilityGraph: ({ category, lat, lng, radius, hours = 24 }) =>
    request(`/availability/graph?category=${category}&lat=${lat}&lng=${lng}&radius=${radius || 3000}&hours=${hours}`),
  availabilityPulse: ({ lat, lng, radius }) =>
    request(`/availability/pulse?lat=${lat}&lng=${lng}&radius=${radius || 3000}`),
};
