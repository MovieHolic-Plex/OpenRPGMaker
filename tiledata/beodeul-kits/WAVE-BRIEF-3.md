# 버들항 화풍 웨이브 5 — 전투 배경 · 이벤트 소품 (WAVE-BRIEF-2.md 위에 얹는다, 2026-10-08)

`WAVE-BRIEF-2.md`(반려 이유·합격선·필수 QA·파일 규칙)를 **먼저 그대로 읽고 따른다.** 이 문서는 웨이브 5 에서 달라지는 점만 적는다.
기준작: 합격한 웨이브 4 장소 폴더(`opera-stage`, `ghost-train`, `empire-city`, `veldt-coliseum`, `eastern-castle`)의 `make_*.py` 와 `compare-ref.png`.
각 장소의 그림 함수(풀·흙·돌·나무·건물·소품)는 **그 장소 폴더에서 읽기만** 하고, 네 폴더에 복사·확장해서 쓴다(공용 라이브러리·다른 장소 폴더 수정 금지).

## A. 전투 배경 (battle-bg-*)
- 장소마다 **한 장**, 정확히 **640×360 PNG**, 파일 `<너의 폴더>/<장소슬러그>.png`. 시간대·날씨는 낮·맑음 하나만(시간대 변형은 나중).
- 구도(측면 JRPG 전투, 적은 왼쪽·아군은 오른쪽 아래에 선다):
  - 위 ~45%(y 0~165) = 하늘·먼 풍경(원경 산·성·나무 줄·건물 줄). 장소의 성격이 **한눈에** 읽혀야 한다(5초 안에 「아, 사막 성 앞」).
  - 지평선 y≈165~185. 아래 ~50%(y 185~340) = **전투 바닥** — 3/4 탑뷰 느낌의 바닥 질감(그 장소 바닥 그림 함수 재사용). 키 큰 물체·글자·밝은 점을 가운데 아래(x 120~560, y 190~330)에 두지 않는다 — 배틀러 스프라이트가 서는 자리다. 물체는 양쪽 가장자리·뒤쪽에만.
  - 맨 아래 20px 는 화면 가장자리 가림(어두운 하단 HUD 가 덮는다) — 중요한 그림 금지.
- 질감·윤곽·7단 램프·채도는 버들항 7단 팔레트 그대로(위장무늬 얼룩, AI 생성풍 번짐, 그라데이션 하늘 금지 — 하늘은 단 3~5개 색 띠와 손으로 찍은 구름 덩이). 안티앨리어싱·블러 금지, 픽셀 정수 배.
- 필수 QA: ① `compare-ref.png` — 각 배경 옆에 같은 장소의 맵 렌더(`<장소>/render-1x.png` 크롭)를 나란히 놓고, 같은 게임 그림으로 보이는가 확인(최소 2회 고침). ② 배경 위에 **가짜 전투원 표식**(적 3개 왼쪽, 아군 4개 오른쪽, 각 48×48 반투명 사각)을 올린 `check-overlay.png` 를 만들어 가려지는 중요 그림이 없는지 확인. ③ 640×360 정확 크기·불투명(알파 255)·색 수 ≤ 96.
- 산출물: `<slug>.png` 들, `compare-ref.png`, `check-overlay.png`, `plan.md`(장소별 한 줄: 원경·바닥·가장자리 물체), `make_battle_bg.py`(재생성 가능).

## B. 이벤트 소품 (event-props 폴더)
- 지도에 찍는 **타일 키트**로 만든다(`parts/*.png` 규약 = 칸 16px 의 배수, 왼쪽 아래 기준, 알파 있는 PNG). 사람·글자·상표 금지.
- 움직이는 것은 `<이름>-strip.png`(가로 4프레임 한 줄, 폭 = 4 × 프레임 폭)로 만들고 `partmeta.json` 설명에 「4프레임」을 쓴다. 프레임 4장은 서로 확실히 달라야 한다(빛 맥동·불꽃·회전 등).
- **걸을 수 있는 납작 바닥 소품**(발판·마법진·바닥 스위치·바닥 룬)은 파일 이름이 `evfloor_` 로 시작해야 걸을 수 있는 소품으로 굽힌다. 그 밖의 물체는 아래쪽이 막히는 물체로 굽힌다.
- 한 키트는 최대 4×4칸. 3/4 시점(윗면+앞면), 7단 램프, 윤곽 한 겹. 버들항 기준 조각 옆에 놓고 비교(`compare-ref.png` 필수).
- 만들 것(이름 = 파일 이름 어간, 모두 `-strip` 은 4프레임):
  1. `save_crystal-strip` 저장 수정 — 1×2칸, 푸른 빛 맥동
  2. `save_crystal_off` 꺼진 저장 수정(정지) — 1×2칸
  3. `evfloor_warp_pad-strip` 이동 발판 마법진 — 2×2칸, 룬 빛 회전
  4. `evfloor_warp_pad_off` 꺼진 발판(정지) — 2×2칸
  5. `portal_gate-strip` 서 있는 차원문 — 2×3칸, 소용돌이 맥동
  6. `heal_spring-strip` 회복 샘 — 2×2칸, 물결·반짝임
  7. `chest_wood`·`chest_wood_open` 나무 보물상자 닫힘/열림 — 1×1
  8. `chest_iron`·`chest_iron_open` 철 보물상자 — 1×1
  9. `chest_gold`·`chest_gold_open` 금 보물상자 — 1×1
  10. `lever_off`·`lever_on` 돌 레버 — 1×1
  11. `evfloor_plate_off`·`evfloor_plate_on` 바닥 스위치 — 1×1
  12. `crystal_switch_blue`·`crystal_switch_red` 수정 스위치 — 1×1
  13. `door_iron_closed`·`door_iron_open` 철문 — 2×2
  14. `door_wood_closed`·`door_wood_open` 나무 문 — 2×2
  15. `door_seal_closed-strip`·`door_seal_open` 마법 봉인문 — 2×2, 봉인 문양 맥동
  16. `torch_wall-strip` 벽 횃불 — 1×1, 불꽃
  17. `brazier-strip` 화로 — 1×1, 불꽃
  18. `campfire-strip` 모닥불 — 1×1, 불꽃
  19. `signal_post_red`·`signal_post_green` 열차 신호기 — 1×2
  20. `landing_pad` 비행선 착륙장 — 3×3(정지), 외곽 표시등
  21. `landing_pad_lights-strip` 착륙장 표시등 점멸 — 3×3
  22. `sign_post`·`notice_board`·`inn_sign`·`shop_sign` 표지판류 — 1×1~2×2(글자 없이 그림 기호만: 침대·약병·검·말)
  23. `statue_guard` 수호 석상 — 1×2
  24. `block_push` 밀 수 있는 돌덩이 — 1×1
- 출력: `render-1x.png`(소품을 한 장에 정리한 카탈로그 시트 + 작은 방에 놓은 예시 장면 둘: 던전 입구 방, 마을 광장), `parts/`, `partmeta.json`, `parts.md`, `grid.json`, `plan.md`, `compare-ref.png`.
