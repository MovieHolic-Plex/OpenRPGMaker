// editor/tools/routeThemes.ts
// 길목(통행 지역)의 갈래와 그 갈래 안의 가짓수 — author_wild_route{theme} 와 조수 v2 의 route 빌더가 같이 읽는 표.
//
// 왜(2026-11-15 오너 「다양한 '길목' .. '길' 통행지역 … 등산로 … 정령 숲 입구」 · 「앞으로 '조수' 에게 어떻게 깔게 시킬거야?」):
// 조수의 «마을 사이 길» 은 짜임이 하나(숲 벽 사이 꺾인 모랫길)였고 주인공 볼거리가 없었다. 길목은 «지나가는 곳» 이다 —
// 들어오는 가장자리와 나가는 가장자리가 길로 이어지고, 가운데에 그 길목의 주인공 볼거리 하나와 곁가지(막다른 쉼터·상자 자리)가 있다.
// 모델은 갈래(theme — 닫힌 목록)와 크기, 있어야 할 것(features — 닫힌 낱말)만 적는다. 갈래 안의 스무 가지는 게임 열쇠와 씨앗이 고른다 —
// 이름·요청 글의 낱말로 가르지 않는다(가짓수의 «이름» 은 사람이 읽는 꼬리표일 뿐 고르는 데 쓰이지 않는다).
import { lookHash } from "@/project/kitLook";

export const ROUTE_THEMES = ["mountain", "spirit"] as const;
export type RouteTheme = (typeof ROUTE_THEMES)[number];
export const ROUTE_THEME_LABEL: Record<RouteTheme, string> = { mountain: "산길·등산로", spirit: "정령·요정 숲" };

/** 땅 짜임 — 단(절벽)·골짜기·내·빈터·갈림이 어떻게 놓이는가. */
export type RouteLayout =
  | "climb" // 단을 돌계단으로 차례로 오른다
  | "switchback" // 단마다 맵을 가로질러 되돌아 오르는 굽이길
  | "gorge" // 깊은 골짜기를 다리로 건넌다
  | "ledge" // 높은 벼랑 하나, 벼랑 위 난간 길
  | "knoll" // 길 곁 봉우리(돌계단으로 오르는 둔덕) 위의 볼거리
  | "brook" // 내를 다리로 건넌다
  | "woods" // 단이 거의 없는 숲속 길과 큰 빈터
  | "winding" // (평지) 굽이도는 오솔길
  | "glade" // (평지) 둥근 빈터를 지나간다
  | "avenue" // (평지) 곧게 뻗은 길 양옆에 줄지어 선 것
  | "bog" // (평지) 못 사이를 누비는 길
  | "forks"; // (평지) 막다른 갈래가 여럿인 길

/** 주인공 볼거리가 길과 맺는 자리. */
export type RouteHeroSite = "beside" | "gate" | "bridge" | "center" | "line" | "flank" | "knoll";
export type RouteCover = "canopy" | "firs" | "open" | "spirit";
export type RouteSide = "rest" | "chest" | "lookout" | "none";

export interface RouteHeroItem { readonly kit: string; readonly dx: number; readonly dy: number }
export interface RouteHero {
  readonly id: string;
  readonly ko: string;
  readonly site: RouteHeroSite;
  /** beside·knoll·center: 자리 크기(칸)와 그 안에 놓는 것. gate: items[0] 이 문, gap = 문 안에서 걸어 지나는 열(왼쪽부터). line·flank: items 를 길 따라 돌아가며. */
  readonly w: number; readonly h: number;
  readonly items: readonly RouteHeroItem[];
  readonly gap?: readonly number[];
  /** center: 밟고 지나는 바닥 그림이면 true(길이 그 위로 지나간다). */
  readonly walkOver?: boolean;
}

