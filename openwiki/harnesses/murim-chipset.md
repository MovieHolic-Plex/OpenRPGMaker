# murim-chipset — 무림(중국 무협) 칩셋 후보 하네스

중국 무협 배경 공용 칩셋 **`murim_wuxia`**(계열 `oprn-murim`, 16px 칸, 3/4 시점)에 넣을 조각의 후보를 만들고 **사람이 고르게** 한다.
그림은 생성 이미지가 아니라 **행 문자열 격자로 화소를 직접 찍은 코드 손 도트**다(`joseon_baram` 과 같은 방식, `assistant-skills/pixel-dot-authoring`).
타일셋은 아직 계획 단계다 — 이 하네스는 고른 그림을 `harness-data/murim-chipset/picked/` 까지만 남기고 **번들(`src/assets/bundled.ts` 등)에 굽지 않는다.**

## 흐름

```
rounds/<판>.py  (항목마다 후보 A·B·C — 색만 바꾼 것이 아니라 구조가 다른 안)
   │ draw   → qa-runs/harnesses/murim-chipset/<판>/<항목>/<글자>.png, -x8.png, manifest.json(그림 해시)   (gitignore)
   │ gate   → 기계 관문 P Z Q O F S R (FAIL) · T L N (WARN) → gate.json, ledger.json 에 실행 기록
   │ sheet  → ~/claude-viz/murim-<판>.html  (FAIL 이 있으면 안 쓴다)
   ▼
사람이 시트를 보고 글자를 고른다 ──► pick <판> <항목> <글자>   (시트 때 해시 = 지금 그림 해시일 때만 기록)
                                └► reject <판> <항목> <글자> --why "…"
```

- **감독·에이전트는 고르지 않는다.** `pick` 은 사람이 고른 글자를 받아 적을 때만 부른다. 「관문을 다 통과했으니 A」 같은 대리 선택 금지.
- **관문 통과는 합격이 아니다.** 관문은 깨진 그림(팔레트 밖 색·크기·투명 계약·윤곽 없음·윗면 띠 없음·반복 이음·색만 바꾼 후보)만 거른다.
  3/4 시점이 맞는지(윗면이 보이고 옆면이 없는지), 화풍, 조선 옆 어울림은 사람이 본다
  (교훈: 실내 3/4 관문 ok 를 근거로 구운 그림 44종이 명백한 위반이었다 — 메모리 `view34-gate-is-not-evidence`).
- 그림이 바뀌면 그 그림의 고른 기록은 **무효**다(`status`·`list` 가 `VOID` 로 보인다). 다시 시트를 만들어 다시 보여 줘야 한다.

## 명령 (`npm run harness -- murim-chipset …` 또는 `python3 src/harnesses/murim-chipset/harness.py …`)

| 명령 | 뜻 |
|---|---|
| `validate` | 시드(항목 id·묶음·종류·층·크기·반복 축·brief/criteria·조선 기준 조각 파일)·판 모듈·금지 조항·팔레트 호환 점검 |
| `palette` | 램프 단별 밝기를 joseon_baram 범위와 대조, 가장 가까운 조선 램프와 거리. 파일을 쓰지 않는다 |
| `list [--wave W]` | 항목 목록. ★ = 사람이 고른 것 중 지금 그림과 해시가 맞는 것 |
| `draw <판>` | 후보를 그려 PNG·manifest 를 쓴다 |
| `gate <판>` | draw + 관문. FAIL 이 있으면 종료코드 1 |
| `sheet <판> [--force]` | draw + gate + 시트. `--force` 는 실패를 사람에게 보여 줄 때만 |
| `pick <판> <항목> <글자> [--note]` | 사람이 고른 후보 기록 + `picked/<항목>.png` 복사. 같은 항목의 이전 pick 은 대체 |
| `reject <판> <항목> <글자> --why …` | 사람이 버린 후보와 이유(다음 판의 「하지 말 것」) |
| `status` | 판별 그림·관문·시트 유무, 묶음별 고른 것과 해시 일치 여부 |

시트 주소는 `http://mdc-server:18301/murim-<판>.html`(정적 서버 `claude-viz.service`).

## 파일

