# Team review fixes — 2026-09-18

Manual browser QA: `node scripts/qa/team-review-shots.mjs`, using temporary empty project hosts, no live data.

- Login to A and B on the same hostname with one browser cookie jar: A 200, B 200.
- Logout of B: A remains 200 (previous behavior: A became 401 after B login).
- Viewer editor boots, database navigation opens, 56 authored controls disabled; search/navigation remain available. Screenshot includes the read-only badge and disabled add/duplicate/delete/save controls.
- App TypeScript check, Electron build and packaged web build passed. Existing bundle/CSS warnings remain.
- Added HTTP cookie isolation, viewer store mutation and lock recovery regression contracts. Test runners were not executed under the repository's explicit-request rule. Lock recovery was code-reviewed; no claim of executed fault-injection tests.
