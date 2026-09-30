# 3/4 시점 재작도 — 작업자 절차서 (2026-09-30)

너는 배치 `V01`~`V08` 중 하나를 맡은 작업자다(감독자가 번호를 준다). 목록은 `tiledata/atlas-pick/view34-rework.json` 의 `batches[i].items` 다.
항목마다 **원본 후보를 같은 화풍·같은 팔레트로, 3/4 시점 계약에 맞게 다시 찍는다.** 새 후보는 **추가만** 한다 — 기존 후보(j5-A·w7-C 등)·v0·v5 는 절대 덮어쓰지 않는다.
사용자 요청은 「실내랑 실외도 3/4 뷰 지키게 수정해라」였다. 바닥은 위에서 본 1:1, 물체는 윗면 T + 앞면 F, 옆면은 안 보이고, 빛은 왼쪽 위다.

저장소 루트 = 이 워크트리(jp-pick, 브랜치 agent/jp-pick). 명령은 루트에서 돈다. 네 항목 폴더 밖은 읽기만 한다.

## 0. 먼저 읽을 것
1. `tiledata/atlas-pick/modern-style-bible.md` **§10(실외 3/4 계약·건물 정면 깊이 수치·택시 두 방향)** 와 **§11(실내 3/4 — T/F 표와 손도트 증명 4점)**. 이게 이번 작업의 법이다.
2. 증명 그림 `tiledata/atlas-pick/style-demo-view34/` — `*-old-*` 가 틀린 것, `*-new-*` 가 맞는 것(택시 두 방향 `taxi-h*`·`taxi-v-*`, 옷장·책장·벽난로·사물함).
3. 일본 세트면 `WORKER-JP.md`·`WORKER-JP-KIT.md`, 호러 `WORKER-HORROR.md`, 학원 `WORKER-SCHOOL.md`(격자 문법·자기 점검표). 단 **WORKER-JP-KIT.md 의 1~3px 띠 안내는 폐기**됐다 — §10 이 대체한다.
4. 네 항목의 `info.json`(이름·칸 수·place)과 원본 그림(항목의 `current`).

## 1. 항목이 담고 있는 것
`items[i]` 필드: `slug`, `name`, `current`(원본 PNG), `violation`(검사기가 잡은 이유 한 줄), `footprint`(칸 수·캔버스), `target`(이 분류의 T/F 목표 수치), `gate`, `category`, `priority`, `newCandidate`(**새로 만들 파일의 경로**), `naming`.
- `priority` 1 = 사용자가 골라 둔 것(먼저), 2 = 공통 기본 가구·건물, 3 = 나머지. **1 → 2 → 3 순서로 한다.**
- 캔버스 크기·칸 수는 원본과 같다. 늘리고 싶으면 그리지 말고 감독자에게 「<slug> 를 w×h 로, 이유」라고 보고한다.

## 2. 새 후보 경로 규칙 (두 피커)
| 피커 | 세트 | 새 파일 | 비고 |
|---|---|---|---|
| **18303** atlas-pick (이 워크트리) | modern·jp·worldmap·horror·school | `tiledata/atlas-pick/candidates-<세트>/<slug>/v34-A.pxg` (B·C 는 선택) | WORKER_RE 가 `v34-A` 를 받는다. 코드 변경 없이 「후보 모아 보기」에서 j5-A 옆에 나란히 보인다 |
| **18302** hand-interior-pick (i16-pick 워크트리) | v5 실내 | `/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-i16-pick/tiledata/hand-interior/pick/candidates/<slug>/w9N-A.pxg` | N = 배치의 worker 번호(V01=w90, V02=w91). 정규식 `^(w[0-9]{1,2}|pilot)-([A-Z])\.pxg$`. A = v5 를 3/4 로 다듬기 · B = 그림자 강화 · C = 실루엣 재해석. 팔레트 `palette.pal`, 검사 `check_candidate.py` |

- `.pxg` 형식: `@size W H` / `@cell 16` / `@palette palette.pal`(또는 세트 팔레트) / 글자 격자. 킷(부품 시트) 항목은 `v34-A.pxg` 를 쓰고 `python3 scripts/content/atlas-pick/jp_kit_compose.py --kit <slug>` 로 조립 예 `v34-A.ex-<id>.png` 를 만든다.
- 18302 의 i16-pick 은 다른 워크트리다. 거기서도 **네 새 파일 경로만** add·commit 한다(과거 18302 작업자는 커밋을 감독자가 모았지만 이번에는 스스로 커밋한다).

## 3. 항목마다 하는 일
1. 원본 그림과 `violation`·`target` 을 읽는다. 무엇이 틀렸나: **NOTOP/TOPDOWN**(윗면이 없거나 위에서만 본 그림) · **FRONT**(정면 도면 — 윗면 0~2px) · 실내 `front`/`rim`/`topdown`.
2. 같은 화풍·같은 팔레트로 다시 찍는다(램프 이름은 `modern-style-bible.md`). **모양·용도·색 성격은 유지, 윗면 T 와 앞면 F 만 바로잡는다.** 세부를 늘려서 이기려 하지 않는다 — 16px 에서 읽히는 덩이 몇 개가 잔점 스무 개보다 낫다.
   - 건물: T = 깊이 D × 16, F = 층당 32(1층 48+). 지붕(윗면)과 정면 사이에 처마선. 옆면은 그리지 않는다.
   - 차: 가로 방향(T 얇은 띠 + 옆이 아니라 앞뒤가 어긋나지 않게 방향 일관) / 세로 방향(앞 또는 뒤 향, T≥20·비 0.90~3.00). 택시는 두 방향 다 §10 표 그대로.
   - 실내 벽 붙은 키 큰 가구: T 4~6px + 앞 가장자리 하이라이트 1행 + 처마 그림자 2px. 탁자·침대·카운터 T = 깊이의 0.5~1.0배(8~14px) + F 다리 8~14px. 의자 좌판 T 4~6 + 다리 6~8. 상자·통 T 4~8 + F 8~16.
