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
- Supabase CAS save and reload succeeded; independent read confirms source definitions, both maps and the tileset.
- Shipping player: 10/10 beats, no runtime errors; actual entry, 21-step furniture/exit walk, return to yard.
- The previous multi-storey examples retain their frozen snapshots. This is the first revised small interior, not a claim that every indoor space was replaced.

Full project snapshots stay local under `output/evidence/compact-interior/`. Existing shared-space references use the revised definition on a new build or explicit refresh; no engine sizing clamp is introduced.

Full gates: app typecheck and CSS passed. 519 failed / 23,139 passed versus prior 522 / 23,136; surface failures unchanged. One newly observed browser readiness timeout passed unchanged on a focused recheck (1/1). No new content compiler failure.
