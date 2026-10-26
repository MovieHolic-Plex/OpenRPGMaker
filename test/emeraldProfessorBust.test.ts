import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createBlankProject } from "@/project/defaults";
import { configureEmeraldMonsterOpening, upgradeLegacyEmeraldMonsterOpening } from "@/project/emeraldMonsterOpening";
import { EMERALD_PROFESSOR_BUST_RESOURCE_ID } from "@/project/emeraldProfessorArt";
import { validateOpeningAnimatic } from "@/project/openingAnimatic";

describe("emerald monster animatic opening", () => {
  it("builds six layered animatic shots whose pictures all resolve without uploaded bytes", () => {
    const project = createBlankProject();
    configureEmeraldMonsterOpening(project);
    const scenes = project.system.opening!.scenes;
    expect(scenes.map(scene => scene.kind)).toEqual(Array(6).fill("animatic"));
    expect(project.meta.oprnOpeningBook).toBeUndefined();
    for (const scene of scenes) {
      if (scene.kind !== "animatic") continue;
      expect(scene.durationMs).toBe(4500);
      expect(scene.narration.trim()).not.toBe("");
      validateOpeningAnimatic(scene.composition, scene.durationMs);
      for (const layer of scene.composition.layers) if (layer.kind === "image") expect(resolveAssetResourceUrl(layer.resourceId!, { project }), `${scene.id}/${layer.id}`).toBeTruthy();
    }
    const backdrop = scenes[0]!.kind === "animatic" ? scenes[0]!.composition.layers[0]! : undefined;
    expect(backdrop).toMatchObject({ role: "background", resourceId: "oprn_emerald_opening_dawn", width: 832, height: 1088 });
    expect(JSON.stringify(project.system.opening)).not.toContain("data:image");
  });

  it("turns a legacy professor-bust book into animatic shots and keeps its narration", () => {
    const project = createBlankProject();
    const texts = ["하나", "둘", "셋", "넷", "다섯", "여섯", "일곱", "여덟"];
    project.system.opening = { enabled: true, skippable: true, musicResourceId: "bgm_intro", scenes: texts.map((text, i) => ({ id: `page_${i}`, kind: "image" as const, resourceId: EMERALD_PROFESSOR_BUST_RESOURCE_ID, durationMs: 0, motion: "none" as const, narration: text })) };
    project.meta.oprnOpeningBook = { version: 1, sceneIds: texts.map((_, i) => `page_${i}`), ink: "ivory", portraitResourceId: "oprn_emerald_professor" };
    expect(upgradeLegacyEmeraldMonsterOpening(project)).toBe(true);
    expect(project.meta.oprnOpeningBook).toBeUndefined();
    expect(project.system.opening?.musicResourceId).toBe("bgm_intro");
    expect(project.system.opening?.scenes.map(scene => [scene.kind, scene.narration])).toEqual(texts.map(text => ["animatic", text]));
    const backdrops = project.system.opening!.scenes.map(scene => scene.kind === "animatic" ? scene.composition.layers[0]!.resourceId : "");
    expect(backdrops[0]).toBe("oprn_emerald_opening_dawn");
    expect(backdrops.at(-1)).toBe("oprn_emerald_opening_town");
  });

  it("keeps an introduction whose professor portrait was chosen by the author", () => {
    const project = createBlankProject();
    project.system.opening = { enabled: true, skippable: true, scenes: [{ id: "a", kind: "image", resourceId: "authored_portrait", durationMs: 0, motion: "none", narration: "안녕" }] };
    project.meta.oprnOpeningBook = { version: 1, sceneIds: ["a"], ink: "ivory", portraitResourceId: "authored_portrait" };
    const before = JSON.stringify([project.system.opening, project.meta.oprnOpeningBook]);
    expect(upgradeLegacyEmeraldMonsterOpening(project)).toBe(false);
    expect(JSON.stringify([project.system.opening, project.meta.oprnOpeningBook])).toBe(before);
  });
});

describe("emerald opening professor bust", () => {
  it("ships provenance that names the model and matches the file", () => {
    const meta = JSON.parse(readFileSync("public/assets/emerald-monster/professor-bust-provenance.json", "utf8")) as { model: string; resourceId: string; width: number; height: number };
    expect(meta).toMatchObject({ model: "gpt-image-2.5-sunburst", resourceId: EMERALD_PROFESSOR_BUST_RESOURCE_ID, width: 122, height: 97 });
    expect(existsSync("public/assets/emerald-monster/professor-bust.png")).toBe(true);
  });
});

describe("emerald opening pixel grid (CSS contract)", () => {
  const css = readFileSync("src/styles/runtime/playSurface.css", "utf8");
  const motion = readFileSync("src/styles/runtime/emeraldOpeningMotion.css", "utf8");
  it("sizes the introduced monster from the integer art box and places it on whole even pixels", () => {
    const rule = css.split("\n").find((line) => line.includes('[data-portrait-art="bust"] .cinematic-creature'));
    expect(rule).toBeDefined();
    expect(rule).toContain("width:var(--art-box-width,128px)");
    expect(rule).toContain("height:var(--art-box-height,128px)");
    expect(rule).toMatch(/left:272px;top:56px/u);
    expect(rule).not.toMatch(/%/u);
  });
  it("keeps idle bobs on 2px steps and the dialogue window inside the stage", () => {
    expect(motion).toContain("emerald-creature-idle 3.2s steps(1, end)");
    // 키프레임 블록 안(중첩 {} 한 단계)에서 -2px 를 찾는다 — 옛 정규식 [^}]* 은 첫 프레임의 } 에서 멈춰 한 번도 맞은 적이 없다(#2726 에서 실행 없이 추가).
    expect(motion).toMatch(/@keyframes emerald-professor-idle\s*\{(?:[^{}]*\{[^}]*\})*?[^{}]*\{[^}]*translate:\s*0 -2px/u);
    expect(css).toContain("width:calc(100% - 28px - 40px)");
    expect(css).toContain("border:6px double #55615f");
  });
});
