# The Local Availability Graph

The headline feature added in this rebuild. It answers a question Google
Maps can't: "right now, how many places nearby are actually open, and is
that changing?"

## What it looks like in the app

- **Home screen**: a "Local Pulse" card right under the hero — one number
  (e.g. "64% of nearby shops open right now") plus a small live sparkline.
  Tapping it opens the full breakdown.
- **Local Pulse screen**: every category ranked by current open percentage,
  each as a colored bar (using that category's own color identity from
  `categories.js`). Tapping a bar goes to that category's results.
- **Category results screen**: a full graph at the top — current open % as
  a big number, a 24-hour line/area chart underneath, live-updating.

## Why it's not a separate model

It's the exact same confidence algorithm from `docs/TRUST_SCORE.md`, just
evaluated at many points in time instead of only "now." `computeConfidence()`
already takes a `now` parameter — the graph is built by calling it once per
hour for the last 24 hours, each time pretending "now" was that hour, using
only the reports that existed by then:

```js
for (let hourMark of last24Hours) {
  const reportsUpToThatHour = allReports.filter(r => r.created_at <= hourMark);
  const { confidence, status } = computeConfidence(reportsUpToThatHour, hourMark);
  // ... aggregate across vendors for that hour
}
```

This means the graph is never lying relative to the point-in-time status
shown elsewhere in the app — it's a replay of the same math, not a
second, potentially-inconsistent system.

## Endpoints

- `GET /availability/graph?category=chemist&lat=&lng=&radius=3000&hours=24`
  Returns an hourly series for one category in one area: average confidence,
  open percentage, and how many vendors had any reports at all that hour
  (low `vendorsReporting` early in the app's life is expected and honestly
  reported, not papered over with a fake number).

- `GET /availability/pulse?lat=&lng=&radius=3000`
  Returns a current (not historical) snapshot across every category —
  what powers the home screen teaser and the Local Pulse screen.

## Known limitation, on purpose

With few reports (a brand-new deployment, or a quiet category), the graph
will look flat or sparse — this is correct behavior, not a bug to "fix" by
inventing synthetic data. The graph gets more useful as real usage
accumulates; it should never fabricate confidence it doesn't have evidence
for. This mirrors the trust score's core principle: an honest "not enough
data" beats a confident-looking guess.
