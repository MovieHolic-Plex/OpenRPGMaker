/**
 * 『폴른 스타』 오프닝 — 영화식 콜드 오픈(39초, 새 게임에서 한 번).
 *
 * 2026-10-24 사용자 「영화처럼 30~45초, 엔진에 있는 기능만으로」: 레터박스·카메라 이동·시차 배경·입자·섬광·흔들림·색조·
 * 빛줄기(god ray)·페이드·BGM/효과음. 새로 그린 화소는 없다 — 배경은 이미 고른 오프닝 그림(src/assets/fallenStarOpeningBackdrops.ts)과
 * 그 그림에서 하늘만 오려 낸 땅 층(town-ground·fall-ground), 하늘은 OPRN 밤하늘 파노라마 세 겹(성운·먼 별·가까운 별)이다.
 *
 * 컷은 오프닝 곡(첫빛이 머무는 표지, 실측 마디 3.0초·박 0.75초, 첫 박 0.05초)의 마디에 맞춰 자른다:
 *   0  밤하늘(9s) → 9  별이 갈라진다(3s) → 12 숲 위로 떨어진다(6s) → 18 연기와 반딧불(6s) → 24 종이 울린다(6s) → 30 제목(9s) = 39s.
 * 컷 안의 타격(갈라짐·충돌·종)은 박 위에 둔다. 효과음은 컷 시계에 묶은 audioCues 라 그림과 어긋나지 않는다.
 * 모든 컷에 깊이가 다른 층이 셋 이상 있고 카메라는 천천히 민다. Esc 또는 오른쪽 위 「건너뛰기」를 탭하면 바로 맵으로 간다.
 */
import { fallenStarArt, type FallenStarArtId } from "@/assets/fallenStarOpeningBackdrops";
import { sampleAnimaticTrack, validateOpeningAnimatic, type AnimaticKey, type AnimaticLayer, type OpeningAnimatic } from "@/project/openingAnimatic";
import type { Project } from "@/project/types";

const STAGE = { width: 480, height: 270 } as const;
const CENTER = { x: STAGE.width / 2, y: STAGE.height / 2 } as const;
const LETTERBOX = 0.12;
const CAPTION_COLOR = "#fff0dc";
/** 오프닝 곡 한 박(80 BPM 실측). 컷 길이는 마디(4박) 배수다. */
const BEAT = 750;

const SE = {
  glass: "cc0-se-osx-glass-02",
  boom: "cc0-se-osx-explosion",
  gong: "cc0-se-osx-gong-02",
  fire: "cc0-se-ors-spell-fire-03",
  rubble: "cc0-se-ors-stones-02",
  crackle: "cc0-se-ors-spell-fire-05",
  bell: "cc0-se-osx-bell-01",
} as const;

type Point = { x: number; y: number };
type CamKeys = { x: AnimaticKey[]; y: AnimaticKey[]; zoom?: AnimaticKey[] };

// ── 공통 층 ─────────────────────────────────────────────────────────────

function art(id: FallenStarArtId, at: Point = { x: 0, y: 0 }, extra: Partial<AnimaticLayer> = {}): AnimaticLayer {
  const { resourceId, width, height } = fallenStarArt(id);
  return { id, kind: "image", role: "background", resourceId, sampling: "nearest", x: at.x, y: at.y, width, height, ...extra };
}

function glow(id: string, color: string, center: Point, size: number, extra: Partial<AnimaticLayer> = {}): AnimaticLayer {
  return { id, kind: "glow", role: "effect", color, blend: "lighter", x: center.x - size / 2, y: center.y - size / 2, width: size, height: size,
    glow: { inner: 0.3, pulse: { hz: 0.7, amount: 0.25, pattern: "pulse", seed: id.length } }, ...extra };
}

/** 촛불·창 불빛 — 작은 빛이 제각각 깜빡인다. */
function flicker(id: string, at: Point, size = 22, color = "#ffc070", opacity = 0.45): AnimaticLayer {
  return glow(id, color, at, size, { opacity, glow: { inner: 0.25, pulse: { hz: 1.6 + (id.length % 5) * 0.23, amount: 0.35, pattern: "flicker", seed: id.length * 7 } } });
}

function particles(id: string, preset: "stars" | "sparks" | "dust", color: string, box: { x: number; y: number; width: number; height: number }, count: number, seed: number, extra: Partial<AnimaticLayer> = {}): AnimaticLayer {
  return { id, kind: "particles", role: "effect", color, opacity: 0.7, blend: "lighter", ...box, particles: { preset, count, seed, speed: preset === "stars" ? 6 : 10, size: preset === "dust" ? 2 : 1 }, ...extra };
}

