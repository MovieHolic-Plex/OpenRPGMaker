// test/astraOpening.test.ts
// 아스트라 호라이즌 오프닝(2026-10-25)에 붙인 일반 엔진 기능 — 실루엣 틴트·별똥별 입자·타이틀 달리기/PRESS START/cover 층·
// 박사 소개 지역 비행·구슬 컷·이름 쇼케이스·배우 그림 픽처 — 의 데이터 계약과 순수 함수, 그리고 밝은 3세대식 인트로의 길이·재료를 확인한다.
// 그림은 영상 캡처로 따로 본다.
import { describe, expect, it } from "vitest";
import { validateOpeningAnimatic, type OpeningAnimatic } from "@/project/openingAnimatic";
import { normalizeSystemRecords, normalizeTitlePressStart, normalizeTitleRunners } from "@/project/databaseRecordModel";
import { titleRunnerFrameAt } from "@/player/titleRunners";
import { titleShootingStarAt } from "@/player/titleParticles";
import { astraTitleIntroScenes } from "@/project/flagship/astraTitleIntro";
import { emeraldOpeningShot, emeraldOpeningShotMs } from "@/project/emeraldMonsterOpeningShots";
import { actorPictureActorId } from "@/player/pictures/pictureResources";
import { defaultSystem, defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";

const stage = (layers: OpeningAnimatic["layers"]): OpeningAnimatic => ({ width: 480, height: 320, layers });
const image = { id: "legend", kind: "image" as const, resourceId: "harness-monster-lunavane-front", x: 0, y: 0, width: 64, height: 64 };

describe("animatic tint and meteors", () => {
  it("accepts a silhouette tint on an image layer and the meteors preset", () => {
    expect(() => validateOpeningAnimatic(stage([
      { ...image, tint: { color: "#0a1028" } },
      { id: "m", kind: "particles", x: 0, y: 0, width: 480, height: 200, particles: { preset: "meteors", count: 4, seed: 1 } },
    ]), 1000, "t")).not.toThrow();
  });
  it("rejects tint on a non-image layer and tint amounts outside 0..1", () => {
    expect(() => validateOpeningAnimatic(stage([{ id: "s", kind: "shape", shape: "rect", x: 0, y: 0, width: 4, height: 4, tint: { color: "#000" } }]), 1000, "t")).toThrow();
    expect(() => validateOpeningAnimatic(stage([{ ...image, tint: { color: "#000000", amount: 2 } }]), 1000, "t")).toThrow();
  });
});

describe("title runners, PRESS START and cover layers", () => {
  it("normalizes runners and drops invalid ones", () => {
    const runners = normalizeTitleRunners([
      { resourceId: "tex_oprn_charset_harness_monster1", characterIndex: 4, y: 236, speed: 74, scale: 2, delayMs: 1800, everyMs: 16000, hop: true },
      { resourceId: "", y: 10 } as never,
    ]);
    expect(runners).toHaveLength(1);
    expect(runners?.[0]).toMatchObject({ resourceId: "tex_oprn_charset_harness_monster1", characterIndex: 4, scale: 2 });
    expect(normalizeTitlePressStart({ text: "PRESS START", blinkMs: 900, y: 192 })).toMatchObject({ y: 192 });
  });
  it("keeps fit:cover on a background layer through normalization", () => {
    const settings = normalizeSystemRecords({ ...defaultSystem(), titleScreen: { ...defaultTitleScreenSettings(), backgroundLayers: [{ resourceId: "oprn_emerald_title_meadow", fit: "cover" }, { resourceId: "oprn-pano-night-stars-far", scrollXPerSec: -3 }] } }).titleScreen!;
    expect(settings.backgroundLayers?.[0]?.fit).toBe("cover");
    expect(settings.backgroundLayers?.[1]?.fit).toBeUndefined();
  });
  it("moves a runner across the stage as a pure function of time with stepping frames", () => {
    const runner = { resourceId: "x", characterIndex: 2, y: 236, speed: 60, scale: 2, delayMs: 1000 };
    expect(titleRunnerFrameAt(runner, 500, 360)).toBeNull();
    const a = titleRunnerFrameAt(runner, 1500, 360)!, b = titleRunnerFrameAt(runner, 2500, 360)!;
    expect(b.x).toBeGreaterThan(a.x);
    expect(a.height).toBe(64);
    expect(a.y).toBeLessThanOrEqual(236 - 64);
    // 오른쪽 보기 행(1)의 인물 2 칸 안에서만 걷는다.
    for (const f of [a, b]) expect([1 * 12 + 6, 1 * 12 + 7, 1 * 12 + 8]).toContain(f.cell);
    expect(titleRunnerFrameAt(runner, 1500, 360)).toEqual(a);
  });
  it("draws a shooting star only now and then", () => {
    const seen = Array.from({ length: 200 }, (_, i) => titleShootingStarAt(i * 100, 320, 240)).filter(Boolean);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.length).toBeLessThan(40);
  });
});

