import { deserialize, serializePretty } from "@/project/io";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import type { Project } from "@/project/types";
import {
  readStoredZipEntry,
  readStoredZipEntryNames,
  writeStoredZip,
  ZipFormatError,
  type ZipEntry,
} from "./packageZip";

export const OPRN_EXTENSION = ".oprn";
export const OPRN_MIME = "application/vnd.openrpg.project+zip";
export const LEGACY_RPGZZU_EXTENSION = ".rpgzzu";
export const LEGACY_RPGZZU_MIME = "application/vnd.rpgzzu.project+zip";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class ProjectPackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectPackageError";
  }
}

export function projectPackageFileName(project: Project): string {
  return `${safeFileName(project.meta.title || "oprn-project")}${OPRN_EXTENSION}`;
}

export function createProjectPackage(project: Project): Blob {
  return writeStoredZip(createProjectPackageEntries(projectWithoutEventDrafts(project)));
}

export async function readProjectPackage(file: Blob): Promise<Project> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const projectEntry = readPackageEntry(bytes, "project.json");
  if (!projectEntry) throw new ProjectPackageError("project.json entry is missing");
  return deserialize(decoder.decode(projectEntry));
}

export async function readProjectPackageEntryNames(file: Blob): Promise<readonly string[]> {
  try {
    return readStoredZipEntryNames(new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof ZipFormatError) throw new ProjectPackageError(error.message);
    throw error;
  }
}

function createProjectPackageEntries(project: Project): readonly ZipEntry[] {
  const maps = Object.values(project.maps).sort((a, b) => a.id.localeCompare(b.id));
  return [
    textEntry("project.json", serializePretty(project)),
    jsonEntry("data/meta.json", project.meta),
    jsonEntry("data/database.json", project.database),
    jsonEntry("data/system.json", project.system),
    jsonEntry("data/switches.json", project.switches),
    jsonEntry("data/variables.json", project.variables),
    jsonEntry("data/common-events.json", project.commonEvents),
    jsonEntry("data/tilesets.json", project.tilesets),
    jsonEntry("data/assets.json", project.assets),
    jsonEntry("data/resource-profiles.json", project.resourceProfiles),
    jsonEntry("metadata/ai-tile-labels.json", createAiTileMetadata(project)),
    jsonEntry("maps/mapTree.json", project.mapTree),
    ...maps.map((map) => jsonEntry(`maps/${safeFileName(map.id)}.json`, map)),
  ];
}

function createAiTileMetadata(project: Project): unknown {
  return Object.fromEntries(
    Object.values(project.tilesets).map((tileset) => [
      tileset.id,
      {
        name: tileset.name,
        tileSize: tileset.tileSize,
        tilesPerRow: tileset.tilesPerRow,
        count: tileset.count,
        tileMeta: tileset.tileMeta ?? [],
        tileGroups: tileset.tileGroups ?? [],
      },
    ])
  );
}

function readPackageEntry(bytes: Uint8Array, name: string): Uint8Array | null {
  try {
    return readStoredZipEntry(bytes, name);
  } catch (error) {
    if (error instanceof ZipFormatError) throw new ProjectPackageError(error.message);
    throw error;
  }
}

function jsonEntry(name: string, value: unknown): ZipEntry {
  return textEntry(name, JSON.stringify(value, null, 2));
}

function textEntry(name: string, text: string): ZipEntry {
  return { name, bytes: encoder.encode(text) };
}

function safeFileName(value: string): string {
  const safe = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-").replace(/\s+/g, "-");
  return safe || "oprn-project";
}
