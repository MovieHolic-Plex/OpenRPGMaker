// editor/imagePlanMockup.ts
// 그림 도안(src/ai/imagePlan.ts)을 실제로 받는 곳 — ChatGPT 이미지 모델로 한 장을 청하고(Google 은 쓰지 않는다), 칸 번호 격자를 그려 비전 모델이 배치를 읽게 한다.
import { loadAiConfig, chatCompletion, type ContentPart } from "@/ai/llmClient";
import { configForRoleModel, modelForRole } from "@/ai/modelRoles";
import { companionCredentialMissing } from "@/ai/chatgptOAuthClient";
import { generateAiImage } from "@/ai/imageGenerationClient";
import { RECOMMENDED_IMAGE_MODEL, RECOMMENDED_IMAGE_PROVIDER_ID } from "@/ai/imageModelCatalog";
import {
  IMAGE_PLAN_FAILED_LINE, IMAGE_PLAN_READ_FAILED_LINE, IMAGE_PLAN_SKIPPED_LINE,
  gridSizeFor, imagePlanPrompt, imagePlanReadPrompt, type ImagePlanRead, type ImagePlanScene,
} from "@/ai/imagePlan";
import { shrinkReferenceImage } from "@/start/firstRun/referenceImage";
import {
  IMAGE_PLAN_MAX_CANDIDATES, imagePlanJudgePrompt, parsePlanJudge, pickBest, pickLine,
  type PlanCandidate, type PlanJudge,
} from "@/ai/imagePlanPick";

export type ImagePlanOutcome =
  | { readonly kind: "mockup"; readonly dataUrl: string; readonly model: string; readonly read: ImagePlanRead | null; readonly readLine?: string; readonly pickLine?: string; readonly candidates?: number }
  | { readonly kind: "skipped" | "failed"; readonly line: string };

function toBlob(dataUrl: string): Blob {
  const [head, body = ""] = dataUrl.split(",", 2);
  const bytes = Uint8Array.from(atob(body), (ch) => ch.charCodeAt(0));
  return new Blob([bytes], { type: /^data:([^;]+)/u.exec(head ?? "")?.[1] ?? "image/png" });
}

async function gridPicture(blob: Blob, cols: number, rows: number): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("캔버스를 열 수 없습니다.");
    ctx.drawImage(bitmap, 0, 0, w, h);
    ctx.strokeStyle = "#ffff00"; ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c += 1) { const x = Math.round(c * w / cols) + 0.5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let r = 0; r <= rows; r += 1) { const y = Math.round(r * h / rows) + 0.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.font = "bold 16px sans-serif"; ctx.lineWidth = 3; ctx.strokeStyle = "#000"; ctx.fillStyle = "#fff";
    for (let c = 0; c < cols; c += 1) { const x = Math.round((c + 0.5) * w / cols) - 6; ctx.strokeText(String(c), x, 16); ctx.fillText(String(c), x, 16); }
    for (let r = 0; r < rows; r += 1) { const y = Math.round((r + 0.5) * h / rows) + 5; ctx.strokeText(String(r), 2, y); ctx.fillText(String(r), 2, y); }
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    bitmap.close();
  }
}

function lastJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{"); const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { const parsed: unknown = JSON.parse(text.slice(start, end + 1)); return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null; } catch { return null; }
}

async function readLayout(blob: Blob, scene: ImagePlanScene, signal?: AbortSignal): Promise<ImagePlanRead | null> {
  const bitmap = await createImageBitmap(blob);
  const { cols, rows } = gridSizeFor(bitmap.width, bitmap.height);
  bitmap.close();
  const picture = await gridPicture(blob, cols, rows);
  const config = loadAiConfig();
  const vision = configForRoleModel(config, modelForRole(config, "vision"));
  const parts: ContentPart[] = [
    { type: "text", text: imagePlanReadPrompt(scene.subject, cols, rows) },
    { type: "image_url", image_url: { url: picture, detail: "high" } },
  ];
  const result = await chatCompletion({ ...vision, reasoningEffort: "off", maxTokens: 4000 }, { messages: [{ role: "user", content: parts }], response_format: { type: "json_object" }, temperature: 0.1, ...(signal ? { signal } : {}) });
  const content = result.message.content;
  const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((p) => (p.type === "text" ? p.text : "")).join("") : "";
  const data = lastJson(text);
  return data ? { subject: scene.subject, cols, rows, data } : null;
}

interface Drawn { readonly blob: Blob; readonly model: string; read: ImagePlanRead | null }

