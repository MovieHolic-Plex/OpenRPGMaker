# castle_kit 자체 검수 메모 (조각 46 · 오토타일 2 · 예제 2)
wz-castle-wall-n: 북벽 직선. 윗면 띠 + 앞면 석재 3단, 16px 주기로 이어짐. 양호.
wz-castle-wall-n-repair: 수선 흔적. 덧댄 블록이 약간 튐, 반복 배치는 드물게.
wz-castle-wall-n-moss: 이끼 줄눈. 녹색이 어두워 석재와 잘 섞임. 양호.
wz-castle-wall-n-window: 1칸 첨두 납살 창. 하늘색 유리, 창턱 돌출. 양호.
wz-castle-wall-n-window2: 2칸 쌍창. 창틀 두께 충분, 이음선 자연스러움.
wz-castle-wall-n-pillar: 북벽 버트레스 기둥. 벽면보다 한 단 밝은 돌출. 양호.
wz-castle-wall-n-buttress-ext: 외벽 버트레스(이끼). 외부면 전용.
wz-castle-wall-nw / -ne: 바깥 모서리. 윗면 띠가 직각으로 이어짐.
wz-castle-wall-w / -e: 서·동 벽 윗면 띠 1칸. 세로로 이어 붙임.
wz-castle-wall-s: 남쪽 낮춘 벽. 윗면 + 앞면 2단.
wz-castle-wall-sw / -se: 남쪽 모서리. 세로 띠가 앞면과 만나는 솔기 다소 얇음.
wz-castle-wall-n-end-l / -end-r: 북벽 끝마감. 통로 옆 포석 기둥.
wz-castle-wall-t-w / -t-e: T접합 칸막이. 윗면 띠 한 줄이 아래로 내려옴.
wz-castle-floor-flag(+b,c): 포석 바닥 3종. 16px 주기, 이음새 없음.
wz-castle-floor-flag-worn(+b,c): 닳은 포석 3종. 균열이 많아 단독 면적엔 다소 지저분.
wz-castle-floor-oak(+b,c): 오크 마루 3종. 판자 결 가로, 이음새 없음.
wz-castle-flag / wz-castle-oak: 오토타일(포석·오크 마루). 가장자리 그림자와 안쪽 모서리 확인함.
wz-castle-door1-closed/open/locked: 1x4 오크 문 3상태. 같은 크기·피벗, 자물쇠는 황동.
wz-castle-door2-closed/open/locked: 2x4 쌍문 3상태. 열림은 문짝이 양옆으로 접힘.
wz-castle-passage1 / passage2: 문 없는 첨두 아치 통로 1칸·2칸. 안쪽 어둠 계단.
wz-castle-door-s: 남벽 출입구(문턱). 걷기 F, 기둥 두 개로 문틀 암시.
wz-castle-stair-up: 오르는 돌계단 2x2. 디딤면이 밝고 챌면이 어두움.
wz-castle-stair-down: 내리는 계단 2x2. 어두운 단면, 오름과 구분됨.
wz-castle-floor-stair: 계단 디딤면 바닥 1칸.
wz-castle-threshold-stone-oak / -oak-stone: 석재·오크 문턱 전이 1칸.
wz-castle-rail-h / rail-v / rail-end: 돌난간 가로·세로·끝기둥.
wz-castle-sconce: 황동 벽 촛대. 불꽃 색이 약간 작음.
wz-castle-wall-s-window: 남벽 작은 창 1x2. 창이 작아 읽기 어려움.
wz-castle-example-hall: 14x10 대회랑. 북벽 창·기둥·2칸 문·촛대, 오크 단, 오른쪽 계단, 남벽 출입구.
wz-castle-example-corridor: 8x12 세로 복도. 북쪽 아치, T접합 칸막이, 남벽.

## 2026-10-07 FAIL 13건 수정
- 문·통로 8종(door1/door2 ×3, passage1/2): DOOR_YT 21→22, 개구부·문짝 실측 y=22..61 = 40px.
- wz-castle-door-s: 남벽 절단면 문설주 2px(윤곽 포함, wall-s 에서 잘라 이음새 없음) + 가운데 12px 포석 통로 + 밝은 문턱 판석(y27~29). 통행 FF.
- wz-castle-wall-t-w / -t-e: 0행 북벽 윗면(cap) 위에 wall-w/-e 와 같은 side_top(폭 16·같은 윤곽)을 y=10부터 내려 T자로 이음. 아래 -w/-e 와 이음새 없음.
- wz-castle-wall-n-repair: 교체석 2개를 단 3·4 의 줄눈 칸(x3..11 y35..40, x0..8 y42..46)에 정확히 맞춤, 둘레 새 회반죽 줄눈(K2), 정 자국 1점.
- wz-castle-floor-flag-worn-b: 금 2개(4px·2px, 밝은 하이라이트 없음) + 닳은 자리 2점. 16 주기 유지.
- wz-castle-example-corridor: T 조각을 북벽 0행에 놓고 아래 같은 열에 -w/-e 를 잇도록 배치 수정, 남벽 가운데 door-s.
