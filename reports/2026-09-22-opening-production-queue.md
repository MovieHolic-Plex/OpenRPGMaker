# Opening still production queue

The tibo generation retry on 2026-09-22 returned quota exhaustion with a reset in
3h56m56s. The provider response was used to set the next attempt to
2026-09-22 10:36:34 UTC / 19:36:34 KST, including a one-minute margin. No additional
images were generated during this session.

The user service `oprn-opening-stills.service` is running the finite plan from
`artifacts/stills-production/plan.json` in this worktree. Initial observed state:
`quota_wait`, 2,336 planned, 19 existing completed, 2,317 remaining, 0 awaiting
review. The 19 existing images retain their approved descriptions and hashes.
The service uses at most 3 GiB memory and 150% CPU; actual waiting memory was
about 50 MiB. Workspace free space was 786 GiB.

Coverage order: fill the initial 13 missing shots, then the first four narrative
beats of each of 24 worlds (96 images), before remaining shots or lighting
variants. The expanded plan has distinct IDs and separate pending descriptions.

New output is written as pending review, with byte count and SHA-256. Each batch
builds an HTML review index with pictures and requested descriptions. Generation
completion is `awaiting_review`; catalog approval and Release publication remain
separate work after inspecting the images. No existing Release bytes were changed.

Implementation checks: JavaScript/TypeScript syntax checks, successful real plan
expansion, 24-world/four-shot first-pass inspection, active systemd service and
saved quota-wait status. No Vitest, typecheck or gate suite was run because this
request did not authorize those commands. Live image generation remains blocked
by the provider until the recorded reset time, so successful post-reset generation
is not claimed here.
