// Implements the confidence scoring algorithm described in docs/TRUST_SCORE.md.
// Kept as pure functions so it's independently testable without a DB.

const HALF_LIFE_MINUTES = 45;
const LAMBDA = Math.log(2) / HALF_LIFE_MINUTES;
const REPORT_WINDOW_HOURS = 6;
const CORROBORATION_DECAY = 0.6;

function decayFactor(minutesSinceReport) {
  return Math.exp(-LAMBDA * minutesSinceReport);
}

function baseWeight(report) {
  if (report.source === 'vendor') {
    // Presence-verified vendor response (filed while physically near the
    // shop) is the strongest single signal we have. A remote vendor claim
    // is weaker than before — an owner at home saying "open" is really a
    // guess about their staff. See docs/VERIFICATION_FLOW.md.
    if (report.reporter_was_present === true) return 85;
    if (report.reporter_was_present === false) return 55;
    return 70; // legacy reports predating presence capture
  }
  const reputation = report.reporter_reputation_snapshot ?? 50;
  return 40 + (reputation / 100) * 30;
}

// A report flagged by fraudDetection.js (reporter filing an abnormal
// number of reports in a short window) isn't discarded outright — an
// honest user having a busy hour is a false-positive risk we'd rather
// tolerate than silently delete real signal. Instead it's heavily
// discounted so it can barely move the score alone, but still contributes
// if it happens to agree with everything else. See docs/FRAUD_DETECTION.md.
const FRAUD_DISCOUNT_MULTIPLIER = 0.15;

function weightMultiplier(report) {
  return report.flagged_suspicious ? FRAUD_DISCOUNT_MULTIPLIER : 1;
}

/**
 * @param {Array<{status: 'open'|'closed', source: 'vendor'|'user', reporter_reputation_snapshot: number, created_at: string}>} reports
 * @param {Date} now
 * @returns {{ confidence: number, status: 'Open'|'Closed'|'Uncertain', reportCount: number, lastReportAt: string|null }}
 */
export function computeConfidence(reports, now = new Date()) {
  const windowMs = REPORT_WINDOW_HOURS * 60 * 60 * 1000;
  const recent = reports.filter(
    (r) => now.getTime() - new Date(r.created_at).getTime() <= windowMs
  );

  if (recent.length === 0) {
    return { confidence: 50, status: 'Uncertain', reportCount: 0, lastReportAt: null };
  }

  // Sort newest first so corroboration counting (n-th agreeing report) is correct.
  recent.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const openCount = { n: 0 };
  const closedCount = { n: 0 };
  let netScore = 0;

  for (const report of recent) {
    const minutesAgo = (now.getTime() - new Date(report.created_at).getTime()) / 60000;
    const decay = decayFactor(minutesAgo);
    const base = baseWeight(report);

    const bucket = report.status === 'open' ? openCount : closedCount;
    const corroborationMultiplier = Math.pow(CORROBORATION_DECAY, bucket.n);
    bucket.n += 1;

    const weight = base * decay * corroborationMultiplier * weightMultiplier(report);
    netScore += report.status === 'open' ? weight : -weight;
  }

  const confidence = Math.max(0, Math.min(100, 50 + netScore));

  let status;
  if (confidence >= 60) status = 'Open';
  else if (confidence <= 40) status = 'Closed';
  else status = 'Uncertain';

  return {
    confidence: Math.round(confidence),
    status,
    reportCount: recent.length,
    lastReportAt: recent[0].created_at,
  };
}

/**
 * Reputation nudge for a reporter once a later report agrees/disagrees with theirs.
 * Contradiction costs more than agreement earns (see docs/TRUST_SCORE.md).
 */
export function nextReputation(currentReputation, wasAgreedWith) {
  if (wasAgreedWith) return Math.min(100, currentReputation + 2);
  return Math.max(0, currentReputation - 5);
}