| 경로 | 역할 |
|---|---|
| `src/harnesses/murim-chipset/harness.ts` | 매니페스트(레지스트리가 읽음) |
| `src/harnesses/murim-chipset/node/cli.ts` | 입구 — `harness.py` 로 넘긴다 |
| `src/harnesses/murim-chipset/harness.py` | 단계 본체(draw·gate·sheet·pick·reject·status·validate·palette) |
| `src/harnesses/murim-chipset/tk.py` | 캔버스·`grid`/`stamp`(행 문자열 → 화소)·그림 해시. 색은 `(램프, 단)` 으로만 |
| `src/harnesses/murim-chipset/gate.py` | 기계 관문·팔레트 보고 |
| `src/harnesses/murim-chipset/rounds/<판>.py` | 판의 후보 그림(행 문자열 격자). `ROUND`·`WAVE`·`CANDIDATES = {항목: {글자: 함수}}` |
| `harness-data/murim-chipset/seed.json` | 항목 31개(묶음 5)·판 목록·금지 조항 — 사람이 쓴다 |
| `harness-data/murim-chipset/palette.json` | 잠긴 팔레트(램프 9 × 7단 + ink + 공유 cao) |
| `harness-data/murim-chipset/ledger.json` | 관문 실행·pick·reject 기록 — 하네스가 쓴다 |
| `harness-data/murim-chipset/picked/<항목>.png` | 사람이 고른 그림(해시는 ledger 에) |

## 팔레트 (잠금)

램프 9개 × 7단(0 = 가장 어두움) + `ink`(먹 윤곽 `#0c0e16`) + 그림자 한 가지(ink, alpha 88) + 공유 램프 `cao`.

| 램프 | 쓰임 |
|---|---|
| `wa` | 청회색 유약 기와 |
| `zhu` | 주칠(朱漆) 기둥·난간 — 조선 `red`(진홍)보다 주황 쪽 |
| `huang` | 황토·오커 회벽 |
| `bai` | 흰 회벽·창호지(크림색, 조선 plaster 의 분홍기보다 노랑 쪽) |
| `mu` | 짙은 나무(가구·보·판벽) |
| `song` | 밝은 소나무(마루·목인장) |
| `shi` | 회색 청석(마당·기단) |
| `zhuz` | 대나무 녹색 |
| `jin` | 금박·등롱 금색 |
| `cao` | 풀밭 — **joseon_baram `leaf` 램프 그대로**(같은 게임에서 땅이 이어지게, 장면용) |

- **조선 호환 규칙:** 램프 단마다 밝기가 joseon_baram 7단 램프들의 같은 단 밝기 범위(±0.04) 안에 있어야 한다(`palette`·`validate` 가 검사).
  색상은 조선 램프와 다르게 골랐다(`palette` 가 가장 가까운 조선 램프와 거리를 보여 준다. 거리 기준은 아직 강제하지 않는다).
- 색을 코드에 직접 쓰지 않는다. 후보 코드는 범례 `{'글자': ('램프', 단)}` 만 쓴다. 관문 P 가 잠금 밖 색 한 화소도 막는다.
- **다시 잠그면 모든 후보 해시가 바뀌어 pick 이 전부 무효가 된다.** 팔레트를 바꾸면 판을 다시 보여 줘야 한다.

## 관문 (gate.py) — 깨짐만 거른다

| 코드 | 수준 | 보는 것 |
|---|---|---|
| P | FAIL | 불투명 화소가 잠긴 색 안 · 반투명은 그림자(ink, alpha 88)뿐 |
| Z | FAIL | 크기 = 칸 × 16px |
| Q | FAIL | tile·wall 전부 불투명 / roof 윗줄 불투명·90% / object 위 귀퉁이 투명·채움 15~95% |
| O | FAIL | object 실루엣 가장자리의 75% 이상이 ink 또는 재질 램프 0~1단 |
| F | FAIL | wall·roof·object: 후보가 선언한 윗면 행(`meta['top']`)이 2행 이상·폭 50% 이상이고 바로 아래 앞 모서리 줄보다 밝다(object 는 실루엣 위쪽 절반에서 시작). **띠가 있는지만 본다 — 시점 판정이 아니다** |
| S | FAIL | 반복 축마다 감은 이음(끝 열→첫 열)의 밝기 차 ≤ 안쪽 열 경계 최대 + 0.02(줄눈·귀틀처럼 일부러 그은 선은 허용) |
| R | FAIL | 같은 항목의 두 후보가 실루엣 같고(IoU > 0.97) 밝기 배치 상관 > 0.92 = 색만 바꾼 안 |
| T | WARN | object 폭 1px 화소 비율 > 0.14 |
| L | WARN | object 오른쪽 반이 왼쪽 반보다 밝음(빛은 왼쪽 위) |
| N | WARN | 네 이웃이 같은 색인데 혼자 다른 1px 잡티 > 3% |

