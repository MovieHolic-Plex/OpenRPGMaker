# 작업: 5묶음 — 게임 센터·파친코 `interior_amuse` (id 머리 `am-`)
새 파일 `scripts/content/jp-city/blocks/interior_amuse.py` (`R = Registry('interior_amuse', '오락실')`).
## 그릴 것 (`am-`)
- 바닥·벽면: `am-carpet`(게임 센터 어두운 카펫 — 네온 무늬 조각, 조용하게) · `am-pachinko-carpet`(파친코 붉은 카펫) · `am-wall`(검정·짙은 남색 벽면 + 네온 띠) · `am-mirror-wall`(파친코 거울 벽면).
- 게임 센터: `am-crane`(UFO 캐처 — 유리 상자 안 인형 색 덩이·집게, floor 1×1 이어 붙임, 위로 솟음) · `am-crane-big`(대형 2×1) · `am-arcade-n`(아케이드 기기 — 화면이 북쪽, 앉아서 하는 대전 기기 floor 1×1 + 의자 `am-arcade-stool`) · `am-arcade-back`(맞은편 기기 뒷면) · `am-rhythm`(리듬 게임 — 북·패드, floor 1×1) · `am-racing`(레이싱 좌석 기기 floor 1×2) · `am-medal-pusher`(메달 푸셔 큰 기기 floor 2×2, 둘레에 자리) · `am-photo-booth`(스티커 사진 부스 — 커튼 박스, floor 2×2, 사람 금지) · `am-exchange`(메달·동전 교환기 wall 1×1) · `am-prize-shelf`(경품 선반 wall 2×1) · `am-neon-sign`(네온 장식 hang — 글자 없이 별·번개 모양).
- 파친코: `am-pachinko-n`(파친코 기기 — 세로 판, 은구슬 받침 접시, 벽처럼 줄 세움, floor 1×1 이어 붙임 막힘 + 앞 `am-pachinko-stool` 의자) · `am-pachinko-island-end`(섬 끝 판) · `am-ball-box`(구슬 상자 더미 floor 1×1) · `am-counter`(경품 카운터 floor 1×1, use counter, surface) · `am-ashtray-stand`(재떨이 기둥 — 흡연석).
- 탁상: `am-medal-cup` · `am-plush`(인형 — 동물 아닌 둥근 덩이 캐릭터 금지, 색 공 모양) · `am-prize-box`.
## 장소 (places5-amuse.json, 둘)
- 「게임 센터」 `game-center`(약 18×12): 입구 틈 2~3칸 → UFO 캐처 줄(입구 쪽, 손님 통로 2칸) → 안쪽 아케이드 대전 기기 줄(마주 보는 두 줄)·리듬 게임·레이싱 → 메달 코너(푸셔 둘레)·교환기·스티커 사진 부스 → 직원 카운터. building `jp_game_center`.
- 「파친코」 `pachinko`(약 18×12): 입구 → 경품 카운터·구슬 교환 → 파친코 섬 줄 2~3개(기기 줄 양면 + 의자, 섬 사이 통로 2칸) → 흡연실(칸막이+문). building `jp_pachinko`.
## 분류: `amusement` 게임 센터, `pachinko` 파친코.
