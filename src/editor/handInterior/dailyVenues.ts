// 학생 하루 · 직장인 하루 실내 견본 - 2026-10-18 사용자 「대형마트는 시발 너무작다… 가령 대형마트는 50x50 정도로」 「의자가 아래 방향만 구현되어있는거냐」.
// 통학 전동차 차내는 여기서 짓지 않는다 - jp_city 손 도트 견본(program "train-car")을 그대로 쓴다(2026-10-19 「전철은 기존에 만들던 게 있는데 그걸 그대로 쓰면 되는데」).
// 방 크기는 venueScale.ts VENUE_SCALE_CONTRACT 와 맞물린다 - 위 줄·아래 줄 방 너비 합 + 칸막이 + 바깥벽 = 규격 너비, 줄 높이 합 + 칸막이 + 바깥벽 = 규격 높이.
// 탁자 둘레 의자는 seatedTable 로 네 방향(북쪽 -s · 남쪽 -n · 서쪽 -e · 동쪽 -w) 모두 탁자를 본다.
// 칸막이 문은 겹친 열(가로 칸막이)·겹친 줄(세로 칸막이)의 가운데에 뚫린다 - 그 자리 앞 칸은 비워 둔다.
import type { InteriorRoomTemplate } from "./templates";
import type { ModernProgramVariation } from "./modernPresets";
import { g, o, row, seatedTable, t, type Venue } from "./venueKit";

