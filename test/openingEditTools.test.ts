import { describe, expect, it } from "vitest";
import { getTool } from "@/editor/tools";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext, ToolResult } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { collectUsedUploadedAssetIds, collectWebExportAssets } from "@/project/webExportAssets";
import type { CinematicSequence, Project } from "@/project/types";

const BACKDROP = "easyrpg-backdrop-cosmos1";
const TITLE_ART = "easyrpg-title-title1";
const MUSIC = "cc0-bgm-rtp-ttl-001";
const MOVIE = "movie-upload";
const VOICE = "voice-upload";

function project(): Project {
  const base = createBlankProject();
  base.assets.uploaded[MOVIE] = {
    id: MOVIE, name: "인트로 영상", kind: "movie", dataUrl: "data:video/webm;base64,AAAA", meta: {},
  };
  base.assets.uploaded[VOICE] = {
    id: VOICE, name: "내레이션", kind: "sound", dataUrl: "data:audio/ogg;base64,AAAA", meta: {},
  };
  return base;
}

function context(): ToolContext {
  return { project: project() };
}

function opening(ctx: ToolContext): CinematicSequence | undefined {
  return ctx.project.system.opening;
}

function failure(result: ToolResult): string {
  return [result.summary, ...(result.issues ?? []).map(issue => issue.message)].join("\n");
}

function seed(ctx: ToolContext, count = 3): void {
  const scenes = Array.from({ length: count }, (_, index) => ({
    id: `s${index + 1}`, kind: "text" as const, narration: `장면 ${index + 1}`, durationMs: 0,
  }));
  const result = runTool(ctx, "set_opening", { enabled: true, skippable: true, scenes });
  if (!result.ok) throw new Error(failure(result));
}

describe("오프닝 배경음악", () => {
  it("set_opening 이 음악을 저장하고 저장·재로드를 견딘다", () => {
    const ctx = context();
    const result = runTool(ctx, "set_opening", {
      enabled: true,
      musicResourceId: MUSIC,
      scenes: [{ kind: "image", resourceId: BACKDROP, narration: "별이 흘렀다", durationMs: 3000, motion: "zoom" }],
    });
    expect(result.ok, failure(result)).toBe(true);
    expect(opening(ctx)?.musicResourceId).toBe(MUSIC);
    const reloaded = deserialize(serialize(ctx.project));
    expect(reloaded.system.opening?.musicResourceId).toBe(MUSIC);
    expect(reloaded.system.opening?.scenes[0]).toMatchObject({ kind: "image", resourceId: BACKDROP });
  });

  it("효과음·영상 id 를 배경음악으로 받지 않는다", () => {
    const ctx = context();
    for (const bad of ["cc0-se-orp-interface-interface1", MOVIE, "존재하지-않는-곡"]) {
      const result = runTool(ctx, "set_opening", { musicResourceId: bad, scenes: [] });
      expect(result.ok, `${bad} 가 통과했습니다`).toBe(false);
    }
  });
});

