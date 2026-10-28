/**
 * 『폴른 스타』 오프닝 — 애니메틱 콜드 오픈(42초, 새 게임에서 한 번).
 *
 * 2026-10-24 사용자 「영화처럼 30~45초, 엔진에 있는 기능만으로」: 레터박스·카메라 이동·시차 배경·입자·섬광·흔들림·색조·
 * 빛줄기(god ray)·페이드·BGM/효과음. 새로 그린 화소는 없다 — 배경은 이미 고른 오프닝 그림(src/assets/fallenStarOpeningBackdrops.ts)과
 * 그 그림에서 하늘만 오려 낸 땅 층(town-ground·fall-ground), 하늘은 OPRN 밤하늘 파노라마 세 겹(성운·먼 별·가까운 별)이다.
 * 2026-10-29 사용자 「좀 더 애니메틱하게. 효과음도, 대사 타이밍도」: 컷마다 카메라 동기(밀기·물러서기·틸트), 박에 맞춘 타격,
 * 반 박 늦게 뜨고 사건 전에 사라지는 자막, 층을 쌓은 자체 합성 효과음(scripts/content/fallen/opening-sfx.py), 천문대 안 컷 추가.
 *
 * 컷은 오프닝 곡(첫빛이 머무는 표지, 실측 마디 3.0초·박 0.75초)의 마디에 맞춰 자른다:
 *   0  별이 떨어진다(18.75s: 밤하늘 → 6.0~8.25 심장 박 넷 → 9.0 숨 들이켜기 → 9.75 갈라짐 → 17.25 충돌 → 두 박 흔들림)
 *   18.75 연기와 은빛 알(5.25s) → 24 천문대 안, 첫 종(3s) → 27 종이 울린다·카엘(6s) → 33 제목(9s) = 42s.
 * 컷 안의 타격(갈라짐·충돌·종·제목)은 박 위에 둔다. 효과음은 컷 시계에 묶은 audioCues 라 그림과 어긋나지 않는다.
 * 모든 컷에 깊이가 다른 층이 셋 이상 있고 카메라는 늘 움직인다. Esc 또는 오른쪽 위 「건너뛰기」를 탭하면 바로 맵으로 간다.
 */
import { fallenStarArt, type FallenStarArtId } from "@/assets/fallenStarOpeningBackdrops";
import { sampleAnimaticTrack, validateOpeningAnimatic, type AnimaticKey, type AnimaticLayer, type AnimaticParticlePreset, type OpeningAnimatic } from "@/project/openingAnimatic";
import type { Project } from "@/project/types";

const STAGE = { width: 480, height: 270 } as const;
const CENTER = { x: STAGE.width / 2, y: STAGE.height / 2 } as const;
const LETTERBOX = 0.12;
const CAPTION_COLOR = "#fff0dc";
/** 밤 땅 — 낮빛 그림을 짙은 남색 쪽으로 당긴다. */
const NIGHT = { color: "#0e1736", amount: 0.5 } as const;
/** 오프닝 곡 한 박(80 BPM 실측). 컷 길이는 마디(4박) 배수다. */
const BEAT = 750;

