# retro-choreo-a1 증거 (연출 레코드 A1)

PASS · 혼합 연출 4개 · 기준 커밋 대조 · 저장 왕복 확인

## 1. 혼합 연출 4개 (조수 도구 upsert_choreography / duplicate_choreography 로 조립, 출하 플레이어 경로로 녹화)

조립 로그(도구 호출 순서·결과):
```
OK   list_fx_sheets 이펙트 시트 0장 중 0장
     list_fx_sheets("번개") -> 
OK   list_fx_sheets 이펙트 시트 5장 중 5장
     list_fx_sheets("chain") -> mage_chain_bolt, dark_knight_chain, dark_lord_chains, galleon_chain, galleon_chain_hit
OK   list_fx_sheets 이펙트 시트 2장 중 2장
     list_fx_sheets("missile") -> mage_missile_hit, mage_missile_orb
OK   list_fx_sheets 이펙트 시트 8장 중 6장
     list_fx_sheets("moon") -> druid_moonbeam, samurai_moon, mothman_moonwing_sky, samurai_blood_moon, scarecrow_moon_sky, sdance_moon
OK   upsert_choreography 연출 '도약 뇌격'(chor_custom) 추가 — 3층, 스킬에는 retroChoreographyId:"chor_custom" 로 붙인다
OK   upsert_choreography 연출 '삼연 난타'(chor_custom_2) 추가 — 2층, 스킬에는 retroChoreographyId:"chor_custom_2" 로 붙인다
OK   duplicate_choreography 연출 '화염검'(skill_hero_flame_sword) → '큰 불꽃 베기'(chor_hero_flame_sword) 복제 — 2층. 스킬에는 retroChoreographyId:"chor_hero_flame_sword" 로 붙이고, 고치려면 upsert_choreography
OK   upsert_choreography 연출 '큰 불꽃 베기'(chor_hero_flame_sword) 수정 — 2층, 스킬에는 retroChoreographyId:"chor_hero_flame_sword" 로 붙인다
OK   upsert_choreography 연출 '전체 뇌우'(chor_custom_3) 추가 — 2층, 스킬에는 retroChoreographyId:"chor_custom_3" 로 붙인다
OK   upsert_skill 스킬 '도약 뇌격' 추가
OK   upsert_skill 스킬 '삼연 난타' 추가
OK   upsert_skill 스킬 '큰 불꽃 베기' 추가
OK   upsert_skill 스킬 '전체 뇌우' 추가
OK   upsert_class 클래스 '연출 시험관' 추가
OK   upsert_actor 액터 '시험관' 추가
OK   serialize→deserialize skillChoreographies 4개 동일
```

| 스킬 | 동작 | 층 노드(실측/기대) | 사운드(실측/기대) | 판정 |
|---|---|---|---|---|
| skill_chor_leap_bolt | leap-strike | 3 (기대 3) | 4 (기대 4) | PASS |
| skill_chor_triple | flurry | 6 (기대 6) | 21 (기대 21) | PASS |
| skill_chor_big_flame | dash-strike | 2 (기대 2) | 3 (기대 3) | PASS |
| skill_chor_sweep | cast | 4 (기대 4) | 5 (기대 5) | PASS |

허용 오차 ±45ms (회차 첫 층 기준 상대 시각, 관찰 지터 포함).

### skill_chor_leap_bolt — 연출 ① 도약 + 번개 층.
```
OK  층 노드 3 = 기대 3 x 1회
OK  층 종류 3 = 기대 3
OK  사운드 이벤트 4 = 기대 4
OK  회차1 hero_meteor_trail: +0ms (기대 +0ms, 오차 0) 폭 64px
OK  회차1 hero_meteor_impact: +107ms (기대 +100ms, 오차 7) 폭 128px
OK  회차1 mage_chain_bolt: +496ms (기대 +496ms, 오차 0) 폭 128px
```
GIF: skill-skill_chor_leap_bolt.gif

