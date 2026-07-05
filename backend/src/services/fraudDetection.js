// Rule-based fraud checks, deliberately simple — see docs/FRAUD_DETECTION.md
// for the reasoning and honest limitations. These are heuristics, not a
// model: they catch obvious velocity abuse and coordinated bursts, and
// route anything ambiguous to a human agent rather than having the system
// silently decide someone is lying. Never let a flag here delete data or
// auto-change a vendor's claim status — that's an escalation path, not an
// enforcement action.

const REPORTER_VELOCITY_WINDOW_MIN = 60;
const REPORTER_VELOCITY_THRESHOLD = 8; // reports across ANY vendors in the window

const VENDOR_BURST_WINDOW_MIN = 20;
const VENDOR_BURST_DISTINCT_REPORTERS_THRESHOLD = 4;

/**
 * Has this reporter filed an unusually high number of reports recently,
 * across any vendor? Legitimate users rarely report more than one or two
 * shops in an hour — this catches scripted/bot-style report flooding.
 */
export async function checkReporterVelocity(supabase, reporterId) {
  const since = new Date(Date.now() - REPORTER_VELOCITY_WINDOW_MIN * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('status_reports')
    .select('id', { count: 'exact', head: true })
    .eq('reporter_id', reporterId)
    .gte('created_at', since);

  if (error) {
    console.error('checkReporterVelocity failed:', error.message);
    return false; // fail open — a broken check shouldn't block legitimate reports
  }
  return (count || 0) >= REPORTER_VELOCITY_THRESHOLD;
}

/**
 * Has this vendor received reports from an unusually high number of
 * DISTINCT reporters in a short window? Genuine fast consensus (several
 * real passers-by noticing the same thing) looks similar to a coordinated
 * attack — that's exactly why this doesn't auto-suppress anything, it just
 * queues the vendor for a human agent to glance at. See
 * docs/FRAUD_DETECTION.md "false positives are expected" section.
 */
export async function checkVendorBurst(supabase, vendorId) {
  const since = new Date(Date.now() - VENDOR_BURST_WINDOW_MIN * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('status_reports')
    .select('reporter_id')
    .eq('vendor_id', vendorId)
    .gte('created_at', since);

  if (error) {
    console.error('checkVendorBurst failed:', error.message);
    return false;
  }
  const distinctReporters = new Set((data || []).map((r) => r.reporter_id));
  return distinctReporters.size >= VENDOR_BURST_DISTINCT_REPORTERS_THRESHOLD;
}

/**
 * Runs both checks after a report is inserted, marks the report flagged
 * if the reporter is over the velocity threshold (discounts its trust-score
 * weight — see trustScore.js), and logs a fraud_flags row for anything an
 * agent should look at. Never throws — a fraud-check failure must never
 * block the underlying report from succeeding.
 */
export async function runFraudChecks(supabase, { reportId, reporterId, vendorId }) {
  try {
    const isVelocityAbuse = await checkReporterVelocity(supabase, reporterId);
    if (isVelocityAbuse) {
      await supabase.from('status_reports').update({ flagged_suspicious: true }).eq('id', reportId);
      await supabase.from('fraud_flags').insert({
        flag_type: 'reporter_velocity',
        reporter_id: reporterId,
        vendor_id: vendorId,
        status_report_id: reportId,
        severity: 'medium',
        details: { window_minutes: REPORTER_VELOCITY_WINDOW_MIN, threshold: REPORTER_VELOCITY_THRESHOLD },
      });
    }

    const isVendorBurst = await checkVendorBurst(supabase, vendorId);
    if (isVendorBurst) {
      await supabase.from('fraud_flags').insert({
        flag_type: 'vendor_burst',
        vendor_id: vendorId,
        status_report_id: reportId,
        severity: 'high',
        details: { window_minutes: VENDOR_BURST_WINDOW_MIN, threshold: VENDOR_BURST_DISTINCT_REPORTERS_THRESHOLD },
      });
    }
  } catch (e) {
    console.error('runFraudChecks failed (non-fatal, report already succeeded):', e.message);
  }
}
