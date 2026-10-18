// 현대 도시(modern_city) 30종 실내 확장 — 2026-10-18 사용자 "더 다양한 공간과 더 다양한 오브젝트… 일본에 뭐가 있나? 한 30가지".
// 백화점·마트·지하철역·병원·영화관·레스토랑·미술관(modernPresets.ts)에 더해 전동차 내부·대학 강의실·체육관·강당·편의점·
// 이자카야·센토·게임센터·노래방·서점·신사·옥상·파출소·실험실·음악실·학생회실·보건실·메이드 카페·호텔·방송국·법정·지하 주차장·도서관.
// 가구 id 는 modernCityRoomSpec.json(R7 굽기: train-*·lecture-*·gym-*·aud-*·konbini-*·izakaya-*·sento-*·… 87종)을 쓴다.
// 견본 좌표: 0~1 줄은 벽면(hang 은 y 0), 2 줄부터 바닥(wall 가구는 y 2). seed 변주는 MODERN_VENUE_VARIATION(바닥·벽면 묶음).
import type { InteriorRoomTemplate, InteriorTemplateItem } from "./templates";
import type { ModernProgramVariation } from "./modernPresets";

const o = (id: string, x: number, y: number): InteriorTemplateItem => ({ t: "o", id, x, y });
const g = (id: string, x: number, y: number): InteriorTemplateItem => ({ t: "g", id, x, y });
const row = (id: string, x0: number, step: number, n: number, y: number) => Array.from({ length: n }, (_, i) => o(id, x0 + i * step, y));

interface Venue {
  readonly program: string;
  readonly map: string;
  readonly variation: ModernProgramVariation;
  readonly rooms: readonly Omit<InteriorRoomTemplate, "map" | "building" | "id">[];
}

