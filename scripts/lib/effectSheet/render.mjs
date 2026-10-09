// 이펙트 시트 렌더러. 카탈로그(src/assets/generatedEffectSheets.json)가 정본이고
// slug → 페인터 매핑이 여기 있다. 카탈로그에 slug 를 넣고 페인터를 안 붙이면 즉시 던진다.
//
// 2026-09-03 고해상도 개편: 48 격자 2배 복제(canvas.mjs) 를 버리고 raster.mjs 의 SDF 래스터로
// 카탈로그 프레임 크기(384px)에 직접 그린다. 페인터 좌표계는 전투 논리 px(192 단위)라 해상도와
// 무관하고, 래스터 배율은 `frameWidth / DESIGN_SIZE` 로 카탈로그가 정한다.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writePng } from "../pixelPng.mjs";
import { createRaster, DESIGN_SIZE, mulberry32, slugSeed, toStrip } from "./raster.mjs";
import { fireBurst, iceShatter, slashSteel, thunderStrike, waterColumn } from "./effects/impact.mjs";
import { arcaneNova, earthSpike, healBloom, poisonMist, windSlice } from "./effects/arcane.mjs";
import {
  biteCrunch,
  captureSeal,
  clawRake,
  guardBarrier,
  holyBeam,
  leafVolley,
  powerAura,
  projectileShot,
  psychicWave,
  shadowPulse,
  sleepDust,
  tackleImpact,
} from "./effects/monster.mjs";
import {
  blindVeil,
  cleanseSparkle,
  confusionSpiral,
  criticalBurst,
  drainOrbs,
  meteorFall,
  paralysisBind,
  reviveRise,
  silenceLock,
  smokeVanish,
  sonicWave,
  summonPortal,
} from "./effects/utility.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "..", "..", "..");
export const CATALOG_PATH = path.join(REPO_ROOT, "src", "assets", "generatedEffectSheets.json");
export const OUTPUT_DIR = path.join(REPO_ROOT, "public", "assets", "generated", "effects");

const PAINTERS = {
  "slash-steel": slashSteel,
  "fire-burst": fireBurst,
  "ice-shatter": iceShatter,
  "thunder-strike": thunderStrike,
  "water-column": waterColumn,
  "wind-slice": windSlice,
  "earth-spike": earthSpike,
  "heal-bloom": healBloom,
  "poison-mist": poisonMist,
  "arcane-nova": arcaneNova,
  "tackle-impact": tackleImpact,
  "claw-rake": clawRake,
  "bite-crunch": biteCrunch,
  "projectile-shot": projectileShot,
  "leaf-volley": leafVolley,
  "psychic-wave": psychicWave,
  "shadow-pulse": shadowPulse,
  "holy-beam": holyBeam,
  "sleep-dust": sleepDust,
  "power-aura": powerAura,
  "guard-barrier": guardBarrier,
  "capture-seal": captureSeal,
  "critical-burst": criticalBurst,
  "sonic-wave": sonicWave,
  "drain-orbs": drainOrbs,
  "revive-rise": reviveRise,
  "cleanse-sparkle": cleanseSparkle,
  "paralysis-bind": paralysisBind,
  "blind-veil": blindVeil,
  "confusion-spiral": confusionSpiral,
  "silence-lock": silenceLock,
  "summon-portal": summonPortal,
  "smoke-vanish": smokeVanish,
  "meteor-fall": meteorFall,
};

export function loadEffectCatalog() {
  return JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
}

export function effectSheetFileName(slug) {
  return `effect-${slug}.png`;
}

export function effectSheetOutputPath(slug) {
  return path.join(OUTPUT_DIR, effectSheetFileName(slug));
}

/** slug 하나를 용도별 8~12프레임 RGBA 스트립으로 렌더한다. 같은 입력이면 항상 같은 픽셀이 나온다. */
export function renderEffectStrip(slug, catalog = loadEffectCatalog()) {
  const painter = PAINTERS[slug];
  if (painter === undefined) {
    throw new Error(`이펙트 페인터가 없다: ${slug} (scripts/lib/effectSheet/render.mjs 의 PAINTERS 에 등록하라)`);
  }
  const effect = catalog.effects.find((entry) => entry.slug === slug);
  if (effect === undefined) throw new Error(`이펙트 카탈로그 항목이 없다: ${slug}`);
  const { frameWidth, frameHeight } = catalog.sheet;
  if (frameWidth !== frameHeight) throw new Error(`시트 프레임은 정사각이어야 한다: ${frameWidth}x${frameHeight}`);
  const pixelsPerUnit = frameWidth / DESIGN_SIZE;
  const columns = effect.frameCount;
  const seed = slugSeed(slug);
  const frames = [];
  for (let index = 0; index < columns; index += 1) {
    const frame = createRaster(pixelsPerUnit);
    // 프레임 i 는 [i, i+1)×75ms 동안 화면에 있으므로 그 구간의 **가운데** 진행도를 그린다.
    // 끝점 포함(i/(n-1))으로 뽑으면 p=0 인 첫 컷이 대개 빈 화면이라 한 프레임을 통째로 버린다(실측 14종).
    painter(frame, (index + 0.5) / columns, mulberry32(seed));
    frames.push(frame);
  }
  const strip = toStrip(frames);
  if (strip.width !== frameWidth * columns || strip.height !== frameHeight) {
    throw new Error(
      `시트 규격 불일치: ${slug} 는 ${frameWidth * columns}x${frameHeight} 여야 하는데 ${strip.width}x${strip.height} 가 나왔다.`
    );
  }
  return strip;
}

/** 같은 스트립을 PNG 바이트로. 글로우 그라디언트라 적응 행 필터가 필수다(pixelPng.mjs 주석 참고). */
export function renderEffectSheetPng(slug, catalog = loadEffectCatalog()) {
  return encodeEffectStrip(renderEffectStrip(slug, catalog));
}

/** 이미 렌더한 스트립을 PNG 로 — 테스트가 한 번 렌더한 스트립을 여러 단정에 재사용할 때 쓴다. */
export function encodeEffectStrip(strip) {
  return writePng(strip.width, strip.height, strip.data, { filter: "adaptive" });
}

export function paintedEffectSlugs() {
  return Object.keys(PAINTERS);
}