/** 화면에 붙은 판(섬광·색조·암전). 카메라를 따라가지 않는다. */
function screenFill(id: string, color: string, opacity: AnimaticKey[], blend: AnimaticLayer["blend"] = "source-over", extra: Partial<AnimaticLayer> = {}): AnimaticLayer {
  return { id, kind: "shape", shape: "rect", role: "effect", space: "screen", color, blend, x: 0, y: 0, width: STAGE.width, height: STAGE.height, opacity: 1, keys: { opacity }, ...extra };
}

function caption(cues: readonly { atMs: number; text: string }[]): AnimaticLayer {
  return { id: "caption", kind: "caption", x: 0, y: 0, width: STAGE.width, height: 38, color: CAPTION_COLOR, typography: { fontSize: 16, align: "center", weight: 700 },
    caption: { cues: cues.map(cue => ({ ...cue, typewriterMs: 500 })), fadeOutMs: 400 } };
}

const key = (atMs: number, value: number, ease?: AnimaticKey["ease"]): AnimaticKey => (ease ? { atMs, value, ease } : { atMs, value });

// ── 카메라와 시차 ───────────────────────────────────────────────────────
// 렌더러: 깊이 p 인 층의 점 X 는 화면 X − (카메라 − 화면 가운데)·p 에 그려진다(줌 1).
// 0ms 값이 가운데 띠(|x| ≤ 너비/4, |y| ≤ 높이/4) 안이면 컷 내내 가운데 오프셋이고, 밖이면 세계 좌표다. 이 컷은 세계 좌표로 시작한다.

function camAt(cam: CamKeys, t: number): Point {
  return { x: sampleAnimaticTrack(cam.x, t, CENTER.x), y: sampleAnimaticTrack(cam.y, t, CENTER.y) };
}

/** 카메라가 지나는 범위 전체에서 깊이 p 층이 화면을 덮도록, 반복 가능한 그림을 바둑판으로 깐다. */
function tiled(prefix: string, resourceId: string, tile: { w: number; h: number }, scale: number, p: number, cam: CamKeys, extra: Partial<AnimaticLayer> = {}): AnimaticLayer[] {
  const xs = cam.x.map(k => k.value), ys = cam.y.map(k => k.value), margin = 8;
  const x0 = (Math.min(...xs) - CENTER.x) * p - margin, x1 = STAGE.width + (Math.max(...xs) - CENTER.x) * p + margin;
  const y0 = (Math.min(...ys) - CENTER.y) * p - margin, y1 = STAGE.height + (Math.max(...ys) - CENTER.y) * p + margin;
  const w = tile.w * scale, h = tile.h * scale, out: AnimaticLayer[] = [];
  // 사방 이음매 없는 그림이라 어디서 시작해도 된다 — 필요한 범위의 왼쪽 위에서 바로 깐다(겹 수 최소).
  for (let x = Math.floor(x0); x < x1; x += w) for (let y = Math.floor(y0); y < y1; y += h) {
    out.push({ id: `${prefix}-${out.length}`, kind: "image", role: "background", resourceId, sampling: "nearest", x, y, width: w, height: h, parallax: p, ...extra });
  }
  return out;
}

/** 밤하늘 네 겹 — 성운(가장 멀다) · 먼 별 · 가까운 별(2배) · 반짝이는 별 입자. */
function nightSky(cam: CamKeys, depth = { nebula: 0.12, far: 0.3, near: 0.55, twinkle: 0.8 }): AnimaticLayer[] {
  const tile = { w: 320, h: 256 };
  const xs = cam.x.map(k => k.value), ys = cam.y.map(k => k.value);
  const tw = depth.twinkle, box = {
    x: (Math.min(...xs) - CENTER.x) * tw - 16, y: (Math.min(...ys) - CENTER.y) * tw - 16,
    width: STAGE.width + (Math.max(...xs) - Math.min(...xs)) * tw + 32, height: STAGE.height + (Math.max(...ys) - Math.min(...ys)) * tw + 32,
  };
  return [
    ...tiled("sky-nebula", "oprn-pano-night", tile, 2, depth.nebula, cam),
    ...tiled("sky-far", "oprn-pano-night-stars-far", tile, 1, depth.far, cam),
    ...tiled("sky-near", "oprn-pano-night-stars-near", tile, 2, depth.near, cam, { opacity: 0.9 }),
    particles("sky-twinkle", "stars", "#e8f0ff", box, Math.min(200, Math.round(box.width * box.height / 1400)), 11, { parallax: tw, opacity: 0.55 }),
  ];
}