async function drawOne(scene: ImagePlanScene, signal?: AbortSignal): Promise<Drawn | null> {
  try {
    const image = await generateAiImage({ prompt: imagePlanPrompt(scene), providerId: RECOMMENDED_IMAGE_PROVIDER_ID, model: RECOMMENDED_IMAGE_MODEL, ...(signal ? { signal } : {}) });
    const blob = toBlob(image.dataUrl);
    let read: ImagePlanRead | null = null;
    try {
      read = await readLayout(blob, scene, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      console.info(`imagePlan: read failed ${error instanceof Error ? error.message : String(error)}`);
    }
    return { blob, model: image.model, read };
  } catch (error) {
    if (signal?.aborted) throw error;
    console.info(`imagePlan: image failed ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function sheetOf(blobs: readonly Blob[]): Promise<string> {
  const maps = await Promise.all(blobs.map((b) => createImageBitmap(b)));
  try {
    const h = 640;
    const widths = maps.map((m) => Math.round(m.width * h / m.height));
    const canvas = document.createElement("canvas");
    canvas.width = widths.reduce((a, b) => a + b, 0) + 8 * (maps.length - 1); canvas.height = h + 28;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("캔버스를 열 수 없습니다.");
    ctx.fillStyle = "#202020"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    let x = 0;
    maps.forEach((m, i) => {
      ctx.drawImage(m, x, 28, widths[i] ?? 0, h);
      ctx.font = "bold 20px sans-serif"; ctx.fillStyle = "#ffff00"; ctx.fillText(String(i + 1), x + 6, 21);
      x += (widths[i] ?? 0) + 8;
    });
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    maps.forEach((m) => m.close());
  }
}

async function judgeCandidates(scene: ImagePlanScene, drawn: readonly Drawn[], signal?: AbortSignal): Promise<PlanJudge | null> {
  try {
    const config = loadAiConfig();
    const vision = configForRoleModel(config, modelForRole(config, "vision"));
    const parts: ContentPart[] = [
      { type: "text", text: imagePlanJudgePrompt(scene, drawn.length) },
      { type: "image_url", image_url: { url: await sheetOf(drawn.map((d) => d.blob)), detail: "high" } },
    ];
    const result = await chatCompletion({ ...vision, reasoningEffort: "off", maxTokens: 1500 }, { messages: [{ role: "user", content: parts }], response_format: { type: "json_object" }, temperature: 0, ...(signal ? { signal } : {}) });
    const content = result.message.content;
    const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((p) => (p.type === "text" ? p.text : "")).join("") : "";
    return parsePlanJudge(lastJson(text), drawn.length);
  } catch (error) {
    if (signal?.aborted) throw error;
    console.info(`imagePlan: judge failed ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** 도안 후보 수: 1 이면 한 장만(전과 같다), 2 이상이면 그만큼 동시에 뽑아 판정자가 고르고 기준 미달이면 1장씩 더(최대 3장). */
export async function requestImagePlanMockup(scene: ImagePlanScene, signal?: AbortSignal, candidates: number = 1): Promise<ImagePlanOutcome> {
  if (await companionCredentialMissing(RECOMMENDED_IMAGE_PROVIDER_ID)) return { kind: "skipped", line: IMAGE_PLAN_SKIPPED_LINE };
  const first = Math.max(1, Math.min(IMAGE_PLAN_MAX_CANDIDATES, Math.round(candidates)));
  const drawn: Drawn[] = (await Promise.all(Array.from({ length: first }, () => drawOne(scene, signal)))).filter((d): d is Drawn => d !== null);
  if (!drawn.length) return { kind: "failed", line: IMAGE_PLAN_FAILED_LINE };
  let judge: PlanJudge | null = null;
  let best = { index: 0, met: true, scores: [0] as number[] };
  const asCands = (): PlanCandidate[] => drawn.map((d) => ({ dataUrl: "", read: d.read }));
  if (first > 1) {
    for (;;) {
      judge = drawn.length > 1 ? await judgeCandidates(scene, drawn, signal) : null;
      best = pickBest(scene.subject, asCands(), judge);
      if (drawn.length === 1 && first > 1) best = { ...best, met: false };
      if (best.met || drawn.length >= IMAGE_PLAN_MAX_CANDIDATES || (drawn.length > 1 && !judge)) break;
      const more = await drawOne(scene, signal);
      if (!more) break;
      drawn.push(more);
    }
    console.info(`imagePlan: picked=${best.index + 1}/${drawn.length} met=${best.met} scores=${best.scores.map((s) => s.toFixed(1)).join(",")}`);
  }
  const chosen = drawn[best.index] ?? drawn[0];
  if (!chosen) return { kind: "failed", line: IMAGE_PLAN_FAILED_LINE };
  try {
    return {
      kind: "mockup", dataUrl: await shrinkReferenceImage(chosen.blob), model: chosen.model, read: chosen.read, candidates: drawn.length,
      ...(chosen.read ? {} : { readLine: IMAGE_PLAN_READ_FAILED_LINE }),
      ...(drawn.length > 1 ? { pickLine: pickLine(drawn.length, best.index, judge?.reason ?? "") } : {}),
    };
  } catch (error) {
    console.info(`imagePlan: shrink failed ${error instanceof Error ? error.message : String(error)}`);
    return { kind: "failed", line: IMAGE_PLAN_FAILED_LINE };
  }
}