describe("edit_opening 부분 편집", () => {
  it("빈 프로젝트에 장면을 이어 붙인다", () => {
    // 2026-09-21: 새 프로젝트는 기본 오프닝(장면 4개)이 이미 있다. «빈 프로젝트» 시나리오는
    // 오프닝 없는 상태를 명시적으로 만들어 검증한다.
    const ctx = context();
    delete ctx.project.system.opening;
    const result = runTool(ctx, "edit_opening", {
      op: "append", scene: { kind: "image", resourceId: BACKDROP, narration: "시작", durationMs: 2000 },
    });
    expect(result.ok, failure(result)).toBe(true);
    expect(opening(ctx)?.scenes).toHaveLength(1);
    expect(opening(ctx)?.enabled).toBe(true);
  });

  it("insert·update·move·remove 가 순서를 정확히 지킨다", () => {
    const ctx = context();
    seed(ctx);
    expect(runTool(ctx, "edit_opening", {
      op: "insert", index: 1, scene: { id: "mid", kind: "text", narration: "끼워넣기", durationMs: 0 },
    }).ok).toBe(true);
    expect(opening(ctx)?.scenes.map(scene => scene.id)).toEqual(["s1", "mid", "s2", "s3"]);

    expect(runTool(ctx, "edit_opening", {
      op: "update", sceneId: "mid", scene: { kind: "image", resourceId: TITLE_ART, narration: "그림으로", durationMs: 1500, motion: "pan" },
    }).ok).toBe(true);
    expect(opening(ctx)?.scenes[1]).toMatchObject({ id: "mid", kind: "image", resourceId: TITLE_ART, motion: "pan" });

    expect(runTool(ctx, "edit_opening", { op: "move", sceneId: "mid", index: 3 }).ok).toBe(true);
    expect(opening(ctx)?.scenes.map(scene => scene.id)).toEqual(["s1", "s2", "s3", "mid"]);

    expect(runTool(ctx, "edit_opening", { op: "remove", sceneId: "s2" }).ok).toBe(true);
    expect(opening(ctx)?.scenes.map(scene => scene.id)).toEqual(["s1", "s3", "mid"]);
  });

  it("시퀀스 설정만 따로 바꾼다", () => {
    const ctx = context();
    seed(ctx, 1);
    const result = runTool(ctx, "edit_opening", { op: "settings", enabled: false, skippable: false, musicResourceId: MUSIC });
    expect(result.ok, failure(result)).toBe(true);
    expect(opening(ctx)).toMatchObject({ enabled: false, skippable: false, musicResourceId: MUSIC });
    expect(opening(ctx)?.scenes).toHaveLength(1);
    expect(runTool(ctx, "edit_opening", { op: "settings", musicResourceId: "" }).ok).toBe(true);
    expect(opening(ctx)?.musicResourceId).toBeUndefined();
  });

  it("경계를 벗어난 요청을 거부한다", () => {
    const ctx = context();
    seed(ctx);
    const rejects: Record<string, unknown>[] = [
      { op: "insert", index: 9, scene: { kind: "text", narration: "범위 밖", durationMs: 0 } },
      { op: "insert", index: -1, scene: { kind: "text", narration: "음수", durationMs: 0 } },
      { op: "move", sceneId: "s1", index: 9 },
      { op: "move", sceneId: "없는장면", index: 0 },
      { op: "update", sceneId: "없는장면", scene: { kind: "text", narration: "x", durationMs: 0 } },
      { op: "remove", sceneId: "없는장면" },
      { op: "append", scene: { id: "s1", kind: "text", narration: "중복 id", durationMs: 0 } },
      { op: "append", scene: { kind: "image", resourceId: MOVIE, narration: "영상 id 를 그림에", durationMs: 0 } },
      { op: "append", scene: { kind: "text", narration: "텍스트에 그림", durationMs: 0, resourceId: BACKDROP } },
      { op: "append", scene: { kind: "video", resourceId: MOVIE, narration: "영상에 모션", durationMs: 0, motion: "zoom" } },
      { op: "append", scene: { kind: "image", resourceId: MUSIC, narration: "음악을 그림에", durationMs: 0 } },
      { op: "append", scene: { kind: "image", resourceId: BACKDROP, narration: "시간 초과", durationMs: 999_999 } },
      { op: "지우기", sceneId: "s1" },
      { op: "remove" },
    ];
    for (const args of rejects) {
      const result = runTool(ctx, "edit_opening", args);
      expect(result.ok, `통과하면 안 되는 요청: ${JSON.stringify(args)}`).toBe(false);
    }
    expect(opening(ctx)?.scenes.map(scene => scene.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("장면 상한을 넘기지 않는다", () => {
    const ctx = context();
    seed(ctx, 100);
    const result = runTool(ctx, "edit_opening", { op: "append", scene: { kind: "text", narration: "101번째", durationMs: 0 } });
    expect(result.ok).toBe(false);
    expect(opening(ctx)?.scenes).toHaveLength(100);
  });

  it("오프닝이 없을 때 remove/update/move 는 안내와 함께 거부한다", () => {
    const ctx = context();
    for (const args of [{ op: "remove", sceneId: "s1" }, { op: "move", sceneId: "s1", index: 0 }]) {
      const result = runTool(ctx, "edit_opening", args);
      expect(result.ok).toBe(false);
      expect(failure(result)).toMatch(/오프닝/u);
    }
  });

  it("유니코드 내레이션을 그대로 보존한다", () => {
    const ctx = context();
    const narration = "🌙 별빛\n둘째 줄 — 끝";
    expect(runTool(ctx, "edit_opening", { op: "append", scene: { kind: "text", narration, durationMs: 0 } }).ok).toBe(true);
    // 기본 오프닝이 있는 새 프로젝트에서도 append 는 끝에 붙는다(첫 장면 교체가 아니다).
    expect(opening(ctx)?.scenes.at(-1)?.narration).toBe(narration);
  });
});

describe("generate_opening_image", () => {
  it("헤드리스에서는 편집기 UI 필요 상태만 돌려준다", () => {
    const ctx = context();
    const result = runTool(ctx, "generate_opening_image", { prompt: "폐허가 된 성문 앞의 새벽" });
    expect(result.ok, failure(result)).toBe(true);
    expect((result.data as { status?: string } | undefined)?.status).toBe("ui-required");
    expect(Object.keys(ctx.project.assets.uploaded)).not.toContain("generated-opening-still");
  });

  it("빈 프롬프트를 거부한다", () => {
    const ctx = context();
    for (const prompt of ["", "   ", "짧"]) {
      expect(runTool(ctx, "generate_opening_image", { prompt }).ok).toBe(false);
    }
  });

  it("시스템 도메인 툴로 등록돼 있다", () => {
    expect(getTool("generate_opening_image")?.name).toBe("generate_opening_image");
    expect(getTool("edit_opening")?.name).toBe("edit_opening");
  });
});
describe("오프닝 배경음악 저장 계약", () => {
  it("존재하지 않는 음악 참조는 불러오기에서 걸러진다", () => {
    const ctx = context();
    const result = runTool(ctx, "set_opening", { musicResourceId: MUSIC, scenes: [] });
    expect(result.ok, failure(result)).toBe(true);
    const wire = JSON.parse(serialize(ctx.project)) as { system: { opening: { musicResourceId: string } } };
    wire.system.opening.musicResourceId = "없는-음악-id";
    expect(() => deserialize(JSON.stringify(wire))).toThrow(/musicResourceId/u);
  });

  it("내보내기가 오프닝 배경음악 파일을 함께 챙긴다", () => {
    const ctx = context();
    ctx.project.assets.uploaded["upload-bgm"] = {
      id: "upload-bgm", name: "업로드 곡", kind: "music", dataUrl: "data:audio/ogg;base64,AAAA", meta: {},
    };
    expect(runTool(ctx, "set_opening", { musicResourceId: "upload-bgm", scenes: [] }).ok).toBe(true);
    expect([...collectUsedUploadedAssetIds(ctx.project)]).toContain("upload-bgm");

    expect(runTool(ctx, "edit_opening", { op: "settings", musicResourceId: MUSIC }).ok).toBe(true);
    const paths = collectWebExportAssets(ctx.project).map(asset => asset.zipPath);
    expect(paths.some(path => path.toLowerCase().includes("ttl-001") || path.toLowerCase().includes("bgm"))).toBe(true);
  });
});
