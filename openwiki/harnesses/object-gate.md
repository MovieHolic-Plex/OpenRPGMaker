# object-gate — 공용 3/4 시점 오브젝트 게이트

> 상태(2026-10-09): **판정기·영수증·Python 확인·칸 관문 코드까지.** 보정 프로필이 아직 `calibrated` 가 아니라
> (아래 「보정」) 어느 출구에도 아직 걸지 않았다. 출구 배선은 다음 단계다.

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

- 판정자 둘(gpt `openai-codex gpt-6.1-sol`, gemini `google-antigravity gemini-3.8-flash`) × 두 번.
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
