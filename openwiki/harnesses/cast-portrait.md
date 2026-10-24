# cast-portrait — 캐스트 대사 흉상 (기존 캐스트와 같은 규격)

새 대사 흉상(초상·포트레잇)이 그 프로젝트의 기존 캐스트와 **같은 작가가 같은 규격으로 그린 것처럼** 보여야 한다.
사용자 결정(2026-10-25, 아스트라 박사 cg-nat10): 「이거는 꽤 규격이 괜찮네. 앞으로 이렇게 하도록 하네싱을 꽉 잡도록」.
그 전 1차 후보(hand-a·hand-b·공용 흉상 재채색)는 「다 별론데 … 기존 다른 포트레잇과 비교해서」로 전부 반려됐다 —
다른 방법으로 그린 그림은 캐스트 옆에서 바로 티가 난다. 그래서 이 하네스는 **캐스트를 만든 바로 그 경로**로만 그린다.

```
npm run harness -- cast-portrait list
npm run harness -- cast-portrait calibrate astra-horizon
npm run harness -- cast-portrait draw astra-horizon professor --round r4 --n 4
npm run harness -- cast-portrait check astra-horizon r4
npm run harness -- cast-portrait lineup astra-horizon r4
npm run harness -- cast-portrait dialogue astra-horizon professor r4
#   → 독립 Argon 검수자에게 qa-runs/…/r4/_blind/REVIEW-PROMPT.md 를 준다(감독이 직접 판정하지 않는다)
npm run harness -- cast-portrait verdict astra-horizon r4 qa-runs/…/r4/review-argon.json --reviewer argon
npm run harness -- cast-portrait fix astra-horizon r4 <후보> happy 24,38=#f9c485 --why "…"   # 결함이 있으면 고치고 lineup 부터 다시
npm run harness -- cast-portrait pick astra-horizon professor r4 <후보> --by "user: 「…」"
npm run harness -- cast-portrait install astra-horizon professor r4 <후보>
```

`npm run harness` 는 vite-node 를 띄우느라 느리다(단계마다 ~30초). 같은 일을 `python3 src/harnesses/cast-portrait/harness.py <단계> …` 로 바로 부를 수 있다.

## 프로젝트별 캐스트 규격

`harness-data/cast-portrait/projects/<project>.json` 하나가 한 프로젝트의 규격이다.

| 칸 | 뜻 |
|---|---|
| `lineup` | 기존 캐스트 흉상 폴더와 리소스 id(`{expr}` 자리). 줄 세우기·측정·대사창의 기준 |
| `expressions` / `openEyeExpressions` / `dialogueExpressions` | 만들 표정 · 두 눈 대칭을 재는 표정 · 대사창에서 찍을 표정 |
| `canvas` | 정확한 크기. 다르면 거절(줄이거나 자르지 않는다). `null` = 크기가 제각각인 일러스트 캐스트 |
| `rules` | 고정 규칙(아스트라) 또는 `"calibrate"`(캐스트 측정 범위에서 끌어냄) |
| `pipeline` | 생성 경로. `chargen-busts64` = 아스트라 경로, `none` = 생성 미설정(가져오기·검사·검수만) |
| `dialogue` | 실제 대사창 픽스처(프로젝트 덤프 스크립트·맵·이벤트·캐스트 대사) |
| `roles` | 만들 인물: 정체(프롬프트), 걷기 칩 그림, 표정별 대사, 설치 폴더 |

지금 규격: `astra-horizon`(전부 설정), `first-love`·`fallen-star`(줄·측정·검사·검수만 — 이 두 캐스트는 공용 초상 라이브러리의
고해상 일러스트를 `src/player/bustPixelate.ts` 가 화면에서 도트로 바꾸는 것이라 char-gen 생성 경로가 없다. 새 인물이 필요하면
그 캐스트를 만든 경로를 `pipeline` 에 먼저 적는다. 대사창 픽스처도 아직 없다).

## 아스트라 규격 (측정값, 2026-10-25)

캐스트 6명(주인공·엄마·간호사·나루·유림·무영)을 `calibrate` 로 잰 값:

