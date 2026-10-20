// 시설 84곳 중 오락·주거·공공·교통·숙박·일본 전통·기타 - 새 견본 35곳(나머지는 기존 program 을 쓴다, facilityVenues.ts 의 FACILITY_CATALOG 참고).
// 외곽은 전부 사각형이 아니다(ㄱ·ㄴ·ㅗ·ㄷ·계단형·십자형) - 줄 배치의 `~` 가 건물 밖 빈칸이다(facilityKit.ts).
import { F, W, facility, room as R, type FacilityVenue } from "./facilityKit";

export const FACILITIES_B: readonly FacilityVenue[] = [
  // ── 오락시설 ──
  facility({ cat: "오락시설", p: "mc_pachinko", map: "pachinko-parlor", ko: "파친코", shape: "ㅗ자형", entrance: "pc-floor",
    rows: [["~", "pc-prize", "pc-office", "~"], ["void:3", "pc-floor"]],
    open: [["pc-prize", "pc-floor"]],
    rooms: [
      R("pc-prize", 12, 8, F.carpet, W.lobby, {
        hang: ["m:art-frame", "m:menu-board"],
        wall: ["arcade-prize-counter", "m:cooler", "arcade-medal-changer", "dept-glass-showcase"],
        at: [["dept-glass-showcase", 0, 6], ["dept-glass-showcase", 9, 6]],
      }),
      R("pc-office", 8, 7, F.carpet, W.office, {
        hang: ["m:wall-clock"],
        wall: ["m:filing", "m:shelf-office"],
        pair: [["m:desk-pc", "m:chair-office-s", 1, 4, 2, 1, 4, 2, "s"]],
      }),
      R("pc-floor", 30, 10, F.carpet, W.brick, {
        hang: ["m:tv-wall", "m:menu-board", "m:tv-wall", "m:menu-board", "m:tv-wall"],
        at: [
          ["arcade-medal-changer", 0, 2], ["arcade-medal-changer", 1, 2], ["subway-vending-machine", 12, 2], ["arcade-medal-changer", 27, 2], ["arcade-medal-changer", 28, 2],
          // 서쪽 연속 파친코 섬(x=1..8) + 맞닿은 스툴, 동쪽 연속 파친코 섬(x=21..28) + 맞닿은 스툴 (중앙 통로 비움)
          ["amuse-pachinko-island", 1, 4], ["amuse-pachinko-island", 5, 4],
          ...Array.from({ length: 8 }, (_, i) => ["m:bar-stool", 1 + i, 5] as const),
          ["amuse-pachinko-island", 21, 4], ["amuse-pachinko-island", 25, 4],
          ...Array.from({ length: 8 }, (_, i) => ["m:bar-stool", 21 + i, 5] as const),
          ["amuse-pachinko-island", 1, 7], ["amuse-pachinko-island", 5, 7],
          ...Array.from({ length: 8 }, (_, i) => ["m:bar-stool", 1 + i, 8] as const),
          ["amuse-pachinko-island", 21, 7], ["amuse-pachinko-island", 25, 7],
          ...Array.from({ length: 8 }, (_, i) => ["m:bar-stool", 21 + i, 8] as const),
        ],
      }),
    ] }),
  facility({ cat: "오락시설", p: "mc_manga_cafe", map: "manga-cafe", ko: "만화카페", shape: "L자형", entrance: "mg-lounge",
    rows: [["mg-booths", "~"], ["mg-lounge", "mg-shelves"]],
    open: [["mg-lounge", "mg-shelves"], ["mg-booths", "mg-lounge"]],
    rooms: [
      R("mg-booths", 14, 8, F.carpet, W.home, {
        hang: ["m:window-blind", "m:wall-clock", "m:window-blind"],
        wall: ["manga-shelf", "manga-shelf", "manga-shelf", "manga-shelf"],
        at: [
          ["manga-booth", 1, 4], ["manga-booth", 3, 4], ["manga-booth", 8, 4], ["manga-booth", 10, 4],
          ["book-table", 1, 7], ["book-table", 8, 7],
        ],
      }),
      R("mg-lounge", 12, 11, F.carpet, W.home, {
        hang: ["m:menu-board", "m:wall-clock"],
        at: [
          ["m:coffee-station", 1, 2], ["mart-drink-open", 8, 2],
          ["m:sofa", 2, 4], ["m:armchair-e", 1, 5], ["m:coffee-table", 3, 5], ["m:armchair-w", 5, 5],
          ["m:reception", 1, 8],
        ],
        pl: [10, 9],
      }),
      R("mg-shelves", 18, 9, F.carpet, W.home, {
        hang: ["m:art-frame", "m:window-blind", "m:art-frame"],
        wall: ["manga-shelf", "manga-shelf", "manga-shelf", "manga-shelf", "manga-shelf", "manga-shelf", "manga-shelf"],
        at: [
          ["book-table", 2, 4], ["book-table", 8, 4], ["book-table", 13, 4],
          ["m:armchair-e", 2, 7], ["m:coffee-table", 3, 7], ["m:armchair-w", 5, 7],
          ["m:armchair-e", 11, 7], ["m:coffee-table", 12, 7], ["m:armchair-w", 14, 7],
        ],
      }),
    ] }),
  facility({ cat: "오락시설", p: "mc_net_cafe", map: "internet-cafe", ko: "인터넷카페", shape: "계단형", entrance: "nc-lobby",
    rows: [["~", "nc-vip"], ["~", "nc-private", "nc-pc"], ["nc-lobby", "nc-open"]],
    open: [["nc-lobby", "nc-open"], ["nc-pc", "nc-open"]],
    rooms: [
      R("nc-vip", 10, 7, F.carpet, W.office, {
        hang: ["m:tv-wall", "m:wall-clock"],
        wall: ["m:fridge", "m:shelf-office", "manga-shelf"],
        pair: [["m:desk-pc", "m:chair-office-s", 1, 4, 2, 1, 5, 2, "s"]],
        at: [["m:coffee-table", 4, 6]],
      }),
      R("nc-private", 10, 7, F.carpet, W.office, {
        hang: ["m:window-blind", "m:wall-clock"],
        wall: ["m:shelf-office", "manga-shelf", "manga-shelf"],
        at: [["manga-booth", 1, 4], ["manga-booth", 5, 4], ["manga-booth", 7, 4]],
      }),
      R("nc-pc", 16, 7, F.carpet, W.office, {
        hang: ["m:tv-wall", "m:tv-wall", "m:wall-clock"],
        at: [["m:shelf-office", 1, 2], ["m:shelf-office", 6, 2], ["m:coffee-station", 13, 2]],
        pair: [["m:desk-pc", "m:chair-office-s", 2, 4, 4, 1, 3, 2, "s"]],
      }),
      R("nc-lobby", 14, 9, F.stone, W.lobby, {
        hang: ["m:menu-board", "m:wall-clock"],
        at: [
          ["subway-vending-machine", 1, 2], ["m:coffee-station", 5, 2],
          ["m:reception", 1, 4], ["m:wait-bench", 1, 6],
        ],
        pl: [12, 7],
      }),
      R("nc-open", 20, 7, F.carpet, W.office, {
        hang: ["m:tv-wall", "m:tv-wall", "m:wall-clock", "m:window-blind"],
        wall: ["m:shelf-office", "manga-shelf", "mart-drink-open", "m:shelf-office"],
        pair: [["m:desk-pc", "m:chair-office-s", 2, 4, 5, 1, 3, 2, "s"]],
      }),
    ] }),
  facility({ cat: "오락시설", p: "mc_bowling", map: "bowling-alley", ko: "볼링장", shape: "ㅗ자형", entrance: "bw-lobby",
    rows: [["~", "bw-lanes", "~"], ["bw-shoes", "bw-lobby", "bw-bar"]],
    open: [["bw-lanes", "bw-lobby"], ["bw-lobby", "bw-bar"]],
    rooms: [
      R("bw-lanes", 22, 9, F.dark, W.metal, {
        hang: ["m:tv-wall", "m:tv-wall", "m:tv-wall", "m:tv-wall"],
        at: [
          ["amuse-speaker-stack", 0, 2], ["amuse-speaker-stack", 21, 2],
          ["amuse-bowling-pins", 2, 2], ["amuse-bowling-pins", 11, 2], ["amuse-bowling-pins", 18, 2],
          ["amuse-bowling-lane", 2, 5], ["amuse-bowling-lane", 13, 5],
          ["amuse-bowling-return", 2, 8], ["m:wait-bench", 5, 8],
          ["amuse-bowling-return", 13, 8], ["m:wait-bench", 16, 8],
        ],
      }),
      R("bw-shoes", 10, 7, F.vinyl, W.store, {
        hang: ["m:menu-board", "m:wall-clock"],
        wall: ["sento-shoe-locker", "sento-shoe-locker", "sento-shoe-locker", "sento-shoe-locker"],
        rows: [[5, ["m:wait-bench", "m:wait-bench"]]],
      }),
      R("bw-lobby", 12, 9, F.stone, W.lobby, {
        hang: ["m:menu-board", "m:wall-clock"],
        at: [["arcade-medal-changer", 1, 2], ["subway-vending-machine", 9, 2], ["m:reception", 1, 4], ["m:wait-bench", 8, 6]],
        pl: [0, 7],
      }),
      R("bw-bar", 12, 7, F.dark, W.brick, {
        hang: ["m:menu-board", "izakaya-lantern"],
        wall: ["m:coffee-station", "food-drink-bar", "m:cooler"],
        bar: [["izakaya-counter", "m:bar-stool", 2, 4, 3, "s"]],
      }),
    ] }),
  facility({ cat: "오락시설", p: "mc_livehouse", map: "live-house", ko: "라이브하우스", shape: "L자형", entrance: "lh-lobby",
    rows: [["lh-stage", "lh-green", "~"], ["lh-lobby", "lh-floor"]],
    open: [["lh-stage", "lh-floor"], ["lh-lobby", "lh-floor"]],
    rooms: [
      R("lh-stage", 14, 10, F.dark, W.metal, {
        hang: ["studio-light-truss", "m:tv-wall", "studio-light-truss"],
        at: [
          ["music-amp", 0, 2], ["music-amp", 1, 2], ["aud-stage", 4, 2], ["music-amp", 12, 2], ["music-amp", 13, 2],
          ["music-guitar-stand", 2, 5], ["music-drum-kit", 6, 5], ["music-guitar-stand", 10, 5],
          ["amuse-speaker-stack", 1, 7], ["amuse-mixing-desk", 8, 7], ["amuse-speaker-stack", 12, 7],
        ],
      }),
      R("lh-green", 10, 9, F.carpet, W.home, {
        hang: ["m:wall-clock", "m:art-frame"],
        wall: ["m:wardrobe", "m:fridge", "m:coffee-station"],
        at: [
          ["m:sofa", 2, 4], ["m:coffee-table", 3, 5],
          ["m:armchair-e", 2, 7], ["m:coffee-table", 3, 7], ["m:armchair-w", 5, 7], ["music-guitar-stand", 8, 7],
        ],
      }),
      R("lh-lobby", 10, 10, F.stone, W.lobby, {
        hang: ["m:menu-board", "m:notice-board"],
        at: [["subway-vending-machine", 1, 2], ["m:reception", 1, 4], ["m:wait-bench", 1, 6]],
        pl: [8, 8],
      }),
      R("lh-floor", 22, 8, F.dark, W.metal, {
        hang: ["studio-light-truss", "music-acoustic-panel", "music-acoustic-panel", "studio-light-truss"],
        at: [
          ["food-drink-bar", 1, 2], ["m:cooler", 3, 2], ["amuse-speaker-stack", 19, 2],
          ["amuse-mixing-desk", 2, 7], ["amuse-speaker-stack", 5, 7],
        ],
        bar: [["izakaya-counter", "m:bar-stool", 2, 4, 2, "s"]],
        seat: [
          ["mci-t-wood", "m:chair-wood", 11, 4, 2, 1, { e: true, w: true }],
          ["mci-t-wood", "m:chair-wood", 17, 4, 2, 1, { e: true, w: true }],
          ["mci-t-wood", "m:chair-wood", 11, 6, 2, 1, { e: true, w: true }],
          ["mci-t-wood", "m:chair-wood", 17, 6, 2, 1, { e: true, w: true }],
        ],
      }),
    ] }),

  // ── 주거시설 ──
  facility({ cat: "주거시설", p: "mc_villa", map: "luxury-house", ko: "고급 주택", shape: "ㅗ자형(정원)", entrance: "vl-hall",
    rows: [["~", "vl-master", "~"], ["vl-living", "vl-hall", "vl-dining"]],
    open: [["vl-living", "vl-hall"], ["vl-hall", "vl-dining"]],
    rooms: [
      R("vl-master", 14, 8, F.carpet, W.home, {
        hang: ["m:window-curtain", "m:art-frame", "m:wall-clock", "m:window-curtain"],
        at: [
          ["m:wardrobe", 0, 2], ["m:bedside", 4, 2], ["hotel-king-bed", 5, 2], ["m:bedside", 8, 2], ["m:tv-stand", 11, 2],
          ["m:rug", 5, 5], ["lounge-sofa-cream", 1, 6], ["m:coffee-table", 10, 6], ["m:armchair-w", 12, 6],
        ],
      }),
      R("vl-living", 16, 9, F.dark, W.home, {
        hang: ["m:window-curtain", "m:tv-wall", "m:art-frame", "m:window-curtain"],
        wall: ["stairs-up-wall-wood", "m:shelf-office", "m:tv-stand"],
        at: [
          ["m:rug", 6, 5],
          ["m:sofa", 2, 4], ["m:armchair-e", 1, 5], ["m:coffee-table", 3, 5], ["m:armchair-w", 5, 5],
          ["m:armchair-e", 9, 5], ["m:coffee-table", 10, 5], ["m:armchair-w", 12, 5],
          ["home-floor-lamp", 1, 8], ["home-monstera", 14, 8],
        ],
      }),
      R("vl-hall", 8, 11, F.stone, W.lobby, {
        hang: ["m:art-frame", "m:wall-clock"],
        at: [
          ["home-shoe-cabinet", 0, 2], ["home-shoe-cabinet", 5, 2],
          ["home-umbrella-stand", 0, 6], ["home-genkan-shoes", 1, 7],
        ],
        pl: [7, 9],
      }),
      R("vl-dining", 14, 9, F.dark, W.home, {
        hang: ["m:window-curtain", "m:art-frame", "m:wall-clock"],
        wall: ["home-sink-counter", "m:kitchen", "m:fridge", "home-appliance-rack"],
        at: [
          ["m:chair-wood-e", 2, 5], ["home-dining-set", 3, 5], ["m:chair-wood-w", 5, 5],
          ["m:chair-wood-e", 8, 5], ["home-dining-set", 9, 5], ["m:chair-wood-w", 11, 5],
        ],
      }),
    ] }),
  facility({ cat: "주거시설", p: "mc_mansion", map: "mansion-unit", ko: "맨션", shape: "계단형", entrance: "mn-living",
    rows: [["~", "mn-study"], ["~", "mn-bed", "mn-bath"], ["mn-living", "mn-kitchen"]],
    open: [["mn-living", "mn-kitchen"]],
    rooms: [
      R("mn-study", 10, 8, F.carpet, W.office, {
        hang: ["m:window-city", "m:art-frame"],
        wall: ["book-shelf", "book-shelf", "m:shelf-office", "m:filing"],
        pair: [["m:desk-pc", "m:chair-office-s", 2, 4, 2, 1, 4, 2, "s"]],
        at: [["home-floor-lamp", 8, 6]],
      }),
      R("mn-bed", 12, 8, F.carpet, W.home, {
        hang: ["m:window-curtain", "m:wall-clock", "m:art-frame"],
        at: [
          ["m:wardrobe", 0, 2], ["m:bedside", 4, 2], ["m:bed-double", 5, 2], ["m:bedside", 7, 2], ["m:tv-stand", 8, 2],
          ["m:rug", 5, 5], ["home-floor-lamp", 1, 6], ["home-cat-bed", 9, 6],
        ],
      }),
      R("mn-bath", 8, 8, F.small, W.tile, {
        hang: ["m:window-blind"],
        wall: ["home-vanity-sink", "m:toilet", "home-washing-machine"],
        at: [["home-ofuro", 5, 4], ["home-bath-stool", 3, 5], ["home-laundry-basket", 1, 6]],
      }),
      R("mn-living", 18, 10, F.dark, W.home, {
        hang: ["m:window-city", "m:tv-wall", "m:window-city", "m:art-frame"],
        at: [
          ["home-shoe-cabinet", 0, 2], ["m:tv-stand", 6, 2], ["m:shelf-office", 15, 2],
          ["m:rug", 5, 5],
          ["m:sofa", 2, 4], ["m:armchair-e", 1, 5], ["m:coffee-table", 3, 5], ["m:armchair-w", 5, 5],
          ["m:armchair-e", 10, 5], ["m:coffee-table", 11, 5], ["m:armchair-w", 13, 5],
          ["home-monstera", 16, 7],
        ],
      }),
      R("mn-kitchen", 12, 8, F.small, W.home, {
        hang: ["m:window-city", "m:wall-clock"],
        wall: ["home-sink-counter", "m:kitchen", "m:fridge", "home-appliance-rack"],
        at: [
          ["m:chair-wood-e", 2, 4], ["home-dining-set", 3, 4], ["m:chair-wood-w", 5, 4],
          ["m:chair-wood-e", 7, 6], ["home-dining-set", 8, 6], ["m:chair-wood-w", 10, 6],
        ],
      }),
    ] }),
  facility({ cat: "주거시설", p: "mc_old_apartment", map: "old-apartment", ko: "낡은 아파트", shape: "L자형", entrance: "oa-corridor",
    rows: [["oa-room-a", "oa-room-b", "~"], ["oa-stair", "oa-corridor"]],
    open: [["oa-stair", "oa-corridor"]],
    rooms: [
      ...(["oa-room-a", "oa-room-b"] as const).map((k, i) => R(k, 9, i === 0 ? 9 : 8, F.oak, W.brick, {
        hang: ["m:window-curtain", "home-wall-ac"],
        wall: ["m:wardrobe", "home-low-shelf", "m:tv-stand"],
        at: [["home-futon", 1, 4], ["home-kotatsu", 5, 4], ["home-zabuton", 5, 6], ["home-electric-fan", 1, 6]],
      })),
      R("oa-stair", 10, 7, F.conc, W.metal, {
        hang: ["m:notice-board", "m:wall-clock"],
        wall: ["m:mailboxes", "m:mailboxes"],
        south: ["home-umbrella-stand", "home-drying-rack"],
      }),
      R("oa-corridor", 22, 9, F.conc, W.metal, {
        hang: ["m:wall-clock", "m:notice-board", "m:window-city", "m:window-city"],
        at: [
          ["m:mailboxes", 0, 2], ["m:mailboxes", 6, 2], ["home-shoe-cabinet", 11, 2], ["stairs-up-wall-stone", 15, 2], ["home-washing-machine", 19, 2],
          ["home-drying-rack", 2, 6], ["home-laundry-basket", 6, 6], ["home-drying-rack", 14, 6], ["home-umbrella-stand", 19, 6],
        ],
      }),
    ] }),
  facility({ cat: "주거시설", p: "mc_boarding_house", map: "boarding-house", ko: "하숙집", shape: "ㄷ자형(마당)", entrance: "bd-living",
    rows: [["bd-room-a", "~", "bd-room-b"], ["bd-living", "bd-kitchen"]],
    open: [["bd-living", "bd-kitchen"]],
    rooms: [
      ...(["bd-room-a", "bd-room-b"] as const).map((k, i) => R(k, 9, i === 0 ? 9 : 8, F.oak, W.home, {
        hang: ["m:window-curtain", "m:wall-clock"],
        at: [
          ["m:wardrobe", 0, 2], ["home-low-shelf", 3, 2], ["home-laptop-desk", 6, 2],
          ["home-zabuton", 6, 3], ["home-futon", 1, 5], ["home-floor-lamp", 7, 6],
        ],
      })),
      R("bd-living", 14, 10, F.oak, W.home, {
        hang: ["m:tv-wall", "m:window-curtain", "m:art-frame"],
        at: [
          ["home-shoe-cabinet", 0, 2], ["m:tv-stand", 6, 2], ["m:shelf-office", 11, 2],
          ["home-kotatsu", 2, 4], ["home-zabuton", 2, 6], ["m:sofa", 9, 5], ["home-genkan-shoes", 1, 7],
        ],
      }),
      R("bd-kitchen", 14, 8, F.small, W.home, {
        hang: ["m:window-city", "m:wall-clock"],
        at: [
          ["home-sink-counter", 0, 2], ["m:kitchen", 3, 2], ["m:fridge", 7, 2], ["home-appliance-rack", 12, 2],
          ["m:chair-wood-e", 2, 5], ["home-dining-set", 3, 5], ["m:chair-wood-w", 5, 5],
          ["m:chair-wood-e", 8, 5], ["home-dining-set", 9, 5], ["m:chair-wood-w", 11, 5],
        ],
      }),
    ] }),
  facility({ cat: "주거시설", p: "mc_sharehouse", map: "share-house", ko: "쉐어하우스", shape: "L자형", entrance: "sx-lounge",
    rows: [["sx-room-a", "sx-room-b", "~"], ["sx-kitchen", "sx-lounge"]],
    open: [["sx-kitchen", "sx-lounge"]],
    rooms: [
      ...(["sx-room-a", "sx-room-b"] as const).map((k, i) => R(k, 9, i === 0 ? 9 : 8, F.carpet, W.home, {
        hang: ["m:window-curtain", "m:wall-clock"],
        at: [
          ["m:wardrobe", 0, 2], ["m:shelf-office", 3, 2], ["home-laptop-desk", 6, 2],
          ["m:chair-office-n", 6, 3], ["m:bed-single", 1, 5], ["home-floor-lamp", 7, 6],
        ],
      })),
      R("sx-kitchen", 14, 8, F.small, W.home, {
        hang: ["m:window-city", "m:wall-clock"],
        wall: ["home-sink-counter", "m:kitchen", "m:fridge", "home-washing-machine"],
        at: [
          ["m:chair-wood-e", 2, 5], ["home-dining-set", 3, 5], ["m:chair-wood-w", 5, 5],
          ["m:chair-wood-e", 8, 5], ["home-dining-set", 9, 5], ["m:chair-wood-w", 11, 5],
        ],
      }),
      R("sx-lounge", 16, 10, F.dark, W.home, {
        hang: ["m:tv-wall", "m:window-curtain", "m:art-frame"],
        at: [
          ["m:tv-stand", 4, 2], ["m:shelf-office", 12, 2],
          ["m:rug", 3, 5],
          ["m:sofa", 2, 4], ["m:armchair-e", 1, 5], ["m:coffee-table", 3, 5], ["m:armchair-w", 5, 5],
          ["m:armchair-e", 10, 5], ["m:coffee-table", 11, 5], ["m:armchair-w", 13, 5],
        ],
        pl: [14, 8],
      }),
    ] }),

  // ── 공공시설 ──
  facility({ cat: "공공시설", p: "mc_police", map: "police-station", ko: "경찰서", shape: "ㄷ자형", entrance: "po-lobby",
    rows: [["po-office", "~", "po-cells"], ["po-lobby", "po-interview"]],
    open: [["po-office", "po-lobby"]],
    rooms: [
      R("po-office", 12, 9, F.carpet, W.office, {
        hang: ["koban-wanted-board", "m:wall-clock", "m:whiteboard"],
        wall: ["m:filing", "m:shelf-office", "office-copier"],
        pair: [["m:desk-pc", "m:chair-office-s", 1, 4, 3, 1, 4, 2, "s"]],
        at: [["m:wait-bench", 1, 7], ["m:wait-bench", 8, 7]],
      }),
      R("po-cells", 10, 8, F.conc, W.metal, {
        hang: ["m:wall-clock"],
        wall: ["koban-cell", "koban-cell", "koban-cell", "m:filing"],
        at: [["m:chair-office-s", 1, 4], ["koban-desk", 1, 5], ["m:bench-metal", 6, 7]],
      }),
      R("po-lobby", 18, 9, F.stone, W.lobby, {
        hang: ["koban-wanted-board", "m:notice-board", "m:wall-clock"],
        at: [
          ["m:filing", 0, 2], ["pub-atm", 13, 2], ["m:coffee-station", 15, 2],
          ["koban-desk", 2, 4], ["koban-desk", 8, 4],
          ["m:wait-bench", 1, 6], ["m:wait-bench", 10, 6],
        ],
        pl: [16, 7],
      }),
      R("po-interview", 13, 8, F.carpet, W.office, {
        hang: ["koban-wanted-board", "m:wall-clock"],
        at: [["m:filing", 0, 2], ["m:shelf-office", 10, 2]],
        seat: [
          ["mci-t-meeting", "m:chair-office", 2, 5, 3, 1, { n: true, s: true }],
          ["mci-t-meeting", "m:chair-office", 8, 5, 3, 1, { n: true, s: true }],
        ],
      }),
    ] }),
  facility({ cat: "공공시설", p: "mc_fire_station", map: "fire-station", ko: "소방서", shape: "L자형", entrance: "fs-garage",
    rows: [["fs-dorm", "fs-office", "~"], ["void:3", "fs-garage"]],
    open: [["fs-office", "fs-garage"]],
    rooms: [
      R("fs-dorm", 10, 9, F.oak, W.home, {
        hang: ["m:wall-clock", "m:window-blind"],
        wall: ["pub-fire-locker", "pub-fire-locker", "m:wardrobe"],
        grid: [["m:bed-single", 1, 4, 3, 1, 3, 2]],
        at: [["home-drying-rack", 1, 7], ["home-laundry-basket", 8, 7]],
      }),
      R("fs-office", 10, 8, F.carpet, W.office, {
        hang: ["m:whiteboard", "m:wall-clock"],
        wall: ["m:filing", "m:shelf-office", "m:coffee-station"],
        pair: [["m:desk-pc", "m:chair-office-s", 1, 4, 2, 1, 5, 2, "s"]],
        at: [["lounge-sofa-cream", 1, 7], ["m:coffee-table", 7, 7]],
      }),
      R("fs-garage", 32, 9, F.conc, W.metal, {
        openFloor: true,
        hang: ["m:wall-clock", "m:notice-board", "m:ac-wall", "m:ac-wall"],
        at: [
          ["pub-fire-locker", 0, 2], ["pub-fire-locker", 2, 2], ["pub-fire-locker", 9, 2], ["m:rack", 20, 2], ["m:rack", 28, 2],
          ["pub-fire-truck", 2, 4], ["pub-fire-truck", 11, 4], ["pub-fire-truck", 22, 4],
          ["m:pallet", 29, 8], ["m:pallet", 30, 8],
        ],
      }),
    ] }),
  facility({ cat: "공공시설", p: "mc_city_hall", map: "city-hall", ko: "시청", shape: "계단형", entrance: "ch-lobby",
    rows: [["~", "ch-mayor"], ["~", "ch-office", "ch-council"], ["ch-lobby", "ch-service"]],
    open: [["ch-lobby", "ch-service"]],
    rooms: [
      R("ch-mayor", 10, 8, F.carpet, W.office, {
        hang: ["m:art-frame", "court-emblem", "m:wall-clock"],
        wall: ["m:shelf-office", "council-trophy-case"],
        at: [
          ["m:chair-office-s", 2, 4], ["m:desk-pc-back", 2, 5],
          ["lounge-sofa-cream", 6, 4], ["m:coffee-table", 6, 6],
        ],
      }),
      R("ch-office", 12, 8, F.carpet, W.office, {
        hang: ["m:whiteboard", "m:wall-clock", "m:notice-board"],
        wall: ["m:filing", "m:shelf-office", "office-copier"],
        pair: [["m:desk-pc", "m:chair-office-s", 1, 4, 3, 1, 4, 2, "s"]],
        at: [["m:wait-bench", 1, 7], ["m:wait-bench", 8, 7]],
      }),
      R("ch-council", 12, 8, F.dark, W.office, {
        hang: ["court-emblem", "m:wall-clock"],
        at: [
          ["council-trophy-case", 0, 2], ["m:shelf-office", 9, 2],
          ["m:plant-tall", 0, 4], ["council-table-u", 4, 3], ["m:planter", 9, 4],
          ["court-gallery-pew", 1, 6], ["court-gallery-pew", 5, 6], ["court-gallery-pew", 8, 6],
        ],
      }),
      R("ch-lobby", 18, 12, F.stone, W.lobby, {
        hang: ["m:notice-board", "m:wall-clock", "m:art-frame", "court-emblem"],
        at: [
          ["m:elevator", 1, 2], ["m:elevator", 4, 2], ["subway-vending-machine", 9, 2], ["pub-atm", 13, 2], ["pub-atm", 15, 2],
          ["m:reception", 2, 5], ["dept-directory-kiosk", 7, 5], ["pub-ticket-dispenser", 11, 5], ["dept-directory-kiosk", 15, 5],
          ["hosp-wait-row-n", 2, 8], ["hosp-wait-row-n", 7, 8], ["m:wait-bench", 12, 8],
          ["m:wait-bench", 2, 10], ["m:coffee-table", 7, 10], ["m:wait-bench", 13, 10],
        ],
        pl: [16, 10],
      }),
      R("ch-service", 18, 10, F.stone, W.lobby, {
        hang: ["hosp-number-display", "m:wall-clock", "hosp-number-display", "m:notice-board"],
        wall: ["m:filing", "m:shelf-office", "office-copier", "m:filing"],
        queue: [["pub-service-window", 2, 5, 4, "m:wait-bench", 8, 3]],
        at: [["pub-ticket-dispenser", 14, 5], ["dept-directory-kiosk", 14, 8]],
      }),
    ] }),
  facility({ cat: "공공시설", p: "mc_ward_office", map: "ward-office", ko: "구청", shape: "ㅗ자형", entrance: "wd-lobby",
    rows: [["~", "wd-office", "~"], ["wd-welfare", "wd-lobby", "wd-resident"]],
    open: [["wd-welfare", "wd-lobby"], ["wd-lobby", "wd-resident"]],
    rooms: [
      R("wd-office", 14, 8, F.carpet, W.office, {
        hang: ["m:whiteboard", "m:wall-clock", "m:notice-board"],
        wall: ["m:filing", "m:shelf-office", "office-copier", "m:coffee-station"],
        pair: [["m:desk-pc", "m:chair-office-s", 1, 4, 4, 1, 3, 2, "s"]],
        at: [["m:wait-bench", 1, 7], ["m:wait-bench", 10, 7]],
      }),
      R("wd-welfare", 12, 10, F.stone, W.lobby, {
        hang: ["hosp-number-display", "m:notice-board", "m:wall-clock"],
        wall: ["m:filing", "m:shelf-office", "office-copier"],
        queue: [["pub-service-window", 1, 6, 2, "m:wait-bench", 8, 2]],
        at: [["pub-ticket-dispenser", 0, 7]],
      }),
      R("wd-lobby", 12, 12, F.stone, W.lobby, {
        hang: ["m:wall-clock", "m:art-frame", "court-emblem"],
        at: [
          ["subway-vending-machine", 1, 2], ["pub-atm", 8, 2], ["pub-atm", 10, 2],
          ["m:reception", 1, 4], ["dept-directory-kiosk", 9, 4],
          ["m:wait-bench", 1, 7], ["m:wait-bench", 8, 7],
        ],
        pl: [0, 10],
      }),
      R("wd-resident", 12, 10, F.stone, W.lobby, {
        hang: ["hosp-number-display", "m:notice-board", "m:wall-clock"],
        wall: ["m:filing", "office-copier", "m:shelf-office"],
        queue: [["pub-service-window", 2, 6, 2, "m:wait-bench", 8, 2]],
        at: [["pub-ticket-dispenser", 11, 7]],
      }),
    ] }),
  facility({ cat: "공공시설", p: "mc_post_office", map: "post-office", ko: "우체국", shape: "L자형", entrance: "pt-lobby",
    rows: [["pt-sorting", "~"], ["pt-lobby", "pt-counter"]],
    open: [["pt-lobby", "pt-counter"]],
    rooms: [
      R("pt-sorting", 14, 8, F.conc, W.metal, {
        hang: ["m:notice-board", "m:wall-clock"],
        wall: ["m:rack", "m:rack", "m:filing"],
        rows: [[4, ["pub-mail-sort", "pub-mail-sort", "pub-mail-sort"]]],
        south: ["m:pallet", "m:pallet", "m:basket-stack", "m:pallet"],
      }),
      R("pt-lobby", 16, 12, F.stone, W.lobby, {
        hang: ["m:notice-board", "m:wall-clock", "m:art-frame"],
        at: [
          ["m:mailboxes", 1, 2], ["m:mailboxes", 3, 2], ["pub-atm", 10, 2], ["subway-vending-machine", 12, 2],
          ["pub-ticket-dispenser", 0, 5], ["m:wait-bench", 1, 7], ["m:wait-bench", 10, 7],
        ],
        pl: [0, 10],
      }),
      R("pt-counter", 12, 10, F.stone, W.lobby, {
        hang: ["hosp-number-display", "m:wall-clock"],
        wall: ["m:filing", "m:shelf-office", "m:filing"],
        queue: [["pub-service-window", 2, 6, 2, "m:wait-bench", 8, 2]],
      }),
    ] }),
  facility({ cat: "공공시설", p: "mc_bank_hall", map: "bank-branch", aliases: ["bank"], ko: "은행", shape: "L자형(거꾸로)", entrance: "bk-hall",
    rows: [["~", "bk-vault"], ["bk-hall", "bk-office"]],
    open: [["bk-hall", "bk-office"]],
    rooms: [
      R("bk-vault", 10, 8, F.conc, W.metal, {
        hang: ["m:wall-clock"],
        wall: ["pub-vault-door", "m:rack", "m:filing"],
        seat: [["mci-t-meeting", "m:chair-office", 3, 4, 3, 1, { n: true, s: true }]],
        at: [["library-shelf", 0, 6], ["library-shelf", 7, 6]],
      }),
      R("bk-hall", 22, 11, F.stone, W.lobby, {
        hang: ["hosp-number-display", "m:wall-clock", "m:notice-board"],
        at: [
          ["m:filing", 2, 2], ["m:shelf-office", 6, 2], ["office-copier", 11, 2], ["pub-atm", 16, 2], ["pub-atm", 18, 2], ["pub-atm", 20, 2],
          ["m:chair-office-s", 3, 4], ["m:chair-office-s", 6, 4], ["m:chair-office-s", 9, 4], ["m:chair-office-s", 12, 4],
          ["m:teller", 2, 5], ["m:teller", 5, 5], ["m:teller", 8, 5], ["m:teller", 11, 5],
          ["pub-ticket-dispenser", 15, 5], ["dept-directory-kiosk", 19, 5],
          ["hosp-wait-row-n", 3, 7], ["hosp-wait-row-n", 9, 7], ["m:wait-bench", 16, 7],
          ["hosp-wait-row-n", 3, 9], ["hosp-wait-row-n", 9, 9], ["m:coffee-table", 16, 9],
        ],
        pl: [20, 9],
      }),
      R("bk-office", 12, 9, F.carpet, W.office, {
        hang: ["m:whiteboard", "m:wall-clock"],
        at: [["m:filing", 0, 2], ["m:shelf-office", 9, 2]],
        pair: [["m:desk-pc", "m:chair-office-s", 1, 4, 2, 1, 6, 2, "s"]],
        rows: [[7, ["lounge-sofa-cream", "m:coffee-table", "lounge-sofa-cream"]]],
      }),
    ] }),

  // ── 교통시설 ──
  facility({ cat: "교통시설", p: "mc_jr_station", map: "jr-station", ko: "JR 기차역", shape: "ㅗ자형", entrance: "jr-concourse",
    rows: [["~", "jr-platform", "~"], ["jr-ticket", "jr-concourse", "jr-shop"]],
    open: [["jr-ticket", "jr-concourse"], ["jr-platform", "jr-concourse"]],
    rooms: [
      R("jr-platform", 24, 8, F.conc, W.tile, {
        openFloor: true,
        hang: ["station-name-sign", "station-timetable", "station-name-sign", "station-timetable"],
        wall: ["subway-vending-machine", "station-coin-lockers", "subway-vending-machine"],
        at: [
          ["m:bench-metal", 3, 4], ["subway-pillar-sign", 6, 4], ["m:bench-metal", 8, 4],
          ["m:bench-metal", 14, 4], ["subway-pillar-sign", 17, 4], ["m:bench-metal", 19, 4],
          ...Array.from({ length: 12 }, (_, i) => ["station-platform-edge", i * 2, 6] as const),
        ],
      }),
      R("jr-ticket", 12, 8, F.tile, W.tile, {
        hang: ["m:route-map", "station-timetable", "m:wall-clock"],
        wall: ["subway-ticket-machine", "subway-ticket-machine", "station-ic-charger", "subway-ticket-machine"],
        rows: [[6, ["m:wait-bench", "m:wait-bench"]]],
      }),
      R("jr-concourse", 16, 9, F.tile, W.tile, {
        hang: ["station-name-sign", "m:route-map", "tr-flight-board"],
        at: [
          ["station-coin-lockers", 0, 2], ["m:elevator", 13, 2],
          ["m:bench-metal", 2, 3], ["m:bench-metal", 11, 3],
          // 개찰구 차단선 (벽에서 벽까지 균일 간격 게이트 배리어, 중앙 통로 확보)
          ["m:ticket-gate", 0, 5], ["m:ticket-gate", 2, 5], ["m:ticket-gate", 4, 5],
          ["m:ticket-gate", 9, 5], ["m:ticket-gate", 11, 5], ["m:teller", 13, 5],
          ["m:wait-bench", 2, 7], ["m:wait-bench", 11, 7],
        ],
      }),
      R("jr-shop", 12, 8, F.vinyl, W.store, {
        hang: ["m:menu-board", "m:wall-clock"],
        wall: ["konbini-bento", "mart-drink-open", "konbini-magazine-rack", "mart-dairy-open"],
        rows: [[4, ["mart-gondola-snack", "mart-gondola-tea"]], [6, ["konbini-counter", "m:counter-register"]]],
      }),
    ] }),
  facility({ cat: "교통시설", p: "mc_bus_terminal", map: "bus-terminal", ko: "버스터미널", shape: "ㄷ자형", entrance: "bs-hall",
    rows: [["bs-bay", "~", "bs-office"], ["bs-hall", "void:3"]],
    open: [["bs-bay", "bs-hall"]],
    rooms: [
      R("bs-bay", 16, 10, F.conc, W.metal, {
        openFloor: true,
        hang: ["station-name-sign", "station-timetable", "station-name-sign"],
        at: [["park-bus-e", 1, 3], ["tr-bus-bay", 11, 3], ["park-bus-e", 1, 6], ["tr-bus-bay", 11, 6], ["park-pillar", 14, 7]],
      }),
      R("bs-office", 10, 9, F.carpet, W.office, {
        hang: ["m:wall-clock", "m:notice-board"],
        wall: ["m:filing", "m:shelf-office", "m:coffee-station"],
        pair: [["m:desk-pc", "m:chair-office-s", 1, 4, 2, 1, 5, 2, "s"]],
        at: [["m:wait-bench", 1, 7], ["m:wait-bench", 6, 7]],
      }),
      R("bs-hall", 36, 8, F.tile, W.tile, {
        hang: ["station-name-sign", "m:route-map", "station-timetable", "tr-flight-board", "m:wall-clock"],
        at: [
          ["subway-ticket-machine", 1, 2], ["subway-ticket-machine", 3, 2], ["station-coin-lockers", 11, 2],
          ["subway-vending-machine", 20, 2], ["konbini-atm", 25, 2], ["m:coffee-station", 33, 2],
          ["m:ticket-gate", 2, 4], ["m:ticket-gate", 5, 4], ["m:ticket-gate", 11, 4], ["m:ticket-gate", 20, 4], ["m:ticket-gate", 26, 4],
          ["m:bench-metal", 2, 6], ["m:bench-metal", 6, 6], ["m:bench-metal", 11, 6],
          ["m:bench-metal", 20, 6], ["m:bench-metal", 24, 6], ["subway-trash-bins", 32, 6],
        ],
      }),
    ] }),
  facility({ cat: "교통시설", p: "mc_airport", map: "airport-terminal", ko: "공항", shape: "계단형", entrance: "ap-checkin",
    rows: [["~", "ap-gate"], ["~", "ap-security", "ap-lounge"], ["ap-checkin", "ap-arrival"]],
    open: [["ap-checkin", "ap-arrival"], ["ap-security", "ap-gate"]],
    rooms: [
      R("ap-gate", 16, 8, F.stone, W.lobby, {
        hang: ["tr-flight-board", "m:window-city", "m:window-city", "m:wall-clock"],
        wall: ["subway-vending-machine", "_", "m:coffee-station"],
        at: [
          ["hosp-wait-row-n", 2, 4], ["hosp-wait-row-n", 6, 4], ["hosp-wait-row-n", 11, 4],
          ["hosp-wait-row-s", 2, 6], ["hosp-wait-row-s", 11, 6],
          ["m:reception", 6, 7],
        ],
      }),
      R("ap-security", 12, 8, F.tile, W.tile, {
        hang: ["m:wall-clock", "m:notice-board"],
        at: [
          ["tr-xray-lane", 1, 4], ["tr-xray-lane", 6, 4],
          ["m:security-gate", 4, 6], ["m:security-gate", 9, 6], ["m:basket-stack", 0, 6],
        ],
      }),
      R("ap-lounge", 14, 8, F.carpet, W.lobby, {
        hang: ["tr-flight-board", "m:art-frame", "m:window-city"],
        wall: ["m:coffee-station", "mart-drink-open", "m:tv-stand"],
        at: [
          ["lounge-sofa-cream", 2, 4], ["m:coffee-table", 2, 5], ["lounge-sofa-cream", 6, 4],
          ["m:armchair-e", 8, 6], ["m:coffee-table", 9, 6], ["m:armchair-w", 11, 6],
        ],
        pl: [12, 7],
      }),
      R("ap-checkin", 22, 11, F.stone, W.lobby, {
        hang: ["tr-flight-board", "tr-flight-board", "m:wall-clock", "m:route-map"],
        at: [
          ["m:elevator", 1, 2], ["pub-atm", 6, 2], ["subway-vending-machine", 12, 2], ["station-coin-lockers", 15, 2],
          ["tr-checkin-counter", 1, 4], ["tr-checkin-counter", 7, 4], ["tr-checkin-counter", 13, 4],
          ["hotel-luggage-cart", 2, 7], ["hotel-luggage-cart", 16, 7],
        ],
        pl: [0, 9],
      }),
      R("ap-arrival", 20, 9, F.stone, W.lobby, {
        hang: ["tr-flight-board", "m:wall-clock", "m:art-frame"],
        wall: ["m:reception", "_", "subway-vending-machine", "station-coin-lockers"],
        at: [
          ["tr-baggage-belt", 2, 4], ["tr-baggage-belt", 9, 4], ["tr-baggage-belt", 15, 4],
          ["hotel-luggage-cart", 2, 7], ["m:wait-bench", 8, 7], ["hotel-luggage-cart", 17, 7],
        ],
      }),
    ] }),
  facility({ cat: "교통시설", p: "mc_gas_station", map: "gas-station", ko: "주유소", shape: "L자형", entrance: "gs-pumps",
    rows: [["gs-office", "gs-shop", "~"], ["void:3", "gs-pumps"]],
    open: [["gs-shop", "gs-pumps"]],
    rooms: [
      R("gs-office", 10, 8, F.carpet, W.office, {
        hang: ["m:wall-clock", "m:notice-board"],
        wall: ["m:filing", "m:shelf-office"],
        pair: [["m:desk-pc", "m:chair-office-s", 1, 4, 2, 1, 5, 2, "s"]],
      }),
      R("gs-shop", 14, 7, F.vinyl, W.store, {
        hang: ["m:menu-board", "m:wall-clock"],
        wall: ["mart-drink-open", "konbini-magazine-rack", "m:cooler", "mart-dairy-open"],
        at: [["mart-gondola-snack", 2, 4], ["mart-gondola-water", 9, 4], ["m:counter-register", 1, 6]],
      }),
      R("gs-pumps", 38, 9, F.conc, W.metal, {
        openFloor: true,
        hang: ["m:menu-board", "m:wall-clock", "m:menu-board", "m:wall-clock"],
        at: [
          ["tr-fuel-pump", 2, 3], ["park-sedan-white-e", 1, 6],
          ["tr-fuel-pump", 11, 3], ["park-sedan-red-w", 10, 6],
          ["tr-fuel-pump", 22, 3], ["park-sedan-white-e", 21, 6],
          ["tr-fuel-pump", 31, 3], ["park-sedan-red-w", 30, 6],
        ],
      }),
    ] }),

  // ── 숙박시설 ──
  facility({ cat: "숙박시설", p: "mc_luxury_hotel", map: "luxury-hotel", ko: "고급호텔", shape: "ㅗ자형", entrance: "lx-lobby",
    rows: [["~", "lx-suite", "~"], ["lx-restaurant", "lx-lobby", "lx-spa"]],
    open: [["lx-restaurant", "lx-lobby"]],
    rooms: [
      R("lx-suite", 16, 8, F.carpet, W.lobby, {
        hang: ["m:window-curtain", "m:art-frame", "m:window-curtain", "m:wall-clock"],
        at: [
          ["m:wardrobe", 0, 2], ["m:bedside", 5, 2], ["hotel-king-bed", 6, 2], ["m:bedside", 9, 2], ["m:tv-stand", 11, 2], ["m:fridge", 14, 2],
          ["m:rug", 2, 5], ["lounge-sofa-cream", 2, 4], ["m:coffee-table", 2, 6],
          ["m:armchair-e", 11, 5], ["m:coffee-table", 12, 5], ["m:armchair-w", 14, 5],
        ],
      }),
      R("lx-restaurant", 14, 8, F.dark, W.brick, {
        hang: ["m:art-frame", "m:menu-board", "m:window-curtain"],
        wall: ["rest-wine-rack", "m:coffee-station", "rest-wine-rack", "m:cooler"],
        at: [
          ["restaurant-table-4p", 2, 4], ["restaurant-table-4p", 8, 4],
          ["restaurant-table-4p", 2, 6], ["restaurant-table-4p", 8, 6],
        ],
      }),
      R("lx-lobby", 16, 10, F.stone, W.lobby, {
        hang: ["hotel-key-rack", "m:wall-clock", "m:art-frame"],
        at: [
          ["m:elevator", 0, 2], ["m:elevator", 2, 2], ["m:elevator", 12, 2],
          ["hotel-bell-desk", 2, 4],
          ["m:rug", 10, 6], ["lounge-sofa-cream", 10, 5], ["m:coffee-table", 10, 7],
          ["hotel-luggage-cart", 2, 7], ["hotel-luggage-cart", 4, 7],
        ],
        pl: [14, 8],
      }),
      R("lx-spa", 12, 9, F.small, W.tile, {
        hang: ["m:window-blind", "m:wall-clock"],
        wall: ["home-vanity-sink", "home-vanity-sink", "m:washbasin", "home-vanity-sink"],
        at: [
          ["clinic-acupuncture-bed", 1, 4], ["clinic-acupuncture-bed", 5, 4], ["clinic-acupuncture-bed", 9, 4],
          ["clinic-acupuncture-bed", 1, 6], ["clinic-acupuncture-bed", 5, 6], ["clinic-acupuncture-bed", 9, 6],
          ["home-drying-rack", 2, 8], ["home-bath-stool", 9, 8],
        ],
      }),
    ] }),
  facility({ cat: "숙박시설", p: "mc_capsule_hotel", map: "capsule-hotel", ko: "캡슐호텔", shape: "계단형", entrance: "cp-lobby",
    rows: [["~", "cp-pods-b"], ["cp-pods-a", "cp-bath"], ["cp-lobby", "cp-lounge"]],
    open: [["cp-lobby", "cp-lounge"]],
    rooms: [
      R("cp-pods-b", 16, 7, F.carpet, W.metal, {
        hang: ["m:wall-clock", "m:notice-board"],
        at: [
          ["hotel-capsule-pods", 0, 2], ["hotel-capsule-pods", 3, 2], ["hotel-capsule-pods", 6, 2], ["hotel-capsule-pods", 9, 2], ["sento-shoe-locker", 13, 2],
          ["m:bench-metal", 4, 5], ["m:bench-metal", 9, 5], ["m:bench-metal", 13, 5],
        ],
      }),
      R("cp-pods-a", 16, 7, F.carpet, W.metal, {
        hang: ["m:wall-clock", "m:notice-board"],
        at: [
          ["hotel-capsule-pods", 0, 2], ["hotel-capsule-pods", 3, 2], ["hotel-capsule-pods", 6, 2], ["hotel-capsule-pods", 9, 2],
          ["m:bench-metal", 1, 5], ["m:bench-metal", 10, 5],
        ],
      }),
      R("cp-bath", 12, 7, F.small, W.tile, {
        hang: ["sento-noren-men", "sento-noren-women"],
        at: [
          ["sento-wash-station", 0, 2], ["home-bath-stool", 0, 3],
          ["sento-wash-station", 2, 2], ["home-bath-stool", 2, 3],
          ["sento-wash-station", 4, 2], ["home-bath-stool", 4, 3],
          ["m:toilet", 10, 2], ["sento-bath", 6, 4],
        ],
      }),
      R("cp-lobby", 14, 9, F.stone, W.lobby, {
        hang: ["hotel-key-rack", "m:wall-clock", "m:menu-board"],
        at: [
          ["sento-shoe-locker", 0, 2], ["sento-shoe-locker", 2, 2], ["subway-vending-machine", 9, 2], ["subway-vending-machine", 11, 2],
          ["m:reception", 1, 4], ["m:wait-bench", 9, 6],
        ],
        pl: [0, 7],
      }),
      R("cp-lounge", 14, 7, F.carpet, W.home, {
        hang: ["m:tv-wall", "m:art-frame"],
        wall: ["m:coffee-station", "m:fridge", "manga-shelf", "manga-shelf"],
        at: [
          ["m:sofa", 2, 4], ["m:armchair-e", 1, 5], ["m:coffee-table", 3, 5], ["m:armchair-w", 5, 5],
          ["m:armchair-e", 8, 5], ["m:coffee-table", 9, 5], ["m:armchair-w", 11, 5],
        ],
      }),
    ] }),
  facility({ cat: "숙박시설", p: "mc_ryokan", map: "ryokan", ko: "료칸", shape: "ㄷ자형(정원)", entrance: "ry-hall",
    rows: [["ry-guest-a", "~", "ry-guest-b"], ["ry-hall", "ry-bath"]],
    open: [["ry-guest-a", "ry-hall"]],
    rooms: [
      ...(["ry-guest-a", "ry-guest-b"] as const).map((k, i) => R(k, 10, i === 0 ? 9 : 8, F.oak, W.home, {
        hang: ["m:window-curtain", "m:wall-clock"],
        at: [
          ["jp-tokonoma", 0, 2], ["jp-shoji-screen", 6, 2],
          ["home-tatami-h", 1, 4], ["home-futon", 1, 4],
          ["home-tatami-h", 5, 4], ["home-chabudai", 6, 4], ["home-zabuton", 6, 6],
        ],
      })),
      R("ry-hall", 24, 9, F.oak, W.home, {
        hang: ["hotel-key-rack", "m:art-frame", "m:wall-clock", "izakaya-lantern"],
        at: [
          ["sento-shoe-locker", 0, 2], ["sento-shoe-locker", 2, 2], ["jp-tokonoma", 7, 2], ["jp-shoji-screen", 15, 2], ["sento-shoe-locker", 20, 2],
          ["m:reception", 1, 4],
          ["home-tatami-h", 6, 4], ["home-chabudai", 7, 4], ["home-zabuton", 7, 6],
          ["home-tatami-h", 15, 4], ["home-chabudai", 16, 4], ["home-zabuton", 16, 6],
        ],
      }),
      R("ry-bath", 12, 8, F.small, W.tile, {
        hang: ["sento-noren-men", "sento-noren-women"],
        at: [
          ["sento-wash-station", 0, 2], ["home-bath-stool", 0, 3],
          ["sento-wash-station", 2, 2], ["home-bath-stool", 2, 3],
          ["sento-wash-station", 9, 2], ["home-bath-stool", 9, 3],
          ["jp-rock-bath", 4, 5],
        ],
      }),
    ] }),
  facility({ cat: "숙박시설", p: "mc_minpaku", map: "minpaku", ko: "민박", shape: "L자형", entrance: "mp-living",
    rows: [["mp-room", "~"], ["mp-living", "mp-kitchen"]],
    open: [["mp-living", "mp-kitchen"]],
    rooms: [
      R("mp-room", 10, 8, F.oak, W.home, {
        hang: ["m:window-curtain", "m:wall-clock"],
        at: [
          ["jp-tokonoma", 0, 2], ["m:wardrobe", 5, 2], ["home-laptop-desk", 7, 2],
          ["home-zabuton", 7, 3], ["home-tatami-h", 1, 4], ["home-futon", 1, 4], ["home-futon", 4, 4], ["home-floor-lamp", 8, 6],
        ],
      }),
      R("mp-living", 14, 10, F.oak, W.home, {
        hang: ["m:tv-wall", "m:art-frame", "m:window-curtain"],
        at: [
          ["home-shoe-cabinet", 0, 2], ["m:tv-stand", 6, 2], ["m:shelf-office", 10, 2], ["home-washing-machine", 12, 2],
          ["home-tatami-h", 1, 4], ["home-kotatsu", 2, 4], ["home-zabuton", 2, 6],
          ["m:sofa", 8, 5], ["m:coffee-table", 9, 6],
        ],
      }),
      R("mp-kitchen", 10, 8, F.small, W.home, {
        hang: ["m:window-city", "m:wall-clock"],
        wall: ["home-sink-counter", "m:kitchen", "m:fridge", "home-appliance-rack"],
        at: [["m:chair-wood-e", 2, 5], ["home-dining-set", 3, 5], ["m:chair-wood-w", 5, 5]],
      }),
    ] }),

  // ── 일본 전통시설 ──
  facility({ cat: "일본 전통시설", p: "mc_temple", map: "buddhist-temple", ko: "불교 사찰", shape: "ㅗ자형", entrance: "tp-gate",
    rows: [["~", "tp-hondo", "~"], ["tp-gate", "tp-hall", "tp-office"]],
    open: [["tp-hondo", "tp-hall"], ["tp-gate", "tp-hall"]],
    rooms: [
      R("tp-hondo", 16, 9, F.dark, W.brick, {
        hang: ["izakaya-lantern", "shrine-shimenawa", "izakaya-lantern"],
        at: [
          ["jp-tokonoma", 0, 2], ["jp-shoji-screen", 13, 2],
          // 중심축 대칭: 본존 불단(x=6..8, y=3..4), 향로(x=7, y=5), 좌우 3×2 방석 블록
          ["jp-buddha-altar", 6, 2], ["jp-incense-burner", 7, 5],
          ["home-zabuton", 2, 6], ["home-zabuton", 4, 6], ["home-zabuton", 2, 7], ["home-zabuton", 4, 7],
          ["home-zabuton", 10, 6], ["home-zabuton", 12, 6], ["home-zabuton", 10, 7], ["home-zabuton", 12, 7],
        ],
      }),
      R("tp-gate", 12, 9, F.stone, W.brick, {
        hang: ["shrine-shimenawa", "izakaya-lantern"],
        at: [
          // 불교 사찰 입구: 신토 도리이 제거, 석등 남쪽 출입문 양옆 벽 밀착 + 본당 문 앞 새전함 + 출입구 옆 신발장
          ["sento-shoe-locker", 0, 2], ["sento-shoe-locker", 2, 2], ["m:washbasin", 7, 2], ["shrine-saisen-box", 9, 2],
          ["home-umbrella-stand", 0, 7], ["shrine-stone-lantern", 3, 7], ["shrine-stone-lantern", 7, 7],
        ],
      }),
      R("tp-hall", 14, 7, F.oak, W.home, {
        hang: ["m:art-frame", "m:window-curtain"],
        at: [
          ["jp-tokonoma", 0, 2], ["jp-shoji-screen", 9, 2],
          ["izakaya-zashiki", 2, 4], ["izakaya-zashiki", 9, 4],
        ],
      }),
      R("tp-office", 10, 7, F.oak, W.home, {
        hang: ["m:notice-board", "m:wall-clock"],
        at: [
          ["m:shelf-office", 0, 2], ["m:filing", 3, 2], ["home-laptop-desk", 6, 2],
          ["home-zabuton", 6, 3],
          ["izakaya-zashiki", 2, 5],
          ["jp-incense-burner", 9, 6],
        ],
      }),
    ] }),
  facility({ cat: "일본 전통시설", p: "mc_onsen", map: "onsen-bath", ko: "온천", shape: "계단형", entrance: "on-lobby",
    rows: [["~", "on-open"], ["on-bath", "on-rest"], ["on-lobby", "on-shoe"]],
    open: [["on-lobby", "on-shoe"], ["on-open", "on-bath"]],
    rooms: [
      R("on-open", 16, 9, F.conc, W.brick, {
        hang: ["sento-fuji-mural", "izakaya-lantern", "izakaya-lantern"],
        at: [
          ["jp-shoji-screen", 0, 2],
          ["sento-wash-station", 10, 2], ["home-bath-stool", 10, 3],
          ["sento-wash-station", 12, 2], ["home-bath-stool", 12, 3],
          ["shrine-stone-lantern", 0, 4], ["jp-rock-bath", 2, 5], ["jp-rock-bath", 10, 5], ["shrine-stone-lantern", 15, 4],
        ],
      }),
      R("on-bath", 14, 10, F.small, W.tile, {
        hang: ["sento-noren-men", "sento-fuji-mural", "sento-noren-women"],
        at: [
          ["sento-wash-station", 1, 2], ["home-bath-stool", 1, 3],
          ["sento-wash-station", 3, 2], ["home-bath-stool", 3, 3],
          ["sento-wash-station", 9, 2], ["home-bath-stool", 9, 3],
          ["sento-wash-station", 11, 2], ["home-bath-stool", 11, 3],
          ["sento-bath", 1, 5], ["sento-bath", 8, 5],
        ],
      }),
      R("on-rest", 16, 10, F.oak, W.home, {
        hang: ["m:art-frame", "m:window-curtain", "m:wall-clock"],
        at: [
          ["jp-tokonoma", 0, 2], ["jp-shoji-screen", 10, 2], ["m:fridge", 14, 2],
          ["home-tatami-h", 2, 4], ["home-chabudai", 3, 4], ["home-zabuton", 3, 5],
          ["home-tatami-h", 9, 4], ["home-chabudai", 10, 4], ["home-zabuton", 10, 5],
          ["home-tatami-h", 2, 7], ["home-chabudai", 3, 7], ["home-zabuton", 3, 8],
          ["home-tatami-h", 9, 7], ["home-chabudai", 10, 7], ["home-zabuton", 10, 8],
        ],
      }),
      R("on-lobby", 14, 9, F.stone, W.lobby, {
        hang: ["sento-noren-men", "m:menu-board", "m:wall-clock"],
        at: [
          ["subway-vending-machine", 1, 2], ["subway-vending-machine", 10, 2],
          ["m:reception", 1, 4], ["m:wait-bench", 9, 6],
        ],
      }),
      R("on-shoe", 16, 7, F.stone, W.lobby, {
        hang: ["m:notice-board", "m:wall-clock"],
        wall: ["sento-shoe-locker", "sento-shoe-locker", "sento-shoe-locker", "sento-shoe-locker", "sento-shoe-locker", "sento-shoe-locker"],
        rows: [[5, ["home-genkan-shoes", "m:bench-metal", "m:bench-metal", "home-umbrella-stand"]]],
      }),
    ] }),
  facility({ cat: "일본 전통시설", p: "mc_tatami_house", map: "tatami-house", ko: "전통 다다미 주택", shape: "ㄷ자형(정원)", entrance: "ta-main",
    rows: [["ta-room-a", "~", "ta-room-b"], ["ta-genkan", "ta-main"]],
    open: [["ta-genkan", "ta-main"]],
    rooms: [
      ...(["ta-room-a", "ta-room-b"] as const).map((k, i) => R(k, 10, i === 0 ? 9 : 8, F.oak, W.home, {
        hang: ["m:window-curtain", "m:wall-clock"],
        at: [
          ["jp-tokonoma", 0, 2], ["jp-shoji-screen", 6, 2],
          ["home-tatami-h", 1, 4], ["home-futon", 1, 4],
          ["home-tatami-h", 5, 4], ["home-chabudai", 6, 4], ["home-zabuton", 6, 6],
        ],
      })),
      R("ta-genkan", 8, 8, F.stone, W.home, {
        hang: ["m:wall-clock", "m:art-frame"],
        wall: ["home-shoe-cabinet", "sento-shoe-locker"],
        rows: [[5, ["home-genkan-shoes", "home-umbrella-stand"]], [7, ["shrine-stone-lantern", "home-genkan-shoes"]]],
      }),
      R("ta-main", 20, 10, F.oak, W.home, {
        hang: ["m:window-curtain", "m:art-frame", "m:tv-wall", "m:wall-clock"],
        at: [
          ["jp-tokonoma", 2, 2], ["jp-shoji-screen", 6, 2], ["m:tv-stand", 11, 2], ["m:kitchen", 16, 2], ["m:fridge", 19, 2],
          ["home-tatami-h", 2, 4], ["home-tatami-h", 6, 4],
          ["home-kotatsu", 4, 4], ["home-zabuton", 4, 6],
          ["home-tatami-h", 14, 4], ["home-chabudai", 15, 4], ["home-zabuton", 15, 6],
        ],
      }),
    ] }),
  facility({ cat: "일본 전통시설", p: "mc_tea_room", map: "tea-room", ko: "다도실", shape: "L자형", entrance: "tr-waiting",
    rows: [["tr-mizuya", "~"], ["tr-waiting", "tr-chashitsu"]],
    open: [["tr-waiting", "tr-chashitsu"]],
    rooms: [
      R("tr-mizuya", 8, 7, F.small, W.home, {
        hang: ["m:window-blind"],
        wall: ["home-sink-counter", "home-vanity-sink", "m:shelf-office"],
        south: ["home-drying-rack", "m:basket-stack"],
      }),
      R("tr-waiting", 10, 10, F.oak, W.home, {
        hang: ["m:art-frame", "m:window-curtain"],
        at: [
          ["sento-shoe-locker", 0, 2], ["jp-shoji-screen", 6, 2],
          ["home-genkan-shoes", 1, 5], ["shrine-stone-lantern", 1, 8],
          ["izakaya-zashiki", 5, 5],
        ],
      }),
      R("tr-chashitsu", 12, 8, F.oak, W.home, {
        hang: ["m:window-curtain", "izakaya-lantern"],
        at: [
          ["jp-tokonoma", 0, 2], ["jp-shoji-screen", 5, 2], ["jp-shoji-screen", 9, 2],
          ["izakaya-zashiki", 1, 4], ["izakaya-zashiki", 8, 4],
          ["jp-tea-hearth", 4, 5], ["home-zabuton", 4, 7], ["shrine-stone-lantern", 11, 6],
        ],
      }),
    ] }),

  // ── 기타 시설 ──
  facility({ cat: "기타 시설", p: "mc_factory", map: "factory-floor", ko: "공장", shape: "L자형", entrance: "fc-line",
    rows: [["fc-office", "fc-lab", "~"], ["void:3", "fc-line"]],
    open: [["fc-lab", "fc-line"]],
    rooms: [
      R("fc-office", 10, 9, F.carpet, W.office, {
        hang: ["m:wall-clock", "m:whiteboard"],
        wall: ["m:filing", "m:shelf-office", "m:coffee-station"],
        pair: [["m:desk-pc", "m:chair-office-s", 1, 4, 2, 1, 5, 2, "s"]],
        at: [["lounge-sofa-cream", 1, 7], ["m:coffee-table", 7, 7]],
      }),
      R("fc-lab", 10, 8, F.small, W.tile, {
        hang: ["m:wall-clock", "m:notice-board"],
        wall: ["lab-fume-hood", "lab-reagent-shelf", "m:washbasin"],
        pair: [["lab-bench", "m:chair-wood-n", 1, 4, 2, 1, 5, 2, "s"]],
        at: [["m:med-cart", 0, 7], ["m:basket-stack", 9, 7]],
      }),
      R("fc-line", 36, 10, F.conc, W.metal, {
        hang: ["m:wall-clock", "m:notice-board", "m:ac-wall", "m:ac-wall"],
        at: [
          ["m:rack", 0, 2], ["m:rack", 7, 2], ["m:rack", 19, 2], ["m:filing", 28, 2], ["m:rack", 32, 2],
          // 연속 컨베이어 벨트 라인 + 연속 QC/선반가공 열 + 동쪽 벽 지게차·팔레트 구역
          ["ind-conveyor", 1, 4], ["ind-conveyor", 5, 4], ["ind-conveyor", 9, 4],
          ["ind-conveyor", 1, 7], ["ind-conveyor", 5, 7], ["ind-conveyor", 9, 7],
          ["ind-lathe", 18, 7], ["ind-lathe", 21, 7], ["ind-lathe", 24, 7], ["ind-lathe", 27, 7],
          ["ind-forklift", 32, 6],
          ["m:pallet", 35, 6], ["m:pallet", 35, 7], ["m:pallet", 33, 9], ["m:pallet", 34, 9],
        ],
      }),
    ] }),
  facility({ cat: "기타 시설", p: "mc_logistics", map: "logistics-warehouse", ko: "창고", shape: "ㅗ자형", entrance: "wh-rack",
    rows: [["~", "wh-office", "~"], ["wh-rack", "wh-dock"]],
    open: [["wh-rack", "wh-dock"]],
    rooms: [
      R("wh-office", 10, 7, F.carpet, W.office, {
        hang: ["m:wall-clock", "m:notice-board"],
        wall: ["m:filing", "m:shelf-office"],
        pair: [["m:desk-pc", "m:chair-office-s", 1, 4, 2, 1, 5, 2, "s"]],
      }),
      R("wh-rack", 18, 11, F.conc, W.metal, {
        hang: ["m:wall-clock", "m:ac-wall"],
        at: [
          ["m:rack", 0, 2], ["m:rack", 4, 2], ["m:rack", 9, 2], ["m:rack", 15, 2],
          ["mci-gondola", 1, 4], ["mci-gondola", 5, 4], ["mci-gondola", 12, 4],
          ["mci-gondola", 1, 6], ["mci-gondola", 5, 6], ["mci-gondola", 12, 6],
          ["m:pallet", 1, 9], ["m:pallet", 3, 9], ["m:pallet", 15, 9], ["m:pallet", 16, 9],
        ],
      }),
      R("wh-dock", 14, 9, F.conc, W.metal, {
        hang: ["m:wall-clock", "m:notice-board"],
        wall: ["m:rack", "m:rack", "m:rack"],
        at: [
          ["ind-forklift", 2, 4], ["ind-forklift", 8, 4],
          ["m:pallet", 1, 8], ["m:pallet", 2, 8], ["m:pallet", 9, 8], ["m:pallet", 10, 8], ["m:basket-stack", 12, 8],
        ],
      }),
    ] }),
  facility({ cat: "기타 시설", p: "mc_history_museum", map: "history-museum", ko: "박물관", shape: "ㄷ자형(중정)", entrance: "hm-lobby",
    rows: [["hm-hall-a", "~", "hm-hall-b"], ["hm-lobby", "void:3"]],
    open: [["hm-hall-a", "hm-lobby"], ["hm-hall-b", "hm-lobby"]],
    rooms: [
      R("hm-hall-a", 12, 10, F.dark, W.brick, {
        hang: ["museum-painting-large", "museum-painting-large"],
        wall: ["council-trophy-case", "_", "council-trophy-case"],
        at: [
          ["art-plinth", 2, 4], ["art-plinth", 5, 4], ["art-plinth", 8, 4], ["art-plinth", 10, 4],
          ["museum-velvet-rope", 2, 5], ["museum-velvet-rope", 7, 5],
          ["museum-gallery-bench", 2, 7], ["museum-gallery-bench", 8, 7],
        ],
      }),
      R("hm-hall-b", 12, 9, F.dark, W.brick, {
        hang: ["museum-painting-large", "museum-painting-large"],
        wall: ["council-trophy-case", "_", "council-trophy-case"],
        at: [
          ["museum-statue-pedestal", 2, 4], ["museum-statue-pedestal", 8, 4],
          ["museum-velvet-rope", 1, 5], ["museum-velvet-rope", 7, 5],
          ["museum-gallery-bench", 2, 7], ["museum-gallery-bench", 8, 7],
        ],
      }),
      R("hm-lobby", 34, 8, F.stone, W.lobby, {
        hang: ["m:wall-clock", "museum-painting-large", "m:notice-board", "m:art-frame"],
        at: [
          // 서쪽 접수·카페 구역 + 동쪽 프리뷰 전시 구역
          ["m:coffee-station", 1, 2], ["m:magazine", 8, 2], ["council-trophy-case", 19, 2], ["subway-vending-machine", 31, 2],
          ["m:reception", 1, 4], ["museum-audio-desk", 8, 4],
          ["museum-statue-pedestal", 20, 4], ["museum-statue-pedestal", 25, 4], ["museum-velvet-rope", 20, 5], ["museum-velvet-rope", 24, 5],
          ["m:wait-bench", 1, 6], ["m:wait-bench", 8, 6], ["museum-gallery-bench", 21, 6], ["museum-gallery-bench", 30, 6],
        ],
        pl: [14, 7],
      }),
    ] }),
  facility({ cat: "기타 시설", p: "mc_salon", map: "hair-salon", ko: "미용실", shape: "L자형", entrance: "sl-floor",
    rows: [["sl-wash", "~"], ["sl-floor", "sl-color"]],
    open: [["sl-floor", "sl-color"]],
    rooms: [
      R("sl-wash", 10, 7, F.small, W.tile, {
        hang: ["m:wall-clock"],
        wall: ["home-vanity-sink", "m:washbasin", "home-vanity-sink"],
        rows: [[4, ["svc-salon-basin", "svc-salon-basin"]], [6, ["home-laundry-basket", "home-drying-rack"]]],
      }),
      R("sl-floor", 18, 10, F.oak, W.store, {
        hang: ["m:menu-board", "m:wall-clock", "m:art-frame"],
        at: [
          // 각 미용 의자가 거울 바로 남쪽(y=3)에 맞닿아 한 쌍을 이룬다(F3)
          ["svc-salon-mirror", 1, 2], ["svc-barber-chair", 1, 3],
          ["svc-salon-mirror", 6, 2], ["svc-barber-chair", 6, 3],
          ["svc-salon-mirror", 10, 2], ["svc-barber-chair", 10, 3],
          ["svc-salon-mirror", 14, 2], ["svc-barber-chair", 14, 3],
          ["m:wait-bench", 1, 7], ["m:counter-register", 12, 7],
        ],
        pl: [0, 8],
      }),
      R("sl-color", 10, 8, F.small, W.tile, {
        hang: ["m:wall-clock", "m:notice-board"],
        at: [
          ["svc-salon-mirror", 1, 2], ["svc-barber-chair", 1, 3],
          ["svc-salon-mirror", 6, 2], ["svc-barber-chair", 6, 3],
          ["svc-salon-basin", 2, 6], ["home-drying-rack", 6, 7],
        ],
      }),
    ] }),
  facility({ cat: "기타 시설", p: "mc_laundry", map: "laundromat", ko: "세탁소", shape: "계단형", entrance: "ld-floor",
    rows: [["~", "ld-press"], ["ld-floor", "ld-counter"]],
    open: [["ld-floor", "ld-counter"]],
    rooms: [
      R("ld-press", 10, 7, F.conc, W.metal, {
        hang: ["m:wall-clock", "m:ac-wall"],
        wall: ["home-washing-machine", "svc-dryer-stack", "m:rack"],
        south: ["home-drying-rack", "home-laundry-basket", "home-drying-rack"],
      }),
      R("ld-floor", 20, 10, F.small, W.tile, {
        hang: ["m:menu-board", "m:wall-clock", "m:window-city"],
        at: [
          ["svc-washer-row", 0, 2], ["svc-washer-row", 3, 2], ["svc-dryer-stack", 6, 2], ["svc-dryer-stack", 8, 2],
          ["svc-washer-row", 11, 2], ["svc-dryer-stack", 14, 2], ["subway-vending-machine", 17, 2],
          ["mci-gondola", 2, 5], ["home-laundry-basket", 5, 5], ["mci-gondola", 12, 5], ["home-laundry-basket", 15, 5],
          ["m:wait-bench", 2, 8], ["m:wait-bench", 13, 8],
        ],
      }),
      R("ld-counter", 10, 8, F.vinyl, W.store, {
        hang: ["m:menu-board", "m:wall-clock"],
        at: [
          ["m:rack", 0, 2], ["m:filing", 6, 2], ["m:filing", 8, 2],
          ["m:counter-register", 1, 5], ["home-drying-rack", 6, 7],
        ],
      }),
    ] }),
  facility({ cat: "기타 시설", p: "mc_realty", map: "real-estate-office", ko: "부동산", shape: "L자형", entrance: "rt-office",
    rows: [["rt-meet", "~"], ["rt-office", "rt-lobby"]],
    open: [["rt-office", "rt-lobby"]],
    rooms: [
      R("rt-meet", 10, 7, F.carpet, W.office, {
        hang: ["svc-listing-board", "m:wall-clock"],
        wall: ["m:filing", "m:shelf-office", "m:coffee-station"],
        seat: [["mci-t-meeting", "m:chair-office", 3, 4, 4, 1, { n: true, e: true, w: true }]],
      }),
      R("rt-office", 16, 10, F.carpet, W.office, {
        hang: ["svc-listing-board", "m:wall-clock", "m:notice-board", "m:art-frame"],
        at: [["m:filing", 0, 2], ["m:shelf-office", 6, 2], ["office-copier", 10, 2], ["m:coffee-station", 13, 2], ["lounge-sofa-cream", 1, 7], ["m:coffee-table", 13, 7]],
        pair: [["m:desk-pc", "m:chair-office-s", 1, 4, 3, 1, 5, 2, "s"]],
      }),
      R("rt-lobby", 10, 8, F.stone, W.lobby, {
        hang: ["svc-listing-board", "m:menu-board"],
        wall: ["m:magazine", "_", "m:coffee-station"],
        at: [["m:reception", 2, 4], ["m:wait-bench", 2, 7]],
        pl: [8, 7],
      }),
    ] }),
  facility({ cat: "기타 시설", p: "mc_underground_mall", map: "underground-mall", ko: "지하상가", shape: "십자형", entrance: "um-exit",
    rows: [["~", "um-stairs", "~"], ["um-arcade-w", "um-atrium", "um-arcade-e"], ["~", "um-exit", "~"]],
    open: [["um-stairs", "um-atrium"], ["um-arcade-w", "um-atrium"], ["um-atrium", "um-arcade-e"], ["um-atrium", "um-exit"]],
    rooms: [
      R("um-stairs", 10, 7, F.tile, W.tile, {
        hang: ["m:route-map", "m:wall-clock"],
        at: [["stairs-up-wall-stone", 0, 2], ["m:elevator", 6, 2], ["m:bench-metal", 0, 5], ["m:bench-metal", 8, 5]],
      }),
      R("um-arcade-w", 14, 8, F.tile, W.store, {
        hang: ["m:menu-board", "m:menu-board"],
        wall: ["svc-arcade-shopfront", "svc-arcade-shopfront", "svc-arcade-shopfront", "svc-arcade-shopfront"],
        at: [
          ["m:bench-metal", 3, 4], ["m:bench-metal", 8, 4],
          ["dept-glass-showcase", 1, 7], ["dept-glass-showcase", 5, 7], ["dept-glass-showcase", 10, 7],
        ],
      }),
      R("um-atrium", 12, 8, F.stone, W.lobby, {
        hang: ["m:route-map", "m:art-frame"],
        at: [
          ["subway-vending-machine", 0, 2], ["m:mailboxes", 10, 2],
          ["dept-atrium-fountain", 1, 4], ["m:bench-metal", 9, 5], ["dept-directory-kiosk", 9, 7],
        ],
      }),
      R("um-arcade-e", 14, 8, F.tile, W.store, {
        hang: ["m:menu-board", "m:menu-board"],
        wall: ["svc-arcade-shopfront", "svc-arcade-shopfront", "svc-arcade-shopfront", "svc-arcade-shopfront"],
        at: [
          ["m:bench-metal", 3, 4], ["m:bench-metal", 8, 4],
          ["dept-glass-showcase", 1, 7], ["dept-glass-showcase", 5, 7], ["dept-glass-showcase", 10, 7],
        ],
      }),
      R("um-exit", 12, 7, F.tile, W.tile, {
        hang: ["m:route-map", "station-name-sign"],
        at: [["m:elevator", 0, 2], ["station-coin-lockers", 8, 2], ["m:bench-metal", 1, 5], ["m:bench-metal", 8, 5]],
      }),
    ] }),
];
