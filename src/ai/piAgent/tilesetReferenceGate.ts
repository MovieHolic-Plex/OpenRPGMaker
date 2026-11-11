import { TilesetReferenceEvidence } from "../tilesetReferenceEvidence";
import type { Project } from "@/project/types";
import type { ToolResult } from "@/editor/tools/types";

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
/**
 * 도구 결과의 글 조각들. 결과 JSON 은 조각 하나에 통째로 들어 있다 — 뒤에 붙은 다른 조각(인자 고침 알림 «Fixed: …», 상태 카드)과
 * 이어 붙여 읽으면 JSON 이 아니게 돼 읽은 것이 영영 인정되지 않았다(2026-11-11 작은 일 재측정: 참고문서를 끝까지 읽고도 place_door 가 세 번 거절).
 */
function textParts(value: unknown): string[] {
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value.filter(p => object(p)?.type === "text" || object(p)?.type === "input_text").map(p => String(object(p)?.text ?? "")) : [];
}
/** 한 글 안에서 결과 JSON 을 찾는다 — 통째로, 아니면 줄 머리의 «{» 부터 줄 끝의 «}» 까지(앞·뒤에 알림 줄이 붙은 글). */
function resultJson(text: string): Record<string, unknown> | undefined {
  try { return object(JSON.parse(text)); } catch { /* 알림이 붙은 글 */ }
  const starts: number[] = text.startsWith("{") ? [0] : [];
  for (let at = text.indexOf("\n{"); at >= 0 && starts.length < 4; at = text.indexOf("\n{", at + 1)) starts.push(at + 1);
  const ends: number[] = text.trimEnd().endsWith("}") ? [text.trimEnd().length] : [];
  for (let at = text.lastIndexOf("}\n"); at >= 0 && ends.length < 4; at = text.lastIndexOf("}\n", at - 1)) ends.push(at + 1);
  for (const start of starts) for (const end of ends) {
    if (end <= start) continue;
    try { return object(JSON.parse(text.slice(start, end))); } catch { /* 다음 자리 */ }
  }
  return undefined;
}

/** Per Pi run. Inspect final provider payload, credit only after a successful assistant message.
 * Supports Responses/Chat Completions, Anthropic and Gemini native tool-result/image shapes.
 * Unknown/omitted/truncated transport is deliberately not reading evidence. */
export class PiTilesetReferenceGate {
  readonly evidence = new TilesetReferenceEvidence();
  private pending = new Map<string, ToolResult>();
  private outgoingResults: ToolResult[] = [];
  private outgoingImages = new Set<string>();
  beforeWrite(project: Project, name: string, args: Record<string, unknown>): ToolResult | null {
    return this.evidence.beforeWrite(project, name, args);
  }
  async read(project: Project, result: ToolResult): Promise<{ label: string; dataUrl: string }[]> {
    if (!result.ok) return [];
    this.pending.set(JSON.stringify(result.data), structuredClone(result));
    return this.evidence.imagesForRead(project, result);
  }
  /** 직전 read 에서 이미 전달돼 다시 싣지 않은 그림 이름. */
  get skippedImages(): readonly string[] { return this.evidence.skipped; }
  payload(value: unknown): void {
    this.outgoingResults = []; this.outgoingImages.clear();
    const consider = (output: unknown): void => {
      for (const text of textParts(output)) {
        const parsed = resultJson(text);
        if (parsed?.ok !== true || parsed.dataTruncated) continue;
        const pending = this.pending.get(JSON.stringify(parsed.data));
        if (pending && parsed.summary === pending.summary && !this.outgoingResults.includes(pending)) this.outgoingResults.push(pending);
      }
    };
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      const v = object(node); if (!v) return;
      if (v.type === "function_call_output" || v.type === "custom_tool_call_output") consider(v.output);
      if (v.role === "tool" || v.type === "tool_result") consider(v.content);
      const fn = object(v.functionResponse);
      if (fn?.name === "read_tileset_reference") consider(object(fn.response)?.output);
      const url = v.type === "input_image" ? v.image_url : v.type === "image_url" ? object(v.image_url)?.url : undefined;
      if (typeof url === "string") this.outgoingImages.add(url);
      const source = v.type === "image" ? object(v.source) : undefined;
      if (source?.type === "base64" && typeof source.media_type === "string" && typeof source.data === "string") this.outgoingImages.add(`data:${source.media_type};base64,${source.data}`);
      const inline = object(v.inlineData) ?? object(v.inline_data);
      const mime = inline?.mimeType ?? inline?.mime_type;
      if (typeof mime === "string" && typeof inline?.data === "string") this.outgoingImages.add(`data:${mime};base64,${inline.data}`);
      Object.values(v).forEach(child => { if (child && typeof child === "object") visit(child); });
    };
    visit(value);
  }
  complete(success: boolean): void {
    if (success) {
      this.outgoingResults.forEach(result => this.evidence.observe(result));
      this.evidence.observeImageUrls(this.outgoingImages);
    }
    this.outgoingResults = []; this.outgoingImages.clear();
  }
}