const BASE_VENUES: readonly Venue[] = [
  // ── 학생 1. 07:00 2층 가정집 1층 (26×20, 비사각형 계단식 외곽) - 위 줄 북서 중정 후퇴(void:2) + 침실·아이 방·욕실·계단실,
  //    아래 줄 거실(h:7)·부엌(h:6)·현관(h:8) 계단형 남쪽 외곽. 모든 방이 거실·부엌·계단 홀과 직접 이어져 침실·욕실을 통과하지 않는다.
  { program: "mc_house", map: "family-house", variation: { plainDoorways: true,
    rows: [["void:2", "house-bedroom", "house-kidroom", "house-bath", "house-stairhall"], ["house-living", "house-kitchen", "house-genkan"]], ragged: true,
    entrance: "house-genkan", hubs: ["house-living", "house-kitchen", "house-genkan", "house-stairhall"],
    above: [["house-stairhall", "house-genkan"], ["house-bedroom", "house-living"], ["house-kidroom", "house-living"], ["house-bath", "house-kitchen"]],
    left: [["house-bedroom", "house-kidroom"], ["house-kidroom", "house-bath"], ["house-bath", "house-stairhall"], ["house-living", "house-kitchen"], ["house-kitchen", "house-genkan"]],
    palettes: [
      { "house-bedroom": ["mci-carpet-office", "mci-wall-home"], "house-kidroom": ["mci-wood-dark", "mci-wall-office"], "house-living": ["mci-wood-dark", "mci-wall-brick"], "house-kitchen": ["mci-tile-small", "mci-wall-tile"] },
      { "house-bedroom": ["mci-wood-dark", "mci-wall-brick"], "house-kidroom": ["mci-carpet-office", "mci-wall-home"], "house-living": ["mci-stone-lobby", "mci-wall-lobby"], "house-kitchen": ["mci-wood-oak", "mci-wall-home"] },
    ] }, rooms: [
    { kind: "house-bedroom", w: 6, h: 9, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("mci-window-curtain", 0, 0), o("home-wall-ac", 2, 0), o("mci-wall-clock", 4, 0),
      o("mci-wardrobe", 0, 2), o("mci-bed-double", 2, 2), o("mci-bedside", 4, 2), o("home-floor-lamp", 5, 2),
      o("home-laundry-basket", 0, 5), o("mci-rug", 1, 5),
      o("mci-chair-office-s", 4, 6), o("mci-desk-pc-back", 4, 7), g("mci-g-books", 5, 7),
      o("home-cat-bed", 0, 8),
    ] },
    { kind: "house-kidroom", w: 5, h: 9, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("mci-window-blind", 0, 0), o("mci-art-frame", 3, 0),
      o("mci-bed-single", 0, 2), o("home-low-shelf", 1, 2), o("mci-wardrobe", 3, 2),
      o("home-school-bag", 0, 5), o("home-electric-fan", 4, 4),
      o("mci-chair-office-s", 3, 6), o("mci-desk-pc-back", 3, 7), g("mci-g-laptop", 3, 7),
      o("home-floor-lamp", 0, 8),
    ] },
    { kind: "house-bath", w: 5, h: 9, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-window-blind", 2, 0),
      o("home-vanity-sink", 0, 2), o("home-washing-machine", 3, 2), o("mci-toilet", 4, 2),
      o("home-ofuro", 0, 6), o("home-bath-stool", 2, 7),
      o("home-laundry-basket", 4, 8),
    ] },
    { kind: "house-stairhall", w: 3, h: 9, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      // 2층으로 오르는 나무 계단(3×3) - 북벽 문틀 속으로 디딤판·챌판이 올라가고 양옆 난간·엄지기둥이 선다.
      o("stairs-up-wall-wood", 0, 2),
      o("home-monstera", 2, 8),
    ] },
    { kind: "house-living", w: 10, h: 7, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("mci-window-curtain", 0, 0), o("mci-wall-clock", 2, 0), o("home-wall-ac", 7, 0),
      o("home-low-shelf", 0, 2), o("mci-tv-stand", 7, 2), o("home-monstera", 9, 2),
      // 서쪽 코타츠(안락의자·방석)는 TV 를 보고, 동쪽 킬림 러그 위 ㄱ자 소파·원형 탁자 세트가 거실의 중심.
      o("mci-armchair-e", 1, 4), o("home-kotatsu", 2, 4), o("home-zabuton", 2, 6), o("jumbo-home-sectional", 5, 4),
      o("home-electric-fan", 0, 6), o("home-cat-bed", 9, 6),
    ] },
    { kind: "house-kitchen", w: 8, h: 6, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-window-blind", 0, 0), o("mci-wall-clock", 5, 0),
      o("home-sink-counter", 0, 2), o("mci-kitchen", 2, 2), o("mci-fridge", 6, 2), o("home-appliance-rack", 7, 2),
      // 차려진 식탁 - 서쪽 의자 동향, 동쪽 의자 서향.
      o("mci-chair-wood-e", 2, 4), o("home-dining-set", 3, 4), o("mci-chair-wood-w", 5, 4),
      o("mci-chair-wood-e", 2, 5), o("mci-chair-wood-w", 5, 5),
    ] },
    { kind: "house-genkan", w: 4, h: 8, floor: "mci-stone-lobby", wall: "mci-wall-home", items: [
      o("home-shoe-cabinet", 0, 2), o("home-umbrella-stand", 3, 2),
      o("mci-tactile", 1, 6), o("mci-tactile", 2, 6),
      o("home-genkan-shoes", 0, 7), o("mci-plant-tall", 3, 7),
    ] },
  ] },

  // ── 학생 2. 07:50 통학길 편의점 (22×16, ㄱ자 계단형 외곽) - 매장(15×14) + 후방 창고(4×10, 남동쪽 4칸 후퇴).
  //    서쪽 창가 취식 바 카운터 + 스툴 3석, 출입문 점자 매트, 계산대 + 오뎅·핫스낵 쇼케이스 완비.
  { program: "mc_konbini_jp", map: "konbini-24h", variation: {
    rows: [["konbini-floor", "konbini-backroom"]], ragged: true,
    entrance: "konbini-floor", left: [["konbini-floor", "konbini-backroom"]], hubs: ["konbini-floor"], palettes: [
      { "konbini-floor": ["mci-tile-small", "mci-wall-tile"], "konbini-backroom": ["mci-concrete", "mci-wall-metal"] },
      { "konbini-floor": ["mci-vinyl-hospital", "mci-wall-office"], "konbini-backroom": ["mci-wood-oak", "mci-wall-brick"] },
    ] }, rooms: [
    { kind: "konbini-floor", w: 15, h: 14, floor: "mci-vinyl-store", wall: "mci-wall-store", items: [
      o("mci-ac-wall", 0, 0), o("mci-menu-board", 4, 0), o("mart-sale-banner", 7, 0), o("mci-window-city", 11, 0),
      o("mart-drink-open", 0, 2), o("mart-dairy-open", 2, 2), o("mart-liquor-fridge", 4, 2), o("konbini-bento", 6, 2),
      o("mart-bread-rack", 9, 2), o("konbini-magazine-rack", 11, 2), o("konbini-copier", 13, 2), o("konbini-atm", 14, 2),
      // 색깔별 곤돌라 두 열(과자·라면 / 차·생활용품) + 특가 엔드캡, 동쪽 핫푸드 아일랜드(오뎅·찐빵·가라아게)와 통조림·생수 곤돌라.
      o("mart-gondola-snack", 1, 5), o("mart-gondola-ramen", 3, 5), o("mart-sale-endcap", 5, 5),
      o("jumbo-konbini-hot-food-island", 8, 4), o("mart-freezer-icecream", 12, 5),
      o("mart-gondola-tea", 1, 8), o("mart-gondola-household", 3, 8), o("mart-promo-endcap", 5, 8),
      o("mart-gondola-cans", 8, 8), o("mart-gondola-water", 10, 8),
      // 서쪽 창가 취식 바 카운터(3석) + 동쪽 오뎅·핫스낵 계산대 줄.
      t("mci-t-counter", 0, 11, 3, 1), ...row("mci-bar-stool", 0, 1, 3, 12), g("mci-g-coffee", 1, 11),
      o("konbini-oden", 8, 11), o("konbini-hot-snack", 9, 11), o("konbini-counter", 10, 11), g("mci-g-register", 11, 11),
      o("mart-basket-stacker", 4, 13), o("subway-trash-bins", 5, 13),
      o("mci-tactile", 7, 13), o("mci-tactile", 8, 13), o("mci-plant-tall", 14, 13),
    ] },
    { kind: "konbini-backroom", w: 4, h: 10, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-wall-clock", 1, 0),
      o("mci-rack", 0, 2),
      o("mart-rice-pallet", 2, 5),
      o("mci-chair-office-s", 0, 8), o("mci-desk-pc-back", 0, 9), o("mci-pallet", 3, 9),
    ] },
  ] },

  // ── 학생 3. 08:10 지하철역 (46×32, 凸자형 계단식 외곽) - 북쪽 광폭 승강장(44×13), 남쪽 역무실(7×13)·중앙 대합실(28×16 돌출)·역내 매점(7×13).
  { program: "mc_station", map: "subway-station", aliases: ["concourse"], variation: {
    rows: [["subway-platform"], ["subway-office", "subway-concourse", "subway-kiosk"]], ragged: true,
    entrance: "subway-concourse",
    above: [["subway-platform", "subway-concourse"], ["subway-platform", "subway-office"], ["subway-platform", "subway-kiosk"]],
    left: [["subway-office", "subway-concourse"], ["subway-concourse", "subway-kiosk"]],
    hubs: ["subway-concourse", "subway-platform"], fixed: ["subway-platform", "subway-concourse"], palettes: [
      { "subway-concourse": ["mci-stone-lobby", "mci-wall-lobby"], "subway-kiosk": ["mci-tile-small", "mci-wall-tile"], "subway-office": ["mci-carpet-office", "mci-wall-office"], "subway-platform": ["mci-concrete", "mci-wall-metal"] },
      { "subway-concourse": ["mci-concrete", "mci-wall-tile"], "subway-kiosk": ["mci-wood-oak", "mci-wall-home"], "subway-office": ["mci-vinyl-store", "mci-wall-store"], "subway-platform": ["mci-tile-concourse", "mci-wall-brick"] },
    ] }, rooms: [
    { kind: "subway-platform", w: 44, h: 13, floor: "mci-tile-concourse", wall: "mci-wall-tile", items: [
      o("mci-route-map", 2, 0), o("train-led", 8, 0), o("station-name-sign", 13, 0), o("mci-tv-wall", 16, 0), o("mci-wall-clock", 21, 0), o("station-timetable", 23, 0),
      o("mci-route-map", 24, 0), o("mci-tv-wall", 28, 0), o("station-name-sign", 31, 0), o("train-led", 34, 0), o("mci-route-map", 40, 0),
      // 선로(벽에서 벽까지) + 스크린도어 줄(문·벽 번갈아) + 문 앞 점자 블록.
      ...row("subway-track-pit", 0, 4, 11, 2),
      ...Array.from({ length: 22 }, (_, i) => o(i % 2 ? "subway-psd-door" : "subway-psd-wall", i * 2, 4)),
      ...Array.from({ length: 11 }, (_, i) => o("mci-tactile", i * 4 + 2, 5)), ...Array.from({ length: 11 }, (_, i) => o("mci-tactile", i * 4 + 3, 5)),
      // 점자 블록 사이 승강장 끝 노란 안전선
      ...Array.from({ length: 11 }, (_, i) => o("station-platform-edge", i * 4, 5)),
      o("subway-pillar-sign", 5, 8), o("mci-bench-metal", 7, 8), o("subway-trash-bins", 11, 8), o("subway-pillar-sign", 15, 8), o("mci-bench-metal", 17, 8),
      o("subway-pillar-sign", 27, 8), o("mci-bench-metal", 29, 8), o("subway-trash-bins", 33, 8), o("subway-pillar-sign", 37, 8), o("mci-bench-metal", 39, 8),
      o("mci-plant-tall", 0, 12), o("mci-plant-tall", 43, 12),
    ] },
    { kind: "subway-office", w: 7, h: 13, floor: "mci-carpet-office", wall: "mci-wall-office", items: [
      o("mci-whiteboard", 1, 0), o("mci-wall-clock", 5, 0),
      o("mci-filing", 0, 2), o("mci-shelf-office", 4, 2),
      // 마주 보는 역무 데스크 - 북쪽 의자 남향(-s), 남쪽 의자 북향(-n)으로 모두 책상을 마주 본다.
      o("mci-chair-office-s", 1, 5), o("mci-desk-pc-back", 1, 6), o("mci-chair-office-s", 4, 5), o("mci-desk-pc-back", 4, 6),
      o("mci-desk-pc", 1, 9), o("mci-chair-office-n", 1, 10), o("mci-desk-pc", 4, 9), o("mci-chair-office-n", 4, 10),
      o("mci-plant-tall", 0, 12), o("office-whiteboard-stand", 4, 12),
    ] },
    { kind: "subway-concourse", w: 28, h: 16, floor: "mci-tile-concourse", wall: "mci-wall-tile", items: [
      o("mci-route-map", 1, 0), o("mci-notice-board", 5, 0), o("mci-wall-clock", 8, 0), o("mci-tv-wall", 18, 0), o("mci-route-map", 23, 0),
      o("subway-ticket-machine", 0, 2), o("subway-ticket-machine", 2, 2), o("subway-ticket-machine", 4, 2), o("dept-directory-kiosk", 6, 2), o("station-ic-charger", 7, 2),
      // 개찰구 바깥 북벽 매표소 부스(역무원 창구 3 + 요금표 + 양 끝 발매기) - 개찰구 줄(y=6) 앞 y=5 는 통로로 비운다.
      o("jumbo-station-ticket-office", 10, 2),
      o("subway-vending-machine", 20, 2), o("subway-vending-machine", 22, 2), o("station-coin-lockers", 24, 2), o("mci-plant-tall", 27, 2),
      // 개찰구 차단선 - 벽에서 벽까지 끊김 없이(개찰구 여섯 + 역무원 창구 + 화분·차단줄).
      o("museum-velvet-rope", 0, 6), o("mci-ticket-gate", 3, 6), o("mci-ticket-gate", 6, 6), o("mci-ticket-gate", 9, 6),
      o("mci-ticket-gate", 12, 6), o("mci-ticket-gate", 15, 6), o("mci-ticket-gate", 18, 6), o("mci-teller", 21, 6), o("mci-planter", 24, 6), o("mci-plant-tall", 26, 6), o("mci-plant-tall", 27, 6),
      ...Array.from({ length: 8 }, (_, i) => o("mci-tactile", 13, 7 + i)),
      o("subway-pillar-sign", 4, 10), o("mci-bench-metal", 6, 10), o("subway-pillar-sign", 22, 10), o("mci-bench-metal", 19, 10),
      // 대합실 서쪽 쉼터 - 올리브나무를 두른 원형 벤치.
      o("jumbo-lobby-tree-bench", 9, 11),
      o("mci-wait-bench", 2, 13), o("subway-trash-bins", 8, 14), o("subway-trash-bins", 18, 14), o("mci-wait-bench", 22, 13),
    ] },
    { kind: "subway-kiosk", w: 7, h: 13, floor: "mci-vinyl-store", wall: "mci-wall-store", items: [
      o("mci-menu-board", 1, 0), o("mci-menu-board", 4, 0),
      o("mart-drink-open", 0, 2), o("mart-dairy-open", 2, 2), o("mci-coffee-station", 5, 2),
      o("mart-gondola-snack", 1, 5), o("konbini-hot-snack", 4, 5), o("mart-gondola-tea", 1, 8), o("mart-gondola-cans", 4, 8),
      o("mci-counter-register", 2, 10), g("mci-g-register", 3, 10),
      o("mci-basket-stack", 0, 12), o("mci-plant-tall", 6, 12),
    ] },
  ] },

  // ── 학생 5. 09:00 학교 교사동 (46×34, 비사각형 계단식 윙 외곽) - 위 줄 북서 후퇴(void:2)·교실 둘·계단실, 가운데 복도,
  //    아래 줄 현관(12×12)·교무실(12×12)·보건실(9×10)·매점(8×10). 교탁 의자는 남향(-s), 학생 책상은 상판이 선명한 lecture-desk-row + 북향 의자.
  { program: "mc_school_building", map: "school-building", variation: {
    rows: [["void:2", "school-class", "school-class-2", "school-stairwell"], ["school-corridor"], ["school-genkan", "school-staffroom", "school-infirmary", "school-store"]], ragged: true,
    entrance: "school-genkan", hubs: ["school-corridor", "school-genkan"],
    above: [["school-class", "school-corridor"], ["school-class-2", "school-corridor"], ["school-stairwell", "school-corridor"], ["school-corridor", "school-genkan"], ["school-corridor", "school-staffroom"], ["school-corridor", "school-infirmary"], ["school-corridor", "school-store"]],
    left: [["school-class", "school-class-2"], ["school-class-2", "school-stairwell"], ["school-genkan", "school-staffroom"], ["school-staffroom", "school-infirmary"], ["school-infirmary", "school-store"]],
    fixed: ["school-corridor"], palettes: [
      { "school-class": ["mci-wood-dark", "mci-wall-home"], "school-class-2": ["mci-wood-dark", "mci-wall-home"], "school-corridor": ["mci-tile-concourse", "mci-wall-lobby"], "school-staffroom": ["mci-wood-oak", "mci-wall-office"] },
      { "school-class": ["mci-vinyl-store", "mci-wall-lobby"], "school-class-2": ["mci-vinyl-store", "mci-wall-lobby"], "school-corridor": ["mci-stone-lobby", "mci-wall-office"], "school-staffroom": ["mci-carpet-office", "mci-wall-home"] },
    ] }, rooms: [
    ...(["school-class", "school-class-2"] as const).map((kind, k) => ({ kind, w: 16, h: 13, floor: "mci-wood-oak", wall: "mci-wall-office", items: [
      // 북벽 파노라마 칠판 + 강단(교탁 포함) - 담임 책상은 강단 동쪽.
      o("mci-window-curtain", 0, 0), o("mci-wall-clock", 11, 0), o("mci-window-curtain", 13, 0),
      o("mci-shelf-office", 0, 2), o("school-cleaning-locker", 2, 2), o("jumbo-school-stage-board", 5, 2), o("mci-chair-office-s", 12, 2), o(k ? "mci-plant-tall" : "council-trophy-case", 14, 2),
      o("mci-desk-pc-back", 12, 3), g("mci-g-books", 13, 3),
      o("home-school-bag", 0, 6), o("home-school-bag", 15, 9),
      // 앞·가운데 줄 3분단(x=1,6,11) + 뒷줄 좌우 분단(x=1,11 - 중앙 x=7..8 문 앞 통로 확보).
      ...[5, 8].flatMap((y) => [1, 6, 11].flatMap((x) => [o("lecture-desk-row", x, y), ...row("mci-chair-wood-n", x, 1, 4, y + 1)])),
      ...[1, 11].flatMap((x) => [o("lecture-desk-row", x, 11), ...row("mci-chair-wood-n", x, 1, 4, 12)]),
    ] })),
    { kind: "school-stairwell", w: 8, h: 13, floor: "mci-tile-concourse", wall: "mci-wall-lobby", items: [
      o("mci-notice-board", 1, 0), o("mci-art-frame", 5, 0),
      o("council-trophy-case", 0, 2), o("stairs-up-wall-stone", 2, 2), o("subway-vending-machine", 6, 2),
      o("mci-wait-bench", 1, 6), o("mci-bench-metal", 5, 9),
      o("mci-plant-tall", 0, 12), o("mci-plant-tall", 7, 12),
    ] },
    { kind: "school-corridor", w: 44, h: 5, floor: "mci-tile-concourse", wall: "mci-wall-lobby", items: [
      o("mci-notice-board", 3, 0), o("mci-window-city", 17, 0), o("mci-notice-board", 25, 0), o("mci-wall-clock", 30, 0), o("mci-window-city", 39, 0),
      o("mci-plant-tall", 0, 2), o("school-cleaning-locker", 1, 2), o("hospital-water-dispenser", 16, 2), o("hospital-water-dispenser", 32, 2), o("mci-plant-tall", 43, 2),
    ] },
    { kind: "school-genkan", w: 12, h: 12, floor: "mci-stone-lobby", wall: "mci-wall-lobby", items: [
      o("mci-notice-board", 1, 0), o("mci-wall-clock", 10, 0),
      o("sento-shoe-locker", 0, 2), o("sento-shoe-locker", 10, 2),
      // 바닥 신발 갈아신는 벤치·실내화 매트·점자 유도선·안내 키오스크·우산꽂이.
      o("mci-bench-metal", 1, 5), o("mci-bench-metal", 9, 5),
      o("mci-tactile", 5, 5), o("mci-tactile", 6, 5), o("mci-tactile", 5, 8), o("mci-tactile", 6, 8),
      o("mci-bench-metal", 1, 8), o("mci-bench-metal", 9, 8),
      o("home-umbrella-stand", 0, 10), o("dept-directory-kiosk", 11, 10),
      o("mci-plant-tall", 0, 11), o("home-genkan-shoes", 2, 11), o("home-genkan-shoes", 8, 11), o("mci-plant-tall", 11, 11),
    ] },
    { kind: "school-staffroom", w: 12, h: 12, floor: "mci-wood-oak", wall: "mci-wall-office", items: [
      o("mci-whiteboard", 1, 0), o("mci-wall-clock", 8, 0), o("mci-window-blind", 10, 0),
      o("mci-filing", 0, 2), o("mci-shelf-office", 2, 2), o("office-copier", 5, 2), o("mci-coffee-station", 8, 2), o("mci-plant-tall", 11, 2),
      // 마주 보는 교사 책상 - 북쪽 의자는 남향, 남쪽 의자는 북향.
      ...[1, 4, 8].flatMap((x) => [o("mci-chair-office-s", x, 5), o("mci-desk-pc-back", x, 6), o("mci-desk-pc", x, 7), o("mci-chair-office-n", x, 8)]),
      o("mci-wait-bench", 0, 11), o("office-whiteboard-stand", 5, 10), o("mci-plant-tall", 11, 11),
    ] },
    { kind: "school-infirmary", w: 9, h: 10, floor: "mci-vinyl-hospital", wall: "mci-wall-hospital", items: [
      o("mci-window-curtain", 1, 0), o("infirmary-eye-chart", 6, 0),
      o("hospital-med-cabinet", 0, 2), o("mci-washbasin", 2, 2), o("hospital-water-dispenser", 7, 2),
      o("mci-hosp-bed", 0, 5), o("hospital-curtain-screen", 1, 5), o("mci-hosp-bed", 2, 5),
      o("mci-chair-office-s", 6, 4), o("hospital-doctor-desk", 6, 5),
      o("mci-med-cart", 0, 9), o("infirmary-scale", 8, 9),
    ] },
    { kind: "school-store", w: 8, h: 10, floor: "mci-vinyl-store", wall: "mci-wall-store", items: [
      o("mci-menu-board", 1, 0), o("mci-menu-board", 5, 0),
      o("mart-drink-open", 0, 2), o("konbini-bento", 5, 2),
      o("mart-gondola-snack", 0, 5), o("mart-candy-bins", 3, 5), o("mart-gondola-ramen", 6, 5),
      o("konbini-counter", 0, 8), o("mci-counter-register", 4, 8), g("mci-g-register", 5, 8),
      o("mci-basket-stack", 7, 9),
    ] },
  ] },

  // ── 학생 6. 13:00 대학 강의동 (42×30, 계단형 외곽) - 계단식 대강의실(26×16)·과학 실험실(13×16), 아래 줄 로비(26×11)·실험 준비실(13×9 후퇴).
  { program: "mc_lecture_hall", map: "uni-lecture-hall", variation: {
    rows: [["uni-lecture", "sci-lab"], ["uni-foyer", "lab-prep"]], ragged: true,
    entrance: "uni-foyer", hubs: ["uni-foyer", "uni-lecture", "lab-prep"],
    above: [["uni-lecture", "uni-foyer"], ["sci-lab", "lab-prep"]], left: [["uni-lecture", "sci-lab"], ["uni-foyer", "lab-prep"]],
    palettes: [
      { "uni-lecture": ["mci-wood-oak", "mci-wall-home"], "uni-foyer": ["mci-tile-concourse", "mci-wall-lobby"], "sci-lab": ["mci-vinyl-hospital", "mci-wall-office"] },
      { "uni-lecture": ["mci-wood-dark", "mci-wall-brick"], "uni-foyer": ["mci-stone-lobby", "mci-wall-office"], "sci-lab": ["mci-tile-small", "mci-wall-tile"] },
    ] }, rooms: [
    { kind: "uni-lecture", w: 26, h: 16, floor: "mci-carpet-office", wall: "mci-wall-office", items: [
      o("mci-window-curtain", 1, 0), o("mci-whiteboard", 6, 0), o("projector-screen", 11, 0), o("mci-whiteboard", 17, 0), o("mci-wall-clock", 21, 0), o("mci-window-curtain", 23, 0),
      o("mci-plant-tall", 0, 2), o("mci-filing", 2, 2), o("mci-chair-office-s", 14, 2), o("mci-shelf-office", 21, 2), o("mci-plant-tall", 25, 2),
      o("lecture-podium", 11, 3), o("mci-desk-pc-back", 14, 3), g("mci-g-laptop", 14, 3),
      // 계단식 객석 - 앞 두 줄(y=4,7)은 낱개 책상 줄, 뒤쪽은 두 단 계단식 연속 책상 블록(y=11..13) 넷. 가운데 x=10..14 통로·뒤 y=14..15 통로.
      ...[4, 7].flatMap((y) => [2, 6, 15, 19].flatMap((x) => [o("lecture-desk-row", x, y), ...row("mci-chair-wood-n", x, 1, 4, y + 1)])),
      ...[2, 6, 15, 19].map((x) => o("jumbo-lecture-tiered-desk", x, 11)),
    ] },
    { kind: "sci-lab", w: 13, h: 16, floor: "mci-vinyl-hospital", wall: "mci-wall-office", items: [
      o("mci-whiteboard", 1, 0), o("mci-window-blind", 5, 0), o("mci-wall-clock", 9, 0), o("mci-window-blind", 10, 0),
      o("lab-fume-hood", 0, 2), o("lab-reagent-shelf", 2, 2), o("mci-washbasin", 5, 2), o("lab-reagent-shelf", 8, 2), o("lab-fume-hood", 11, 2),
      o("lab-bench", 5, 4), o("mci-med-cart", 5, 9),
      // 실험대 4조 - 남쪽에서 실험대를 바라보는 북향 의자 열.
      ...[6, 11].flatMap((y) => [1, 9].flatMap((x) => [o("lab-bench", x, y), ...row("mci-chair-wood-n", x, 1, 3, y + 1)])),
      o("mci-plant-tall", 0, 15), o("subway-trash-bins", 11, 15),
    ] },
    { kind: "uni-foyer", w: 26, h: 11, floor: "mci-tile-concourse", wall: "mci-wall-lobby", items: [
      o("mci-notice-board", 1, 0), o("mci-notice-board", 3, 0), o("mci-art-frame", 15, 0), o("mci-wall-clock", 20, 0),
      o("subway-vending-machine", 0, 2), o("subway-vending-machine", 2, 2), o("hospital-water-dispenser", 4, 2),
      o("council-trophy-case", 17, 2), o("mci-coffee-station", 20, 2), o("mci-plant-tall", 25, 2),
      // 좌우 스터디 테이블(2×2 상판 + 4방향 의자) 및 중앙 라운지 소파 존.
      ...seatedTable("mci-t-wood", "mci-chair-wood", 3, 5, 2, 2), g("mci-g-books", 3, 5),
      o("mci-rug", 10, 5), o("lounge-sofa-cream", 10, 4), o("mci-coffee-table", 10, 6), o("mci-sofa-n", 10, 7),
      ...seatedTable("mci-t-wood", "mci-chair-wood", 20, 5, 2, 2), g("mci-g-laptop", 20, 5),
      o("mci-plant-tall", 0, 10), o("dept-directory-kiosk", 15, 9), o("subway-trash-bins", 23, 10),
    ] },
    { kind: "lab-prep", w: 13, h: 9, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-wall-clock", 6, 0),
      o("lab-reagent-shelf", 0, 2), o("mci-rack", 2, 2), o("home-laptop-desk", 5, 2), o("lab-reagent-shelf", 8, 2), o("mci-washbasin", 12, 2),
      o("lab-bench", 1, 5), o("mci-chair-wood-n", 2, 6), o("lab-bench", 7, 5), o("mci-med-cart", 11, 5),
      o("mci-pallet", 0, 8), o("mci-pallet", 12, 8),
    ] },
  ] },

  // ── 학생 7. 15:30 실내 종합 체육관 (46×34, 계단형 외곽) - 동서 양끝 마주 보는 골대·제한구역·센터 서클, 통로가 있는 북쪽 관람석,
  //    남쪽 본부석·팀 벤치, 아래 줄 남녀 라커룸(10×10)·로비(13×10)·기구 창고(8×8 후퇴).
  { program: "mc_gym", map: "gymnasium", variation: {
    rows: [["gym-court"], ["gym-locker-m", "gym-locker-w", "gym-lobby", "gym-storage"]], ragged: true,
    entrance: "gym-lobby", hubs: ["gym-court", "gym-lobby"],
    above: [["gym-court", "gym-lobby"], ["gym-court", "gym-locker-m"], ["gym-court", "gym-locker-w"]],
    left: [["gym-locker-m", "gym-locker-w"], ["gym-locker-w", "gym-lobby"], ["gym-lobby", "gym-storage"]],
    fixed: ["gym-court"], palettes: [
      { "gym-court": ["mci-wood-dark", "mci-wall-brick"], "gym-locker-m": ["mci-tile-small", "mci-wall-tile"], "gym-locker-w": ["mci-tile-small", "mci-wall-tile"], "gym-lobby": ["mci-stone-lobby", "mci-wall-lobby"] },
      { "gym-court": ["mci-wood-oak", "mci-wall-metal"], "gym-locker-m": ["mci-concrete", "mci-wall-metal"], "gym-locker-w": ["mci-vinyl-hospital", "mci-wall-office"], "gym-lobby": ["mci-tile-concourse", "mci-wall-office"] },
    ] }, rooms: [
    { kind: "gym-court", w: 44, h: 21, floor: "mci-wood-oak", wall: "mci-wall-office", items: [
      o("mci-window-city", 2, 0), o("mci-window-city", 8, 0), o("mci-window-city", 14, 0), o("gym-scoreboard", 21, 0), o("mci-window-city", 28, 0), o("mci-window-city", 34, 0), o("mci-window-city", 40, 0),
      // 관람석 6기를 2기씩 묶고 사이에 계단 통로를 띄워 모든 관람석에 닿게 배치.
      o("gym-bleacher", 4, 2), o("gym-bleacher", 8, 2),
      o("gym-bleacher", 16, 2), o("gym-bleacher", 24, 2),
      o("gym-bleacher", 32, 2), o("gym-bleacher", 36, 2),
      o("gym-hoop-e", 0, 11), o("gym-court-key-w", 2, 9),
      o("gym-center-circle", 20, 10),
      o("gym-hoop-w", 42, 11), o("gym-court-key-e", 38, 9),
      ...row("mci-bench-metal", 7, 3, 3, 17), ...row("mci-bench-metal", 31, 3, 3, 17),
      o("studio-news-desk", 18, 17), ...row("mci-chair-office-n", 18, 1, 4, 18),
      o("mci-basket-stack", 0, 19), o("mci-basket-stack", 43, 19),
    ] },
    ...(["gym-locker-m", "gym-locker-w"] as const).map((kind) => ({ kind, w: 10, h: 10, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o(kind === "gym-locker-m" ? "sento-noren-men" : "sento-noren-women", 2, 0), o("mci-wall-clock", 7, 0),
      // 북벽(y=2)에 신발장·샤워 세면대를 놓고 바닥(y=5..9)에는 벤치·체중계·빨래 바구니를 배치(dropped 0).
      o("sento-shoe-locker", 0, 2), o("sento-wash-station", 2, 2), o("sento-shoe-locker", 6, 2), o("mci-washbasin", 9, 2),
      o("mci-bench-metal", 1, 5), o("mci-bench-metal", 7, 5),
      o("mci-bench-metal", 1, 8), o("infirmary-scale", 7, 8), o("home-laundry-basket", 9, 9),
    ] })),
    { kind: "gym-lobby", w: 13, h: 10, floor: "mci-stone-lobby", wall: "mci-wall-lobby", items: [
      o("mci-notice-board", 0, 0), o("mci-art-frame", 10, 0),
      o("council-trophy-case", 0, 2), o("subway-vending-machine", 10, 2), o("hospital-water-dispenser", 12, 2),
      o("mci-reception", 1, 6), o("mci-wait-bench", 9, 6),
      o("mci-plant-tall", 0, 9), o("mci-plant-tall", 12, 9),
    ] },
    { kind: "gym-storage", w: 8, h: 8, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-rack", 0, 2), o("mci-rack", 5, 2),
      // 체조 기구 존(착지 매트·뜀틀·구름판·평균대)을 서쪽에 펼쳐 두고 동쪽에 접은 매트·공 바구니.
      o("jumbo-gym-apparatus", 1, 5), o("gym-mat", 5, 5), o("mci-basket-stack", 5, 7), o("mci-basket-stack", 6, 7),
    ] },
  ] },

  // ── 학생 8. 16:30 학생회실 & 밴드 동아리방 (36×26, 계단형 외곽) - 위 줄 북서 후퇴(void:3)·밴드 합주실(17×12)·녹음 부스(13×12),
  //    아래 줄 학생회실(20×11, ㄷ자 회의 탁자 외곽 4방향 의자 + 상판 서류/노트북)·비품실(13×9 후퇴).
  { program: "mc_council_room", map: "council-room", variation: {
    rows: [["void:3", "band-room", "band-booth"], ["council-room", "council-storage"]], ragged: true,
    entrance: "council-room", hubs: ["council-room", "band-room"],
    above: [["band-room", "council-room"], ["band-booth", "council-storage"]], left: [["band-room", "band-booth"], ["council-room", "council-storage"]],
    palettes: [
      { "council-room": ["mci-carpet-office", "mci-wall-lobby"], "band-room": ["mci-wood-dark", "mci-wall-brick"] },
      { "council-room": ["mci-wood-dark", "mci-wall-home"], "band-room": ["mci-concrete", "mci-wall-metal"] },
    ] }, rooms: [
    { kind: "band-room", w: 17, h: 12, floor: "mci-wood-oak", wall: "mci-wall-brick", items: [
      o("music-acoustic-panel", 1, 0), o("music-acoustic-panel", 5, 0), o("mci-wall-clock", 8, 0), o("music-acoustic-panel", 10, 0), o("music-acoustic-panel", 14, 0),
      o("music-amp", 0, 2), o("music-amp", 1, 2), o("mci-shelf-office", 12, 2), o("music-amp", 16, 2),
      o("music-guitar-stand", 3, 4), o("music-drum-kit", 7, 4), o("music-guitar-stand", 11, 4), o("music-guitar-stand", 13, 4),
      o("mci-rug", 6, 7), o("mci-armchair-e", 4, 8), o("mci-coffee-table", 6, 8), o("mci-armchair-w", 9, 8),
      o("mci-sofa-n", 1, 10), o("mci-sofa-n", 13, 10),
    ] },
    { kind: "band-booth", w: 13, h: 12, floor: "mci-carpet-office", wall: "mci-wall-office", items: [
      o("music-acoustic-panel", 1, 0), o("music-acoustic-panel", 5, 0), o("music-acoustic-panel", 9, 0),
      o("music-amp", 0, 2), o("mci-shelf-office", 3, 2), o("mci-filing", 6, 2), o("music-amp", 12, 2),
      o("mci-chair-office-s", 2, 5), o("mci-chair-office-s", 3, 5), o("mci-desk-pc-back", 2, 6), g("mci-g-laptop", 3, 6),
      o("mci-chair-office-s", 6, 5), o("mci-desk-pc-back", 6, 6), o("music-guitar-stand", 10, 5),
      o("mci-armchair-e", 6, 9), o("mci-coffee-table", 7, 9), o("mci-armchair-w", 10, 9),
      o("mci-plant-tall", 0, 11), o("mci-plant-tall", 12, 11),
    ] },
    { kind: "council-room", w: 20, h: 11, floor: "mci-carpet-office", wall: "mci-wall-lobby", items: [
      o("mci-whiteboard", 0, 0), o("mci-notice-board", 4, 0), o("mci-window-curtain", 14, 0), o("mci-window-curtain", 17, 0),
      o("council-trophy-case", 0, 2), o("council-trophy-case", 2, 2), o("mci-filing", 16, 2), o("mci-plant-tall", 19, 2),
      // 녹색 가죽 상감 타원 회의 탁자 - 북쪽 의자 남향, 남쪽 의자 북향, 양 끝 의장석은 탁자를 마주 본다.
      o("jumbo-council-oval-table", 7, 5),
      ...row("mci-chair-office-s", 7, 1, 5, 4), ...row("mci-chair-office-n", 7, 1, 5, 8),
      o("mci-chair-office-e", 6, 6), o("mci-chair-office-w", 12, 6),
      o("mci-plant-tall", 0, 10), o("office-whiteboard-stand", 18, 9),
    ] },
    { kind: "council-storage", w: 13, h: 9, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-wall-clock", 6, 0),
      o("mci-rack", 0, 2), o("mci-filing", 4, 2), o("mci-rack", 9, 2),
      o("mci-pallet", 1, 5), o("mci-pallet", 2, 5), o("mart-rice-pallet", 6, 5), o("mci-pallet", 10, 5),
      o("mci-basket-stack", 1, 8), o("gym-mat", 9, 7),
    ] },
  ] },

  // ── 학생 9. 17:30 학교 옥상 (36×24, 계단형 탑옥 외곽) - 2026-10-25 옥상답게: 북서쪽은 지붕 밖(void:21, 맵 배경으로 아래 동네가 보이는 자리),
  //    북동 탑옥 기계실(13×9, 계단실·고가 물탱크·냉각탑), 아래 줄 루프탑 데크(34×12, 북쪽 난간·남쪽 난간이 끊김 없이 둘러친다).
  //    옛 판은 위 줄에 마루 깐 온실 방이 붙어 옥상이 아니라 실내 로비처럼 보였다(시타마치 적대 VQA).
  { program: "mc_rooftop", map: "rooftop", variation: {
    rows: [["void:21", "roof-machine"], ["rooftop-deck"]], ragged: true,
    entrance: "rooftop-deck", hubs: ["rooftop-deck"],
    keepMaterials: ["rooftop-deck", "roof-machine"],
    above: [["roof-machine", "rooftop-deck"]],
    palettes: [
      { "rooftop-deck": ["mci-concrete", "mci-wall-metal"] },
      { "rooftop-deck": ["mci-tile-concourse", "mci-wall-metal"] },
    ] }, rooms: [
    { kind: "roof-machine", w: 13, h: 9, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-ac-wall", 1, 0), o("mci-ac-wall", 9, 0),
      o("roof-stair-hut", 0, 2), o("mci-rack", 9, 2),
      // 고가 물탱크 + 냉각탑(배관·사다리) - 탑옥 기계실의 중심 설비.
      o("jumbo-roof-water-tower", 4, 5), o("jumbo-roof-cooling-tower", 8, 5), o("mci-pallet", 12, 8),
    ] },
    { kind: "rooftop-deck", w: 34, h: 12, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      // 북쪽 난간 - 지붕 밖(동네가 내려다보이는 쪽) 벽면 앞을 끊김 없이. 동쪽은 탑옥 벽이라 난간 대신 자판기.
      ...row("roof-fence", 0, 2, 10, 2),
      o("subway-vending-machine", 23, 2), o("subway-vending-machine", 31, 2),
      // 가운데는 비운 콘크리트 데크 — 옥상은 앉아 쉬는 자리가 난간 쪽에 있고 한가운데는 트여 있다.
      // 카페 탁자·의자 줄은 «옥상 카페·광장»으로 읽혔다(시타마치 VQA r1, Argon·Sonnet). 벤치·화분만 난간 곁에.
      o("mci-bench-metal", 2, 4), o("mci-planter", 6, 4), o("mci-planter", 12, 4),
      o("mci-bench-metal", 16, 4), o("mci-planter", 21, 4),
      o("mci-bench-metal", 30, 5), o("mci-planter", 2, 9), o("mci-planter", 30, 9),
      // 남쪽 난간 - 가운데 출입구(계단) 자리만 비운다.
      ...row("roof-fence", 0, 2, 8, 11), ...row("roof-fence", 18, 2, 8, 11),
    ] },
  ] },
  // ── 학생 10. 18:30 게임센터·노래방 & 만화카페 (40×28, 계단형 외곽) - 위 줄 북서 후퇴(void:2)·인형뽑기 존·노래방·서점, 아래 줄 아케이드 홀(24×13)·만화카페(13×11 후퇴).
  { program: "mc_game_center", map: "game-center", variation: {
    rows: [["void:2", "game-crane", "karaoke-room", "book-floor"], ["game-floor", "manga-cafe"]], ragged: true,
    entrance: "game-floor", hubs: ["game-floor", "game-crane", "book-floor", "manga-cafe"],
    above: [["game-crane", "game-floor"], ["karaoke-room", "game-floor"], ["book-floor", "manga-cafe"]],
    left: [["game-crane", "karaoke-room"], ["karaoke-room", "book-floor"], ["game-floor", "manga-cafe"]],
    palettes: [
      { "game-floor": ["mci-carpet-office", "mci-wall-metal"], "game-crane": ["mci-vinyl-store", "mci-wall-store"], "manga-cafe": ["mci-wood-dark", "mci-wall-home"] },
      { "game-floor": ["mci-concrete", "mci-wall-brick"], "game-crane": ["mci-tile-small", "mci-wall-tile"], "manga-cafe": ["mci-wood-oak", "mci-wall-brick"] },
    ] }, rooms: [
    { kind: "game-crane", w: 11, h: 12, floor: "mci-vinyl-store", wall: "mci-wall-store", items: [
      o("cinema-poster", 1, 0), o("mci-wall-clock", 5, 0), o("cinema-poster", 8, 0),
      // 북벽 인형뽑기·스티커사진기 + 동전교환기, 중앙 인형뽑기 아일랜드, 남쪽 경품 교환 카운터.
      o("arcade-claw-machine", 0, 2), o("arcade-claw-machine", 2, 2), o("arcade-medal-changer", 5, 2), o("arcade-purikura", 7, 2), o("arcade-purikura", 9, 2),
      // 가운데 4인 에어하키 테이블 + 서쪽 인형뽑기 아일랜드.
      o("arcade-claw-machine", 1, 5), o("arcade-claw-machine", 3, 5), o("jumbo-arcade-airhockey", 6, 5),
      o("arcade-prize-counter", 1, 9), o("dept-directory-kiosk", 0, 11), o("mci-basket-stack", 10, 11),
    ] },
    { kind: "karaoke-room", w: 11, h: 12, floor: "mci-carpet-office", wall: "mci-wall-brick", items: [
      o("mci-art-frame", 1, 0), o("karaoke-monitor", 4, 0), o("mci-art-frame", 8, 0),
      o("music-amp", 0, 2), o("amuse-mixing-desk", 2, 2), o("music-guitar-stand", 7, 2), o("music-amp", 10, 2),
      o("mci-armchair-e", 3, 6), o("karaoke-table", 4, 6), o("mci-armchair-w", 6, 6),
      o("karaoke-sofa", 3, 8), g("mci-g-coffee", 5, 6),
      o("mci-plant-tall", 0, 11), o("mci-plant-tall", 10, 11),
    ] },
    { kind: "book-floor", w: 12, h: 12, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("mci-window-curtain", 1, 0), o("mci-art-frame", 8, 0),
      o("book-shelf", 0, 2), o("book-shelf", 2, 2), o("manga-shelf", 8, 2), o("manga-shelf", 10, 2),
      o("book-table", 1, 5), o("book-table", 8, 5), o("library-shelf", 1, 8), o("library-shelf", 8, 8),
      o("mci-counter-register", 2, 10), g("mci-g-register", 3, 10), o("mci-plant-tall", 11, 11),
    ] },
    { kind: "game-floor", w: 24, h: 13, floor: "mci-carpet-office", wall: "mci-wall-metal", items: [
      o("cinema-poster", 5, 0), o("mci-tv-wall", 8, 0), o("cinema-poster", 15, 0), o("mci-tv-wall", 22, 0),
      // 북벽 양 끝 대형 체감기 - 서쪽 댄스 리듬 스테이지, 동쪽 2인 레이싱 시뮬레이터.
      o("jumbo-arcade-dance-stage", 0, 2), o("arcade-medal-changer", 11, 2), o("subway-vending-machine", 13, 2), o("jumbo-arcade-racing-twin", 18, 2),
      // 격투·슈팅 아케이드 캐비닛 열(서쪽 y=6, y=10)과 레이싱 아케이드 캐비닛 열(동쪽 y=7, y=11)을 위아래 2칸 보행 통로가 확보되도록 정돈 배치.
      ...row("arcade-cabinet-pair", 1, 4, 3, 6), ...row("arcade-racing-cabinet", 14, 4, 3, 7),
      ...row("arcade-cabinet-pair", 1, 4, 3, 10), ...row("arcade-racing-cabinet", 14, 4, 3, 11),
      o("mci-plant-tall", 0, 12), o("mci-plant-tall", 12, 12),
    ] },
    { kind: "manga-cafe", w: 13, h: 11, floor: "mci-wood-dark", wall: "mci-wall-home", items: [
      o("mci-menu-board", 1, 0), o("mci-wall-clock", 3, 0), o("mci-menu-board", 10, 0),
      o("manga-shelf", 0, 2), o("manga-shelf", 2, 2), o("mci-coffee-station", 8, 2), o("manga-shelf", 11, 2),
      // 만화 부스 2열(4개) + 남쪽 열람 테이블(동·서 의자).
      o("manga-booth", 2, 5), o("manga-booth", 8, 5),
      o("manga-booth", 2, 8), o("manga-booth", 8, 8),
      ...seatedTable("mci-t-wood", "mci-chair-wood", 5, 9, 2, 1, { e: true, w: true }), g("mci-g-books", 5, 9),
      o("mci-plant-tall", 12, 10),
    ] },
  ] },

  // ── 직장인 1. 07:30 원룸·오피스텔 (20×16, 계단형 현관 외곽) - 위 줄 욕실·드레스룸·원룸 침실, 아래 줄 현관 엘리베이터 홀(6×5 후퇴)·키친 거실(11×6).
  //    드레스룸·욕실이 거실·침실 허브와 직접 이어져 엘리베이터 홀로 나가지 않고 실내에서 바로 이동한다.
  { program: "mc_officetel", map: "officetel", variation: {
    rows: [["otel-bath", "otel-dressing", "otel-room"], ["otel-elevator", "otel-kitchen"]], ragged: true,
    entrance: "otel-kitchen", hubs: ["otel-kitchen", "otel-room", "otel-dressing"],
    above: [["otel-bath", "otel-elevator"], ["otel-dressing", "otel-kitchen"], ["otel-room", "otel-kitchen"]],
    left: [["otel-bath", "otel-dressing"], ["otel-dressing", "otel-room"], ["otel-elevator", "otel-kitchen"]],
    palettes: [
      { "otel-room": ["mci-wood-dark", "mci-wall-brick"], "otel-kitchen": ["mci-tile-small", "mci-wall-tile"], "otel-elevator": ["mci-stone-lobby", "mci-wall-store"] },
      { "otel-room": ["mci-carpet-office", "mci-wall-office"], "otel-kitchen": ["mci-wood-oak", "mci-wall-home"], "otel-elevator": ["mci-tile-concourse", "mci-wall-lobby"] },
    ] }, rooms: [
    { kind: "otel-bath", w: 4, h: 7, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      // 북벽 세면대·변기, 남서쪽 욕조·목욕 의자로 동쪽 문 주변 동선을 여유 있게 확보.
      o("home-vanity-sink", 0, 2), o("mci-toilet", 3, 2),
      o("home-ofuro", 0, 5), o("home-bath-stool", 2, 6),
    ] },
    { kind: "otel-dressing", w: 4, h: 7, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("mci-wardrobe", 0, 2), o("home-washing-machine", 3, 2),
      o("home-laundry-basket", 0, 4), o("home-drying-rack", 0, 6), o("dept-hat-stand", 3, 6),
    ] },
    { kind: "otel-room", w: 8, h: 7, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("mci-window-curtain", 5, 0), o("mci-wall-clock", 7, 0),
      // 북서쪽 로프트 침대·책상 모듈(4×3), 중앙 러그(x=3..5, y=5..6), 동쪽 TV 스탠드·안락의자로 겹침 없이 정돈.
      o("jumbo-officetel-studio-bed-desk", 0, 2), o("mci-tv-stand", 5, 2), o("home-monstera", 7, 2),
      o("mci-rug", 3, 5), o("mci-armchair-n", 6, 5),
      o("home-floor-lamp", 0, 6), o("home-cat-bed", 1, 6),
    ] },
    { kind: "otel-elevator", w: 6, h: 5, floor: "mci-stone-lobby", wall: "mci-wall-store", items: [
      o("mci-wall-clock", 3, 0),
      o("mci-elevator", 1, 2), o("home-shoe-cabinet", 4, 2),
      o("home-umbrella-stand", 0, 4), o("home-genkan-shoes", 4, 4),
    ] },
    { kind: "otel-kitchen", w: 11, h: 6, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-window-blind", 0, 0), o("mci-wall-clock", 2, 0),
      o("home-sink-counter", 0, 2), o("mci-kitchen", 2, 2), o("home-appliance-rack", 9, 2), o("mci-fridge", 10, 2),
      o("mci-chair-wood-e", 0, 4), o("home-dining-set", 1, 4), o("mci-chair-wood-w", 3, 4),
      o("mci-coffee-table", 6, 4), o("mci-sofa-n", 6, 5), o("home-electric-fan", 10, 5),
    ] },
  ] },

  // ── 직장인 2. 08:30 베이커리 카페 (24×18, 계단형 외곽) - 위 줄 북서 후퇴(void:2)·제빵실(9×7)·에스프레소 바(10×7), 아래 줄 카페 좌석 홀(22×8).
  //    에스프레소 바와 카페 홀을 오픈 아치로 트고, 2×2 원목 식탁과 동·서 마주 보는 의자로 상판 위 커피·케이크가 온전히 보이게 배치.
  { program: "mc_bakery_cafe", map: "bakery-cafe", variation: { plainDoorways: true,
    rows: [["void:2", "bakery-kitchen", "espresso-bar"], ["cafe-hall"]], ragged: true,
    entrance: "cafe-hall", hubs: ["cafe-hall", "espresso-bar"], above: [["bakery-kitchen", "cafe-hall"], ["espresso-bar", "cafe-hall"]], left: [["bakery-kitchen", "espresso-bar"]],
    palettes: [
      { "cafe-hall": ["mci-wood-dark", "mci-wall-brick"], "espresso-bar": ["mci-stone-lobby", "mci-wall-lobby"], "bakery-kitchen": ["mci-tile-small", "mci-wall-tile"] },
      { "cafe-hall": ["mci-stone-lobby", "mci-wall-home"], "espresso-bar": ["mci-wood-oak", "mci-wall-brick"], "bakery-kitchen": ["mci-concrete", "mci-wall-metal"] },
    ] }, rooms: [
    { kind: "bakery-kitchen", w: 9, h: 7, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-wall-clock", 4, 0),
      o("mci-kitchen", 0, 2), o("home-sink-counter", 3, 2), o("jumbo-bakery-deck-oven", 5, 2),
      // 3단 데크 오븐 앞 반죽·성형대 - 오븐 문 앞 한 줄(y=5 동쪽)은 빵 꺼내는 자리로 비운다.
      o("mart-bakery-counter", 1, 5), o("mart-bakery-counter", 3, 5), o("mart-baguette-basket", 0, 6), o("mci-pallet", 8, 6),
    ] },
    { kind: "espresso-bar", w: 10, h: 7, floor: "mci-wood-oak", wall: "mci-wall-brick", items: [
      o("mci-menu-board", 0, 0), o("mci-menu-board", 4, 0), o("mart-sale-banner", 7, 0),
      o("mci-coffee-station", 0, 2), o("mart-bread-rack", 2, 2), o("mart-cake-showcase", 4, 2), o("mart-donut-case", 6, 2), o("mci-fridge", 8, 2), o("office-water-cooler", 9, 2),
      o("mci-pastry-case", 0, 5), o("mart-baguette-basket", 2, 5), o("cafe-parfait-case", 3, 5), o("mci-counter-register", 7, 5), g("mci-g-register", 8, 5),
    ] },
    { kind: "cafe-hall", w: 22, h: 8, floor: "mci-wood-dark", wall: "mci-wall-brick", items: [
      o("mci-window-curtain", 1, 0), o("mci-art-frame", 5, 0), o("mci-window-curtain", 9, 0), o("mci-window-curtain", 13, 0), o("mci-art-frame", 16, 0), o("mci-window-curtain", 20, 0),
      // 앞줄 2×2 카페 식탁 셋(가운데는 동·서 의자만, 동쪽은 북쪽 의자 없이) + 뒷줄 카페 원탁 둘(앞줄과 엇갈린 열, 2×1 나무 식탁은 벤치로 읽혔다) + 남동 소파 라운지(남벽에 붙임).
      // 같은 세트를 같은 열에 앞뒤 두 줄로 세우고 뒷줄 북쪽 의자를 앞줄 남쪽 의자에 맞붙였더니 「복붙한 탁자 세트·겹겹이 포갠 의자」로
      // 읽혔다(2026-10-29 room-vig8 delivery-bakery major 둘). 뒷줄은 북쪽 의자 없이 한 줄 띄우고, 남쪽 입구 앞 열(x9~10)은 비운다.
      // (창가 바 카운터·원탁으로 통째 바꾼 판은 위 방에서 내려오는 틈 앞을 막아 77.8 로 떨어졌다 — room-vig9.)
      ...seatedTable("mci-t-wood", "mci-chair-wood", 2, 2, 2, 2), g("mci-g-coffee", 2, 2),
      ...seatedTable("mci-t-wood", "mci-chair-wood", 8, 2, 2, 2, { e: true, w: true }), g("mci-g-cake", 8, 2), g("mci-g-coffee", 9, 3),
      ...seatedTable("mci-t-wood", "mci-chair-wood", 14, 2, 2, 2, { s: true, e: true, w: true }), g("mci-g-coffee", 14, 2),   // 북쪽 의자 없음 — 에스프레소 바에서 내려오는 틈 앞
      o("mci-cafe-chair-e", 5, 6), o("mci-cafe-table", 6, 6), o("mci-cafe-chair-w", 7, 6), g("mci-g-cake", 6, 6),
      o("mci-cafe-chair-e", 12, 6), o("mci-cafe-table", 13, 6), o("mci-cafe-chair-w", 14, 6), g("mci-g-coffee", 13, 6),
      o("home-monstera", 21, 2), o("mci-coffee-table", 18, 6), o("mci-sofa-n", 18, 7), o("mci-plant-tall", 21, 7), o("mci-plant-tall", 0, 7),
    ] },
  ] },

  // ── 직장인 3. 09:00 대형 오피스 층 (46×32, 凸자형 계단식 외곽) - 위 줄 열린 업무홀(27×15)·대회의실(16×15),
  //    아래 줄 임원실(12×12)·중앙 리셉션 로비(16×14 돌출 허브)·탕비 라운지(14×12). 로비에서 모든 구획으로 바로 이어진다.
  { program: "mc_office", map: "office-floor", variation: {
    rows: [["open-office", "meeting"], ["exec", "lobby", "pantry"]], ragged: true,
    entrance: "lobby", hubs: ["open-office", "lobby"],
    above: [["open-office", "exec"], ["open-office", "lobby"], ["meeting", "pantry"]], left: [["open-office", "meeting"], ["exec", "lobby"], ["lobby", "pantry"]],
    palettes: [
      { "open-office": ["mci-wood-oak", "mci-wall-home"], meeting: ["mci-carpet-office", "mci-wall-lobby"], pantry: ["mci-tile-small", "mci-wall-tile"], lobby: ["mci-tile-concourse", "mci-wall-office"] },
      { "open-office": ["mci-concrete", "mci-wall-brick"], meeting: ["mci-wood-dark", "mci-wall-brick"], pantry: ["mci-wood-oak", "mci-wall-brick"], lobby: ["mci-concrete", "mci-wall-metal"] },
    ] }, rooms: [
    { kind: "open-office", w: 27, h: 15, floor: "mci-carpet-office", wall: "mci-wall-office", items: [
      o("mci-window-city", 1, 0), o("mci-window-city", 5, 0), o("mci-whiteboard", 9, 0), o("mci-wall-clock", 13, 0), o("mci-window-city", 17, 0), o("mci-window-city", 21, 0), o("mci-ac-wall", 24, 0),
      o("mci-plant-tall", 0, 2), o("mci-shelf-office", 2, 2), o("mci-filing", 4, 2), o("office-copier", 12, 2), o("mci-filing", 20, 2), o("mci-shelf-office", 22, 2), o("mci-plant-tall", 26, 2),
      // 마주 보는 책상 섬 3열 × 2줄 - 북쪽 자리 남향, 남쪽 자리 북향.
      ...[4, 9].flatMap((y) => [2, 9, 16].flatMap((x) => [
        o("mci-chair-office-s", x, y), o("mci-chair-office-s", x + 2, y),
        o("mci-desk-pc-back", x, y + 1), o("mci-desk-pc-back", x + 2, y + 1), o("mci-desk-pc", x, y + 2), o("mci-desk-pc", x + 2, y + 2),
        o("mci-chair-office-n", x, y + 3), o("mci-chair-office-n", x + 2, y + 3),
      ])),
      o("mci-planter", 22, 6), o("mci-planter", 22, 11), o("mci-plant-tall", 0, 14), o("office-water-cooler", 26, 14),
    ] },
    { kind: "meeting", w: 16, h: 15, floor: "mci-carpet-office", wall: "mci-wall-lobby", items: [
      o("mci-whiteboard", 2, 0), o("mci-tv-wall", 7, 0), o("mci-window-blind", 12, 0),
      o("mci-plant-tall", 0, 2), o("mci-coffee-station", 13, 2),
      // 레이스트랙 호두나무 임원 회의 탁자 - 북쪽 의자 남향, 남쪽 의자 북향, 양 끝 의장석.
      o("jumbo-office-boardroom", 5, 6),
      ...row("mci-chair-office-s", 5, 1, 5, 5), ...row("mci-chair-office-n", 5, 1, 5, 9),
      o("mci-chair-office-e", 4, 7), o("mci-chair-office-w", 10, 7),
      o("mci-plant-tall", 0, 14), o("mci-plant-tall", 15, 14),
    ] },
    { kind: "exec", w: 12, h: 12, floor: "mci-wood-dark", wall: "mci-wall-home", items: [
      o("mci-window-curtain", 4, 0), o("mci-art-frame", 7, 0), o("mci-window-curtain", 9, 0),
      o("mci-shelf-office", 0, 2), o("mci-filing", 2, 2), o("mci-plant-tall", 11, 2),
      o("mci-chair-office-s", 5, 3), o("mci-desk-pc-back", 5, 4), g("mci-g-laptop", 5, 4),
      // 응접 코너 - 임원 책상(y=4)과 3칸 여유를 두고 남쪽(y=8..10)에 크림 가죽 소파·북향 3인 소파·안락의자 배치.
      o("lounge-sofa-cream", 2, 8), o("mci-armchair-e", 1, 9), o("mci-coffee-table", 2, 9), o("mci-armchair-w", 4, 9), o("mci-sofa-n", 1, 10),
      o("mci-plant-tall", 11, 11),
    ] },
    { kind: "lobby", w: 16, h: 14, floor: "mci-stone-lobby", wall: "mci-wall-lobby", items: [
      o("mci-art-frame", 0, 0), o("mci-art-frame", 14, 0),
      o("mci-elevator", 0, 2), o("mci-elevator", 11, 2), o("mci-mailboxes", 13, 2), o("mci-plant-tall", 15, 2),
      o("mci-chair-office-s", 4, 5), o("mci-reception", 3, 6), g("mci-g-laptop", 3, 6),
      o("mci-security-gate", 10, 6), o("mci-security-gate", 12, 6),
      o("mci-sofa-e", 1, 9), o("mci-coffee-table", 2, 10), o("mci-armchair-w", 4, 10),
      o("mci-wait-bench", 11, 10), o("mci-tactile", 7, 13), o("mci-tactile", 8, 13), o("mci-plant-tall", 15, 13),
    ] },
    { kind: "pantry", w: 14, h: 12, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-menu-board", 1, 0), o("mci-wall-clock", 9, 0),
      o("mci-kitchen", 0, 2), o("mci-fridge", 3, 2), o("mci-coffee-station", 8, 2), o("subway-vending-machine", 12, 2),
      ...seatedTable("mci-t-wood", "mci-chair-wood", 2, 6, 2, 1, { n: true, e: true, w: true }), g("mci-g-coffee", 2, 6),
      ...seatedTable("mci-t-wood", "mci-chair-wood", 9, 6, 2, 1, { n: true, e: true, w: true }), g("mci-g-cake", 9, 6),
      ...seatedTable("mci-t-wood", "mci-chair-wood", 2, 10, 2, 1, { n: true, e: true, w: true }),
      ...seatedTable("mci-t-wood", "mci-chair-wood", 9, 10, 2, 1, { n: true, e: true, w: true }),
    ] },
  ] },

  // ── 직장인 4. 12:30 레스토랑 & 다이닝 바 (38×28, 계단형 외곽) - 위 줄 북서 후퇴(void:2)·오픈 키친(13×11)·바 라운지(10×11)·피아노 무대(9×11),
  //    아래 줄 다이닝 홀(36×14, 상단 2×2 식탁 + 부스석 + 하단 식탁 + 호스트 데스크). 오픈 키친·바·무대가 모두 다이닝 홀과 넓게 트인다.
  { program: "mc_restaurant", map: "restaurant-bar", variation: {
    rows: [["void:2", "rest-kitchen-bar", "rest-bar-lounge", "rest-live-stage"], ["rest-dining-hall"]], ragged: true,
    entrance: "rest-dining-hall", hubs: ["rest-dining-hall"],
    above: [["rest-kitchen-bar", "rest-dining-hall"], ["rest-bar-lounge", "rest-dining-hall"], ["rest-live-stage", "rest-dining-hall"]],
    left: [["rest-kitchen-bar", "rest-bar-lounge"], ["rest-bar-lounge", "rest-live-stage"]],
    palettes: [
      { "rest-kitchen-bar": ["mci-tile-small", "mci-wall-tile"], "rest-live-stage": ["mci-carpet-office", "mci-wall-lobby"], "rest-dining-hall": ["mci-stone-lobby", "mci-wall-lobby"], "rest-bar-lounge": ["mci-wood-dark", "mci-wall-brick"] },
      { "rest-kitchen-bar": ["mci-concrete", "mci-wall-metal"], "rest-live-stage": ["mci-wood-oak", "mci-wall-home"], "rest-dining-hall": ["mci-wood-dark", "mci-wall-home"], "rest-bar-lounge": ["mci-carpet-office", "mci-wall-lobby"] },
    ] }, rooms: [
    { kind: "rest-kitchen-bar", w: 13, h: 11, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-menu-board", 1, 0), o("mci-wall-clock", 6, 0), o("mci-ac-wall", 9, 0),
      o("mci-kitchen", 0, 2), o("mci-kitchen", 3, 2), o("mci-fridge", 6, 2), o("mci-kitchen", 8, 2), o("mci-rack", 11, 2),
      o("rest-omakase-counter", 1, 6), o("rest-omakase-counter", 4, 6), o("rest-omakase-counter", 8, 6),
      ...row("mci-bar-stool", 1, 1, 6, 7), ...row("mci-bar-stool", 8, 1, 3, 7),
      o("mci-plant-tall", 12, 10),
    ] },
    { kind: "rest-bar-lounge", w: 10, h: 11, floor: "mci-wood-dark", wall: "mci-wall-brick", items: [
      o("mci-art-frame", 1, 0), o("mci-wall-clock", 7, 0),
      o("rest-wine-rack", 0, 2), o("rest-wine-rack", 3, 2), o("rest-wine-rack", 8, 2),
      o("izakaya-counter", 1, 5), o("izakaya-counter", 4, 5), ...row("mci-bar-stool", 1, 1, 6, 6),
      o("mci-armchair-e", 1, 9), o("mci-coffee-table", 2, 9), o("mci-armchair-w", 4, 9), o("mci-plant-tall", 9, 10),
    ] },
    { kind: "rest-live-stage", w: 9, h: 11, floor: "mci-carpet-office", wall: "mci-wall-lobby", items: [
      o("mci-window-curtain", 1, 0), o("mci-art-frame", 4, 0), o("mci-window-curtain", 6, 0),
      o("music-amp", 0, 2), o("restaurant-piano-stage", 2, 2), o("music-amp", 8, 2),
      // 피아노 무대 앞 감상석 의자는 y=6 에 두어 남쪽 오픈 통로 앞 4줄(y=7..10)을 여유 있게 비운다.
      o("music-guitar-stand", 0, 6), ...row("mci-chair-wood-n", 2, 1, 4, 6),
      o("mci-plant-tall", 0, 10), o("mci-plant-tall", 8, 10),
    ] },
    { kind: "rest-dining-hall", w: 36, h: 14, floor: "mci-stone-lobby", wall: "mci-wall-lobby", items: [
      o("mci-window-curtain", 1, 0), o("mci-art-frame", 8, 0), o("mci-window-curtain", 14, 0), o("mci-art-frame", 20, 0), o("mci-window-curtain", 26, 0), o("mci-art-frame", 32, 0),
      o("rest-coat-stand", 0, 2), o("mci-plant-tall", 35, 2),
      // 상단 4인 식탁(2×2) + 중앙 부스석 + 하단 식탁(북·동·서 의자로 상판 노출) + 입구 옆 호스트 포디움.
      ...[2, 9, 22, 29].flatMap((x, i) => [...seatedTable("mci-t-wood", "mci-chair-wood", x + 1, 4, 2, 2), g(i % 2 ? "mci-g-plate" : "mci-g-vase", x + 1, 4)]),
      ...[2, 9, 22, 29].flatMap((x) => [...seatedTable("mci-t-wood", "mci-chair-wood", x + 1, 10, 2, 1, { n: true, e: true, w: true }), g("mci-g-plate", x + 1, 10)]),
      o("restaurant-booth-set", 15, 5), o("restaurant-booth-set", 18, 5),
      // 홀 한가운데 8인 원형 연회 테이블(유리 회전판·꽃장식).
      o("jumbo-rest-banquet-round", 16, 9),
      o("restaurant-host-podium", 15, 12), o("mci-tactile", 17, 13), o("mci-tactile", 18, 13), o("mci-planter", 0, 13), o("mci-planter", 34, 13),
    ] },
  ] },

  // ── 직장인 5. 19:00 퇴근 후 이자카야·라멘 (36×26, 계단형 외곽) - 위 줄 북서 후퇴(void:2)·오픈 주방(12×10)·다다미 룸 둘(9×10),
  //    아래 줄 다찌 카운터 홀(34×13). 주방 요리사 동선 뒤에 조리 카운터를 배치하고 홀 다찌 뒤에는 술선반·생맥주 서버를 둔다.
  { program: "mc_izakaya", map: "izakaya", variation: {
    rows: [["void:2", "izakaya-kitchen", "izakaya-tatami", "izakaya-tatami-2"], ["izakaya-hall"]], ragged: true,
    entrance: "izakaya-hall", hubs: ["izakaya-hall"],
    above: [["izakaya-kitchen", "izakaya-hall"], ["izakaya-tatami", "izakaya-hall"], ["izakaya-tatami-2", "izakaya-hall"]],
    left: [["izakaya-kitchen", "izakaya-tatami"], ["izakaya-tatami", "izakaya-tatami-2"]],
    palettes: [
      { "izakaya-hall": ["mci-wood-dark", "mci-wall-brick"], "izakaya-kitchen": ["mci-tile-small", "mci-wall-tile"] },
      { "izakaya-hall": ["mci-wood-oak", "mci-wall-home"], "izakaya-kitchen": ["mci-concrete", "mci-wall-metal"] },
    ] }, rooms: [
    { kind: "izakaya-kitchen", w: 12, h: 10, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-menu-board", 1, 0), o("izakaya-lantern", 5, 0), o("mci-wall-clock", 9, 0),
      o("mci-kitchen", 0, 2), o("mci-kitchen", 3, 2), o("izakaya-beer-server", 6, 2), o("mci-fridge", 7, 2), o("mci-rack", 9, 2),
      // 주방 안쪽 조리 패스 카운터 + 바 스툴.
      o("izakaya-counter", 1, 5), o("izakaya-counter", 6, 5), ...row("mci-bar-stool", 1, 1, 3, 6), ...row("mci-bar-stool", 6, 1, 3, 6),
      o("mci-pallet", 11, 9),
    ] },
    ...(["izakaya-tatami", "izakaya-tatami-2"] as const).map((kind) => ({ kind, w: 9, h: 10, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("izakaya-noren", 1, 0), o("mci-art-frame", 5, 0), o("izakaya-lantern", 7, 0),
      o("mci-planter", 0, 2), o("mci-plant-tall", 8, 2),
      o("izakaya-zashiki", 1, 4), o("izakaya-zashiki", 5, 4),
      o("home-zabuton", 2, 8), o("home-zabuton", 6, 8),
    ] })),
    { kind: "izakaya-hall", w: 34, h: 13, floor: "mci-wood-dark", wall: "mci-wall-brick", items: [
      o("izakaya-lantern", 1, 0), o("mci-menu-board", 4, 0), o("izakaya-lantern", 10, 0), o("izakaya-noren", 14, 0), o("izakaya-lantern", 20, 0), o("mci-menu-board", 25, 0), o("izakaya-lantern", 31, 0),
      // 다찌 카운터 뒤 술장·생맥주 서버·메뉴판 + 다찌 카운터 3연속 + 바 스툴 9석.
      o("izakaya-beer-server", 1, 2), o("rest-wine-rack", 3, 2), o("rest-wine-rack", 6, 2), o("izakaya-beer-server", 9, 2), o("mci-plant-tall", 33, 2),
      o("izakaya-counter", 2, 4), o("izakaya-counter", 5, 4), o("izakaya-counter", 8, 4), ...row("mci-bar-stool", 2, 1, 9, 5),
      // 2×2 식탁 둘 사이 ㄷ자 야키토리 카운터 - 숯불 그릴을 바라보는 남쪽 바 스툴.
      ...[15, 27].flatMap((x) => [...seatedTable("mci-t-wood", "mci-chair-wood", x, 4, 2, 2), g("mci-g-plate", x, 4)]),
      o("jumbo-izakaya-u-bar", 20, 4), ...row("mci-bar-stool", 20, 1, 5, 7),
      ...[3, 9, 15, 21, 27].flatMap((x) => [...seatedTable("mci-t-wood", "mci-chair-wood", x, 10, 2, 1, { n: true, e: true, w: true }), g("mci-g-ramen", x, 10)]),
      o("mci-counter-register", 30, 8), g("mci-g-register", 31, 8),
      o("subway-trash-bins", 0, 12), o("mci-tactile", 16, 12), o("mci-tactile", 17, 12), o("mci-plant-tall", 33, 12),
    ] },
  ] },

  // ── 직장인 6. 20:00 하이퍼마켓 (50×46, 계단형 외곽) - 위 줄 청과(18×12)·정육수산(16×12)·물류창고(10×12, 북동 2칸 void 후퇴),
  //    가운데 매장(48×18, 중앙 특판 아일랜드 + 12열 곤돌라 + 냉동 평대), 아래 줄 계산대 홀(31×12)·푸드코트(16×10 후퇴).
  { program: "mc_supermarket", map: "supermarket-mart", variation: {
    rows: [["mart-produce", "mart-butcher", "mart-storage", "void:2"], ["mart-sales-hall"], ["mart-checkout", "mart-foodcourt"]], ragged: true,
    entrance: "mart-checkout", hubs: ["mart-sales-hall", "mart-checkout"],
    above: [["mart-produce", "mart-sales-hall"], ["mart-butcher", "mart-sales-hall"], ["mart-storage", "mart-sales-hall"], ["mart-sales-hall", "mart-checkout"], ["mart-sales-hall", "mart-foodcourt"]],
    left: [["mart-produce", "mart-butcher"], ["mart-butcher", "mart-storage"], ["mart-checkout", "mart-foodcourt"]],
    fixed: ["mart-sales-hall"], palettes: [
      { "mart-sales-hall": ["mci-tile-concourse", "mci-wall-tile"], "mart-produce": ["mci-wood-oak", "mci-wall-brick"], "mart-checkout": ["mci-stone-lobby", "mci-wall-lobby"], "mart-foodcourt": ["mci-wood-dark", "mci-wall-home"] },
      { "mart-sales-hall": ["mci-stone-lobby", "mci-wall-lobby"], "mart-produce": ["mci-tile-small", "mci-wall-tile"], "mart-checkout": ["mci-tile-concourse", "mci-wall-store"], "mart-foodcourt": ["mci-carpet-office", "mci-wall-brick"] },
    ] }, rooms: [
    { kind: "mart-produce", w: 18, h: 12, floor: "mci-wood-oak", wall: "mci-wall-brick", items: [
      o("mart-sale-banner", 1, 0), o("mci-menu-board", 6, 0), o("mart-sale-banner", 13, 0),
      o("mart-veg-wall", 0, 2), o("mart-veg-wall", 2, 2), o("mart-cold-case", 4, 2), o("mart-cold-case", 12, 2), o("mart-veg-wall", 14, 2), o("mart-veg-wall", 16, 2),
      // 청과 매대는 두 줄의 이어진 아일랜드(y=5·8, x=2..15) - 서쪽 끝 저울대, 동쪽 끝 계란 타워.
      o("mart-scale-station", 1, 5), o("mart-fruit-apple", 2, 5), o("mart-fruit-banana", 4, 5), o("mart-veg-pyramid", 6, 5), o("mart-fruit-orange", 9, 5), o("mart-fruit-apple", 11, 5), o("mart-veg-pyramid", 13, 5), o("mart-egg-tower", 16, 5),
      o("mart-scale-station", 1, 8), o("mart-fruit-watermelon", 2, 8), o("mart-veg-pyramid", 4, 8), o("mart-fruit-orange", 7, 8), o("mart-fruit-banana", 9, 8), o("mart-veg-pyramid", 11, 8), o("mart-fruit-watermelon", 14, 8), o("mart-egg-tower", 16, 8),
      o("mci-basket-stack", 0, 11), o("mart-flower-buckets", 1, 11), o("mart-flower-buckets", 2, 11), o("mart-rice-pallet", 14, 11), o("mci-basket-stack", 17, 11),
    ] },
    { kind: "mart-butcher", w: 16, h: 12, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-menu-board", 1, 0), o("mci-wall-clock", 7, 0), o("mci-menu-board", 12, 0),
      o("mart-meat-showcase", 0, 2), o("mart-meat-showcase", 3, 2), o("mart-meat-case", 6, 2), o("mart-meat-case", 8, 2), o("mart-meat-showcase", 10, 2), o("mart-meat-showcase", 13, 2),
      // 가운데 곡면 유리 수산 아일랜드(얼음 위 생선·대게·문어) 양옆 얼음 매대, 냉동고 줄(y=9)은 아일랜드 뒤로 통로를 둔다.
      o("mart-fish-ice", 1, 5), o("jumbo-mart-seafood-island", 5, 5), o("mart-fish-ice", 11, 5),
      o("mci-freezer", 2, 9), o("mart-freezer-dumpling", 4, 9), o("mart-freezer-icecream", 6, 9), o("mart-freezer-icecream", 8, 9), o("mart-freezer-dumpling", 10, 9), o("mci-freezer", 12, 9),
      o("mci-basket-stack", 0, 11), o("mart-promo-endcap", 1, 11), o("mart-sample-cart", 14, 11),
    ] },
    { kind: "mart-storage", w: 10, h: 12, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-wall-clock", 4, 0),
      o("mci-rack", 0, 2), o("mci-rack", 3, 2), o("mci-rack", 7, 2),
      o("mci-pallet", 0, 6), o("mart-rice-pallet", 2, 6), o("mart-rice-pallet", 6, 6), o("mci-pallet", 8, 6),
      o("mart-rice-pallet", 1, 10), o("mci-pallet", 7, 10), o("mci-basket-stack", 9, 11),
    ] },
    { kind: "mart-sales-hall", w: 48, h: 18, floor: "mci-tile-concourse", wall: "mci-wall-tile", items: [
      o("mart-sale-banner", 2, 0), o("mci-tv-wall", 12, 0), o("mci-wall-clock", 24, 0), o("mart-sale-banner", 30, 0), o("mci-tv-wall", 36, 0), o("mci-notice-board", 44, 0),
      // 오픈 쇼케이스 벽 - 위 방 오픈 통로 앞은 비우고 나머지 북벽에 냉장·베이커리 진열대를 촘촘히 배치.
      o("mart-dairy-open", 0, 2), o("mart-dairy-open", 2, 2), o("mart-drink-open", 4, 2), o("mart-drink-open", 6, 2),
      o("mart-bread-rack", 12, 2), o("mart-bread-rack", 14, 2), o("mart-cake-showcase", 16, 2), o("mart-donut-case", 18, 2), o("mart-liquor-fridge", 20, 2), o("mart-liquor-fridge", 22, 2), o("mart-cold-case", 24, 2),
      o("mci-cooler", 31, 2), o("mart-liquor-fridge", 33, 2), o("mart-drink-open", 35, 2), o("mart-dairy-open", 37, 2),
      // 곤돌라는 동서로 길게 이은 진열 줄 3개(y=6·9·12) × 서·동 블록 - 줄 끝마다 엔드캡, 줄 사이 통로 2칸(위 칸은 진열대 윗면).
      // 낱개 곤돌라를 바둑판으로 흩어 놓던 R11 배치는 「떠 있는 상자」로 읽혀 폐기. 가운데 특판 아일랜드(x=19..25)가 두 블록을 가른다.
      ...([[6, ["mart-gondola-ramen", "mart-gondola-snack", "mart-gondola-cereal"]], [9, ["mart-gondola-cans", "mart-gondola-tea", "mart-gondola-water"]],
        [12, ["mart-gondola-detergent", "mart-gondola-household", "mci-gondola"]]] as const).flatMap(([y, ids]) => [
        o("mart-promo-endcap", 1, y), ...[2, 4, 6, 8, 10, 12, 14].map((x, i) => o(ids[Math.floor(i / 3) % 3]!, x, y)), o("mart-sale-endcap", 16, y),
        o("mart-sale-endcap", 28, y), ...[29, 31, 33, 35, 37, 39, 41].map((x, i) => o(ids[(Math.floor(i / 3) + 1) % 3]!, x, y)), o("mart-promo-endcap", 43, y),
      ]),
      o("mart-promo-endcap", 20, 6), o("mart-sale-endcap", 23, 6),
      // 특판 피라미드는 가운데 아일랜드 한가운데 홀로 - 서쪽 사탕 통·동쪽 계란 탑·시식 카트와는 양쪽 2칸 통로로 떨어진다.
      o("mart-candy-bins", 18, 9), o("jumbo-mart-promo-pyramid", 21, 9), o("mart-egg-tower", 26, 9),
      o("mart-sample-cart", 26, 12),
      // 냉동 평대도 이어 붙인 아일랜드 두 개(서 x=2..15 · 동 x=29..42) - 계산대 쪽으로 2칸 통로를 남긴다.
      ...[2, 4, 6, 8, 10, 12, 14].map((x, i) => o(["mart-freezer-dumpling", "mart-freezer-icecream", "mci-freezer"][Math.floor(i / 2) % 3]!, x, 15)),
      ...[29, 31, 33, 35, 37, 39, 41].map((x, i) => o(["mart-freezer-icecream", "mci-freezer", "mart-freezer-dumpling"][Math.floor(i / 2) % 3]!, x, 15)),
      o("mci-plant-tall", 0, 17), o("mci-plant-tall", 47, 17),
    ] },
    { kind: "mart-checkout", w: 31, h: 12, floor: "mci-stone-lobby", wall: "mci-wall-lobby", items: [
      o("mci-notice-board", 1, 0), o("mci-tv-wall", 8, 0), o("mart-sale-banner", 14, 0), o("mci-wall-clock", 20, 0), o("mci-tv-wall", 26, 0),
      // 유인 계산대 6레인 + 고객센터 + 셀프 계산대 4기 + 출입구 보안 게이트·점자 블록·카트 베이.
      ...[1, 4, 7, 10, 24, 27].map((x) => o("mart-checkout-lane", x, 4)),
      o("mci-reception", 13, 4),
      o("mart-self-checkout", 18, 4), o("mart-self-checkout", 20, 4), o("mart-self-checkout", 18, 6), o("mart-self-checkout", 20, 6),
      o("mci-wait-bench", 1, 9), o("mart-basket-stacker", 5, 9), o("mart-cart-bay", 6, 9), o("dept-directory-kiosk", 9, 9),
      o("mci-security-gate", 13, 9), o("mci-security-gate", 17, 9),
      o("mart-cart-bay", 21, 9), o("mart-basket-stacker", 23, 9), o("mci-wait-bench", 26, 9),
      o("mci-plant-tall", 0, 11), o("mci-tactile", 14, 11), o("mci-tactile", 15, 11), o("mci-tactile", 16, 11), o("mci-plant-tall", 30, 11),
    ] },
    { kind: "mart-foodcourt", w: 16, h: 10, floor: "mci-wood-dark", wall: "mci-wall-home", items: [
      o("mci-menu-board", 1, 0), o("mci-menu-board", 5, 0), o("mci-menu-board", 11, 0),
      o("mart-bakery-counter", 0, 2), o("mci-pastry-case", 2, 2), o("mart-cake-showcase", 4, 2), o("mci-coffee-station", 11, 2), o("mci-kitchen", 13, 2),
      // 북·동·서 의자 배치로 식탁 상판과 음식이 가려지지 않는다.
      ...seatedTable("mci-t-wood", "mci-chair-wood", 2, 5, 2, 1, { n: true, e: true, w: true }), g("mci-g-ramen", 2, 5),
      ...seatedTable("mci-t-wood", "mci-chair-wood", 11, 5, 2, 1, { n: true, e: true, w: true }), g("mci-g-plate", 11, 5),
      ...seatedTable("mci-t-wood", "mci-chair-wood", 2, 8, 2, 1, { n: true, e: true, w: true }), g("mci-g-coffee", 2, 8),
      ...seatedTable("mci-t-wood", "mci-chair-wood", 11, 8, 2, 1, { n: true, e: true, w: true }), g("mci-g-cake", 11, 8),
    ] },
  ] },

  // ── 직장인 8. 22:00 센토·스파 (40×30, 계단형 외곽) - 2026-10-25 남탕·여탕 분리(시타마치 적대 VQA: 남녀 노렌만 걸린 한 칸 탈의실이
  //    4칸 통로로 한 목욕 홀에 트여 남녀 구분이 없었다).
  //    아래 줄: 남탕 탈의실 | 번대(番台) 로비(거리 출입구) | 여탕 탈의실 - 로비에서 양쪽 탈의실로만 들어간다.
  //    가운데 줄: 남탕 목욕 홀 | 여탕 목욕 홀 - 각 탈의실 바로 위, 두 홀 사이와 로비 위는 막힌 칸막이(sealed).
  //    위 줄: 건식 사우나(남탕 쪽) · 노천탕(여탕 쪽) - 반대편 홀·서로 사이는 막는다.
  { program: "mc_sento", map: "sento", variation: { plainDoorways: true,
    rows: [["void:3", "sento-sauna", "sento-rotenburo"], ["sento-bath-m", "sento-bath-w"], ["sento-changing-m", "sento-lobby", "sento-changing-w"]], ragged: true,
    entrance: "sento-lobby", hubs: ["sento-lobby", "sento-changing-m", "sento-changing-w", "sento-bath-m", "sento-bath-w"],
    above: [["sento-sauna", "sento-bath-m"], ["sento-rotenburo", "sento-bath-w"], ["sento-bath-m", "sento-changing-m"], ["sento-bath-w", "sento-changing-w"]],
    left: [["sento-sauna", "sento-rotenburo"], ["sento-bath-m", "sento-bath-w"], ["sento-changing-m", "sento-lobby"], ["sento-lobby", "sento-changing-w"]],
    sealed: [["sento-bath-m", "sento-bath-w"], ["sento-lobby", "sento-bath-m"], ["sento-lobby", "sento-bath-w"], ["sento-sauna", "sento-rotenburo"],
      ["sento-sauna", "sento-bath-w"], ["sento-rotenburo", "sento-bath-m"], ["sento-changing-m", "sento-bath-w"], ["sento-changing-w", "sento-bath-m"]],
    fixed: ["sento-bath-m", "sento-bath-w", "sento-changing-m", "sento-lobby", "sento-changing-w"], palettes: [
      { "sento-bath-m": ["mci-tile-small", "mci-wall-tile"], "sento-bath-w": ["mci-tile-small", "mci-wall-tile"], "sento-changing-m": ["mci-wood-oak", "mci-wall-home"], "sento-changing-w": ["mci-wood-oak", "mci-wall-home"], "sento-lobby": ["mci-wood-oak", "mci-wall-home"], "sento-rotenburo": ["mci-stone-lobby", "mci-wall-brick"] },
      { "sento-bath-m": ["mci-stone-lobby", "mci-wall-tile"], "sento-bath-w": ["mci-stone-lobby", "mci-wall-tile"], "sento-changing-m": ["mci-wood-dark", "mci-wall-brick"], "sento-changing-w": ["mci-wood-dark", "mci-wall-brick"], "sento-lobby": ["mci-wood-dark", "mci-wall-brick"], "sento-rotenburo": ["mci-wood-dark", "mci-wall-brick"] },
    ] }, rooms: [
    { kind: "sento-sauna", w: 14, h: 8, floor: "mci-wood-dark", wall: "mci-wall-brick", items: [
      o("mci-wall-clock", 6, 0),
      o("mci-bench-metal", 0, 2), o("mci-bench-metal", 3, 2), o("mci-bench-metal", 9, 2), o("mci-bench-metal", 12, 2),
      o("mci-bench-metal", 0, 5), o("mci-bench-metal", 3, 5), o("mci-bench-metal", 9, 5), o("mci-bench-metal", 12, 5),
      o("home-bath-stool", 6, 6), o("home-bath-stool", 7, 6),
    ] },
    { kind: "sento-rotenburo", w: 20, h: 8, floor: "mci-stone-lobby", wall: "mci-wall-brick", items: [
      o("shrine-shimenawa", 8, 0),
      o("mci-planter", 0, 2), o("mci-planter", 18, 2), o("shrine-stone-lantern", 3, 3), o("shrine-stone-lantern", 16, 3),
      o("jumbo-sento-grand-bath", 7, 3), o("mci-plant-tall", 0, 7), o("mci-plant-tall", 19, 7),
    ] },
    // 남탕 목욕 홀(18×11) - 서쪽 북벽 벽화, 동쪽 씻는 자리. 문(사우나·탈의실)은 가운데 언저리에 나므로 x=8..11 을 비운다.
    { kind: "sento-bath-m", w: 18, h: 11, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("jumbo-sento-mural", 1, 0), ...row("sento-wash-station", 12, 2, 3, 2),
      o("jumbo-sento-grand-bath", 1, 5), o("sento-bath", 12, 5),
      o("home-bath-stool", 0, 9), o("mci-bench-metal", 13, 9), o("mci-basket-stack", 17, 10),
    ] },
    // 여탕 목욕 홀(19×11) - 남탕의 거울상.
    { kind: "sento-bath-w", w: 19, h: 11, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      ...row("sento-wash-station", 1, 2, 3, 2), o("jumbo-sento-mural", 12, 0),
      o("sento-bath", 2, 5), o("jumbo-sento-grand-bath", 12, 5),
      o("mci-basket-stack", 0, 10), o("mci-bench-metal", 3, 9), o("home-bath-stool", 18, 9),
    ] },
    // 남탕 탈의실(14×7) - 男 노렌, 신발장·세면대·평상·체중계.
    { kind: "sento-changing-m", w: 14, h: 7, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("sento-noren-men", 2, 0), ...row("sento-shoe-locker", 0, 2, 2, 2), o("mci-washbasin", 12, 2),
      o("mci-wait-bench", 1, 5), o("infirmary-scale", 11, 5), o("mci-plant-tall", 13, 6),
    ] },
    // 번대 로비(8×7) - 거리 출입구. 시계·번대 카운터, 양옆 탈의실로 가는 문.
    { kind: "sento-lobby", w: 8, h: 7, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("mci-wall-clock", 3, 0), o("mci-fridge", 0, 2),
      o("mci-counter-register", 3, 3), g("mci-g-register", 4, 3),
      o("mci-tactile", 3, 6), o("mci-tactile", 4, 6),
    ] },
    // 여탕 탈의실(14×7) - 女 노렌, 남탕 탈의실의 거울상.
    { kind: "sento-changing-w", w: 14, h: 7, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("sento-noren-women", 10, 0), o("mci-washbasin", 1, 2), ...row("sento-shoe-locker", 10, 2, 2, 2),
      o("infirmary-scale", 2, 5), o("mci-wait-bench", 10, 5), o("mci-plant-tall", 0, 6),
    ] },
  ] },

  // ── 19. 3층 다층 종합병원 (50×50, 비사각형 계단형 다동 외곽) - 2026-10-18 19:18 사용자 「종합병원은 다층으로 구성된 뭐 .. 그런거여야하는데 지금 졸라 허접하고
  //    대기실도 너무 작고, 수술실도 엉망이고. 침대가 세로형만 있네. 가로형은 왜 없는거지. 대기실이 더 넓어야함 ... 종합병원 같은 대규모는 50x50 를 기본으로 잡게 하고 해라」.
  //    3F(북쪽 줄, 서쪽 5칸 void 계단식 후퇴): 제1·제2수술실(가로 수술대·천장 무영등·마취기·모니터 뱅크·메이요 기구대·스크럽 세척대) + 중환자실(ICU 병상·가로/세로 병상·응급카트) + 영상의학·CT·X선실.
  //    2F(가운데 줄): 서병동·동병동 다인실(서쪽·동쪽 벽 가로형 침대 mci-hosp-bed-e/w + 천장 레일 커튼 + 수액 펌프 + 협탁 + 생체 모니터) + 중앙 간호사 스테이션·엘리베이터 코어·라운지 + 1인 특실.
  //    1F(남쪽 줄, 남서 약국 4칸 후퇴 ragged 비사각형 외곽): 원내 약국 + 대형 대기실 로비(26×17, 3연석 대기 의자 36석·원무과 대형 접수/수납 카운터·문진 혈압 측정대·번호표 발급기·전광판·엘리베이터 3기) + 응급실(ER)·구급차 반입구.
  { program: "mc_hospital", map: "hospital-ward", variation: {
    rows: [
      ["void:5", "hosp-or-1", "hosp-or-2", "hosp-icu", "hosp-imaging"],
      ["hosp-ward-west", "hosp-nurse-core", "hosp-ward-east", "hosp-vip-ward"],
      ["hosp-pharmacy", "waiting_room", "hosp-er"],
    ],
    ragged: true,
    entrance: "waiting_room",
    hubs: ["waiting_room", "hosp-nurse-core", "hosp-ward-west", "hosp-ward-east", "hosp-icu"],
    above: [
      ["hosp-or-1", "hosp-ward-west"], ["hosp-or-2", "hosp-nurse-core"], ["hosp-icu", "hosp-ward-east"], ["hosp-imaging", "hosp-ward-east"],
      ["hosp-ward-west", "waiting_room"], ["hosp-nurse-core", "waiting_room"], ["hosp-ward-east", "waiting_room"],
    ],
    left: [
      ["hosp-or-1", "hosp-or-2"], ["hosp-or-2", "hosp-icu"], ["hosp-icu", "hosp-imaging"],
      ["hosp-ward-west", "hosp-nurse-core"], ["hosp-nurse-core", "hosp-ward-east"], ["hosp-ward-east", "hosp-vip-ward"],
      ["hosp-pharmacy", "waiting_room"], ["waiting_room", "hosp-er"],
    ],
    fixed: [
      "hosp-or-1", "hosp-or-2", "hosp-icu", "hosp-imaging",
      "hosp-ward-west", "hosp-nurse-core", "hosp-ward-east", "hosp-vip-ward",
      "hosp-pharmacy", "waiting_room", "hosp-er",
    ],
    palettes: [
      { "hosp-ward-west": ["mci-vinyl-store", "mci-wall-hospital"], "hosp-ward-east": ["mci-vinyl-store", "mci-wall-hospital"], "hosp-nurse-core": ["mci-tile-concourse", "mci-wall-lobby"], waiting_room: ["mci-tile-concourse", "mci-wall-lobby"] },
      { "hosp-ward-west": ["mci-wood-oak", "mci-wall-home"], "hosp-ward-east": ["mci-wood-oak", "mci-wall-home"], "hosp-nurse-core": ["mci-stone-lobby", "mci-wall-office"], waiting_room: ["mci-stone-lobby", "mci-wall-office"] },
    ] }, rooms: [
    // ── 3F-1. 제1수술실 (10×14) - R12b: 수술대가 북쪽 절반에 몰려 남쪽 6줄이 빈 바닥이었다(Opus VQA).
    //    북벽 스크럽 세척대 둘 + 모니터 뱅크 + 약품장, 가운데 수술 구역(무영등 아래 수술대 · 서쪽 마취기·생체 모니터 · 동쪽 메이요 기구대·기구 카트),
    //    남쪽은 레일 커튼으로 가른 준비·회복 베이(이송 침대 + 응급 카트 + 수액 펌프).
    { kind: "hosp-or-1", w: 10, h: 14, floor: "mci-tile-small", wall: "mci-wall-hospital", items: [
      o("mci-wall-clock", 1, 0), o("hosp-film-viewer", 4, 0), o("mci-ac-wall", 7, 0),
      o("hosp-scrub-sink", 0, 2), o("hosp-scrub-sink", 2, 2), o("hosp-vitals-bank", 4, 2), o("hospital-med-cabinet", 6, 2), o("hospital-med-cabinet", 8, 2),
      // 천장 붐 관절 팔 무영등 + 수술대 일체형 수술 구역 - 서쪽 마취기·모니터, 동쪽 메이요 기구대·기구 카트.
      o("hospital-bedside-monitor", 1, 7), o("hosp-anesthesia", 2, 7), o("jumbo-hosp-surgical-rig", 3, 7), o("hosp-mayo-stand", 6, 7), o("mci-med-cart", 7, 7),
      o("hosp-iv-pump", 2, 9), o("hosp-mayo-stand", 6, 9),
      o("hosp-curtain-track", 0, 11), o("hosp-curtain-track", 7, 11),
      o("hosp-stretcher", 0, 13), o("hosp-iv-pump", 2, 13), o("hosp-crash-cart", 7, 13), o("mci-med-cart", 8, 13),
    ] },
    // ── 3F-2. 제2수술실 (10×14) - 제1수술실의 좌우 대칭(스크럽 세척대는 동쪽, 준비·회복 베이는 남쪽).
    { kind: "hosp-or-2", w: 10, h: 14, floor: "mci-tile-small", wall: "mci-wall-hospital", items: [
      o("mci-ac-wall", 1, 0), o("hosp-film-viewer", 4, 0), o("mci-wall-clock", 8, 0),
      o("hospital-med-cabinet", 0, 2), o("hosp-vitals-bank", 2, 2), o("hospital-med-cabinet", 4, 2), o("hosp-scrub-sink", 6, 2), o("hosp-scrub-sink", 8, 2),
      o("mci-med-cart", 1, 7), o("hosp-mayo-stand", 2, 7), o("jumbo-hosp-surgical-rig", 3, 7), o("hosp-anesthesia", 6, 7), o("hospital-bedside-monitor", 7, 7),
      o("hosp-mayo-stand", 2, 9), o("hosp-iv-pump", 6, 9),
      o("hosp-curtain-track", 0, 11), o("hosp-curtain-track", 7, 11),
      o("mci-med-cart", 0, 13), o("hosp-crash-cart", 1, 13), o("hosp-iv-pump", 7, 13), o("hosp-stretcher", 8, 13),
    ] },
    // ── 3F-3. 중환자실 ICU (10×14) - 북벽 2×2 ICU 병상 둘, 서·동 벽 가로 병상 둘씩을 레일 커튼으로 나누고(사생활 보호),
    //    가운데 열린 중앙 간호사 감시 데스크가 여섯 병상을 모두 본다. 남쪽은 응급 카트·약품 카트·휠체어 대기열.
    { kind: "hosp-icu", w: 10, h: 14, floor: "mci-vinyl-hospital", wall: "mci-wall-hospital", items: [
      o("mci-window-blind", 1, 0), o("mci-wall-clock", 4, 0), o("mci-window-blind", 7, 0),
      o("hosp-vitals-bank", 0, 2), o("hosp-icu-pod", 2, 2), o("hospital-curtain-screen", 4, 2), o("hosp-icu-pod", 5, 2), o("hosp-vitals-bank", 8, 2),
      o("mci-hosp-bed-e", 0, 6), o("hospital-bedside-monitor", 2, 6), o("mci-hosp-bed-w", 8, 6), o("hospital-bedside-monitor", 7, 6),
      o("hosp-curtain-track", 0, 8), o("hospital-nurse-station", 4, 8), o("hosp-curtain-track", 7, 8),
      o("mci-hosp-bed-e", 0, 10), o("hosp-iv-pump", 2, 10), o("mci-chair-office-n", 5, 10), o("mci-hosp-bed-w", 8, 10), o("hosp-iv-pump", 7, 10),
      o("hosp-crash-cart", 0, 13), o("mci-med-cart", 1, 13), o("hospital-wheelchair", 8, 13), o("hospital-wheelchair", 9, 13),
    ] },
    // ── 3F-4. 영상의학·CT·X선실 (10×14) - 북쪽 CT실(CT 스캐너 + 납유리 조작 콘솔), 레일 커튼 아래 남쪽 X선실(촬영대 + 탈의 커튼 베이),
    //    서남쪽 이송 대기(이송 침대·휠체어), 동남쪽 판독 데스크. 남서쪽 빈 바닥을 대기·탈의 동선으로 채운다.
    { kind: "hosp-imaging", w: 10, h: 14, floor: "mci-vinyl-hospital", wall: "mci-wall-hospital", items: [
      o("hosp-film-viewer", 1, 0), o("hosp-film-viewer", 4, 0), o("mci-wall-clock", 8, 0),
      o("hosp-xray-console", 0, 2), o("hosp-xray-console", 2, 2), o("hospital-med-cabinet", 5, 2), o("stairs-pair-down-stone", 7, 2),
      // 북쪽 MRI실 - 깊은 원통 보어 + 밀려 들어가는 환자 침대(4×3), 동쪽 수액 펌프·생체 모니터.
      o("jumbo-hosp-mri", 1, 5), o("hosp-iv-pump", 6, 5), o("hospital-bedside-monitor", 7, 5),
      o("hosp-curtain-track", 0, 8), o("hosp-curtain-track", 6, 8),
      o("hosp-stretcher", 0, 10), o("hosp-mayo-stand", 8, 10),
      o("hospital-wheelchair", 0, 13), o("hospital-curtain-screen", 2, 12),
      o("hospital-doctor-desk", 5, 12), o("mci-chair-office-n", 8, 12),
    ] },
    // ── 2F-1. 서병동 다인실 입원병동 (10×15) - 서쪽 가로 침대(mci-hosp-bed-e) 3상 + 동쪽 가로 침대(mci-hosp-bed-w) 3상, 병상 사이 레일 커튼.
    //    협탁·모니터·수액 펌프는 침대 옆(같은 줄)에 둔다 — 침대 바로 아래 줄에 협탁, 그 아래에 커튼을 붙이면 키 큰 기물의 윗칸이 앞 기물
    //    위로 그려져 침대·협탁·커튼이 한 덩이로 겹쳤고, 가운데 통로에 모니터 세로 줄이 서 통로를 막았다(2026-10-29 horror-ward major).
    //    병상은 4줄 간격(y 4·8·12), 커튼은 침대 두 줄 아래(y 6·10)라 위아래가 닿지 않는다. 북벽 기물(세면대·정수기·약장)과 첫 침대 사이도 한 줄 띄워
    //    덩이가 갈린다(붙이면 한 덩이로 옮겨져 침대가 세면대 앞에 얹혔다). 가운데 통로는 x3~5 세 칸 — 13×15 일 때는
    //    맨바닥이 넓어 조수 짓기가 방을 줄였고, 줄이면서 덩이 사이 빈 줄이 빠져 커튼이 침대 위로 다시 붙었다. 처음부터 줄일 필요 없는 크기로 짠다.
    { kind: "hosp-ward-west", w: 10, h: 15, floor: "mci-vinyl-hospital", wall: "mci-wall-hospital", items: [
      o("mci-window-blind", 0, 0), o("mci-window-blind", 7, 0), o("mci-wall-clock", 4, 0),
      o("mci-washbasin", 3, 2), o("hospital-water-dispenser", 4, 2), o("hospital-med-cabinet", 5, 2),
      ...[4, 8, 12].flatMap((y, i) => [
        o("mci-hosp-bed-e", 0, y), o(i === 1 ? "hosp-iv-pump" : "mci-bedside", 2, y),
        o(i === 1 ? "mci-bedside" : "hosp-iv-pump", 6, y), o("mci-hosp-bed-w", 7, y), o("hospital-bedside-monitor", 9, y),
      ]),
      o("hosp-curtain-track", 0, 6), o("hosp-curtain-track", 0, 10), o("hosp-curtain-track", 6, 6), o("hosp-curtain-track", 6, 10),
      o("mci-med-cart", 0, 14), o("hosp-wheelchair-bay", 8, 14),
    ] },
    // ── 2F-2. 중앙 간호사 스테이션 · 엘리베이터 홀 · 병동 휴게 라운지 (12×15)
    { kind: "hosp-nurse-core", w: 12, h: 15, floor: "mci-stone-lobby", wall: "mci-wall-lobby", items: [
      o("elev-floor-led", 1, 0), o("elev-hall-lantern", 5, 0), o("hosp-floor-directory", 8, 0), o("mci-wall-clock", 11, 0),
      o("mci-elevator", 0, 2), o("mci-elevator", 2, 2), o("hospital-med-cabinet", 8, 2), o("office-water-cooler", 10, 2), o("mci-plant-tall", 11, 2),
      // 원형 간호사 스테이션(곡면 호두나무 접수 턱·모니터 셋·호출 표시판)이 엘리베이터 홀과 두 병동 문을 모두 본다.
      o("jumbo-hosp-nurse-command", 3, 6), o("hosp-crash-cart", 10, 5),
      o("mci-sofa-e", 0, 10), o("mci-coffee-table", 1, 11), o("mci-armchair-w", 3, 11),
      o("lounge-sofa-cream", 8, 10), o("mci-coffee-table", 8, 11), o("mci-sofa-n", 8, 12),
      o("home-monstera", 0, 14), o("mci-plant-tall", 11, 14),
    ] },
    // ── 2F-3. 동병동 다인실 입원병동 (14×15) - 북벽 세로 병상 3상 + 중앙 가로형 병상(mci-hosp-bed-e/w) 5상 + 레일 커튼
    { kind: "hosp-ward-east", w: 14, h: 15, floor: "mci-vinyl-hospital", wall: "mci-wall-hospital", items: [
      o("mci-window-blind", 0, 0), o("mci-window-blind", 6, 0), o("mci-wall-clock", 9, 0),
      o("mci-hosp-bed", 0, 2), o("mci-bedside", 1, 2), o("mci-iv-stand", 2, 2),
      o("mci-hosp-bed", 6, 2), o("hospital-curtain-screen", 7, 2), o("mci-hosp-bed", 8, 2), o("mci-bedside", 9, 2), o("mci-iv-stand", 10, 2),
      o("mci-hosp-bed-e", 2, 6), o("hosp-iv-pump", 4, 6),
      o("hosp-curtain-track", 2, 8),
      o("mci-hosp-bed-e", 2, 10), o("mci-bedside", 2, 11), o("hospital-bedside-monitor", 4, 10),
      o("hospital-bedside-monitor", 7, 6), o("mci-hosp-bed-w", 8, 6), o("mci-bedside", 9, 7),
      o("hosp-curtain-track", 7, 8),
      o("hospital-bedside-monitor", 7, 10), o("mci-hosp-bed-w", 8, 10), o("mci-bedside", 9, 11),
      o("hosp-iv-pump", 7, 13), o("mci-hosp-bed-w", 8, 13),
      o("mci-med-cart", 12, 11), o("hospital-wheelchair", 13, 11), o("mci-plant-tall", 13, 14),
    ] },
    // ── 2F-4. 1인 특실 입원실 (6×15) - 가로형 병상 + 전용 세면대·옷장·TV + 보호자 응접 소파·책상
    { kind: "hosp-vip-ward", w: 6, h: 15, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("mci-window-curtain", 1, 0), o("home-wall-ac", 4, 0),
      o("home-vanity-sink", 0, 2), o("mci-wardrobe", 2, 2), o("mci-tv-stand", 4, 2),
      o("mci-bedside", 3, 4), o("hosp-iv-pump", 3, 5), o("mci-hosp-bed-w", 4, 5), o("hospital-bedside-monitor", 5, 6),
      o("mci-rug", 1, 10), o("home-floor-lamp", 5, 10),
      o("mci-armchair-e", 0, 11), o("mci-coffee-table", 1, 11), o("mci-armchair-w", 3, 11),
      o("mci-desk-pc", 4, 13), o("mci-chair-office-n", 4, 14), o("home-monstera", 0, 14),
    ] },
    { kind: "hosp-pharmacy", w: 7, h: 13, floor: "mci-vinyl-store", wall: "mci-wall-hospital", items: [
      o("hosp-number-display", 1, 0), o("mci-wall-clock", 5, 0),
      o("hospital-pharmacy-window", 0, 2), o("hospital-med-cabinet", 3, 2), o("hospital-med-cabinet", 5, 2),
      o("mci-counter-register", 0, 5), o("hosp-triage-desk", 4, 5),
      o("mci-gondola", 0, 8), o("mci-med-cart", 3, 8),
      o("hosp-wait-row-n", 0, 11), o("hosp-ticket-dispenser", 4, 11), o("mci-plant-tall", 6, 12),
    ] },
    // ── 1F-2. 대형 대기실 로비 · 원무과 수납 · 엘리베이터 홀 (26×17) - 대기 의자 3연석 12열(36석) + 대형 원무과 카운터 + 문진·혈압대 + 번호표 발급기·전광판
    { kind: "waiting_room", w: 26, h: 17, floor: "mci-stone-lobby", wall: "mci-wall-lobby", items: [
      o("hosp-floor-directory", 4, 0), o("elev-floor-led", 6, 0), o("elev-hall-lantern", 9, 0),
      o("hosp-number-display", 14, 0), o("mci-tv-wall", 20, 0), o("mci-wall-clock", 24, 0),
      o("mci-plant-tall", 0, 2),
      o("mci-elevator", 4, 2), o("mci-elevator", 6, 2), o("mci-elevator", 14, 2),
      o("hospital-pharmacy-window", 16, 2), o("hospital-water-dispenser", 19, 2), o("subway-vending-machine", 20, 2), o("hospital-med-cabinet", 22, 2),
      o("mci-coffee-station", 24, 2),
      o("hosp-triage-desk", 3, 5), o("hosp-ticket-dispenser", 6, 5), o("dept-directory-kiosk", 7, 5),
      o("mci-chair-office-s", 14, 4), o("mci-chair-office-s", 16, 4), o("mci-chair-office-s", 18, 4), o("mci-chair-office-s", 20, 4),
      o("mci-reception", 13, 5), o("mci-reception", 16, 5), o("hospital-nurse-station", 19, 5), o("hosp-ticket-dispenser", 23, 5),
      o("hosp-wait-row-n", 3, 8), o("hosp-wait-row-n", 7, 8), o("hosp-wait-row-n", 13, 8), o("hosp-wait-row-n", 17, 8), o("hosp-wait-row-n", 20, 8),
      o("hosp-wait-row-s", 3, 10), o("hosp-wait-row-s", 7, 10), o("hosp-wait-row-s", 13, 10), o("hosp-wait-row-s", 17, 10), o("hosp-wait-row-s", 20, 10),
      o("hosp-wait-row-n", 3, 13), o("hosp-wait-row-n", 7, 13), o("hosp-wait-row-n", 15, 13), o("hosp-wait-row-n", 19, 13),
      o("hosp-wheelchair-bay", 0, 15), o("hospital-wheelchair", 2, 15), o("dept-directory-kiosk", 9, 15),
      o("mci-tactile", 12, 14), o("mci-tactile", 12, 15),
      o("hosp-wheelchair-bay", 23, 15), o("mci-plant-tall", 0, 16), o("mci-plant-tall", 25, 16),
    ] },
    // ── 1F-3. 응급실(ER) 처치실 & 구급차 반입구 (13×17) - 문진 데스크·응급 카트·가로 병상·이송 들것 + 거리 구급차(hosp-ambulance-w) 하차장
    { kind: "hosp-er", w: 13, h: 17, floor: "mci-concrete", wall: "mci-wall-hospital", items: [
      o("hosp-number-display", 1, 0), o("hosp-film-viewer", 5, 0), o("mci-wall-clock", 10, 0),
      o("hosp-vitals-bank", 0, 2), o("hospital-med-cabinet", 2, 2), o("hosp-scrub-sink", 5, 2), o("hosp-vitals-bank", 8, 2), o("hospital-med-cabinet", 10, 2),
      o("hosp-triage-desk", 1, 5), o("hosp-crash-cart", 4, 5),
      o("hosp-iv-pump", 10, 5), o("mci-hosp-bed-w", 11, 5),
      o("hosp-stretcher", 5, 7), o("hosp-curtain-track", 10, 7),
      o("hospital-bedside-monitor", 10, 9), o("mci-hosp-bed-w", 11, 9),
      o("hosp-stretcher", 5, 10),
      o("hosp-stretcher", 2, 14), o("hosp-ambulance-w", 6, 14),
      o("hosp-wheelchair-bay", 2, 16),
    ] },
  ] },

  // ── 20. 엘리베이터 내부 & 다층 승강장 홀 (24×16) - 2026-10-18 19:18 사용자 「엘리베이터 내부 이런 것도 좀 구현하면 좋을거같기도」.
  //    위 줄: 1호기 일반 승객용 엘리베이터 카 내부(전면 거울·호두나무 벽판과 핸드레일·1F~10F 층 버튼 조작반·층 표시 LED·안쪽 카 문 elev-car-door) +
  //    2호기 병원·비상용 대형 엘리베이터 카 내부(이송 들것·휠체어·거울·조작반·LED) + 비상 계단실 코어.
  //    아래 줄: 다층 엘리베이터 승강장 홀(엘리베이터 문 3기·홀 랜턴 호출 버튼·층 표시 LED·층별 안내판·대기 좌석).
  { program: "mc_elevator", map: "elevator-car", aliases: ["mc_elevator_car"], variation: {
    rows: [["elev-cabin-1", "elev-cabin-2", "elev-stair-core"], ["elev-hall"]],
    entrance: "elev-hall",
    hubs: ["elev-hall"],
    above: [["elev-cabin-1", "elev-hall"], ["elev-cabin-2", "elev-hall"], ["elev-stair-core", "elev-hall"]],
    left: [["elev-cabin-1", "elev-cabin-2"], ["elev-cabin-2", "elev-stair-core"]],
    fixed: ["elev-cabin-1", "elev-cabin-2", "elev-stair-core", "elev-hall"],
    palettes: [
      { "elev-cabin-1": ["mci-stone-lobby", "mci-wall-metal"], "elev-cabin-2": ["mci-vinyl-hospital", "mci-wall-metal"], "elev-hall": ["mci-tile-concourse", "mci-wall-lobby"] },
      { "elev-cabin-1": ["mci-wood-dark", "mci-wall-office"], "elev-cabin-2": ["mci-stone-lobby", "mci-wall-metal"], "elev-hall": ["mci-stone-lobby", "mci-wall-store"] },
    ] }, rooms: [
    { kind: "elev-cabin-1", w: 7, h: 6, floor: "mci-tile-concourse", wall: "mci-wall-metal", items: [
      o("elev-wood-panel", 0, 0), o("elev-mirror-wall", 2, 0), o("elev-button-panel", 5, 0), o("elev-floor-led", 6, 0),
      o("mci-plant-tall", 0, 2), o("home-monstera", 6, 2),
      o("mci-tactile", 3, 4),
    ] },
    { kind: "elev-cabin-2", w: 8, h: 6, floor: "mci-stone-lobby", wall: "mci-wall-metal", items: [
      o("elev-floor-led", 0, 0), o("elev-mirror-wall", 1, 0), o("elev-wood-panel", 4, 0), o("elev-button-panel", 6, 0), o("elev-hall-lantern", 7, 0),
      o("hosp-stretcher", 0, 2), o("hospital-wheelchair", 7, 2),
      o("mci-tactile", 3, 4),
    ] },
    { kind: "elev-stair-core", w: 5, h: 6, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("hosp-floor-directory", 0, 0), o("mci-wall-clock", 3, 0),
      o("mci-stairs-up", 0, 2), o("mci-stairs-down", 3, 3),
    ] },
    { kind: "elev-hall", w: 22, h: 7, floor: "mci-stone-lobby", wall: "mci-wall-lobby", items: [
      o("elev-floor-led", 2, 0), o("elev-hall-lantern", 4, 0),
      o("elev-floor-led", 8, 0), o("elev-hall-lantern", 10, 0),
      o("elev-floor-led", 13, 0), o("elev-hall-lantern", 14, 0), o("mci-wall-clock", 21, 0),
      o("mci-elevator", 0, 2), o("mci-elevator", 6, 2), o("mci-elevator", 11, 2), o("office-water-cooler", 20, 2), o("mci-plant-tall", 21, 2),
      o("mci-tactile", 3, 3),
      // 승강장 가운데 올리브나무 원형 벤치 쉼터.
      o("hosp-wait-row-s", 0, 5), o("lounge-sofa-cream", 6, 5), o("jumbo-lobby-tree-bench", 9, 4), o("dept-directory-kiosk", 14, 5), o("hosp-wait-row-s", 16, 5),
      o("mci-plant-tall", 0, 6), o("mci-plant-tall", 21, 6),
    ] },
  ] },
];

