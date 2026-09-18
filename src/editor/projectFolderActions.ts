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
  if (!bridge) {
    if (!("showDirectoryPicker" in window)) return false;
    const directory = await (window as Window & { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
    let hasSqlite = false;
    try {
      await directory.getFileHandle("project.sqlite");
      hasSqlite = true;
    } catch {
      hasSqlite = false;
    }
    if (hasSqlite) {
      throw new Error("이 미리보기에는 저장 브리지가 없습니다. SQLite 프로젝트는 웹 호스트(예: mdc-server:9888)에서 여세요.");
    }
    try {
      const file = await (await directory.getFileHandle("project.json")).getFile();
      const project = JSON.parse(await file.text()) as Project;
      if (!project || typeof project !== "object" || !project.meta) throw new Error("선택한 폴더에 올바른 project.json이 없습니다.");
      const { store } = await import("@/project/store");
      store.replaceProject(project);
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes("올바른 project.json")) throw error;
      throw new Error("선택한 폴더에서 project.sqlite 또는 project.json을 찾지 못했습니다.");
    }
  }
  const opened = await bridge.openFolder();
  return opened !== null;
}
