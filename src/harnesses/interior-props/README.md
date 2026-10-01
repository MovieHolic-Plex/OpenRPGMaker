# 소품 하네스 — 여러 명이 찍고, 사용자가 고른다

16px 손 도트 실내 기물(`atlas_biome_interior`, 손 도트 v5 계열)을 고칠 때 쓴다.
**취향 판단은 사용자만 한다.** 감독(세션 에이전트)은 판을 열고, 깨짐만 거르고, 사용자가 고른 것을 굽는다.
감독이 후보를 골라 시트에 끼워 넣지 않는다 — 2026-10-01 전수조사에서 감독이 고르고 고친 그림 다수가 「더 이상해졌다」로 되돌려졌다(`tiledata/atlas-pick/modern-style-bible.md` §11-4b).

## 한눈에

```
사용자: 화면에서 기물 고르기(+메모) ──► 판 h<N> 생성 + 작업지시서(brief)
                                       │
                                       ▼
             Sonnet 5.5 · effort medium × 5 (동시 5) — 방향 A·B 최소 수정, C·D 기준 맞추기, E 자유
                                       │  각자 candidates/<기물>/h<N>-<글자>.pxg 하나 + 메모
                                       ▼
            깨짐 검사(check_candidate.py — 팔레트·캔버스·접지선·투명) ──불합격──┐
                                       │ 통과                             │
                                       ▼                                  │
   독립 검수자(Sonnet 5.5 · effort high, review.md) — 3/4 시점 + 「지금보다 나빠졌나」  │
   지금|후보 8배 나란히 · 같은 방 안 4배 · 짝·화풍 기준·합격/불합격 견본을 보고 verdict.json
                                       │ PASS            FAIL ──────────────┤
                                       │                                  ▼
                                       │        이유·고칠 것을 들고 같은 작업자가 지난 시도에서 다시 그림
                                       │        (지난 시도는 h<N>-<글자>.a<k>.* 로 남는다, 최대 3번 — PROP_HARNESS_ATTEMPTS)
                                       ▼        3번 다 떨어지면 빨간 「3/4 ✗」 와 이유를 달고 화면에 그대로 나온다(그래도 고를 수 있다)
사용자: /harness 에서 지금 그림 vs 후보 5장(단품·방 안) → 확정 / 지금 그대로 / 버림+이유 / 다시 뽑기(+메모)
                                       │
                                       ▼
감독: harness.py bake → 시트 굽기 → 방 전·후 확인 → PR
```

## 쓰는 법

### 화면 (사용자)
- `http://mdc-server:18302/harness` (고르기 서버 `hand-interior-pick.service` 에 붙어 있다).
- **기물 골라 새로 뽑기** 탭: 414종 그림 목록 — 찾기·분류 칩으로 좁히고, 눌러서 여러 개 고르고, 메모를 달아 「후보 5장씩 뽑기」.
- **후보 고르기** 탭: 왼쪽 = 고를 차례 / 그리는 중 / 끝남. 가운데 = `0 지금 그림` + `1~5` 후보.
  - 숫자 키로 고르고 `Enter` 로 확정 → 다음 기물로 넘어간다. `0` → `Enter` = 지금 그대로.
  - 카드의 `✕`(또는 `X`) = 버림 → 이유 칩(시점 이상·크기·화풍·안 읽힘·지저분함·원래가 나음)을 누른다. 버린 것과 이유는 다음 판 작업지시서에 「하지 말 것」으로 들어간다.
  - `V` 단품/방 안, `B` 배경, `+`/`-` 확대, `Space` 누르고 있기 = 고른 후보 자리에 지금 그림 겹쳐 보기, `↑`/`↓` 기물 이동.
  - 아래 메모 + 「다시 뽑기」 = 같은 기물 새 판(5장). 「고른 후보에서 출발」을 켜면 고른 후보를 출발점으로 다듬는다.
- 고른 것은 `picks.sqlite`(정본)에 사용자 선택(client=web)으로 들어간다 → 다음 판의 화풍 기준(anchors)이 된다.

