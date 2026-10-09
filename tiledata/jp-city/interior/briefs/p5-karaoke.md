# 작업: 5묶음 — 노래방·만화 카페 `interior_karaoke` (id 머리 `kr-`)
새 파일 `scripts/content/jp-city/blocks/interior_karaoke.py` (`R = Registry('interior_karaoke', '노래방·만화 카페')`).
## 그릴 것 (`kr-`)
- 바닥·벽면: `kr-corridor`(노래방 복도 — 짙은 카펫 + 바닥 유도등 점) · `kr-room-floor`(방 바닥 — 무늬 카펫) · `kr-wall`(방음 벽면 — 짙은 보라·검정 + 무늬) · `kr-cafe-floor`(만화 카페 회색 카펫) · `kr-cafe-wall`.
- 노래방: `kr-front`(프런트 카운터 floor 1×1 이어 붙임, use counter, surface) · `kr-drink-bar`(드링크 바 wall 2×1 — 디스펜서·컵) · `kr-room-door`(방 문 — 작은 유리창 있는 문, 가로 칸막이 틈) · `kr-sofa-l`(ㄷ자 소파 — 벽 따라 이어지는 소파 조각 n/e/w·모서리, floor 1×1) · `kr-table`(낮은 탁자 — R.table 어떤 w×h, 윗면에 메뉴판·리모컨) · `kr-screen`(대형 화면 hang 2~3칸 — 빛 번짐·색 막대, 글자·사람 금지) · `kr-speaker`(스피커 wall 1×1) · `kr-mic-stand`(마이크 스탠드 floor 1×1) · `kr-tambourine`(탁상) · `kr-mirror-ball`(미러볼 hang).
- 만화 카페: `kr-manga-shelf`(만화책 서가 — 얇은 등 색 줄 빽빽이, wall 2×1 / 양면 floor 2×1) · `kr-booth`(개인 부스 — 칸막이 + 의자 + 모니터 책상, floor 1×2 이어 붙임, 칸막이 높이로 위로 솟음, 안쪽 문 칸) · `kr-reclining-seat`(리클라이닝 의자) · `kr-pc-desk`(PC 책상 floor 1×1) · `kr-shower-door`(샤워실 문) · `kr-ice-cream`(소프트아이스크림 기계 wall 1×1).
- 탁상: `kr-menu` · `kr-remote` · `kr-glass` · `kr-manga-stack`.
## 장소 (places5-karaoke.json, 둘)
- 「노래방」 `karaoke`(약 18×13): 입구 → 프런트(손님 쪽 2줄)·드링크 바 → 동서 복도(2칸) → 복도 북쪽·남쪽에 방 4~5개(크기 다르게: 2인실 작게·파티룸 크게, 방마다 ㄷ자 소파+탁자+화면+스피커, 문). building `jp_karaoke`.
- 「만화 카페」 `manga-cafe`(약 16×12): 입구 → 접수 → 만화 서가 줄(서가 사이 통로) → 개인 부스 줄(부스 문이 통로를 봄) → 드링크 바·아이스크림·샤워실. building `jp_manga_cafe`.
## 분류: `karaoke` 노래방, `mangacafe` 만화 카페.
