# object-gate — 공용 3/4 시점 오브젝트 게이트

> 상태(2026-10-14): **판정기·영수증·Python 확인·칸 관문 코드 + 화풍 반쪽(버들항 기준).** 판정자는 gemini-4-argon(effort medium — 사용자 미확인 가정).
> 보정 프로필 `473db36f963972c9` 는 **rejected**(아래 「2026-10-14 개편」) — 어느 출구에도 아직 걸지 않았고, 옛 영수증 5,296장은 무효다.

## 왜

2026-10-08 무림·던전 기물 판에서 윗면 없는 정면 입면도(청동 정·징 틀·무기 걸이·서가·약재장·상자·화로…)가
하네스 관문과 LLM 검수자를 모두 통과했다. 기존 관문 F 는 작업자가 선언한 `meta['top']` 행만 믿고,
LLM 검수자 하나·한 번은 일부 증거만 보고 통과시킨다. 실측으로 어느 경로도 그림 자체에서 3/4 시점을 재서 막지 않았다.
사용자: 「에디터든 어느 하네싱이든 오브젝트를 생성하면 검증 게이트를 거치게끔 해야 한다」.

결정(사용자 승인):
- 기존 번들 시트는 소급 면제(감사 보고서만), **새 그림만 막는다.**
- 번들·공용 DB·스토어 출구는 **예외 없이** 막는다.
- 에디터 공방(사용자 프로젝트 칩셋)만 **사람이** 「그래도 넣기」를 누를 수 있다. 조수·에이전트는 못 누른다.

## 구성

| 파일 | 역할 |
|---|---|
| `src/harnesses/_core/objectGate/rules.ts` | 판정자 지시문, 종류(kind)별 기준, 여러 판정 합치기(`decideObjectGate`), 프로필 |
| `src/harnesses/_core/objectGate/receipt.ts` | 그림 정규화·화소 해시, 프로필 해시, 영수증 형, 출구 판정 `objectGateRefusal` (브라우저·노드 공용) |
| `src/harnesses/_core/object_gate/__init__.py` | 굽기 스크립트용 `require_pass(img, kind=, context=, label=)` · `require_all` · `pixel_sha256` — 모델을 부르지 않고 영수증만 본다 |
| `src/harnesses/object-gate/node/judge.mts` | 판정기(bun): `review` · `calibrate` · `audit` · `preview` |
| `src/harnesses/object-gate/node/cells.ts` | 시트 칸 관문 — 기준선에도 통과 영수증에도 없는 새 칸을 찾는다 |
| `src/harnesses/object-gate/node/sheets.ts` | 번들 칩셋·공용 라이브러리 아틀라스 목록 |
| `harness-data/object-gate/` | `receipts/<sha[:2]>/<sha>.json`, `profiles/<hash>.json`, `calibration/<set>/{labels.json,*.png}`, `calibration/history/` |

## 판정

- (2026-10-14 부터) 판정자 `google-antigravity gemini-4-argon`(medium) 하나 × 네 번. 옛 구성은 gemini-3.8-flash×4(10-13), gpt+gemini×2(10-09).
- 그림은 10배(큰 그림은 줄임) + 1화소 격자 + 왼쪽 행 번호 눈금으로 보낸다(`preview` 로 확인).
- **종류는 부르는 쪽이 준다**(판정자가 고르지 않는다). 판정자는 숫자(윗면 행 수·아가리 행 수)와 예/아니오를 답하고,
  통과 여부는 규칙이 계산한다. 숫자는 **중앙값**, 예/아니오는 **과반**.
  v1 만장일치는 한 판정자의 우연한 오독이 정상 기물을 떨어뜨렸다(정상 10/28).
- `organic`·`debris`·`flat`·`wall_mounted`·`terrain` 은 시점 규칙 면제지만 판정자 과반이 「종류가 맞다」고 해야 한다
  (진열장을 organic 이라 불러 빠져나가지 못하게).
- 영수증은 **정규화한 그림의 화소 해시**(완전 투명 RGB→0, 불투명 경계 상자로 자름)에 묶인다. 여백만 다른 같은 그림은 같은 영수증.
  한 화소라도 바뀌면 다시 판정받아야 한다.