export interface RouteVariant {
  readonly id: string;
  /** 사람이 읽는 꼬리표(이름 300 가운데 이 가짓수가 겨냥한 곳). 고르는 데 쓰지 않는다. */
  readonly ko: string;
  readonly layout: RouteLayout;
  /** 단 수(절벽 줄 수) — 평지 짜임은 굽이 수. */
  readonly tiers: number;
  readonly hero: RouteHero;
  readonly side: RouteSide;
  readonly cover: RouteCover;
  /** 길섶·빈터에 흩는 킷(있는 것만). */
  readonly dress: readonly string[];
  /** 모델이 features 로 청할 수 있는 닫힌 낱말. */
  readonly tags: readonly string[];
  readonly mood?: "fog" | "dim";
}

const K = (kit: string, dx = 0, dy = 0): RouteHeroItem => ({ kit, dx, dy });
const R = "bd-rt-";
const hero = (id: string, ko: string, site: RouteHeroSite, w: number, h: number, items: readonly RouteHeroItem[], more: Partial<RouteHero> = {}): RouteHero => ({ id, ko, site, w, h, items, ...more });

const MT_DRESS = ["bd-pick-mountain-pass-boulder-m", "bd-pick-mountain-pass-alpine-a", "bd-pick-mountain-pass-alpine-b", "bd-pick-deep-forest-path-stump"];
const SP_DRESS = [`${R}sp-shroom-s`, `${R}sp-flower`, `${R}sp-shroom-m`, `${R}sp-stone-b`];