/** 화면 위치(카메라를 따라 움직이는 대상)를 세계 좌표 키로 바꾼다 — 카메라가 대상을 정확히 따라간다. */
function follow(cam: CamKeys, screenPath: (t: number) => Point, from: number, to: number, step = 125, delay = 0, p = 1): { x: AnimaticKey[]; y: AnimaticKey[] } {
  const x: AnimaticKey[] = [], y: AnimaticKey[] = [];
  for (let t = from; t <= to; t += step) {
    const s = screenPath(Math.max(from, t - delay)), c = camAt(cam, t);
    x.push(key(t, Math.round((s.x + (c.x - CENTER.x) * p) * 10) / 10));
    y.push(key(t, Math.round((s.y + (c.y - CENTER.y) * p) * 10) / 10));
  }
  return { x, y };
}

const offsetKeys = (keys: AnimaticKey[], by: number): AnimaticKey[] => keys.map(k => ({ ...k, value: k.value - by }));

// upscale nearest: 정수 배율 캔버스에 그려 도트가 번지지 않는다(글자·빛은 그 해상도로).
const shot = (layers: AnimaticLayer[], camera: OpeningAnimatic["camera"], transition: OpeningAnimatic["transition"], audioCues: OpeningAnimatic["audioCues"] = [], background = "#03050d"): OpeningAnimatic =>
  ({ width: STAGE.width, height: STAGE.height, background, letterbox: LETTERBOX, upscale: "nearest", layers, ...(camera ? { camera } : {}), ...(transition ? { transition } : {}), ...(audioCues.length ? { audioCues } : {}) });

// ── 1. 밤하늘 ───────────────────────────────────────────────────────────
/** 깊이가 다른 별들이 천천히 흐른다. 한 별만 점점 밝아진다. */
const SKY_CAM: CamKeys = { x: [key(0, 290), key(9000, 380, "ease-in-out")], y: [key(0, 236), key(9000, 190, "ease-in-out")] };
/** 큰 별은 먼 별과 같은 깊이 — 컷 끝에서 화면 (300,118). */
const GREAT_STAR_P = 0.3;
const GREAT_STAR = { x: 300 + (380 - CENTER.x) * GREAT_STAR_P, y: 118 + (190 - CENTER.y) * GREAT_STAR_P };

function skyShot(): OpeningAnimatic {
  return shot([
    ...nightSky(SKY_CAM),
    glow("great-star-halo", "#bcd8ff", GREAT_STAR, 46, { parallax: GREAT_STAR_P, keys: { opacity: [key(0, 0.25), key(6500, 0.55, "ease-in"), key(9000, 0.9, "ease-in")] },
      glow: { inner: 0.2, pulse: { hz: 0.9, amount: 0.35, pattern: "pulse", seed: 5 } } }),
    glow("great-star", "#ffffff", GREAT_STAR, 10, { parallax: GREAT_STAR_P, opacity: 0.95, glow: { inner: 0.5, pulse: { hz: 1.7, amount: 0.3, pattern: "flicker", seed: 9 } } }),
    // 가장 가까운 겹 — 큰 별 몇 개가 카메라와 거의 같이 흐른다(깊이 1.0, 가장 빠르다).
    particles("sky-close", "stars", "#f4f8ff", { x: 40, y: 50, width: 600, height: 290 }, 14, 29, { parallax: 1, opacity: 0.8, particles: { preset: "stars", count: 14, seed: 29, speed: 6, size: 1.6 } }),
    // 어둠에서 천천히 밝아진다. 첫 2초 남짓은 게임이 뒤에서 맵을 짓느라 바쁜 때라(실측: 출하 플레이어에서 첫 컷 0.3~2.3초에 화면이 멎는다)
    // 그동안은 검게 두어 멎음이 보이지 않게 한다(그래서 이 컷만 세 마디). 음악은 처음부터 흐른다.
    screenFill("dawn", "#03050d", [key(0, 1), key(2600, 1), key(4600, 0, "ease-in-out")]),
    caption([{ atMs: 4200, text: "별을 읽는 왕도 아스텔. 그날 밤도 하늘은 고요했다." }]),
  ], { keys: SKY_CAM }, { kind: "cut", durationMs: 1 });
}