## 보정

프로필(지시문·종류 기준·판정자·반복 수)이 바뀌면 해시가 바뀌고, **위반 표본을 하나도 놓치지 않은** 프로필만 효력이 있다.

| 판 | 표본 | 위반 잡음 | 정상 통과 | 결과 |
|---|---|---|---|---|
| v1 만장일치 | 무림 11 + 던전 35 | 17/18 (청동 정 놓침) | 10/28 | rejected |
| v2 중앙값·과반 | + 실내 66 (전수조사 41/25) | 45/59 | 38/53 | rejected |

v2 가 놓친 14개는 모두 실내(도마 통나무·제단·회중석·설교대·관·기둥·소파·장작·룬석·금고·건초·나선 계단·환자 침대).
다음: 그 14개의 판정별 숫자를 보고 종류·기준 조정 → 무림·던전 표본(고치기 전 커밋 `agent/murim-props` 7cb02a3c02 계열,
`agent/dungeon-props` c2405738b9) 다시 뽑기 → 재보정. 로그는 `calibration/history/`.

## 시트 칸 관문

기물이 메타데이터 없이 시트에 붙어 들어오는 길까지 막는다. 시트의 비지 않은 칸은
① 기준선(`baseline-cells.txt`, 도입 시점의 번들·공용 DB 칸) ② 출구 규칙을 통과한 영수증의 칸 중 하나여야 한다.
영수증은 판정한 원본 PNG 를 칸 크기 16·24·32·48 × 정렬 변형으로 자른 칸 해시를 들고 있다. 지형 조각은 kind `terrain` 으로 판정받는다.
기준선 생성(`baseline`)과 출구 배선은 아직 없다.

## 쓰는 법

```bash
npm run harness -- object-gate review --png a.png --kind tall_furniture --name "scroll shelf" --label murim/prop_scroll_shelf
npm run harness -- object-gate review --batch items.jsonl     # 줄마다 {png,kind,name,label}
npm run harness -- object-gate calibrate
npm run harness -- object-gate check --png a.png --context bundle   # 모델 호출 없이 영수증만
npm run harness -- object-gate status
npm run harness -- object-gate preview --png a.png               # 판정자가 받는 확대 그림
```

```python
import sys; sys.path.insert(0, "src/harnesses/_core")
from object_gate import require_all, ObjectGateRefused
require_all([(img, "tall_furniture", "murim/prop_scroll_shelf"), ...], context="bundle")  # 하나라도 막히면 아무것도 쓰지 않는다
```

## 부품은 조립 건물로 (2026-10-13)

윗면을 혼자 보일 수 없는 건물 부품(jp_city 1층 상가 띠 `jp-sf-*`, 143개)은 띠 + 위층 + 지붕을 조립기가 짓는 대로 합친 조립 건물 그림을 kind `structure` 로 같은 판정자·같은 기준에 낸다.
띠가 조립 그림 안에 화소 그대로(정수 오프셋, `_gate_assembled/manifest.json`) 들어 있고 그 그림 영수증이 통과일 때만 「covered by assembled <표본>」으로 센다.
코드: `scripts/content/jp-city/gate_assembled.py`(build·covering), `gate_kinds.check_all`. 표본 44장(역할 × 좌우 × 폭 3~6/7~9, 한 장에 건물 여러 채) 전부 PASS.
평지붕(`roof.plain.*`·`ac`·`stair`)을 얹은 조립 건물은 7장 중 1장만 통과(윗면 0행) — 표본은 윗면이 보이는 `roof.hip` 으로 지었다. 거리 구성기가 쓰는 평지붕 건물 자체는 이 관문을 못 넘는다.

## 2026-10-14 개편 — 한 번에 3/4 + 버들항 화풍

한 번의 판정(규칙 v4)이 A 3/4 시점 · B 버들항 화풍 둘을 함께 정한다. 둘 다 통과해야 통과이고, 영수증은 두 판정(`view34`·`style`)과 보조 지표(`metrics`)를 그림 해시·프로필 해시에 묶는다.