실측(style-r1 첫 관문): R 이 둥근 탁자 A·C(재질만 다르고 배치가 같았음)를 잡았다 → C 를 기둥 없는 돌 북 탁자 + 귀퉁이 걸상으로 다시 그렸다.
S 의 첫 판(감은 이음 / 안쪽 평균 × 1.8)은 귀틀·줄눈이 타일 경계에 걸린 정상 타일을 떨어뜨려서 「안쪽 최대 + 0.02」로 바꿨다.

## 시트 (`~/claude-viz/murim-<판>.html`, 자체완결)

- 항목마다: brief·criteria → **조선 같은 용도 조각**(1×·4×, 시드 `joseonRef`) → **Actor1 정면 가운데 프레임**(1×·4×, 사람 크기) → 후보 A·B·C(1×·4×, 반복 타일은 3×3 / 벽·지붕은 3×1 이어 붙임 2×, 관문 배지, 고르기·버리기 명령 복사 버튼, 해시 앞 16자).
- 맨 아래: 조선 객잔 지도 같은 크기 자락(기준) + **후보 글자별 6×5 칸 장면 두 장**(바깥 = 지붕·벽·돌바닥·목인장 / 안 = 벽·마루·탁자, 사람은 Actor1). 항목마다 다른 글자를 골라도 된다.
- 사람은 그리지 않는다. Actor1(`public/assets/easyrpg/charset/Actor1.png`, 24×32 프레임)은 비교·장면에만 쓴다.

## 시드 (`harness-data/murim-chipset/seed.json`)

항목 필드: `id` `wave` `title` `size[칸w,칸h]` `kind`(tile·wall·roof·object) `layer`(ground·wall·roof·object) `walk` `brief` `criteria[]` `tileable`(x·y·xy) `joseonRef{sheet,pieces,piece,w,h,label}`.

- **style (6)** `inn_floor_wood` `yard_floor_stone` `inn_wall_pillar`(3×2) `roof_tile_eave`(3×2) `training_dummy`(1×2) `round_table_stools`(2×2, 덤) — 판 `style-r1`
- **frame (7)** 마루·돌바닥 정식판, 객잔 벽 세트, 기와 지붕 세트(추녀 들림), 두 짝 판문, 나무 계단, 2층 난간
- **inn (7)** 둥근 탁자, 북 걸상, 계산대, 부엌 아궁이·솥, 술독, 차림판(글자 없음), 종이 등롱
- **dojo (6)** 목인장 정식판, 병기 거치대, 과녁, 모래주머니, 명상 방석, 돌사자 한 쌍
- **outdoor (5)** 산문(5×4), 대숲, 연무장 가장자리, 석등, 비석(귀부)

새 판은 `rounds/<판>.py` 를 만들고 시드 `rounds` 에 `{wave, module}` 을 더한다. 다음 묶음(frame 이후)은 style 판에서 사람이 고른 화풍을 기준으로 그린다.

## 그리는 법 (후보 코드)

- 한 글자 = 한 화소. `grid(rows, legend)` 는 행 길이가 다르면 바로 오류를 낸다(손으로 찍다 틀린 자리). `.` 투명, `~` 그림자.
- 반복 무늬 주기(`_rep`)·감기 덧칠(`stamp(..., wrap=True)`)·돌 이음 모서리 밝힘(`_course`, `_paving`)은 내가 고른 좌표를 찍는 보조다.
  원·다각형 마스크로 본체를 만들거나 노이즈로 표면을 채우지 않는다.
- 3/4 시점: 수평 면(보·담머리 윗면, 지붕 사면, 통나무 끝, 상판, 받침판)은 위에서 보이는 면으로 2px 이상, 그 아래 어두운 모서리 줄, 앞면은 전체 높이. 옆면(아이소메트릭) 금지.
- 후보끼리는 구조를 다르게: 판재 방향·폭, 돌 모양, 벽 구성(회벽·판벽·창살), 기와 구성(수키와 골·비늘 평기와·용마루 포함), 받침 방식.

## 함정

- `qa-runs/` 는 gitignore 다. 고르지 않은 후보 PNG 는 커밋되지 않는다 — 판 코드(`rounds/*.py`)가 정본이고 언제든 다시 그린다.
- 시트는 관문 FAIL 이 있으면 안 써진다. 고친 뒤 다시 만든다.
- `pick` 은 manifest(시트 때 해시)와 지금 그림 해시가 다르면 거부한다 — 시트를 본 뒤 코드를 고쳤다면 시트를 다시 만들어 다시 보여 줘야 한다.
- 장면의 바깥 그림은 벽 조각을 지붕 바로 아래에 붙인 것이다. 벽 후보 B(담머리 기와)는 지붕 아래에서 기와 띠가 두 번 보인다 — 바깥 담으로 쓸 때의 모습이다.
