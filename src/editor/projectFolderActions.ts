import { serialize } from "@/project/io";
import type { Project } from "@/project/types";

function startBridge(): NonNullable<Window["oprn"]>["start"] | undefined {
  return typeof window === "undefined" ? undefined : window.oprn?.start;
}

/**
 * 성공하면 데스크톱은 새 폴더를 열고 웹은 새 프로젝트 URL을 설정한다. 호출자는 `window.location.reload()`로 부팅한다.
 * 저장 브리지가 없는 정적 웹 미리보기는 false.
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
