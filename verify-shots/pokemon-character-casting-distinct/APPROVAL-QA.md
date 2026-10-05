# Character casting QA

23 focused checks passed. Production decisions: 0. Synthetic approvals are only in disposable fixture storage.

Inspect live-320.png first.

- PASS six distinct current candidates and six preserved withdrawn candidates
- PASS producer-withdrawn old candidate cannot build while user decisions remain untouched
- PASS renamed candidate/collection cannot bypass color-independent repeated-body gate
- PASS pending candidate cannot build
- PASS Allow stays disabled until four observations checked
- PASS frame slider freezes visible native/correct integer-scale previews
- PASS frame slider produces native68x32 texture pixels
- PASS GIF animation can resume
- PASS server rejects Allow with missing observations
- PASS browser Allow persists and enables native gate/build
- PASS approved build preserves native/output dimensions and receipt
- PASS decision survives browser reload
- PASS approved package download is actual zip
- PASS Deny revokes old approval and blocks download
- PASS role has one current Allow and switching variants invalidates old build permission
- PASS changed GIF makes approval stale
- PASS mutation requires active same-origin browser session/CSRF
- PASS browser has no JavaScript/resource errors
- PASS SQLite reopening preserves approvals and deny reasons
- PASS shared registrar blocks unapproved changed NPC before any writes
- PASS live review fits1100px and preserves native68x32 GIF
- PASS live review fits320px and preserves native68x32 GIF
- PASS QA did not create production user decisions
