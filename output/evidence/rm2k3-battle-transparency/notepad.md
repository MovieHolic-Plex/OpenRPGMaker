# RM2K3 battle transparency notepad

## Bootstrap

- Skills: `omo:ulw-loop` for evidence-bound execution, `browser-evidence-qa` for real browser screenshots.
- Tier: LIGHT. The change is a narrow generated-asset transparency fix plus manifest hash update inside existing battle asset flow.

## Success Criteria

1. RED/GREEN asset proof: `hero-01-battle.png` through `hero-04-battle.png` contain no opaque magenta/chroma-key background pixels and preserve nonzero transparent pixels.
2. Browser proof: a real battle scene screenshot shows all four actor sprites with no colored transparency boxes, with battle still reaching victory.

## Plan

1. Measure current PNG alpha/chroma state and capture RED.
2. Convert actor battle charsets' chroma-key pixels to alpha and update manifest hashes.
3. Re-run alpha audit, browser evidence, typecheck, targeted asset/battle tests.

## Results

- RED: `red-alpha-audit.json` found opaque/near-magenta pixels in all four actor battle charsets.
- GREEN: `green-alpha-audit.json` removed opaque/near-magenta pixels.
- User steering: mobile ignored; desktop Burns issue remained visually cyan-like.
- GREEN 2: rebuilt actor variants from transparent `hero-01-battle.png`; `hero-03-battle.png` now uses an orange/brown mage palette and `green-alpha-audit-2.json` reports zero cyan key-like pixels for hero-03.
- Browser evidence: `desktop-reference-entry.png` and `desktop-burns-transparent-crop.png` show no colored transparency boxes around actors.
- Verification: `npm run typecheck -- --pretty false`, targeted Vitest asset tests, and targeted Playwright battle tests passed.
- User steering 2: the generated sprite shape still looked wrong in the crop. Replaced all four actor battle charsets with clean hand-built transparent 48x48 pixel battle sprites, avoiding generated chroma/fringe artifacts entirely.
- Final evidence: `clean-procedural-sprite-audit.json`, refreshed `desktop-reference-entry.png`, and refreshed `desktop-burns-transparent-crop.png`.
