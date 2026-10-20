// 시설 84곳 중 교육·의료·상점·음식점 - 새 견본 26곳(나머지는 기존 program 을 쓴다, facilityVenues.ts 의 FACILITY_CATALOG 참고).
// 외곽은 전부 사각형이 아니다(ㄱ·ㄴ·ㅗ·ㄷ·계단형) - 줄 배치의 `~` 가 건물 밖 빈칸이다(facilityKit.ts).
import { F, W, facility, room as R, type FacilityVenue, type FRoom } from "./facilityKit";

/** 교실 - 양끝 북벽 사물함·선반, 중앙 칠판과 그 바로 아래 맞춘 교탁, 문 통로를 비운 좌우 책상 열, 뒷벽 2칸 이상 여유. */
const cls = (kind: string, w: number, h: number, floor: string = F.oak): FRoom => {
  const bx = Math.floor((w - 3) / 2);
  const px = Math.floor((w - 2) / 2);
  const rws = Math.max(1, Math.floor((h - 4) / 2));
  const dxL = 1, dxR = w - 3;
  const cols = w >= 11 ? 3 : 2;
  const dxMid = Math.floor((w - 2) / 2);
  return R(kind, w, h, floor, W.office, {
    at: [
      ["m:window-curtain", 1, 0], ["school-blackboard", bx, 0], ["m:wall-clock", bx + 3, 0],
      ["school-cleaning-locker", 0, 2], ["m:shelf-office", w - 2, 2],
      ["school-teacher-podium", px, 3],
    ],
    desks: cols === 3
      ? [[dxL, 5, 1, rws, 3, 2], [dxMid, 5, 1, rws, 3, 2], [dxR, 5, 1, rws, 3, 2]]
      : [[dxL, 5, 1, rws, 3, 2], [dxR, 5, 1, rws, 3, 2]],
  });
};