3. **검사기 관문을 통과시킨다** (통과 = exit 0):
   - 실외(18303 의 jp·modern·school place=out): `python3 scripts/content/atlas-pick/view34_check.py <파일>.png[:분류]` — 차는 `:vehicle`, 킷은 조립 예 PNG. 판정이 `OK` 여야 한다(FRONT/NOTOP/TOPDOWN 이면 다시).
   - 실내(horror, school place=in, 18302): `python3 scripts/content/atlas-pick/interior_view34_audit.py --wall-tall <파일>.png`(벽 붙은 키 큰 가구) 또는 `--object <파일>.png`(일반 가구). T≥3 이고 f≥15.
   - `.pxg` 는 워크플로대로 PNG 로 렌더해 그 PNG 를 검사한다.
4. **맥락 그림으로 눈 확인** — 검사기가 통과해도 그림이 3/4 로 읽히는지는 눈이 판정한다:
   `python3 scripts/content/atlas-pick/view34_context.py <파일>.png [--in] [--wall]` → `<파일>.v34ctx.png`(4배). 히어로 16×24 를 옆·앞·뒤(발이 가려짐)에 세운다. `--in` 실내 널마루, `--wall` 벽 붙은 가구. 크기가 히어로에 견줘 맞나, 윗면이 앞면과 다른 명도로 내려다본 면으로 읽히나, 뒤 히어로가 윗면 너머로 자연스럽게 가려지나 본다. 이 `*.v34ctx.png` 는 확인용이라 **커밋하지 않는다**.
5. **적대적 눈 검수 2회.** 1회: 「원본과 같은 물건으로 읽히나·정면 도면 같지 않나·윗면이 그냥 얇은 띠 아닌가」를 반대 입장에서 공격한다. 고친 뒤 2회: 「인접 타일(바닥·벽·다른 가구)과 이어 붙였을 때 명도·윤곽이 튀지 않나」. 두 번 다 원 크기와 4배 둘 다 본다.

## 4. 커밋 (자기 경로만)
- `git add` 는 **네가 만든 새 후보 파일**(`v34-A.pxg` 와 렌더 PNG·킷 조립 예)만 경로로 지정한다. `git add -A`·`git add .` 금지.
- **절대 add 하지 않는다**: `candidates-worldmap/*/w*.check.json`, `picks-jp.json`, `picks-school.json`, `picks-worldmap.json`, `ascii-pixelize/post/*.png`, `ascii_scratch.py`, 추적 안 되는 `tiledata/atlas-pick/work/`, `*.v34ctx.png`.
- `index.lock` 에 걸리면 몇 초 뒤 재시도한다(다른 작업자와 같은 저장소). 커밋 메시지 예: `feat(content): 3/4 재작도 V04 — 일본 일반 항목 N개`. push 는 하지 않는다.
- 테스트·게이트·vitest·stash 는 돌리지 않는다. 검증은 위 관문 스크립트와 눈이다.

## 5. 배치 표 (2026-09-30 기준, 총 8배치·168개, 사용자 선택 88개)
| 배치 | 세트 | 피커 | 개수 | 가중 |
|---|---|---|---|---|
| V01 | 실내 v5 | 18302 (w90) | 27 | 27 |
| V02 | 실내 v5 | 18302 (w91) | 28 | 28 |
| V03 | 학원 | 18303 | 27 | 27 |
| V04 | 일본 | 18303 | 27 | 33 |
| V05 | 일본 킷 | 18303 | 8 | 32 |
| V06 | 호러 | 18303 | 18 | 18 |
| V07 | 현대 | 18303 | 15 | 15 |
| V08 | 호러 | 18303 | 18 | 18 |

**25개 미만인 배치가 있는 이유.** 배치는 (1) 한 세트 안에서만 묶고(세트마다 팔레트·규칙·폴더가 달라 섞으면 작업자가 문서 셋을 오간다), (2) 가중으로 나눈다 — 킷 1벌은 부품 시트+조립 예까지 만들어 4개 분량이다. 그래서 일본 킷(V05)은 8벌 = 가중 32, 현대(V07)는 대상 자체가 15개뿐, 호러는 36개를 둘로 나눠 18+18 이다.

## 6. 목록에 없는 것과 그 이유
목록 `exclusions` 에 사유가 있다.
- `exempt` 101 — 검사기 면제 분류(바닥·나무·기둥·표지·얇은 판·킷 부품). 계약 §10-5 대로 눈으로 본다. 2단계 눈 검수에서 잡히면 감독자가 목록에 추가한다.
- `deferred-no-folder` 54 — v5 실내인데 18302 에 후보 폴더가 없어 새 후보를 붙일 곳이 없다. 폴더를 만들면 다음 목록에서 들어온다.
- `interior-ok` 10 — 호러에서 이미 3/4 를 통과하는 변형(ok)이 있는 기물.
- `other-agent` 1 — 월드맵은 별도 에이전트가 작업 중이라 건드리지 않는다.

목록을 다시 만들려면 `python3 scripts/content/atlas-pick/make_view34_rework.py`(감사 JSON `view34-audit.json`·`interior-view34-audit.json` 을 먼저 갱신).

## 7. 감독자 확인
- 배치가 끝나면 항목별로 `view34_check.py`/`interior_view34_audit.py` 가 exit 0 인지, 두 피커에서 새 후보가 원본 옆에 뜨는지(18303 「후보 모아 보기」·18302 후보 패널) 확인한다.
- 계약 요약 페이지: http://mdc-server:18301/view34-contract.html
