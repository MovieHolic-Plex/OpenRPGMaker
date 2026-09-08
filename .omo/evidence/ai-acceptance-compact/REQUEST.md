# AI acceptance checklist redesign

## Authorized scope

Redesign the floating "completion criteria" checklist, not the separate work-plan
book. The user approved the following behavior:

- Start as a compact progress bar with verified count and current activity.
- Expand into a concise task list, highlight active work, and fold verified items
  into a separate group.
- Put original requests, evidence, and withdrawal actions inside item details.
- Keep blocked reasons visible without opening item details.
- Allow moving, collapsing, and hiding the panel, and reopening it from the AI
  assistant.
- Preserve the distinction between work being done and actual verification.

## Ownership and delivery

- Use the isolated `agent/ai-acceptance-compact` branch.
- Grok 4.6 owns visual design, styling, screenshots, image reading, and visual QA.
- Deep owns functional implementation, regression tests, and review repairs.
- Ultrabrain reviews the finished change. Resolve its requests and repeat review
  until it approves before merging the PR.
- Do not author or persist game content for this editor-only change.

## Acceptance contracts

The backend acceptance snapshot remains authoritative. Optional and withdrawn
requirements must not be represented as required blockers or counted as verified
solely because the overall goal is satisfied. Hiding the panel retains fresh
acceptance data; conversation/project clearing still removes stale ownership.

Verification covers focused regressions, the actual editor surface, keyboard and
pointer interactions, hidden updates and reopening, lifecycle cleanup, Grok visual
evidence, application diagnostics, production build, and repository gates compared
against their documented baseline.
