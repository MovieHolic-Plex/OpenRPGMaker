// 그림 요청 줄은 «마지막 적용본» 과 비교해 줄인다 — 처음 요청과만 비교하면 마을이 타일셋을 한 번 바꾼 뒤로
// 그림마다 그 타일셋(버들항 26.8MB)이 실려 한 장 왕복이 약 21초였다(2026-11-25 draft-10min m3 실측).
import { describe, expect, it } from "vitest";
import { requestPiRender, resolvePiRender } from "../scripts/lib/piRenderBroker";
import { createBlankProject } from "@/project/defaults";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import type { Project } from "@/project/types";

const PNG_1x1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function withChangedTileset(project: Project): Project {
  const next = structuredClone(project);
  const id = Object.keys(next.tilesets)[0]!;
  next.tilesets[id] = { ...next.tilesets[id]!, name: `${next.tilesets[id]!.name ?? id} (마을이 바꿈)` };
  return next;
}

async function capture(project: Project, base: Project, latest: boolean) {
  let sent: Extract<PiAgentEvent, { type: "render_request" }> | undefined;
  const reply = requestPiRender(project, base, "show_map_region", {}, (event) => { sent = event as typeof sent; }, new AbortController().signal, 45_000, latest);
  expect(sent).toBeDefined();
  expect(resolvePiRender({ renderId: sent!.renderId, png: PNG_1x1 })).toBe(true);
  await reply;
  return sent!;
}

describe("render request slimmed against the last applied checkpoint", () => {
  it("leaves out a tileset the editor already got in a checkpoint and marks the base", async () => {
    const request = createBlankProject() as Project;
    const changed = withChangedTileset(request);
    const id = Object.keys(changed.tilesets)[0]!;
    // 처음 요청과 비교하면 바뀐 타일셋이 실린다(예전 모양).
    const old = await capture(structuredClone(changed), request, false);
    expect(old.baseIsLatest).toBeUndefined();
    expect(Object.keys(old.project.tilesets ?? {})).toContain(id);
    // 그 타일셋이 이미 적용된 체크포인트와 비교하면 빠지고, 편집기가 그 적용본에서 되붙이도록 표시한다.
    const now = await capture(structuredClone(changed), changed, true);
    expect(now.baseIsLatest).toBe(true);
    expect(Object.keys(now.project.tilesets ?? {})).not.toContain(id);
  });
});
