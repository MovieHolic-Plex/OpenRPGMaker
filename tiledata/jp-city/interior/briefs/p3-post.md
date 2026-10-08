# 작업: jp_city 일본 실내 3묶음 — 우체국·맨션 공용부 `interior_post` (id 머리 `po-`, 맨션 공용부는 `mc-`)
새 파일: `scripts/content/jp-city/blocks/interior_post.py` (`R = Registry('interior_post', '우체국·맨션 공용부')`, interior_public.py 모양 그대로). **id 머리는 `po-`(우체국)·`mc-`(맨션 공용부) 둘만.**
거리에 우체국 외관 `jp-bldg-post-office` 와 맨션 외관 `jp-bldg-mansion4`(키트 `tiledata/jp-city/kit-index.json`)가 있다. 맨션 세대 실내 예제 `mansion-2ldk.json` 은 이미 있다 — 이번에는 **공용부**(1층 엔트런스·우편함·엘리베이터 홀, 위층 외복도)다.
**도구 호출 12번 안에 첫 그림을 쓰고** 블록을 돌린다.

## 그릴 것
- 우체국 바닥·벽면: `po-floor`(연베이지 비닐 타일) · `po-wall`(흰 벽면 + 우체국 빨강 띠 — 로고·〒 기호 금지) · `po-back-floor`(작업실 회색 바닥).
- 우체국: `po-counter`(창구 카운터 floor 1×1 이어 붙임, 손님 쪽 아크릴 칸막이, use counter, surface) · `po-counter-end`(카운터 끝 여닫이 칸 — 직원 길) · `po-ticket-machine`(번호표 기계 floor 1×1) · `po-atm`(ATM wall 1×1) · `po-writing-desk`(기재대 — 서서 쓰는 높은 탁자 floor 2×1, surface, 펜 꽂이) · `po-bench`(대기 벤치 floor 2×1, use sit, facing) · `po-po-box`(사서함 벽 wall 2×1 — 작은 문 칸칸) · `po-poster`(게시 포스터 hang — 색 덩이만) · `po-sorting-shelf`(구분 선반 wall 2×1 — 칸칸 편지) · `po-mail-cart`(우편 수레 floor 1×1 — 빨강·회색 바구니) · `po-mail-bag`(우편 자루 floor 1×1) · `po-parcel-scale`(소포 저울 — 카운터 칸 또는 탁상) · `po-staff-desk`(직원 책상 floor 2×1).
- 맨션 공용부 바닥·벽면: `mc-entrance-tile`(엔트런스 큰 석재 타일) · `mc-corridor`(외복도 회색 장척 시트 + 배수 줄) · `mc-wall`(공용부 벽면 — 타일 판 + 아래 돌 띠) · `mc-corridor-wall`(외복도 쪽 세대 벽면 — 흰 벽 + 세대 사이 기둥).
- 맨션 공용부: `mc-autolock`(오토록 조작반 — 엔트런스 안쪽 문 옆 floor 1×1 기둥형, 버튼 점) · `mc-autodoor`(안쪽 유리 자동문 — 가로 칸막이 틈에 놓는 문 조각, 기존 문 규칙) · `mc-mailboxes`(집합 우편함 wall 3×1 — 칸칸 작은 문, 다이얼 점) · `mc-delivery-box`(택배 보관함 wall 2×1 — 크기 다른 칸) · `mc-notice-board`(관리 게시판 hang) · `mc-elevator`(엘리베이터 문 wall 2×1 — 사무실 것과 다르게 세대용: 갈색 문 테) · `mc-stairs-up`(계단 wall — `stairs-up-wood` 규칙) · `mc-stairwell-down`(2×2) · `mc-railing`(외복도 난간 — 남쪽 바깥 가장자리, 하늘이 보이는 콘크리트 허리벽 + 철 난간, floor 1×1 이어 붙임 막힘) · `mc-unit-door`(세대 현관문 — 외복도 북쪽 벽면, 기존 `h2-genkan-door-steel` 이 맞으면 그것 + 세대 표찰은 색 점) · `mc-meter-box`(계량기함 hang) · `mc-bike-rack`(자전거 둔 자리 floor 1×1 — 바퀴 둘).
- 탁상(goods): `po-envelope` · `po-stamp-sheet`(우표 — 그림 없이 색 칸) · `po-parcel` · `mc-flyer`.

## 맵(예제)
- `post-office`(약 14×10, 거리와 잇는 주 맵): 남쪽 출입구 틈 2칸 → 번호표 기계 · 대기 벤치 · 기재대 · ATM(입구 가까이) · 사서함 벽 → 창구 카운터 줄 3칸(손님 쪽 2줄) → 카운터 안쪽 직원 책상 → 칸막이 + 문 → 뒤 작업실(구분 선반·우편 수레·자루, 작게). 직원 길(카운터 끝 → 작업실)은 `narrow`.
- `mansion-lobby`(약 12×10, 거리와 잇는 주 맵): 남쪽 틈 2칸(바깥 자동문) → 바람막이(風除室: 오토록 조작반 · 집합 우편함 · 택배 보관함) → 안쪽 자동문(가로 칸막이 틈) → 엘리베이터 홀(엘리베이터 1대 · 계단 · 게시판 · 화분) → 한쪽 자전거 두는 곳 또는 관리인실 창.
- `mansion-corridor`(inner, 약 18×6): 위층 외복도 — 북쪽 벽면에 세대 현관문 4개(계량기함), 남쪽 가장자리 난간 줄, 복도 2줄, 한 끝 엘리베이터(로비 엘리베이터 앞 ↔ links)·다른 끝 계단통(로비 계단과 x 를 맞출 필요는 없다 — 엘리베이터 하나만 이어도 된다). 세대 문은 장식(잇지 않는다).
- 장소 표 `places3-post.json`: 두 장소 — `{"file":"post-office","kind":"postoffice","kindKo":"우체국","building":"jp_post_office",…}`, `{"file":"mansion-lobby","maps":["mansion-lobby","mansion-corridor"],"kind":"mansioncommon","kindKo":"맨션 공용부","building":"jp_mansion_common",…}` (roomKinds: postlobby·postcounter·postback·windbreak·elevatorhall·extcorridor 등).

## 분류 (categories.py 네 칸) — 예: `post` 우체국, `mansion-common` 맨션 공용부.
