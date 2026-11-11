// 참고문서 읽기 인정은 결과 글에 알림이 붙어도 된다(2026-11-11 작은 일 재측정: Terra 가 빈 칸을 채워 보내 인자 고침 알림 «Fixed: …» 이
// 결과에 붙었고, 관문이 글 조각을 이어 붙여 JSON 으로 읽다 실패해 읽은 것을 영영 인정하지 않았다 — place_door 가 세 번 거절).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { PiTilesetReferenceGate } from "@/ai/piAgent/tilesetReferenceGate";
import { buildFixture } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";

const NOTE = "Fixed: dropped empty/default optional fields: documentId, imageId";
const SHAPES: Record<string, (json: string) => unknown> = {
  "결과 JSON 만": (json) => json,
  "뒤에 알림 조각": (json) => [{ type: "text", text: json }, { type: "text", text: NOTE }],
  "한 글 뒤에 알림 줄": (json) => `${json}\n${NOTE}`,
  "한 글 앞에 알림 줄": (json) => `[Fixed call: {kind:"say"} → {kind:"text", body}]\n${json}`,
};

async function readAll(shape: (json: string) => unknown) {
  const project = buildFixture("built");
  const gate = new PiTilesetReferenceGate();
  const ctx = { project };
  const outputs: unknown[] = [], images: string[] = [];
  let after: string[] = [];
  for (let i = 0; i < 12; i++) {
    const read = runTool(ctx, "read_tileset_reference", { tilesetId: "snow_north", categoryId: "sn-snow-north", ...(after.length ? { after } : {}) });
    expect(read.ok, read.summary).toBe(true);
    for (const image of await gate.read(project, read)) images.push(image.dataUrl);
    outputs.push(shape(JSON.stringify({ ok: read.ok, summary: read.summary, data: read.data })));
    if (!/남은 쪽/u.test(read.summary)) break;
    after = (read.data as { after: string[] }).after;
  }
  const hall = Object.values(project.maps).find((m) => m?.name === "족장의 긴 집")!;
  const door = { mapId: hall.id, at: { x: 7, y: 2 }, material: "벽 통로", referencePurpose: "sn-snow-north" };
  return { project, gate, outputs, images, door };
}

describe("참고문서 관문 — 읽은 것 인정", () => {
  it.each(Object.keys(SHAPES))("%s: 끝까지 읽고 그림을 받았으면 배치를 막지 않는다", async (name) => {
    const { project, gate, outputs, images, door } = await readAll(SHAPES[name]!);
    expect(gate.beforeWrite(project, "place_door", door)?.ok).toBe(false);
    gate.payload({ input: [...outputs.map((output) => ({ type: "function_call_output", output })), { role: "user", content: images.map((url) => ({ type: "input_image", image_url: url })) }] });
    gate.complete(true);
    expect(gate.beforeWrite(project, "place_door", door)).toBeNull();
  }, 60_000);

  it("잘린 결과·실패한 응답은 여전히 읽은 것이 아니다", async () => {
    const { project, gate, outputs, images, door } = await readAll(SHAPES["결과 JSON 만"]!);
    const cut = (outputs as string[]).map((json) => JSON.stringify({ ...(JSON.parse(json) as object), dataTruncated: true }));
    gate.payload({ input: [...cut.map((output) => ({ type: "function_call_output", output })), { role: "user", content: images.map((url) => ({ type: "input_image", image_url: url })) }] });
    gate.complete(true);
    expect(gate.beforeWrite(project, "place_door", door)?.ok).toBe(false);
    gate.payload({ input: outputs.map((output) => ({ type: "function_call_output", output })) });
    gate.complete(false);
    expect(gate.beforeWrite(project, "place_door", door)?.ok).toBe(false);
  }, 60_000);
});
