import { ProjectFormatError } from "@/project/io";
import {
  LEGACY_RPGZZU_EXTENSION,
  LEGACY_RPGZZU_MIME,
  ProjectPackageError,
  readProjectPackage,
  OPRN_EXTENSION,
  OPRN_MIME,
} from "@/project/package";
import type { Project } from "@/project/types";

export const OPRN_GAME_FILE_ACCEPT = [
  OPRN_MIME,
  LEGACY_RPGZZU_MIME,
  OPRN_EXTENSION,
  LEGACY_RPGZZU_EXTENSION,
].join(",");

export type OprnGameFileRead =
  | { readonly ok: true; readonly project: Project }
  | { readonly ok: false; readonly message: string };

export function isOprnGameFile(file: Pick<File, "name" | "type">): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(OPRN_EXTENSION)
    || name.endsWith(LEGACY_RPGZZU_EXTENSION)
    || file.type === OPRN_MIME
    || file.type === LEGACY_RPGZZU_MIME
  );
}

export function pickOprnGameFile(files: readonly File[]): File | null {
  return files.find((file) => isOprnGameFile(file)) ?? null;
}

export async function readOprnGameFile(file: Blob): Promise<OprnGameFileRead> {
  try {
    return { ok: true, project: await readProjectPackage(file) };
  } catch (error) {
    return { ok: false, message: oprnGameFileErrorMessage(error) };
  }
}

function oprnGameFileErrorMessage(error: unknown): string {
  if (error instanceof ProjectPackageError) return `게임 파일이 손상되었습니다: ${error.message}`;
  if (error instanceof ProjectFormatError) return `게임 데이터를 읽을 수 없습니다: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}
