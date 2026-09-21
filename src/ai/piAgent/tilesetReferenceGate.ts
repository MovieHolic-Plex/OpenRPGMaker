import { TilesetReferenceEvidence } from "../tilesetReferenceEvidence";
import type { Project } from "@/project/types";
import type { ToolResult } from "@/editor/tools/types";

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
function textContent(value: unknown): string {
  if (typeof value === "string") return value;
  return Array.isArray(value) ? value.filter(p => object(p)?.type === "text" || object(p)?.type === "input_text").map(p => object(p)?.text ?? "").join("\n") : "";
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
  read(project: Project, result: ToolResult): { label: string; dataUrl: string }[] {
    if (!result.ok) return [];
    this.pending.set(JSON.stringify(result.data), structuredClone(result));
    return this.evidence.imagesForRead(project, result);
  }
  payload(value: unknown): void {
    this.outgoingResults = []; this.outgoingImages.clear();
    const consider = (text: string): void => {
      let parsed: Record<string, unknown> | undefined;
      try { parsed = object(JSON.parse(text)); } catch { return; }
      if (parsed?.ok !== true || parsed.dataTruncated) return;
      const pending = this.pending.get(JSON.stringify(parsed.data));
      if (pending && parsed.summary === pending.summary) this.outgoingResults.push(pending);
    };
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      const v = object(node); if (!v) return;
      if (v.type === "function_call_output" || v.type === "custom_tool_call_output") consider(textContent(v.output));
      if (v.role === "tool" || v.type === "tool_result") consider(textContent(v.content));
      const fn = object(v.functionResponse);
      if (fn?.name === "read_tileset_reference") consider(textContent(object(fn.response)?.output));
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