const SE = {
  bell: "cc0-sound-fs-op-bell",
  air: "cc0-sound-fs-op-night-air",
  swell: "cc0-sound-fs-op-star-swell",
  crack: "cc0-sound-fs-op-star-crack",
  roar: "cc0-sound-fs-op-meteor-roar",
  impact: "cc0-sound-fs-op-impact",
  smolder: "cc0-sound-fs-op-smolder",
  pod: "cc0-sound-fs-op-pod-hum",
  titleRise: "cc0-sound-fs-op-title-rise",
  titleHit: "cc0-sound-fs-op-title-hit",
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

function particles(id: string, preset: AnimaticParticlePreset, color: string, box: { x: number; y: number; width: number; height: number }, count: number, seed: number, extra: Partial<AnimaticLayer> = {}): AnimaticLayer {
  return { id, kind: "particles", role: "effect", color, opacity: 0.7, blend: "lighter", ...box, particles: { preset, count, seed, speed: preset === "stars" ? 6 : 10, size: preset === "dust" ? 2 : 1 }, ...extra };
}

/** 화면에 붙은 판(섬광·색조·암전). 카메라를 따라가지 않는다. */
function screenFill(id: string, color: string, opacity: AnimaticKey[], blend: AnimaticLayer["blend"] = "source-over", extra: Partial<AnimaticLayer> = {}): AnimaticLayer {
  return { id, kind: "shape", shape: "rect", role: "effect", space: "screen", color, blend, x: 0, y: 0, width: STAGE.width, height: STAGE.height, opacity: 1, keys: { opacity }, ...extra };
}

/** 자막 한 겹. 사건보다 반 박 늦게 뜨고, endMs 에서 fadeOutMs 동안 스스로 사라진다 — 다음 사건(갈라짐·충돌·컷) 위에 글자가 남지 않는다.
 *  타자 속도는 글자 수에 비례(한 글자 30ms, 0.35~0.9초). 렌더러는 마지막 큐만 사라지게 하므로 사건 사이 빈틈이 필요한 줄은 겹을 나눈다. */
function caption(id: string, cues: readonly { atMs: number; text: string }[], endMs: number, fadeOutMs = 450): AnimaticLayer {
  const typewriterMs = (text: string) => Math.min(900, Math.max(350, Array.from(text).length * 30));
  return { id, kind: "caption", x: 0, y: 0, width: STAGE.width, height: 38, color: CAPTION_COLOR, typography: { fontSize: 16, align: "center", weight: 700 },
    startMs: cues[0]!.atMs, endMs, caption: { cues: cues.map(cue => ({ ...cue, typewriterMs: typewriterMs(cue.text) })), fadeOutMs } };
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

const offsetKeys = (keys: AnimaticKey[], by: number): AnimaticKey[] => keys.map(k => ({ ...k, value: k.value - by }));

// upscale nearest: 정수 배율 캔버스에 그려 도트가 번지지 않는다(글자·빛은 그 해상도로).
const shot = (layers: AnimaticLayer[], camera: OpeningAnimatic["camera"], transition: OpeningAnimatic["transition"], audioCues: OpeningAnimatic["audioCues"] = [], background = "#03050d"): OpeningAnimatic =>
  ({ width: STAGE.width, height: STAGE.height, background, letterbox: LETTERBOX, upscale: "nearest", layers, ...(camera ? { camera } : {}), ...(transition ? { transition } : {}), ...(audioCues.length ? { audioCues } : {}) });

// ── 1. 별이 떨어진다 (한 컷) ──────────────────────────────────────────
// 2026-10-29 사용자 「별이 떨어지는 장면이 연속적이지 않고 소리가 좀…」 → 한 컷(18초)으로 이었다.
// 2026-10-29 오후 사용자 「오프닝 좀 아쉽네. 효과음도 그렇고. 대사 타이밍도 그렇고… 좀 더 애니메이틱하게」 → 박 단위로 다시 짰다:
//   · 카메라에 동기가 있다 — 하늘을 올려다보며(틸트) 별 쪽으로 천천히 다가가고(밀기), 마지막 한 박에 숨을 들이켜듯 물러섰다가,
//     갈라지는 박에 움찔 다가선 뒤 풀리고, 불덩이를 따라 내려가다(틸트), 땅에 닿기 직전 다시 밀고 들어간다.
//   · 별은 마지막 마디의 네 박마다 심장처럼 부푼다 — 효과음 swell 의 저음 박과 같은 시각. 다섯째 박은 오그라든다(숨 들이켜기).
//   · 자막은 사건보다 반 박(375ms) 늦게 뜨고, 다음 사건 전에 스스로 사라진다(갈라짐·충돌 위에 글자가 없다).
const CRACK = 9750;
const FALL_HIT = 17250;
/** 충돌 뒤 두 박을 더 머문다 — 흔들림·불빛이 가라앉을 때까지. 다음 컷(5.25초)이 줄어 종·제목은 그대로 마디 위에 선다. */
const FALL_MS = 18750;
const HALF = BEAT / 2;
/** 갈라지기 전 마지막 마디의 네 박(갈라짐 5·4·3·2 박 앞). opening-sfx.py star_swell 의 심장 박과 같은 자리. */
const HEARTBEATS = [5, 4, 3, 2].map(k => CRACK - k * BEAT);
/** 숨 들이켜기 — 갈라지기 한 박 앞. 별이 오그라들고 공기가 빨려 든다. */
const INHALE = CRACK - BEAT;
const FALL_GROUND_Y = 400;
const GREAT_STAR_P = 0.3;
const FALL_CAM: CamKeys = {
  x: [key(0, 280), key(CRACK, 300, "ease-in-out"), key(FALL_HIT, 320, "ease-in"), key(FALL_MS, 322)],
  // 떨어지는 동안 땅이 고르게 올라오게 — 처음 1.8초만 가속하고 그 뒤는 같은 빠르기로 내려간다(예전 ease-in 은 앞 4초가 멈춘 듯 보였다).
  y: [key(0, 250), key(CRACK, 200, "ease-in-out"), key(CRACK + 600, 198), key(CRACK + 2400, 240, "ease-in"), key(FALL_HIT, 500), key(FALL_MS, 506, "ease-out")],
};
/** 큰 별 — 먼 별과 같은 깊이. 갈라지는 순간 화면 (300,110). */
const GREAT_STAR = { x: 300 + (300 - CENTER.x) * GREAT_STAR_P, y: 110 + (200 - CENTER.y) * GREAT_STAR_P };
/** 떨어지는 곳 — fall 그림 위쪽(북쪽) 성벽 너머 숲의 나무선(그림 좌표 320,70). */
const IMPACT = { x: 320, y: FALL_GROUND_Y + 70 };

/** 불덩이의 화면 위치 — 별 자리에서 터져 나와 화면 가운데 근처에 머물고, 카메라가 그를 따라 내려간다(땅이 밑에서 올라온다). */
function fireballScreen(t: number): Point {
  const end = camAt(FALL_CAM, FALL_HIT), endScreen = { x: IMPACT.x - (end.x - CENTER.x), y: IMPACT.y - (end.y - CENTER.y) };
  const path: [number, Point][] = [[CRACK, { x: 300, y: 110 }], [CRACK + 900, { x: 282, y: 124 }], [CRACK + 3500, { x: 252, y: 114 }], [FALL_HIT, endScreen]];
  if (t <= CRACK) return path[0]![1];
  for (let i = 1; i < path.length; i++) {
    const [ta, a] = path[i - 1]!, [tb, b] = path[i]!;
    if (t <= tb) { const u = Math.max(0, (t - ta) / (tb - ta)); return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }; }
  }
  return endScreen;
}

/** 불덩이·꼬리의 세계 좌표 키. 꼬리는 머리가 delay 전에 있던 세계 자리를 따라온다 — 카메라가 내려가므로 머리 위로 길게 남는다. */
function fireballTrack(delay: number, size: number): { x: AnimaticKey[]; y: AnimaticKey[] } {
  const x: AnimaticKey[] = [], y: AnimaticKey[] = [];
  for (let t = CRACK; t <= FALL_HIT; t += 125) {
    const at = Math.max(CRACK, t - delay), s = fireballScreen(at), c = camAt(FALL_CAM, at);
    x.push(key(t, Math.round((s.x + c.x - CENTER.x - size / 2) * 10) / 10));
    y.push(key(t, Math.round((s.y + c.y - CENTER.y - size / 2) * 10) / 10));
  }
  return { x, y };
}

/** 큰 별의 크기 — 천천히 커지다가, 네 박마다 부풀었다 가라앉고, 한 박 오그라든 뒤 터져 하늘을 덮는 빛 고리로 번진다. */
function greatStarScale(): AnimaticKey[] {
  const keys: AnimaticKey[] = [key(0, 1), key(HEARTBEATS[0]! - 400, 1.12, "ease-in-out")];
  HEARTBEATS.forEach((b, i) => keys.push(key(b, 1.14 + 0.08 * i), key(b + 110, 1.55 + 0.12 * i, "ease-out"), key(b + 600, 1.2 + 0.09 * i, "ease-in-out")));
  keys.push(key(INHALE, 1.5), key(CRACK - 60, 0.65, "ease-in"), key(CRACK + 80, 2.8, "ease-out"), key(CRACK + 650, 5.5, "ease-out"));
  return keys;
}

function fallingStarShot(): OpeningAnimatic {
  const star = GREAT_STAR, p = GREAT_STAR_P, hit = CRACK;
  const cracks = [-150, -40, 70].map((angle, i): AnimaticLayer => ({
    id: `crack-${i}`, kind: "shape", shape: "line", role: "effect", color: "#f4fbff", blend: "lighter", x: star.x, y: star.y, width: 30 + i * 9, height: 1, parallax: p,
    rotation: angle, startMs: hit - 120, endMs: hit + 420, keys: { scaleX: [key(hit - 120, 0.1), key(hit, 1, "ease-out")], opacity: [key(hit - 120, 1), key(hit + 420, 0, "ease-in")] },
  }));
  const trail = (id: string, delay: number, size: number, color: string, opacity: number): AnimaticLayer =>
    ({ ...glow(id, color, { x: 0, y: 0 }, size, { opacity, startMs: CRACK, endMs: FALL_HIT + 150, glow: { inner: 0.3, pulse: { hz: 6, amount: 0.3, pattern: "flicker", seed: size } } }), keys: fireballTrack(delay, size) });
  const head = fireballTrack(0, 0);
  // 불덩이는 다가올수록 커진다(가운데 기준).
  const grow = [key(CRACK, 0.5), key(CRACK + 900, 0.75, "ease-out"), key(FALL_HIT, 1.45, "ease-in")];
  const starScale = greatStarScale();
  return shot([
    ...nightSky(FALL_CAM, { nebula: 0.12, far: GREAT_STAR_P, near: 0.5, twinkle: 0.72 }),
    // 고요한 하늘에 이따금 지나가는 작은 별똥 — 큰 별이 오그라들기 전에 사라진다.
    particles("early-meteors", "meteors", "#dfe8ff", { x: 40, y: 10, width: 400, height: 150 }, 3, 29,
      { parallax: 0.3, startMs: 4400, endMs: INHALE, particles: { preset: "meteors", count: 3, seed: 29, speed: 210, size: 1 }, keys: { opacity: [key(4400, 0), key(5200, 0.55), key(INHALE - 300, 0.55), key(INHALE, 0)] } }),
    // 큰 별 — 박마다 부풀다가 한 박 오그라들고, 갈라지는 박에 하늘을 덮는 빛으로 번진다(빛 고리).
    glow("great-star-halo", "#bcd8ff", star, 46, { parallax: p, endMs: hit + 700, anchorX: 0.5, anchorY: 0.5, x: star.x, y: star.y,
      keys: { opacity: [key(0, 0.25), key(HEARTBEATS[0]!, 0.6, "ease-in"), key(INHALE, 0.9, "ease-in"), key(hit - 60, 1), key(hit + 80, 1), key(hit + 650, 0, "ease-in")], scaleX: starScale, scaleY: starScale },
      glow: { inner: 0.2, pulse: { hz: 0.9, amount: 0.25, pattern: "pulse", seed: 5 } } }),
    glow("great-star", "#ffffff", star, 10, { parallax: p, endMs: hit + 60, opacity: 0.95, glow: { inner: 0.5, pulse: { hz: 1.7, amount: 0.3, pattern: "flicker", seed: 9 } } }),
    ...cracks,
    glow("shard-small", "#a8d8ff", star, 18, { parallax: p, startMs: hit, endMs: hit + 2600,
      keys: { x: [key(hit, star.x - 9), key(hit + 2600, star.x - 110, "ease-out")], y: [key(hit, star.y - 9), key(hit + 2600, star.y - 60, "ease-out")], opacity: [key(hit, 1), key(hit + 2600, 0, "ease-in")] } }),
    particles("burst", "sparks", "#ffd8a0", { x: star.x - 70, y: star.y - 60, width: 140, height: 120 }, 60, 17, { parallax: p, startMs: hit, endMs: hit + 2600, keys: { opacity: [key(hit, 1), key(hit + 2600, 0, "ease-in")] } }),
    // 불덩이와 꼬리 — 땅 층보다 먼저 그려 지평선의 나무가 앞을 가린다.
    trail("trail-3", 520, 24, "#a8341a", 0.35), trail("trail-2", 300, 34, "#ff6a30", 0.5), trail("trail-1", 130, 46, "#ff9a40", 0.65),
    { ...particles("embers", "sparks", "#ffc080", { x: 0, y: 0, width: 90, height: 70 }, 40, 23, { startMs: CRACK, endMs: FALL_HIT + 300 }), keys: { x: offsetKeys(head.x, 45), y: offsetKeys(head.y, 15) } },
    { ...glow("fireball", "#ffd890", { x: 0, y: 0 }, 60, { startMs: CRACK, endMs: FALL_HIT + 100, glow: { inner: 0.35, pulse: { hz: 7, amount: 0.25, pattern: "flicker", seed: 2 } } }), anchorX: 0.5, anchorY: 0.5, keys: { x: head.x, y: head.y, scaleX: grow, scaleY: grow } },
    { ...glow("fireball-core", "#ffffff", { x: 0, y: 0 }, 14, { startMs: CRACK, endMs: FALL_HIT + 60 }), anchorX: 0.5, anchorY: 0.5, keys: { x: head.x, y: head.y, scaleX: grow, scaleY: grow } },
    // 충돌 빛 — 한 점에서 순식간에 부풀어 숲을 덮는다(충격파).
    glow("impact-glow", "#ffa860", IMPACT, 320, { startMs: FALL_HIT, anchorX: 0.5, anchorY: 0.5, x: IMPACT.x, y: IMPACT.y,
      keys: { opacity: [key(FALL_HIT, 0), key(FALL_HIT + 120, 1, "ease-out"), key(FALL_MS, 0.5, "ease-out")], scaleX: [key(FALL_HIT, 0.25), key(FALL_HIT + 260, 1.15, "ease-out"), key(FALL_MS, 1)], scaleY: [key(FALL_HIT, 0.25), key(FALL_HIT + 260, 1.15, "ease-out"), key(FALL_MS, 1)] },
      glow: { inner: 0.2, pulse: { hz: 3, amount: 0.2, pattern: "flicker", seed: 8 } } }),
    // 밤 — 땅 그림이 낮처럼 밝아 「그날 밤」과 어긋났다(사용자 2026-10-28). 불투명 화소만 밤색으로 끌어내린다(하늘·등불은 그대로).
    art("fall-ground", { x: 0, y: FALL_GROUND_Y }, { tint: NIGHT }),
    flicker("bridge-lamp", { x: 150, y: FALL_GROUND_Y + 200 }, 24),
    // 박힌 자리에서 흙과 불티가 솟는다(땅보다 앞).
    particles("impact-debris", "sparks", "#ffcf90", { x: IMPACT.x - 120, y: IMPACT.y - 100, width: 240, height: 120 }, 70, 37,
      { startMs: FALL_HIT, keys: { opacity: [key(FALL_HIT, 1), key(FALL_MS, 0.5)] }, particles: { preset: "sparks", count: 70, seed: 37, speed: 26, size: 1 } }),
    // 어둠에서 천천히 밝아진다(첫 2초 남짓은 게임이 뒤에서 맵을 짓느라 화면이 멎는 때라 검게 둔다).
    screenFill("dawn", "#03050d", [key(0, 1), key(2600, 1), key(4600, 0, "ease-in-out")]),
    // 갈라진 뒤 불빛이 하늘을 붉게 물들이고, 떨어질수록 짙어진다.
    screenFill("warm", "#ff8a40", [key(0, 0), key(hit, 0), key(hit + 300, 0.2, "ease-out"), key(hit + 1600, 0.07), key(FALL_HIT, 0.17, "ease-in"), key(FALL_MS, 0.1, "ease-out")], "screen"),
    // 섬광 — 숨 들이켜는 박에 하늘이 살짝 어두워졌다가(빛이 별로 빨려 든다), 갈라짐·충돌에 터진다.
    // 충돌 섬광은 금세 걷혀 주황 불빛만 남는다(희게 바랜 화면이 길면 힘이 빠진다).
    screenFill("flash", "#fff4e0", [key(0, 0), key(hit - 40, 0), key(hit + 40, 0.95), key(hit + 520, 0, "ease-out"), key(FALL_HIT - 40, 0), key(FALL_HIT + 60, 0.9), key(FALL_HIT + 450, 0, "ease-out")]),
    screenFill("hush", "#000000", [key(0, 0), key(INHALE, 0), key(hit - 60, 0.3, "ease-in"), key(hit, 0)]),
    caption("line-sky", [{ atMs: HEARTBEATS[0]! - 1875, text: "별을 읽는 도시, 왕도 아스텔." }, { atMs: HEARTBEATS[0]! + HALF, text: "그날 밤도 하늘은 고요했다." }], INHALE - 150),
    caption("line-crack", [{ atMs: hit + BEAT + HALF, text: "그러다 별 하나가 갈라졌다." }], hit + 4 * BEAT - 200, 400),
    caption("line-fall", [{ atMs: hit + 4 * BEAT + HALF, text: "불꼬리를 끌고, 왕도 북쪽 숲으로." }], FALL_HIT - 500),
  ], {
    keys: { ...FALL_CAM,
      // 별 쪽으로 천천히 밀고 들어가다 숨 들이켜는 박에 물러서고, 갈라지는 박에 움찔 다가섰다 풀린다. 떨어지는 동안은 넓게 두고,
      // 박히기 1.5초 전부터 다시 밀고 들어가 충돌에 닿는다(흔들림은 충돌에 쓴다 — 컷당 하나).
      zoom: [key(0, 1), key(4600, 1), key(INHALE, 1.1, "ease-in-out"), key(hit - 60, 1.05, "ease-in"), key(hit + 90, 1.2, "ease-out"), key(hit + 1100, 1, "ease-in-out"),
        key(FALL_HIT - 1500, 1), key(FALL_HIT, 1.08, "ease-in"), key(FALL_MS, 1.14, "ease-out")] },
    shake: { atMs: FALL_HIT, durationMs: FALL_MS - FALL_HIT, amplitude: 7, frequency: 16, seed: 4 },
  }, { kind: "cut", durationMs: 1 }, [
    // 소리는 한 줄기다 — 밤바람 → 별이 차오르며 박마다 뛰는 울림 → 숨 들이켜기와 정적 → 금 가는 유리·깊은 쿵·흩어지는 반짝이 →
    // 다가오며 높아지고 밝아지는 굉음 → 박히기 직전 숨죽임 → 서브 드롭과 파편(scripts/content/fallen/opening-sfx.py). 재생 지연을 감안해 타격음은 40ms 일찍 건다.
    { id: "air", resourceId: SE.air, atMs: 2400, durationMs: INHALE - 2550, volume: 1, fadeInMs: 1600, fadeOutMs: 900 },
    { id: "swell", resourceId: SE.swell, atMs: hit - 5400, durationMs: 5400, volume: 1 },
    { id: "crack", resourceId: SE.crack, atMs: hit - 40, durationMs: 4500, volume: 1 },
    { id: "roar", resourceId: SE.roar, atMs: FALL_HIT - 7350 - 40, durationMs: 7350, volume: 1 },
    { id: "impact", resourceId: SE.impact, atMs: FALL_HIT - 40, durationMs: FALL_MS - FALL_HIT + 40, volume: 0.92 },
  ]);
}

// ── 2. 연기와 은빛 알 ───────────────────────────────────────────────────
/** 그을린 구덩이 한가운데의 은빛 알. 카메라는 충돌의 반동으로 살짝 물러섰다가 알 쪽으로 천천히 밀고 들어간다.
 *  충돌 빛이 사그라든 뒤(2박) 달빛이 알에 내려앉고 알이 숨을 쉬기 시작한다. 자막은 그 한 박 뒤. */
const AFTERMATH_MS = 5250;
function aftermathShot(): OpeningAnimatic {
  const pod = { x: 272, y: 166 }, wake = 2 * BEAT, end = AFTERMATH_MS;
  const cam: CamKeys = { x: [key(0, 250), key(end, 272, "ease-in-out")], y: [key(0, 136), key(end, 160, "ease-in-out")],
    zoom: [key(0, 1.06), key(700, 1, "ease-out"), key(end, 1.16, "ease-in-out")] };
  return shot([
    art("crash"),
    { id: "moonlight", kind: "shaft", role: "effect", color: "#bcd4ff", blend: "lighter", x: pod.x - 70, y: -30, width: 80, height: 230, rotation: -16,
      shaft: { spread: 0.55, softness: 0.85, dust: { count: 8, seed: 77, speed: 5, size: 1 } }, keys: { opacity: [key(0, 0), key(wake, 0), key(wake + 2 * BEAT, 0.3, "ease-in-out"), key(end, 0.34)] } },
    glow("impact-fade", "#ffd090", pod, 300, { keys: { opacity: [key(0, 0.95), key(wake, 0.2, "ease-out"), key(end, 0.08)] }, glow: { inner: 0.25, pulse: { hz: 2.5, amount: 0.25, pattern: "flicker", seed: 12 } } }),
    glow("pod-glow", "#8ff0ff", pod, 80, { keys: { opacity: [key(0, 0), key(wake, 0), key(wake + 2 * BEAT, 0.6, "ease-in-out")] }, glow: { inner: 0.35, pulse: { hz: 1.1, amount: 0.4, pattern: "pulse", seed: 7 } } }),
    // 깊이: 땅(1) < 연기(1.12) < 불티(1.25) < 재(1.3) < 반딧불(1.4, 가장 가깝다).
    particles("smoke", "dust", "#7d8597", { x: pod.x - 90, y: pod.y - 130, width: 180, height: 150 }, 46, 12, { parallax: 1.12, blend: undefined, keys: { opacity: [key(0, 0.15), key(1500, 0.5, "ease-out"), key(end, 0.4)] } }),
    particles("embers", "sparks", "#ffb070", { x: pod.x - 90, y: pod.y - 60, width: 180, height: 100 }, 26, 9, { parallax: 1.25, keys: { opacity: [key(0, 0.95), key(3600, 0, "ease-in")] }, endMs: 3600 }),
    particles("ash", "snow", "#a49c98", { x: pod.x - 220, y: pod.y - 170, width: 440, height: 260 }, 30, 53, { parallax: 1.3, blend: undefined, opacity: 0.45, particles: { preset: "snow", count: 30, seed: 53, speed: 6, size: 1 } }),
    particles("fireflies", "dust", "#d8ff88", { x: pod.x - 200, y: pod.y - 110, width: 400, height: 200 }, 22, 31, { parallax: 1.4, startMs: wake + BEAT, keys: { opacity: [key(wake + BEAT, 0), key(wake + 3 * BEAT, 0.85, "ease-in-out")] } }),
    screenFill("cool", "#203a68", [key(0, 0), key(2000, 0), key(end, 0.22, "ease-in-out")], "multiply"),
    caption("line-pod", [{ atMs: wake + BEAT, text: "불탄 숲 한가운데, 은빛 알 하나가 숨 쉬듯 빛났다." }], end),
  // 충돌의 섬광은 앞 컷에서 이미 터졌다 — 여기서 또 희게 번쩍이면 두 번 부딪친 것처럼 보였다. 연기 속으로 천천히 녹아든다.
  ], { keys: cam }, { kind: "fade", durationMs: 700 }, [
    // 충돌 땅울림이 컷을 넘어 이어진다 — 앞 컷에서 들은 데서부터. 그 밑으로 타닥이는 불, 알이 깨어나는 박에 맑은 숨소리.
    { id: "rumble", resourceId: SE.impact, atMs: 0, durationMs: 3500, volume: 0.65, offsetMs: FALL_MS - FALL_HIT + 40, fadeOutMs: 2200 },
    { id: "smolder", resourceId: SE.smolder, atMs: 0, durationMs: end, volume: 1, fadeInMs: 600, fadeOutMs: 1000 },
    { id: "pod", resourceId: SE.pod, atMs: wake, durationMs: end - wake, volume: 1, fadeInMs: 900, fadeOutMs: 600 },
  ]);
}

// ── 3. 천문대 안 ────────────────────────────────────────────────────────
/** 종이 처음 울리는 박에 맞춰 붙인다. 망원경 앞의 노학자, 흔들리는 촛불, 들보에서 떨어지는 먼지. 둥근 창 너머로 별똥이 아직 걸려 있다. */
function observatoryShot(): OpeningAnimatic {
  const cam: CamKeys = { x: [key(0, 268), key(3000, 252, "ease-in-out")], y: [key(0, 150), key(3000, 142, "ease-in-out")], zoom: [key(0, 1.02), key(3000, 1.14, "ease-out")] };
  const candles: [number, number][] = [[145, 108], [195, 105], [410, 108], [500, 145], [58, 215], [105, 170], [412, 215], [358, 228]];
  return shot([
    art("observatory"),
    glow("window-star", "#ffe0b0", { x: 283, y: 44 }, 26, { opacity: 0.7, glow: { inner: 0.4, pulse: { hz: 2.2, amount: 0.35, pattern: "flicker", seed: 19 } } }),
    ...candles.map(([x, y], i) => flicker(`candle-${i}`, { x, y }, 20, "#ffc070", 0.5)),
    particles("rafter-dust", "snow", "#cdb999", { x: 110, y: -10, width: 320, height: 220 }, 40, 61,
      { parallax: 1.15, blend: undefined, startMs: 120, particles: { preset: "snow", count: 40, seed: 61, speed: 9, size: 1 }, keys: { opacity: [key(120, 0), key(450, 0.7, "ease-out"), key(3000, 0.35)] } }),
    screenFill("bell-light", "#ffd9a0", [key(0, 0.14), key(450, 0, "ease-out")], "screen"),
    caption("line-bell", [{ atMs: BEAT, text: "천문대 종이 울리기 시작했다." }], 3000, 350),
  ], { keys: cam, shake: { atMs: 0, durationMs: 600, amplitude: 1.5, frequency: 16, seed: 3 } }, { kind: "cut", durationMs: 1 }, [
    { id: "bell-1", resourceId: SE.bell, atMs: 0, durationMs: 3000, volume: 0.7, fadeOutMs: 200 },
  ]);
}

// ── 4. 종이 울린다 ──────────────────────────────────────────────────────
/** 왕도의 밤. 종이 마디마다 울리고, 발코니의 카엘이 북쪽 하늘을 올려다본다. 카메라는 탑 꼭대기에서 발코니로 내려오며 정수 2배까지 다가선다. */
function bellShot(): OpeningAnimatic {
  const cam: CamKeys = { x: [key(0, 262), key(1500, 258), key(6000, 200, "ease-in-out")], y: [key(0, 132), key(1500, 140), key(6000, 168, "ease-in-out")],
    zoom: [key(0, 1), key(1500, 1.02), key(6000, 2, "ease-in-out")] };
  const bell = { x: 209, y: 92 }, kael = { x: 191, y: 177 }, elena = { x: 206, y: 177 };
  // 종이 울릴 때마다 탑 꼭대기에서 부드러운 빛이 한 번 퍼졌다 사라진다(소리의 박을 눈으로).
  const ring = (i: number, at: number): AnimaticLayer => ({ ...glow(`ring-${i}`, "#ffe2a0", bell, 90, { startMs: at, endMs: Math.min(6000, at + 1400) }),
    anchorX: 0.5, anchorY: 0.5, x: bell.x, y: bell.y, glow: { inner: 0.12 },
    keys: { scaleX: [key(at, 0.3), key(at + 1400, 1.8, "ease-out")], scaleY: [key(at, 0.3), key(at + 1400, 1.8, "ease-out")], opacity: [key(at, 0.55), key(at + 1400, 0, "ease-in")] } });
  const look = 2 * BEAT;
  return shot([
    ...nightSky({ x: cam.x, y: cam.y }, { nebula: 0.12, far: 0.3, near: 0.5, twinkle: 0.7 }),
    // 북쪽 숲은 아직 타고 있다 — 성벽 위 나무선 너머 붉은 빛(하늘과 땅 사이 깊이).
    glow("north-fire", "#ff8040", { x: 340, y: 46 }, 150, { parallax: 0.9, opacity: 0.55, glow: { inner: 0.2, pulse: { hz: 1.3, amount: 0.35, pattern: "flicker", seed: 14 } } }),
    art("town-ground", undefined, { tint: NIGHT }),
    flicker("door", { x: 205, y: 235 }, 26), flicker("lamp-l", { x: 162, y: 262 }), flicker("balcony", { x: 205, y: 178 }, 20),
    flicker("win-a", { x: 75, y: 160 }), flicker("win-b", { x: 470, y: 200 }, 18), flicker("bridge-lamp", { x: 130, y: 265 }),
    ring(0, 0), ring(1, 4 * BEAT),
    { id: "kael-looks", kind: "emote", role: "effect", x: kael.x - 7, y: kael.y - 23, width: 14, height: 16, startMs: look, endMs: 5600, emote: { preset: "exclaim", tail: "down", popMs: 160, outMs: 220 } },
    { id: "elena-looks", kind: "emote", role: "effect", x: elena.x - 7, y: elena.y - 23, width: 14, height: 16, startMs: 4 * BEAT + HALF, endMs: 5600, emote: { preset: "question", tail: "down", popMs: 160, outMs: 220 } },
    particles("fireflies", "dust", "#d8ff88", { x: 60, y: 120, width: 420, height: 160 }, 14, 41, { parallax: 1.3, opacity: 0.6 }),
    caption("line-kael", [{ atMs: look + HALF, text: "견습 별지기 카엘은 북쪽 하늘을 올려다보았다." }], 5400),
  ], { keys: cam }, { kind: "cut", durationMs: 1 }, [
    // 둘째 종은 셋째 종 밑에서도 계속 울린다(잔향이 끊기지 않게 겹친다).
    { id: "bell-2", resourceId: SE.bell, atMs: 0, durationMs: 6000, volume: 0.65, fadeOutMs: 1500 },
    { id: "bell-3", resourceId: SE.bell, atMs: 4 * BEAT, durationMs: 6000 - 4 * BEAT, volume: 0.55, fadeOutMs: 1400 },
  ]);
}

// ── 5. 제목 ─────────────────────────────────────────────────────────────
/** 키아트 위로 빛줄기가 내려오고, 공기가 차오르다 마디 첫 박에 제목이 떠오른다(징·서브 붐·짧은 섬광). 끝은 검게 닫혀 맵으로 넘어간다. */
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
    particles("title-meteors", "meteors", "#fff0d0", { x: 0, y: 0, width: 480, height: 80 }, 2, 83,
      { parallax: 0.6, startMs: logoAt + 2 * BEAT, particles: { preset: "meteors", count: 2, seed: 83, speed: 240, size: 1 }, keys: { opacity: [key(logoAt + 2 * BEAT, 0), key(logoAt + 3 * BEAT, 0.7)] } }),
    ray(0, 300, 22, 60), ray(1, 250, 16, 46), ray(2, 350, 28, 38),
    glow("logo-glow", "#ffcf70", { x: 240, y: 96 }, 260, { space: "screen", startMs: logoAt - 400, keys: { opacity: [key(logoAt - 400, 0), key(logoAt + 600, 0.38, "ease-out"), key(9000, 0.26)] },
      glow: { inner: 0.25, pulse: { hz: 0.5, amount: 0.15, pattern: "pulse", seed: 21 } } }),
    { id: "logo", kind: "text", role: "credit", space: "screen", text: "폴른 스타", color: "#f6d98a", x: 0, y: 70, width: STAGE.width, height: 60,
      typography: { fontSize: 46, weight: 800, align: "center" }, startMs: logoAt, keys: { opacity: [key(logoAt, 0), key(logoAt + 500, 1, "ease-out")], y: [key(logoAt, 80), key(logoAt + 700, 70, "ease-out")] } },
    { id: "subtitle", kind: "text", role: "credit", space: "screen", text: "제1막 · 떨어진 별", color: "#e8eefc", x: 0, y: 128, width: STAGE.width, height: 22,
      typography: { fontSize: 15, weight: 700, align: "center" }, startMs: subAt, keys: { opacity: [key(subAt, 0), key(subAt + 700, 0.9, "ease-out")] } },
    particles("motes", "dust", "#ffe8b8", { x: -20, y: 40, width: 520, height: 230 }, 24, 71, { parallax: 1.3, opacity: 0.45 }),
    screenFill("logo-flash", "#fff2d0", [key(0, 0), key(logoAt - 30, 0), key(logoAt + 40, 0.3), key(logoAt + 700, 0, "ease-out")], "screen"),
    screenFill("close", "#000000", [key(0, 0), key(7600, 0), key(9000, 1, "ease-in")]),
  ], { keys: { ...cam, zoom: [key(0, 1), key(logoAt - 60, 1.03, "ease-in"), key(logoAt + 120, 1, "ease-out"), key(9000, 1.02)] } }, { kind: "fade", durationMs: 1200 }, [
    { id: "title-rise", resourceId: SE.titleRise, atMs: 0, durationMs: logoAt, volume: 1 },
    { id: "title-hit", resourceId: SE.titleHit, atMs: logoAt - 20, durationMs: 9000 - logoAt + 20, volume: 0.85, fadeOutMs: 2500 },
  ]);
}

/** 컷 경계는 마디(3초) 위에 선다 — 첫 두 컷만 충돌의 여운 때문에 마디 안에서 나뉜다(18.75 + 5.25 = 24). */
const SHOTS: readonly { id: string; build: () => OpeningAnimatic; ms: number }[] = [
  { id: "fs_op_falling_star", build: fallingStarShot, ms: FALL_MS },
  { id: "fs_op_aftermath", build: aftermathShot, ms: AFTERMATH_MS },
  { id: "fs_op_observatory", build: observatoryShot, ms: 3000 },
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