- **화풍 비교:** 판정자는 같은 종류의 버들항 기준 그림(`harness-data/object-gate/style-refs/`, `beodeulCityTileset.json` 키트·타일 묶음에서 뽑음)을 같은 배율(2배)로 후보 옆에 놓은 판(`preview` 가 `.board.png` 로 저장)을 본다.
  보는 것: 명암 단계(버들항 약 5~6), 윤곽색(이웃 재질의 어두운 색이지 거의 검정이 아님), 질감 점·결, 칸당 정보량, 평면 채움. 테마마다 잠긴 팔레트는 그대로 두고 구조·명암만 본다 — 버들항 색을 요구하지 않는다. 화풍 반쪽은 동률이면 탈락(≥ 절반 fail).
- **숫자 지표는 보조:** 칸당 고유색 중앙값(버들항 10, p90 약 44)·어두운 5% 밝기·거의 검정 윤곽 비율. 통과 근거가 아니다.
- **429:** 계정 한도 429 는 표로 세지 않고 `Resets in` 만큼 기다려 다시 부른다. 병렬 호출은 최대 4.
- **프로필 해시** = 규칙 상수 + 화풍 기준 매니페스트 해시 + view34-guide 해시. 답 캐시 키(프롬프트 해시)는 규칙 숫자를 빼므로 임계값만 바꾸면 `calibrate --offline` 으로 모델 없이 다시 계산한다.
- **명령:** `calibrate --set interior,murim,style --runs N [--only ..|--limit ..|--offline|--record]` ·
  `rereview --themes a,b [--audit|--dry|--limit N|--runs N]`(중단 후 이어서 가능, **보정 통과 전엔 영수증을 쓰지 않고 거절**) · `review --style-kind building|…` · `status`(새 프로필·무효 옛 영수증 수).
- **표본:** 3/4 = 실내 66 + 무림 10(`calibration/murim/`, `agent/murim-props` 에서 구해 옴) + 던전 표본은 유실. 화풍 = 농장 v2(반려)·v3(PR #2541 수락), 합성 얕은 그림(4색 양자화 + 거의 검정 윤곽), 버들항 보류 표본, PR #2544~#2558 의 전/후(약한 라벨: 머지가 버들항 수준을 보증하지 않는다). `calibration/style/items.json`.

### 보정 결과(프로필 `473db36f963972c9`, rejected, 기록 `calibration/run-473db36f963972c9.json`)

| 반쪽 | 위반/얕음 잡음 | 정상/버들 통과 | 비고 |
|---|---|---|---|
| 3/4 | 17/47 | 27/36 | 지시문·기준 그림 보강으로도 안 올랐다. minTopRows 3→6 쓸어 보면 잡음 15→41 이지만 정상 통과 21→10 /29 로 같이 무너진다 — 분리하는 값이 없다 |
| 화풍 | 53/71 | 43/78 | 강한 라벨(농장 v2/v3·합성 얕음·버들항 보류)에서는 갈림, 얇고 작은 기물(울타리 v-3·밭)은 불안정. 약한 라벨 전/후 통과 15/60 → 26/60 |

투표 3번이어도 거의 같다(3/4 17/47·28/36). 그래서 4번 유지. **판정:** 3/4 반쪽이 위반을 못 잡아 보정 불통과 → `rereview` 로 영수증을 만들지 않았다. 코드 손 도트가 아니라 판정기 해상도·모델 한계가 병목으로 보인다(Argon 은 대부분의 나쁜 표본에서 윗면 3~5행을 「본다」).
다음: 3/4 숫자를 모델이 아닌 픽셀 기하(윗면 면 판별) 보조로 가르는 안, 또는 판정자 교체를 사용자와 상의.

참고 실험(정보용, effort high): 3/4 에서 medium 이 놓친 위반 표본 10개를 high 로 다시 돌리니 1/10(요람)만 잡혔다 — 더 오래 생각해도 3/4 반쪽은 갈리지 않는다(캐시 `calibration/answers/4ef633c92e11aacb`, 98호출 중 88 만 받고 Argon 일일 한도 429 로 중단, 전체 보정으로는 못 돌림).
