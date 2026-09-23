import { referenceOwner, referenceRevision, REFERENCE_PAGE_SIZE } from "@/project/tilesetReferences";
import type { Project } from "@/project/types";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { TILESET_REFERENCE_WRITERS } from "@/editor/tools/tilesetReferenceTools";
import type { ToolResult } from "@/editor/tools/types";
import { DUNGEON_ROOM_TILESET_ID } from "@/editor/dungeonRoomPipeline";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { loadRoomSession } from "@/editor/roomHarness/engine";
import { defaultOutdoorTilesetId } from "@/project/defaults/forestHarmony";
import type { ChatMessage } from "./llmClient";
import type { ImageDelivery } from "./imageDelivery";

type Packet = { tilesetId: string; ownerId: string; categoryId: string; revision: string;
  document?: { id: string; offset: number }; image?: { id: string; name: string; caption: string } };
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
    if (data.document) this.pages.add(`${key(data)}:doc:${data.document.id}:${data.document.offset}`);
    if (data.image) this.imageMetadata.add(`${key(data)}:image:${data.image.id}`);
  }
  imagesForRead(project: Project, result: ToolResult): { label: string; dataUrl: string }[] {
    if (!result.ok || !result.data) return [];
    const data = result.data as Packet;
    const category = project.tilesets[data.ownerId]?.referenceDocuments?.find(g => g.id === data.categoryId);
    const image = category?.images.find(i => i.id === data.image?.id);
    if (!category || !image || referenceRevision(category) !== data.revision) return [];
    this.pendingImages.set(`${key(data)}:image:${image.id}`, image.dataUrl);
    return [{ label: `타일셋 참고 이미지 (${category.name}): ${image.name}\n${image.caption}`, dataUrl: image.dataUrl }];
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
  beforeWrite(project: Project, name: string, args: Record<string, unknown>): ToolResult | null {
    if (!TILESET_REFERENCE_WRITERS.has(name)) return null;
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
    if (name === "create_map" && !ids.size) ids.add(DEFAULT_TILESET_ID);
    if (!ids.size) { const implicit = implicitWriterTilesetId(project, name, args); if (implicit) ids.add(implicit); }
    // Session/design writers may resolve their map internally. Unknown scope must not bypass reading.
    if (!ids.size) for (const tileset of Object.values(project.tilesets)) {
      if (tileset.referenceDocuments?.length || tileset.referenceSourceTilesetId) ids.add(tileset.id);
    }
    const missing: string[] = [];
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
      for (const doc of group.documents) {
        for (let offset = 0; offset < Math.max(1, doc.markdown.length); offset += REFERENCE_PAGE_SIZE) {
          if (!this.pages.has(`${base}:doc:${doc.id}:${offset}`)) missing.push(`read_tileset_reference(tilesetId:"${id}", categoryId:"${group.id}", documentId:"${doc.id}", offset:${offset})`);
        }
      }
      for (const image of group.images) {
        const imageKey = `${base}:image:${image.id}`;
        if (!this.images.has(imageKey) || !this.imageMetadata.has(imageKey)) missing.push(`read_tileset_reference(tilesetId:"${id}", categoryId:"${group.id}", imageId:"${image.id}") — 이미지 입력 전달 필요`);
      }
    }
    if (!missing.length) return null;
    const summary = `타일셋 참고문서 선행 읽기 필요 (${missing.length}건): ${missing.slice(0, 6).join("; ")}. list_tileset_references로 전체 목록을 확인하고 MD 모든 페이지와 이미지를 읽으세요. 조회와 배치를 같은 응답에 호출하지 말고, 자료를 전달받은 다음 응답에서 배치하세요. 프로젝트는 변경하지 않았습니다.`;
    return { ok: false, summary, issues: [{ severity: "error", code: "tileset-reference-read-required", message: summary }] };
  }
}

/**
 * 새 맵을 스스로 만드는 저작 도구가 **실제로 쓸** 타일셋. 인자에 기존 mapId·tilesetId 가 없을 때 쓴다.
 * 이걸 모르면 아래 「모든 타일셋」 폴백이 걸려, 새 던전 하나를 만들려는 run_dungeon_room_pipeline 이
 * 숲마을·소품 칩셋까지 128건 읽기를 요구했다 — 모델은 던전 파이프라인을 포기하고 빈 맵에 바닥만 칠하거나
 * 이미 있는 집 실내 맵 이름을 바꿔 던전·보스방으로 썼다(2026-09-23 도그푸딩 「등대지기의 겨울」, 헤드리스 재현).
 */
function implicitWriterTilesetId(project: Project, name: string, args: Record<string, unknown>): string | undefined {
  if (typeof args.sessionId === "string") {
    const session = loadRoomSession(project, args.sessionId);
    const map = session ? project.maps[session.mapId] : undefined;
    if (map) return map.tilesetId;
  }
  switch (name) {
    case "run_dungeon_room_pipeline":
    case "start_dungeon_room_session":
      return DUNGEON_ROOM_TILESET_ID;
    case "run_interior_room_pipeline":
    case "start_interior_room_session":
      return INTERIOR_ROOM_TILESET_ID;
    case "generate_map":
      return args.theme === "cave" ? DUNGEON_ROOM_TILESET_ID : defaultOutdoorTilesetId(project);
    default:
      return undefined;
  }
}