// ── 2. 별이 갈라진다 ────────────────────────────────────────────────────
/** 큰 별에 다가선 컷. 둘째 박(0.75s)에 금이 가고 하얗게 터진다 — 섬광·흔들림·유리·폭음·징. 큰 조각은 오른쪽 아래로 떨어지기 시작한다. */
function crackShot(): OpeningAnimatic {
  const cam: CamKeys = { x: [key(0, 300), key(3000, 308, "ease-in-out")], y: [key(0, 160), key(3000, 156, "ease-in-out")] };
  const star = { x: 300, y: 160 }, hit = BEAT;
  const cracks = [-150, -95, -40, 15, 70, 128].map((angle, i): AnimaticLayer => ({
    id: `crack-${i}`, kind: "shape", shape: "line", role: "effect", color: "#f4fbff", blend: "lighter", x: star.x, y: star.y, width: 26 + (i % 3) * 9, height: 1,
    rotation: angle, startMs: hit - 120, endMs: hit + 420, keys: { scaleX: [key(hit - 120, 0.1), key(hit, 1, "ease-out")], opacity: [key(hit - 120, 1), key(hit + 420, 0, "ease-in")] },
  }));
  return shot([
    ...nightSky(cam, { nebula: 0.1, far: 0.25, near: 0.5, twinkle: 0.75 }),
    glow("halo", "#cfe4ff", star, 96, { endMs: hit + 200, keys: { scaleX: [key(0, 1), key(hit, 1.35, "ease-in")], scaleY: [key(0, 1), key(hit, 1.35, "ease-in")], opacity: [key(0, 0.6), key(hit, 1, "ease-in")] },
      anchorX: 0.5, anchorY: 0.5, x: star.x, y: star.y, glow: { inner: 0.25, pulse: { hz: 4, amount: 0.4, pattern: "flicker", seed: 3 } } }),
    glow("core", "#ffffff", star, 22, { endMs: hit + 60, glow: { inner: 0.6, pulse: { hz: 6, amount: 0.3, pattern: "flicker", seed: 4 } } }),
    ...cracks,
    // 터진 뒤: 작은 푸른 조각은 위로 사라지고, 큰 조각은 불붙어 오른쪽 아래로.
    glow("shard-small", "#a8d8ff", star, 20, { startMs: hit, keys: { x: [key(hit, star.x - 10), key(3000, star.x - 120, "ease-out")], y: [key(hit, star.y - 10), key(3000, star.y - 70, "ease-out")], opacity: [key(hit, 1), key(3000, 0, "ease-in")] } }),
    glow("shard-fire", "#ffb060", star, 54, { startMs: hit, keys: { x: [key(hit, star.x - 27), key(3000, star.x + 150, "ease-in")], y: [key(hit, star.y - 27), key(3000, star.y + 110, "ease-in")] },
      glow: { inner: 0.3, pulse: { hz: 5, amount: 0.3, pattern: "flicker", seed: 6 } } }),
    glow("shard-core", "#fff6e0", star, 16, { startMs: hit, keys: { x: [key(hit, star.x - 8), key(3000, star.x + 169, "ease-in")], y: [key(hit, star.y - 8), key(3000, star.y + 129, "ease-in")] } }),
    particles("burst", "sparks", "#ffd8a0", { x: star.x - 70, y: star.y - 60, width: 140, height: 120 }, 60, 17, { startMs: hit, endMs: 2600, keys: { opacity: [key(hit, 1), key(2600, 0, "ease-in")] } }),
    screenFill("tint", "#ff7a30", [key(0, 0), key(hit, 0), key(hit + 300, 0.22, "ease-out"), key(3000, 0.1)], "screen"),
    screenFill("flash", "#ffffff", [key(0, 0), key(hit - 40, 0), key(hit + 40, 0.95), key(hit + 520, 0, "ease-out")]),
    caption([{ atMs: 1500, text: "그리고 별 하나가, 갈라졌다." }]),
  ], { keys: cam, shake: { atMs: hit, durationMs: 1000, amplitude: 5, frequency: 18, seed: 7 } }, { kind: "cut", durationMs: 1 }, [
    { id: "glass", resourceId: SE.glass, atMs: hit - 150, durationMs: 900, volume: 0.6 },
    { id: "boom", resourceId: SE.boom, atMs: hit, durationMs: 1200, volume: 0.9 },
    { id: "gong", resourceId: SE.gong, atMs: hit, durationMs: 1800, volume: 0.55, fadeOutMs: 600 },
  ]);
}

