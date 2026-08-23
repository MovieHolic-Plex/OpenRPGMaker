import { readFile, stat } from "node:fs/promises";

export async function readTextFile(filePath, label) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} could not be read: ${reason}`);
  }
}

export async function fileMetadata(filePath) {
  const info = await stat(filePath);
  return {
    path: filePath,
    exists: true,
    bytes: info.size,
  };
}
