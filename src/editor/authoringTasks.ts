import { activateLeftDrawerTab } from "@/editor/leftDrawerTab";
import { openDatabaseModal } from "@/editor/panels/databaseModal";
import { setWorkspacePreset } from "@/editor/workspace/workspaceStore";

export type AuthoringTaskId = "map" | "event" | "data" | "test";

export type AuthoringTask = {
  readonly id: AuthoringTaskId;
  readonly label: string;
  readonly hint: string;
  readonly keywords: readonly string[];
};

export const AUTHORING_TASKS: readonly AuthoringTask[] = [
  { id: "map", label: "맵", hint: "타일 도구와 맵 작업 화면 열기", keywords: ["map", "tile", "맵", "타일"] },
  { id: "event", label: "이벤트", hint: "이벤트 레이어와 배치 도구 열기", keywords: ["event", "scene", "이벤트", "장면"] },
  { id: "data", label: "데이터", hint: "데이터베이스 열기", keywords: ["data", "database", "db", "데이터", "자료"] },
  { id: "test", label: "테스트", hint: "현재 프로젝트 시연 실행", keywords: ["test", "play", "run", "테스트", "시연"] },
] as const;

/** Topbar and command palette share this single real-action boundary. */
export function runAuthoringTask(id: AuthoringTaskId): void {
  if (id === "map") {
    setWorkspacePreset("map");
    activateLeftDrawerTab("tile");
    return;
  }
  if (id === "event") {
    setWorkspacePreset("event");
    activateLeftDrawerTab("event");
    return;
  }
  if (id === "data") {
    setWorkspacePreset("data");
    openDatabaseModal();
    return;
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("oprn:test-play-window"));
}