- 64×64 RGBA, 배경 완전 투명(반투명 화소 0), 화면 2배(128×128, `bustPixelate` 가 크기로 판단).
- 15~16색, 재질마다 3~4단 명암, 왼쪽 위 빛.
- 머리 꼭대기 y1~4, 어깨가 아래 끝으로 잘려 나감(맨 아래 줄 80~98% 채움), 머리가 옆 끝에 닿지 않음, 머리 가운데 ±3화소.
- 윤곽: 인접한 색의 가장 어두운 단으로 그린 선택적 윤곽 — 실루엣 가장자리(아래 잘린 줄 제외)의 97~100% 가 어두움.
  옛 박사 흉상은 29% 라서 「괴물같다」였다. 규칙 문턱은 70%.
- 머리 폭 42~57화소(캔버스의 66~89%), 규칙은 그 범위 ±12%.
- 눈: 바깥 모서리 흰자 + 안쪽 홍채 + 1화소 반사광, 코 1화소, 입 2~3화소. 정면 캐스트(주인공·엄마·유림·무영)는 두 눈 크기·높이가 같다.
  간호사·나루는 살짝 돌아선 얼굴이라 측정 대칭이 아니다 — 새 인물은 정면으로 그리므로 대칭을 요구한다.
- 표정은 얼굴 상자(가로 22~78%, 세로 30~80%) 안만 바뀐다(머리·옷 화소 0 변화).

생성 경로(캐스트와 같음): char-gen `command` 이미지 엔진(`scripts/content/monsters/astra_professor_chargen/kaykai_cmd.py`) 에
`nat` 프롬프트 골격(48×48 도트 GBA 흉상, 마젠타 배경) + 참고 그림(캐스트 흉상 둘 = 화풍, 그 인물 걷기 칩 = 정체) →
`bake_astra_busts64.py` 의 `native`(격자 복원) → `place`(64×64) → `face_only`(표정은 얼굴 상자 안 바뀐 화소만) → `shared_palette`(16색).
하네스는 여기에 **축소 금지**만 더한다: 복원한 원래 격자가 58~66 밖이거나 놓는 배율이 1 이 아니면 그 후보를 버린다
(옛 박사는 70×71 격자를 64 로 잘라 머리가 확대·잘렸다).

## 검사가 실제로 잡는 것 (r3 실측)

| 후보 | check | 눈가림 Argon (2026-10-24) |
|---|---|---|
| cg-nat10 | PASS | 손 보정 뒤 9.5, 같은 작가, 결함 없음 |
| cg-nat9 | FAIL 두 눈 크기 다름(base·sad·angry) | 7.5, 나이·눈 비대칭 |
| cg-nat12 | FAIL 얼굴 밖 1~2화소 변화 | 4, 코 없음·결 없는 머리 |
| hand-a (1차) | FAIL 머리 꼭대기 y0 | 반려 |
| 옛 박사(chargen) | FAIL 윤곽 29%·눈 비대칭·얼굴 밖 변화 13~20화소 | 「괴물같다」 |

(위 표의 check 는 처음 검사 기준이다. 뒤에 두 눈 색 개수 비교(정면 base ±2, 다른 표정 ±6)를 더했더니 cg-nat10 원래 그림도
홍채 4화소/3화소로 걸려 손 보정했다 — 아래 이력.)

기계 통과는 합격이 아니다. 같은 작가인지·표정마다 결함이 없는지는 눈가림 검수자가 본다(`verdict`).
`pick` 은 현재 그림 해시에 check PASS 와 「sameArtist + 모든 표정 none」 판정이 둘 다 있을 때만 받고, `--by` 에 고른 사람을 적어야 한다(에이전트·감독 불가).
기계 검사는 절대 면제되지 않는다. 눈가림 판정만은 **그림을 직접 본 사람**이 `--override "<본 것과 이유>"` 로 뒤집을 수 있고, 그 사실이 picks.json 에 그대로 남는다.
`fix` 로 화소를 고치면 해시가 바뀌어 이전 판정이 무효가 된다 — lineup(새 `--seed` 로 글자도 섞는다)·dialogue·검수를 다시 한다.