// ── 3. 숲 위로 떨어진다 ─────────────────────────────────────────────────
/** 카메라가 불덩이를 따라 하늘에서 왕도 위로 내려온다. 불덩이는 왕도 북쪽 숲 나무 뒤로 떨어지고 지평선이 하얗게 터진다. */
const FALL_GROUND_Y = 400;
const FALL_CAM: CamKeys = { x: [key(0, 244), key(5600, 264, "ease-in-out")], y: [key(0, 230), key(5600, 500, "ease-in-out")] };
/** 떨어지는 곳 — fall 그림 위쪽(북쪽) 성벽 너머 숲의 나무선(그림 좌표 320,70). 왕도의 숲은 북쪽에 있다. */
const IMPACT = { x: 320, y: FALL_GROUND_Y + 70 };
const FALL_HIT = 5250;

function fireballScreen(t: number): Point {
  // 화면 위치 — 왼쪽 위에서 들어와 지평선(카메라와 함께 올라온다) 바로 위를 지나 나무 뒤로.
  const end = camAt(FALL_CAM, FALL_HIT), endScreen = { x: IMPACT.x - (end.x - CENTER.x), y: IMPACT.y - (end.y - CENTER.y) };
  const path: [number, Point][] = [[0, { x: 40, y: 40 }], [1800, { x: 160, y: 70 }], [3800, { x: 250, y: 92 }], [FALL_HIT, endScreen]];
  for (let i = 1; i < path.length; i++) {
    const [ta, a] = path[i - 1]!, [tb, b] = path[i]!;
    if (t <= tb) { const u = Math.max(0, (t - ta) / (tb - ta)); return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }; }
  }
  return endScreen;
}

function fallShot(): OpeningAnimatic {
  const head = follow(FALL_CAM, fireballScreen, 0, FALL_HIT);
  const trail = (id: string, delay: number, size: number, color: string, opacity: number): AnimaticLayer => {
    const k = follow(FALL_CAM, fireballScreen, 0, FALL_HIT, 125, delay);
    return { ...glow(id, color, { x: 0, y: 0 }, size, { opacity, endMs: FALL_HIT + 150, glow: { inner: 0.3, pulse: { hz: 6, amount: 0.3, pattern: "flicker", seed: size } } }),
      keys: { x: offsetKeys(k.x, size / 2), y: offsetKeys(k.y, size / 2) } };
  };
  return shot([
    ...nightSky(FALL_CAM, { nebula: 0.12, far: 0.28, near: 0.5, twinkle: 0.7 }),
    // 불덩이와 꼬리 — 땅 층보다 먼저 그려 지평선의 나무가 앞을 가린다.
    trail("trail-4", 620, 22, "#7a2a18", 0.3), trail("trail-3", 420, 28, "#c8401c", 0.4), trail("trail-2", 260, 36, "#ff6a30", 0.5), trail("trail-1", 120, 46, "#ff9a40", 0.65),
    { ...particles("embers", "sparks", "#ffc080", { x: 0, y: 0, width: 90, height: 70 }, 40, 23, { endMs: FALL_HIT + 300 }), keys: { x: offsetKeys(head.x, 60), y: offsetKeys(head.y, 20) } },
    { ...glow("fireball", "#ffd890", { x: 0, y: 0 }, 60, { endMs: FALL_HIT + 100, glow: { inner: 0.35, pulse: { hz: 7, amount: 0.25, pattern: "flicker", seed: 2 } } }), keys: { x: offsetKeys(head.x, 30), y: offsetKeys(head.y, 30) } },
    { ...glow("fireball-core", "#ffffff", { x: 0, y: 0 }, 14, { endMs: FALL_HIT + 60 }), keys: { x: offsetKeys(head.x, 7), y: offsetKeys(head.y, 7) } },
    glow("impact-glow", "#ffe2a8", IMPACT, 320, { startMs: FALL_HIT, keys: { opacity: [key(FALL_HIT, 0), key(FALL_HIT + 140, 1, "ease-out"), key(6000, 0.75)] }, glow: { inner: 0.2, pulse: { hz: 3, amount: 0.2, pattern: "flicker", seed: 8 } } }),
    art("fall-ground", { x: 0, y: FALL_GROUND_Y }),
    // 왕도의 등불 — 땅과 같은 깊이.
    flicker("bridge-lamp", { x: 150, y: FALL_GROUND_Y + 200 }, 24), flicker("lamp-b", { x: 215, y: FALL_GROUND_Y + 195 }), flicker("win-c", { x: 130, y: FALL_GROUND_Y + 125 }),
    // 지나가는 불빛이 왕도를 붉게 물들인다.
    screenFill("warm", "#ff8a40", [key(0, 0), key(3800, 0.08, "ease-in"), key(FALL_HIT, 0.14), key(6000, 0.2)], "screen"),
    screenFill("flash", "#fff4d8", [key(0, 0), key(FALL_HIT, 0), key(FALL_HIT + 80, 0.85), key(5750, 0.12, "ease-out"), key(6000, 0.3, "ease-in")]),
    caption([{ atMs: 1200, text: "불꼬리를 끌며, 왕도 북쪽 숲으로." }]),
  ], { keys: FALL_CAM, shake: { atMs: FALL_HIT, durationMs: 740, amplitude: 4, frequency: 14, seed: 4 } }, { kind: "cut", durationMs: 1 }, [
    { id: "roar", resourceId: SE.fire, atMs: 0, durationMs: 2600, volume: 0.55, fadeOutMs: 900 },
    { id: "roar-2", resourceId: SE.fire, atMs: 2400, durationMs: 2600, volume: 0.7, fadeOutMs: 900 },
    { id: "impact", resourceId: SE.boom, atMs: FALL_HIT, durationMs: 740, volume: 1 },
    { id: "impact-gong", resourceId: SE.gong, atMs: FALL_HIT, durationMs: 740, volume: 0.5 },
  ]);
}