### 명령 (감독 세션)
```bash
python3 src/harnesses/interior-props/harness.py draw "chair E" "chair W" --note "…"   # 화면 대신 명령으로 판 열기
python3 src/harnesses/interior-props/harness.py status                               # 판·작업자 상태
python3 src/harnesses/interior-props/harness.py review 3 4                           # 이미 그린 판을 (다시) 검수에 — 떨어지면 다시 그린다
python3 src/harnesses/interior-props/harness.py bake                                 # 고른 것 굽기(build_tileset → prepare-references)
```
굽고 나면: 방 전·후를 `~/claude-viz/` 에 올려 사용자에게 보이고, 사용자가 괜찮다고 할 때 커밋·PR.
**고르기 서버가 도는 워크트리**(지금 `/home/main/z-project/rpg-zzu-interior-pick`)에 후보가 쌓인다 — 굽기·커밋도 거기서(브랜치를 따서) 한다.

## 파일

| 파일 | 하는 일 |
|---|---|
| `harness.py` | 명령줄: `draw`·`pool`·`status`·`bake`. `pool` = 대기열 일꾼(동시 `PROP_HARNESS_PAR`=16, 한 명 `PROP_HARNESS_TIMEOUT`=40분) — `draw` 가 알아서 띄운다 |
| `brief.py` | 판마다 작업지시서: 지금 그림·방 안·**같은 물건의 짝(family/)**·화풍 기준(anchors/ = 사용자가 고른 것, 모자라면 같은 분류 v5 원본)·버린 후보와 이유·사용자 메모. 방향 5개(`DIRECTIONS`) |
| `prompt.md` | 작업자 지시문 틀(한 장만, 자기 파일만, 3바퀴 자기 검수, git·테스트 금지) |
| `examples/` | 작업지시서 `view34/` 에 8배로 들어가는 3/4 예시 — `good-*`(칩셋 책장·옷장·찬장·벽난로, 손으로 고친 투구 선반) / `bad-*`(같은 물건의 정면도). 벽면 걸이·바닥 무늬 판에는 넣지 않는다 |
| `review.md` | 검수자 지시문 틀 — **꼭대기 면 규칙**(가구의 가장 높은 수평 면 윗면 ≥3행, 안쪽 선반판은 대신 못 함, 얹힌 물건도 윗면, 「벽에 붙임」≠벽면 걸이; 하네스 `_top_gate` 가 `top_rows<3` 이면 PASS 를 FAIL 로 뒤집는다, 판정 그림 `ref-x8.png` = 칩셋 합격 가구|후보) · 3/4 계약(옆을 보는 물건의 L자 옆모습은 정상), 사유 코드 FRONT·THIN·TOPDOWN·CAP·MIXED·SIDE·WORSE·READ, verdict.json 형식 |
| `store.py` | `~/.local/share/oprn/prop-harness/harness.sqlite` — rounds·runs·feedback (추가만) |
| `api.py` | 고르기 서버에 붙는 경로: `/harness`, `/api/harness/{state,objects,thumb,decide,draw}` |
| `web/index.html` | 고르는 화면 |

저장소 밖 데이터(워크트리가 지워져도 남는다): `~/.local/share/oprn/prop-harness/` — `harness.sqlite`, `rounds/h<N>/`(작업지시서·그림), `logs/h<N>-<글자>.log`(작업자 출력), `logs/pool.log`.

## 바꿀 수 있는 것
- 모델·노력: `PROP_HARNESS_MODEL`(기본 `claude-sonnet-5-5`), `PROP_HARNESS_EFFORT`(그리기, 기본 `medium`), `PROP_HARNESS_REVIEW_EFFORT`(검수, 기본 `high`), `PROP_HARNESS_ATTEMPTS`(한 장 최대 그리기 횟수, 기본 3). 고르기 서버 유닛 환경에 넣으면 화면에서 연 판에도 적용된다.
- 방향: `brief.py` 의 `DIRECTIONS`. 버림 이유 칩: `REASONS`.

