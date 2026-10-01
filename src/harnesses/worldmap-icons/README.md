# 월드맵 아이콘 하네스 — 검수자가 보고, 사용자가 받기/버리기

`tiledata/worldmap-kit/iconsets/*` 의 월드맵 아이콘(판타지·사막·동양풍·현대·SF, 17 역할)을 쓸지 말지 정하는 곳이다.
**받기/버리기는 사용자만 한다.** 감독(세션 에이전트)은 그림을 준비하고 검수자를 돌리고, 결정 파일을 읽어 다음 단계를 연다.
감독이 고르거나 대신 판정해 번들·지도에 넣지 않는다 — 2026-10-01 월드맵 v8/v9 에서 감독이 직접 판정한 아이콘 다수가
「3/4 가 아니라 아이소메트릭」으로 지적받았다.

## 한눈에

```
intake ── 세트의 아이콘마다: 단품 8배 · 실제 월드맵 자리에 붙인 3배 · 1배(게임 크기)
   │
review ── 독립 검수자(Codex CLI gpt-6.1-sol medium, 동시 8) — review.md 의 시점 계약으로 PASS/FAIL + 이유 + 고칠 것
   │      (기준 그림: 원본 EasyRPG 월드 시트의 마을·성·탑 칸)
   ▼
사용자: http://mdc-server:18313/ ── 받기(A) / 버리기(이유 칩 + 메모, Enter) / 결정 지우기
   │
export ── harness-data/worldmap-icons/decisions.json (client=web 결정 + 검수 요약)
   │
감독: 결정 파일을 읽고 다음 단계 — 버린 것은 다시 그리기 판, 받은 것은 등록 작업(따로 확인받고)
```

## 시점 계약 (review.md)
카메라는 정남쪽 위. 보이는 면은 **윗면 + 남쪽 정면 벽** 둘뿐, 좌우 대칭에 가깝고 벽 경계는 수평.
**옆면(오른쪽·왼쪽의 다른 명암 세로 면)이 보이면 불합격(`SIDE`)**, 윗선이 사선으로 물러나면 `DIAG`.
자연물(화산·거목·돌원·동굴 바위)은 `SIDE` 면제. 사유 코드: `SIDE` `DIAG` `FRONT` `TOPDOWN` `READ` `STYLE`.
검수 ✓ 는 「확실한 시점 깨짐은 없다」는 뜻이지 합격 보증이 아니다 — 마지막 판정은 화면에서 사용자가 한다.

## 명령 (감독 세션)
```bash
python3 src/harnesses/worldmap-icons/harness.py intake              # 그림 다시 만들기(세트 그림이 바뀌면 sha 가 바뀌어 옛 결정은 무효)
python3 src/harnesses/worldmap-icons/harness.py review              # 검수 안 된 것만. --redo 전부, --only 세트/이름 …
python3 src/harnesses/worldmap-icons/harness.py status
python3 src/harnesses/worldmap-icons/harness.py export
```
화면 서버는 사용자 유닛 `worldmap-icon-harness`(transient, 18313) — 죽었으면:
```bash
export XDG_RUNTIME_DIR=/run/user/$(id -u) DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u)/bus
systemd-run --user --unit=worldmap-icon-harness -p Restart=on-failure /usr/bin/python3 <체크아웃>/src/harnesses/worldmap-icons/harness.py serve --port 18313
```

## 파일
| 파일 | 하는 일 |
|---|---|
| `harness.py` | `intake`·`review`·`status`·`export`·`serve`. 저장소(sqlite, 추가만)와 화면 API(`/api/state`, `/api/decide`, `/f/<세트>/<이름>/<그림>`) |
| `render.py` | 키트(`tiledata/worldmap-kit/kit`)로 지형을 한 번 그리고, 아이콘마다 그 자리에 붙여 둘레까지 잘라 낸다(`fantasy-5act` 여정 · `original` 팔레트) |
| `review.md` | 검수자 지시문 틀 |
| `web/index.html` | 받기/버리기 화면 |

저장소 밖 데이터: `~/.local/share/oprn/worldmap-icon-harness/` — `harness.sqlite`(items·reviews·decisions), `items/<세트>/<이름>/`(그림·verdict.json),
`logs/`(검수자 출력·지시문). 결정의 정본은 sqlite, 저장소의 `harness-data/worldmap-icons/decisions.json` 은 결정마다 다시 쓰는 사본이다.

## 아직 없는 것
- **다시 그리기 판.** 버린 아이콘을 작업자 여럿이 정면 3/4 로 다시 그리고 사용자가 후보 중에 고르는 단계(소품 하네스의 `draw` 와 같은 모양)는
  사용자 결정이 모인 뒤에 붙인다. 그때 버린 이유·메모·검수자의 `fix` 가 작업지시서에 들어간다.
- 하네스 레지스트리(`src/harnesses/_core`, PR #1832) 등록 — 그 PR 이 main 에 들어오면 한 줄 등록한다.
