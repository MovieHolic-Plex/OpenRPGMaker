# 현대·강남·일본(+호러·학원) 칩셋 작업 — 인수인계 (2026-10-01)

사용자가 「강남·현대·일본은 보류, 다른 세션에서 관리」로 넘긴 작업의 지도. 전부 main 에 있다(PR #1771·#1782).
**앱 번들(src/·public/)에는 아직 안 들어갔다** — 여기 것은 데모·후보·학습 자료다. 에디터에서 쓰려면 고른 조각을 시트로 굽고
`src/assets/bundled.ts` + `ensureBundledTilesets` 에 등록하는 공용 단계가 따로 필요하다(AGENTS.md 「새 타일은 공용에」).

## 기준 문서 (먼저 읽기)
- `modern-style-bible.md` — 팔레트 modern3, 빛·램프, **§10 3/4 시점 계약**(윗면 T+앞면 F, 옆면 없음, 빛 왼쪽 위), §11 실내 3/4, **§12 칸수 1칸=16px=1m**.
- `WORKER-VIEW34.md`(3/4 재작도 절차), `WORKER-JP.md`·`WORKER-JP-KIT.md`(일본 조각·조립 킷), `WORKER-HORROR.md`, `WORKER-SCHOOL.md`, `jp-style-v2.md`.
- `beodeul-study.md` + `beodeul-study/` — 버들항(기본 타일셋 후보) 문법 실측. 강남 v2 가 이것을 따른다.
- 결정(사용자): 생성 이미지 쓰지 않음 — **손 도트(pxgrid·Pillow) + 3/4 + 피커에서 사용자 선택**. 트레이싱·32px 포기, 16px.

## 무엇이 어디에
| 세트 | 후보 폴더 | 비고 |
|---|---|---|
| 현대(강남) | `candidates-modern/` | v0 = 현재 시트판, v34-A·v35-A 손 도트 재작도 |
| 일본 | `candidates-jp/`, 킷 `kits-jp.json` | 후보끼리 고름, 큰 구조물은 조립 킷 |
| 호러 | `candidates-horror/`, 방 `rooms-horror/` | v34/v35 |
| 학원 | `candidates-school/` | v35 |
| 강남 v2 데모 | `gangnam-v2/`(조각 85·장면·킷 3) | 버들항 문법·3/4. 약점: 가로 차도 택시가 정면, 뒤편 주차장 빔 |
세트 정의 `sets.json`. 검사기: `scripts/content/atlas-pick/view34_check.py`(3/4, **거짓 통과 있음** — 통 단면 정면 입면도를 OK 로 봄, 눈 검수 병행), `size_calc.py`(칸수).

## 고르는 화면
- 18303 `scripts/content/atlas-pick/pick_server.py` (systemd --user `atlas-pick.service`). 정본 `~/.local/share/oprn/atlas-pick/picks.sqlite`(이 박스에만), 내보내기 `picks-<세트>.json`(저장소).
- 다른 박스에서 이어 가면 picks.sqlite 가 없다 → `picks-*.json` 이 마지막 내보내기다.

## 남은 일 (2026-10-01 기준)
- 사용자가 18303 에서 현대·일본·호러를 아직 다 고르지 않았다.
- 학교 그랜드피아노(2×2)·이층 침대 규격 재지정, 마을·실내 데모 맵(빵집·여관·교실·일본 거리 블록) 조립.
- 고른 조각을 시트로 굽고 공용 번들에 등록(위 「앱 번들」).
