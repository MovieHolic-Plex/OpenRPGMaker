// editor/projectCover.ts
// 시작 화면 최근 목록 카드 그림(<프로젝트 폴더>/cover.jpg)을 남긴다.
//
// 정본이 아니라 캐시다: 시작 맵을 480×300 으로 구워 호스트에 보낸다. 부팅 몇 초 뒤 한 번(이 기능 이전에 만든
// 프로젝트도 한 번 열면 그림이 생긴다), 그 뒤로는 저장이 끝날 때마다 — 단 1분에 한 번까지만 굽는다.
// 데스크톱 앱(saveCover 가 있는 브리지)의 로컬 폴더에서만 돈다. 실패는 조용히 넘긴다 — 저장을 막을 이유가 없다.

import { loadTilesetImage } from "@/editor/mapTileDraw";
import { renderMapCoverJpeg } from "@/editor/mapCoverRender";
import { projectRepository } from "@/project/persistence/repository";
import { isLocalTarget } from "@/project/persistence/target";
import { store } from "@/project/store";
import { PROJECT_COVER_HEIGHT, PROJECT_COVER_WIDTH } from "../../electron/shared/start";

const FIRST_CAPTURE_DELAY_MS = 4_000;
const MIN_INTERVAL_MS = 60_000;

let installed = false;
let lastSent: string | null = null;
let lastAt = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;

async function captureNow(): Promise<void> {
  if (running) return;
  const saveCover = window.oprn?.project.saveCover;
  const target = projectRepository().currentTarget();
  if (!saveCover || !target || !isLocalTarget(target)) return;
  running = true;
  try {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId] ?? Object.values(project.maps)[0];
    const tileset = map ? project.tilesets[map.tilesetId] : undefined;
    if (!map || !tileset) return;
    const focus = map.id === project.startMapId ? project.startPos : undefined;
    const image = await loadTilesetImage(tileset);
    if ("complete" in image && (!image.complete || image.naturalWidth === 0)) return;
    const dataUrl = renderMapCoverJpeg(map, tileset, image, PROJECT_COVER_WIDTH, PROJECT_COVER_HEIGHT, focus);
    lastAt = Date.now();
    if (!dataUrl || dataUrl === lastSent) return;
    await saveCover({ projectDir: target.projectDir, dataUrl });
    lastSent = dataUrl;
  } catch (error) {
    console.warn("[cover] 시작 화면 대표 그림을 남기지 못했습니다:", error);
  } finally {
    running = false;
  }
}

function schedule(delayMs: number): void {
  if (timer !== null) return;
  timer = setTimeout(() => {
    timer = null;
    void captureNow();
  }, delayMs);
}

export function installProjectCoverCapture(): void {
  if (installed || typeof window === "undefined" || !window.oprn?.project.saveCover) return;
  installed = true;
  schedule(FIRST_CAPTURE_DELAY_MS);
  store.subscribeAutoSave((state) => {
    if (state.kind !== "saved") return;
    schedule(Math.max(0, lastAt + MIN_INTERVAL_MS - Date.now()));
  });
}