// ── 4. 연기와 반딧불 ────────────────────────────────────────────────────
/** 그을린 구덩이 한가운데의 은빛 알. 충돌의 빛이 사그라들고, 연기가 오르고, 반딧불이 모여든다. */
function aftermathShot(): OpeningAnimatic {
  const pod = { x: 272, y: 166 };
  const cam: CamKeys = { x: [key(0, 252), key(6000, 274, "ease-in-out")], y: [key(0, 140), key(6000, 162, "ease-in-out")] };
  return shot([
    art("crash"),
    glow("impact-fade", "#ffd090", pod, 300, { keys: { opacity: [key(0, 0.95), key(3000, 0.18, "ease-out"), key(6000, 0.08)] }, glow: { inner: 0.25, pulse: { hz: 2.5, amount: 0.25, pattern: "flicker", seed: 12 } } }),
    glow("pod-glow", "#8ff0ff", pod, 80, { keys: { opacity: [key(0, 0), key(2200, 0), key(4200, 0.55, "ease-in-out")] }, glow: { inner: 0.35, pulse: { hz: 1.1, amount: 0.4, pattern: "pulse", seed: 7 } } }),
    // 깊이: 땅(1) < 연기(1.12) < 불티(1.25) < 반딧불(1.4, 가장 가깝다).
    particles("smoke", "dust", "#7d8597", { x: pod.x - 90, y: pod.y - 130, width: 180, height: 150 }, 46, 12, { parallax: 1.12, blend: undefined, keys: { opacity: [key(0, 0.15), key(1500, 0.5, "ease-out"), key(6000, 0.4)] } }),
    particles("embers", "sparks", "#ffb070", { x: pod.x - 90, y: pod.y - 60, width: 180, height: 100 }, 26, 9, { parallax: 1.25, keys: { opacity: [key(0, 0.95), key(3600, 0, "ease-in")] }, endMs: 3600 }),
    particles("fireflies", "dust", "#d8ff88", { x: pod.x - 200, y: pod.y - 110, width: 400, height: 200 }, 22, 31, { parallax: 1.4, startMs: 2400, keys: { opacity: [key(2400, 0), key(4200, 0.85, "ease-in-out")] } }),
    screenFill("cool", "#203a68", [key(0, 0), key(2000, 0), key(6000, 0.22, "ease-in-out")], "multiply"),
    caption([{ atMs: 1500, text: "북쪽 숲 깊은 곳. 그 한가운데, 은빛 알이 숨 쉬듯 빛났다." }]),
  ], { keys: cam }, { kind: "flash", durationMs: 450, color: "#fff2d0" }, [
    { id: "rubble", resourceId: SE.rubble, atMs: 0, durationMs: 1500, volume: 0.6 },
    { id: "crackle", resourceId: SE.crackle, atMs: 300, durationMs: 2400, volume: 0.25, fadeOutMs: 1200 },
  ]);
}