const MOUNTAIN: readonly RouteVariant[] = [
  { id: "trailhead", ko: "솔바람 등산로", layout: "climb", tiers: 2, side: "rest", cover: "firs", tags: ["gate"], dress: MT_DRESS,
    hero: hero("trail-gate", "등산로 어귀 통나무 문", "gate", 3, 3, [K(`${R}mt-trail-gate`)], { gap: [1] }) },
  { id: "saddle", ko: "노루목 오름길", layout: "climb", tiers: 2, side: "chest", cover: "open", tags: ["rest"], dress: [...MT_DRESS, "bd-pick-mountain-pass-boulder-l"],
    hero: hero("rest-rock", "너럭 쉼터 바위", "beside", 5, 3, [K(`${R}mt-rest-rock`, 1, 1), K("bd-pick-mountain-pass-trail-post", 4, 1)]) },
  { id: "cloud-bridge", ko: "구름다리 산길", layout: "gorge", tiers: 1, side: "lookout", cover: "firs", tags: ["bridge"], dress: MT_DRESS,
    hero: hero("rope-bridge", "골짜기 위 구름다리", "bridge", 2, 6, []) },
  { id: "herb-path", ko: "약초꾼의 샛길", layout: "climb", tiers: 1, side: "chest", cover: "canopy", tags: ["camp"], dress: [`${R}mt-herb-a`, `${R}mt-herb-b`, "bd-pick-mountain-pass-alpine-a", `${R}mt-herb-a`],
    hero: hero("herb-camp", "약초꾼의 말림터", "beside", 6, 3, [K(`${R}mt-tent`, 0, 1), K("bd-pick-wizard-tower-herb-rack", 3, 1), K(`${R}mt-herb-basket`, 4, 2), K(`${R}mt-herb-b`, 5, 2), K(`${R}mt-herb-a`, 5, 1)]) },
  { id: "stone-stairs", ko: "돌계단 참나무길", layout: "climb", tiers: 4, side: "none", cover: "canopy", tags: ["shrine"], dress: MT_DRESS,
    hero: hero("stair-posts", "돌계단마다 선 길 표지", "line", 1, 2, [K("bd-pick-mountain-pass-trail-post"), K("bd-pick-mountain-pass-wayside-cross"), K("bd-pick-deep-forest-path-cairn")]) },
  { id: "hawk-ridge", ko: "매바위 능선길", layout: "ledge", tiers: 1, side: "lookout", cover: "open", tags: ["summit"], dress: MT_DRESS,
    hero: hero("hawk-rock", "매바위 바위 무리", "beside", 6, 3, [K("bd-pick-mountain-pass-boulder-l", 0, 1), K(`${R}mt-rockfall`, 2, 1), K("bd-pick-mountain-pass-boulder-m", 4, 0), K("bd-pick-deep-forest-path-cairn", 5, 1)]) },
  { id: "mist-peak", ko: "안개 봉우리 오르는 길", layout: "knoll", tiers: 3, side: "none", cover: "firs", tags: ["summit"], dress: MT_DRESS, mood: "fog",
    hero: hero("summit-stone", "봉우리 표지석", "knoll", 4, 3, [K(`${R}mt-summit-stone`, 1, 0), K("bd-pick-deep-forest-path-cairn-s", 3, 2)]) },
  { id: "woodcutter-pass", ko: "나무꾼 고갯길", layout: "climb", tiers: 2, side: "rest", cover: "firs", tags: ["camp"], dress: ["bd-pick-deep-forest-path-stump", "bd-pick-deep-forest-path-chopping-block", "bd-pick-deep-forest-path-log-fallen", "bd-pick-deep-forest-path-stump"],
    hero: hero("chop-camp", "나무꾼의 야영터", "beside", 6, 3, [K(`${R}mt-tent`, 0, 1), K("bd-pick-deep-forest-path-campfire", 3, 2), K("bd-out-woodpile", 4, 1), K("bd-pick-deep-forest-path-chopping-block", 4, 2)]) },
  { id: "lodge-road", ko: "산장 가는 길", layout: "woods", tiers: 1, side: "chest", cover: "firs", tags: ["lodge"], dress: MT_DRESS,
    hero: hero("lodge", "산장", "beside", 8, 6, [K(`${R}mt-lodge`, 0, 0), K("bd-out-signpost", 7, 4), K("bd-out-woodpile", 6, 5)]) },
  { id: "log-road", ko: "벌목꾼의 통나무길", layout: "woods", tiers: 1, side: "rest", cover: "open", tags: ["camp"], dress: ["bd-pick-deep-forest-path-stump", "bd-pick-deep-forest-path-stump", "bd-pick-deep-forest-path-log-fallen", "bd-pick-deep-forest-path-chopping-block"],
    hero: hero("log-yard", "벌목장 통나무 더미", "beside", 6, 3, [K(`${R}mt-log-pile`, 0, 1), K(`${R}mt-sawhorse`, 4, 1)]) },
  { id: "shelter-fork", ko: "쉼터 바위 갈림길", layout: "climb", tiers: 2, side: "rest", cover: "canopy", tags: ["shelter"], dress: MT_DRESS,
    hero: hero("shelter", "길손 쉼터 지붕", "beside", 5, 3, [K(`${R}mt-shelter`, 0, 0), K("bd-out-signpost", 4, 1)]) },
  { id: "goat-ledge", ko: "산양 벼랑 샛길", layout: "ledge", tiers: 2, side: "chest", cover: "open", tags: ["cliff"], dress: [...MT_DRESS, "bd-pick-mountain-pass-boulder-l"],
    hero: hero("rockfall", "벼랑 밑 낙석 더미", "beside", 4, 2, [K(`${R}mt-rockfall`, 0, 0), K("bd-pick-mountain-pass-boulder-m", 3, 0)]) },
  { id: "three-pines", ko: "세 그루 소나무 길목", layout: "knoll", tiers: 1, side: "rest", cover: "open", tags: ["summit"], dress: MT_DRESS,
    hero: hero("three-pines", "세 그루 늙은 소나무", "knoll", 9, 5, [K(`${R}mt-pine-a`, 0, 0), K(`${R}mt-pine-b`, 3, 0), K(`${R}mt-pine-a`, 6, 0)]) },
  { id: "echo-valley", ko: "메아리 골짜기 길", layout: "switchback", tiers: 2, side: "lookout", cover: "canopy", tags: ["cliff"], dress: MT_DRESS,
    hero: hero("cairn-row", "골짜기를 따라 선 돌탑", "line", 1, 2, [K("bd-pick-deep-forest-path-cairn"), K("bd-pick-deep-forest-path-cairn-s"), K("bd-pick-deep-forest-path-cairn")]) },
  { id: "first-snow", ko: "첫눈 봉 등산로 입구", layout: "climb", tiers: 3, side: "none", cover: "firs", tags: ["snow"], dress: [`${R}mt-snow-patch`, `${R}mt-snow-rock`, `${R}mt-snow-patch`, "bd-pick-mountain-pass-boulder-m"],
    hero: hero("snow-field", "첫눈 쌓인 바위 밭", "beside", 7, 3, [K(`${R}mt-snow-rock`, 0, 1), K(`${R}mt-snow-patch`, 2, 1), K(`${R}mt-snow-rock`, 4, 0), K(`${R}mt-snow-patch`, 5, 1), K("bd-out-signpost", 6, 1)]) },
  { id: "fire-watch", ko: "산불 감시대 가는 길", layout: "knoll", tiers: 2, side: "chest", cover: "firs", tags: ["watchtower"], dress: MT_DRESS,
    hero: hero("watchtower", "산불 감시대", "knoll", 5, 6, [K(`${R}mt-watchtower`, 1, 0)]) },
  { id: "twelve-bends", ko: "굽이 열두 고개", layout: "switchback", tiers: 4, side: "rest", cover: "canopy", tags: ["shrine"], dress: MT_DRESS,
    hero: hero("pass-shrine", "고갯마루 길가 사당", "beside", 4, 3, [K("bd-pick-mountain-pass-shrine", 1, 0), K("bd-pick-deep-forest-path-cairn-s", 3, 2)]) },
  { id: "spring-climb", ko: "샘터 오름길", layout: "climb", tiers: 3, side: "rest", cover: "canopy", tags: ["spring"], dress: MT_DRESS,
    hero: hero("spring-trough", "통나무 물받이 샘터", "beside", 5, 3, [K(`${R}mt-spring-trough`, 0, 1), K("bd-pick-mountain-pass-trail-post", 4, 1)]) },
  { id: "leaf-hill", ko: "낙엽 쌓인 뒷산 길", layout: "brook", tiers: 1, side: "chest", cover: "canopy", tags: ["bridge"], dress: [`${R}mt-leaves`, `${R}mt-leaves`, "bd-pick-deep-forest-path-log-fallen", `${R}mt-leaves`],
    hero: hero("leaf-bridge", "낙엽 덮인 내 위의 널다리", "bridge", 2, 3, []) },
  { id: "ranger-hut", ko: "산지기 오두막 길", layout: "woods", tiers: 2, side: "none", cover: "canopy", tags: ["lodge"], dress: MT_DRESS,
    hero: hero("ranger-hut", "산지기 오두막과 장작 헛간", "beside", 8, 4, [K("bd-out-cabin-small", 0, 0), K("bd-out-woodshed", 5, 1), K("bd-out-signpost", 4, 2)]) },
];