/**
 * 동네 센토(mc_sento_machi) — mc_sento 에서 위 줄(사우나·노천탕)을 뺀 골목 목욕탕. 번대 로비 → 남녀 탈의실 → 남녀 목욕 홀 두 줄.
 * 시타마치 데모 VQA r1(Argon·Sonnet): 위 줄 사우나(금속 벤치 줄)와 실내 노천탕이 «이상한 욕조 방·빈 마루방»으로 읽혔다.
 * 골목 센토는 대개 탕 홀·탈의실·번대뿐이다. 스파·온천은 mc_sento·mc_onsen 을 쓴다.
 */
function machiSento(base: Venue): Venue {
  const drop = new Set(["sento-sauna", "sento-rotenburo"]);
  const keep = (pairs: readonly (readonly [string, string])[] | undefined) => pairs?.filter(([a, b]) => !drop.has(a) && !drop.has(b));
  const v = base.variation;
  return {
    ...base, program: "mc_sento_machi", map: "sento-machi",
    variation: {
      ...v,
      rows: v.rows?.filter((row) => !row.some((k) => drop.has(k))),
      ...(v.above ? { above: keep(v.above) } : {}), ...(v.left ? { left: keep(v.left) } : {}), ...(v.sealed ? { sealed: keep(v.sealed) } : {}),
      ...(v.hubs ? { hubs: v.hubs.filter((k) => !drop.has(k)) } : {}),
    } as Venue["variation"],
    rooms: base.rooms.filter((r) => !drop.has(r.kind)),
  };
}
const VENUES: readonly Venue[] = [...BASE_VENUES, machiSento(BASE_VENUES.find((v) => v.program === "mc_sento")!)];

export const DAILY_VENUE_TEMPLATES: readonly InteriorRoomTemplate[] = VENUES.flatMap((v) =>
  v.rooms.map((r, i) => ({ ...r, id: `${v.map}:${r.kind}#${i}`, map: v.map, building: v.program, items: [...r.items] })));
export const DAILY_VENUE_PROGRAMS: Readonly<Record<string, readonly { readonly map: string; readonly kinds: readonly string[] }[]>> =
  Object.fromEntries(VENUES.flatMap((v) => [v.program, ...(v.aliases?.filter((a) => a.startsWith("mc_")) ?? [])].map((prog) => [prog, [v.map, ...(v.aliases ?? [])].map((map) => ({ map, kinds: v.rooms.map((r) => r.kind) }))])));
export const DAILY_VENUE_VARIATION: Readonly<Record<string, ModernProgramVariation>> =
  Object.fromEntries(VENUES.flatMap((v) => [v.program, ...(v.aliases?.filter((a) => a.startsWith("mc_")) ?? [])].map((prog) => [prog, v.variation])));