// ── 5. 종이 울린다 ──────────────────────────────────────────────────────
/** 왕도의 밤. 천문대 종이 박마다 울리고, 발코니의 카엘이 북쪽 하늘을 올려다본다. 카메라는 발코니로 정수 2배까지 다가선다. */
function bellShot(): OpeningAnimatic {
  const cam: CamKeys = { x: [key(0, 262), key(1500, 258), key(6000, 200, "ease-in-out")], y: [key(0, 138), key(1500, 142), key(6000, 168, "ease-in-out")],
    zoom: [key(0, 1), key(1500, 1), key(6000, 2, "ease-in-out")] };
  const bell = { x: 209, y: 92 }, kael = { x: 191, y: 177 }, elena = { x: 206, y: 177 };
  // 종이 울릴 때마다 탑 꼭대기에서 부드러운 빛이 한 번 퍼졌다 사라진다(소리의 박을 눈으로).
  const ring = (i: number, at: number): AnimaticLayer => ({ ...glow(`ring-${i}`, "#ffe2a0", bell, 90, { startMs: at, endMs: Math.min(6000, at + 1200) }),
    anchorX: 0.5, anchorY: 0.5, x: bell.x, y: bell.y, glow: { inner: 0.12 },
    keys: { scaleX: [key(at, 0.3), key(at + 1200, 1.7, "ease-out")], scaleY: [key(at, 0.3), key(at + 1200, 1.7, "ease-out")], opacity: [key(at, 0.5), key(at + 1200, 0, "ease-in")] } });
  return shot([
    ...nightSky({ x: cam.x, y: cam.y }, { nebula: 0.12, far: 0.3, near: 0.5, twinkle: 0.7 }),
    // 북쪽 숲은 아직 타고 있다 — 성벽 위 나무선 너머 붉은 빛(하늘과 땅 사이 깊이).
    glow("north-fire", "#ff8040", { x: 340, y: 46 }, 150, { parallax: 0.9, opacity: 0.55, glow: { inner: 0.2, pulse: { hz: 1.3, amount: 0.35, pattern: "flicker", seed: 14 } } }),
    art("town-ground"),
    flicker("door", { x: 205, y: 235 }, 26), flicker("lamp-l", { x: 162, y: 262 }), flicker("balcony", { x: 205, y: 178 }, 20),
    flicker("win-a", { x: 75, y: 160 }), flicker("win-b", { x: 470, y: 200 }, 18), flicker("bridge-lamp", { x: 130, y: 265 }),
    ring(0, 0), ring(1, 2 * BEAT), ring(2, 4 * BEAT),
    { id: "kael-looks", kind: "emote", role: "effect", x: kael.x - 7, y: kael.y - 23, width: 14, height: 16, startMs: 2600, endMs: 5600, emote: { preset: "exclaim", tail: "down", popMs: 160, outMs: 220 } },
    { id: "elena-looks", kind: "emote", role: "effect", x: elena.x - 7, y: elena.y - 23, width: 14, height: 16, startMs: 3500, endMs: 5600, emote: { preset: "question", tail: "down", popMs: 160, outMs: 220 } },
    particles("fireflies", "dust", "#d8ff88", { x: 60, y: 120, width: 420, height: 160 }, 14, 41, { parallax: 1.3, opacity: 0.6 }),
    caption([{ atMs: 400, text: "그 밤, 천문대의 종이 울렸다." }, { atMs: 3000, text: "견습 별지기 카엘은 북쪽 하늘을 올려다보았다." }]),
  ], { keys: cam }, { kind: "fade", durationMs: 500 }, [
    { id: "bell-1", resourceId: SE.bell, atMs: 0, durationMs: 1400, volume: 0.8 },
    { id: "bell-2", resourceId: SE.bell, atMs: 2 * BEAT, durationMs: 1400, volume: 0.7 },
    { id: "bell-3", resourceId: SE.bell, atMs: 4 * BEAT, durationMs: 1400, volume: 0.6 },
  ]);
}

