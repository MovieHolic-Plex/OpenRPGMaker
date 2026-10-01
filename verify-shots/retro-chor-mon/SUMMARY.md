# retro-chor-mon — 적 스킬 연출 레코드 + 독 자동 추천

- 헤드리스: `node_modules/.bin/vite-node --script verify-shots/retro-chor-mon/probe.mts` → `probe-after.txt` (ALL PASS), 수정 전 `probe-before.txt`.
- 녹화: `node scripts/qa/runtime/retro2003-monster-skills-gif.mjs --custom verify-shots/retro-chor-mon/enemy-record-spec.json --out verify-shots/retro-chor-mon/enemy-gif` → 3/3 PASS (GIF 는 커밋하지 않음).

| 사례 | 기대 | 관측 fx |
|---|---|---|
| enemy-record-shoot | 레코드 chor_qa_enemy_spit | mon_acid_blob@projectile, mon_acid_splash@target |
| enemy-record-lunge | 레코드 chor_qa_enemy_rake | mon_claw_rake@target |
| enemy-no-record-control | 연출 없음(기본 몬스터 재생) | 없음 |