**검수자 편차(실측, 같은 cg-nat10):** 2026-10-24 묶음 9.5·같은 작가 → 하네스 묶음 세 번 5·7·5, 같은 작가 아님. 같은 화소에도 점수가 4점 넘게 흔들리고
매번 다른 결함을 짚는다. 그래서 (1) 검수자가 짚은 결함 중 **화소로 확인되는 것만** 고치고(좌표를 열어 확인), (2) 화풍 판단(팔자 주름, 홍채 두 톤,
놀람 눈 크기)은 사람에게 넘긴다. 검수 지시문에는 「캐스트 자체가 보이는 차이는 결함이 아니다 — 주장마다 cast-only-3x 로 확인하라」를 넣었다.

## 기록 위치

- 판(round) 작업물: `qa-runs/harnesses/cast-portrait/<project>/<round>/`(커밋 안 함) — 후보 폴더, `checks.json`, `blind.json`(글자↔후보, 검수자에게 보이지 않음),
  `_blind/`(검수 묶음과 `REVIEW-PROMPT.md`), `_dialogue/`(대사창 촬영), `verdicts.json`.
- 커밋되는 것: 규격 `harness-data/cast-portrait/projects/*.json`, 캐스트 측정 `harness-data/cast-portrait/<project>/baseline.json`,
  사람 선택 `harness-data/cast-portrait/<project>/picks.json`(해시·검사 측정·판정 원문·보정 근거를 함께 담는다).
- 대사창 촬영은 후보 그림을 픽스처 `assets.uploaded` 에 데이터 URL 로 넣어 진짜 플레이어(`player.html`, `qa:runtime` 시나리오
  `cast-portrait-dialogue`)로 찍는다. 64×64 흉상은 출처와 무관하게 크기로 2배 처리되므로, 설치된 흉상과 화소가 같다(실측: 같은 그림의 설치본과 대사창 영역 차이 0).
  대사 라벨은 눈가림 글자(〈X happy〉)라 후보 이름이 화면에 나오지 않는다.
- 대사창 실행은 `unshare -rn` 네트워크 이름공간에서 돈다(크로미움 ERR_NETWORK_CHANGED 회피). 이미 격리된 곳이면 `--no-netns`.

## 아스트라 박사 이력

- 1차(2026-10-24): hand-a·hand-b·shared-elder·shared-moustache → 사용자 전부 반려.
- 2차 = 하네스 r3-chargen: cg-nat10·9·1·12, Argon 순위 nat10 > nat9 > nat1 > nat12, nat10 손 보정 3곳(기쁨 볼 얼룩, 화남 잔점, 놀람 입 속) →
  같은 작가 판정 → 사용자 허용(「이거는 꽤 규격이 괜찮네」), 기본 흉상(`src/assets/astraCast.ts` `ASTRA_PROFESSOR_BUST`). 다른 후보도 id 로 고를 수 있다.
  스토어 1.16 은 이 그림.
- 하네스로 다시 돌림(2026-10-25): 새 눈가림 묶음 세 번(5·7·5, 같은 작가 아님). 화소로 확인된 결함 31화소를 `fix` 로 고침 — 오른쪽 눈을 왼쪽 눈 거울로
  (홍채 4/3화소), 화남에 base 의 팔자 주름 유지, 기쁨·놀람 입에 어두운 테두리, base 에만 있던 턱 아래 줄 제거, 슬픔 주름 한 화소.
  check PASS. 눈가림 판정은 통과 못 함 → 사용자 허용을 근거로 `pick --override` 로 기록(harness-data/cast-portrait/astra-horizon/picks.json), `install`.
  같은 보정은 `scripts/content/monsters/astra_professor_chargen/bake.py` 의 `cg-nat10-r2` 에도 있어 다시 구워도 같은 화소가 나온다. 스토어 1.17.
- object-gate(3/4 시점 관문)는 흉상에 해당하지 않아 돌리지 않았다.