export const FACILITIES_A: readonly FacilityVenue[] = [
  // ── 교육시설 ──
  facility({ cat: "교육시설", p: "mc_elementary", map: "elementary-school", ko: "초등학교", shape: "L자형", entrance: "el-genkan",
    rows: [["el-class-a", "el-class-b", "~"], ["el-genkan", "el-music", "el-gym"]],
    open: [["el-genkan", "el-music"]],
    rooms: [
      cls("el-class-a", 11, 10),
      cls("el-class-b", 11, 9),
      R("el-genkan", 9, 9, F.stone, W.lobby, {
        hang: ["m:notice-board", "m:wall-clock"],
        wall: ["sento-shoe-locker", "sento-shoe-locker", "_", "sento-shoe-locker"],
        at: [["home-umbrella-stand", 1, 5], ["home-school-bag", 7, 5], ["m:wait-bench", 3, 5], ["home-genkan-shoes", 1, 7], ["home-genkan-shoes", 6, 7]],
        pl: [8, 7],
      }),
      R("el-music", 9, 8, F.oak, W.office, {
        hang: ["m:whiteboard", "m:window-curtain"],
        at: [
          ["school-piano", 0, 2], ["m:shelf-office", 6, 2],
          ["music-drum-kit", 6, 4], ["music-amp", 8, 2], ["music-guitar-stand", 7, 6],
        ],
        grid: [["m:chair-wood-n", 1, 5, 3, 2, 1, 2]],
      }),
      R("el-gym", 13, 8, F.oak, W.office, {
        openFloor: true,
        hang: ["gym-scoreboard", "m:wall-clock"],
        at: [["gym-hoop", 1, 2], ["gym-hoop", 10, 2], ["gym-mat", 2, 4], ["gym-mat", 5, 4], ["gym-vault", 8, 4], ["m:wait-bench", 2, 6], ["m:wait-bench", 8, 6]],
      }),
    ] }),
  facility({ cat: "교육시설", p: "mc_middle_school", map: "middle-school", ko: "중학교", shape: "ㄷ자형", entrance: "ms-genkan",
    rows: [["ms-class-w", "~", "ms-class-e"], ["ms-genkan", "ms-staff", "ms-lab"]],
    open: [["ms-genkan", "ms-staff"]],
    rooms: [
      cls("ms-class-w", 10, 10, F.vinyl),
      cls("ms-class-e", 10, 9, F.vinyl),
      R("ms-genkan", 10, 10, F.stone, W.lobby, {
        hang: ["m:notice-board", "m:wall-clock"],
        wall: ["sento-shoe-locker", "sento-shoe-locker", "_", "sento-shoe-locker"],
        at: [["home-umbrella-stand", 1, 5], ["home-school-bag", 8, 5], ["home-genkan-shoes", 1, 6], ["home-genkan-shoes", 7, 6]],
        pl: [9, 8],
      }),
      R("ms-staff", 10, 8, F.carpet, W.office, {
        hang: ["m:whiteboard", "m:wall-clock"],
        wall: ["m:filing", "m:shelf-office", "office-copier", "m:coffee-station"],
        pair: [["m:desk-pc", "m:chair-office", 1, 4, 2, 1, 6, 4, "pod"]],
      }),
      R("ms-lab", 10, 8, F.small, W.tile, {
        hang: ["m:whiteboard", "m:wall-clock"],
        at: [["lab-fume-hood", 0, 2], ["lab-reagent-shelf", 2, 2], ["m:washbasin", 8, 2]],
        pair: [
          ["lab-bench", "m:chair-wood-n", 1, 5, 1, 1],
          ["lab-bench", "m:chair-wood-n", 6, 5, 1, 1],
        ],
      }),
    ] }),
  facility({ cat: "교육시설", p: "mc_high_school", map: "high-school", ko: "고등학교", shape: "ㅗ자형", entrance: "hs-genkan",
    rows: [["~", "hs-library", "~"], ["hs-class-a", "hs-genkan", "hs-class-b"]],
    open: [["hs-library", "hs-genkan"]],
    rooms: [
      R("hs-library", 14, 9, F.carpet, W.office, {
        hang: ["m:window-blind", "m:wall-clock", "m:window-blind"],
        wall: ["book-shelf", "book-shelf", "book-shelf", "book-shelf", "book-shelf", "book-shelf"],
        grid: [["library-shelf", 1, 4, 1, 2, 4, 2], ["library-carrel", 9, 4, 2, 2, 2, 2]],
        at: [["library-loan-desk", 1, 8]],
      }),
      cls("hs-class-a", 12, 9, F.vinyl),
      cls("hs-class-b", 12, 9, F.vinyl),
      R("hs-genkan", 10, 11, F.stone, W.lobby, {
        hang: ["m:notice-board", "m:wall-clock", "m:art-frame"],
        wall: ["sento-shoe-locker", "sento-shoe-locker", "_", "sento-shoe-locker", "subway-vending-machine"],
        at: [
          ["home-umbrella-stand", 1, 5], ["home-school-bag", 8, 5], ["home-genkan-shoes", 1, 6], ["home-genkan-shoes", 7, 6],
        ],
        pl: [8, 9],
      }),
    ] }),
  facility({ cat: "교육시설", p: "mc_university", map: "university-campus", ko: "대학교", shape: "계단형", entrance: "un-lobby",
    rows: [["~", "un-lab"], ["~", "un-seminar", "un-office"], ["un-hall", "un-lobby"]],
    open: [["un-hall", "un-lobby"]],
    rooms: [
      R("un-lab", 11, 8, F.small, W.tile, {
        hang: ["m:whiteboard", "m:wall-clock"],
        wall: ["lab-fume-hood", "lab-reagent-shelf", "m:washbasin", "lab-fume-hood"],
        pair: [
          ["lab-bench", "m:chair-wood-n", 2, 5, 1, 1],
          ["lab-bench", "m:chair-wood-n", 7, 5, 1, 1],
        ],
      }),
      R("un-seminar", 10, 8, F.carpet, W.office, {
        hang: ["projector-screen", "m:wall-clock"],
        at: [["m:shelf-office", 0, 2]],
        seat: [["mci-t-meeting", "m:chair-office", 2, 5, 5, 1, { n: true, s: true, e: true, w: true }]],
      }),
      R("un-office", 9, 8, F.carpet, W.office, {
        hang: ["m:whiteboard", "m:wall-clock"],
        wall: ["m:filing", "m:shelf-office", "m:coffee-station"],
        pair: [["m:desk-pc", "m:chair-office", 1, 4, 2, 1, 5, 4, "pod"]],
      }),
      R("un-hall", 16, 10, F.dark, W.brick, {
        hang: ["m:window-curtain", "projector-screen", "m:wall-clock", "m:window-curtain"],
        wall: ["m:filing", "_", "m:shelf-office"],
        at: [["lecture-podium", 7, 3]],
        grid: [["lecture-desk-row", 1, 5, 3, 2, 5, 2]],
      }),
      R("un-lobby", 12, 12, F.stone, W.lobby, {
        hang: ["m:notice-board", "m:wall-clock", "m:art-frame"],
        at: [
          ["subway-vending-machine", 2, 2], ["m:coffee-station", 9, 2],
          ["m:wait-bench", 1, 5], ["m:wait-bench", 8, 5],
          ["m:reception", 1, 8], ["dept-directory-kiosk", 9, 8],
        ],
        pl: [10, 10],
      }),
    ] }),
  facility({ cat: "교육시설", p: "mc_cram_school", map: "cram-school", ko: "학원", shape: "L자형", entrance: "cs-lobby",
    rows: [["cs-class-a", "cs-class-b", "~"], ["cs-lobby", "cs-selfstudy"]],
    open: [["cs-lobby", "cs-selfstudy"]],
    rooms: [
      cls("cs-class-a", 10, 9, F.carpet),
      R("cs-class-b", 10, 8, F.carpet, W.office, {
        hang: ["school-blackboard", "m:wall-clock", "m:window-curtain"],
        at: [["school-cleaning-locker", 0, 2], ["m:shelf-office", 8, 2], ["school-teacher-podium", 4, 3]],
        desks: [[2, 5, 2, 1, 4, 2]],
      }),
      R("cs-lobby", 12, 9, F.stone, W.lobby, {
        hang: ["m:notice-board", "m:menu-board"],
        at: [["m:reception", 1, 2], ["subway-vending-machine", 8, 2], ["m:wait-bench", 1, 5], ["dept-directory-kiosk", 9, 5]],
        pl: [10, 7],
      }),
      R("cs-selfstudy", 20, 7, F.carpet, W.office, {
        hang: ["m:wall-clock", "m:whiteboard", "m:window-blind"],
        wall: ["m:shelf-office", "book-shelf", "book-shelf", "m:shelf-office"],
        grid: [["library-carrel", 2, 4, 4, 2, 4, 2]],
      }),
    ] }),
  facility({ cat: "교육시설", p: "mc_kindergarten", map: "kindergarten", ko: "유치원", shape: "ㄷ자형(중정)", entrance: "kg-hall",
    rows: [["kg-room-a", "~", "kg-room-b"], ["kg-hall", "void:3"]],
    open: [["kg-room-a", "kg-hall"], ["kg-room-b", "kg-hall"]],
    rooms: [
      R("kg-room-a", 9, 9, F.vinyl, W.home, {
        hang: ["m:window-curtain", "m:wall-clock"],
        wall: ["kinder-cubby", "kinder-cubby", "m:shelf-office"],
        at: [["kinder-play-mat", 1, 4], ["m:cafe-chair-e", 5, 5], ["m:cafe-table", 6, 5], ["m:cafe-chair-w", 7, 5], ["home-school-bag", 1, 7], ["home-school-bag", 7, 7]],
      }),
      R("kg-room-b", 9, 8, F.vinyl, W.home, {
        hang: ["m:window-curtain", "m:art-frame"],
        wall: ["kinder-cubby", "kinder-cubby", "m:shelf-office"],
        at: [["kinder-play-mat", 1, 4], ["m:cafe-chair-e", 5, 5], ["m:cafe-table", 6, 5], ["m:cafe-chair-w", 7, 5], ["home-school-bag", 1, 7], ["home-cat-bed", 7, 7]],
      }),
      R("kg-hall", 26, 7, F.small, W.home, {
        hang: ["m:notice-board", "m:art-frame", "m:wall-clock", "m:window-curtain"],
        at: [
          ["kinder-cubby", 1, 2], ["kinder-cubby", 7, 2], ["m:shelf-office", 15, 2], ["kinder-cubby", 23, 2],
          ["kinder-play-mat", 2, 4], ["kinder-play-mat", 9, 4], ["kinder-play-mat", 16, 4], ["kinder-play-mat", 21, 4],
          ["home-school-bag", 1, 6], ["home-school-bag", 7, 6], ["home-school-bag", 18, 6], ["home-school-bag", 24, 6],
        ],
      }),
    ] }),
  facility({ cat: "교육시설", p: "mc_dormitory", map: "student-dormitory", ko: "학생 기숙사", shape: "ㄷ자형(중정)", entrance: "dm-hall",
    rows: [["dm-room-a", "dm-room-b", "~", "dm-room-c"], ["void:3", "dm-hall"]],
    open: [["dm-room-b", "dm-hall"]],
    rooms: [
      ...(["dm-room-a", "dm-room-b", "dm-room-c"] as const).map((k, i) => R(k, 9, i === 1 ? 10 : 9, F.oak, W.home, {
        hang: ["m:window-curtain", "m:wall-clock"],
        wall: ["m:wardrobe", "m:shelf-office"],
        at: [
          ["dorm-bunk-bed", 1, 5], ["dorm-bunk-bed", 3, 5],
          ["m:desk-pc", 6, 4], ["m:chair-office-s", 6, 5],
          ["m:desk-pc", 6, 7], ["m:chair-office-n", 6, 8],
          ["home-school-bag", 0, 8], ["home-laundry-basket", 4, 8],
        ],
      })),
      R("dm-hall", 36, 7, F.stone, W.lobby, {
        hang: ["m:notice-board", "m:wall-clock", "m:tv-wall", "m:window-curtain"],
        at: [
          ["home-washing-machine", 1, 2], ["home-washing-machine", 2, 2], ["home-washing-machine", 7, 2],
          ["subway-vending-machine", 11, 2], ["m:coffee-station", 22, 2], ["m:fridge", 27, 2], ["m:shelf-office", 33, 2],
          ["home-drying-rack", 2, 6], ["home-laundry-basket", 5, 6],
          ["m:sofa", 10, 4], ["m:armchair-e", 9, 5], ["m:coffee-table", 10, 5], ["m:armchair-w", 13, 5],
          ["m:sofa", 22, 4], ["m:armchair-e", 21, 5], ["m:coffee-table", 22, 5], ["m:armchair-w", 25, 5],
          ["m:wait-bench", 28, 5], ["m:wait-bench", 32, 5],
        ],
        pl: [19, 6],
      }),
    ] }),

  // ── 의료시설 ──
  facility({ cat: "의료시설", p: "mc_clinic", map: "private-clinic", aliases: ["clinic"], ko: "개인병원", shape: "L자형", entrance: "cl-reception",
    rows: [["cl-exam-a", "cl-exam-b", "~"], ["cl-reception", "cl-waiting"]],
    open: [["cl-reception", "cl-waiting"]],
    rooms: [
      R("cl-exam-a", 9, 9, F.hosp, W.hosp, {
        hang: ["m:window-curtain", "infirmary-eye-chart"],
        wall: ["hospital-med-cabinet", "m:washbasin"],
        at: [["m:hosp-bed", 1, 4], ["hospital-curtain-screen", 2, 4], ["m:chair-office-s", 6, 4], ["hospital-doctor-desk", 6, 5], ["infirmary-scale", 1, 7], ["m:med-cart", 4, 7]],
      }),
      R("cl-exam-b", 9, 8, F.hosp, W.hosp, {
        hang: ["m:window-curtain", "infirmary-eye-chart"],
        wall: ["hospital-med-cabinet", "m:washbasin"],
        at: [["m:hosp-bed", 7, 4], ["hospital-curtain-screen", 6, 4], ["m:chair-office-s", 2, 4], ["hospital-doctor-desk", 2, 5], ["infirmary-scale", 7, 7], ["m:med-cart", 4, 7]],
      }),
      R("cl-reception", 12, 9, F.hosp, W.hosp, {
        hang: ["m:wall-clock", "hosp-number-display"],
        at: [
          ["hospital-pharmacy-window", 0, 2], ["m:shelf-office", 4, 2], ["hospital-water-dispenser", 8, 2], ["m:filing", 10, 2],
          ["m:chair-office-s", 3, 3], ["m:reception", 2, 4], ["hosp-ticket-dispenser", 0, 4],
          ["m:wait-bench", 1, 6], ["m:wait-bench", 5, 6], ["m:wait-bench", 9, 6],
        ],
      }),
      R("cl-waiting", 14, 7, F.hosp, W.hosp, {
        hang: ["hosp-floor-directory", "m:tv-wall", "m:art-frame"],
        wall: ["m:magazine", "_", "hospital-water-dispenser"],
        at: [
          ["hosp-wait-row-s", 1, 4], ["hosp-wait-row-s", 6, 4], ["hosp-wait-row-s", 10, 4],
          ["hosp-wait-row-n", 1, 6], ["hosp-wait-row-n", 6, 6], ["hosp-wait-row-n", 10, 6],
        ],
        pl: [13, 6],
      }),
    ] }),
  facility({ cat: "의료시설", p: "mc_dental", map: "dental-clinic", ko: "치과", shape: "ㅗ자형", entrance: "dn-wait",
    rows: [["~", "dn-op-a", "dn-op-b", "~"], ["dn-wait", "dn-recep", "dn-xray"]],
    open: [["dn-wait", "dn-recep"]],
    rooms: [
      ...(["dn-op-a", "dn-op-b"] as const).map((k, i) => R(k, 11, i === 0 ? 9 : 8, F.hosp, W.hosp, {
        hang: ["m:window-blind", "m:wall-clock"],
        wall: ["hospital-med-cabinet", "m:washbasin", "hospital-med-cabinet"],
        grid: [["clinic-dental-chair", 1, 4, 2, 2, 5, 2]],
        at: [["hosp-mayo-stand", 4, 4], ["hosp-mayo-stand", 9, 4], ["m:med-cart", 10, 6]],
      })),
      R("dn-wait", 12, 9, F.vinyl, W.home, {
        hang: ["m:tv-wall", "m:art-frame"],
        at: [["m:magazine", 1, 2], ["hospital-water-dispenser", 10, 2], ["m:sofa", 1, 4], ["m:coffee-table", 2, 5], ["m:wait-bench", 8, 6]],
        pl: [0, 7],
      }),
      R("dn-recep", 8, 7, F.hosp, W.hosp, {
        hang: ["m:wall-clock", "hosp-number-display"],
        wall: ["hospital-pharmacy-window", "m:filing"],
        at: [["m:reception", 1, 4], ["hosp-ticket-dispenser", 0, 6], ["m:wait-bench", 2, 6]],
      }),
      R("dn-xray", 9, 7, F.hosp, W.hosp, {
        hang: ["hosp-film-viewer", "m:wall-clock"],
        wall: ["hosp-xray-console", "hosp-scrub-sink"],
        at: [["hosp-xray-table", 2, 4], ["m:med-cart", 8, 5], ["hosp-mayo-stand", 1, 6]],
      }),
    ] }),
  facility({ cat: "의료시설", p: "mc_psychiatry", map: "psychiatry-clinic", ko: "정신과", shape: "계단형", entrance: "ps-lobby",
    rows: [["~", "ps-group"], ["~", "ps-counsel-a", "ps-counsel-b"], ["ps-lobby", "ps-waiting"]],
    open: [["ps-lobby", "ps-waiting"]],
    rooms: [
      R("ps-group", 12, 7, F.carpet, W.home, {
        hang: ["m:window-curtain", "m:art-frame"],
        wall: ["m:shelf-office", "m:coffee-station"],
        at: [
          ["m:rug", 4, 4],
          ["m:sofa", 4, 4],
          ["m:armchair-e", 2, 5], ["m:coffee-table", 5, 5], ["m:armchair-w", 9, 5],
          ["m:armchair-n", 4, 6], ["m:armchair-n", 7, 6],
        ],
      }),
      ...["ps-counsel-a", "ps-counsel-b"].map((k) => R(k, 8, 7, F.carpet, W.home, {
        hang: ["m:window-curtain", "m:art-frame"],
        at: [["m:shelf-office", 0, 2], ["clinic-psych-couch", 2, 4], ["m:coffee-table", 2, 6], ["m:armchair-w", 5, 6], ["home-floor-lamp", 6, 3]],
      })),
      R("ps-lobby", 10, 9, F.stone, W.lobby, {
        hang: ["m:wall-clock", "m:menu-board"],
        at: [["m:filing", 1, 2], ["m:reception", 2, 4], ["hosp-ticket-dispenser", 0, 4], ["m:wait-bench", 1, 6]],
        pl: [0, 7],
      }),
      R("ps-waiting", 14, 7, F.carpet, W.home, {
        hang: ["m:art-frame", "m:window-curtain", "m:art-frame"],
        wall: ["m:magazine", "m:tv-stand", "m:coffee-station"],
        at: [["m:sofa", 2, 4], ["m:armchair-e", 1, 5], ["m:coffee-table", 3, 5], ["m:armchair-w", 5, 5], ["m:armchair-e", 8, 5], ["m:coffee-table", 9, 5], ["m:armchair-w", 11, 5]],
        pl: [12, 6],
      }),
    ] }),
  facility({ cat: "의료시설", p: "mc_hanbang", map: "hanbang-clinic", ko: "한의원", shape: "ㄷ자형(중정)", entrance: "hb-wait",
    rows: [["hb-herb", "~", "hb-acu"], ["hb-wait", "void:3"]],
    open: [["hb-herb", "hb-wait"]],
    rooms: [
      R("hb-herb", 9, 9, F.dark, W.brick, {
        hang: ["m:window-curtain", "m:art-frame"],
        wall: ["clinic-herb-cabinet", "clinic-herb-cabinet", "clinic-herb-cabinet"],
        at: [["lab-bench", 1, 5], ["m:chair-wood-n", 2, 6], ["m:med-cart", 8, 6]],
      }),
      R("hb-acu", 9, 8, F.dark, W.brick, {
        hang: ["m:window-curtain", "m:art-frame"],
        wall: ["m:shelf-office", "hospital-med-cabinet", "m:washbasin"],
        at: [["clinic-acupuncture-bed", 1, 4], ["clinic-acupuncture-bed", 6, 4], ["clinic-acupuncture-bed", 1, 6], ["clinic-acupuncture-bed", 6, 6]],
      }),
      R("hb-wait", 26, 7, F.dark, W.home, {
        hang: ["m:art-frame", "m:wall-clock", "m:window-curtain", "m:menu-board"],
        at: [
          ["clinic-herb-cabinet", 0, 2], ["clinic-herb-cabinet", 8, 2], ["m:coffee-station", 16, 2], ["m:magazine", 23, 2],
          ["m:reception", 2, 4], ["hosp-ticket-dispenser", 0, 4],
          ["m:sofa", 14, 4], ["m:armchair-e", 13, 5], ["m:coffee-table", 15, 5], ["m:armchair-w", 17, 5],
          ["m:wait-bench", 1, 6], ["m:wait-bench", 7, 6], ["m:wait-bench", 21, 6],
        ],
        pl: [24, 6],
      }),
    ] }),
  facility({ cat: "의료시설", p: "mc_vet", map: "animal-hospital", ko: "동물병원", shape: "L자형", entrance: "vt-reception",
    rows: [["vt-exam", "vt-ward", "~"], ["vt-reception", "vt-grooming"]],
    open: [["vt-reception", "vt-grooming"]],
    rooms: [
      R("vt-exam", 10, 9, F.hosp, W.hosp, {
        hang: ["m:window-curtain", "m:wall-clock"],
        wall: ["hospital-med-cabinet", "m:washbasin", "hospital-med-cabinet"],
        at: [["m:chair-office-e", 1, 5], ["clinic-vet-table", 2, 5], ["clinic-vet-table", 6, 5], ["m:med-cart", 1, 7], ["infirmary-scale", 8, 7]],
      }),
      R("vt-ward", 10, 8, F.hosp, W.hosp, {
        hang: ["m:wall-clock", "m:notice-board"],
        wall: ["clinic-pet-kennels", "clinic-pet-kennels", "clinic-pet-kennels", "clinic-pet-kennels"],
        at: [["hosp-iv-pump", 3, 4], ["m:iv-stand", 7, 4], ["home-cat-bed", 3, 6], ["home-cat-bed", 7, 6]],
      }),
      R("vt-reception", 14, 9, F.vinyl, W.store, {
        hang: ["m:wall-clock", "m:menu-board", "m:notice-board"],
        at: [
          ["shop-peg-wall", 0, 2], ["shop-peg-wall", 7, 2], ["m:coffee-station", 10, 2],
          ["m:reception", 2, 4], ["hosp-ticket-dispenser", 0, 4],
          ["m:wait-bench", 1, 6], ["m:wait-bench", 8, 6], ["home-cat-bed", 11, 6],
        ],
        pl: [0, 7],
      }),
      R("vt-grooming", 14, 7, F.small, W.tile, {
        hang: ["m:wall-clock", "m:window-blind"],
        wall: ["home-vanity-sink", "home-vanity-sink", "m:washbasin", "clinic-pet-kennels"],
        at: [["clinic-vet-table", 2, 4], ["clinic-vet-table", 6, 4], ["clinic-vet-table", 10, 4], ["home-drying-rack", 2, 6], ["home-cat-bed", 11, 6]],
      }),
    ] }),
  facility({ cat: "의료시설", p: "mc_pharmacy", map: "pharmacy", ko: "약국", shape: "L자형(거꾸로)", entrance: "ph-shop",
    rows: [["~", "ph-stock"], ["ph-shop", "ph-dispense"]],
    open: [["ph-shop", "ph-dispense"]],
    rooms: [
      R("ph-stock", 10, 7, F.vinyl, W.metal, {
        hang: ["m:notice-board"],
        wall: ["clinic-pharmacy-shelf", "clinic-pharmacy-shelf", "m:filing"],
        south: ["m:pallet", "m:pallet", "m:basket-stack"],
      }),
      R("ph-shop", 16, 10, F.vinyl, W.store, {
        hang: ["m:menu-board", "m:wall-clock", "m:notice-board"],
        wall: ["shop-peg-wall", "clinic-pharmacy-shelf", "clinic-pharmacy-shelf", "mart-drink-open"],
        at: [
          ["shop-drug-gondola", 1, 4], ["shop-drug-gondola", 5, 4], ["shop-drug-gondola", 11, 4],
          ["shop-drug-gondola", 1, 6], ["shop-drug-gondola", 5, 6],
          ["m:counter-register", 11, 7], ["m:basket-stack", 15, 8],
        ],
      }),
      R("ph-dispense", 12, 8, F.hosp, W.hosp, {
        hang: ["m:wall-clock", "hosp-number-display"],
        at: [
          ["hospital-pharmacy-window", 0, 2], ["clinic-pharmacy-shelf", 3, 2], ["clinic-pharmacy-shelf", 8, 2],
          ["m:reception", 2, 4], ["hosp-ticket-dispenser", 11, 4],
          ["m:wait-bench", 2, 7], ["m:wait-bench", 7, 7],
        ],
      }),
    ] }),

  // ── 상점 ──
  facility({ cat: "상점", p: "mc_drugstore", map: "drugstore", ko: "드럭스토어", shape: "L자형", entrance: "ds-floor",
    rows: [["ds-stock", "~"], ["ds-floor", "ds-cosmetics"]],
    open: [["ds-floor", "ds-cosmetics"]],
    rooms: [
      R("ds-stock", 10, 7, F.vinyl, W.metal, {
        hang: ["m:notice-board", "m:wall-clock"],
        wall: ["m:rack", "m:rack", "m:filing"],
        south: ["m:pallet", "m:pallet", "m:basket-stack"],
      }),
      R("ds-floor", 20, 10, F.vinyl, W.store, {
        hang: ["m:menu-board", "m:wall-clock", "m:menu-board", "m:notice-board"],
        at: [
          ["clinic-pharmacy-shelf", 0, 2], ["shop-peg-wall", 7, 2], ["shop-peg-wall", 10, 2], ["mart-drink-open", 14, 2], ["mart-dairy-open", 17, 2],
          ["shop-drug-gondola", 1, 4], ["shop-drug-gondola", 6, 4], ["shop-drug-gondola", 12, 4], ["shop-drug-gondola", 16, 4],
          ["shop-drug-gondola", 1, 6], ["shop-drug-gondola", 6, 6], ["shop-drug-gondola", 12, 6], ["shop-drug-gondola", 16, 6],
          ["m:counter-register", 1, 8], ["m:basket-stack", 6, 8], ["m:counter-register", 14, 8],
        ],
      }),
      R("ds-cosmetics", 12, 8, F.stone, W.lobby, {
        hang: ["m:art-frame", "m:wall-clock"],
        wall: ["dept-perfume-wall", "dept-perfume-wall", "dept-handbag-vitrine", "dept-nail-bar"],
        at: [
          ["dept-cosmetic-island", 2, 4], ["dept-cosmetic-island", 7, 4],
          ["m:counter-register", 7, 7], ["dept-eyewear-tower", 2, 7],
        ],
      }),
    ] }),
  facility({ cat: "상점", p: "mc_hundred_yen", map: "hundred-yen-shop", ko: "100엔숍", shape: "ㅗ자형", entrance: "hy-floor",
    rows: [["~", "hy-stock", "~"], ["void:3", "hy-floor"]],
    open: [["hy-stock", "hy-floor"]],
    rooms: [
      R("hy-stock", 12, 7, F.vinyl, W.metal, {
        hang: ["m:notice-board", "m:wall-clock"],
        wall: ["m:rack", "m:rack", "m:filing"],
        south: ["m:pallet", "m:pallet", "m:pallet", "m:basket-stack"],
      }),
      R("hy-floor", 30, 9, F.vinyl, W.store, {
        hang: ["m:menu-board", "m:wall-clock", "m:menu-board", "m:notice-board"],
        at: [
          ["shop-peg-wall", 0, 2], ["shop-peg-wall", 4, 2], ["shop-peg-wall", 8, 2], ["shop-peg-wall", 11, 2],
          ["shop-peg-wall", 17, 2], ["shop-peg-wall", 21, 2], ["shop-peg-wall", 25, 2], ["mart-drink-open", 28, 2],
          ...[1, 5, 9, 18, 22, 26].flatMap((x) => [["mci-gondola", x, 4] as const, ["mci-gondola", x, 6] as const]),
          ["m:counter-register", 2, 8], ["m:basket-stack", 8, 8], ["m:basket-stack", 20, 8], ["m:counter-register", 24, 8],
        ],
      }),
    ] }),
  facility({ cat: "상점", p: "mc_stationery", map: "stationery-shop", ko: "문구점", shape: "L자형", entrance: "st-floor",
    rows: [["st-back", "~"], ["st-floor", "st-gift"]],
    open: [["st-floor", "st-gift"]],
    rooms: [
      R("st-back", 8, 7, F.vinyl, W.metal, {
        hang: ["m:notice-board"],
        wall: ["m:rack", "m:filing"],
        south: ["m:pallet", "m:basket-stack"],
      }),
      R("st-floor", 18, 10, F.oak, W.store, {
        hang: ["m:menu-board", "m:wall-clock", "m:art-frame"],
        at: [
          ["shop-peg-wall", 0, 2], ["m:shelf-office", 6, 2], ["shop-peg-wall", 10, 2], ["m:shelf-office", 15, 2],
          ["book-table", 1, 4], ["book-table", 6, 4], ["book-table", 11, 4], ["book-table", 15, 4],
          ["shop-stationery-rack", 1, 7], ["shop-stationery-rack", 6, 7], ["shop-stationery-rack", 9, 7],
          ["m:counter-register", 12, 8], ["m:basket-stack", 4, 8],
        ],
      }),
      R("st-gift", 10, 8, F.oak, W.home, {
        hang: ["m:art-frame", "m:wall-clock"],
        wall: ["m:shelf-office", "shop-peg-wall", "m:shelf-office"],
        rows: [[4, ["dept-gift-wrap", "dept-knit-table"]], [6, ["dept-gift-wrap", "dept-tie-case"]]],
      }),
    ] }),
  facility({ cat: "상점", p: "mc_florist", map: "flower-shop", ko: "꽃집", shape: "계단형", entrance: "fl-shop",
    rows: [["~", "fl-greenhouse"], ["fl-shop", "fl-cooler"]],
    open: [["fl-shop", "fl-cooler"]],
    rooms: [
      R("fl-greenhouse", 12, 7, F.small, W.tile, {
        hang: ["m:window-city", "m:window-city"],
        wall: ["shop-flower-cooler", "shop-flower-cooler", "shop-flower-cooler"],
        grid: [["mart-flower-buckets", 2, 4, 4, 2, 2, 2]],
      }),
      R("fl-shop", 16, 10, F.oak, W.home, {
        hang: ["m:window-curtain", "m:art-frame", "m:menu-board"],
        at: [
          ["shop-flower-cooler", 0, 2], ["shop-flower-cooler", 4, 2], ["shop-flower-cooler", 9, 2],
          ["mart-flower-buckets", 1, 4], ["mart-flower-buckets", 2, 4], ["mart-flower-buckets", 6, 4], ["mart-flower-buckets", 7, 4], ["mart-flower-buckets", 11, 4], ["mart-flower-buckets", 12, 4],
          ["mart-flower-buckets", 1, 6], ["mart-flower-buckets", 2, 6], ["m:counter-register", 10, 7],
        ],
      }),
      R("fl-cooler", 10, 8, F.small, W.tile, {
        hang: ["m:wall-clock"],
        wall: ["shop-flower-cooler", "_", "shop-flower-cooler"],
        rows: [[4, ["mart-flower-buckets", "mart-flower-buckets", "mart-flower-buckets"]]],
        south: ["mart-flower-buckets", "m:basket-stack", "mart-flower-buckets"],
      }),
    ] }),
  facility({ cat: "상점", p: "mc_clothing", map: "clothing-store", ko: "옷가게", shape: "ㄷ자형", entrance: "cw-floor",
    rows: [["cw-fitting", "~", "cw-stock"], ["cw-floor", "void:3"]],
    open: [["cw-fitting", "cw-floor"]],
    rooms: [
      R("cw-fitting", 9, 9, F.carpet, W.lobby, {
        hang: ["m:art-frame"],
        wall: ["dept-fitting-booth", "dept-fitting-booth", "dept-fitting-curtain"],
        rows: [[6, ["dept-shoe-bench", "dept-shoe-bench"]]],
      }),
      R("cw-stock", 9, 8, F.vinyl, W.metal, {
        hang: ["m:notice-board"],
        wall: ["m:rack", "m:rack", "m:filing"],
        rows: [[5, ["dept-clothing-rack", "dept-clothing-rack"]], [7, ["m:pallet", "m:basket-stack"]]],
      }),
      R("cw-floor", 26, 9, F.carpet, W.lobby, {
        hang: ["m:art-frame", "m:wall-clock", "m:menu-board", "m:art-frame"],
        at: [
          ["dept-accessory-wall", 0, 2], ["dept-shoe-wall", 7, 2], ["dept-sneaker-wall", 12, 2], ["dept-handbag-vitrine", 17, 2], ["dept-accessory-wall", 24, 2],
          ["dept-clothing-rack", 1, 4], ["dept-mannequin-suit", 4, 4], ["dept-clothing-rack", 7, 4], ["dept-mannequin-dress", 10, 4],
          ["dept-mannequin-coat", 15, 4], ["dept-clothing-rack", 17, 4], ["dept-mannequin-casual", 20, 4], ["dept-clothing-rack", 23, 4],
          ["dept-clothing-rack", 1, 6], ["dept-knit-table", 6, 6], ["dept-tie-case", 17, 6], ["dept-clothing-rack", 23, 6],
          ["m:counter-register", 2, 8], ["dept-gift-wrap", 7, 8], ["dept-shoe-bench", 18, 8], ["m:counter-register", 21, 8],
        ],
      }),
    ] }),
  facility({ cat: "상점", p: "mc_electronics", map: "electronics-store", ko: "전자제품점", shape: "L자형", entrance: "ec-floor",
    rows: [["ec-demo", "~"], ["ec-floor", "ec-service"]],
    open: [["ec-demo", "ec-floor"], ["ec-floor", "ec-service"]],
    rooms: [
      R("ec-demo", 12, 8, F.carpet, W.office, {
        hang: ["m:tv-wall", "m:tv-wall", "m:tv-wall"],
        wall: ["m:tv-stand", "m:tv-stand", "m:tv-stand", "m:tv-stand"],
        rows: [[4, ["shop-laptop-table", "shop-laptop-table"]], [6, ["shop-laptop-table", "shop-laptop-table"]]],
      }),
      R("ec-floor", 22, 10, F.vinyl, W.store, {
        hang: ["m:tv-wall", "m:wall-clock", "m:menu-board", "m:tv-wall"],
        at: [
          ["m:tv-stand", 0, 2], ["m:tv-stand", 2, 2], ["m:fridge", 8, 2], ["m:fridge", 9, 2], ["home-washing-machine", 13, 2], ["home-appliance-rack", 15, 2], ["m:tv-stand", 19, 2],
          ["shop-laptop-table", 1, 4], ["shop-laptop-table", 7, 4], ["shop-laptop-table", 13, 4], ["shop-laptop-table", 18, 4],
          ["shop-laptop-table", 1, 6], ["shop-laptop-table", 7, 6], ["shop-laptop-table", 13, 6], ["shop-laptop-table", 18, 6],
          ["m:counter-register", 2, 8], ["m:counter-register", 15, 8],
        ],
      }),
      R("ec-service", 10, 8, F.carpet, W.office, {
        hang: ["m:wall-clock", "m:notice-board"],
        wall: ["m:filing", "m:shelf-office", "office-copier"],
        pair: [["m:desk-pc", "m:chair-office-s", 1, 4, 2, 1, 5, 2, "s"]],
        at: [["m:counter-register", 3, 7]],
      }),
    ] }),
  facility({ cat: "상점", p: "mc_secondhand", map: "secondhand-shop", ko: "중고상점", shape: "계단형", entrance: "sh-floor",
    rows: [["~", "sh-stock"], ["sh-floor", "sh-books"]],
    open: [["sh-floor", "sh-books"]],
    rooms: [
      R("sh-stock", 10, 7, F.conc, W.metal, {
        hang: ["m:notice-board"],
        wall: ["m:rack", "m:rack", "m:filing"],
        south: ["m:pallet", "m:pallet", "m:pallet"],
      }),
      R("sh-floor", 18, 10, F.oak, W.brick, {
        hang: ["m:menu-board", "m:wall-clock", "m:art-frame", "m:art-frame"],
        wall: ["shop-used-shelf", "shop-used-shelf", "shop-used-shelf", "shop-peg-wall", "shop-used-shelf"],
        at: [
          ["shop-used-shelf", 1, 4], ["shop-used-shelf", 5, 4], ["shop-used-shelf", 11, 4], ["shop-used-shelf", 15, 4],
          ["shop-used-shelf", 1, 6], ["shop-used-shelf", 5, 6], ["shop-used-shelf", 11, 6], ["shop-used-shelf", 15, 6],
          ["m:counter-register", 2, 8], ["home-floor-lamp", 15, 8],
        ],
      }),
      R("sh-books", 10, 8, F.oak, W.brick, {
        hang: ["m:art-frame", "m:wall-clock"],
        at: [
          ["book-shelf", 0, 2], ["book-shelf", 2, 2], ["manga-shelf", 6, 2], ["manga-shelf", 8, 2],
          ["book-table", 2, 5], ["book-table", 6, 5],
          ["m:counter-register", 2, 7], ["home-floor-lamp", 8, 7],
        ],
      }),
    ] }),

  // ── 음식점 ──
  facility({ cat: "음식점", p: "mc_ramen", map: "ramen-shop", ko: "라멘집", shape: "L자형", entrance: "rm-hall",
    rows: [["rm-kitchen", "~"], ["rm-hall", "rm-booth"]],
    open: [["rm-hall", "rm-booth"]],
    rooms: [
      R("rm-kitchen", 10, 7, F.small, W.tile, {
        hang: ["m:menu-board", "izakaya-lantern"],
        wall: ["m:kitchen", "m:fridge", "m:cooler"],
        at: [["mart-fish-ice", 2, 4], ["mart-sashimi-case", 5, 4], ["mart-rice-pallet", 0, 6], ["m:basket-stack", 9, 6]],
      }),
      R("rm-hall", 18, 10, F.dark, W.brick, {
        hang: ["izakaya-noren", "m:menu-board", "izakaya-lantern", "m:menu-board"],
        at: [["food-drink-bar", 1, 2], ["m:cooler", 7, 2], ["m:fridge", 15, 2], ["food-ticket-machine", 0, 4]],
        bar: [["izakaya-counter", "m:bar-stool", 6, 4, 3, "s"]],
        seat: [["mci-t-wood", "m:chair-wood", 1, 7, 2, 1, { e: true, w: true }], ["mci-t-wood", "m:chair-wood", 13, 7, 2, 1, { e: true, w: true }]],
      }),
      R("rm-booth", 12, 8, F.dark, W.brick, {
        hang: ["m:menu-board", "izakaya-lantern"],
        wall: ["m:coffee-station", "food-drink-bar", "m:cooler"],
        seat: [
          ["mci-t-wood", "m:chair-wood", 2, 4, 2, 1, { e: true, w: true }],
          ["mci-t-wood", "m:chair-wood", 8, 4, 2, 1, { e: true, w: true }],
          ["mci-t-wood", "m:chair-wood", 2, 6, 2, 1, { e: true, w: true }],
          ["mci-t-wood", "m:chair-wood", 8, 6, 2, 1, { e: true, w: true }],
        ],
      }),
    ] }),
  facility({ cat: "음식점", p: "mc_sushi", map: "sushi-restaurant", ko: "스시집", shape: "ㅗ자형", entrance: "ss-hall",
    rows: [["~", "ss-prep", "~"], ["ss-zashiki", "ss-hall"]],
    open: [["ss-zashiki", "ss-hall"]],
    rooms: [
      R("ss-prep", 14, 7, F.small, W.tile, {
        hang: ["m:menu-board", "izakaya-noren", "m:wall-clock"],
        wall: ["m:kitchen", "m:fridge", "m:cooler", "mart-cold-case"],
        at: [["mart-fish-ice", 3, 4], ["mart-sashimi-case", 6, 4], ["m:basket-stack", 12, 6]],
      }),
      R("ss-zashiki", 11, 8, F.oak, W.home, {
        hang: ["m:art-frame", "m:window-curtain"],
        at: [
          ["jp-tokonoma", 4, 2],
          ["izakaya-zashiki", 1, 4], ["izakaya-zashiki", 7, 4],
          ["izakaya-zashiki", 1, 6], ["izakaya-zashiki", 7, 6],
        ],
      }),
      R("ss-hall", 16, 10, F.dark, W.brick, {
        hang: ["izakaya-noren", "m:menu-board", "izakaya-lantern", "m:wall-clock"],
        at: [
          ["m:cooler", 1, 2], ["izakaya-beer-server", 7, 2], ["m:cooler", 12, 2], ["food-ticket-machine", 15, 2],
        ],
        bar: [["food-sushi-case", "m:bar-stool", 5, 4, 3, "s"]],
        seat: [
          ["mci-t-wood", "m:chair-wood", 1, 7, 2, 1, { e: true, w: true }],
          ["mci-t-wood", "m:chair-wood", 6, 7, 2, 1, { e: true, w: true }],
          ["mci-t-wood", "m:chair-wood", 12, 7, 2, 1, { e: true, w: true }],
        ],
      }),
    ] }),
  facility({ cat: "음식점", p: "mc_cafe_lounge", map: "cafe-lounge", ko: "카페", shape: "ㄷ자형(테라스)", entrance: "cf-hall",
    rows: [["cf-bar", "~", "cf-lounge"], ["void:3", "cf-hall"]],
    open: [["cf-bar", "cf-hall"], ["cf-lounge", "cf-hall"]],
    rooms: [
      R("cf-bar", 10, 9, F.dark, W.brick, {
        hang: ["m:menu-board", "m:wall-clock"],
        wall: ["m:coffee-station", "m:cooler", "m:fridge"],
        bar: [["m:counter-register", "m:bar-stool", 2, 4, 2, "s"]],
        south: ["m:basket-stack", "m:basket-stack"],
      }),
      R("cf-lounge", 10, 8, F.carpet, W.home, {
        hang: ["m:art-frame", "m:window-curtain"],
        wall: ["m:shelf-office", "m:tv-stand"],
        at: [
          ["lounge-sofa-cream", 2, 4], ["m:coffee-table", 2, 5], ["lounge-sofa-cream", 6, 4],
          ["m:armchair-e", 1, 6], ["m:coffee-table", 2, 6], ["m:armchair-w", 4, 6],
        ],
        pl: [8, 7],
      }),
      R("cf-hall", 30, 9, F.dark, W.brick, {
        hang: ["m:window-city", "m:art-frame", "m:menu-board", "m:window-city", "m:wall-clock"],
        at: [
          ["m:coffee-station", 1, 2], ["m:pastry-case", 8, 2], ["cafe-parfait-case", 18, 2], ["m:cooler", 27, 2],
          ["m:cafe-chair-e", 1, 8], ["m:cafe-table", 2, 8], ["m:cafe-chair-w", 3, 8],
          ["m:cafe-chair-e", 8, 8], ["m:cafe-table", 9, 8], ["m:cafe-chair-w", 10, 8],
          ["m:cafe-chair-e", 19, 8], ["m:cafe-table", 20, 8], ["m:cafe-chair-w", 21, 8],
          ["m:cafe-chair-e", 25, 8], ["m:cafe-table", 26, 8], ["m:cafe-chair-w", 27, 8],
        ],
        seat: [
          ["mci-t-wood", "m:chair-wood", 2, 5, 2, 1],
          ["mci-t-wood", "m:chair-wood", 9, 5, 2, 1],
          ["mci-t-wood", "m:chair-wood", 18, 5, 2, 1],
          ["mci-t-wood", "m:chair-wood", 25, 5, 2, 1],
        ],
        pl: [16, 8],
      }),
    ] }),
  facility({ cat: "음식점", p: "mc_fastfood", map: "fastfood-restaurant", ko: "패스트푸드점", shape: "L자형", entrance: "ff-hall",
    rows: [["ff-kitchen", "~"], ["ff-hall", "ff-seating"]],
    open: [["ff-hall", "ff-seating"]],
    rooms: [
      R("ff-kitchen", 10, 7, F.small, W.tile, {
        hang: ["m:menu-board", "m:wall-clock"],
        wall: ["m:kitchen", "m:fridge", "m:cooler"],
        south: ["m:freezer", "m:basket-stack", "m:basket-stack"],
      }),
      R("ff-hall", 14, 10, F.vinyl, W.store, {
        hang: ["m:menu-board", "m:menu-board", "m:menu-board"],
        at: [
          ["food-drink-bar", 1, 2], ["m:coffee-station", 7, 2], ["m:cooler", 11, 2],
          ["food-fastfood-counter", 2, 5], ["food-fastfood-counter", 8, 5],
          ["food-ticket-machine", 0, 5], ["subway-trash-bins", 12, 8],
        ],
      }),
      R("ff-seating", 18, 8, F.vinyl, W.store, {
        hang: ["m:window-city", "m:art-frame", "m:window-city", "m:wall-clock"],
        wall: ["food-drink-bar", "_", "m:coffee-station"],
        seat: [
          ["mci-t-wood", "m:chair-wood", 2, 4, 2, 1, { e: true, w: true }],
          ["mci-t-wood", "m:chair-wood", 8, 4, 2, 1, { e: true, w: true }],
          ["mci-t-wood", "m:chair-wood", 14, 4, 2, 1, { e: true, w: true }],
          ["mci-t-wood", "m:chair-wood", 2, 6, 2, 1, { e: true, w: true }],
          ["mci-t-wood", "m:chair-wood", 8, 6, 2, 1, { e: true, w: true }],
          ["mci-t-wood", "m:chair-wood", 14, 6, 2, 1, { e: true, w: true }],
        ],
      }),
    ] }),
  facility({ cat: "음식점", p: "mc_yakiniku", map: "yakiniku-restaurant", ko: "야키니쿠집", shape: "계단형", entrance: "yk-hall",
    rows: [["~", "yk-private"], ["yk-kitchen", "yk-hall"]],
    open: [["yk-private", "yk-hall"]],
    rooms: [
      R("yk-private", 12, 8, F.dark, W.brick, {
        hang: ["izakaya-lantern", "m:menu-board", "izakaya-lantern"],
        wall: ["jp-tokonoma", "jp-shoji-screen"],
        at: [
          ["home-tatami-h", 1, 4], ["food-grill-table", 2, 4], ["home-zabuton", 2, 6],
          ["home-tatami-h", 7, 4], ["food-grill-table", 8, 4], ["home-zabuton", 8, 6],
        ],
      }),
      R("yk-kitchen", 9, 9, F.small, W.tile, {
        hang: ["m:menu-board", "m:wall-clock"],
        wall: ["m:kitchen", "m:fridge", "m:cooler"],
        rows: [[5, ["mart-fish-ice", "mart-sample-cart"]]],
        south: ["m:basket-stack", "m:basket-stack"],
      }),
      R("yk-hall", 20, 10, F.dark, W.brick, {
        hang: ["izakaya-noren", "m:menu-board", "izakaya-lantern", "m:menu-board", "izakaya-lantern"],
        at: [
          ["m:cooler", 1, 2], ["food-drink-bar", 6, 2], ["mart-meat-showcase", 9, 2], ["izakaya-beer-server", 17, 2],
          ["m:chair-wood-e", 1, 4], ["food-grill-table", 2, 4], ["m:chair-wood-w", 4, 4],
          ["m:chair-wood-e", 6, 4], ["food-grill-table", 7, 4], ["m:chair-wood-w", 9, 4],
          ["m:chair-wood-e", 15, 4], ["food-grill-table", 16, 4], ["m:chair-wood-w", 18, 4],
          ["m:chair-wood-e", 1, 7], ["food-grill-table", 2, 7], ["m:chair-wood-w", 4, 7],
          ["m:chair-wood-e", 15, 7], ["food-grill-table", 16, 7], ["m:chair-wood-w", 18, 7],
          ["m:counter-register", 11, 8],
        ],
      }),
    ] }),
  facility({ cat: "음식점", p: "mc_bento", map: "bento-shop", ko: "도시락 가게", shape: "L자형", entrance: "bt-shop",
    rows: [["bt-kitchen", "~"], ["bt-shop", "bt-eat"]],
    open: [["bt-shop", "bt-eat"]],
    rooms: [
      R("bt-kitchen", 10, 8, F.small, W.tile, {
        hang: ["m:menu-board", "m:wall-clock"],
        wall: ["m:kitchen", "m:fridge", "m:cooler"],
        at: [["food-bento-counter", 3, 5], ["mart-rice-pallet", 0, 7], ["m:basket-stack", 9, 7]],
      }),
      R("bt-shop", 12, 10, F.vinyl, W.store, {
        hang: ["m:menu-board", "m:menu-board", "m:wall-clock"],
        at: [
          ["konbini-bento", 0, 2], ["konbini-bento", 6, 2], ["m:cooler", 10, 2],
          ["food-bento-counter", 1, 4], ["food-bento-counter", 7, 4],
          ["m:counter-register", 1, 7], ["food-ticket-machine", 0, 5],
        ],
      }),
      R("bt-eat", 12, 8, F.vinyl, W.store, {
        hang: ["m:window-city", "m:art-frame"],
        wall: ["m:coffee-station", "food-drink-bar", "m:cooler"],
        seat: [
          ["mci-t-wood", "m:chair-wood", 2, 4, 2, 1, { e: true, w: true }],
          ["mci-t-wood", "m:chair-wood", 8, 4, 2, 1, { e: true, w: true }],
          ["mci-t-wood", "m:chair-wood", 2, 6, 2, 1, { e: true, w: true }],
          ["mci-t-wood", "m:chair-wood", 8, 6, 2, 1, { e: true, w: true }],
        ],
      }),
    ] }),
];
