# Raw evidence packaging

`raw-log-archive.json` preserves six raw text artifacts byte-for-byte in base64,
with their original paths and SHA256 values. Their trailing spaces and terminal
blank lines are evidence data, not source formatting, so they were not trimmed.
Decode `content` as base64 and verify `sha256` to inspect the exact original.
The local raw files remain unchanged but are not staged as plain source text.

Two machine-wide listener inventories contain unrelated host addresses. They
remain private local evidence; the public archive records their hashes only.
Task28 cleanup receipts preserve the relevant assigned-port checks. No failed
test output or required code/ownership evidence is omitted by this distinction.
