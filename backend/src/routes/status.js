import { Router } from 'express';
import { supabase } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { nextReputation } from '../services/trustScore.js';
import { runFraudChecks } from '../services/fraudDetection.js';
import { sendPushNotification } from '../services/pushNotifications.js';

const router = Router();

async function notifyVendorOfVerificationRequest(ownerId, vendorId, reportedStatus) {
  const [{ data: profile }, { data: vendor }] = await Promise.all([
    supabase.from('profiles').select('expo_push_token').eq('id', ownerId).single(),
    supabase.from('vendors').select('name').eq('id', vendorId).single(),
  ]);

  if (!profile?.expo_push_token) return; // owner has no device registered — nothing to send

  await sendPushNotification(profile.expo_push_token, {
    title: 'Confirm your shop status',
    body: `A customer reported ${vendor?.name || 'your shop'} as ${reportedStatus}. Is that right?`,
    data: { type: 'verification_request', vendorId },
  });
}

// POST /status/report  { vendorId, status: 'open'|'closed', source: 'vendor'|'user' }
router.post('/report', requireAuth, async (req, res) => {
  const { vendorId, status, source = 'user' } = req.body;

  if (!vendorId || !['open', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'vendorId and a valid status are required' });
  }

  if (source === 'vendor') {
    const { data: vendor } = await supabase
      .from('vendors')
      .select('owner_id')
      .eq('id', vendorId)
      .single();

    if (!vendor || vendor.owner_id !== req.userId) {
      return res
        .status(403)
        .json({ error: 'Only the verified owner can file a vendor-source report' });
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('reputation_score, reports_total')
    .eq('id', req.userId)
    .single();

  const { data: inserted, error } = await supabase
    .from('status_reports')
    .insert({
      vendor_id: vendorId,
      reporter_id: req.userId,
      status,
      source,
      reporter_reputation_snapshot: profile?.reputation_score ?? 50,
    })
    .select()
    .single();

  if (error) {
    // Cooldown trigger raises a Postgres exception, which surfaces here.
    return res.status(409).json({ error: error.message });
  }

  // Fraud checks run after the report succeeds and never block or alter
  // it — they discount trust-score weight and/or queue a vendor for human
  // review. See docs/FRAUD_DETECTION.md.
  await runFraudChecks(supabase, { reportId: inserted.id, reporterId: req.userId, vendorId });

  // If a USER reported on a CLAIMED vendor, ask the owner to verify. Shows
  // up in the owner's Account tab; their response files a vendor report
  // with presence weighting. See docs/VERIFICATION_FLOW.md.
  if (source === 'user') {
    const { data: reportedVendor, error: vendorLookupError } = await supabase
      .from('vendors')
      .select('owner_id, claim_status')
      .eq('id', vendorId)
      .single();

    if (vendorLookupError) {
      console.error('verification: vendor lookup failed:', vendorLookupError.message);
    } else if (reportedVendor?.owner_id && reportedVendor.claim_status === 'claimed') {
      // One open request per vendor at a time — don't stack duplicates.
      const { data: existing, error: existingError } = await supabase
        .from('verification_requests')
        .select('id')
        .eq('vendor_id', vendorId)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingError) {
        // Most likely cause: migration 003 hasn't been run yet, so this
        // table doesn't exist. Logging it (instead of swallowing it) is
        // the whole difference between "silently no rows ever appear" and
        // "an obvious error in the Render logs telling you why."
        console.error(
          'verification_requests lookup failed (did you run migration 003?):',
          existingError.message
        );
      } else if (!existing) {
        const { data: verificationRequest, error: insertError } = await supabase
          .from('verification_requests')
          .insert({
            vendor_id: vendorId,
            triggering_report_id: inserted.id,
            reported_status: status,
          })
          .select()
          .single();

        if (insertError) {
          console.error('verification_requests insert failed:', insertError.message);
        } else {
          // Best-effort push — never let a notification failure affect the
          // report itself. See docs/PUSH_NOTIFICATIONS.md.
          notifyVendorOfVerificationRequest(reportedVendor.owner_id, vendorId, status).catch((e) =>
            console.error('push notification failed (non-fatal):', e.message)
          );
        }
      }
    }
  }

  // Reconcile: does this report agree or disagree with the immediately
  // preceding one from a different reporter? Nudge that earlier reporter's
  // reputation accordingly. This is intentionally simple (last-vs-new
  // comparison) rather than re-scoring the whole history on every write.
  const { data: previous } = await supabase
    .from('status_reports')
    .select('id, reporter_id, status')
    .eq('vendor_id', vendorId)
    .neq('id', inserted.id)
    .neq('reporter_id', req.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previous?.reporter_id) {
    const { data: prevProfile } = await supabase
      .from('profiles')
      .select('reputation_score, reports_total, reports_confirmed')
      .eq('id', previous.reporter_id)
      .single();

    if (prevProfile) {
      const agreed = previous.status === status;
      await supabase
        .from('profiles')
        .update({
          reputation_score: nextReputation(prevProfile.reputation_score, agreed),
          reports_confirmed: prevProfile.reports_confirmed + (agreed ? 1 : 0),
        })
        .eq('id', previous.reporter_id);
    }
  }

  await supabase
    .from('profiles')
    .update({ reports_total: (profile?.reports_total ?? 0) + 1 })
    .eq('id', req.userId);

  res.status(201).json({ report: inserted });
});

export default router;
