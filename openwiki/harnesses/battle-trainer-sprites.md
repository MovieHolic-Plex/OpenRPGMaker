# battle-trainer-sprites — 전투 트레이너 스프라이트 (몬스터 수집 전용 그림 편집)

포켓몬식 전투 화면의 **상대 트레이너 앞모습**과 **내 트레이너 뒷모습**을 만든다.
진단 정본 `~/claude-viz/poke-battle-diag.html` B4·C5(트레이너 그림 없음)의 후속이다.

## 결정 이력
- 2026-10-15 1차: 「Actor1 을 Argon 으로 변형」 → p1(Argon 이 64×64 를 새로 그림), p2(Actor1 24×32 편집). **둘 다 폐기.**
- 2026-10-15 사용자 지적: 전투 트레이너 구도는 **포켓몬(몬스터 수집) 전용 그림**만 소스로 써야 한다. Actor1(RM2000 RTP)은 틀린 소스다.
  p1·p2 시트(`trainer-sprites-pick-1/2.html`)와 `qa-runs` 산출은 보존만 한다. `pick`·`sheet`·`bake` 는 이 판들을 거절한다.

## 소스 (p3~)
`harness-data/battle-trainer-sprites/source/*.png`(+`SOURCES.json`) — 몬스터 수집 캠페인이 전투 화면에서 쓰는 전투 인물 그림(`oprn_emerald_trainer_<role>`, 정면 16종·뒷모습 `hero_back` 1종, 모두 64×64) 사본이다.
출처는 이 저장소가 소유한 원작 그림이다: 내장 이미지 생성(원작 닮은꼴 금지 프롬프트, `assets/emerald-monster-v2/npc-generation.json`)
→ `pokemon-character-motion portrait-import` 가 64×64·15색으로 nearest 추출. Nintendo 원작 그림도 EasyRPG Actor1 도 아니다.
필드 걷기 칩 `oprn_emerald_field_cast_*`(16×32)는 hero 슬롯이 Nintendo 판형 기반이라 공개 번들에 못 넣는 내부 자산이고 너무 작아 소스로 쓰지 않는다.

## 방식 = 국소 편집
- 소스 64×64 격자를 그대로 두고(확대·축소 없음, 도트 밀도 유지) Argon 이 전체 격자를 다시 쓴다. 머리·모자·옷 색 같은 지시한 곳만 바꾼다.
- 하네스 검사: 변경 셀 ≤40%, 실루엣(투명/불투명) 변경 ≤10%, 새 색 ≤8, 변화 ≥1%. 초과하면 사유를 붙여 같은 일꾼이 최대 3회 다시 쓴다(`attempts`).
- 후보 A~E 는 변경 강도만 다르다(A 최소). `asis` 역할(소스 그대로)은 A 하나다.
- 모델은 agy `gemini-4-argon-medium`(8318 프록시는 Argon 만, claude-* 금지). 이미지 생성 도구 금지, 격자 행 문자열 직접 작성.

## 역할 (p3)
| 역할 | 방향 | 소스 | 방식 |
|---|---|---|---|
| hero_m | 뒷 | hero_back | 모자·머리·재킷 색 국소 편집 |
| hero_f | 뒷 | hero_back | 소스 그대로 |
| hero_f_front | 앞 | hero | 소스 그대로(상대 쪽 미리보기용) |
| boy | 앞 | rival | 머리·재킷·바지 색 |
| girl | 앞 | resident | 원피스·머리 색·리본 |

남은 역할(fisher·hiker·bug_catcher·gym_rock·gym_water·scientist·punk·elder)은 `chip.future_sources` 에 소스 대응만 정해 두었다.
**던지기 프레임은 없다.** 소스 `hero_back` 이 오른팔로 볼을 쥔 던지기 자세 1장이다. 필요 여부는 감독이 판단한다.

## 명령
```bash
npm run harness -- battle-trainer-sprites list
npm run harness -- battle-trainer-sprites draw all --n 5 --par 15 --plate p3 --background
npm run harness -- battle-trainer-sprites status [판]
npm run harness -- battle-trainer-sprites sheet p3     # ~/claude-viz/trainer-sprites-pick-3.html (원본 | 결과 나란히 + 전투 합성 미리보기)
npm run harness -- battle-trainer-sprites pick p3 hero_m=B boy=C ...   # 사용자가 고른 것만 기록(그림 해시에 묶임)
npm run harness -- battle-trainer-sprites bake p3      # 고른 기록이 있는 역할만 public/assets/battle-trainers/<역할>/ 에 굽는다
```

## 계약
- 64×64 투명 PNG, 발 바닥 줄 62(소스 그대로). **object-gate 영수증 없음, 사람 선택 경로.** 사람 캐릭터라 3/4 윗면 규칙 대상이 아니다. 감독·에이전트는 고르지 않는다.
- `bake` 는 `picks.json`(`harness-data/battle-trainer-sprites/`)에 기록이 있고 현재 그림 해시가 일치할 때만 `public/assets/battle-trainers/<role>/{front|back}.png` 와 `index.json` 으로 굽는다. 고르기 전에는 번들·프로젝트에 아무것도 넣지 않는다.

## 데이터 계약 (전투 화면 쪽)
`public/assets/battle-trainers/index.json`: `{ trainers: { <role>: { role, label, view: "front"|"back", size:[64,64], footY: 62, front|back: "front.png"|"back.png" } } }`.
전투 CSS/DOM 연출은 전투 화면 담당이 맡는다. 이 하네스는 그림만 낸다.

## 출처·라이선스
`public/assets/ATTRIBUTION.md` 「Battle trainer sprites」. 소스는 저장소 소유 원작, OPRN 게임 사용 라이선스(소재 단독 재배포 금지, `openwiki/licensing.md`).

## 파일
`src/harnesses/battle-trainer-sprites/{harness.py,harness.ts,node/cli.ts}` · 시드 `harness-data/battle-trainer-sprites/seed.json` · 소스 `harness-data/battle-trainer-sprites/source/` · 산출 `qa-runs/harnesses/battle-trainer-sprites/<판>/<역할>/<글자>/`.
