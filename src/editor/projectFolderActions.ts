import { serialize } from "@/project/io";
import type { Project } from "@/project/types";

function startBridge(): NonNullable<Window["oprn"]>["start"] | undefined {
  return typeof window === "undefined" ? undefined : window.oprn?.start;
}

/**
 * 성공하면 주 프로세스가 이미 그 폴더를 열어 두었다 — 호출자는 `window.location.reload()` 로 그 폴더에 부팅해야 한다.
 * 브리지가 없으면(웹 QA 하네스) false.
 */
export async function createProjectFolderWithSeed(title: string, seed: Project): Promise<boolean> {
  const bridge = startBridge();
  if (!bridge) return false;
  const created = await bridge.createProject({ title, seed: serialize(seed) });
  return created !== null;
}

/** 기존 폴더를 고르게 한다. 성공 뒤에도 같은 리로드 규칙이 적용된다. */
export async function openProjectFolder(): Promise<boolean> {
  const bridge = startBridge();
  if (!bridge) return false;
  const opened = await bridge.openFolder();
  return opened !== null;
}
