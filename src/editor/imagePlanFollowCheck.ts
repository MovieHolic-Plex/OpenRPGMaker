// editor/imagePlanFollowCheck.ts
// 지은 뒤 도안과 맞대기(6단계) 호출부: 이번 턴에 바뀐 맵 중 가장 큰 것을 그려 도안과 나란히 비전에 보이고(ai/imagePlanCheck.ts),
// 「도안 따름」이 기준 아래면 없는 요소만 고치는 후속 요청 한 줄을 돌려준다. 한 도안에 한 번만 — 고친 뒤 다시 맞대지 않는다.
import { loadAiConfig, chatCompletion, type ContentPart } from "@/ai/llmClient";
import { configForRoleModel, modelForRole } from "@/ai/modelRoles";
import { renderHarmonyMapImages } from "@/ai/ultrabrainImage";
import { parsePlanFollowCheck, planFollowCheckPrompt, planFollowFixRequest, type PlanFollowCheck } from "@/ai/imagePlanCheck";
import type { ImagePlanRead } from "@/ai/imagePlan";
import type { GameMap, Project } from "@/project/types";

/** 턴 전후 맵 비교 — 새로 생기거나 바닥 칸이 바뀐 맵 중 가장 넓은 것. */
export function builtMapOf(before: Project, after: Project): GameMap | null {
  let best: GameMap | null = null;
  for (const map of Object.values(after.maps)) {
    const old = before.maps[map.id];
    const changed = !old || old.width !== map.width || old.height !== map.height || old.lowerTiles.some((t, i) => t !== map.lowerTiles[i]);
    if (changed && (!best || map.width * map.height > best.width * best.height)) best = map;
  }
  return best;
}

export async function checkPlanFollow(project: Project, map: GameMap, planDataUrl: string, read: ImagePlanRead | null, signal?: AbortSignal): Promise<{ readonly check: PlanFollowCheck; readonly fix: string | null } | null> {
  const [built] = await renderHarmonyMapImages(project, map);
  if (!built) return null;
  const config = loadAiConfig();
  const vision = configForRoleModel(config, modelForRole(config, "vision"));
  const parts: ContentPart[] = [
    { type: "text", text: planFollowCheckPrompt(read?.subject ?? "village", read?.cells) },
    { type: "image_url", image_url: { url: planDataUrl, detail: "high" } },
    { type: "image_url", image_url: { url: built.dataUrl, detail: "high" } },
  ];
  const result = await chatCompletion({ ...vision, reasoningEffort: "off", maxTokens: 3000 }, { messages: [{ role: "user", content: parts }], response_format: { type: "json_object" }, temperature: 0, ...(signal ? { signal } : {}) });
  const content = result.message.content;
  const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((p) => (p.type === "text" ? p.text : "")).join("") : "";
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  let data: Record<string, unknown> | null = null;
  if (start >= 0 && end > start) { try { data = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>; } catch { data = null; } }
  const check = parsePlanFollowCheck(data);
  return check ? { check, fix: planFollowFixRequest(check) } : null;
}
