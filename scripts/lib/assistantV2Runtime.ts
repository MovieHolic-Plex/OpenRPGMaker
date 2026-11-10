// 조수 v2 실행기 — v1 의 runPiAgent 를 그대로 쓰되(체크포인트·실시간 시공·맵 소유권·사용량·로컬 CLI), 도구를 v2 동사로,
// 시스템 지시를 v2 카드로 바꾼다. v1 레지스트리 도구는 하나도 노출하지 않는다(options.toolNames 가 아무것도 고르지 않는다).
// 켜는 곳: 편집기 ?assistant=v2 또는 localStorage oprn:assistant-v2=1 → 요청 assistantVersion:"v2" → 워커가 여기로 보낸다.
import { PNG } from "pngjs";
import { applyMapLighting, litShotNote, type LitShot } from "../../src/ai/v2/vqaLighting.ts";
import type { GameMap, Project } from "../../src/project/types.ts";
import { runPiAgent, type RunPiAgentOptions } from "./piAgentRuntime.ts";
import type { PiAgentDoneEvent, PiAgentRequest } from "../../src/ai/piAgent/protocol.ts";
import { buildV2SystemPrompt } from "../../src/ai/v2/prompt.ts";
import { vqaShotPlan, type VqaShot } from "../../src/ai/v2/judge/vqa.ts";
import type { PiAssistantV2Env } from "../../src/ai/v2/env.ts";
import { createV2Turn } from "../../src/ai/v2/turn/turn.ts";

/** PNG dataURL 에 맵 조명을 입힌다. 해독·인코딩이 실패하면 undefined(원래 그림을 쓴다). */
function litMapImage(dataUrl: string, map: GameMap, project: Project): { image: string; lit: LitShot } | undefined {
  try {
    const m = /^data:image\/png;base64,(.+)$/u.exec(dataUrl);
    if (!m) return undefined;
    const png = PNG.sync.read(Buffer.from(m[1]!, "base64"));
    const lit = applyMapLighting(png.data, png.width, png.height, map, project);
    if (!lit.applied) return undefined;
    return { image: `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`, lit };
  } catch { return undefined; }
}

async function captureVqaShots(env: PiAssistantV2Env): Promise<{ shots: VqaShot[]; failed: string[] }> {
  const changed = new Set(Object.keys(env.ctx.project.maps).filter((id) => env.request.project.maps[id] !== env.ctx.project.maps[id]));
  const shots: VqaShot[] = [], failed: string[] = [];
  for (const item of vqaShotPlan(env.ctx.project, changed)) {
    try {
      let image: string | undefined;
      let where = item.where;
      if (item.region && env.render) image = await env.render(item.region.mapId, item.region.x, item.region.y, item.region.w, item.region.h);
      else if (item.kind === "map" && item.ref && env.render) {
        const map = env.ctx.project.maps[item.ref]!;
        image = await env.render(item.ref, 0, 0, map.width, map.height);
        // 맵 그림은 조명을 그리지 않는다 — 게임처럼 어둠·빛을 입혀 검수자가 실제 화면의 밝기를 보게 한다.
        if (image && map.defaultLighting?.ambient) {
          const lit = litMapImage(image, map, env.ctx.project);
          if (lit) { image = lit.image; where = `${item.where}${litShotNote(lit.lit)}`; }
          else where = `${item.where} — 조명을 입히지 못한 편집기 그림(게임에서는 어둠 ${map.defaultLighting.ambient})`;
        }
      } else if (env.renderArt && item.shotId && item.atMs) image = await env.renderArt({ shotId: item.shotId, atMs: item.atMs });
      else if (env.renderArt && item.ref) image = await env.renderArt({ resourceId: item.ref });
      if (image) shots.push({ where, kind: item.kind, ...(item.ref ? { ref: item.ref } : {}), image });
      else failed.push(`${item.where}: 그릴 경로 없음`);
    } catch (error) {
      if (env.signal?.aborted) throw error;
      // 왜 못 찍었는지 남긴다(2026-10-26 hf2-school-claude-j79: 타이틀 그림이 판마다 「못 찍음 1」로만 남았다 — 원인은 이 설치에 없는 오프닝 스틸 팩 그림).
      const reason = error instanceof Error ? error.message : String(error);
      failed.push(`${item.where}${item.ref ? `(${item.ref})` : ""}: ${reason.slice(0, 160)}`);
    }
  }
  return { shots, failed };
}

export async function runAssistantV2(request: PiAgentRequest, options: RunPiAgentOptions = {}): Promise<PiAgentDoneEvent> {
  // 그림을 찍는 일(PNG 해독·조명 입히기)은 Node 쪽 일이라 여기 남는다 — 턴 정책(src/ai/v2/turn)에는 이 구멍으로만 넘긴다.
  const turn = createV2Turn(request, options, { captureVqaShots });
  const done = await runPiAgent({
    ...request,
    systemPrompt: buildV2SystemPrompt(request.project, request.currentMapId, request.task, turn.store, request.projectKey ? String(request.projectKey) : undefined),
    initialToolNames: [],
    openingProduction: false,
  }, {
    ...options,
    onEvent: turn.onEvent,
    // 존재하지 않는 이름 하나 — 레지스트리 도구를 하나도 고르지 않고, 이름 지정 실행이라 v1 확인표·작가 도구도 꺼진다.
    toolNames: ["__assistant_v2__"],
    v2: turn.hooks,
  });
  turn.finishTurn(done);
  return done;
}
