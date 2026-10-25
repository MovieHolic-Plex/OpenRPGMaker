// «마지막 편집 화면» 그림 — 다음에 같은 프로젝트를 열 때 편집기가 부팅하는 동안 바로 보이는 읽기 전용 자리표시.
//
// 왜 (2026-10-25 실측, ~/claude-viz/app-startup-audit.html): 「계속」을 누른 뒤 편집기가 맵을 편집할 수 있게 되기까지
// 평소 9s, 새 빌드 첫 실행 38s 동안 화면에는 흰 로더만 있었다. 사용자는 «눌렀는데 아무것도 안 뜬다»로 본다.
// 부팅 자체를 줄이는 일과 별개로, 지난번 화면을 즉시 그려 두고 실제 편집기가 준비되면 바꿔 낀다(public/boot-splash.js).
//
// 언제 찍나: 편집기 창이 저장을 마친 뒤(디바운스·최소 간격) 그리고 창을 닫을 때(짧은 상한 안에서). 편집기 부팅이 끝난 화면만
// 찍는다 — 로더가 떠 있는 동안 찍으면 로더 그림이 다음 자리표시가 된다.
// 어디에: userData/last-view/<프로젝트 폴더 해시>.jpg + .json(projectDir·크기·시각). 다른 프로젝트 그림은 절대 돌려주지 않는다.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { app, type BrowserWindow } from "electron";

type LastViewMeta = { readonly projectDir: string; readonly width: number; readonly height: number; readonly savedAt: number };
export type LastView = LastViewMeta & { readonly dataUrl: string };

/** 그림 긴 변 상한. 자리표시라 원본 해상도가 필요 없고, IPC 로 넘길 dataURL 이 수백 KB 안에 든다. */
const MAX_WIDTH = 1600;
const JPEG_QUALITY = 80;
/** 저장 뒤 찍기까지 기다림(연속 저장을 한 번으로)과 두 번 찍기 사이 최소 간격. */
const SAVE_DEBOUNCE_MS = 1500;
const trace = (message: string): void => { if (process.env.OPRN_STARTUP_TRACE === "1") process.stderr.write(`[last-view] ${message}\n`); };
const MIN_INTERVAL_MS = 20_000;

function directory(): string {
  return join(app.getPath("userData"), "last-view");
}

function fileBase(projectDir: string): string {
  return join(directory(), createHash("sha1").update(projectDir).digest("hex").slice(0, 20));
}

/** 이 프로젝트의 마지막 편집 화면. 없거나 다른 프로젝트 것이면 null. */
export function readLastView(projectDir: string | null | undefined): LastView | null {
  if (!projectDir) return null;
  try {
    const base = fileBase(projectDir);
    if (!existsSync(`${base}.json`) || !existsSync(`${base}.jpg`)) return null;
    const meta = JSON.parse(readFileSync(`${base}.json`, "utf8")) as Partial<LastViewMeta>;
    if (meta.projectDir !== projectDir || typeof meta.width !== "number" || typeof meta.height !== "number") return null;
    const jpeg = readFileSync(`${base}.jpg`);
    return { projectDir, width: meta.width, height: meta.height, savedAt: Number(meta.savedAt) || 0, dataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}` };
  } catch {
    return null;
  }
}

/** 부팅을 마친 편집기 문서(webContents id). 렌더러가 로더를 걷을 때 알리고(resumeEditorReady), 문서를 떠나면 지운다. */
const settledEditors = new Set<number>();

export function markEditorSettled(webContentsId: number): void {
  settledEditors.add(webContentsId);
}

export function markEditorLeft(webContentsId: number): void {
  settledEditors.delete(webContentsId);
}

/** 편집기 문서가 부팅을 마쳤고(로더가 걷혔다) 화면에 보이는가. 시작 화면·로더·숨은 창은 찍지 않는다.
 * 렌더러에 묻지 않는다 — 닫기 직전 렌더러는 저장으로 바빠 executeJavaScript 가 상한 안에 돌아오지 않았다(실측). */
function editorIsSettled(window: BrowserWindow): boolean {
  return !window.isDestroyed() && window.isVisible() && !window.isMinimized() && settledEditors.has(window.webContents.id);
}

/** 지금 창을 찍어 이 프로젝트의 마지막 편집 화면으로 남긴다. 실패는 조용히 넘긴다(자리표시일 뿐이다). */
export async function captureLastView(window: BrowserWindow, projectDir: string): Promise<boolean> {
  const started = performance.now();
  if (!editorIsSettled(window)) { trace("skip: editor not settled or hidden"); return false; }
  try {
    let image = await window.webContents.capturePage();
    if (image.isEmpty()) return false;
    const size = image.getSize();
    if (size.width > MAX_WIDTH) image = image.resize({ width: MAX_WIDTH, quality: "good" });
    const { width, height } = image.getSize();
    mkdirSync(directory(), { recursive: true });
    const base = fileBase(projectDir);
    // 쓰는 도중 읽히지 않게 임시 파일 → 이름 바꾸기. 그림을 먼저, 짝 정보를 나중에 바꾼다(정보가 그림을 가리킨다).
    writeFileSync(`${base}.jpg.tmp`, image.toJPEG(JPEG_QUALITY));
    renameSync(`${base}.jpg.tmp`, `${base}.jpg`);
    const meta: LastViewMeta = { projectDir, width, height, savedAt: Date.now() };
    writeFileSync(`${base}.json.tmp`, JSON.stringify(meta));
    renameSync(`${base}.json.tmp`, `${base}.json`);
    trace(`saved ${width}x${height} in ${Math.round(performance.now() - started)}ms`);
    return true;
  } catch (error) {
    trace(`failed: ${String(error)}`);
    return false;
  }
}

/** 닫기 직전에 찍는다. 창은 곧 숨겨야 하므로 상한을 넘기면 기다리지 않는다(찍기는 뒤에서 마저 끝나도 된다). */
export function captureLastViewBeforeClose(window: BrowserWindow, projectDir: string, timeoutMs = 250): Promise<void> {
  return Promise.race([
    captureLastView(window, projectDir).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

const pending = new Map<number, ReturnType<typeof setTimeout>>();
const lastCaptured = new Map<number, number>();

/** 저장이 끝났다 — 잠시 뒤(연속 저장은 한 번으로, 최소 간격 지켜) 찍는다. */
export function scheduleLastViewAfterSave(window: BrowserWindow, projectDir: string): void {
  const id = window.webContents.id;
  const since = Date.now() - (lastCaptured.get(id) ?? 0);
  const wait = Math.max(SAVE_DEBOUNCE_MS, MIN_INTERVAL_MS - since);
  const previous = pending.get(id);
  if (previous) clearTimeout(previous);
  pending.set(id, setTimeout(() => {
    pending.delete(id);
    if (window.isDestroyed()) return;
    void captureLastView(window, projectDir).then((ok) => { if (ok) lastCaptured.set(id, Date.now()); });
  }, wait));
}

export function forgetLastViewWindow(webContentsId: number): void {
  settledEditors.delete(webContentsId);
  const timer = pending.get(webContentsId);
  if (timer) clearTimeout(timer);
  pending.delete(webContentsId);
  lastCaptured.delete(webContentsId);
}
