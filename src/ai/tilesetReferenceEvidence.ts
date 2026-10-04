import { referenceOwner, referencePageStarts, referenceRevision } from "@/project/tilesetReferences";
import { resolveReferenceImageDataUrl } from "@/project/bundledReferenceImages";
import type { Project } from "@/project/types";
import { TILESET_REFERENCE_TILE_CHOOSERS, terrainStampSource } from "@/editor/tools/tilesetReferenceTools";
import type { ToolResult } from "@/editor/tools/types";
import type { ChatMessage } from "./llmClient";
import type { ImageDelivery } from "./imageDelivery";

type Packet = { tilesetId: string; ownerId: string; categoryId: string; revision: string;
  document?: { id: string; offset: number }; image?: { id: string; name: string; caption: string };
  /** 한꺼번에 읽기(read_tileset_reference 에 documentId·imageId 없음): 쪽 여러 개·이미지 여러 장. */
  documents?: readonly { id: string; offset: number }[]; images?: readonly { id: string; name: string; caption: string }[] };
const key = (data: Packet) => JSON.stringify([data.ownerId, data.categoryId, data.revision]);

/** Text receipts are credited by ToolReadEvidence only after exact writer delivery.
 * Images additionally require provider acknowledgment of the actual outgoing image part. */
export class TilesetReferenceEvidence {
  private pages = new Set<string>();
  private imageMetadata = new Set<string>();
  private images = new Set<string>();
  private pendingImages = new Map<string, string>();
  clear(): void { this.pages.clear(); this.imageMetadata.clear(); this.images.clear(); this.pendingImages.clear(); }
  observe(result: ToolResult): void {
    if (!result.ok || !result.data) return;
    const data = result.data as Packet;
    for (const document of [...(data.document ? [data.document] : []), ...(data.documents ?? [])]) this.pages.add(`${key(data)}:doc:${document.id}:${document.offset}`);
    for (const image of [...(data.image ? [data.image] : []), ...(data.images ?? [])]) this.imageMetadata.add(`${key(data)}:image:${image.id}`);
  }
  async imagesForRead(project: Project, result: ToolResult): Promise<{ label: string; dataUrl: string }[]> {
    if (!result.ok || !result.data) return [];
    const data = result.data as Packet;
    const category = project.tilesets[data.ownerId]?.referenceDocuments?.find(g => g.id === data.categoryId);
    if (!category || referenceRevision(category) !== data.revision) return [];
    const wanted = [...(data.image ? [data.image.id] : []), ...(data.images ?? []).map(image => image.id)];
    const out: { label: string; dataUrl: string }[] = [];
    for (const id of wanted) {
      const image = category.images.find(i => i.id === id);
      if (!image) continue;
      const dataUrl = await resolveReferenceImageDataUrl(image.dataUrl);
      this.pendingImages.set(`${key(data)}:image:${image.id}`, dataUrl);
      out.push({ label: `타일셋 참고 이미지 (${category.name}): ${image.name}\n${image.caption}`, dataUrl });
    }
    return out;
  }
  observeImages(messages: readonly ChatMessage[], delivered: readonly ImageDelivery[] | undefined): void {
    const urls = new Set((delivered ?? []).flatMap(({ messageIndex, partIndex }) => {
      const parts = messages[messageIndex]?.content;
      const part = Array.isArray(parts) ? parts[partIndex] : undefined;
      return part?.type === "image_url" ? [part.image_url.url] : [];
    }));
    this.observeImageUrls(urls);
  }
  observeImageUrls(urls: ReadonlySet<string>): void {
    for (const [id, url] of this.pendingImages) if (urls.has(url)) { this.images.add(id); this.pendingImages.delete(id); }
  }
  /** 타일을 직접 고르는 도구만 막는다(TILESET_REFERENCE_TILE_CHOOSERS). 빈 맵 생성·결정론 파이프라인은 문서를 읽어도 결과가 같다. */
  beforeWrite(project: Project, name: string, args: Record<string, unknown>): ToolResult | null {
    const stampSource = terrainStampSource(project, name, args);
    if (!TILESET_REFERENCE_TILE_CHOOSERS.has(name) && !stampSource) return null;
    const ids = new Set<string>();
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) { value.forEach(visit); return; }
      if (!value || typeof value !== "object") return;
      for (const [field, child] of Object.entries(value)) {
        if (field === "tilesetId" && typeof child === "string") ids.add(child);
        if (["mapId", "sourceMapId", "targetMapId"].includes(field) && typeof child === "string" && project.maps[child]) ids.add(project.maps[child]!.tilesetId);
        if (child && typeof child === "object") visit(child);
      }
    };
    visit(args);
    // Grafted kits choose their source artwork, not target-sheet tile numbers.
    if (stampSource) { ids.clear(); ids.add(stampSource); }
    // Session/design writers may resolve their map internally. Unknown scope must not bypass reading.
    if (!ids.size) for (const tileset of Object.values(project.tilesets)) {
      if (tileset.referenceDocuments?.length || tileset.referenceSourceTilesetId) ids.add(tileset.id);
    }
    const missing: string[] = [];
    /** 빠진 것이 있는 용도마다 한 번에 읽는 호출 — 낱장 목록보다 먼저 보여 준다. */
    const bundles = new Set<string>();
    const visitedOwners = new Set<string>();
    for (const id of ids) {
      const tileset = project.tilesets[id];
      if (!tileset) continue;
      let owner;
      try { owner = referenceOwner(project, tileset); } catch { missing.push(`${id}: 참고문서 원본 오류`); continue; }
      if (visitedOwners.has(owner.id)) continue;
      visitedOwners.add(owner.id);
      const groups = owner.referenceDocuments ?? [];
      if (!groups.length) continue;
      const group = args.referencePurpose === undefined && groups.length === 1 ? groups[0] : groups.find(g => g.id === args.referencePurpose);
      if (!group) { missing.push(`${id}: referencePurpose에 용도 ID 지정 (${groups.map(g => `${g.id}=${g.name}`).join(", ")})`); continue; }
      const packet: Packet = { tilesetId: id, ownerId: owner.id, categoryId: group.id, revision: referenceRevision(group) };
      const base = key(packet);
      const before = missing.length;
      for (const doc of group.documents) {
        for (const offset of referencePageStarts(doc.markdown)) {
          if (!this.pages.has(`${base}:doc:${doc.id}:${offset}`)) missing.push(`read_tileset_reference(tilesetId:"${id}", categoryId:"${group.id}", documentId:"${doc.id}", offset:${offset})`);
        }
      }
      for (const image of group.images) {
        const imageKey = `${base}:image:${image.id}`;
        if (!this.images.has(imageKey) || !this.imageMetadata.has(imageKey)) missing.push(`read_tileset_reference(tilesetId:"${id}", categoryId:"${group.id}", imageId:"${image.id}") — 이미지 입력 전달 필요`);
      }
      if (missing.length > before) bundles.add(`read_tileset_reference({tilesetId:"${id}", categoryId:"${group.id}"})`);
    }
    if (!missing.length) return null;
    const oneCall = bundles.size ? ` 한 번에 읽기: ${[...bundles].join(", ")} — documentId·imageId 를 빼면 그 용도의 이미지 전부와 MD 를 한 응답에 받는다(남은 쪽이 있으면 응답의 after 를 넘겨 한 번 더).` : "";
    const summary = `타일셋 참고문서 선행 읽기 필요 (${missing.length}건).${oneCall} 빠진 것: ${missing.slice(0, 6).join("; ")}. 조회와 배치를 같은 응답에 호출하지 말고, 자료를 전달받은 다음 응답에서 배치하세요. 프로젝트는 변경하지 않았습니다.`;
    return { ok: false, summary, issues: [{ severity: "error", code: "tileset-reference-read-required", message: summary }] };
  }
}
