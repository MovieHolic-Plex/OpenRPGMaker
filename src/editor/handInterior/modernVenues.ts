// 현대 도시(modern_city) 실내 확장 — 2026-10-18 사용자 "더 다양한 공간과 더 다양한 오브젝트… 일본에 뭐가 있나?".
// 백화점·마트·지하철역·병원·영화관·레스토랑·미술관(modernPresets.ts)과 학생·직장인 하루 18곳(dailyVenues.ts)에 더해
// 강당·노래방·서점·신사·파출소·실험실·음악실·보건실·메이드 카페·호텔·방송국·법정·지하 주차장·중앙도서관.
// 가구 id 는 modernCityRoomSpec.json 을 쓴다.
// 견본 좌표: 0~1 줄은 벽면(hang 은 y 0), 2 줄부터 바닥(wall 가구는 y 2). seed 변주는 MODERN_VENUE_VARIATION(바닥·벽면 묶음).
import type { InteriorRoomTemplate } from "./templates";
import type { ModernProgramVariation } from "./modernPresets";
import { g, o, row, type Venue } from "./venueKit";

const VENUES: readonly Venue[] = [
  // 6. 대강당 + 로비 — 붉은 막 무대와 연단, 무대 옆 그랜드 피아노·앰프, 가운데 통로를 둔 객석 네 줄, 남쪽 로비(포스터·매표·물품 보관).
  { program: "mc_auditorium", map: "auditorium", variation: {
    rows: [["aud-hall", "void:6"], ["aud-foyer"]], entrance: "aud-foyer", above: [["aud-hall", "aud-foyer"]], hubs: ["aud-foyer"], palettes: [
    { "aud-hall": ["mci-wood-dark", "mci-wall-home"], "aud-foyer": ["mci-stone-lobby", "mci-wall-store"] },
    { "aud-hall": ["mci-stone-lobby", "mci-wall-lobby"], "aud-foyer": ["mci-wood-oak", "mci-wall-brick"] },
  ] }, rooms: [
    { kind: "aud-hall", w: 28, h: 16, floor: "mci-carpet-office", wall: "mci-wall-brick", items: [
      o("mci-window-curtain", 1, 0), o("mci-window-curtain", 5, 0), o("mci-window-curtain", 21, 0), o("mci-window-curtain", 25, 0),
      o("restaurant-piano-stage", 2, 2), o("music-amp", 7, 2), o("mci-plant-tall", 9, 2), o("aud-stage", 11, 2), o("mci-plant-tall", 18, 2), o("music-amp", 20, 2),
      o("aud-lectern", 18, 5), o("mci-planter", 23, 3),
      ...row("aud-seat-row", 2, 3, 3, 7), ...row("aud-seat-row", 16, 3, 3, 7),
      ...row("aud-seat-row", 2, 3, 3, 9), ...row("aud-seat-row", 16, 3, 3, 9),
      ...row("aud-seat-row", 2, 3, 3, 11), ...row("aud-seat-row", 16, 3, 3, 11),
      ...row("aud-seat-row", 2, 3, 3, 13), ...row("aud-seat-row", 16, 3, 3, 13),
    ] },
    { kind: "aud-foyer", w: 28, h: 6, floor: "mci-stone-lobby", wall: "mci-wall-store", items: [
      o("cinema-poster", 1, 0), o("cinema-poster", 5, 0), o("mci-wall-clock", 9, 0), o("cinema-poster", 20, 0), o("cinema-poster", 24, 0),
      o("dept-directory-kiosk", 0, 2), o("subway-vending-machine", 2, 2), o("mci-coffee-station", 4, 2), o("rest-coat-stand", 7, 2), o("rest-coat-stand", 8, 2),
      o("cinema-concession", 17, 3), o("subway-vending-machine", 22, 2), o("subway-vending-machine", 24, 2), o("mci-plant-tall", 27, 2),
      o("lounge-sofa-cream", 3, 4), o("lounge-sofa-cream", 5, 4), o("mci-wait-bench", 20, 5), o("mci-plant-tall", 0, 5),
    ] },
  ] },
  // 16. 노래방 — 복도 위로 노래방 세 칸(코너 소파·탁자·벽걸이 모니터·스피커), 남쪽 복도(안내 데스크·드링크 바·대기 소파).
  { program: "mc_karaoke", map: "karaoke-box", variation: {
    rows: [["karaoke-room", "karaoke-room", "karaoke-room", "void:7"], ["karaoke-hall"]], entrance: "karaoke-hall", above: [["karaoke-room", "karaoke-hall"]], palettes: [
    { "karaoke-room": ["mci-wood-dark", "mci-wall-store"], "karaoke-hall": ["mci-stone-lobby", "mci-wall-lobby"] },
    { "karaoke-room": ["mci-vinyl-store", "mci-wall-metal"], "karaoke-hall": ["mci-concrete", "mci-wall-brick"] },
  ] }, rooms: [
    { kind: "karaoke-room", w: 9, h: 8, floor: "mci-carpet-office", wall: "mci-wall-brick", items: [
      o("karaoke-monitor", 3, 0), o("mci-ac-wall", 6, 0),
      o("music-amp", 0, 2), o("music-amp", 8, 2),
      o("karaoke-sofa", 0, 4), o("karaoke-table", 4, 4), o("karaoke-sofa", 6, 4),
    ] },
    { kind: "karaoke-room", w: 9, h: 8, floor: "mci-carpet-office", wall: "mci-wall-brick", items: [
      o("mci-ac-wall", 0, 0), o("karaoke-monitor", 4, 0),
      o("music-amp", 2, 2), o("music-amp", 7, 2),
      o("karaoke-sofa", 0, 4), o("karaoke-table", 4, 5), o("karaoke-sofa", 6, 4),
    ] },
    { kind: "karaoke-room", w: 9, h: 8, floor: "mci-carpet-office", wall: "mci-wall-brick", items: [
      o("karaoke-monitor", 3, 0), o("mci-art-frame", 6, 0),
      o("music-amp", 0, 2), o("music-amp", 8, 2),
      o("karaoke-sofa", 3, 5), o("karaoke-table", 4, 4), o("mci-armchair", 1, 4),
    ] },
    { kind: "karaoke-hall", w: 29, h: 7, floor: "mci-tile-concourse", wall: "mci-wall-lobby", items: [
      o("cinema-poster", 1, 0), o("mci-menu-board", 8, 0), o("cinema-poster", 18, 0), o("mci-wall-clock", 27, 0),
      o("subway-vending-machine", 0, 2), o("mci-coffee-station", 7, 2), o("subway-vending-machine", 9, 2), o("mci-cooler", 17, 2), o("mci-plant-tall", 28, 2),
      o("mci-reception", 2, 5), o("lounge-sofa-cream", 19, 5), o("lounge-sofa-cream", 21, 5), o("mci-coffee-table", 23, 5),
    ] },
  ] },
  // 17. 대형 서점 + 만화카페 — 북쪽 벽 서가, 신간 평대 셋, 높은 서가 세 줄, 열람석, 계산대 / 동쪽 만화카페(만화 서가·개인 부스 여섯·드링크).
  { program: "mc_bookstore", map: "bookstore-manga", variation: {
    rows: [["book-floor", "manga-cafe"]],
    trim: { "manga-cafe": 7 }, entrance: "book-floor", left: [["book-floor", "manga-cafe"]], hubs: ["book-floor"], palettes: [
    { "book-floor": ["mci-carpet-office", "mci-wall-home"], "manga-cafe": ["mci-wood-dark", "mci-wall-brick"] },
    { "book-floor": ["mci-wood-dark", "mci-wall-brick"], "manga-cafe": ["mci-carpet-office", "mci-wall-office"] },
  ] }, rooms: [
    { kind: "book-floor", w: 22, h: 12, floor: "mci-wood-oak", wall: "mci-wall-store", items: [
      o("mci-art-frame", 21, 0),
      ...row("book-shelf", 0, 2, 10, 2),
      o("book-table", 1, 4), o("book-table", 5, 4), o("book-table", 14, 4), o("book-table", 18, 4),
      ...row("library-shelf", 1, 4, 2, 6), ...row("library-shelf", 1, 4, 2, 8), ...row("library-shelf", 1, 4, 2, 10),
      o("library-carrel", 14, 7), o("library-carrel", 17, 7), o("library-carrel", 14, 9), o("library-carrel", 17, 9),
      o("mci-counter-register", 16, 11), o("mci-plant-tall", 21, 11),
    ] },
    { kind: "manga-cafe", w: 12, h: 7, floor: "mci-wood-dark", wall: "mci-wall-brick", items: [
      o("mci-notice-board", 9, 0),
      ...row("manga-shelf", 0, 2, 4, 2), o("mci-coffee-station", 8, 2), o("hospital-water-dispenser", 10, 2), o("mci-fridge", 11, 2),
      o("manga-booth", 1, 4), o("manga-booth", 4, 4), o("manga-booth", 7, 4),
      o("mci-reception", 9, 5),
    ] },
  ] },
  // 18. 신사 — 북쪽 배전(시메나와 아래 제단·새전함·석등 넷·방석·붉은 참배 러너), 남쪽 현관(신발장·부적 진열대), 사무소.
  { program: "mc_shrine", map: "shrine-haiden", variation: {
    rows: [["shrine-haiden", "void:6"], ["shrine-genkan", "shrine-office"]],
    entrance: "shrine-genkan", above: [["shrine-haiden", "shrine-genkan"]], left: [["shrine-genkan", "shrine-office"]], hubs: ["shrine-genkan"], palettes: [
      { "shrine-haiden": ["mci-wood-oak", "mci-wall-brick"], "shrine-genkan": ["mci-stone-lobby", "mci-wall-home"], "shrine-office": ["mci-wood-dark", "mci-wall-home"] },
      { "shrine-haiden": ["mci-stone-lobby", "mci-wall-home"], "shrine-genkan": ["mci-wood-dark", "mci-wall-brick"], "shrine-office": ["mci-carpet-office", "mci-wall-office"] },
    ] }, rooms: [
    { kind: "shrine-haiden", w: 20, h: 10, floor: "mci-wood-dark", wall: "mci-wall-home", items: [
      o("izakaya-lantern", 2, 0), o("izakaya-lantern", 5, 0), o("shrine-shimenawa", 8, 0), o("izakaya-lantern", 14, 0), o("izakaya-lantern", 17, 0),
      o("mci-plant-tall", 6, 2), o("shrine-altar", 8, 2), o("mci-plant-tall", 12, 2),
      o("shrine-stone-lantern", 3, 4), o("shrine-stone-lantern", 16, 4), o("shrine-saisen-box", 8, 5),
      o("izakaya-zashiki", 3, 6), o("izakaya-zashiki", 14, 6), o("mci-rug", 8, 7),
      o("shrine-stone-lantern", 1, 9), o("shrine-stone-lantern", 18, 9),
    ] },
    { kind: "shrine-genkan", w: 13, h: 7, floor: "mci-stone-lobby", wall: "mci-wall-home", items: [
      o("mci-notice-board", 1, 0), o("izakaya-lantern", 9, 0), o("izakaya-lantern", 11, 0),
      o("sento-shoe-locker", 0, 2), o("sento-shoe-locker", 2, 2), o("mci-plant-tall", 12, 2),
      o("dept-glass-showcase", 9, 4), o("shrine-stone-lantern", 1, 5), o("shrine-stone-lantern", 12, 6),
    ] },
    { kind: "shrine-office", w: 6, h: 7, floor: "mci-wood-dark", wall: "mci-wall-home", items: [
      o("mci-wall-clock", 3, 0),
      o("mci-shelf-office", 0, 2), o("mci-filing", 3, 2),
      o("mci-chair-office-s", 1, 4), o("mci-desk-pc-back", 1, 5), g("mci-g-papers", 1, 5), o("mci-plant-tall", 5, 6),
    ] },
  ] },
  // 20. 파출소(코반) — 남쪽 민원실(수배 게시판·민원 데스크·대기 의자), 북서 유치장(철창 셋), 북동 휴게실(좌식석·TV·부엌).
  { program: "mc_koban", map: "koban", variation: {
    rows: [["koban-cellblock", "koban-rest", "void:6"], ["koban-office"]],
    entrance: "koban-office", above: [["koban-cellblock", "koban-office"], ["koban-rest", "koban-office"]], left: [["koban-cellblock", "koban-rest"]], hubs: ["koban-office"], palettes: [
      { "koban-office": ["mci-concrete", "mci-wall-brick"], "koban-cellblock": ["mci-concrete", "mci-wall-metal"], "koban-rest": ["mci-wood-oak", "mci-wall-home"] },
      { "koban-office": ["mci-wood-oak", "mci-wall-lobby"], "koban-cellblock": ["mci-tile-small", "mci-wall-tile"], "koban-rest": ["mci-carpet-office", "mci-wall-office"] },
    ] }, rooms: [
    { kind: "koban-cellblock", w: 8, h: 7, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-wall-clock", 7, 0),
      o("koban-cell", 0, 2), o("koban-cell", 2, 2), o("koban-cell", 4, 2), o("mci-plant-tall", 7, 2), o("mci-bench-metal", 1, 5),
    ] },
    { kind: "koban-rest", w: 8, h: 7, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("mci-window-curtain", 1, 0), o("mci-ac-wall", 5, 0),
      o("mci-kitchen", 0, 2), o("mci-tv-stand", 4, 2), o("mci-fridge", 7, 2), o("izakaya-zashiki", 3, 4),
    ] },
    { kind: "koban-office", w: 17, h: 8, floor: "mci-vinyl-hospital", wall: "mci-wall-office", items: [
      o("koban-wanted-board", 1, 0), o("mci-notice-board", 4, 0), o("mci-wall-clock", 11, 0), o("koban-wanted-board", 14, 0),
      o("mci-filing", 0, 2), o("mci-shelf-office", 14, 2), o("mci-plant-tall", 16, 2),
      o("mci-chair-office-s", 1, 4), o("mci-desk-pc-back", 1, 5), g("mci-g-phone", 2, 5),
      o("mci-chair-office-s", 7, 4), o("koban-desk", 6, 5),
      o("mci-wait-bench", 12, 6), o("mci-plant-tall", 16, 7),
    ] },
  ] },
  // 21. 과학 실험실 + 준비실 — 시약 선반·흄후드 벽, 시연대, 의자를 낀 실험대 두 줄 / 동쪽 준비실(시약장·냉장고·작업대·기록 책상).
  { program: "mc_lab", map: "science-lab", variation: { entrance: "sci-lab", left: [["sci-lab", "lab-prep"]], palettes: [
    { "sci-lab": ["mci-vinyl-hospital", "mci-wall-hospital"], "lab-prep": ["mci-concrete", "mci-wall-metal"] },
    { "sci-lab": ["mci-concrete", "mci-wall-metal"], "lab-prep": ["mci-tile-small", "mci-wall-tile"] },
  ] }, rooms: [
    { kind: "sci-lab", w: 20, h: 11, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-window-blind", 1, 0), o("mci-whiteboard", 8, 0), o("mci-wall-clock", 12, 0), o("mci-window-blind", 16, 0),
      o("lab-reagent-shelf", 0, 2), o("lab-reagent-shelf", 2, 2), o("lab-fume-hood", 4, 2), o("lab-fume-hood", 6, 2), o("mci-washbasin", 12, 2),
      o("lab-fume-hood", 14, 2), o("lab-reagent-shelf", 16, 2), o("lab-reagent-shelf", 18, 2),
      o("lab-bench", 8, 4),
      o("mci-chair-wood-s", 3, 5), o("mci-chair-wood-s", 7, 5), o("mci-chair-wood-s", 12, 5), o("mci-chair-wood-s", 16, 5),
      ...row("lab-bench", 2, 4, 2, 6), ...row("lab-bench", 11, 4, 2, 6),
      o("mci-chair-wood-s", 3, 8), o("mci-chair-wood-s", 7, 8), o("mci-chair-wood-s", 12, 8), o("mci-chair-wood-s", 16, 8),
      ...row("lab-bench", 2, 4, 2, 9), ...row("lab-bench", 11, 4, 2, 9),
    ] },
    { kind: "lab-prep", w: 8, h: 11, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-notice-board", 5, 0),
      o("lab-reagent-shelf", 0, 2), o("lab-reagent-shelf", 2, 2), o("mci-fridge", 4, 2), o("mci-rack", 5, 2),
      o("lab-bench", 1, 5), o("lab-bench", 4, 5), o("mci-med-cart", 7, 5),
      o("mci-chair-office-s", 1, 7), o("mci-desk-pc-back", 1, 8), g("mci-g-papers", 2, 8), o("subway-trash-bins", 5, 10),
    ] },
  ] },
  // 22. 음악실·밴드 동아리방 + 녹음 부스 — 흡음 패널, 앰프 벽, 드럼 세트·기타 거치대, 소파 / 동쪽 녹음 조정실(믹싱 콘솔·의자·소파).
  { program: "mc_music_room", map: "band-room", variation: { entrance: "band-room", left: [["band-room", "band-booth"]], palettes: [
    { "band-room": ["mci-carpet-office", "mci-wall-office"], "band-booth": ["mci-wood-dark", "mci-wall-brick"] },
    { "band-room": ["mci-concrete", "mci-wall-metal"], "band-booth": ["mci-carpet-office", "mci-wall-office"] },
  ] }, rooms: [
    { kind: "band-room", w: 17, h: 11, floor: "mci-wood-oak", wall: "mci-wall-brick", items: [
      o("music-acoustic-panel", 1, 0), o("music-acoustic-panel", 5, 0), o("music-acoustic-panel", 10, 0), o("music-acoustic-panel", 14, 0),
      o("music-amp", 0, 2), o("music-amp", 1, 2), o("mci-shelf-office", 3, 2), o("mci-whiteboard", 7, 0), o("mci-shelf-office", 11, 2), o("music-amp", 15, 2), o("music-amp", 16, 2),
      ...row("music-guitar-stand", 5, 1, 2, 2), ...row("music-guitar-stand", 9, 1, 2, 2), ...row("music-guitar-stand", 13, 1, 2, 2),
      o("music-guitar-stand", 5, 5), o("music-drum-kit", 7, 5), o("music-guitar-stand", 10, 5),
      o("mci-sofa", 2, 9), o("mci-coffee-table", 3, 10), o("mci-armchair", 6, 9), o("mci-plant-tall", 16, 9),
    ] },
    { kind: "band-booth", w: 8, h: 11, floor: "mci-carpet-office", wall: "mci-wall-office", items: [
      o("music-acoustic-panel", 1, 0), o("music-acoustic-panel", 5, 0),
      o("mci-shelf-office", 0, 2), o("music-amp", 6, 2), o("music-amp", 7, 2),
      o("mci-chair-office-s", 2, 4), o("mci-chair-office-s", 4, 4), o("studio-news-desk", 2, 5),
      o("lounge-sofa-cream", 2, 9), o("mci-plant-tall", 7, 10),
    ] },
  ] },
  // 24. 보건실 — 북쪽 침상 칸(커튼 칸막이 침대 넷·협탁·링거), 남쪽 진찰실(약품장·세면대·정수기·보건 교사 책상·시력표·체중계·휠체어).
  { program: "mc_infirmary", map: "campus-infirmary", variation: { entrance: "infirmary-room", above: [["infirmary-beds", "infirmary-room"]], palettes: [
    { "infirmary-room": ["mci-tile-small", "mci-wall-tile"], "infirmary-beds": ["mci-vinyl-store", "mci-wall-home"] },
    { "infirmary-room": ["mci-wood-oak", "mci-wall-home"], "infirmary-beds": ["mci-carpet-office", "mci-wall-hospital"] },
  ] }, rooms: [
    { kind: "infirmary-beds", w: 17, h: 7, floor: "mci-vinyl-hospital", wall: "mci-wall-hospital", items: [
      o("mci-window-curtain", 2, 0), o("mci-window-curtain", 7, 0), o("mci-window-curtain", 12, 0),
      o("mci-hosp-bed", 1, 3), o("mci-bedside", 2, 3), o("hospital-curtain-screen", 3, 3),
      o("mci-hosp-bed", 5, 3), o("mci-bedside", 6, 3), o("hospital-curtain-screen", 7, 3),
      o("mci-hosp-bed", 9, 3), o("mci-bedside", 10, 3), o("hospital-curtain-screen", 11, 3),
      o("mci-hosp-bed", 13, 3), o("mci-bedside", 14, 3), o("mci-iv-stand", 16, 3),
    ] },
    { kind: "infirmary-room", w: 17, h: 8, floor: "mci-vinyl-hospital", wall: "mci-wall-hospital", items: [
      o("mci-window-curtain", 1, 0), o("mci-wall-clock", 11, 0), o("infirmary-eye-chart", 14, 0),
      o("hospital-med-cabinet", 0, 2), o("mci-washbasin", 3, 2), o("hospital-water-dispenser", 4, 2), o("mci-filing", 11, 2), o("hospital-med-cabinet", 15, 2),
      o("hospital-doctor-desk", 1, 4), o("mci-med-cart", 4, 4), o("infirmary-scale", 13, 4), o("hospital-wheelchair", 15, 4),
      o("mci-wait-bench", 11, 6), o("mci-plant-tall", 0, 7),
    ] },
  ] },
  // 25. 메이드·디저트 카페 + 주방 — 분홍 체크 타일, 파르페 쇼케이스, 소형 무대, 카페 탁자 넷, 부스석 둘 / 동쪽 주방(조리대·냉장고·디저트 진열대).
  { program: "mc_maid_cafe", map: "maid-cafe", variation: { entrance: "maid-cafe", left: [["maid-cafe", "maid-kitchen"]], palettes: [
    { "maid-cafe": ["mci-wood-oak", "mci-wall-store"], "maid-kitchen": ["mci-tile-small", "mci-wall-tile"] },
    { "maid-cafe": ["mci-tile-small", "mci-wall-lobby"], "maid-kitchen": ["mci-concrete", "mci-wall-metal"] },
  ] }, rooms: [
    { kind: "maid-cafe", w: 19, h: 11, floor: "mci-wood-dark", wall: "mci-wall-home", items: [
      o("mci-menu-board", 1, 0), o("mci-art-frame", 8, 0), o("mci-window-curtain", 14, 0),
      o("mci-coffee-station", 4, 2), o("mci-plant-tall", 12, 2), o("cafe-parfait-case", 1, 3), o("cafe-maid-stage", 14, 3),
      o("cafe-checker-floor", 4, 5), o("cafe-checker-floor", 7, 5), o("cafe-checker-floor", 10, 5),
      o("cafe-checker-floor", 4, 7), o("cafe-checker-floor", 7, 7), o("cafe-checker-floor", 10, 7),
      o("mci-cafe-table", 5, 6), o("mci-cafe-chair-e", 4, 6), o("mci-cafe-chair-w", 6, 6),
      o("mci-cafe-table", 10, 6), o("mci-cafe-chair-e", 9, 6), o("mci-cafe-chair-w", 11, 6),
      o("mci-cafe-table", 5, 8), o("mci-cafe-chair-e", 4, 8), o("mci-cafe-chair-w", 6, 8),
      o("mci-cafe-table", 10, 8), o("mci-cafe-chair-e", 9, 8), o("mci-cafe-chair-w", 11, 8),
      o("restaurant-booth-set", 0, 6), o("restaurant-booth-set", 15, 7), o("mci-plant-tall", 18, 10),
    ] },
    { kind: "maid-kitchen", w: 8, h: 11, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-menu-board", 4, 0),
      o("mci-kitchen", 0, 2), o("mci-fridge", 3, 2), o("mci-cooler", 4, 2), o("mci-coffee-station", 6, 2),
      o("mci-pastry-case", 1, 5), o("mci-pastry-case", 4, 5),
      o("mci-pallet", 6, 8), o("mci-basket-stack", 1, 9), o("subway-trash-bins", 4, 10),
    ] },
  ] },
  // 26. 호텔 — 남쪽 로비(엘리베이터·벨 데스크·러기지 카트·소파·러그), 북서 스위트(킹베드·시티뷰 창·TV·옷장), 북동 로비 바(술병 선반·와인 랙·카운터·스툴·부스).
  { program: "mc_hotel", map: "hotel", variation: {
    rows: [["hotel-suite", "hotel-lounge", "void:6"], ["hotel-lobby"]],
    entrance: "hotel-lobby", above: [["hotel-suite", "hotel-lobby"], ["hotel-lounge", "hotel-lobby"]], left: [["hotel-suite", "hotel-lounge"]], hubs: ["hotel-lobby"], palettes: [
      { "hotel-lobby": ["mci-wood-dark", "mci-wall-brick"], "hotel-suite": ["mci-wood-oak", "mci-wall-lobby"], "hotel-lounge": ["mci-stone-lobby", "mci-wall-store"] },
      { "hotel-lobby": ["mci-tile-concourse", "mci-wall-store"], "hotel-suite": ["mci-carpet-office", "mci-wall-office"], "hotel-lounge": ["mci-wood-dark", "mci-wall-home"] },
    ] }, rooms: [
    { kind: "hotel-suite", w: 13, h: 10, floor: "mci-carpet-office", wall: "mci-wall-home", items: [
      o("mci-window-city", 1, 0), o("mci-window-city", 5, 0), o("mci-window-city", 9, 0),
      o("mci-tv-stand", 0, 2), o("mci-wardrobe", 11, 2),
      o("mci-bedside", 3, 4), o("hotel-king-bed", 4, 4), o("mci-bedside", 7, 4),
      o("mci-rug", 3, 7), o("mci-armchair", 9, 7), o("mci-coffee-table", 10, 8), o("mci-chair-office-s", 1, 8), o("mci-plant-tall", 12, 9),
    ] },
    { kind: "hotel-lounge", w: 10, h: 10, floor: "mci-stone-lobby", wall: "mci-wall-store", items: [
      o("mci-art-frame", 4, 0),
      o("rest-wine-rack", 0, 2), o("mci-coffee-station", 2, 2), o("izakaya-beer-server", 5, 2), o("mci-fridge", 6, 2), o("rest-wine-rack", 7, 2),
      o("izakaya-counter", 1, 4), o("izakaya-counter", 4, 4), ...row("mci-bar-stool", 1, 1, 6, 5),
      o("restaurant-booth-set", 6, 7), o("lounge-sofa-cream", 1, 8), o("mci-plant-tall", 9, 9),
    ] },
    { kind: "hotel-lobby", w: 24, h: 10, floor: "mci-stone-lobby", wall: "mci-wall-lobby", items: [
      o("mci-art-frame", 8, 0), o("mci-wall-clock", 12, 0), o("mci-art-frame", 15, 0),
      o("mci-elevator", 0, 2), o("mci-elevator", 2, 2), o("mci-plant-tall", 4, 2), o("mci-plant-tall", 19, 2),
      o("dept-directory-kiosk", 14, 3), o("hotel-bell-desk", 9, 4), o("hotel-luggage-cart", 7, 5), o("hotel-luggage-cart", 13, 5),
      o("lounge-sofa-cream", 17, 5), o("lounge-sofa-cream", 19, 5), o("mci-coffee-table", 18, 7), g("mci-g-vase", 18, 7),
      o("mci-rug", 10, 7), o("mci-planter", 1, 8), o("mci-planter", 21, 8),
    ] },
  ] },
  // 27. 방송국 — 북쪽 스튜디오(조명 트러스·뉴스 데스크·크로마키 벽·카메라 셋·크레인), 남서 부조정실(모니터 벽·콘솔 책상 넷), 남동 분장실(거울 세면대·옷장·의상 행거·소파).
  { program: "mc_tv_studio", map: "tv-studio", variation: {
    rows: [["studio-floor", "void:7"], ["studio-control", "studio-makeup"]],
    entrance: "studio-control", above: [["studio-floor", "studio-control"], ["studio-floor", "studio-makeup"]], left: [["studio-control", "studio-makeup"]], hubs: ["studio-control"], palettes: [
      { "studio-floor": ["mci-wood-dark", "mci-wall-office"], "studio-control": ["mci-carpet-office", "mci-wall-metal"], "studio-makeup": ["mci-wood-oak", "mci-wall-home"] },
      { "studio-floor": ["mci-vinyl-store", "mci-wall-brick"], "studio-control": ["mci-concrete", "mci-wall-office"], "studio-makeup": ["mci-tile-small", "mci-wall-tile"] },
    ] }, rooms: [
    { kind: "studio-floor", w: 24, h: 12, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-tv-wall", 1, 0), o("studio-light-truss", 4, 0), o("studio-light-truss", 9, 0), o("studio-light-truss", 15, 0), o("studio-light-truss", 19, 0),
      o("mci-shelf-office", 0, 2), o("mci-plant-tall", 4, 2), o("studio-chroma-wall", 15, 2), o("studio-chroma-wall", 18, 2), o("mci-filing", 22, 2),
      o("mci-chair-office-s", 6, 4), o("mci-chair-office-s", 7, 4), o("studio-news-desk", 5, 5),
      o("studio-camera", 17, 5), o("studio-camera", 20, 5),
      o("studio-camera", 4, 9), o("studio-camera", 7, 9), o("studio-camera-crane", 10, 8), o("mci-rug", 16, 8),
    ] },
    { kind: "studio-control", w: 12, h: 6, floor: "mci-carpet-office", wall: "mci-wall-metal", items: [
      o("mci-tv-wall", 1, 0), o("mci-tv-wall", 4, 0), o("mci-tv-wall", 7, 0), o("mci-wall-clock", 10, 0),
      o("mci-filing", 10, 2),
      ...row("mci-chair-office-s", 1, 2, 4, 3), ...row("mci-desk-pc-back", 1, 2, 4, 4),
    ] },
    { kind: "studio-makeup", w: 11, h: 6, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("mci-art-frame", 6, 0),
      o("mci-washbasin", 0, 2), o("mci-washbasin", 1, 2), o("mci-washbasin", 2, 2), o("mci-wardrobe", 4, 2), o("dept-clothing-rack", 8, 3),
      o("lounge-sofa-cream", 1, 4), o("mci-armchair", 5, 4), o("mci-plant-tall", 10, 5),
    ] },
  ] },
  // 28. 법정 + 대기 복도 — 판사석 단상과 휘장, 서기석, 증인석, 배심원석, 검사·변호인석, 난간 뒤 방청석 여섯 / 남쪽 대기 복도(벤치·사물함·정수기).
  { program: "mc_courtroom", map: "courtroom", variation: {
    rows: [["court-room", "void:7"], ["court-lobby"]], entrance: "court-lobby", above: [["court-room", "court-lobby"]], hubs: ["court-lobby"], palettes: [
    { "court-room": ["mci-carpet-office", "mci-wall-office"], "court-lobby": ["mci-stone-lobby", "mci-wall-lobby"] },
    { "court-room": ["mci-stone-lobby", "mci-wall-lobby"], "court-lobby": ["mci-wood-oak", "mci-wall-home"] },
  ] }, rooms: [
    { kind: "court-room", w: 23, h: 13, floor: "mci-wood-dark", wall: "mci-wall-home", items: [
      o("mci-window-curtain", 2, 0), o("court-emblem", 10, 0), o("mci-window-curtain", 19, 0),
      o("mci-filing", 0, 2), o("court-judge-bench", 9, 3), o("mci-shelf-office", 21, 2),
      o("mci-desk-pc", 6, 5), o("court-witness-stand", 15, 4), o("aud-seat-row", 19, 4), o("aud-seat-row", 19, 6),
      o("court-counsel-table", 3, 7), o("court-counsel-table", 15, 8),
      o("museum-velvet-rope", 1, 9), o("museum-velvet-rope", 4, 9), o("museum-velvet-rope", 7, 9),
      o("museum-velvet-rope", 13, 9), o("museum-velvet-rope", 16, 9), o("museum-velvet-rope", 19, 9),
      ...row("court-gallery-pew", 1, 3, 3, 11), ...row("court-gallery-pew", 13, 3, 3, 11),
    ] },
    { kind: "court-lobby", w: 23, h: 6, floor: "mci-stone-lobby", wall: "mci-wall-lobby", items: [
      o("mci-notice-board", 1, 0), o("mci-wall-clock", 6, 0), o("mci-art-frame", 16, 0),
      o("subway-vending-machine", 0, 2), o("hospital-water-dispenser", 2, 2), o("sento-shoe-locker", 17, 2), o("sento-shoe-locker", 19, 2), o("mci-plant-tall", 22, 2),
      o("mci-wait-bench", 2, 4), o("mci-wait-bench", 6, 4), o("mci-wait-bench", 15, 4), o("mci-wait-bench", 19, 4),
    ] },
  ] },
  // 29. 지하 주차장 — 남쪽 주차 데크(북·남 주차 구획 줄과 차, 기둥, 가운데 차로), 북서 엘리베이터 홀(정산기·대기 의자), 북동 전기·창고실.
  // 29. 지하 주차장 & 환승 센터 (34×25, 북서 4칸 void 계단식 외곽) — 2026-10-18 19:18 사용자 「자동차는 기존에 쓰던 게 있었는데… 버스도 있고」.
  //     기존 modern_city 거리 차량 키트(흰 승용차·빨간 승용차·시내버스·구급차)와 정면/후면 주차 차량을 함께 배치한 주차 데크 + 엘리베이터 정산 홀 + 기계실.
  { program: "mc_parking", map: "parking-garage", variation: {
    rows: [["void:4", "parking-lobby", "parking-utility"], ["parking-deck"]],
    entrance: "parking-deck", above: [["parking-lobby", "parking-deck"], ["parking-utility", "parking-deck"]], left: [["parking-lobby", "parking-utility"]],
    hubs: ["parking-deck"], fixed: ["parking-lobby", "parking-utility", "parking-deck"], palettes: [
      { "parking-deck": ["mci-tile-concourse", "mci-wall-brick"], "parking-lobby": ["mci-stone-lobby", "mci-wall-lobby"], "parking-utility": ["mci-concrete", "mci-wall-brick"] },
      { "parking-deck": ["mci-stone-lobby", "mci-wall-office"], "parking-lobby": ["mci-tile-small", "mci-wall-tile"], "parking-utility": ["mci-tile-concourse", "mci-wall-office"] },
    ] }, rooms: [
    { kind: "parking-lobby", w: 14, h: 6, floor: "mci-stone-lobby", wall: "mci-wall-lobby", items: [
      o("elev-floor-led", 2, 0), o("elev-hall-lantern", 5, 0), o("mci-notice-board", 7, 0), o("mci-route-map", 9, 0),
      o("mci-elevator", 0, 2), o("mci-elevator", 3, 2), o("subway-vending-machine", 12, 2),
      o("park-pay-machine", 8, 3), o("park-pay-machine", 9, 3), o("mci-wait-bench", 1, 5), o("mci-plant-tall", 13, 5),
    ] },
    { kind: "parking-utility", w: 13, h: 6, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-ac-wall", 8, 0),
      o("mci-rack", 0, 2), o("mci-rack", 3, 2), o("mci-filing", 11, 2),
      o("roof-water-tank", 8, 3), o("mci-pallet", 1, 5), o("mci-pallet", 2, 5), o("mci-pallet", 11, 5),
    ] },
    { kind: "parking-deck", w: 32, h: 16, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      // 북쪽 일반 승용차 주차 구획(위 방 문 앞 x=10·25 는 비운다)
      o("park-stall-lines", 0, 2), o("park-car-front-white", 2, 2), o("park-stall-lines", 5, 2), o("park-car-front-red", 6, 2),
      o("park-stall-lines", 12, 2), o("park-car-front-navy", 14, 2), o("park-stall-lines", 18, 2), o("park-car-front-red", 20, 2),
      // 북동쪽 구급차·특수차량 전용 구획
      o("hosp-ambulance-w", 26, 3),
      // 중앙 주행 차로(y=6..10) — 기둥만 대칭 배치하고 주행 차선을 100% 개방하며, 서쪽·동쪽 끝 전용 하역장에만 차량 정차
      o("park-sedan-white-e", 0, 7), o("park-pillar", 9, 7), o("park-pillar", 22, 7),
      // 동쪽 대형 화물 하역 베이(택배 탑차 5×3) + 남서쪽 전용 대형 버스 베이(시내버스 8×2, 구획선 겹침 없음)
      o("jumbo-park-box-truck-e", 26, 8),
      o("park-bus-e", 1, 13), o("park-sedan-red-w", 10, 13),
      // 남동쪽 승용차 주차 구획(남쪽 출구 x=15..16 앞은 비운다)
      o("park-stall-lines", 18, 13), o("park-car-back-navy", 20, 13), o("park-stall-lines", 25, 13), o("park-car-back-black", 27, 13),
    ] },
  ] },
  // 30. 대학 중앙도서관 — 북서 열람실(벽 서가·서가 열 넷·스터디 램프 열람석 여덟), 북동 그룹 스터디룸(ㄷ자 탁자 둘), 남쪽 로비(대출 데스크·검색 PC·자판기).
  { program: "mc_library", map: "central-library", variation: {
    rows: [["library-hall", "library-study"], ["library-lobby"]],
    trim: { "library-study": 8 },
    entrance: "library-lobby", above: [["library-hall", "library-lobby"], ["library-study", "library-lobby"]], left: [["library-hall", "library-study"]], hubs: ["library-lobby"], palettes: [
      { "library-hall": ["mci-wood-oak", "mci-wall-home"], "library-study": ["mci-carpet-office", "mci-wall-office"], "library-lobby": ["mci-stone-lobby", "mci-wall-lobby"] },
      { "library-hall": ["mci-wood-dark", "mci-wall-brick"], "library-study": ["mci-wood-oak", "mci-wall-home"], "library-lobby": ["mci-tile-concourse", "mci-wall-store"] },
    ] }, rooms: [
    { kind: "library-hall", w: 17, h: 13, floor: "mci-carpet-office", wall: "mci-wall-office", items: [
      o("mci-window-blind", 12, 0), o("mci-wall-clock", 15, 0),
      ...row("book-shelf", 0, 2, 8, 2), o("mci-plant-tall", 16, 2),
      ...row("library-shelf", 1, 3, 3, 5), ...row("library-shelf", 1, 3, 3, 7), ...row("library-shelf", 1, 3, 3, 9), ...row("library-shelf", 1, 3, 3, 11),
      ...row("library-carrel", 11, 3, 2, 5), ...row("library-carrel", 11, 3, 2, 7), ...row("library-carrel", 11, 3, 2, 9), ...row("library-carrel", 11, 3, 2, 11),
    ] },
    { kind: "library-study", w: 8, h: 8, floor: "mci-carpet-office", wall: "mci-wall-office", items: [
      o("mci-whiteboard", 3, 0),
      o("mci-shelf-office", 0, 2), o("mci-plant-tall", 7, 2),
      o("mci-cafe-chair-e", 1, 4), o("mci-cafe-chair-e", 1, 5), o("council-table-u", 2, 4), o("mci-cafe-chair-w", 6, 4), o("mci-cafe-chair-w", 6, 5),
    ] },
    { kind: "library-lobby", w: 26, h: 6, floor: "mci-stone-lobby", wall: "mci-wall-lobby", items: [
      o("mci-notice-board", 1, 0), o("mci-wall-clock", 20, 0),
      o("subway-vending-machine", 0, 2), o("mci-plant-tall", 3, 2), o("mci-plant-tall", 22, 2), o("subway-vending-machine", 24, 2),
      o("library-loan-desk", 4, 4), o("mci-chair-office-s", 17, 3), o("mci-chair-office-s", 20, 3), o("mci-desk-pc", 17, 4), o("mci-desk-pc", 20, 4),
      o("mci-basket-stack", 9, 5), o("mci-wait-bench", 22, 5),
    ] },
  ] },
];

export const MODERN_VENUE_TEMPLATES: readonly InteriorRoomTemplate[] = VENUES.flatMap((v) =>
  v.rooms.map((r, i) => ({ ...r, id: `${v.map}:${r.kind}#${i}`, map: v.map, building: v.program, items: [...r.items] })));
export const MODERN_VENUE_PROGRAMS: Readonly<Record<string, readonly { readonly map: string; readonly kinds: readonly string[] }[]>> =
  Object.fromEntries(VENUES.map((v) => [v.program, [{ map: v.map, kinds: v.rooms.map((r) => r.kind) }]]));
export const MODERN_VENUE_VARIATION: Readonly<Record<string, ModernProgramVariation>> = Object.fromEntries(VENUES.map((v) => [v.program, v.variation]));
