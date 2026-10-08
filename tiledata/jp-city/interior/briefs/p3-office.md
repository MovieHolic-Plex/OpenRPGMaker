# 작업: jp_city 일본 실내 3묶음 — 사무실 빌딩 `interior_office` (id 머리 `of-`)
새 파일: `scripts/content/jp-city/blocks/interior_office.py` (`R = Registry('interior_office', '사무실')`, interior_public.py 모양 그대로).
거리에 6층 사무 빌딩 외관 `jp-bldg-office6` 과 잡거 빌딩 `jp-bldg-zakkyo5`(키트 `tiledata/jp-city/kit-index.json`)가 있다 — 사무 빌딩 실내다(일본 중소기업 사무실: 島型 책상 배치, 과장 책상이 섬 끝, 회의실, 給湯室, 흡연실 대신 휴게 코너).
**도구 호출 12번 안에 첫 그림을 쓰고** 블록을 돌린다.

## 그릴 것 (전부 `of-`)
- 바닥·벽면: `of-lobby-stone`(로비 석재 바닥, 광택) · `of-carpet-tile`(사무실 회청 카펫 타일, 조용하게) · `of-pantry-tile`(급탕실 비닐 타일) · `of-wall`(사무 벽면 연회색 + 걸레받이) · `of-lobby-wall`(로비 벽면 — 돌 판 + 나무 띠) · `of-glass-wall`(회의실 유리 칸막이 벽면 — 반사 줄).
- 로비(1층): `of-autodoor`(유리 자동문 문턱 flat 2×1 — 기존 `cv-autodoor` 로 되면 그것) · `of-reception`(접수 카운터 floor 1×1 이어 붙임, use counter, surface) · `of-security-gate`(보안 게이트 floor 1×1 — 사이 1칸 통로 줄) · `of-elevator`(엘리베이터 문 — 북쪽 벽면에 wall 2×1, 닫힌 스테인리스 문 + 층 표시 램프(숫자 없이 점)) · `of-elevator-button`(호출 버튼 hang) · `of-lobby-sofa`(로비 소파 floor 2×1, facing) · `of-plant-big`(큰 화분 floor 1×1) · `of-directory`(층 안내판 hang — 글자 없이 색 줄) · `of-mailbox-wall`(입주사 우편함 wall 2×1).
- 사무층: `of-desk`(사무 책상 — 모니터·키보드·서류, 섬으로 이어 붙임: 마주 보는 두 줄, floor 1×1 또는 R.table 스타일) · `of-desk-chair-n/-s/-e/-w`(사무 의자) · `of-boss-desk`(과장 책상 floor 2×1, 섬 끝에서 섬을 봄) · `of-partition`(낮은 칸막이 floor 1×1) · `of-cabinet`(철제 서류장 wall 1×2 회색) · `of-copier`(복합기 floor 1×1) · `of-whiteboard`(이동식 화이트보드 floor 2×1) · `of-meeting-table`(회의 탁자 R.table 스타일) · `of-server-rack`(서버 랙 wall 1×2, LED 점) · `of-water-server`(워터 서버 floor 1×1) · `of-coat-rack`(옷걸이 floor 1×1) · `of-clock`(벽시계 — 기존 `wall-clock` 쓰면 됨).
- 급탕실·휴게: `of-pantry-sink`(개수대+전기 포트 wall 2×1) · `of-fridge-small`(소형 냉장고 wall 1×1) · `of-vending`(자판기 wall 1×1 — 기존 `pb-vending` 이 맞으면 그것) · `of-break-table`(휴게 탁자 R.table) · `of-stool`.
- 계단: 비상계단 `of-stairs-up`(철제·콘크리트, wall — `stairs-up-wood` 규칙) · `of-stairwell-down`(2×2).
- 탁상(goods): `of-laptop` · `of-documents` · `of-mug` · `of-phone` · `of-name-card-box`.

## 맵(예제)
- `office-1f`(약 16×11, 거리와 잇는 주 맵): 남쪽 자동문 틈 2칸 → 로비(석재 바닥, 소파·큰 화분·안내판) → 접수 카운터(손님 쪽 2줄) → 보안 게이트 줄 → 북쪽 벽 엘리베이터 2대 + 비상계단 → 한쪽 우편함. 작게.
- `office-floor`(inner, 약 22×14): 엘리베이터 홀(1층 엘리베이터 앞 ↔ links) → 사무실(책상 섬 2~3개 — 섬마다 마주 보는 두 줄 + 끝에 과장 책상, 섬 사이 통로 2칸, 서류장·복합기·서버 랙·화이트보드) → 유리 칸막이 회의실(탁자 + 의자 둘레, 문) → 급탕실·휴게 코너(칸막이 + 문) → 비상계단통(1층 계단과 x 맞춤).
- 장소 표 `places3-office.json`: 한 장소 `{"file":"office-1f","maps":["office-1f","office-floor"],"kind":"office","kindKo":"사무실 빌딩","building":"jp_office","roomKinds":{"lobby":…,"elevatorhall":…,"openoffice":…,"meetingroom":…,"pantry":…}, …}`.

## 분류 (categories.py 네 칸) — 예: `office-lobby` 사무 빌딩 로비, `office` 사무실, `pantry` 급탕실·휴게.
