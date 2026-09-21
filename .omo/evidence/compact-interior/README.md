# 작은 단층집 실내 기준

- Project: `rpg-zzu-house-template-gallery`
- Space: `house-catalog:room:single` — 작은 단층집 · 취사·식사·수면
- Place: `house-catalog:place:cottage` — 작은 회벽집 · 주택
- Occurrence: `compact-interior:example:cottage`
- Reference floor: 12×10 (120); revised floor: 8×6 (48), 60% smaller.
- Eight fixed furniture slots; all 34 passable floor cells form one connected area.
- Two reviewed assemblies correct cabinet layer/backing and stove wall support.
- Native renderer inspected. The 4× image is a browser screenshot of the native image with pixelated scaling.
- Actual spatial get/preview/apply created the example; explicit refresh rebuilt the frozen source after corrections.
- LegacyDb CAS save and reload succeeded; independent read confirms source definitions, both maps and the tileset.
- Shipping player: 10/10 beats, no runtime errors; actual entry, 21-step furniture/exit walk, return to yard.
- The previous multi-storey examples retain their frozen snapshots. This is the first revised small interior, not a claim that every indoor space was replaced.

Full project snapshots stay local under `output/evidence/compact-interior/`. Existing shared-space references use the revised definition on a new build or explicit refresh; no engine sizing clamp is introduced.

Before integrating origin/main, full gates: app typecheck and CSS passed. 519 failed / 23,139 passed versus prior 522 / 23,136; surface failures unchanged. One newly observed browser readiness timeout passed unchanged on a focused recheck (1/1). No new content compiler failure.

After integrating main at `10228f0a7`, the saved source/maps/tileset still match. The current composition workspace renders all 8 members and reports floor 8×6 / shell canvas 12×12. Editor readback and shipping-player 10/10 beats were repeated successfully.

A later project save changed the overall revision. `latest-remote-check.json` still verifies the two authored maps, source definitions and full interior tileset unchanged; no overwrite was performed. The earlier exact-revision readback remains in `final-remote-check.json`.

Final integrated gates: app typecheck, CSS and surface all passed. Vitest had 509 failures / 23,205 passes (checked-in baseline: 557 failures / 23,152 passes). The sole newly failed file was a geography-browser readiness timeout; it passed unchanged in isolation (1/1). Full gate exit remains 1; no blanket green claim.