describe("Astra intro and professor shots", () => {
  const chip = { resourceId: "tex_oprn_charset_harness_monster1", index: 1 };
  it("builds a short, bright Gen 3 style title intro (no night sky) whose shots all validate", () => {
    const scenes = astraTitleIntroScenes({ starters: [0, 1, 2].map(() => ({ front: "harness-monster-leafling-front", chip })) });
    const total = scenes.reduce((sum, scene) => sum + scene.durationMs, 0);
    expect(total).toBeLessThanOrEqual(10000);
    const layers = scenes.flatMap((scene) => (scene as { composition: OpeningAnimatic }).composition.layers);
    expect(layers.some((l) => l.particles?.preset === "meteors" || l.particles?.preset === "stars")).toBe(false);
    expect(layers.some((l) => l.tint)).toBe(false);
    expect(layers.some((l) => /night|moon|lunavane/u.test(l.resourceId ?? ""))).toBe(false);
    expect(layers.filter((l) => l.resourceId === "harness-monster-leafling-front").length).toBeGreaterThan(0);
  });
  it("pops a monster out of the professor's capsule and walks people with their monsters", () => {
    const cast = { hero: chip, professor: chip, rival: chip, leader: chip, flyer: chip, wild: chip, starters: [{ frontResourceId: "a", chip, name: "토리프" }] };
    for (const id of ["welcome", "capsule", "together"] as const) expect(() => validateOpeningAnimatic(emeraldOpeningShot(id, cast), emeraldOpeningShotMs(id), id)).not.toThrow();
    expect(emeraldOpeningShot("capsule", cast).layers.some((l) => l.id === "starter" && l.resourceId === "a")).toBe(true);
  });
  it("reads actor:<id> as an actor walking-graphic picture", () => {
    expect(actorPictureActorId("actor:actor_hero")).toBe("actor_hero");
    expect(actorPictureActorId("actor:")).toBeNull();
    expect(actorPictureActorId("oprn_emerald_opening_lab")).toBeNull();
  });
  it("flies over the region with world-anchored place labels", () => {
    const cast = { hero: chip, professor: chip, rival: chip, leader: chip, flyer: chip, wild: chip, starters: [{ frontResourceId: "a", chip, name: "토리프" }], places: { route: "1번 도로", town: "다우닝 시티" } };
    const shot = emeraldOpeningShot("region", cast);
    expect(() => validateOpeningAnimatic(shot, emeraldOpeningShotMs("region"), "region")).not.toThrow();
    const labels = shot.layers.filter((l) => l.kind === "text");
    expect(labels.map((l) => l.text)).toEqual(["1번 도로", "다우닝 시티"]);
    for (const label of labels) expect(label.anchorX).toBe(0);
    const xs = shot.camera?.keys?.x?.map((k) => k.value) ?? [];
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(600);
    const stageShot = emeraldOpeningShot("stage", cast);
    expect(stageShot.layers.some((l) => l.id === "starter-0-name" && l.text === "토리프")).toBe(true);
  });
});
