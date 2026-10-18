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
  // 3. 지하철 전동차 — 운전실 + 객차 두 칸이 한 줄로(칸 사이 연결 통로 문). 북쪽 롱시트·남쪽 벤치, 문 앞 노란 안전 매트, 가운데 손잡이 봉 줄.
  // 세 칸이 벽에서 벽까지 이어져야 한다 - seed 변주에도 넓히지 않는다.
  { program: "mc_train_car", map: "train-car", variation: {
    entrance: "train-car", left: [["train-cab", "train-car"], ["train-car", "train-car-2"]], hubs: ["train-car", "train-car-2"],
    fixed: ["train-cab", "train-car", "train-car-2"], palettes: [
      { "train-car": ["mci-vinyl-store", "mci-wall-office"], "train-car-2": ["mci-vinyl-store", "mci-wall-office"], "train-cab": ["mci-concrete", "mci-wall-metal"] },
      { "train-car": ["mci-wood-oak", "mci-wall-store"], "train-car-2": ["mci-wood-oak", "mci-wall-store"], "train-cab": ["mci-tile-concourse", "mci-wall-office"] },
    ] }, rooms: [
    { kind: "train-cab", w: 6, h: 8, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-window-city", 1, 0), o("train-led", 3, 0),
      o("mci-filing", 0, 2), o("mci-shelf-office", 4, 2),
      o("mci-chair-office-s", 1, 4), o("mci-chair-office-s", 2, 4), o("mci-desk-pc-back", 1, 5), g("mci-g-phone", 2, 5),
      o("train-pole", 4, 6), o("mci-tactile", 0, 7), o("mci-tactile", 1, 7),
    ] },
    { kind: "train-car", w: 13, h: 8, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("train-door", 1, 0), o("train-led", 4, 0), o("mci-route-map", 6, 0), o("train-door", 9, 0), o("mci-ac-wall", 11, 0),
      o("mci-tactile", 1, 2), o("mci-tactile", 2, 2), o("train-longseat", 3, 2), o("train-longseat", 6, 2), o("mci-tactile", 9, 2), o("mci-tactile", 10, 2),
      ...row("train-pole", 2, 3, 4, 4),
      o("mci-wait-bench", 1, 7), o("mci-tactile", 5, 7), o("mci-tactile", 6, 7), o("mci-tactile", 7, 7), o("mci-wait-bench", 9, 7),
    ] },
    { kind: "train-car-2", w: 13, h: 8, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("train-door", 1, 0), o("mci-route-map", 4, 0), o("train-led", 6, 0), o("train-door", 9, 0), o("mci-notice-board", 12, 0),
      o("mci-tactile", 1, 2), o("mci-tactile", 2, 2), o("train-longseat", 3, 2), o("train-longseat", 6, 2), o("mci-tactile", 9, 2), o("mci-tactile", 10, 2),
      ...row("train-pole", 2, 3, 4, 4),
      o("mci-wait-bench", 1, 7), o("mci-tactile", 5, 7), o("mci-tactile", 6, 7), o("mci-tactile", 7, 7), o("mci-wait-bench", 9, 7), o("train-pole", 12, 6),
    ] },
  ] },
  // 4. 대학 대강의실 + 로비 — 프로젝터·교탁 앞 가운데 통로를 둔 강의 책상 네 줄, 남쪽 로비(사물함·자판기·게시판·카페 탁자).
  { program: "mc_lecture_hall", map: "uni-lecture-hall", variation: { entrance: "uni-foyer", above: [["uni-lecture", "uni-foyer"]], hubs: ["uni-foyer"], palettes: [
    { "uni-lecture": ["mci-wood-oak", "mci-wall-home"], "uni-foyer": ["mci-tile-concourse", "mci-wall-lobby"] },
    { "uni-lecture": ["mci-vinyl-store", "mci-wall-lobby"], "uni-foyer": ["mci-stone-lobby", "mci-wall-office"] },
  ] }, rooms: [
    { kind: "uni-lecture", w: 22, h: 13, floor: "mci-carpet-office", wall: "mci-wall-office", items: [
      o("mci-whiteboard", 2, 0), o("projector-screen", 9, 0), o("mci-whiteboard", 15, 0), o("mci-wall-clock", 18, 0), o("mci-ac-wall", 20, 0),
      o("mci-plant-tall", 0, 2), o("mci-filing", 1, 2), o("mci-shelf-office", 18, 2), o("mci-plant-tall", 21, 2),
      o("lecture-podium", 10, 3), o("mci-desk-pc", 12, 3), g("mci-g-laptop", 12, 3),
      ...row("lecture-desk-row", 1, 4, 2, 5), ...row("lecture-desk-row", 13, 4, 2, 5),
      ...row("lecture-desk-row", 1, 4, 2, 7), ...row("lecture-desk-row", 13, 4, 2, 7),
      ...row("lecture-desk-row", 1, 4, 2, 9), ...row("lecture-desk-row", 13, 4, 2, 9),
      ...row("lecture-desk-row", 1, 4, 2, 11), ...row("lecture-desk-row", 13, 4, 2, 11),
    ] },
    { kind: "uni-foyer", w: 22, h: 7, floor: "mci-tile-concourse", wall: "mci-wall-lobby", items: [
      o("mci-notice-board", 1, 0), o("mci-notice-board", 3, 0), o("mci-art-frame", 14, 0), o("mci-wall-clock", 18, 0),
      o("subway-vending-machine", 0, 2), o("subway-vending-machine", 2, 2), o("hospital-water-dispenser", 4, 2), o("sento-shoe-locker", 5, 2), o("sento-shoe-locker", 7, 2),
      o("council-trophy-case", 13, 2), o("council-trophy-case", 15, 2), o("mci-coffee-station", 17, 2), o("mci-plant-tall", 21, 2),
      o("mci-wait-bench", 1, 4), o("mci-cafe-chair-e", 14, 4), o("mci-cafe-table", 15, 4), o("mci-cafe-chair-w", 16, 4),
      o("mci-cafe-chair-e", 18, 4), o("mci-cafe-table", 19, 4), o("mci-cafe-chair-w", 20, 4),
      o("mci-plant-tall", 0, 6), o("subway-trash-bins", 3, 6), o("mci-planter", 17, 6),
    ] },
  ] },
  // 5. 실내 체육관 — 코트(골대·점수판·센터 서클·양옆 관람석·팀 벤치·매트·뜀틀), 남쪽 탈의실(사물함·벤치)과 로비(트로피·자판기·안내 데스크).
  { program: "mc_gym", map: "gymnasium", variation: { entrance: "gym-lobby", above: [["gym-court", "gym-lobby"]], left: [["gym-locker", "gym-lobby"]], hubs: ["gym-lobby"], palettes: [
    { "gym-court": ["mci-wood-dark", "mci-wall-brick"], "gym-locker": ["mci-tile-small", "mci-wall-tile"], "gym-lobby": ["mci-stone-lobby", "mci-wall-lobby"] },
    { "gym-court": ["mci-wood-oak", "mci-wall-metal"], "gym-locker": ["mci-concrete", "mci-wall-metal"], "gym-lobby": ["mci-tile-concourse", "mci-wall-office"] },
  ] }, rooms: [
    { kind: "gym-court", w: 26, h: 13, floor: "mci-wood-oak", wall: "mci-wall-office", items: [
      o("mci-window-city", 2, 0), o("mci-window-city", 6, 0), o("mci-wall-clock", 10, 0), o("gym-scoreboard", 12, 0), o("mci-window-city", 16, 0), o("mci-window-city", 20, 0), o("mci-ac-wall", 23, 0),
      o("mci-bench-metal", 5, 2), o("mci-bench-metal", 8, 2), o("gym-hoop", 12, 2), o("mci-bench-metal", 16, 2), o("mci-bench-metal", 19, 2),
      o("gym-bleacher", 0, 4), o("gym-bleacher", 0, 7), o("gym-bleacher", 22, 4), o("gym-bleacher", 22, 7),
      o("gym-center-circle", 11, 6),
      o("gym-mat", 5, 11), o("gym-mat", 7, 11), o("gym-vault", 1, 11), o("gym-vault", 17, 11), o("gym-mat", 20, 11), o("mci-basket-stack", 24, 11),
    ] },
    { kind: "gym-locker", w: 12, h: 7, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("mci-wall-clock", 5, 0),
      ...row("sento-shoe-locker", 0, 2, 5, 2),
      o("mci-bench-metal", 1, 4), o("mci-bench-metal", 4, 4), o("mci-bench-metal", 7, 4),
      o("infirmary-scale", 0, 6), o("subway-trash-bins", 4, 6), o("mci-plant-tall", 8, 6),
    ] },
    { kind: "gym-lobby", w: 13, h: 7, floor: "mci-stone-lobby", wall: "mci-wall-lobby", items: [
      o("mci-notice-board", 1, 0), o("mci-art-frame", 9, 0),
      o("council-trophy-case", 0, 2), o("council-trophy-case", 2, 2), o("subway-vending-machine", 9, 2), o("hospital-water-dispenser", 11, 2),
      o("mci-reception", 1, 4), o("mci-wait-bench", 9, 4), o("mci-plant-tall", 12, 6), o("mci-plant-tall", 0, 6),
    ] },
  ] },
  // 6. 대강당 + 로비 — 붉은 막 무대와 연단, 무대 옆 그랜드 피아노·앰프, 가운데 통로를 둔 객석 네 줄, 남쪽 로비(포스터·매표·물품 보관).
  { program: "mc_auditorium", map: "auditorium", variation: { entrance: "aud-foyer", above: [["aud-hall", "aud-foyer"]], hubs: ["aud-foyer"], palettes: [
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
  // 12. 일본 편의점 + 창고 — 북쪽 벽 음료 냉장고·도시락 진열대·커피머신·ATM, 진열대 세 줄과 엔드캡, 동쪽 냉동고, 계산대 줄, 남쪽 잡지 평대·분리수거함.
  { program: "mc_konbini_jp", map: "konbini-24h", variation: { entrance: "konbini-floor", left: [["konbini-floor", "konbini-backroom"]], palettes: [
    { "konbini-floor": ["mci-tile-small", "mci-wall-tile"], "konbini-backroom": ["mci-concrete", "mci-wall-metal"] },
    { "konbini-floor": ["mci-vinyl-hospital", "mci-wall-office"], "konbini-backroom": ["mci-wood-oak", "mci-wall-brick"] },
  ] }, rooms: [
    { kind: "konbini-floor", w: 20, h: 12, floor: "mci-vinyl-store", wall: "mci-wall-store", items: [
      o("mci-ac-wall", 1, 0), o("mci-menu-board", 15, 0), o("mci-notice-board", 18, 0),
      ...row("mci-cooler", 0, 2, 5, 2), o("konbini-bento", 10, 2), o("konbini-bento", 13, 2), o("mci-coffee-station", 16, 2), o("konbini-atm", 18, 2), o("mci-fridge", 19, 2),
      ...row("mci-gondola", 1, 2, 4, 5), o("mart-promo-endcap", 9, 5),
      ...row("mci-gondola", 1, 2, 4, 7), o("mart-promo-endcap", 9, 7),
      ...row("mci-gondola", 1, 2, 4, 9), o("mart-promo-endcap", 9, 9),
      o("mci-freezer", 18, 4), o("mci-freezer", 18, 6),
      o("konbini-counter", 12, 8), o("mci-counter-register", 15, 8), o("mci-pastry-case", 12, 5),
      o("subway-trash-bins", 1, 11), o("book-table", 4, 11), o("mci-basket-stack", 14, 11), o("mci-plant-tall", 19, 11),
    ] },
    { kind: "konbini-backroom", w: 7, h: 12, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-wall-clock", 3, 0),
      o("mci-rack", 0, 2), o("mci-rack", 3, 2), o("mci-fridge", 6, 2),
      o("mci-pallet", 4, 5), o("mci-pallet", 5, 5), o("mci-pallet", 5, 6),
      o("mci-chair-office-s", 1, 8), o("mci-desk-pc-back", 1, 9), g("mci-g-papers", 1, 9),
      o("mci-basket-stack", 5, 10), o("mci-pallet", 6, 11),
    ] },
  ] },
  // 13. 이자카야 — 북서 주방·다찌 카운터(스툴 여섯), 북쪽 칸막이 다다미 룸 둘, 남쪽 홀(식탁 여덟·와인 랙·술 상자·붉은 러너).
  { program: "mc_izakaya", map: "izakaya", variation: {
    entrance: "izakaya-hall", above: [["izakaya-kitchen", "izakaya-hall"], ["izakaya-tatami", "izakaya-hall"]], left: [["izakaya-kitchen", "izakaya-tatami"]], hubs: ["izakaya-hall"], palettes: [
      { "izakaya-hall": ["mci-wood-oak", "mci-wall-brick"], "izakaya-kitchen": ["mci-tile-small", "mci-wall-tile"], "izakaya-tatami": ["mci-wood-dark", "mci-wall-home"] },
      { "izakaya-hall": ["mci-concrete", "mci-wall-home"], "izakaya-kitchen": ["mci-concrete", "mci-wall-metal"], "izakaya-tatami": ["mci-wood-oak", "mci-wall-brick"] },
    ] }, rooms: [
    { kind: "izakaya-kitchen", w: 10, h: 7, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("izakaya-lantern", 1, 0), o("mci-menu-board", 3, 0), o("izakaya-lantern", 8, 0),
      o("mci-kitchen", 0, 2), o("mci-kitchen", 3, 2), o("izakaya-beer-server", 6, 2), o("rest-wine-rack", 7, 2), o("mci-fridge", 9, 2),
      o("izakaya-counter", 1, 4), o("izakaya-counter", 4, 4), ...row("mci-bar-stool", 1, 1, 6, 5),
    ] },
    { kind: "izakaya-tatami", w: 7, h: 7, floor: "mci-wood-dark", wall: "mci-wall-home", items: [
      o("izakaya-lantern", 1, 0), o("mci-art-frame", 3, 0), o("izakaya-lantern", 5, 0),
      o("mci-plant-tall", 0, 2), o("rest-coat-stand", 6, 2), o("izakaya-zashiki", 2, 3),
    ] },
    { kind: "izakaya-tatami", w: 7, h: 7, floor: "mci-wood-dark", wall: "mci-wall-home", items: [
      o("izakaya-lantern", 1, 0), o("izakaya-noren", 3, 0), o("izakaya-lantern", 5, 0),
      o("rest-coat-stand", 0, 2), o("mci-plant-tall", 6, 2), o("izakaya-zashiki", 2, 3),
    ] },
    { kind: "izakaya-hall", w: 26, h: 9, floor: "mci-wood-dark", wall: "mci-wall-home", items: [
      o("izakaya-lantern", 2, 0), o("izakaya-lantern", 6, 0), o("izakaya-lantern", 19, 0), o("izakaya-lantern", 23, 0),
      o("rest-wine-rack", 0, 2), o("mci-pallet", 24, 2), o("mci-pallet", 25, 2), o("mci-pallet", 25, 3),
      o("restaurant-table-4p", 1, 4), o("restaurant-table-4p", 5, 4), o("restaurant-table-4p", 17, 4), o("restaurant-table-4p", 21, 4),
      o("restaurant-table-4p", 1, 7), o("restaurant-table-4p", 5, 7), o("restaurant-table-4p", 17, 7), o("restaurant-table-4p", 21, 7),
      o("mci-rug", 11, 5), o("restaurant-host-podium", 15, 7),
    ] },
  ] },
  // 14. 센토(대중목욕탕) — 남쪽 탈의실(로커·남탕/여탕 노렌·우유 자판기·평상·체중계·안마의자), 가운데 대욕장(씻는 자리 두 줄·후지산 벽화 아래 탕 셋),
  // 북쪽 사우나(계단식 나무 벤치)와 노천탕(석등·화분).
  { program: "mc_sento", map: "sento", variation: {
    entrance: "sento-changing", above: [["sento-sauna", "sento-bathhall"], ["sento-bathhall", "sento-changing"]], hubs: ["sento-changing", "sento-bathhall"], palettes: [
      { "sento-changing": ["mci-wood-dark", "mci-wall-home"], "sento-bathhall": ["mci-tile-concourse", "mci-wall-tile"], "sento-sauna": ["mci-wood-oak", "mci-wall-brick"] },
      { "sento-changing": ["mci-tile-small", "mci-wall-store"], "sento-bathhall": ["mci-stone-lobby", "mci-wall-tile"], "sento-sauna": ["mci-wood-dark", "mci-wall-home"] },
    ] }, rooms: [
    { kind: "sento-sauna", w: 26, h: 7, floor: "mci-wood-oak", wall: "mci-wall-brick", items: [
      o("mci-wall-clock", 3, 0), o("mci-window-city", 17, 0), o("mci-window-city", 21, 0),
      o("gym-bleacher", 1, 3), o("gym-bleacher", 5, 3), o("hospital-water-dispenser", 10, 2),
      o("mci-plant-tall", 13, 2), o("shrine-stone-lantern", 14, 3), o("sento-bath", 17, 3), o("shrine-stone-lantern", 22, 3), o("mci-plant-tall", 25, 2), o("mci-planter", 23, 6),
    ] },
    { kind: "sento-bathhall", w: 26, h: 11, floor: "mci-tile-small", wall: "mci-wall-tile", items: [
      o("sento-fuji-mural", 7, 0), o("sento-fuji-mural", 10, 0), o("sento-fuji-mural", 13, 0), o("sento-fuji-mural", 16, 0),
      ...row("sento-wash-station", 0, 2, 3, 2), o("mci-plant-tall", 6, 2), ...row("sento-wash-station", 19, 2, 3, 2), o("mci-plant-tall", 25, 2),
      o("sento-bath", 7, 3), o("sento-bath", 11, 3), o("sento-bath", 15, 3),
      o("mci-bench-metal", 1, 7), o("mci-bench-metal", 4, 7), o("mci-bench-metal", 19, 7), o("mci-bench-metal", 22, 7),
    ] },
    { kind: "sento-changing", w: 26, h: 8, floor: "mci-wood-oak", wall: "mci-wall-home", items: [
      o("sento-noren-men", 4, 0), o("mci-wall-clock", 9, 0), o("sento-noren-women", 19, 0),
      ...row("sento-shoe-locker", 0, 2, 3, 2), o("subway-vending-machine", 7, 2), o("mci-washbasin", 16, 2), o("mci-washbasin", 17, 2), ...row("sento-shoe-locker", 20, 2, 3, 2),
      o("izakaya-zashiki", 2, 4), o("infirmary-scale", 8, 4), o("mci-armchair", 17, 5), o("mci-armchair", 18, 5), o("mci-wait-bench", 21, 5),
      o("mci-plant-tall", 0, 7), o("mci-plant-tall", 25, 7),
    ] },
  ] },
  // 15. 게임센터 — 북서 인형뽑기 구역(크레인 여섯·경품 카운터), 북동 리듬·레이싱 구역(리듬 기체·스티커 사진기·레이싱 넷), 남쪽 대전 캐비닛 열(16대)·메달 교환기.
  { program: "mc_game_center", map: "game-center", variation: {
    entrance: "game-floor", above: [["game-crane", "game-floor"], ["game-rhythm", "game-floor"]], left: [["game-crane", "game-rhythm"]], hubs: ["game-floor"], palettes: [
      { "game-floor": ["mci-carpet-office", "mci-wall-brick"], "game-crane": ["mci-vinyl-store", "mci-wall-store"], "game-rhythm": ["mci-concrete", "mci-wall-metal"] },
      { "game-floor": ["mci-vinyl-store", "mci-wall-store"], "game-crane": ["mci-carpet-office", "mci-wall-lobby"], "game-rhythm": ["mci-wood-dark", "mci-wall-brick"] },
    ] }, rooms: [
    { kind: "game-crane", w: 12, h: 9, floor: "mci-vinyl-store", wall: "mci-wall-store", items: [
      o("cinema-poster", 1, 0), o("cinema-poster", 8, 0),
      ...row("arcade-claw-machine", 0, 2, 6, 2),
      o("arcade-prize-counter", 1, 5), o("dept-glass-showcase", 7, 5), o("dept-bag-stand", 11, 5),
      o("mci-plant-tall", 0, 8), o("subway-trash-bins", 9, 8),
    ] },
    { kind: "game-rhythm", w: 12, h: 9, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("cinema-poster", 2, 0), o("cinema-poster", 9, 0),
      o("arcade-rhythm", 0, 2), o("arcade-rhythm", 2, 2), o("arcade-rhythm", 4, 2), o("arcade-purikura", 8, 2), o("arcade-purikura", 10, 2),
      o("arcade-racing-cabinet", 1, 5), o("arcade-racing-cabinet", 4, 5), o("arcade-racing-cabinet", 7, 5), o("arcade-racing-cabinet", 10, 5),
    ] },
    { kind: "game-floor", w: 25, h: 9, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("cinema-poster", 2, 0), o("cinema-poster", 20, 0),
      o("arcade-medal-changer", 0, 2), o("arcade-medal-changer", 1, 2), o("subway-vending-machine", 3, 2), o("subway-vending-machine", 19, 2), o("arcade-medal-changer", 23, 2), o("arcade-medal-changer", 24, 2),
      ...row("arcade-cabinet-pair", 2, 2, 4, 4), ...row("arcade-cabinet-pair", 15, 2, 4, 4),
      ...row("arcade-cabinet-pair", 2, 2, 4, 7), ...row("arcade-cabinet-pair", 15, 2, 4, 7),
    ] },
  ] },
  // 16. 노래방 — 복도 위로 노래방 세 칸(코너 소파·탁자·벽걸이 모니터·스피커), 남쪽 복도(안내 데스크·드링크 바·대기 소파).
  { program: "mc_karaoke", map: "karaoke-box", variation: { entrance: "karaoke-hall", above: [["karaoke-room", "karaoke-hall"]], palettes: [
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
  { program: "mc_bookstore", map: "bookstore-manga", variation: { entrance: "book-floor", left: [["book-floor", "manga-cafe"]], hubs: ["book-floor"], palettes: [
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
    { kind: "manga-cafe", w: 12, h: 12, floor: "mci-wood-dark", wall: "mci-wall-brick", items: [
      o("mci-notice-board", 9, 0),
      ...row("manga-shelf", 0, 2, 4, 2), o("mci-coffee-station", 8, 2), o("hospital-water-dispenser", 10, 2), o("mci-fridge", 11, 2),
      o("manga-booth", 2, 5), o("manga-booth", 5, 5), o("manga-booth", 8, 5), o("manga-booth", 2, 8), o("manga-booth", 5, 8), o("manga-booth", 8, 8),
      o("mci-reception", 1, 11), o("mci-plant-tall", 11, 11),
    ] },
  ] },
  // 18. 신사 — 북쪽 배전(시메나와 아래 제단·새전함·석등 넷·방석·붉은 참배 러너), 남쪽 현관(신발장·부적 진열대), 사무소.
  { program: "mc_shrine", map: "shrine-haiden", variation: {
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
  // 19. 옥상 — 남쪽 데크(계단 탑옥·자판기·벤치·피크닉 탁자·남쪽 난간 펜스), 북서 옥상 정원(화분 상자·벤치), 북동 기계실(급수탑·선반·자재).
  { program: "mc_rooftop", map: "rooftop", variation: {
    entrance: "rooftop-deck", above: [["roof-garden", "rooftop-deck"], ["roof-machine", "rooftop-deck"]], left: [["roof-garden", "roof-machine"]], hubs: ["rooftop-deck"], palettes: [
      { "rooftop-deck": ["mci-tile-concourse", "mci-wall-metal"], "roof-garden": ["mci-wood-dark", "mci-wall-brick"], "roof-machine": ["mci-concrete", "mci-wall-metal"] },
      { "rooftop-deck": ["mci-stone-lobby", "mci-wall-office"], "roof-garden": ["mci-wood-oak", "mci-wall-office"], "roof-machine": ["mci-tile-concourse", "mci-wall-brick"] },
    ] }, rooms: [
    { kind: "roof-garden", w: 12, h: 7, floor: "mci-wood-oak", wall: "mci-wall-brick", items: [
      o("mci-plant-tall", 0, 2), o("mci-planter", 2, 3), o("mci-planter", 5, 3), o("mci-planter", 8, 3), o("mci-plant-tall", 11, 2),
      o("mci-bench-metal", 2, 5), o("mci-bench-metal", 8, 5),
    ] },
    { kind: "roof-machine", w: 11, h: 7, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-ac-wall", 1, 0), o("mci-ac-wall", 5, 0),
      o("mci-rack", 8, 2), o("roof-water-tank", 1, 4), o("roof-water-tank", 4, 4), o("mci-pallet", 8, 5), o("mci-pallet", 9, 5),
    ] },
    { kind: "rooftop-deck", w: 24, h: 10, floor: "mci-concrete", wall: "mci-wall-brick", items: [
      o("roof-stair-hut", 0, 2), o("subway-vending-machine", 9, 2), o("subway-trash-bins", 14, 3), o("roof-water-tank", 21, 3),
      o("mci-bench-metal", 2, 5), o("mci-bench-metal", 6, 5),
      o("mci-cafe-chair-e", 15, 6), o("mci-cafe-table", 16, 6), o("mci-cafe-chair-w", 17, 6), o("mci-cafe-chair-e", 19, 6), o("mci-cafe-table", 20, 6), o("mci-cafe-chair-w", 21, 6),
      ...row("roof-fence", 0, 2, 5, 9), ...row("roof-fence", 14, 2, 5, 9),
    ] },
  ] },
  // 20. 파출소(코반) — 남쪽 민원실(수배 게시판·민원 데스크·대기 의자), 북서 유치장(철창 셋), 북동 휴게실(좌식석·TV·부엌).
  { program: "mc_koban", map: "koban", variation: {
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
  // 23. 학생회실 + 비품실 — ㄷ자 회의 탁자와 의자 여덟, 화이트보드, 트로피 진열장, 회장 책상, 응접 소파 / 동쪽 비품실(선반·상자·의상 행거).
  { program: "mc_council_room", map: "council-room", variation: { entrance: "council-room", left: [["council-room", "council-storage"]], palettes: [
    { "council-room": ["mci-wood-oak", "mci-wall-home"], "council-storage": ["mci-concrete", "mci-wall-metal"] },
    { "council-room": ["mci-vinyl-store", "mci-wall-lobby"], "council-storage": ["mci-wood-dark", "mci-wall-brick"] },
  ] }, rooms: [
    { kind: "council-room", w: 16, h: 11, floor: "mci-carpet-office", wall: "mci-wall-office", items: [
      o("mci-window-blind", 1, 0), o("mci-whiteboard", 6, 0), o("mci-window-blind", 12, 0),
      o("council-trophy-case", 0, 2), o("mci-shelf-office", 3, 2), o("mci-filing", 10, 2), o("council-trophy-case", 14, 2),
      ...row("mci-chair-office-s", 6, 1, 4, 4),
      o("mci-cafe-chair-e", 5, 5), o("mci-cafe-chair-e", 5, 6), o("council-table-u", 6, 5), o("mci-cafe-chair-w", 10, 5), o("mci-cafe-chair-w", 10, 6),
      o("mci-chair-office-s", 1, 7), o("mci-desk-pc-back", 1, 8), g("mci-g-laptop", 1, 8),
      o("lounge-sofa-cream", 11, 8), o("lounge-sofa-cream", 13, 8), o("mci-coffee-table", 12, 10), o("mci-plant-tall", 15, 10),
    ] },
    { kind: "council-storage", w: 7, h: 11, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-rack", 0, 2), o("mci-rack", 3, 2), o("mci-fridge", 6, 2),
      o("mci-pallet", 4, 5), o("mci-pallet", 5, 5), o("mci-pallet", 5, 6),
      o("dept-clothing-rack", 1, 8), o("mci-basket-stack", 5, 9), o("mci-pallet", 6, 10),
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
  { program: "mc_courtroom", map: "courtroom", variation: { entrance: "court-lobby", above: [["court-room", "court-lobby"]], hubs: ["court-lobby"], palettes: [
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
  { program: "mc_parking", map: "parking-garage", variation: {
    entrance: "parking-deck", above: [["parking-lobby", "parking-deck"], ["parking-utility", "parking-deck"]], left: [["parking-lobby", "parking-utility"]], hubs: ["parking-deck"], palettes: [
      { "parking-deck": ["mci-tile-concourse", "mci-wall-brick"], "parking-lobby": ["mci-stone-lobby", "mci-wall-lobby"], "parking-utility": ["mci-concrete", "mci-wall-brick"] },
      { "parking-deck": ["mci-stone-lobby", "mci-wall-office"], "parking-lobby": ["mci-tile-small", "mci-wall-tile"], "parking-utility": ["mci-tile-concourse", "mci-wall-office"] },
    ] }, rooms: [
    { kind: "parking-lobby", w: 13, h: 6, floor: "mci-stone-lobby", wall: "mci-wall-lobby", items: [
      o("mci-notice-board", 6, 0), o("mci-route-map", 9, 0),
      o("mci-elevator", 0, 2), o("mci-elevator", 3, 2), o("subway-vending-machine", 11, 2),
      o("park-pay-machine", 8, 3), o("park-pay-machine", 9, 3), o("mci-wait-bench", 1, 5), o("mci-plant-tall", 12, 5),
    ] },
    { kind: "parking-utility", w: 13, h: 6, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      o("mci-ac-wall", 8, 0),
      o("mci-rack", 0, 2), o("mci-rack", 3, 2), o("mci-filing", 11, 2),
      o("roof-water-tank", 8, 3), o("mci-pallet", 1, 5), o("mci-pallet", 2, 5), o("mci-pallet", 11, 5),
    ] },
    { kind: "parking-deck", w: 27, h: 13, floor: "mci-concrete", wall: "mci-wall-metal", items: [
      ...row("park-stall-lines", 0, 2, 2, 2), o("park-pillar", 4, 3), ...row("park-stall-lines", 8, 2, 3, 2), o("park-pillar", 14, 3), ...row("park-stall-lines", 15, 2, 2, 2), ...row("park-stall-lines", 22, 2, 2, 2),
      o("park-car-red", 0, 3), o("park-car-white", 8, 3), o("park-car-blue", 12, 3), o("park-car-white", 17, 3), o("park-car-red", 24, 3),
      ...row("park-stall-lines", 1, 2, 5, 9), o("park-pillar", 11, 10), ...row("park-stall-lines", 16, 2, 5, 9),
      o("park-car-blue", 1, 10), o("park-car-red", 5, 10), o("park-car-white", 7, 10), o("park-car-red", 16, 10), o("park-car-blue", 20, 10), o("park-car-white", 24, 10),
    ] },
  ] },
  // 30. 대학 중앙도서관 — 북서 열람실(벽 서가·서가 열 넷·스터디 램프 열람석 여덟), 북동 그룹 스터디룸(ㄷ자 탁자 둘), 남쪽 로비(대출 데스크·검색 PC·자판기).
  { program: "mc_library", map: "central-library", variation: {
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
    { kind: "library-study", w: 8, h: 13, floor: "mci-carpet-office", wall: "mci-wall-office", items: [
      o("mci-whiteboard", 3, 0),
      o("mci-shelf-office", 0, 2), o("mci-plant-tall", 7, 2),
      o("mci-cafe-chair-e", 1, 4), o("mci-cafe-chair-e", 1, 5), o("council-table-u", 2, 4), o("mci-cafe-chair-w", 6, 4), o("mci-cafe-chair-w", 6, 5),
      o("mci-cafe-chair-e", 1, 8), o("mci-cafe-chair-e", 1, 9), o("council-table-u", 2, 8), o("mci-cafe-chair-w", 6, 8), o("mci-cafe-chair-w", 6, 9),
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