## 새 기물 (아직 고른 그림이 없는 `tiledata/hand-interior/new/items.json` 항목)
- 방향이 바뀐다: A 설명 충실 · B 같은 방 화풍 · C 단순·또렷 · D 장식 · E 자유 해석(`brief.NEW_DIRECTIONS`). 출발 파일은 빈 캔버스.
- 항목의 `refs`(가장 닮은 기존 기물)가 화풍 기준 맨 앞에 들어간다 — 보물상자 → 상자·왕실 상자.
- 검수는 「지금보다 나빠졌나」 대신 「설명대로 읽히나」(`READ`·`STYLE`), 설명의 수치(높이·윗면 행 수)를 잰다.
- **설명이 곧 그림 명세다.** 「16px 솟음」 처럼 높이만 적으면 키 큰 정면 상자가 나온다(큰 보물상자 h14) — 넓적한 물건은 전체 높이와 윗면 행 수를 적는다.

## 검수의 한계 (2026-10-01 보정 시험)
v5 원본을 일부러 후보로 넣어 검수자를 시험했다(`PROP_HARNESS_DATA` 를 임시 폴더로 바꿔서). 대리석 기둥(머리가 정면 띠)은 떨어뜨리고 다시 그리게 해서 머리 윗면이 두꺼워진 그림으로 합격,
나선 계단·조리 화덕(사용자가 「이전이 낫다」 한 것)은 합격 — 맞았다. 통(뚜껑 타원)은 전수조사와 판정이 갈렸고, 의자 좌판 윗면 1행도 「방 안에서 읽힌다」로 합격시킨다.
**2026-10-02 사용자 지적:** 투구 진열 선반 h49 다섯 장이 모두 윗판 없는 정면도인데 「3/4 ✓」였다. 원인 — 안쪽 선반판 2행 띠를 윗면으로 셌고, 윗판 1행을 적고도 통과시켰고, 얹힌 투구는 「소품 크기라 허용」, 새 기물에도 「확실하지 않으면 통과」가 걸렸고, 「벽에 붙임」을 벽면 걸이로 읽었다. 꼭대기 면 규칙 + `_top_gate` 를 넣은 뒤 같은 다섯 장을 Codex 로 다시 검수하니 다섯 장 모두 FRONT(꼭대기 0~1행), 손으로 고친 판(윗판 3행)은 꼭대기 규칙을 통과했다. 화면 딱지는 「3/4 ✓」에서 「검수 통과」로 바꿨다. **그 전 검수 결과(h3~h129)는 이 규칙 전이다.**

**작업지시서도 같이 고쳤다(2026-10-02).** 정면도가 무더기로 나온 원인은 그리기 쪽에 있었다 — (1) 가구의 「가장 닮은 기물」에 방패 진열 같은 벽면 걸이를 주고 「규칙보다 이 그림을 따르라」고 했고, (2) 시점 절이 「몇 줄 보인다」뿐이었고, (3) 설명문이 「선반판 윗면」만 말했고, (4) 전수조사 위반 원본이 기준 그림으로 들어갔다.
지금: 시점 절에 꼭대기 윗면 ≥3행·안쪽 판은 대신 못 함·얹힌 물건 윗면·「벽 앞 기물」≠걸이를 숫자로 적고 `view34/` 예시 그림을 먼저 열게 한다. 작업자는 `꼭대기 윗면 N행` 을 재서 메모에 적는다.
기준 그림(anchors)은 바닥·벽 앞 가구에서 걸이·바닥 무늬를 빼고, `audit/v34-audit-verdicts.json` 에서 FAIL 인 v5 원본을 뺀다(`brief._anchor_ok`). 화풍은 기준 그림, 시점은 시점 절이 우선한다.

**검수 통과는 「확실한 시점 깨짐·퇴보는 없다」는 뜻이지 합격 보증이 아니다.** 마지막 판정은 화면에서 사용자가 한다. 기준을 조이거나 풀려면 `review.md` 의 「3/4 시점 계약」을 고친다.

## 함정
- 작업자 프로세스를 끌 때 `pkill -f <경로>` 금지 — 명령 줄에 같은 글자가 든 자기 셸까지 죽는다. `harness.py status` 로 보고, pid 로 끈다.
- 고르기 서버를 다시 띄우면(`systemctl --user restart hand-interior-pick`) 일꾼은 따로 돈다(`start_new_session`) — 그리던 판은 이어진다. 일꾼이 죽었으면 다음 `draw` 때 `running` 이 `queued` 로 돌아가 다시 돈다.
- 후보 이름 `h<판>-<A..E>` 는 `common.WORKER_RE` 가 받는다(w·h·pilot).
