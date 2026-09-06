# Verified HTTP field ID follow-up

Base: `1fe3060b981bf59104f6bfe042780427ca622810`.

The real shared field helper failed with
`TypeError: crypto.randomUUID is not a function` when the platform exposed
`getRandomValues` without `randomUUID`. That is the HTTP compatibility surface
already supported by `src/util/id.ts`, not a new fallback requirement.

The fix imports the existing `randomUuid` utility and retains the original
`event-field-` prefix. No new fallback implementation, stored ID, control
replacement or media behavior is introduced.

- RED: `http-id-red.json`, one failed case, direct exit 1.
- GREEN: `http-id-green.json`, 25 passed, 0 failed, direct exit 0. The command
  includes the new HTTP case, all original U07 cases and shared picker controls.
- Both changed TypeScript files have clean LSP diagnostics.
- Original U07 inputs and receipts remain unchanged. Localhost behavior still
  calls native `randomUUID` through the shared utility; media/runtime proofs are
  unaffected. Full unit integration verification remains lead-owned.
