// 학생 하루(10곳) · 직장인 하루(8곳) 실내 견본 - 2026-10-18 사용자 「대형마트는 시발 너무작다… 가령 대형마트는 50x50 정도로」
// 「의자가 아래 방향만 구현되어있는거냐」 「전동차 내부는 아예 다시 만들어야겠는데」.
// 방 크기는 venueScale.ts VENUE_SCALE_CONTRACT 와 맞물린다 - 위 줄·아래 줄 방 너비 합 + 칸막이 + 바깥벽 = 규격 너비, 줄 높이 합 + 칸막이 + 바깥벽 = 규격 높이.
// 탁자 둘레 의자는 seatedTable 로 네 방향(북쪽 -s · 남쪽 -n · 서쪽 -e · 동쪽 -w) 모두 탁자를 본다.
// 칸막이 문은 겹친 열(가로 칸막이)·겹친 줄(세로 칸막이)의 가운데에 뚫린다 - 그 자리 앞 칸은 비워 둔다.
import type { InteriorRoomTemplate } from "./templates";
import type { ModernProgramVariation } from "./modernPresets";
import { g, o, row, seatedTable, t, type Venue } from "./venueKit";

const VENUES: readonly Venue[] = [
  // ── 학생 1. 07:00 2층 가정집 1층 (34×26) - 위 줄 침실·아이 방·욕실·계단 홀, 아래 줄 거실·부엌(4방향 식탁)·현관.
  { program: "mc_house", map: "family-house", variation: {
    rows: [["house-bedroom", "house-kidroom", "house-bath", "house-stairhall"], ["house-living", "house-kitchen", "house-genkan"]],
    entrance: "house-genkan", hubs: ["house-living", "house-genkan", "house-stairhall"],
    above: [["house-stairhall", "house-genkan"], ["house-bedroom", "house-living"]],
    left: [["house-bedroom", "house-kidroom"], ["house-kidroom", "house-bath"], ["house-bath", "house-stairhall"], ["house-living", "house-kitchen"], ["house-kitchen", "house-genkan"]],
    palettes: [
      { "house-bedroom": ["mci-carpet-office", "mci-wall-home"], "house-kidroom": ["mci-wood-dark", "mci-wall-office"], "house-living": ["mci-wood-dark", "mci-wall-brick"], "house-kitchen": ["mci-tile-small", "mci-wall-tile"] },
      { "house-bedroom": ["mci-wood-dark", "mci-wall-brick"], "house-kidroom": ["mci-carpet-office", "mci-wall-home"], "house-living": ["mci-stone-lobby", "mci-wall-lobby"], "house-kitchen": ["mci-wood-oak", "mci-wall-home"] },
    ] }, rooms: [
    { kind: "house-bedroom", w: 10, h: 11, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("mci-window-curtain", 1, 0), o("mci-wall-clock", 5, 0), o("mci-window-curtain", 7, 0),
      o("mci-wardrobe", 0, 2), o("mci-bed-double", 3, 2), o("mci-tv-stand", 7, 2), o("mci-plant-tall", 9, 2),
      o("mci-rug", 3, 6), o("mci-armchair-e", 0, 6),
      o("mci-chair-office-s", 7, 7), o("mci-desk-pc-back", 7, 8), g("mci-g-books", 8, 8),
      o("mci-plant-tall", 0, 10),
    ] },
    { kind: "house-kidroom", w: 8, h: 11, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("mci-window-blind", 1, 0), o("mci-art-frame", 5, 0),
      o("mci-bed-single", 0, 2), o("manga-shelf", 2, 2), o("mci-wardrobe", 6, 2),
      o("mci-rug", 1, 6),
      o("mci-chair-office-s", 5, 7), o("mci-desk-pc-back", 5, 8), g("mci-g-laptop", 5, 8),
      o("mci-plant-tall", 0, 10),
    ] },
    { kind: "house-bath", w: 6, h: 11, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-washbasin", 0, 2), o("mci-washbasin", 1, 2), o("mci-toilet", 5, 2),
      o("sento-bath", 1, 6),
      o("mci-basket-stack", 5, 10),
    ] },
    { kind: "house-stairhall", w: 5, h: 11, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("mci-art-frame", 2, 0),
      o("mci-stairs-up", 2, 2),
      o("mci-plant-tall", 0, 10),
    ] },
    { kind: "house-living", w: 14, h: 12, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("mci-window-curtain", 1, 0), o("mci-tv-wall", 5, 0), o("mci-art-frame", 9, 0), o("mci-window-curtain", 11, 0),
      o("book-shelf", 0, 2), o("mci-tv-stand", 5, 2), o("mci-plant-tall", 13, 2),
      // TV 를 보는 소파(북향)와 커피 탁자를 마주한 양옆 안락의자(동향·서향).
      o("mci-coffee-table", 5, 5), o("mci-armchair-e", 4, 5), o("mci-armchair-w", 7, 5), o("mci-sofa-n", 5, 6),
      o("mci-rug", 10, 5), o("mci-planter", 11, 9),
      o("mci-plant-tall", 0, 11),
    ] },
    { kind: "house-kitchen", w: 11, h: 12, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-window-blind", 1, 0), o("mci-wall-clock", 6, 0),
      o("mci-kitchen", 0, 2), o("mci-fridge", 3, 2), o("mci-kitchen", 7, 2),
      ...seatedTable("mci-t-wood", "mci-chair-wood", 4, 6, 3, 2),
      g("mci-g-vase", 5, 6),
      o("mci-plant-tall", 10, 11),
    ] },
    { kind: "house-genkan", w: 5, h: 12, floor: "mci-stone-lobby", wall: "mci-wall-home", items: [
      o("mci-wall-clock", 3, 0),
      o("sento-shoe-locker", 0, 2),
      o("mci-plant-tall", 0, 11), o("mci-plant-tall", 4, 11),
    ] },
  ] },

  // ── 학생 2. 07:50 통학길 편의점 (30×22) - 매장(음료 냉장고 벽·도시락·커피·ATM, 진열대 세 열, 냉동고, 계산대, 잡지 평대) + 창고.
  { program: "mc_konbini_jp", map: "konbini-24h", variation: {
    rows: [["konbini-floor", "konbini-backroom"]],
    entrance: "konbini-floor", left: [["konbini-floor", "konbini-backroom"]], hubs: ["konbini-floor"], palettes: [
      { "konbini-floor": ["mci-tile-small", "mci-wall-tile"], "konbini-backroom": ["mci-concrete", "mci-wall-metal"] },
      { "konbini-floor": ["mci-vinyl-hospital", "mci-wall-office"], "konbini-backroom": ["mci-wood-oak", "mci-wall-brick"] },
    ] }, rooms: [
    { kind: "konbini-floor", w: 20, h: 20, floor: "mci-vinyl-store", wall: "mci-wall-store", items: [
      o("mci-ac-wall", 1, 0), o("mci-menu-board", 11, 0), o("mci-notice-board", 15, 0), o("mci-window-city", 17, 0),
      ...row("mci-cooler", 0, 2, 5, 2), o("konbini-bento", 10, 2), o("konbini-bento", 13, 2), o("mci-coffee-station", 16, 2), o("konbini-atm", 18, 2),
      // 진열대 세 열(곤돌라 넷 + 엔드캡) - 사이 통로 두 줄.
      ...row("mci-gondola", 1, 2, 4, 5), o("mart-promo-endcap", 9, 5),
      ...row("mci-gondola", 1, 2, 4, 8), o("mart-promo-endcap", 9, 8),
      ...row("mci-gondola", 1, 2, 4, 11), o("mart-promo-endcap", 9, 11),
      o("mci-freezer", 17, 5), o("mci-freezer", 17, 7), o("mci-freezer", 17, 9),
      o("mci-pastry-case", 12, 14), o("konbini-counter", 14, 14), o("mci-counter-register", 17, 14), g("mci-g-register", 18, 14),
      o("book-table", 1, 15), o("book-table", 5, 15),
      o("subway-trash-bins", 1, 19), o("mci-basket-stack", 16, 19), o("mci-plant-tall", 19, 19),
    ] },
    { kind: "konbini-backroom", w: 7, h: 20, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-wall-clock", 3, 0),
      o("mci-rack", 0, 2), o("mci-rack", 4, 2),
      o("mci-pallet", 1, 5), o("mci-pallet", 2, 5), o("mci-pallet", 5, 5),
      o("mci-freezer", 4, 13), o("mci-chair-office-s", 1, 14), o("mci-desk-pc-back", 1, 15),
      o("mci-pallet", 1, 18), o("mci-pallet", 5, 18),
    ] },
  ] },

  // ── 학생 3. 08:10 지하철역 (46×32) - 북쪽 승강장(선로·스크린도어 벽에서 벽까지), 남쪽 대합실(개찰구 차단선)·역무실·역내 편의점.
  { program: "mc_station", map: "subway-station", aliases: ["concourse"], variation: {
    rows: [["subway-platform"], ["subway-office", "subway-concourse", "subway-kiosk"]],
    entrance: "subway-concourse",
    above: [["subway-platform", "subway-concourse"], ["subway-platform", "subway-office"], ["subway-platform", "subway-kiosk"]],
    left: [["subway-office", "subway-concourse"], ["subway-concourse", "subway-kiosk"]],
    hubs: ["subway-concourse", "subway-platform"], fixed: ["subway-platform", "subway-concourse"], palettes: [
      { "subway-concourse": ["mci-stone-lobby", "mci-wall-lobby"], "subway-kiosk": ["mci-tile-small", "mci-wall-tile"], "subway-office": ["mci-carpet-office", "mci-wall-office"], "subway-platform": ["mci-concrete", "mci-wall-metal"] },
      { "subway-concourse": ["mci-concrete", "mci-wall-tile"], "subway-kiosk": ["mci-wood-oak", "mci-wall-home"], "subway-office": ["mci-vinyl-store", "mci-wall-store"], "subway-platform": ["mci-tile-concourse", "mci-wall-brick"] },
    ] }, rooms: [
    { kind: "subway-platform", w: 44, h: 13, floor: "mci-tile-concourse", wall: "mci-wall-tile", items: [
      o("mci-route-map", 2, 0), o("train-led", 8, 0), o("mci-notice-board", 13, 0), o("mci-tv-wall", 16, 0), o("mci-wall-clock", 21, 0),
      o("mci-route-map", 24, 0), o("mci-tv-wall", 28, 0), o("train-led", 34, 0), o("mci-route-map", 40, 0),
      // 선로(벽에서 벽까지) + 스크린도어 줄(문·벽 번갈아) + 문 앞 점자 블록.
      ...row("subway-track-pit", 0, 4, 11, 2),
      ...Array.from({ length: 22 }, (_, i) => o(i % 2 ? "subway-psd-door" : "subway-psd-wall", i * 2, 4)),
      ...Array.from({ length: 11 }, (_, i) => o("mci-tactile", i * 4 + 2, 5)), ...Array.from({ length: 11 }, (_, i) => o("mci-tactile", i * 4 + 3, 5)),
      o("subway-pillar-sign", 5, 8), o("mci-bench-metal", 7, 8), o("subway-trash-bins", 11, 8), o("subway-pillar-sign", 15, 8), o("mci-bench-metal", 17, 8),
      o("subway-pillar-sign", 27, 8), o("mci-bench-metal", 29, 8), o("subway-trash-bins", 33, 8), o("subway-pillar-sign", 37, 8), o("mci-bench-metal", 39, 8),
      o("mci-plant-tall", 0, 12), o("mci-plant-tall", 43, 12),
    ] },
    { kind: "subway-office", w: 7, h: 16, floor: "mci-carpet-office", wall: "mci-wall-office", items: [
      o("mci-whiteboard", 1, 0), o("mci-wall-clock", 5, 0),
      o("mci-filing", 0, 2), o("mci-shelf-office", 4, 2),
      o("mci-chair-office-s", 1, 5), o("mci-desk-pc-back", 1, 6), o("mci-chair-office-s", 4, 5), o("mci-desk-pc-back", 4, 6),
      o("mci-desk-pc", 1, 10), o("mci-chair-office-s", 1, 11), o("mci-desk-pc", 4, 10), o("mci-chair-office-s", 4, 11),
      o("mci-plant-tall", 0, 15), o("mci-filing", 4, 15),
    ] },
    { kind: "subway-concourse", w: 28, h: 16, floor: "mci-tile-concourse", wall: "mci-wall-tile", items: [
      o("mci-route-map", 1, 0), o("mci-notice-board", 5, 0), o("mci-wall-clock", 8, 0), o("mci-tv-wall", 18, 0), o("mci-route-map", 23, 0),
      o("subway-ticket-machine", 0, 2), o("subway-ticket-machine", 2, 2), o("subway-ticket-machine", 4, 2), o("dept-directory-kiosk", 6, 2),
      o("subway-vending-machine", 20, 2), o("subway-vending-machine", 22, 2), o("mci-plant-tall", 27, 2),
      // 개찰구 차단선 - 벽에서 벽까지 끊김 없이(개찰구 여섯 + 역무원 창구 + 화분·차단줄).
      o("museum-velvet-rope", 0, 6), o("mci-ticket-gate", 3, 6), o("mci-ticket-gate", 6, 6), o("mci-ticket-gate", 9, 6),
      o("mci-ticket-gate", 12, 6), o("mci-ticket-gate", 15, 6), o("mci-ticket-gate", 18, 6), o("mci-teller", 21, 6), o("mci-planter", 24, 6), o("mci-plant-tall", 26, 6), o("mci-plant-tall", 27, 6),
      o("mci-tactile", 13, 7), o("mci-tactile", 13, 8), o("mci-tactile", 13, 9),
      o("subway-pillar-sign", 4, 10), o("mci-bench-metal", 6, 10), o("subway-pillar-sign", 22, 10), o("mci-bench-metal", 19, 10),
      o("mci-wait-bench", 2, 13), o("subway-trash-bins", 8, 14), o("subway-trash-bins", 18, 14), o("mci-wait-bench", 22, 13),
    ] },
    { kind: "subway-kiosk", w: 7, h: 16, floor: "mci-vinyl-store", wall: "mci-wall-store", items: [
      o("mci-menu-board", 1, 0), o("mci-menu-board", 4, 0),
      o("mart-cold-case", 0, 2), o("mart-cold-case", 2, 2), o("mci-coffee-station", 5, 2),
      o("mci-gondola", 1, 5), o("mci-gondola", 4, 5), o("mci-gondola", 1, 11), o("mci-gondola", 4, 11),
      o("mci-counter-register", 2, 13), g("mci-g-register", 3, 13),
      o("mci-basket-stack", 0, 15), o("mci-plant-tall", 6, 15),
    ] },
  ] },

  // ── 학생 4. 08:20 전동차 내부 (40×12) - 운전실 + 객차 둘. 북쪽 창·양문형 출입문(위 노선 LED)·남향 롱시트, 남쪽 출입문(노란 안전 매트)·북향 롱시트,
  //    가운데 통로에 손잡이 줄 두 줄과 수직 봉. 세 칸이 벽에서 벽까지 이어진다 - 변주에도 넓히지 않는다.
  { program: "mc_train_car", map: "train-car", variation: {
    rows: [["train-cab", "train-car", "train-car-2"]],
    entrance: "train-car", left: [["train-cab", "train-car"], ["train-car", "train-car-2"]], hubs: ["train-car", "train-car-2"],
    fixed: ["train-cab", "train-car", "train-car-2"], palettes: [
      { "train-car": ["mci-concrete", "mci-wall-office"], "train-car-2": ["mci-concrete", "mci-wall-office"], "train-cab": ["mci-concrete", "mci-wall-metal"] },
      { "train-car": ["mci-tile-concourse", "mci-wall-store"], "train-car-2": ["mci-tile-concourse", "mci-wall-store"], "train-cab": ["mci-tile-concourse", "mci-wall-office"] },
    ] }, rooms: [
    { kind: "train-cab", w: 6, h: 10, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-window-city", 0, 0), o("train-led", 3, 0),
      o("mci-shelf-office", 3, 2),
      o("train-cab-console", 0, 4), o("mci-chair-office-w", 2, 5),
      o("mci-tactile", 4, 9), o("mci-tactile", 5, 9),
    ] },
    ...(["train-car", "train-car-2"] as const).map((kind) => ({ kind, w: 15, h: 10, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("train-door", 1, 0), o("mci-window-city", 4, 0), o("train-led", 6, 0), o("mci-window-city", 8, 0), o("train-door", 12, 0),
      o("mci-tactile", 1, 2), o("mci-tactile", 2, 2), o("train-longseat", 3, 2), o("train-longseat", 6, 2), o("train-longseat", 9, 2), o("mci-tactile", 12, 2), o("mci-tactile", 13, 2),
      ...row("train-straps", 1, 2, 7, 4), ...row("train-straps", 1, 2, 7, 7),
      o("train-pole", 3, 5), o("train-pole", 11, 6),
      o("train-door-s", 1, 9), o("train-longseat-n", 3, 9), o("train-longseat-n", 6, 9), o("train-longseat-n", 9, 9), o("train-door-s", 12, 9),
    ] })),
  ] },

  // ── 학생 5. 09:00 학교 교사동 (46×34) - 위 줄 교실 둘·계단실, 가운데 복도, 아래 줄 현관(신발장)·교무실·보건실·매점.
  { program: "mc_school_building", map: "school-building", variation: {
    rows: [["school-class", "school-class-2", "school-stairwell"], ["school-corridor"], ["school-genkan", "school-staffroom", "school-infirmary", "school-store"]],
    entrance: "school-genkan", hubs: ["school-corridor", "school-genkan"],
    above: [["school-class", "school-corridor"], ["school-class-2", "school-corridor"], ["school-stairwell", "school-corridor"], ["school-corridor", "school-genkan"], ["school-corridor", "school-staffroom"]],
    left: [["school-class", "school-class-2"], ["school-class-2", "school-stairwell"], ["school-genkan", "school-staffroom"], ["school-staffroom", "school-infirmary"], ["school-infirmary", "school-store"]],
    fixed: ["school-corridor"], palettes: [
      { "school-class": ["mci-wood-dark", "mci-wall-home"], "school-class-2": ["mci-wood-dark", "mci-wall-home"], "school-corridor": ["mci-tile-concourse", "mci-wall-lobby"], "school-staffroom": ["mci-wood-oak", "mci-wall-office"] },
      { "school-class": ["mci-vinyl-store", "mci-wall-lobby"], "school-class-2": ["mci-vinyl-store", "mci-wall-lobby"], "school-corridor": ["mci-stone-lobby", "mci-wall-office"], "school-staffroom": ["mci-carpet-office", "mci-wall-home"] },
    ] }, rooms: [
    ...(["school-class", "school-class-2"] as const).map((kind, k) => ({ kind, w: 16, h: 13, floor: "mci-wood-oak", wall: "mci-wall-office", items: [
      o("mci-window-curtain", 0, 0), o("mci-whiteboard", 5, 0), o("mci-whiteboard", 7, 0), o("mci-wall-clock", 10, 0), o("mci-window-curtain", 13, 0),
      o("mci-shelf-office", 0, 2), o(k ? "mci-plant-tall" : "council-trophy-case", 14, 2),
      o("lecture-podium", 7, 3), t("mci-t-wood", 10, 3, 2, 1), o("mci-chair-wood-n", 10, 4), g("mci-g-books", 10, 3),
      // 학생 책상 5열 × 3줄 - 의자는 책상 남쪽에서 칠판(북쪽)을 본다.
      ...[5, 8, 11].flatMap((y) => [1, 4, 7, 10, 13].flatMap((x) => [t("mci-t-wood", x, y, 2, 1), o("mci-chair-wood-n", x, y + 1), o("mci-chair-wood-n", x + 1, y + 1)])),
    ] })),
    { kind: "school-stairwell", w: 10, h: 13, floor: "mci-tile-concourse", wall: "mci-wall-lobby", items: [
      o("mci-notice-board", 1, 0), o("mci-art-frame", 7, 0),
      o("council-trophy-case", 0, 2), o("stairs-up-wall-stone", 3, 2), o("subway-vending-machine", 8, 2),
      o("mci-wait-bench", 1, 7), o("mci-plant-tall", 0, 12), o("mci-plant-tall", 9, 12),
    ] },
    { kind: "school-corridor", w: 44, h: 5, floor: "mci-tile-concourse", wall: "mci-wall-lobby", items: [
      o("mci-notice-board", 3, 0), o("mci-window-city", 17, 0), o("mci-notice-board", 25, 0), o("mci-wall-clock", 30, 0), o("mci-window-city", 39, 0),
      o("mci-plant-tall", 0, 2), o("hospital-water-dispenser", 16, 2), o("hospital-water-dispenser", 32, 2), o("mci-plant-tall", 43, 2),
    ] },
    { kind: "school-genkan", w: 12, h: 12, floor: "mci-stone-lobby", wall: "mci-wall-lobby", items: [
      o("mci-notice-board", 1, 0), o("mci-wall-clock", 9, 0),
      ...row("sento-shoe-locker", 0, 2, 2, 2), ...row("sento-shoe-locker", 8, 2, 2, 2),
      ...row("sento-shoe-locker", 1, 2, 2, 7), ...row("sento-shoe-locker", 7, 2, 2, 7),
      o("mci-plant-tall", 0, 11), o("mci-plant-tall", 11, 11),
    ] },
    { kind: "school-staffroom", w: 12, h: 12, floor: "mci-wood-oak", wall: "mci-wall-office", items: [
      o("mci-whiteboard", 1, 0), o("mci-wall-clock", 8, 0), o("mci-window-blind", 10, 0),
      o("mci-filing", 0, 2), o("mci-shelf-office", 2, 2), o("mci-coffee-station", 8, 2), o("mci-plant-tall", 11, 2),
      // 마주 보는 교사 책상 - 북쪽 의자는 남향, 남쪽 의자는 북향.
      ...[1, 4, 8].flatMap((x) => [o("mci-chair-office-s", x, 5), o("mci-desk-pc-back", x, 6), o("mci-desk-pc", x, 7), o("mci-chair-office-n", x, 8)]),
      o("mci-filing", 0, 11), o("mci-plant-tall", 11, 11),
    ] },
    { kind: "school-infirmary", w: 9, h: 12, floor: "mci-vinyl-hospital", wall: "mci-wall-hospital", items: [
      o("mci-window-curtain", 1, 0), o("infirmary-eye-chart", 6, 0),
      o("hospital-med-cabinet", 0, 2), o("mci-washbasin", 3, 2), o("hospital-water-dispenser", 7, 2),
      o("mci-hosp-bed", 0, 6), o("hospital-curtain-screen", 1, 6), o("mci-hosp-bed", 2, 6),
      o("mci-chair-office-s", 6, 5), o("hospital-doctor-desk", 6, 6),
      o("mci-med-cart", 0, 11), o("infirmary-scale", 8, 11),
    ] },
    { kind: "school-store", w: 8, h: 12, floor: "mci-vinyl-store", wall: "mci-wall-store", items: [
      o("mci-menu-board", 1, 0), o("mci-menu-board", 5, 0),
      o("mart-cold-case", 0, 2), o("konbini-bento", 5, 2),
      o("mci-gondola", 0, 6), o("mci-gondola", 6, 6),
      o("konbini-counter", 0, 9), o("mci-counter-register", 5, 9), g("mci-g-register", 6, 9),
      o("mci-basket-stack", 7, 11),
    ] },
  ] },

  // ── 학생 6. 13:00 대학 강의동 (42×30) - 계단식 대강의실(교탁·스크린, 가운데 통로를 둔 책상 네 줄)·과학 실험실, 아래 줄 로비·준비실.
  { program: "mc_lecture_hall", map: "uni-lecture-hall", variation: {
    rows: [["uni-lecture", "sci-lab"], ["uni-foyer", "lab-prep"]],
    entrance: "uni-foyer", hubs: ["uni-foyer"],
    above: [["uni-lecture", "uni-foyer"], ["sci-lab", "lab-prep"]], left: [["uni-lecture", "sci-lab"], ["uni-foyer", "lab-prep"]],
    palettes: [
      { "uni-lecture": ["mci-wood-oak", "mci-wall-home"], "uni-foyer": ["mci-tile-concourse", "mci-wall-lobby"], "sci-lab": ["mci-vinyl-hospital", "mci-wall-office"] },
      { "uni-lecture": ["mci-wood-dark", "mci-wall-brick"], "uni-foyer": ["mci-stone-lobby", "mci-wall-office"], "sci-lab": ["mci-tile-small", "mci-wall-tile"] },
    ] }, rooms: [
    { kind: "uni-lecture", w: 26, h: 16, floor: "mci-carpet-office", wall: "mci-wall-office", items: [
      o("mci-window-curtain", 1, 0), o("mci-whiteboard", 6, 0), o("projector-screen", 11, 0), o("mci-whiteboard", 17, 0), o("mci-wall-clock", 21, 0), o("mci-window-curtain", 23, 0),
      o("mci-plant-tall", 0, 2), o("mci-filing", 2, 2), o("mci-shelf-office", 21, 2), o("mci-plant-tall", 25, 2),
      o("lecture-podium", 12, 3), o("mci-desk-pc", 14, 3), g("mci-g-laptop", 14, 3),
      // 계단식 객석 - 책상 줄 바닥을 한 줄씩 바꿔 단을 보이고, 의자는 책상 남쪽에서 강단(북쪽)을 본다.
      ...[5, 8, 11, 14].flatMap((y) => [2, 6, 15, 19].flatMap((x) => [o("lecture-desk-row", x, y), ...row("mci-chair-wood-n", x, 1, 4, y + 1)])),
    ] },
    { kind: "sci-lab", w: 13, h: 16, floor: "mci-vinyl-hospital", wall: "mci-wall-office", items: [
      o("mci-whiteboard", 1, 0), o("mci-window-blind", 5, 0), o("mci-wall-clock", 9, 0), o("mci-window-blind", 10, 0),
      o("lab-fume-hood", 0, 2), o("lab-reagent-shelf", 2, 2), o("mci-washbasin", 5, 2), o("lab-reagent-shelf", 8, 2), o("lab-fume-hood", 11, 2),
      // 실험대 둘레 의자 - 북쪽 남향, 남쪽 북향.
      ...[5, 10].flatMap((y) => [1, 9].flatMap((x) => [...row("mci-chair-wood-s", x, 1, 3, y - 1), o("lab-bench", x, y), ...row("mci-chair-wood-n", x, 1, 3, y + 1)])),
      o("mci-plant-tall", 0, 15), o("subway-trash-bins", 11, 15),
    ] },
    { kind: "uni-foyer", w: 26, h: 11, floor: "mci-tile-concourse", wall: "mci-wall-lobby", items: [
      o("mci-notice-board", 1, 0), o("mci-notice-board", 3, 0), o("mci-art-frame", 15, 0), o("mci-wall-clock", 20, 0),
      o("subway-vending-machine", 0, 2), o("subway-vending-machine", 2, 2), o("hospital-water-dispenser", 4, 2),
      o("council-trophy-case", 17, 2), o("mci-coffee-station", 20, 2), o("mci-plant-tall", 25, 2),
      ...seatedTable("mci-t-wood", "mci-chair-wood", 3, 6, 2, 1), ...seatedTable("mci-t-wood", "mci-chair-wood", 18, 6, 2, 1),
      o("lounge-sofa-cream", 8, 9), o("lounge-sofa-cream", 15, 9),
      o("mci-plant-tall", 0, 10), o("subway-trash-bins", 23, 10),
    ] },
    { kind: "lab-prep", w: 13, h: 11, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-wall-clock", 6, 0),
      o("lab-reagent-shelf", 0, 2), o("mci-rack", 2, 2), o("lab-reagent-shelf", 8, 2), o("mci-washbasin", 12, 2),
      o("lab-bench", 1, 6), o("mci-chair-wood-n", 2, 7), o("mci-med-cart", 9, 6),
      o("mci-pallet", 0, 10), o("mci-pallet", 12, 10),
    ] },
  ] },

  // ── 학생 7. 15:30 실내 종합 체육관 (46×34) - 동서 양끝 마주 보는 골대 둘·제한구역·센터 서클, 북쪽 계단식 관람석 두 단,
  //    남쪽 본부석(점수 기록 탁자)·팀 벤치, 아래 줄 남녀 라커룸·로비·기구 창고.
  { program: "mc_gym", map: "gymnasium", variation: {
    rows: [["gym-court"], ["gym-locker-m", "gym-locker-w", "gym-lobby", "gym-storage"]],
    entrance: "gym-lobby", hubs: ["gym-court", "gym-lobby"],
    above: [["gym-court", "gym-lobby"]], left: [["gym-locker-m", "gym-locker-w"], ["gym-locker-w", "gym-lobby"], ["gym-lobby", "gym-storage"]],
    fixed: ["gym-court"], palettes: [
      { "gym-court": ["mci-wood-dark", "mci-wall-brick"], "gym-locker-m": ["mci-tile-small", "mci-wall-tile"], "gym-locker-w": ["mci-tile-small", "mci-wall-tile"], "gym-lobby": ["mci-stone-lobby", "mci-wall-lobby"] },
      { "gym-court": ["mci-wood-oak", "mci-wall-metal"], "gym-locker-m": ["mci-concrete", "mci-wall-metal"], "gym-locker-w": ["mci-vinyl-hospital", "mci-wall-office"], "gym-lobby": ["mci-tile-concourse", "mci-wall-office"] },
    ] }, rooms: [
    { kind: "gym-court", w: 44, h: 21, floor: "mci-wood-oak", wall: "mci-wall-office", items: [
      o("mci-window-city", 2, 0), o("mci-window-city", 8, 0), o("mci-window-city", 14, 0), o("gym-scoreboard", 21, 0), o("mci-window-city", 28, 0), o("mci-window-city", 34, 0), o("mci-window-city", 40, 0),
      ...row("gym-bleacher", 6, 4, 8, 2), ...row("gym-bleacher", 6, 4, 8, 4),
      o("gym-hoop-e", 0, 11), o("gym-court-key-w", 2, 9),
      o("gym-center-circle", 20, 10),
      o("gym-hoop-w", 42, 11), o("gym-court-key-e", 38, 9),
      ...row("mci-bench-metal", 7, 3, 3, 17), ...row("mci-bench-metal", 31, 3, 3, 17),
      o("studio-news-desk", 18, 17), ...row("mci-chair-office-n", 18, 1, 4, 18),
      o("mci-basket-stack", 0, 19), o("mci-basket-stack", 43, 19),
    ] },
    ...(["gym-locker-m", "gym-locker-w"] as const).map((kind) => ({ kind, w: 10, h: 10, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o(kind === "gym-locker-m" ? "sento-noren-men" : "sento-noren-women", 1, 0), o("mci-wall-clock", 7, 0),
      ...row("sento-shoe-locker", 0, 2, 2, 2), ...row("sento-shoe-locker", 6, 2, 2, 2),
      o("mci-bench-metal", 1, 5), o("mci-bench-metal", 7, 5),
      o("sento-wash-station", 0, 9), o("mci-washbasin", 9, 9),
    ] })),
    { kind: "gym-lobby", w: 13, h: 10, floor: "mci-stone-lobby", wall: "mci-wall-lobby", items: [
      o("mci-notice-board", 1, 0), o("mci-art-frame", 9, 0),
      o("council-trophy-case", 0, 2), o("council-trophy-case", 2, 2), o("subway-vending-machine", 9, 2), o("hospital-water-dispenser", 11, 2),
      o("mci-reception", 1, 6), o("mci-wait-bench", 9, 6),
      o("mci-plant-tall", 0, 9), o("mci-plant-tall", 12, 9),
    ] },
    { kind: "gym-storage", w: 8, h: 10, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-rack", 0, 2), o("mci-rack", 5, 2),
      o("gym-mat", 1, 5), o("gym-mat", 5, 5), o("gym-vault", 1, 8), o("mci-basket-stack", 5, 8), o("mci-basket-stack", 6, 8),
    ] },
  ] },

  // ── 학생 8. 16:30 학생회실 & 밴드 동아리방 (36×26) - 아래 줄 학생회실(ㄷ자 회의 탁자 + 네 방향 의자)·비품실, 위 줄 밴드실·녹음 부스.
  { program: "mc_council_room", map: "council-room", variation: {
    rows: [["band-room", "band-booth"], ["council-room", "council-storage"]],
    entrance: "council-room", hubs: ["council-room", "band-room"],
    above: [["band-room", "council-room"], ["band-booth", "council-storage"]], left: [["band-room", "band-booth"], ["council-room", "council-storage"]],
    palettes: [
      { "council-room": ["mci-carpet-office", "mci-wall-lobby"], "band-room": ["mci-wood-dark", "mci-wall-brick"] },
      { "council-room": ["mci-wood-dark", "mci-wall-home"], "band-room": ["mci-concrete", "mci-wall-metal"] },
    ] }, rooms: [
    { kind: "band-room", w: 20, h: 12, floor: "mci-wood-oak", wall: "mci-wall-brick", items: [
      o("music-acoustic-panel", 1, 0), o("music-acoustic-panel", 5, 0), o("mci-wall-clock", 9, 0), o("music-acoustic-panel", 12, 0), o("music-acoustic-panel", 16, 0),
      o("music-amp", 0, 2), o("music-amp", 1, 2), o("mci-shelf-office", 15, 2), o("music-amp", 19, 2),
      o("music-guitar-stand", 4, 4), o("music-drum-kit", 8, 4), o("music-guitar-stand", 13, 4), o("music-guitar-stand", 15, 4),
      ...row("mci-chair-wood-n", 6, 1, 7, 8), o("mci-sofa-n", 1, 10), o("mci-sofa-n", 16, 10),
    ] },
    { kind: "band-booth", w: 13, h: 12, floor: "mci-carpet-office", wall: "mci-wall-office", items: [
      o("music-acoustic-panel", 1, 0), o("music-acoustic-panel", 5, 0), o("music-acoustic-panel", 9, 0),
      o("music-amp", 0, 2), o("mci-shelf-office", 3, 2), o("music-amp", 12, 2),
      o("mci-chair-office-s", 3, 5), o("mci-chair-office-s", 4, 5), o("mci-desk-pc-back", 3, 6), g("mci-g-laptop", 4, 6),
      o("music-guitar-stand", 9, 5), o("mci-armchair-n", 9, 9), o("mci-armchair-n", 11, 9),
    ] },
    { kind: "council-room", w: 20, h: 11, floor: "mci-carpet-office", wall: "mci-wall-lobby", items: [
      o("mci-whiteboard", 1, 0), o("mci-notice-board", 5, 0), o("mci-wall-clock", 8, 0), o("mci-window-curtain", 12, 0), o("mci-window-curtain", 16, 0),
      o("council-trophy-case", 0, 2), o("council-trophy-case", 2, 2), o("mci-filing", 16, 2), o("mci-plant-tall", 19, 2),
      // ㄷ자 회의 탁자(윗변 + 양 다리, 남쪽이 트였다) - 바깥 북쪽 의자 남향, 서쪽 의자 동향, 동쪽 의자 서향, 안쪽 의자는 마주 보는 변을 본다.
      t("mci-t-meeting", 5, 5, 10, 1), t("mci-t-meeting", 5, 6, 1, 3), t("mci-t-meeting", 14, 6, 1, 3),
      ...row("mci-chair-office-s", 5, 1, 10, 4),
      ...[5, 6, 7, 8].map((y) => o("mci-chair-office-e", 4, y)), ...[5, 6, 7, 8].map((y) => o("mci-chair-office-w", 15, y)),
      ...row("mci-chair-office-n", 7, 1, 6, 6),
      o("mci-chair-office-w", 6, 7), o("mci-chair-office-w", 6, 8), o("mci-chair-office-e", 13, 7), o("mci-chair-office-e", 13, 8),
      o("mci-chair-office-n", 5, 9), o("mci-chair-office-n", 14, 9),
      g("mci-g-papers", 7, 5), g("mci-g-laptop", 10, 5), g("mci-g-coffee", 12, 5),
      o("mci-plant-tall", 0, 10),
    ] },
    { kind: "council-storage", w: 13, h: 11, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-wall-clock", 6, 0),
      o("mci-rack", 0, 2), o("mci-filing", 3, 2), o("mci-rack", 9, 2),
      o("mci-pallet", 1, 6), o("mci-pallet", 2, 6), o("mci-pallet", 10, 6), o("gym-mat", 9, 9), o("mci-basket-stack", 1, 10),
    ] },
  ] },

  // ── 학생 9. 17:30 학교 옥상 (36×24) - 위 줄 탑옥(계단 오두막) 기계실·옥상 정원, 아래 줄 펜스로 둘러친 데크(급수탑·벤치·자판기).
  { program: "mc_rooftop", map: "rooftop", variation: {
    rows: [["roof-machine", "roof-garden"], ["rooftop-deck"]],
    entrance: "rooftop-deck", hubs: ["rooftop-deck"],
    above: [["roof-machine", "rooftop-deck"], ["roof-garden", "rooftop-deck"]], left: [["roof-machine", "roof-garden"]],
    palettes: [
      { "rooftop-deck": ["mci-tile-concourse", "mci-wall-metal"], "roof-garden": ["mci-wood-oak", "mci-wall-brick"] },
      { "rooftop-deck": ["mci-stone-lobby", "mci-wall-brick"], "roof-garden": ["mci-wood-dark", "mci-wall-metal"] },
    ] }, rooms: [
    { kind: "roof-machine", w: 16, h: 9, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-ac-wall", 1, 0), o("mci-ac-wall", 11, 0),
      o("roof-stair-hut", 0, 2), o("mci-rack", 12, 2),
      o("roof-water-tank", 5, 4), o("roof-water-tank", 9, 4), o("mci-pallet", 14, 7),
    ] },
    { kind: "roof-garden", w: 17, h: 9, floor: "mci-wood-oak", wall: "mci-wall-brick", items: [
      ...row("mci-planter", 0, 2, 3, 2), ...row("mci-planter", 11, 2, 3, 2),
      o("mci-plant-tall", 2, 5), o("museum-gallery-bench", 4, 5), o("museum-gallery-bench", 11, 5), o("mci-plant-tall", 14, 5),
      o("mci-plant-tall", 0, 8), o("mci-plant-tall", 16, 8),
    ] },
    { kind: "rooftop-deck", w: 34, h: 12, floor: "mci-tile-concourse", wall: "mci-wall-metal", items: [
      ...row("roof-fence", 0, 2, 3, 2), ...row("roof-fence", 28, 2, 3, 2),
      o("subway-vending-machine", 7, 2), o("subway-vending-machine", 25, 2),
      o("mci-bench-metal", 4, 6), o("mci-bench-metal", 9, 6), o("roof-water-tank", 15, 6), o("mci-bench-metal", 23, 6), o("mci-bench-metal", 28, 6),
      ...row("roof-fence", 0, 2, 7, 11), ...row("roof-fence", 20, 2, 7, 11),
    ] },
  ] },

  // ── 학생 10. 18:30 게임센터·노래방 & 만화카페 (40×28) - 위 줄 인형뽑기 존·노래방·서점, 아래 줄 아케이드 홀·만화카페.
  { program: "mc_game_center", map: "game-center", variation: {
    rows: [["game-crane", "karaoke-room", "book-floor"], ["game-floor", "manga-cafe"]],
    entrance: "game-floor", hubs: ["game-floor", "book-floor"],
    above: [["game-crane", "game-floor"], ["karaoke-room", "game-floor"], ["book-floor", "manga-cafe"]],
    left: [["game-crane", "karaoke-room"], ["karaoke-room", "book-floor"], ["game-floor", "manga-cafe"]],
    palettes: [
      { "game-floor": ["mci-carpet-office", "mci-wall-metal"], "game-crane": ["mci-vinyl-store", "mci-wall-store"], "manga-cafe": ["mci-wood-dark", "mci-wall-home"] },
      { "game-floor": ["mci-concrete", "mci-wall-brick"], "game-crane": ["mci-tile-small", "mci-wall-tile"], "manga-cafe": ["mci-wood-oak", "mci-wall-brick"] },
    ] }, rooms: [
    { kind: "game-crane", w: 12, h: 12, floor: "mci-vinyl-store", wall: "mci-wall-store", items: [
      o("cinema-poster", 1, 0), o("mci-wall-clock", 6, 0), o("cinema-poster", 9, 0),
      o("arcade-claw-machine", 0, 2), o("arcade-claw-machine", 2, 2), o("arcade-purikura", 8, 2), o("arcade-purikura", 10, 2),
      o("arcade-prize-counter", 1, 7), o("arcade-medal-changer", 9, 2), o("mci-basket-stack", 11, 11),
      o("dept-directory-kiosk", 0, 11),
    ] },
    { kind: "karaoke-room", w: 12, h: 12, floor: "mci-carpet-office", wall: "mci-wall-brick", items: [
      o("karaoke-monitor", 5, 0), o("mci-art-frame", 1, 0), o("mci-art-frame", 9, 0),
      o("music-amp", 0, 2), o("mci-tv-stand", 5, 2), o("music-amp", 11, 2),
      o("karaoke-table", 5, 6), o("karaoke-sofa", 4, 8), o("mci-armchair-e", 4, 6), o("mci-armchair-w", 7, 6),
      o("mci-plant-tall", 0, 11), o("mci-plant-tall", 11, 11),
    ] },
    { kind: "book-floor", w: 12, h: 12, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("mci-window-curtain", 1, 0), o("mci-art-frame", 8, 0),
      o("book-shelf", 0, 2), o("book-shelf", 2, 2), o("manga-shelf", 8, 2), o("manga-shelf", 10, 2),
      o("book-table", 1, 6), o("book-table", 8, 6), o("library-shelf", 1, 9), o("library-shelf", 8, 9),
      o("mci-counter-register", 4, 11), g("mci-g-register", 5, 11),
    ] },
    { kind: "game-floor", w: 24, h: 13, floor: "mci-carpet-office", wall: "mci-wall-metal", items: [
      o("cinema-poster", 1, 0), o("mci-tv-wall", 8, 0), o("cinema-poster", 14, 0), o("mci-tv-wall", 19, 0),
      o("arcade-rhythm", 0, 2), o("arcade-rhythm", 2, 2), o("arcade-rhythm", 20, 2), o("arcade-rhythm", 22, 2),
      ...row("arcade-cabinet-pair", 1, 3, 3, 6), ...row("arcade-racing-cabinet", 14, 3, 3, 6),
      o("arcade-medal-changer", 0, 11), o("mci-plant-tall", 1, 12), o("subway-vending-machine", 20, 9), o("mci-plant-tall", 23, 12),
    ] },
    { kind: "manga-cafe", w: 13, h: 13, floor: "mci-wood-dark", wall: "mci-wall-home", items: [
      o("mci-menu-board", 1, 0), o("mci-wall-clock", 6, 0), o("mci-menu-board", 9, 0),
      o("manga-shelf", 0, 2), o("manga-shelf", 2, 2), o("mci-coffee-station", 9, 2), o("manga-shelf", 11, 2),
      o("manga-booth", 1, 6), o("manga-booth", 4, 6), o("manga-booth", 9, 6),
      ...seatedTable("mci-t-wood", "mci-chair-wood", 4, 10, 2, 1, { n: true, s: true, w: true }),
      o("mci-plant-tall", 12, 12),
    ] },
  ] },

  // ── 직장인 1. 07:30 원룸·오피스텔 (32×24) - 위 줄 욕실·드레스룸·원룸 침실, 아래 줄 엘리베이터 홀·키친 거실(4방향 식탁).
  { program: "mc_officetel", map: "officetel", variation: {
    rows: [["otel-bath", "otel-dressing", "otel-room"], ["otel-elevator", "otel-kitchen"]],
    entrance: "otel-elevator", hubs: ["otel-elevator", "otel-kitchen"],
    above: [["otel-bath", "otel-elevator"], ["otel-room", "otel-kitchen"]], left: [["otel-bath", "otel-dressing"], ["otel-dressing", "otel-room"], ["otel-elevator", "otel-kitchen"]],
    palettes: [
      { "otel-room": ["mci-wood-dark", "mci-wall-brick"], "otel-kitchen": ["mci-tile-small", "mci-wall-tile"], "otel-elevator": ["mci-stone-lobby", "mci-wall-store"] },
      { "otel-room": ["mci-carpet-office", "mci-wall-office"], "otel-kitchen": ["mci-wood-oak", "mci-wall-home"], "otel-elevator": ["mci-tile-concourse", "mci-wall-lobby"] },
    ] }, rooms: [
    { kind: "otel-bath", w: 7, h: 10, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-washbasin", 0, 2), o("mci-toilet", 6, 2), o("sento-bath", 1, 6),
    ] },
    { kind: "otel-dressing", w: 7, h: 10, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("mci-art-frame", 2, 0),
      o("mci-wardrobe", 0, 2), o("mci-wardrobe", 5, 2), o("dept-clothing-rack", 0, 6), o("dept-mannequin-podium", 5, 6), o("dept-bag-stand", 6, 9),
    ] },
    { kind: "otel-room", w: 14, h: 10, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("mci-window-curtain", 1, 0), o("mci-tv-wall", 6, 0), o("mci-window-curtain", 11, 0),
      o("mci-bed-double", 0, 2), o("mci-tv-stand", 6, 2), o("mci-plant-tall", 13, 2),
      o("mci-rug", 5, 5), o("mci-armchair-e", 4, 6), o("mci-chair-office-s", 11, 6), o("mci-desk-pc-back", 11, 7),
      o("mci-planter", 0, 9),
    ] },
    { kind: "otel-elevator", w: 12, h: 11, floor: "mci-stone-lobby", wall: "mci-wall-store", items: [
      o("mci-wall-clock", 5, 0),
      o("mci-elevator", 1, 2), o("mci-mailboxes", 8, 2), o("mci-plant-tall", 11, 2),
      o("mci-wait-bench", 1, 7), o("sento-shoe-locker", 9, 7),
      o("mci-plant-tall", 0, 10),
    ] },
    { kind: "otel-kitchen", w: 17, h: 11, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-window-blind", 6, 0), o("mci-menu-board", 12, 0),
      o("mci-kitchen", 0, 2), o("mci-fridge", 3, 2), o("mci-coffee-station", 12, 2), o("mci-plant-tall", 16, 2),
      ...seatedTable("mci-t-wood", "mci-chair-wood", 6, 6, 2, 2),
      o("mci-sofa-n", 12, 8), o("mci-coffee-table", 12, 6),
      o("mci-plant-tall", 16, 10),
    ] },
  ] },

  // ── 직장인 2. 08:30 베이커리 카페 (32×22) - 위 줄 제빵실·에스프레소 바, 아래 줄 4방향 카페 좌석 홀.
  { program: "mc_bakery_cafe", map: "bakery-cafe", variation: {
    rows: [["bakery-kitchen", "espresso-bar"], ["cafe-hall"]],
    entrance: "cafe-hall", hubs: ["cafe-hall"], above: [["bakery-kitchen", "cafe-hall"], ["espresso-bar", "cafe-hall"]], left: [["bakery-kitchen", "espresso-bar"]],
    palettes: [
      { "cafe-hall": ["mci-wood-dark", "mci-wall-brick"], "espresso-bar": ["mci-stone-lobby", "mci-wall-lobby"], "bakery-kitchen": ["mci-tile-small", "mci-wall-tile"] },
      { "cafe-hall": ["mci-stone-lobby", "mci-wall-home"], "espresso-bar": ["mci-wood-oak", "mci-wall-brick"], "bakery-kitchen": ["mci-concrete", "mci-wall-metal"] },
    ] }, rooms: [
    { kind: "bakery-kitchen", w: 14, h: 8, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-wall-clock", 6, 0),
      o("mci-kitchen", 0, 2), o("mci-kitchen", 3, 2), o("mci-rack", 8, 2), o("mci-fridge", 13, 2),
      o("mart-bakery-counter", 1, 5), o("mart-bakery-counter", 9, 5), o("mci-pallet", 13, 7),
    ] },
    { kind: "espresso-bar", w: 15, h: 8, floor: "mci-wood-oak", wall: "mci-wall-brick", items: [
      o("mci-menu-board", 1, 0), o("mci-menu-board", 5, 0), o("mci-menu-board", 11, 0),
      o("mci-coffee-station", 0, 2), o("mci-coffee-station", 2, 2), o("mci-fridge", 11, 2),
      o("mci-pastry-case", 1, 5), o("cafe-parfait-case", 3, 5), o("mci-counter-register", 11, 5), g("mci-g-register", 12, 5),
    ] },
    { kind: "cafe-hall", w: 30, h: 11, floor: "mci-wood-dark", wall: "mci-wall-brick", items: [
      o("mci-window-curtain", 1, 0), o("mci-art-frame", 5, 0), o("mci-window-curtain", 9, 0), o("mci-window-curtain", 19, 0), o("mci-art-frame", 23, 0), o("mci-window-curtain", 27, 0),
      o("mci-plant-tall", 0, 2), o("mci-plant-tall", 29, 2),
      ...[1, 11, 18, 25].flatMap((x) => seatedTable("mci-t-wood", "mci-chair-wood", x + 1, 4, 2, 1)),
      ...[1, 11, 18, 25].flatMap((x) => seatedTable("mci-t-wood", "mci-chair-wood", x + 1, 8, 2, 1)),
      o("mci-planter", 7, 9), o("mci-plant-tall", 0, 10),
    ] },
  ] },

  // ── 직장인 3. 09:00 대형 오피스 층 (46×32) - 위 줄 열린 업무홀(마주 보는 책상 섬)·대회의실(4방향 의자), 아래 줄 리셉션 로비·임원실·탕비 라운지.
  { program: "mc_office", map: "office-floor", variation: {
    rows: [["open-office", "meeting"], ["lobby", "exec", "pantry"]],
    entrance: "lobby", hubs: ["open-office", "lobby"],
    above: [["open-office", "lobby"], ["meeting", "pantry"]], left: [["open-office", "meeting"], ["lobby", "exec"], ["exec", "pantry"]],
    palettes: [
      { "open-office": ["mci-wood-oak", "mci-wall-home"], meeting: ["mci-carpet-office", "mci-wall-lobby"], pantry: ["mci-tile-small", "mci-wall-tile"], lobby: ["mci-tile-concourse", "mci-wall-office"] },
      { "open-office": ["mci-concrete", "mci-wall-brick"], meeting: ["mci-wood-dark", "mci-wall-brick"], pantry: ["mci-wood-oak", "mci-wall-brick"], lobby: ["mci-concrete", "mci-wall-metal"] },
    ] }, rooms: [
    { kind: "open-office", w: 27, h: 15, floor: "mci-carpet-office", wall: "mci-wall-office", items: [
      o("mci-window-city", 1, 0), o("mci-window-city", 5, 0), o("mci-whiteboard", 9, 0), o("mci-wall-clock", 13, 0), o("mci-window-city", 17, 0), o("mci-window-city", 21, 0), o("mci-ac-wall", 24, 0),
      o("mci-plant-tall", 0, 2), o("mci-shelf-office", 2, 2), o("mci-filing", 4, 2), o("mci-filing", 20, 2), o("mci-shelf-office", 22, 2), o("mci-plant-tall", 26, 2),
      // 마주 보는 책상 섬 3열 × 2줄 - 북쪽 자리 남향, 남쪽 자리 북향.
      ...[4, 9].flatMap((y) => [2, 8, 16].flatMap((x) => [
        o("mci-chair-office-s", x, y), o("mci-chair-office-s", x + 2, y),
        o("mci-desk-pc-back", x, y + 1), o("mci-desk-pc-back", x + 2, y + 1), o("mci-desk-pc", x, y + 2), o("mci-desk-pc", x + 2, y + 2),
        o("mci-chair-office-n", x, y + 3), o("mci-chair-office-n", x + 2, y + 3),
      ])),
      o("mci-planter", 22, 6), o("mci-planter", 22, 11), o("mci-plant-tall", 0, 14),
    ] },
    { kind: "meeting", w: 16, h: 15, floor: "mci-carpet-office", wall: "mci-wall-lobby", items: [
      o("mci-whiteboard", 2, 0), o("mci-tv-wall", 7, 0), o("mci-window-blind", 12, 0),
      o("mci-plant-tall", 0, 2), o("mci-coffee-station", 13, 2),
      ...seatedTable("mci-t-meeting", "mci-chair-office", 4, 6, 8, 3),
      g("mci-g-laptop", 5, 6), g("mci-g-papers", 8, 7), g("mci-g-coffee", 10, 8),
      o("mci-plant-tall", 0, 14), o("mci-plant-tall", 15, 14),
    ] },
    { kind: "lobby", w: 16, h: 14, floor: "mci-stone-lobby", wall: "mci-wall-lobby", items: [
      o("mci-art-frame", 1, 0), o("mci-wall-clock", 6, 0), o("mci-art-frame", 11, 0),
      o("mci-elevator", 0, 2), o("mci-mailboxes", 12, 2), o("mci-plant-tall", 15, 2),
      o("mci-reception", 3, 6), g("mci-g-laptop", 4, 6), o("mci-chair-office-n", 4, 7),
      o("mci-security-gate", 10, 6), o("mci-security-gate", 12, 6),
      o("mci-sofa-e", 0, 9), o("mci-coffee-table", 2, 10), o("mci-armchair-w", 4, 10),
      o("mci-plant-tall", 15, 13),
    ] },
    { kind: "exec", w: 12, h: 14, floor: "mci-wood-dark", wall: "mci-wall-home", items: [
      o("mci-window-curtain", 1, 0), o("mci-art-frame", 5, 0), o("mci-window-curtain", 9, 0),
      o("mci-shelf-office", 0, 2), o("mci-filing", 2, 2), o("mci-plant-tall", 11, 2),
      o("mci-chair-office-s", 5, 4), o("mci-desk-pc-back", 5, 5), o("mci-armchair-n", 5, 7), o("mci-armchair-n", 6, 7),
      // 응접 탁자 - 서쪽 소파(동향)·북쪽 안락의자(남향 바탕 mci-armchair)·남쪽 안락의자(북향)·동쪽 안락의자(서향).
      o("mci-sofa-e", 2, 9), t("mci-t-wood", 3, 10, 2, 1), o("mci-armchair", 3, 9), o("mci-armchair", 4, 9),
      o("mci-armchair-n", 3, 11), o("mci-armchair-n", 4, 11), o("mci-armchair-w", 5, 10),
      o("mci-plant-tall", 11, 13),
    ] },
    { kind: "pantry", w: 14, h: 14, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-menu-board", 1, 0), o("mci-wall-clock", 9, 0),
      o("mci-kitchen", 0, 2), o("mci-fridge", 3, 2), o("mci-coffee-station", 9, 2), o("subway-vending-machine", 12, 2),
      ...seatedTable("mci-t-wood", "mci-chair-wood", 2, 7, 2, 1), ...seatedTable("mci-t-wood", "mci-chair-wood", 9, 7, 2, 1),
      ...seatedTable("mci-t-wood", "mci-chair-wood", 2, 11, 2, 1), ...seatedTable("mci-t-wood", "mci-chair-wood", 9, 11, 2, 1),
    ] },
  ] },

  // ── 직장인 4. 12:30 레스토랑 & 다이닝 바 (38×28) - 위 줄 오픈 키친·바 라운지·피아노 무대, 아래 줄 4방향 식탁 홀(부스석·호스트석).
  { program: "mc_restaurant", map: "restaurant-bar", variation: {
    rows: [["rest-kitchen-bar", "rest-bar-lounge", "rest-live-stage"], ["rest-dining-hall"]],
    entrance: "rest-dining-hall", hubs: ["rest-dining-hall"],
    above: [["rest-kitchen-bar", "rest-dining-hall"], ["rest-bar-lounge", "rest-dining-hall"], ["rest-live-stage", "rest-dining-hall"]],
    left: [["rest-kitchen-bar", "rest-bar-lounge"], ["rest-bar-lounge", "rest-live-stage"]],
    palettes: [
      { "rest-kitchen-bar": ["mci-tile-small", "mci-wall-tile"], "rest-live-stage": ["mci-carpet-office", "mci-wall-lobby"], "rest-dining-hall": ["mci-stone-lobby", "mci-wall-lobby"], "rest-bar-lounge": ["mci-wood-dark", "mci-wall-brick"] },
      { "rest-kitchen-bar": ["mci-concrete", "mci-wall-metal"], "rest-live-stage": ["mci-wood-oak", "mci-wall-home"], "rest-dining-hall": ["mci-wood-dark", "mci-wall-home"], "rest-bar-lounge": ["mci-carpet-office", "mci-wall-lobby"] },
    ] }, rooms: [
    { kind: "rest-kitchen-bar", w: 14, h: 11, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-menu-board", 1, 0), o("mci-wall-clock", 6, 0), o("mci-ac-wall", 10, 0),
      o("mci-kitchen", 0, 2), o("mci-kitchen", 3, 2), o("mci-fridge", 6, 2), o("mci-kitchen", 8, 2), o("mci-rack", 11, 2),
      o("rest-omakase-counter", 1, 6), o("rest-omakase-counter", 4, 6), o("rest-omakase-counter", 8, 6),
      ...row("mci-bar-stool", 1, 1, 6, 7), ...row("mci-bar-stool", 8, 1, 3, 7),
      o("mci-plant-tall", 13, 10),
    ] },
    { kind: "rest-bar-lounge", w: 10, h: 11, floor: "mci-wood-dark", wall: "mci-wall-brick", items: [
      o("mci-art-frame", 1, 0), o("mci-wall-clock", 7, 0),
      // 술병 선반(rest-bottle-shelf)은 색색 책등처럼 읽혀 도서관 책장으로 보였다(2026-10-18 9차 VQA) - 와인 랙 셋, 계산대 대신 바 카운터 둘.
      o("rest-wine-rack", 0, 2), o("rest-wine-rack", 3, 2), o("rest-wine-rack", 8, 2),
      o("izakaya-counter", 1, 5), o("izakaya-counter", 4, 5), ...row("mci-bar-stool", 1, 1, 6, 6),
      o("mci-armchair-e", 1, 9), o("mci-coffee-table", 2, 9), o("mci-armchair-w", 4, 9), o("mci-plant-tall", 9, 10),
    ] },
    { kind: "rest-live-stage", w: 10, h: 11, floor: "mci-carpet-office", wall: "mci-wall-lobby", items: [
      o("mci-window-curtain", 1, 0), o("mci-art-frame", 4, 0), o("mci-window-curtain", 7, 0),
      o("music-amp", 0, 2), o("restaurant-piano-stage", 3, 2), o("music-amp", 9, 2),
      o("music-guitar-stand", 1, 6), ...row("mci-chair-wood-n", 3, 1, 4, 8),
      o("mci-plant-tall", 0, 10), o("mci-plant-tall", 9, 10),
    ] },
    { kind: "rest-dining-hall", w: 36, h: 14, floor: "mci-stone-lobby", wall: "mci-wall-lobby", items: [
      o("mci-window-curtain", 1, 0), o("mci-art-frame", 8, 0), o("mci-window-curtain", 14, 0), o("mci-art-frame", 20, 0), o("mci-window-curtain", 26, 0), o("mci-art-frame", 32, 0),
      o("rest-coat-stand", 0, 2), o("mci-plant-tall", 35, 2),
      // 4인 식탁 - 북쪽 의자 남향, 남쪽 의자 북향, 서쪽 의자 동향, 동쪽 의자 서향.
      ...[2, 9, 22, 29].flatMap((x) => seatedTable("mci-t-wood", "mci-chair-wood", x + 1, 5, 2, 2)),
      ...[2, 9, 22, 29].flatMap((x) => seatedTable("mci-t-wood", "mci-chair-wood", x + 1, 10, 2, 2)),
      o("restaurant-booth-set", 15, 5), o("restaurant-booth-set", 18, 5), o("restaurant-booth-set", 15, 9), o("restaurant-booth-set", 18, 9),
      o("restaurant-host-podium", 17, 12), o("mci-planter", 0, 13), o("mci-planter", 34, 13),
    ] },
  ] },

  // ── 직장인 5. 19:00 퇴근 후 이자카야·라멘 (36×26) - 위 줄 주방·다다미 룸 둘, 아래 줄 다찌 카운터 홀(4방향 식탁).
  { program: "mc_izakaya", map: "izakaya", variation: {
    rows: [["izakaya-kitchen", "izakaya-tatami", "izakaya-tatami"], ["izakaya-hall"]],
    entrance: "izakaya-hall", hubs: ["izakaya-hall"],
    above: [["izakaya-kitchen", "izakaya-hall"], ["izakaya-tatami", "izakaya-hall"]], left: [["izakaya-kitchen", "izakaya-tatami"]],
    palettes: [
      { "izakaya-hall": ["mci-wood-dark", "mci-wall-brick"], "izakaya-kitchen": ["mci-tile-small", "mci-wall-tile"] },
      { "izakaya-hall": ["mci-wood-oak", "mci-wall-home"], "izakaya-kitchen": ["mci-concrete", "mci-wall-metal"] },
    ] }, rooms: [
    { kind: "izakaya-kitchen", w: 14, h: 10, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-menu-board", 1, 0), o("izakaya-lantern", 6, 0), o("mci-wall-clock", 10, 0),
      o("mci-kitchen", 0, 2), o("mci-kitchen", 3, 2), o("izakaya-beer-server", 6, 2), o("mci-fridge", 7, 2), o("mci-rack", 11, 2),
      o("izakaya-counter", 1, 6), o("izakaya-counter", 9, 6), o("mci-pallet", 13, 9),
    ] },
    ...[0, 1].map(() => ({ kind: "izakaya-tatami", w: 9, h: 10, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("izakaya-noren", 1, 0), o("mci-art-frame", 5, 0),
      o("mci-planter", 0, 2), o("mci-plant-tall", 8, 2),
      o("izakaya-zashiki", 1, 5), o("izakaya-zashiki", 5, 5),
      o("izakaya-lantern", 7, 0),
    ] })),
    { kind: "izakaya-hall", w: 34, h: 13, floor: "mci-wood-dark", wall: "mci-wall-brick", items: [
      o("izakaya-lantern", 1, 0), o("mci-menu-board", 4, 0), o("izakaya-lantern", 10, 0), o("izakaya-noren", 14, 0), o("izakaya-lantern", 20, 0), o("mci-menu-board", 25, 0), o("izakaya-lantern", 31, 0),
      o("izakaya-beer-server", 0, 2), o("mci-plant-tall", 33, 2),
      // 다찌 카운터와 등받이 없는 의자 줄(카운터 남쪽).
      o("izakaya-counter", 2, 5), o("izakaya-counter", 5, 5), o("izakaya-counter", 8, 5), ...row("mci-bar-stool", 2, 1, 9, 6),
      ...[20, 27].flatMap((x) => seatedTable("mci-t-wood", "mci-chair-wood", x, 5, 2, 2)),
      ...[3, 10, 20, 27].flatMap((x) => seatedTable("mci-t-wood", "mci-chair-wood", x, 10, 2, 1)),
      o("mci-planter", 15, 8),
      o("subway-trash-bins", 0, 12), o("mci-plant-tall", 33, 12),
    ] },
  ] },

  // ── 직장인 6. 20:00 하이퍼마켓 (50×46) - 위 줄 청과·정육수산·물류창고, 가운데 곤돌라 12열 매장(유제품·냉동 벽), 아래 줄 계산대 8레인 홀(카트 베이·고객안내)·푸드코트.
  { program: "mc_supermarket", map: "supermarket-mart", variation: {
    rows: [["mart-produce", "mart-butcher", "mart-storage"], ["mart-sales-hall"], ["mart-checkout", "mart-foodcourt"]],
    entrance: "mart-checkout", hubs: ["mart-sales-hall", "mart-checkout"],
    above: [["mart-produce", "mart-sales-hall"], ["mart-butcher", "mart-sales-hall"], ["mart-storage", "mart-sales-hall"], ["mart-sales-hall", "mart-checkout"], ["mart-sales-hall", "mart-foodcourt"]],
    left: [["mart-produce", "mart-butcher"], ["mart-butcher", "mart-storage"], ["mart-checkout", "mart-foodcourt"]],
    fixed: ["mart-sales-hall"], palettes: [
      { "mart-sales-hall": ["mci-tile-concourse", "mci-wall-tile"], "mart-produce": ["mci-wood-oak", "mci-wall-brick"], "mart-checkout": ["mci-stone-lobby", "mci-wall-lobby"], "mart-foodcourt": ["mci-wood-dark", "mci-wall-home"] },
      { "mart-sales-hall": ["mci-stone-lobby", "mci-wall-lobby"], "mart-produce": ["mci-tile-small", "mci-wall-tile"], "mart-checkout": ["mci-tile-concourse", "mci-wall-store"], "mart-foodcourt": ["mci-carpet-office", "mci-wall-brick"] },
    ] }, rooms: [
    { kind: "mart-produce", w: 18, h: 12, floor: "mci-wood-oak", wall: "mci-wall-brick", items: [
      o("mci-menu-board", 1, 0), o("mci-notice-board", 6, 0), o("mci-menu-board", 13, 0),
      o("mart-cold-case", 0, 2), o("mart-cold-case", 2, 2), o("mart-cold-case", 4, 2), o("mart-cold-case", 12, 2), o("mart-cold-case", 14, 2), o("mart-cold-case", 16, 2),
      ...row("mart-produce-island", 1, 4, 2, 5), ...row("mart-produce-island", 11, 4, 2, 5),
      ...row("mart-produce-island", 1, 4, 2, 8), ...row("mart-produce-island", 11, 4, 2, 8),
      o("mci-basket-stack", 0, 11), o("mci-basket-stack", 17, 11),
    ] },
    { kind: "mart-butcher", w: 16, h: 12, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-menu-board", 1, 0), o("mci-wall-clock", 7, 0), o("mci-menu-board", 12, 0),
      o("mart-meat-case", 0, 2), o("mart-meat-case", 2, 2), o("mart-meat-case", 4, 2), o("mart-meat-case", 10, 2), o("mart-meat-case", 12, 2), o("mart-meat-case", 14, 2),
      o("mci-freezer", 1, 6), o("mci-freezer", 4, 6), o("mci-freezer", 10, 6), o("mci-freezer", 13, 6),
      o("mart-promo-endcap", 1, 9), o("mart-promo-endcap", 14, 9), o("mci-basket-stack", 0, 11),
    ] },
    { kind: "mart-storage", w: 12, h: 12, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-wall-clock", 5, 0),
      o("mci-rack", 0, 2), o("mci-rack", 9, 2),
      o("mci-pallet", 1, 6), o("mci-pallet", 2, 6), o("mci-pallet", 9, 6), o("mci-pallet", 10, 6),
      o("mci-pallet", 10, 10),
    ] },
    { kind: "mart-sales-hall", w: 48, h: 18, floor: "mci-tile-concourse", wall: "mci-wall-tile", items: [
      o("mci-notice-board", 2, 0), o("mci-tv-wall", 12, 0), o("mci-wall-clock", 24, 0), o("mci-tv-wall", 36, 0), o("mci-notice-board", 44, 0),
      // 유제품·음료 냉장 벽(서쪽)과 냉동 벽(동쪽) - 위 방 문 앞(x 9·27·41 언저리)은 비운다.
      ...row("mci-cooler", 0, 2, 3, 2), ...row("mart-cold-case", 12, 2, 6, 2), ...row("mci-cooler", 31, 2, 4, 2),
      // 곤돌라 12열: 서쪽 블록 6열 · 가운데 주 통로 · 동쪽 블록 6열, 열마다 남쪽 끝 엔드캡.
      ...[1, 4, 7, 10, 13, 16].flatMap((x) => [...[6, 7, 8, 9, 10, 11].filter((_, i) => i % 2 === 0).map((y) => o("mci-gondola", x, y)), o("mart-promo-endcap", x, 12)]),
      ...[28, 31, 34, 37, 40, 43].flatMap((x) => [...[6, 8, 10].map((y) => o("mci-gondola", x, y)), o("mart-promo-endcap", x, 12)]),
      o("mart-produce-island", 21, 7), o("mart-produce-island", 21, 11),
      ...row("mci-freezer", 2, 3, 6, 15), ...row("mci-freezer", 28, 3, 6, 15),
      o("mci-plant-tall", 0, 17), o("mci-plant-tall", 47, 17),
    ] },
    { kind: "mart-checkout", w: 31, h: 12, floor: "mci-stone-lobby", wall: "mci-wall-lobby", items: [
      o("mci-notice-board", 1, 0), o("mci-tv-wall", 8, 0), o("mci-wall-clock", 20, 0), o("mci-tv-wall", 26, 0),
      // 계산대 8레인(계산대 + 레인) - 레인 사이 한 칸 통로.
      ...[1, 4, 7, 10, 18, 21, 24, 27].flatMap((x) => [o("mart-checkout-lane", x, 4)]),
      o("mci-reception", 13, 4),
      o("mci-wait-bench", 1, 9), o("mci-basket-stack", 5, 9), o("mci-basket-stack", 6, 9), o("dept-directory-kiosk", 9, 9),
      o("mci-basket-stack", 21, 9), o("mci-basket-stack", 22, 9), o("mci-wait-bench", 26, 9),
      o("mci-plant-tall", 0, 11), o("mci-plant-tall", 30, 11),
    ] },
    { kind: "mart-foodcourt", w: 16, h: 12, floor: "mci-wood-dark", wall: "mci-wall-home", items: [
      o("mci-menu-board", 1, 0), o("mci-menu-board", 5, 0), o("mci-menu-board", 11, 0),
      o("mart-bakery-counter", 0, 2), o("mci-pastry-case", 2, 2), o("mci-coffee-station", 11, 2), o("mci-kitchen", 13, 2),
      ...seatedTable("mci-t-wood", "mci-chair-wood", 2, 6, 2, 1), ...seatedTable("mci-t-wood", "mci-chair-wood", 11, 6, 2, 1),
      ...seatedTable("mci-t-wood", "mci-chair-wood", 2, 9, 2, 1), ...seatedTable("mci-t-wood", "mci-chair-wood", 11, 9, 2, 1),
    ] },
  ] },

  // ── 직장인 8. 22:00 센토·스파 (40×30) - 위 줄 사우나·노천탕, 가운데 목욕 홀(씻는 자리 열·대온탕·열탕·냉탕), 아래 줄 카운터 탈의실.
  { program: "mc_sento", map: "sento", variation: {
    rows: [["sento-sauna", "sento-rotenburo"], ["sento-bathhall"], ["sento-changing"]],
    entrance: "sento-changing", hubs: ["sento-changing", "sento-bathhall"],
    above: [["sento-sauna", "sento-bathhall"], ["sento-rotenburo", "sento-bathhall"], ["sento-bathhall", "sento-changing"]], left: [["sento-sauna", "sento-rotenburo"]],
    fixed: ["sento-bathhall"], palettes: [
      { "sento-bathhall": ["mci-tile-small", "mci-wall-tile"], "sento-changing": ["mci-wood-oak", "mci-wall-home"], "sento-rotenburo": ["mci-stone-lobby", "mci-wall-brick"] },
      { "sento-bathhall": ["mci-stone-lobby", "mci-wall-tile"], "sento-changing": ["mci-wood-dark", "mci-wall-brick"], "sento-rotenburo": ["mci-wood-dark", "mci-wall-brick"] },
    ] }, rooms: [
    { kind: "sento-sauna", w: 17, h: 8, floor: "mci-wood-dark", wall: "mci-wall-brick", items: [
      o("mci-wall-clock", 8, 0),
      o("mci-bench-metal", 0, 2), o("mci-bench-metal", 3, 2), o("mci-bench-metal", 12, 2), o("mci-bench-metal", 15, 2),
      o("mci-bench-metal", 1, 5), o("mci-bench-metal", 14, 5),
    ] },
    { kind: "sento-rotenburo", w: 20, h: 8, floor: "mci-stone-lobby", wall: "mci-wall-brick", items: [
      o("shrine-shimenawa", 8, 0),
      o("mci-planter", 0, 2), o("mci-planter", 18, 2), o("shrine-stone-lantern", 3, 3), o("shrine-stone-lantern", 16, 3),
      o("sento-bath", 4, 4), o("sento-bath", 12, 4), o("mci-plant-tall", 0, 7), o("mci-plant-tall", 19, 7),
    ] },
    { kind: "sento-bathhall", w: 38, h: 11, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("sento-fuji-mural", 4, 0), o("sento-fuji-mural", 13, 0), o("sento-fuji-mural", 23, 0), o("sento-fuji-mural", 32, 0),
      ...row("sento-wash-station", 0, 2, 4, 2), ...row("sento-wash-station", 22, 2, 8, 2),
      o("sento-bath", 2, 5), o("sento-bath", 8, 5), o("sento-bath", 22, 5), o("sento-bath", 28, 5),
      o("mci-bench-metal", 15, 9), o("mci-basket-stack", 0, 10), o("mci-basket-stack", 37, 10),
    ] },
    { kind: "sento-changing", w: 38, h: 7, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("sento-noren-men", 2, 0), o("mci-wall-clock", 12, 0), o("sento-noren-women", 26, 0), o("mci-tv-wall", 33, 0),
      ...row("sento-shoe-locker", 0, 2, 4, 2), o("mci-fridge", 10, 2), o("mci-washbasin", 11, 2), ...row("sento-shoe-locker", 24, 2, 5, 2), o("mci-fridge", 35, 2),
      o("mci-counter-register", 13, 5), o("mci-wait-bench", 3, 5), o("infirmary-scale", 9, 5), o("mci-wait-bench", 27, 5), o("mci-plant-tall", 37, 6),
    ] },
  ] },
];

export const DAILY_VENUE_TEMPLATES: readonly InteriorRoomTemplate[] = VENUES.flatMap((v) =>
  v.rooms.map((r, i) => ({ ...r, id: `${v.map}:${r.kind}#${i}`, map: v.map, building: v.program, items: [...r.items] })));
export const DAILY_VENUE_PROGRAMS: Readonly<Record<string, readonly { readonly map: string; readonly kinds: readonly string[] }[]>> =
  Object.fromEntries(VENUES.map((v) => [v.program, [v.map, ...(v.aliases ?? [])].map((map) => ({ map, kinds: v.rooms.map((r) => r.kind) }))]));
export const DAILY_VENUE_VARIATION: Readonly<Record<string, ModernProgramVariation>> = Object.fromEntries(VENUES.map((v) => [v.program, v.variation]));
