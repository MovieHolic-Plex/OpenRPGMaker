# Independent verification archive prepared

The existing independent verification confirms only the scoped nonvisual correction at `b87c9822f431ece4674e97a9d9cd15d1956be327`. This archive does not change that verdict or perform new product validation. Native/UI verification and canonical parent `openwiki/INDEX.md` regeneration remain pending; broader approvals are not implied.

## Coverage and recovery

- All 98 original files (20,874,627 bytes) are preserved whole in individually lossless gzip wrappers; 42 additional unchanged small files are readable directly.
- Every wrapper was reopened and decoded bytes compared exactly against its original. Readable copies were also byte-compared. Complete original file set, SHA-256, size, full permission mode and nanosecond mtime, plus directory metadata, were checked unchanged.
- Both whole compressed first/final states are preserved, alongside failed diagnostics, prior successful and final variants, exact command/stream/exit/input-hash records, scripts, diff, original manifests, certification and cleanup. No original was extracted to a large disk file or removed.
- First state decoded in memory: 123,967,605 bytes, SHA-256 `3c633d5755f6d73ad2e288513031357393a79481347cb8068faa9ee45bb11202`, matching its original receipt.
- Final state decoded in memory: 136,688,643 bytes, SHA-256 `66f51971dd323c8e29f5a0230c34f19e5e9f300963d92791c1bacb84c46eb64c`, matching `state-index.json` with 99 indexed captures.

`ORIGINAL-ARCHIVE-MANIFEST.json` provides every original/archive hash, size, mode and mtime mapping. Decode exactly one wrapper to recover an original, including originals already ending in `.gz`. Restore the recorded original mode and mtime_ns after decoding; Git alone does not preserve this metadata. Access times are not certified.

## Existing verification status

Retained `VERIFY.md` reports 355 passed / 18 files, tests exit 0, configured final diagnostics/typecheck/final public probe exit 0. The failed initial diagnostics and intentional wrapper failure/interruption exits remain preserved alongside success. These are existing independent receipts, not commands rerun by this archival job.

## Privacy and exact publication

Bounded signature inspection covered every original, both complete decoded gzip states, and parsed JSON strings/keys/keyed values without printing sensitive payloads. Candidate files: 0. Scope and limitations are recorded in `PRIVACY-SCOPE-BYTE-PRESERVATION.json`; absence of configured signatures is not proof of absence of all secrets or personal data. No content was fabricated or redacted.

`PUBLIC-stage-list.txt` is the exact repository-relative public allowlist, including preparation and integrity metadata. `ARCHIVE-FILES.sha256` covers every listed file except itself. Parent owns any publication: stage only literal allowlisted paths, never recursively stage originals or archive directories. No product tests/build/probes, source review/edit, staging/commit, original/shared cleanup or writes outside this archive were performed.
