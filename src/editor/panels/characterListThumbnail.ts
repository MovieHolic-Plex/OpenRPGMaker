import {
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  CHARSET_SHEET_COLUMNS,
  CHARSET_SHEET_ROWS,
  charsetFrameSource,
  decodeCharsetFrameIndex,
} from "@/assets/easyrpgRtp";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { CharacterIdIndexEntry } from "@/project/characterIdIndex";
import type { EventPage, EventPageGraphic, GameEvent, Project } from "@/project/types";
import { el } from "@/util/dom";

const THUMB_SIZE = 32;

export type CharacterListThumbSource = {
  readonly resourceId: string;
  readonly characterIndex: number;
};

/**
 * Resolve charset list-thumb source for a character catalog entry.
 * Hosts[0] only (listCharacterIdIndex order). Never uses actor facesets/database.actors.
 */
export function resolveCharacterListThumbSource(
  project: Project,
  entry: CharacterIdIndexEntry
): CharacterListThumbSource | null {
  const host = entry.hosts[0];
  if (!host) return null;

  const event = project.maps[host.mapId]?.events.find((item) => item.id === host.eventId);
  if (!event) return null;

  const graphic = pickEventListGraphic(event);
  const resourceId = graphic?.sprite?.id?.trim();
  if (!resourceId) return null;

  let characterIndex = 0;
  try {
    characterIndex = decodeCharsetFrameIndex(graphic?.pattern ?? 0).characterIndex;
  } catch {
    characterIndex = 0;
  }

  return { resourceId, characterIndex };
}

/** Charset crop thumb for the characters database list (empty slot when unresolved). */
export function characterListThumbnail(project: Project, entry: CharacterIdIndexEntry): HTMLElement {
  const source = resolveCharacterListThumbSource(project, entry);
  if (!source) return emptySlot();

  const url = resolveAssetResourceUrl(source.resourceId, { project });
  if (!url) return emptySlot();

  const frame = charsetFrameSource({
    characterIndex: source.characterIndex,
    direction: "down",
    pattern: 1,
  });
  const scale = THUMB_SIZE / CHARSET_FRAME_HEIGHT;
  const label = entry.profile?.displayName?.trim() || entry.characterId;
  const slot = baseSlot("db-list-thumb-crop", `${label} 캐릭터`);
  slot.style.backgroundImage = `url("${url}")`;
  slot.style.backgroundPosition = `-${frame.x * scale}px -${frame.y * scale}px`;
  slot.style.backgroundSize = `${CHARSET_SHEET_COLUMNS * CHARSET_FRAME_WIDTH * scale}px ${
    CHARSET_SHEET_ROWS * CHARSET_FRAME_HEIGHT * scale
  }px`;
  slot.append(loadProbe(url, slot));
  return slot;
}

function pickEventListGraphic(event: GameEvent): EventPageGraphic | null {
  const pages = event.pages ?? [];
  const nonTransparent = firstPageGraphic(pages, (graphic) => hasCharsetSprite(graphic) && graphic.transparent !== true);
  if (nonTransparent) return nonTransparent;
  return firstPageGraphic(pages, hasCharsetSprite);
}

function firstPageGraphic(
  pages: readonly EventPage[],
  predicate: (graphic: EventPageGraphic) => boolean
): EventPageGraphic | null {
  for (const page of pages) {
    const graphic = page.graphic;
    if (graphic && predicate(graphic)) return graphic;
  }
  return null;
}

function hasCharsetSprite(graphic: EventPageGraphic): boolean {
  return Boolean(graphic.sprite?.id?.trim());
}

function baseSlot(extraClass: string, label: string): HTMLElement {
  return el("span", {
    class: `db-list-thumb ${extraClass}`,
    attrs: { "aria-label": label, role: "img" },
  });
}

function emptySlot(): HTMLElement {
  return el("span", { class: "db-list-thumb empty", attrs: { "aria-hidden": "true" } });
}

function loadProbe(url: string, slot: HTMLElement): HTMLElement {
  const probe = el("img", { class: "db-list-thumb-probe", attrs: { alt: "", "aria-hidden": "true", src: url } });
  probe.addEventListener("error", () => markEmpty(slot), { once: true });
  return probe;
}

function markEmpty(slot: HTMLElement): void {
  slot.classList.add("empty");
  slot.style.backgroundImage = "";
  slot.replaceChildren();
  slot.setAttribute("aria-hidden", "true");
  if ("removeAttribute" in slot) {
    slot.removeAttribute("aria-label");
    slot.removeAttribute("role");
  }
}
