import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import {
  GIT_SYNC_ASSETS_MANIFEST_FILE,
  GIT_SYNC_COMMON_EVENTS_FILE,
  GIT_SYNC_FORMAT_FILE,
  GIT_SYNC_META_FILE,
  GIT_SYNC_QUESTS_FILE,
  GIT_SYNC_SYSTEM_FILE,
  GIT_SYNC_VARS_SWITCHES_FILE,
  packTextFilesToProject,
  unpackProjectToTextFiles,
  validateUnpackedProjectFiles,
} from "@/project/gitSync";
import { scriptSourceHash } from "@/project/script/types";

describe("gitSync", () => {
  it("losslessly roundtrips a rich project with maps, tilesets, database, scripts, quests, and assets", () => {
    const project = createBlankProject();
    project.meta.title = "상업 RPG 프로덕션 테스트";
    project.meta.author = "Studio Alpha";
    project.switches.push({ id: "sw_boss", name: "보스 격파" });
    project.variables.push({ id: "var_score", name: "점수" });
    project.flags.demoFlag = true;
    project.quests = [
      {
        id: "q_intro",
        title: "첫 의뢰",
        description: "마을 밖 슬라임을 처치한다.",
        steps: [],
      } as unknown as NonNullable<typeof project.quests>[number],
    ];
    project.commonEvents.push({
      id: "ce_heal",
      name: "전체 회복",
      trigger: "none",
      commands: [{ kind: "recoverAll" }],
    });
    const scriptSource = 'export function bonus(x: number): number {\n  return x * 2;\n}\n';
    project.scriptLibrary = [
      {
        id: "combat_math",
        name: "전투 수식",
        description: "대미지 보정",
        source: scriptSource,
        compiled: "exports.bonus = function (x) { return x * 2; };",
        sourceHash: scriptSourceHash(scriptSource),
        apiVersion: 1,
      },
    ];
    project.assets.uploaded["pic_hero"] = {
      id: "pic_hero",
      name: "주인공 일러스트",
      kind: "picture",
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      meta: { width: 512, height: 512 },
    };
    project.assets.uploaded["bgm_boss"] = {
      id: "bgm_boss",
      name: "보스 테마",
      kind: "music",
      ref: { sha256: "a".repeat(64), mime: "audio/ogg", bytes: 123456, extension: "ogg" },
      meta: {},
    };

    // Add a second map to verify per-map file splitting
    const firstMapId = Object.keys(project.maps)[0]!;
    const secondMap = structuredClone(project.maps[firstMapId]!);
    secondMap.id = "map_dungeon_01";
    secondMap.name = "고대 던전 1층";
    project.maps[secondMap.id] = secondMap;

    const files = unpackProjectToTextFiles(project, { projectId: "proj_team_01" });

    // Verify expected directory structure
    expect(files[GIT_SYNC_FORMAT_FILE]).toBeDefined();
    expect(files[GIT_SYNC_META_FILE]).toBeDefined();
    expect(files[GIT_SYNC_SYSTEM_FILE]).toBeDefined();
    expect(files[GIT_SYNC_VARS_SWITCHES_FILE]).toBeDefined();
    expect(files[GIT_SYNC_ASSETS_MANIFEST_FILE]).toBeDefined();
    expect(files[GIT_SYNC_COMMON_EVENTS_FILE]).toBeDefined();
    expect(files[GIT_SYNC_QUESTS_FILE]).toBeDefined();
    expect(files[`maps/${firstMapId}.json`]).toBeDefined();
    expect(files["maps/map_dungeon_01.json"]).toBeDefined();
    expect(files["database/actors.json"]).toBeDefined();
    expect(files["database/troops.json"]).toBeDefined();
    expect(files["scripts/combat_math.ts"]).toBe(scriptSource);
    expect(files["scripts/combat_math.meta.json"]).toBeDefined();
    expect(files["assets/inline/pic_hero.dataurl"]).toBe("data:image/png;base64,iVBORw0KGgo=");

    // Deterministic output on repeated unpack
    const filesAgain = unpackProjectToTextFiles(project, { projectId: "proj_team_01" });
    expect(filesAgain).toEqual(files);

    // 100% lossless deep-equality roundtrip
    const repacked = packTextFilesToProject(files);
    const expectedNormalized = JSON.parse(JSON.stringify(project));
    expect(repacked).toEqual(expectedNormalized);

    // Validation passes cleanly
    const report = validateUnpackedProjectFiles(files);
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.counts.maps).toBe(2);
    expect(report.counts.scripts).toBe(1);
    expect(report.counts.uploadedAssets).toBe(2);
  });

  it("allows editing extracted .ts scripts directly and flags stale sourceHash in diff-check", () => {
    const project = createBlankProject();
    const initialSource = "export const RATE = 1;\n";
    project.scriptLibrary = [
      {
        id: "rates",
        source: initialSource,
        compiled: "exports.RATE = 1;",
        sourceHash: scriptSourceHash(initialSource),
      },
    ];
    const files = unpackProjectToTextFiles(project);
    files["scripts/rates.ts"] = "export const RATE = 3;\n";

    const repacked = packTextFilesToProject(files);
    expect(repacked.scriptLibrary?.[0]?.source).toBe("export const RATE = 3;\n");

    const validation = validateUnpackedProjectFiles(files);
    expect(validation.ok).toBe(true);
    expect(validation.warnings.some((w) => w.path === "scripts/rates.ts" && w.message.includes("sourceHash"))).toBe(true);
  });

  it("reports broken map/tileset cross-references during validateUnpackedProjectFiles", () => {
    const project = createBlankProject();
    const firstMapId = Object.keys(project.maps)[0]!;
    const files = unpackProjectToTextFiles(project);
    const brokenMap = JSON.parse(files[`maps/${firstMapId}.json`]!);
    brokenMap.tilesetId = "missing_tileset";
    files[`maps/${firstMapId}.json`] = `${JSON.stringify(brokenMap, null, 2)}\n`;

    const validation = validateUnpackedProjectFiles(files);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.message.includes("missing_tileset"))).toBe(true);
  });
});