const SPIRIT: readonly RouteVariant[] = [
  { id: "lantern-entry", ko: "정령 숲 입구", layout: "avenue", tiers: 1, side: "rest", cover: "spirit", tags: ["lantern"], dress: SP_DRESS,
    hero: hero("lantern-row", "길 따라 걸린 요정 등불", "line", 1, 2, [K(`${R}sp-lantern`)]) },
  { id: "fairy-ring", ko: "요정 고리 길목", layout: "glade", tiers: 1, side: "chest", cover: "spirit", tags: ["ring"], dress: SP_DRESS,
    hero: hero("fairy-ring", "요정 고리", "center", 4, 4, [K(`${R}sp-fairy-ring`)], { walkOver: true }) },
  { id: "tree-gate", ko: "속삭이는 나무 문", layout: "winding", tiers: 2, side: "none", cover: "spirit", tags: ["gate"], dress: SP_DRESS,
    hero: hero("tree-gate", "두 고목이 맞닿은 나무 문", "gate", 6, 6, [K(`${R}sp-tree-gate`)], { gap: [2, 3] }) },
  { id: "moon-spring", ko: "달빛 샘 가는 길", layout: "glade", tiers: 2, side: "rest", cover: "spirit", tags: ["spring"], dress: SP_DRESS,
    hero: hero("moon-spring", "달빛 샘", "center", 5, 4, [K(`${R}sp-moon-spring`)]) },
  { id: "root-gate", ko: "천년목 뿌리 문", layout: "winding", tiers: 3, side: "chest", cover: "spirit", tags: ["gate"], dress: SP_DRESS,
    hero: hero("root-gate", "천년목의 뿌리 문", "gate", 5, 4, [K(`${R}sp-root-gate`)], { gap: [2] }) },
  { id: "wisp-bog", ko: "도깨비불 늪 어귀", layout: "bog", tiers: 2, side: "none", cover: "spirit", tags: ["wisp"], dress: [`${R}sp-wisp`, `${R}sp-shroom-s`, `${R}sp-wisp`, `${R}sp-flower`], mood: "fog",
    hero: hero("wisps", "못 위를 떠도는 도깨비불", "line", 1, 2, [K(`${R}sp-wisp`)]) },
  { id: "shroom-burrow", ko: "빛나는 버섯 굴길", layout: "winding", tiers: 3, side: "chest", cover: "spirit", tags: ["mushrooms"], dress: [`${R}sp-shroom-m`, `${R}sp-shroom-s`, `${R}sp-shroom-m`, `${R}sp-shroom-s`],
    hero: hero("shroom-row", "길을 덮은 큰 빛 버섯", "line", 2, 3, [K(`${R}sp-shroom-l`), K(`${R}sp-shroom-l`), K(`${R}sp-shroom-m`)]) },
  { id: "sleeper-road", ko: "잠든 정령의 돌길", layout: "winding", tiers: 2, side: "rest", cover: "spirit", tags: ["statue"], dress: SP_DRESS,
    hero: hero("sleeper", "잠든 정령의 돌 얼굴", "beside", 5, 3, [K(`${R}sp-sleeper`, 1, 0), K(`${R}sp-stone-a`, 4, 1)]) },
  { id: "petal-path", ko: "꽃잎 날리는 숨은 길", layout: "forks", tiers: 2, side: "chest", cover: "spirit", tags: ["blossom"], dress: [`${R}sp-petals`, `${R}sp-flower`, `${R}sp-petals`, `${R}sp-flower`],
    hero: hero("blossom-grove", "꽃 핀 정령 나무 두 그루", "beside", 8, 5, [K(`${R}sp-tree-b`, 0, 0), K(`${R}sp-tree-b`, 4, 0)]) },
  { id: "world-tree", ko: "세계수 가는 길", layout: "avenue", tiers: 1, side: "none", cover: "spirit", tags: ["worldtree"], dress: SP_DRESS,
    hero: hero("world-root", "세계수의 밑동", "beside", 6, 5, [K(`${R}sp-world-root`, 0, 0)]) },
  { id: "mist-gate", ko: "안개 장막 숲 문", layout: "avenue", tiers: 2, side: "rest", cover: "spirit", tags: ["gate"], dress: SP_DRESS, mood: "fog",
    hero: hero("mist-gate", "안개 장막의 돌문", "gate", 5, 4, [K(`${R}sp-mist-stones`)], { gap: [2] }) },
  { id: "crystal-path", ko: "수정 나무 오솔길", layout: "winding", tiers: 2, side: "chest", cover: "spirit", tags: ["crystal"], dress: [`${R}sp-crystal`, `${R}sp-flower`, `${R}sp-crystal`, `${R}sp-shroom-s`],
    hero: hero("crystal-trees", "수정이 된 나무", "beside", 7, 4, [K(`${R}sp-crystal-tree`, 0, 0), K(`${R}sp-crystal-tree`, 4, 0), K(`${R}sp-crystal`, 3, 2)]) },
  { id: "lost-woods", ko: "길 잃는 숲 어귀", layout: "forks", tiers: 3, side: "none", cover: "spirit", tags: ["maze"], dress: SP_DRESS,
    hero: hero("fork-stones", "갈림마다 선 정령석", "line", 1, 2, [K(`${R}sp-stone-a`), K(`${R}sp-stone-b`)]) },
  { id: "stone-row", ko: "정령석 줄 선 길", layout: "avenue", tiers: 1, side: "chest", cover: "spirit", tags: ["stones"], dress: SP_DRESS,
    hero: hero("stone-row", "줄지어 선 정령석", "line", 1, 2, [K(`${R}sp-stone-a`), K(`${R}sp-stone-b`), K(`${R}sp-stone-a`)]) },
  { id: "stone-circle", ko: "정령석 고리 빈터", layout: "glade", tiers: 1, side: "none", cover: "spirit", tags: ["stones"], dress: SP_DRESS,
    hero: hero("stone-circle", "수정을 둘러선 정령석", "center", 5, 4, [K(`${R}sp-stone-a`, 0, 1), K(`${R}sp-crystal`, 2, 1), K(`${R}sp-stone-b`, 4, 1), K(`${R}sp-stone-b`, 1, 0), K(`${R}sp-stone-a`, 3, 0)]) },
  { id: "fairy-market", ko: "요정 시장 가는 샛길", layout: "winding", tiers: 2, side: "rest", cover: "spirit", tags: ["market"], dress: SP_DRESS,
    hero: hero("market", "버섯 지붕 요정 노점", "beside", 6, 3, [K(`${R}sp-market`, 0, 0), K(`${R}sp-lantern`, 3, 1), K(`${R}sp-shroom-m`, 4, 1), K(`${R}sp-lantern`, 5, 1)]) },
  { id: "silver-stag", ko: "은빛 사슴의 길", layout: "glade", tiers: 2, side: "none", cover: "spirit", tags: ["statue"], dress: SP_DRESS,
    hero: hero("stag", "은빛 사슴상", "center", 3, 3, [K(`${R}sp-stag`)]) },
  { id: "star-glade", ko: "별 떨어진 빈터 길", layout: "glade", tiers: 3, side: "chest", cover: "spirit", tags: ["star"], dress: [`${R}sp-crystal`, `${R}sp-flower`, `${R}sp-shroom-s`, `${R}sp-flower`],
    hero: hero("star-shard", "떨어진 별 조각", "center", 3, 3, [K(`${R}sp-star-shard`)]) },
  { id: "guardian-road", ko: "숲의 문지기 석상 길", layout: "avenue", tiers: 2, side: "chest", cover: "spirit", tags: ["statue"], dress: SP_DRESS,
    hero: hero("guardians", "길 양옆의 문지기 석상", "flank", 2, 3, [K(`${R}sp-guardian`)]) },
  { id: "vine-bridge", ko: "꿈꾸는 덩굴 다리", layout: "brook", tiers: 2, side: "rest", cover: "spirit", tags: ["bridge"], dress: SP_DRESS,
    hero: hero("vine-bridge", "살아 있는 덩굴 다리", "bridge", 2, 4, []) },
];

