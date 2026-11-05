// 2026-11-05 imageplan-follow r3: the plan image is there to feed the assistant ideas (owner: 「이미지는 LLM 의 빈곤한 상상력을 극복하는 용도로」).
// The vision description (must-keeps, landmarks with look and place, mood) rides in the build note next to the light cell map.
import { afterEach, describe, expect, it } from "vitest";
import { describeNote, imagePlanBuildNote, parseImagePlanDescription } from "@/ai/imagePlan";
import { parseCellMap } from "@/ai/imagePlanCells";
import { AI_CONFIG_STORAGE_KEY, loadAiConfig } from "@/ai/llmClient";

const raw = {
  mustKeep: ["북쪽 가운데 속 빈 거대 고목", "남쪽 진입로가 Y자로 갈라진다", "동쪽 연못에 수련", "", 42],
  landmarks: [{ name: "속 빈 고목", look: "검은 입구, 굵은 뿌리", where: "북쪽 가운데" }, { look: "이름 없음" }],
  mood: "안개 낀 어두운 숲, 발광 버섯",
  materials: "이끼 낀 흙길",
};

describe("plan description", () => {
  it("keeps named must-keeps and landmarks and drops empty ones", () => {
    const d = parseImagePlanDescription(raw)!;
    expect(d.mustKeep).toEqual(["북쪽 가운데 속 빈 거대 고목", "남쪽 진입로가 Y자로 갈라진다", "동쪽 연못에 수련"]);
    expect(d.landmarks.map((l) => l.name)).toEqual(["속 빈 고목"]);
    expect(parseImagePlanDescription({ mood: "only mood" })).toBeNull();
  });

  it("puts the ideas into the build note ahead of the cell map, within the note budget", () => {
    const d = parseImagePlanDescription(raw)!;
    expect(describeNote(d).length).toBeLessThanOrEqual(1600);
    const cells = parseCellMap({ cells: Array.from({ length: 32 }, () => "t".repeat(23) + "==" + "t".repeat(23)) }, "forest", 48, 32)!;
    const note = imagePlanBuildNote({ subject: "forest" } as never, { subject: "forest", cols: 48, rows: 32, data: {}, cells, description: d });
    expect(note.indexOf("속 빈 고목")).toBeGreaterThan(0);
    expect(note.indexOf("속 빈 고목")).toBeLessThan(note.indexOf("author_forest_route"));
    expect(note).toContain("generate_missing_object");
  });

  it("carries the ideas on the point-read and no-layout paths too", () => {
    const d = parseImagePlanDescription(raw)!;
    const village = imagePlanBuildNote({ subject: "village" } as never, { subject: "village", cols: 24, rows: 18, data: { width: 24, height: 18, buildings: [] }, description: d });
    expect(village).toContain("속 빈 고목");
    expect(village).toContain("author_beodeul_town");
    const bare = imagePlanBuildNote({ subject: "dungeon" } as never, { subject: "dungeon", cols: 0, rows: 0, data: {}, description: d });
    expect(bare).toContain("속 빈 고목");
    expect(bare).not.toContain("author_dungeon");
  });

  it("drops landmarks from the end, not the rule or mood line, when the note is too long", () => {
    const long = parseImagePlanDescription({
      mustKeep: Array.from({ length: 8 }, (_, i) => `꼭 살릴 것 ${i} `.padEnd(60, "가")),
      landmarks: Array.from({ length: 10 }, (_, i) => ({ name: `랜드마크${i}`.padEnd(30, "나"), look: "다".repeat(50), where: "라".repeat(30) })),
      mood: "마".repeat(80), materials: "바".repeat(80),
    })!;
    const note = describeNote(long);
    expect(note.length).toBeLessThanOrEqual(1600);
    expect(note).toContain("generate_missing_object");
    expect(note).toContain("분위기·재질");
    expect(note).toContain("랜드마크0");
    expect(note).not.toContain("랜드마크9");
  });
});

describe("describe switch", () => {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  afterEach(() => store.clear());

  it("keeps imagePlanDescribe:false through loadAiConfig", () => {
    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: "openai-codex", imagePlanDescribe: false }));
    expect(loadAiConfig().imagePlanDescribe).toBe(false);
    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: "openai-codex" }));
    expect(loadAiConfig().imagePlanDescribe).toBeUndefined();
  });
});