const VENUES: readonly Venue[] = [
  // 3. 지하철 전동차 내부 — 양문형 출입문 셋 사이로 롱시트, 문 옆 손잡이 봉, 양 끝 연결 통로.
  { program: "mc_train_car", map: "train-car", variation: { palettes: [
    { "train-car": ["mci-tile-concourse", "mci-wall-office"] },
    { "train-car": ["mci-wood-oak", "mci-wall-store"] },
  ] }, rooms: [
    { kind: "train-car", w: 26, h: 8, floor: "mci-vinyl-store", wall: "mci-wall-metal", items: [
      o("train-door", 4, 0), o("train-led", 8, 0), o("train-door", 12, 0), o("mci-route-map", 16, 0), o("train-door", 20, 0),
      o("train-gangway", 0, 2), o("train-longseat", 6, 2), o("train-longseat", 9, 2), o("train-longseat", 14, 2), o("train-longseat", 17, 2), o("train-gangway", 24, 2),
      o("train-pole", 3, 4), o("train-pole", 11, 4), o("train-pole", 19, 4), o("train-pole", 7, 6), o("train-pole", 15, 6), o("train-pole", 23, 6),
    ] },
  ] },
  // 4. 대학교 계단식 대강의실 — 프로젝터 스크린·교탁, 가운데 통로를 둔 긴 책상 열.
  { program: "mc_lecture_hall", map: "uni-lecture-hall", variation: { palettes: [
    { "uni-lecture": ["mci-wood-oak", "mci-wall-home"] },
    { "uni-lecture": ["mci-vinyl-store", "mci-wall-lobby"] },
  ] }, rooms: [
    { kind: "uni-lecture", w: 22, h: 13, floor: "mci-carpet-office", wall: "mci-wall-office", items: [
      o("mci-whiteboard", 3, 0), o("projector-screen", 9, 0), o("mci-whiteboard", 16, 0), o("mci-wall-clock", 20, 0),
      o("mci-plant-tall", 0, 2), o("mci-filing", 1, 2), o("mci-plant-tall", 21, 2),
      o("lecture-podium", 14, 4),
      ...row("lecture-desk-row", 1, 5, 2, 6), ...row("lecture-desk-row", 12, 5, 2, 6),
      ...row("lecture-desk-row", 1, 5, 2, 8), ...row("lecture-desk-row", 12, 5, 2, 8),
      ...row("lecture-desk-row", 1, 5, 2, 10), ...row("lecture-desk-row", 12, 5, 2, 10),
    ] },
  ] },
  // 5. 실내 체육관 — 북쪽 골대와 점수판, 마루 코트 센터 서클, 양옆 관람석, 남쪽 뜀틀·매트.
  { program: "mc_gym", map: "gymnasium", variation: { palettes: [
    { "gym-court": ["mci-wood-dark", "mci-wall-brick"] },
    { "gym-court": ["mci-wood-oak", "mci-wall-metal"] },
  ] }, rooms: [
    { kind: "gym-court", w: 26, h: 15, floor: "mci-wood-oak", wall: "mci-wall-office", items: [
      o("mci-window-city", 2, 0), o("mci-window-city", 6, 0), o("gym-scoreboard", 12, 0), o("mci-window-city", 18, 0), o("mci-window-city", 22, 0),
      o("gym-hoop", 12, 2),
      o("gym-bleacher", 1, 4), o("gym-bleacher", 21, 4), o("gym-bleacher", 1, 8), o("gym-bleacher", 21, 8),
      o("gym-center-circle", 11, 7),
      o("gym-vault", 2, 12), o("gym-mat", 5, 12), o("gym-mat", 19, 12), o("gym-vault", 22, 12),
    ] },
  ] },
  // 6. 대강당 — 붉은 막 무대와 연단, 무대 옆 그랜드 피아노, 가운데 통로를 둔 객석 열.
  { program: "mc_auditorium", map: "auditorium", variation: { palettes: [
    { "aud-hall": ["mci-wood-dark", "mci-wall-home"] },
    { "aud-hall": ["mci-stone-lobby", "mci-wall-lobby"] },
  ] }, rooms: [
    { kind: "aud-hall", w: 28, h: 16, floor: "mci-carpet-office", wall: "mci-wall-brick", items: [
      o("mci-window-curtain", 1, 0), o("mci-window-curtain", 25, 0),
      o("aud-stage", 11, 2), o("mci-plant-tall", 9, 2), o("mci-plant-tall", 18, 2),
      o("restaurant-piano-stage", 3, 2), o("aud-lectern", 20, 4),
      ...row("aud-seat-row", 2, 3, 3, 8), ...row("aud-seat-row", 17, 3, 3, 8),
      ...row("aud-seat-row", 2, 3, 3, 10), ...row("aud-seat-row", 17, 3, 3, 10),
      ...row("aud-seat-row", 2, 3, 3, 12), ...row("aud-seat-row", 17, 3, 3, 12),
    ] },
  ] },
  // 12. 일본 편의점 — 음료 냉장고·도시락 오픈 쇼케이스·잡지 가판대·ATM, 진열대 두 줄, 오뎅·호빵 계산대.
  { program: "mc_konbini_jp", map: "konbini-24h", variation: { palettes: [
    { "konbini-floor": ["mci-tile-small", "mci-wall-tile"] },
    { "konbini-floor": ["mci-vinyl-hospital", "mci-wall-office"] },
  ] }, rooms: [
    { kind: "konbini-floor", w: 20, h: 11, floor: "mci-vinyl-store", wall: "mci-wall-store", items: [
      o("mci-menu-board", 13, 0), o("mci-notice-board", 18, 0),
      o("mci-cooler", 0, 2), o("mci-cooler", 2, 2), o("mci-cooler", 4, 2), o("konbini-bento", 6, 2), o("konbini-bento", 9, 2), o("mci-magazine", 12, 2), o("konbini-atm", 18, 2), o("mci-coffee-station", 15, 2),
      ...row("mci-gondola", 2, 2, 3, 5), ...row("mci-gondola", 2, 2, 3, 7),
      o("konbini-counter", 13, 6), o("mci-basket-stack", 0, 9), o("mart-promo-endcap", 9, 6), o("mci-freezer", 17, 9),
    ] },
  ] },
  // 13. 라멘집·이자카야 — 붉은 노렌·제등, 생맥주 서버와 술병 선반 앞 다찌 카운터, 동쪽 다다미 좌석.
  { program: "mc_izakaya", map: "izakaya", variation: { palettes: [
    { "izakaya-hall": ["mci-wood-oak", "mci-wall-brick"] },
    { "izakaya-hall": ["mci-concrete", "mci-wall-home"] },
  ] }, rooms: [
    { kind: "izakaya-hall", w: 22, h: 11, floor: "mci-wood-dark", wall: "mci-wall-home", items: [
      o("izakaya-lantern", 1, 0), o("mci-menu-board", 4, 0), o("izakaya-noren", 9, 0), o("izakaya-lantern", 12, 0), o("izakaya-lantern", 20, 0),
      o("izakaya-beer-server", 0, 2), o("rest-bottle-shelf", 1, 2), o("mci-kitchen", 4, 2), o("mci-fridge", 7, 2),
      o("izakaya-counter", 1, 4), o("izakaya-counter", 4, 4),
      ...row("mci-bar-stool", 1, 1, 6, 5),
      o("izakaya-zashiki", 13, 3), o("izakaya-zashiki", 17, 3), o("izakaya-zashiki", 13, 7), o("izakaya-zashiki", 17, 7),
      o("rest-coat-stand", 0, 9),
    ] },
  ] },
  // 14. 센토(대중목욕탕) — 탈의실(신발장 로커·남탕/여탕 노렌·자판기)과 후지산 벽화 아래 대욕장.
  { program: "mc_sento", map: "sento", variation: { entrance: "sento-changing", palettes: [
    { "sento-changing": ["mci-wood-dark", "mci-wall-home"], "sento-bathhall": ["mci-tile-concourse", "mci-wall-tile"] },
    { "sento-changing": ["mci-tile-small", "mci-wall-store"], "sento-bathhall": ["mci-stone-lobby", "mci-wall-tile"] },
  ] }, rooms: [
    { kind: "sento-changing", w: 12, h: 11, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("sento-noren-men", 2, 0), o("sento-noren-women", 7, 0), o("mci-wall-clock", 10, 0),
      o("sento-shoe-locker", 0, 2), o("sento-shoe-locker", 4, 2), o("subway-vending-machine", 9, 2),
      o("mci-wait-bench", 2, 6), o("mci-plant-tall", 0, 9), o("sento-shoe-locker", 9, 6),
    ] },
    { kind: "sento-bathhall", w: 20, h: 11, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("sento-fuji-mural", 6, 0), o("sento-fuji-mural", 9, 0), o("sento-fuji-mural", 12, 0),
      ...row("sento-wash-station", 0, 2, 2, 2), ...row("sento-wash-station", 16, 2, 2, 2),
      o("sento-bath", 8, 3), o("sento-bath", 8, 7),
      ...row("sento-wash-station", 0, 2, 2, 6),
    ] },
  ] },
  // 15. 게임센터 — 인형뽑기·리듬게임·스티커 사진 기기 벽, 캐비닛 열, 레이싱 기체, 동전 교환기·경품 카운터.
  { program: "mc_game_center", map: "game-center", variation: { palettes: [
    { "game-floor": ["mci-carpet-office", "mci-wall-brick"] },
    { "game-floor": ["mci-vinyl-store", "mci-wall-store"] },
  ] }, rooms: [
    { kind: "game-floor", w: 24, h: 13, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("cinema-poster", 1, 0), o("cinema-poster", 10, 0), o("cinema-poster", 20, 0),
      ...row("arcade-claw-machine", 0, 2, 4, 2), o("arcade-rhythm", 10, 2), o("arcade-rhythm", 12, 2), o("arcade-purikura", 16, 2), o("arcade-purikura", 18, 2), o("arcade-medal-changer", 22, 2), o("arcade-medal-changer", 23, 2),
      ...row("arcade-cabinet-pair", 2, 2, 3, 5), ...row("arcade-cabinet-pair", 2, 2, 3, 8),
      o("arcade-racing-cabinet", 14, 5), o("arcade-racing-cabinet", 16, 5), o("arcade-racing-cabinet", 18, 5),
      o("arcade-prize-counter", 17, 9),
    ] },
  ] },
  // 16. 노래방 — 복도를 낀 노래방 두 칸(코너 소파·탬버린 테이블·벽걸이 모니터).
  { program: "mc_karaoke", map: "karaoke-box", variation: { entrance: "karaoke-hall", above: [["karaoke-room", "karaoke-hall"]], palettes: [
    { "karaoke-room": ["mci-wood-dark", "mci-wall-store"], "karaoke-hall": ["mci-stone-lobby", "mci-wall-lobby"] },
    { "karaoke-room": ["mci-vinyl-store", "mci-wall-metal"], "karaoke-hall": ["mci-concrete", "mci-wall-brick"] },
  ] }, rooms: [
    { kind: "karaoke-room", w: 12, h: 9, floor: "mci-carpet-office", wall: "mci-wall-brick", items: [
      o("karaoke-monitor", 5, 0), o("mci-ac-wall", 9, 0),
      o("karaoke-sofa", 0, 3), o("karaoke-sofa", 9, 3), o("karaoke-table", 5, 5), o("karaoke-sofa", 4, 7),
    ] },
    { kind: "karaoke-room", w: 12, h: 9, floor: "mci-carpet-office", wall: "mci-wall-brick", items: [
      o("karaoke-monitor", 5, 0),
      o("karaoke-sofa", 0, 3), o("karaoke-table", 4, 4), o("karaoke-sofa", 8, 6),
    ] },
    { kind: "karaoke-hall", w: 25, h: 7, floor: "mci-tile-concourse", wall: "mci-wall-lobby", items: [
      o("cinema-poster", 2, 0), o("mci-menu-board", 20, 0),
      o("subway-vending-machine", 0, 2), o("mci-reception", 10, 3), o("mci-plant-tall", 24, 2), o("lounge-sofa-cream", 18, 4),
    ] },
  ] },
  // 17. 대형 서점·만화방 — 북쪽 서가 벽, 신간 평대 줄, 만화 서가, 리클라이너 개인 부스.
  { program: "mc_bookstore", map: "bookstore-manga", variation: { palettes: [
    { "book-floor": ["mci-carpet-office", "mci-wall-home"] },
    { "book-floor": ["mci-wood-dark", "mci-wall-brick"] },
  ] }, rooms: [
    { kind: "book-floor", w: 24, h: 13, floor: "mci-wood-oak", wall: "mci-wall-store", items: [
      o("mci-notice-board", 23, 0),
      ...row("book-shelf", 0, 2, 6, 2), ...row("manga-shelf", 14, 2, 5, 2),
      o("book-table", 1, 5), o("book-table", 6, 5), o("book-table", 1, 8), o("book-table", 6, 8),
      o("manga-booth", 14, 5), o("manga-booth", 17, 5), o("manga-booth", 20, 5), o("manga-booth", 14, 8), o("manga-booth", 17, 8),
      o("mci-counter-register", 20, 10),
    ] },
  ] },
  // 18. 신사 배전 실내 — 시메나와 아래 제단, 새전함, 석등 한 쌍, 붉은 제등.
  { program: "mc_shrine", map: "shrine-haiden", variation: { palettes: [
    { "shrine-haiden": ["mci-wood-oak", "mci-wall-brick"] },
    { "shrine-haiden": ["mci-stone-lobby", "mci-wall-home"] },
  ] }, rooms: [
    { kind: "shrine-haiden", w: 18, h: 12, floor: "mci-wood-dark", wall: "mci-wall-home", items: [
      o("izakaya-lantern", 2, 0), o("shrine-shimenawa", 7, 0), o("izakaya-lantern", 15, 0),
      o("shrine-altar", 7, 2), o("mci-plant-tall", 5, 2), o("mci-plant-tall", 11, 2),
      o("shrine-saisen-box", 8, 5), o("shrine-stone-lantern", 3, 5), o("shrine-stone-lantern", 14, 5),
      o("shrine-stone-lantern", 3, 9), o("shrine-stone-lantern", 14, 9),
    ] },
  ] },
  // 19. 옥상 — 탑옥(출입 계단실), 철망 펜스, 급수탑, 자판기, 벤치.
  { program: "mc_rooftop", map: "rooftop", variation: { palettes: [
    { "rooftop-deck": ["mci-tile-concourse", "mci-wall-metal"] },
    { "rooftop-deck": ["mci-stone-lobby", "mci-wall-office"] },
  ] }, rooms: [
    { kind: "rooftop-deck", w: 24, h: 13, floor: "mci-concrete", wall: "mci-wall-brick", items: [
      o("roof-stair-hut", 1, 2), ...row("roof-fence", 4, 2, 6, 2), o("subway-vending-machine", 16, 2), ...row("roof-fence", 18, 2, 3, 2),
      o("roof-water-tank", 19, 6), o("mci-bench-metal", 4, 7), o("mci-bench-metal", 9, 7), o("mci-planter", 13, 7),
      o("mci-bench-metal", 4, 10), o("mci-planter", 19, 10),
    ] },
  ] },
  // 20. 파출소(코반) — 수배 게시판, 민원 데스크, 철창 유치장, 무전·서류 책상.
  { program: "mc_koban", map: "koban", variation: { palettes: [
    { "koban-office": ["mci-concrete", "mci-wall-brick"] },
    { "koban-office": ["mci-wood-oak", "mci-wall-lobby"] },
  ] }, rooms: [
    { kind: "koban-office", w: 16, h: 10, floor: "mci-vinyl-hospital", wall: "mci-wall-office", items: [
      o("koban-wanted-board", 1, 0), o("mci-notice-board", 5, 0), o("mci-wall-clock", 8, 0),
      o("mci-filing", 0, 2), o("mci-desk-pc", 4, 3), o("koban-cell", 11, 2), o("koban-cell", 13, 2),
      o("koban-desk", 3, 5), o("mci-chair-office-s", 4, 7), o("mci-wait-bench", 10, 7), o("mci-plant-tall", 15, 8),
    ] },
  ] },
  // 21. 과학 실험실 — 시약 선반·흄후드 벽, 플라스크 실험대 두 줄.
  { program: "mc_lab", map: "science-lab", variation: { palettes: [
    { "sci-lab": ["mci-vinyl-hospital", "mci-wall-hospital"] },
    { "sci-lab": ["mci-concrete", "mci-wall-metal"] },
  ] }, rooms: [
    { kind: "sci-lab", w: 20, h: 11, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-whiteboard", 9, 0), o("mci-wall-clock", 13, 0),
      o("lab-reagent-shelf", 0, 2), o("lab-reagent-shelf", 2, 2), o("lab-fume-hood", 5, 2), o("lab-fume-hood", 7, 2), o("mci-washbasin", 10, 2),
      o("lab-reagent-shelf", 14, 2), o("lab-reagent-shelf", 16, 2),
      ...row("lab-bench", 2, 4, 2, 5), ...row("lab-bench", 12, 4, 2, 5),
      ...row("lab-bench", 2, 4, 2, 8), ...row("lab-bench", 12, 4, 2, 8),
    ] },
  ] },
  // 22. 음악실·밴드 동아리방 — 흡음 패널, 앰프 스택, 드럼 세트, 기타 거치대, 소파.
  { program: "mc_music_room", map: "band-room", variation: { palettes: [
    { "band-room": ["mci-carpet-office", "mci-wall-office"] },
    { "band-room": ["mci-concrete", "mci-wall-metal"] },
  ] }, rooms: [
    { kind: "band-room", w: 17, h: 11, floor: "mci-wood-oak", wall: "mci-wall-brick", items: [
      o("music-acoustic-panel", 1, 0), o("music-acoustic-panel", 5, 0), o("music-acoustic-panel", 10, 0), o("music-acoustic-panel", 14, 0),
      o("music-amp", 0, 2), o("music-amp", 1, 2), o("music-amp", 15, 2), o("music-amp", 16, 2), o("mci-shelf-office", 11, 2),
      o("music-drum-kit", 7, 4), o("music-guitar-stand", 4, 4), o("music-guitar-stand", 11, 5), o("music-guitar-stand", 13, 5),
      o("mci-sofa", 2, 8), o("mci-coffee-table", 3, 9), o("mci-fridge", 16, 7),
    ] },
  ] },
  // 23. 학생회실 — ㄷ자 회의 탁자와 의자, 화이트보드, 트로피 진열장.
  { program: "mc_council_room", map: "council-room", variation: { palettes: [
    { "council-room": ["mci-wood-oak", "mci-wall-home"] },
    { "council-room": ["mci-vinyl-store", "mci-wall-lobby"] },
  ] }, rooms: [
    { kind: "council-room", w: 16, h: 11, floor: "mci-carpet-office", wall: "mci-wall-office", items: [
      o("mci-window-blind", 1, 0), o("mci-whiteboard", 6, 0), o("mci-window-blind", 12, 0),
      o("council-trophy-case", 0, 2), o("mci-shelf-office", 3, 2), o("mci-filing", 11, 2), o("council-trophy-case", 14, 2),
      o("council-table-u", 6, 5), o("mci-chair-office-s", 5, 5), o("mci-chair-office-s", 10, 5),
      o("mci-chair-office-s", 6, 8), o("mci-chair-office-s", 9, 8), o("mci-plant-tall", 15, 9),
    ] },
  ] },
  // 24. 보건실 — 커튼 칸막이 침대, 시력검사표, 약품장, 체중계, 보건 교사 책상.
  { program: "mc_infirmary", map: "campus-infirmary", variation: { palettes: [
    { "infirmary-room": ["mci-tile-small", "mci-wall-tile"] },
    { "infirmary-room": ["mci-wood-oak", "mci-wall-home"] },
  ] }, rooms: [
    { kind: "infirmary-room", w: 17, h: 11, floor: "mci-vinyl-hospital", wall: "mci-wall-hospital", items: [
      o("mci-window-curtain", 7, 0), o("infirmary-eye-chart", 14, 0),
      o("hospital-med-cabinet", 0, 2), o("mci-washbasin", 3, 2), o("hospital-water-dispenser", 4, 2),
      o("mci-hosp-bed", 7, 3), o("hospital-curtain-screen", 8, 3), o("mci-hosp-bed", 10, 3), o("hospital-curtain-screen", 11, 3), o("mci-hosp-bed", 13, 3),
      o("hospital-doctor-desk", 1, 6), o("infirmary-scale", 14, 8), o("hospital-wheelchair", 16, 8),
    ] },
  ] },
  // 25. 메이드·디저트 카페 — 분홍 체크 타일, 파르페 쇼케이스, 소형 무대, 카페 테이블.
  { program: "mc_maid_cafe", map: "maid-cafe", variation: { palettes: [
    { "maid-cafe": ["mci-wood-oak", "mci-wall-store"] },
    { "maid-cafe": ["mci-tile-small", "mci-wall-lobby"] },
  ] }, rooms: [
    { kind: "maid-cafe", w: 19, h: 11, floor: "mci-wood-dark", wall: "mci-wall-home", items: [
      o("mci-menu-board", 1, 0), o("mci-art-frame", 8, 0),
      o("cafe-parfait-case", 1, 3), o("mci-coffee-station", 4, 2), o("cafe-maid-stage", 14, 3),
      o("cafe-checker-floor", 4, 5), o("cafe-checker-floor", 7, 5), o("cafe-checker-floor", 10, 5),
      o("cafe-checker-floor", 4, 7), o("cafe-checker-floor", 7, 7), o("cafe-checker-floor", 10, 7),
      o("mci-cafe-table", 5, 6), o("mci-cafe-chair-e", 4, 6), o("mci-cafe-chair-w", 6, 6),
      o("mci-cafe-table", 10, 6), o("mci-cafe-chair-e", 9, 6), o("mci-cafe-chair-w", 11, 6),
      o("mci-cafe-table", 5, 8), o("mci-cafe-chair-e", 4, 8), o("mci-cafe-chair-w", 6, 8),
      o("mci-cafe-table", 10, 8), o("mci-cafe-chair-e", 9, 8), o("mci-cafe-chair-w", 11, 8),
      o("mci-plant-tall", 18, 9),
    ] },
  ] },
  // 26. 호텔 로비 & 스위트 — 벨 데스크·러기지 카트·엘리베이터 로비와 킹베드·시티뷰 창 객실.
  { program: "mc_hotel", map: "hotel", variation: { entrance: "hotel-lobby", palettes: [
    { "hotel-lobby": ["mci-wood-dark", "mci-wall-brick"], "hotel-suite": ["mci-wood-oak", "mci-wall-lobby"] },
    { "hotel-lobby": ["mci-tile-concourse", "mci-wall-store"], "hotel-suite": ["mci-carpet-office", "mci-wall-office"] },
  ] }, rooms: [
    { kind: "hotel-lobby", w: 20, h: 11, floor: "mci-stone-lobby", wall: "mci-wall-lobby", items: [
      o("mci-art-frame", 8, 0), o("mci-wall-clock", 12, 0),
      o("mci-elevator", 0, 2), o("mci-elevator", 3, 2), o("mci-plant-tall", 6, 2), o("mci-plant-tall", 14, 2),
      o("hotel-bell-desk", 8, 4), o("hotel-luggage-cart", 6, 5), o("hotel-luggage-cart", 12, 5),
      o("lounge-sofa-cream", 15, 4), o("lounge-sofa-cream", 17, 4), o("mci-coffee-table", 16, 6), g("mci-g-vase", 16, 6),
      o("mci-planter", 1, 8), o("mci-planter", 17, 8),
    ] },
    { kind: "hotel-suite", w: 13, h: 11, floor: "mci-carpet-office", wall: "mci-wall-home", items: [
      o("mci-window-city", 1, 0), o("mci-window-city", 5, 0), o("mci-window-city", 9, 0),
      o("mci-bedside", 3, 3), o("hotel-king-bed", 4, 3), o("mci-bedside", 7, 3), o("mci-wardrobe", 10, 2),
      o("mci-armchair", 9, 7), o("mci-coffee-table", 10, 7), o("mci-tv-stand", 0, 2),
    ] },
  ] },
  // 27. 방송국 스튜디오 — 조명 트러스, 뉴스 데스크, 크로마키 벽, 카메라와 크레인.
  { program: "mc_tv_studio", map: "tv-studio", variation: { palettes: [
    { "studio-floor": ["mci-wood-dark", "mci-wall-office"] },
    { "studio-floor": ["mci-vinyl-store", "mci-wall-brick"] },
  ] }, rooms: [
    { kind: "studio-floor", w: 24, h: 13, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-tv-wall", 1, 0), o("studio-light-truss", 4, 0), o("studio-light-truss", 9, 0), o("studio-light-truss", 15, 0),
      o("mci-shelf-office", 0, 2), o("studio-chroma-wall", 15, 2), o("studio-chroma-wall", 18, 2), o("mci-filing", 22, 2),
      o("studio-news-desk", 5, 4), o("mci-chair-office-s", 6, 3), o("mci-chair-office-s", 7, 3),
      o("studio-camera", 4, 8), o("studio-camera", 9, 8), o("studio-camera-crane", 16, 7), o("mci-desk-pc", 1, 10),
    ] },
  ] },
  // 28. 법정 — 판사석 단상과 법원 문장, 증인석, 검사·변호인석, 난간 뒤 방청석.
  { program: "mc_courtroom", map: "courtroom", variation: { palettes: [
    { "court-room": ["mci-carpet-office", "mci-wall-office"] },
    { "court-room": ["mci-stone-lobby", "mci-wall-lobby"] },
  ] }, rooms: [
    { kind: "court-room", w: 23, h: 14, floor: "mci-wood-dark", wall: "mci-wall-home", items: [
      o("mci-window-curtain", 2, 0), o("court-emblem", 10, 0), o("mci-window-curtain", 19, 0),
      o("court-judge-bench", 9, 2), o("court-witness-stand", 15, 4), o("mci-filing", 0, 2),
      o("court-counsel-table", 3, 6), o("court-counsel-table", 16, 6),
      o("museum-velvet-rope", 2, 8), o("museum-velvet-rope", 5, 8), o("museum-velvet-rope", 15, 8), o("museum-velvet-rope", 18, 8),
      ...row("court-gallery-pew", 2, 3, 2, 10), ...row("court-gallery-pew", 15, 3, 2, 10),
      ...row("court-gallery-pew", 2, 3, 2, 12), ...row("court-gallery-pew", 15, 3, 2, 12),
    ] },
  ] },
  // 29. 지하 주차장 — 구획선과 차, 기둥, 가운데 차로, 정산기·엘리베이터 홀.
  { program: "mc_parking", map: "parking-garage", variation: { palettes: [
    { "parking-deck": ["mci-tile-concourse", "mci-wall-brick"] },
    { "parking-deck": ["mci-stone-lobby", "mci-wall-office"] },
  ] }, rooms: [
    { kind: "parking-deck", w: 26, h: 14, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-notice-board", 21, 0),
      ...row("park-stall-lines", 1, 2, 3, 2), o("park-pillar", 7, 3), ...row("park-stall-lines", 8, 2, 3, 2), o("park-pillar", 14, 3), ...row("park-stall-lines", 15, 2, 2, 2),
      o("park-car-red", 1, 3), o("park-car-white", 5, 3), o("park-car-blue", 10, 3), o("park-car-white", 17, 3),
      o("mci-elevator", 22, 2), o("park-pay-machine", 21, 5),
      ...row("park-stall-lines", 1, 2, 3, 9), o("park-pillar", 7, 10), ...row("park-stall-lines", 8, 2, 3, 9), o("park-pillar", 14, 10),
      o("park-car-blue", 3, 10), o("park-car-red", 8, 10), o("park-car-white", 12, 10),
    ] },
  ] },
  // 30. 대학 중앙도서관 열람실 — 북쪽 벽 서가, 서가 열(서쪽), 스터디 램프 열람석(동쪽), 대출 데스크.
  { program: "mc_library", map: "central-library", variation: { palettes: [
    { "library-hall": ["mci-wood-oak", "mci-wall-home"] },
    { "library-hall": ["mci-wood-dark", "mci-wall-brick"] },
  ] }, rooms: [
    { kind: "library-hall", w: 25, h: 14, floor: "mci-carpet-office", wall: "mci-wall-office", items: [
      o("mci-window-blind", 15, 0), o("mci-window-blind", 19, 0), o("mci-wall-clock", 23, 0),
      ...row("book-shelf", 0, 2, 6, 2),
      ...row("library-shelf", 1, 4, 3, 5), ...row("library-shelf", 1, 4, 3, 8),
      ...row("library-carrel", 15, 3, 3, 5), ...row("library-carrel", 15, 3, 3, 8),
      o("library-loan-desk", 15, 11), o("mci-plant-tall", 24, 11),
    ] },
  ] },
];

export const MODERN_VENUE_TEMPLATES: readonly InteriorRoomTemplate[] = VENUES.flatMap((v) =>
  v.rooms.map((r, i) => ({ ...r, id: `${v.map}:${r.kind}#${i}`, map: v.map, building: v.program, items: [...r.items] })));
export const MODERN_VENUE_PROGRAMS: Readonly<Record<string, readonly { readonly map: string; readonly kinds: readonly string[] }[]>> =
  Object.fromEntries(VENUES.map((v) => [v.program, [{ map: v.map, kinds: v.rooms.map((r) => r.kind) }]]));
export const MODERN_VENUE_VARIATION: Readonly<Record<string, ModernProgramVariation>> = Object.fromEntries(VENUES.map((v) => [v.program, v.variation]));