### skill_chor_triple — 연출 ② 3타, 타마다 임팩트.
```
OK  층 노드 6 = 기대 2 x 3회
OK  층 종류 2 = 기대 2
OK  사운드 이벤트 21 = 기대 21
OK  회차1 samurai_moon: +0ms (기대 +0ms, 오차 0) 폭 128px
OK  회차1 mage_missile_hit: +330ms (기대 +330ms, 오차 0) 폭 128px
OK  회차2 samurai_moon: +0ms (기대 +0ms, 오차 0) 폭 128px
OK  회차2 mage_missile_hit: +336ms (기대 +330ms, 오차 6) 폭 128px
OK  회차3 samurai_moon: +0ms (기대 +0ms, 오차 0) 폭 128px
OK  회차3 mage_missile_hit: +328ms (기대 +330ms, 오차 -2) 폭 128px
```
GIF: skill-skill_chor_triple.gif

### skill_chor_big_flame — 연출 ③ 복제 + 2배·지연.
```
OK  층 노드 2 = 기대 2 x 1회
OK  층 종류 2 = 기대 2
OK  사운드 이벤트 3 = 기대 3
OK  회차1 hero_flame_aura: +0ms (기대 +0ms, 오차 0) 폭 128px
OK  회차1 hero_flame_slash: +149ms (기대 +150ms, 오차 -1) 폭 256px scale x2
OK  scale 2 층 폭 256px = 128px x 2
```
GIF: skill-skill_chor_big_flame.gif

### skill_chor_sweep — 연출 ④ 전체 대상 + 착탄마다 임팩트.
```
OK  층 노드 4 = 기대 4 x 1회
OK  층 종류 2 = 기대 2
OK  사운드 이벤트 5 = 기대 5
OK  회차1 mage_missile_hit: +0ms (기대 +0ms, 오차 0) 폭 128px
OK  회차1 mage_missile_hit: +94ms (기대 +90ms, 오차 4) 폭 128px
OK  회차1 mage_missile_hit: +199ms (기대 +180ms, 오차 19) 폭 128px
OK  회차1 mage_chain_bolt: +441ms (기대 +440ms, 오차 1) 폭 128px
```
GIF: skill-skill_chor_sweep.gif

읽는 법:
- 도약 뇌격: 궤적(투사체) 노드가 먼저, 충격이 +100ms, 번개 층이 +496ms. 세 층이 계약 없이 한 연출로 묶임.
- 삼연 난타: 단일 대상 3타는 행동이 3회 재생(회차마다 초승달 1 + 임팩트 1), 그래서 임팩트 총 3개. 회차 안 오프셋이 기대와 같음.
- 큰 불꽃 베기: 기본 연출 복제 뒤 한 층만 scale 2 + startMs 200 → 폭 256px, 시작 200ms(원본은 128px, 다른 시각).
- 전체 뇌우: 대상 3명이 한 계획 하나로 묶여 onHit:each 임팩트가 90ms 간격 3개, startMs 300 부터.

## 2. 회귀 (기준 커밋 ae7ed008f vs 현재)

### 2-1. 계약 타임라인 전량 대조
번들 계약 전체(직업 스킬 + 몬스터 스킬)를 hits 1·3, 편 2가지로 순수 타임라인에 통과시켜 이벤트(종류·시각·키·앵커·scale·frameMs)를 덤프.
기준 커밋과 현재 커밋의 덤프가 **바이트 동일**(4436개 타임라인, `dump-head.sha256`(덤프 원본은 retro-choreo-a1-dump.mts 로 재생성), `retro-choreo-a1-dump.mts`).

### 2-2. 출하 플레이어 실녹화 A/B (기존 계약 3개)
| 스킬 | 층 종류(기준/현재) | 노드(기준/현재) | 사운드(기준/현재) | 노드 서명 | 노드 간격 최대 편차 |
|---|---|---|---|---|---|
| skill_hero_meteor_drop | 2 / 2 | 2 / 2 | 3 / 3 | 동일 | - (기준 녹화기는 시각 필드 없음) |
| skill_hero_flame_sword | 2 / 2 | 2 / 2 | 3 / 3 | 동일 | - (기준 녹화기는 시각 필드 없음) |
| skill_samurai_twin_moon | 1 / 1 | 1 / 1 | 6 / 6 | 동일 | - (기준 녹화기는 시각 필드 없음) |

재현:
```
npx vite-node scripts/qa/runtime/retro-choreo-a1-build.mts verify-shots/retro-choreo-a1/spec.json
node scripts/qa/runtime/retro2003-skills-gif.mjs --set custom --custom verify-shots/retro-choreo-a1/spec.json --out verify-shots/retro-choreo-a1 --width 640
node scripts/qa/runtime/retro-choreo-a1-verify.mjs
```