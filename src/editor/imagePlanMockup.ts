// editor/imagePlanMockup.ts
// 그림 도안(src/ai/imagePlan.ts)을 실제로 받는 곳 — ChatGPT 이미지 모델로 한 장을 청하고(Google 은 쓰지 않는다), 칸 번호 격자를 그려 비전 모델이 배치를 읽게 한다.
import { loadAiConfig, chatCompletion, type ContentPart } from "@/ai/llmClient";
import { configForRoleModel, modelForRole } from "@/ai/modelRoles";
import { companionCredentialMissing } from "@/ai/chatgptOAuthClient";
import { generateAiImage } from "@/ai/imageGenerationClient";
import { RECOMMENDED_IMAGE_MODEL, RECOMMENDED_IMAGE_PROVIDER_ID } from "@/ai/imageModelCatalog";
import {
  IMAGE_PLAN_FAILED_LINE, IMAGE_PLAN_READ_FAILED_LINE, IMAGE_PLAN_SKIPPED_LINE,
  gridSizeFor, imagePlanDescribePrompt, imagePlanPrompt, imagePlanReadPrompt, parseImagePlanDescription, type ImagePlanDescription, type ImagePlanRead, type ImagePlanScene,
} from "@/ai/imagePlan";
import { shrinkReferenceImage } from "@/start/firstRun/referenceImage";
import { applyCellFixes, cellColor, cellGridSize, cellMapFixPrompt, cellMapReadPrompt, parseCellMap, type CellMap } from "@/ai/imagePlanCells";
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

async function gridPicture(blob: Blob, cols: number, rows: number, every = 1, overlay?: CellMap): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("캔버스를 열 수 없습니다.");
    ctx.drawImage(bitmap, 0, 0, w, h);
    if (overlay) {
      ctx.globalAlpha = 0.5;
      for (let r = 0; r < overlay.rows; r += 1) for (let c = 0; c < overlay.cols; c += 1) {
        const [cr, cg, cb] = cellColor(overlay.cells[r]![c]!);
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        const x0 = Math.round(c * w / cols), y0 = Math.round(r * h / rows);
        ctx.fillRect(x0, y0, Math.round((c + 1) * w / cols) - x0, Math.round((r + 1) * h / rows) - y0);
      }
      ctx.globalAlpha = 1;
    }
    ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c += 1) { ctx.strokeStyle = c % every === 0 ? "#ffff00" : "rgba(255,255,0,0.35)"; const x = Math.round(c * w / cols) + 0.5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let r = 0; r <= rows; r += 1) { ctx.strokeStyle = r % every === 0 ? "#ffff00" : "rgba(255,255,0,0.35)"; const y = Math.round(r * h / rows) + 0.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.font = `bold ${every > 1 ? 13 : 16}px sans-serif`; ctx.lineWidth = 3; ctx.strokeStyle = "#000"; ctx.fillStyle = "#fff";
    for (let c = 0; c < cols; c += every) { const x = Math.round((c + 0.5) * w / cols) - 6; ctx.strokeText(String(c), x, 14); ctx.fillText(String(c), x, 14); }
    for (let r = 0; r < rows; r += every) { const y = Math.round((r + 0.5) * h / rows) + 5; ctx.strokeText(String(r), 2, y); ctx.fillText(String(r), 2, y); }
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

async function askVision(parts: ContentPart[], maxTokens: number, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
  const config = loadAiConfig();
  const vision = configForRoleModel(config, modelForRole(config, "vision"));
  const result = await chatCompletion({ ...vision, reasoningEffort: "off", maxTokens }, { messages: [{ role: "user", content: parts }], response_format: { type: "json_object" }, temperature: 0.1, ...(signal ? { signal } : {}) });
  const content = result.message.content;
  const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((p) => (p.type === "text" ? p.text : "")).join("") : "";
  return lastJson(text);
}

/** 칸 지도 읽기(imagePlanCells.ts): 긴 변 48칸 → 읽은 지도를 도안 위에 격쳐 틀린 영역만 한 번 고친다. 실패하면 null(옛 점 읽기로 간다). */
async function readCells(blob: Blob, scene: ImagePlanScene, signal?: AbortSignal): Promise<ImagePlanRead | null> {
  const bitmap = await createImageBitmap(blob);
  const { cols, rows } = cellGridSize(bitmap.width, bitmap.height);
  bitmap.close();
  const picture = await gridPicture(blob, cols, rows, 4);
  const first = await askVision([{ type: "text", text: cellMapReadPrompt(scene.subject, cols, rows) }, { type: "image_url", image_url: { url: picture, detail: "high" } }], 8000, signal);
  const map = parseCellMap(first, scene.subject, cols, rows);
  if (!map) return null;
  let cells = map, fixedRegions = 0;
  try {
    const overlay = await gridPicture(blob, cols, rows, 4, map);
    const fix = await askVision([{ type: "text", text: cellMapFixPrompt(scene.subject, cols, rows) }, { type: "image_url", image_url: { url: picture, detail: "high" } }, { type: "image_url", image_url: { url: overlay, detail: "high" } }], 4000, signal);
    const applied = applyCellFixes(map, fix);
    cells = applied.map; fixedRegions = applied.fixed;
  } catch (error) {
    if (signal?.aborted) throw error;
    console.info(`imagePlan: cell fix failed ${error instanceof Error ? error.message : String(error)}`);
  }
  console.info(`imagePlan: cells ${cols}x${rows} landmarks=${cells.landmarks.length} fixed=${fixedRegions}`);
  return { subject: scene.subject, cols, rows, data: { cells: cells.cells, landmarks: cells.landmarks }, cells, fixedRegions };
}

/** 도안 묘사(랜드마크·생김새·분위기·꼭 살릴 것) — 칸 읽기와 같이 돈다. 실패하면 null(칸 지도만으로 짓는다). */
async function readDescription(blob: Blob, scene: ImagePlanScene, signal?: AbortSignal): Promise<ImagePlanDescription | null> {
  try {
    const url = await shrinkReferenceImage(blob);
    return parseImagePlanDescription(await askVision([{ type: "text", text: imagePlanDescribePrompt(scene.subject) }, { type: "image_url", image_url: { url, detail: "high" } }], 3000, signal));
  } catch (error) {
    if (signal?.aborted) throw error;
    console.info(`imagePlan: describe failed ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function readLayout(blob: Blob, scene: ImagePlanScene, signal?: AbortSignal): Promise<ImagePlanRead | null> {
  const [layout, description] = await Promise.all([readLayoutOnly(blob, scene, signal), loadAiConfig().imagePlanDescribe === false ? Promise.resolve(null) : readDescription(blob, scene, signal)]);
  if (description) console.info(`imagePlan: describe keep=${description.mustKeep.length} landmarks=${description.landmarks.length}`);
  return layout && description ? { ...layout, description } : layout;
}

async function readLayoutOnly(blob: Blob, scene: ImagePlanScene, signal?: AbortSignal): Promise<ImagePlanRead | null> {
  try {
    const cells = await readCells(blob, scene, signal);
    if (cells) return cells;
  } catch (error) {
    if (signal?.aborted) throw error;
    console.info(`imagePlan: cell read failed ${error instanceof Error ? error.message : String(error)}`);
  }
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