export const ROUTE_VARIANTS: Record<RouteTheme, readonly RouteVariant[]> = { mountain: MOUNTAIN, spirit: SPIRIT };

/** 모델이 features 로 청할 수 있는 낱말(갈래마다 닫힌 목록). */
export function routeFeatureWords(theme: RouteTheme): string[] {
  return [...new Set(ROUTE_VARIANTS[theme].flatMap((v) => v.tags))];
}

export function parseRouteTheme(value: unknown): RouteTheme | undefined {
  return ROUTE_THEMES.find((t) => t === value);
}

/**
 * 갈래 안의 가짓수 고르기: 게임 열쇠와 씨앗의 해시로, 그 게임이 아직 쓰지 않은 것 가운데서. feature(닫힌 낱말)가 오면 그 낱말을 가진 것으로 좁힌다.
 * 이름·요청 글은 받지 않는다.
 */
export function pickRouteVariant(theme: RouteTheme, key: string, seed: number, feature?: string, used: ReadonlySet<string> = new Set()): RouteVariant {
  const all = ROUTE_VARIANTS[theme];
  const asked = feature ? all.filter((v) => v.tags.includes(feature)) : [];
  const pool = asked.length ? asked : all;
  const fresh = pool.filter((v) => !used.has(v.id));
  const from = fresh.length ? fresh : pool;
  return from[lookHash(`route|${theme}|${key}|${seed}`) % from.length]!;
}
