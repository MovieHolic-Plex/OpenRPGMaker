# Editor preview performance (2026-10-04)

Scope: round-two audit `verify-shots/editor-ux-audit-round2-20261004/agents/assets-idle.md`.
These changes are renderer/protocol code only; they do not author game content.

## Native shared catalog validators (O5)

`electron/main/protocols.ts` forwards the request's `If-None-Match` into
`sharedContentResponse(method, url, validator)` and preserves its status and ETag.
A 304 returns `new Response(null, ...)` before gunzip, byte copying or JSON serialization.
Successful gzip payloads still become plain JSON for app://; no unverified custom-protocol
content-encoding support is assumed. `no-store` is retained: the renderer's
`sharedContentCache` owns the scoped IndexedDB snapshot and sends conditional requests.
HTTP host and asset protocols are unchanged. Defaults/rest/all use the backend's scoped ETags.

`test/editorSharedCatalogProtocol.test.ts` defines contracts for conditional responses,
changed revisions, payloads and errors. It has not been executed in this worker.

Native QA: open the same project twice in Electron with its partition and catalog unchanged.
Record defaults/rest/all request validators, status, response ETag and transferred bytes.
The second request with a cached snapshot must return 304 with zero body bytes and no
main-process gunzip stack. Change the catalog revision through its existing authorized
publishing workflow: expect 200, a new ETag and the updated snapshot. HTTP measurements do
not establish app:// behavior.