// ── 6. 제목 ─────────────────────────────────────────────────────────────
/** 키아트 위로 빛줄기가 내려오고, 마디 첫 박에 제목이 떠오른다. 끝은 검게 닫혀 맵으로 넘어간다. */
function titleShot(): OpeningAnimatic {
  const cam: CamKeys = { x: [key(0, 240), key(9000, 240)], y: [key(0, 152), key(9000, 122, "ease-in-out")] };
  const logoAt = 4 * BEAT, subAt = 6 * BEAT;
  const ray = (i: number, x: number, rotation: number, width: number): AnimaticLayer => ({
    id: `ray-${i}`, kind: "shaft", role: "effect", color: "#ffe6b0", blend: "lighter", x, y: -30, width, height: 300, rotation, parallax: 0.85,
    shaft: { spread: 0.55, softness: 0.8, dust: { count: 10, seed: 50 + i, speed: 8, size: 1 }, pulse: { hz: 0.35 + i * 0.07, amount: 0.25, pattern: "pulse", seed: i } },
    keys: { opacity: [key(0, 0), key(1500, 0.22, "ease-in"), key(logoAt, 0.42, "ease-in-out"), key(8000, 0.3)] },
  });
  return shot([
    art("title", { x: 0, y: 0 }),
    particles("sky-twinkle", "stars", "#eef4ff", { x: -20, y: 0, width: 520, height: 90 }, 40, 61, { parallax: 0.6, opacity: 0.5 }),
    ray(0, 300, 22, 60), ray(1, 250, 16, 46), ray(2, 350, 28, 38),
    glow("logo-glow", "#ffcf70", { x: 240, y: 96 }, 260, { space: "screen", startMs: logoAt - 400, keys: { opacity: [key(logoAt - 400, 0), key(logoAt + 600, 0.38, "ease-out"), key(9000, 0.26)] },
      glow: { inner: 0.25, pulse: { hz: 0.5, amount: 0.15, pattern: "pulse", seed: 21 } } }),
    { id: "logo", kind: "text", role: "credit", space: "screen", text: "폴른 스타", color: "#f6d98a", x: 0, y: 70, width: STAGE.width, height: 60,
      typography: { fontSize: 46, weight: 800, align: "center" }, startMs: logoAt, keys: { opacity: [key(logoAt, 0), key(logoAt + 900, 1, "ease-out")], y: [key(logoAt, 78), key(logoAt + 900, 70, "ease-out")] } },
    { id: "subtitle", kind: "text", role: "credit", space: "screen", text: "제1막 · 떨어진 별", color: "#e8eefc", x: 0, y: 128, width: STAGE.width, height: 22,
      typography: { fontSize: 15, weight: 700, align: "center" }, startMs: subAt, keys: { opacity: [key(subAt, 0), key(subAt + 700, 0.9, "ease-out")] } },
    particles("motes", "dust", "#ffe8b8", { x: -20, y: 40, width: 520, height: 230 }, 24, 71, { parallax: 1.3, opacity: 0.45 }),
    screenFill("close", "#000000", [key(0, 0), key(7600, 0), key(9000, 1, "ease-in")]),
  ], { keys: cam }, { kind: "fade", durationMs: 1200 }, [
    { id: "logo-gong", resourceId: SE.gong, atMs: logoAt, durationMs: 1900, volume: 0.35, fadeOutMs: 900 },
  ]);
}

/** 컷 길이는 마디(3초) 배수. */
const SHOTS: readonly { id: string; build: () => OpeningAnimatic; ms: number }[] = [
  { id: "fs_op_sky", build: skyShot, ms: 9000 },
  { id: "fs_op_crack", build: crackShot, ms: 3000 },
  { id: "fs_op_fall", build: fallShot, ms: 6000 },
  { id: "fs_op_aftermath", build: aftermathShot, ms: 6000 },
  { id: "fs_op_bell", build: bellShot, ms: 6000 },
  { id: "fs_op_title", build: titleShot, ms: 9000 },
];

export function buildFallenStarOpening(project: Project): void {
  const scenes = SHOTS.map(({ id, build, ms }) => {
    const composition = build();
    validateOpeningAnimatic(composition, ms, `opening.${id}`);
    return { id, kind: "animatic" as const, composition, durationMs: ms, narration: "" };
  });
  project.system.opening = { enabled: true, skippable: true, scenes };
  // 도구 경로가 남긴 저작 타임라인이 있으면 이 오프닝을 덮어쓴다 — 지운다.
  const timelines = (project.meta as { oprnCinematicTimelines?: { entries?: { target?: string }[] } }).oprnCinematicTimelines;
  if (timelines?.entries) timelines.entries = timelines.entries.filter(entry => entry.target !== "opening");
}

/** 타이틀 키아트 — 별똥별이 천문대 위를 지나는 밤 왕도(480×270, 화면 1배). */
export const FALLEN_STAR_TITLE_BACKGROUND = fallenStarArt("title").resourceId;
