// 앱 자동 업데이트의 공용 모양과 순수 판단. 메인(electron/main/appUpdate.ts)·프리로드·렌더러 칩(src/app/appUpdateChip.ts)이 같이 본다.
//
// 흐름(오너 승인 2026-11-24, 「사용자는 많은 버튼을 원하지 않는다」):
//   시작 뒤와 6시간마다 조용히 확인 → 뒤에서 내려받기 → 다 받으면 상단에 칩 하나 「v0.x 준비됨 · 다시 시작」.
//   누르면 저장 후 재시작(조수가 일하는 중이면 끝날 때까지 기다림). 안 누르면 앱을 끌 때 설치한다.
//   portable exe 는 스스로 바꿀 수 없어 「새 버전 있음 · 내려받기」 링크만 준다.

/** auto = 내려받고 설치까지(NSIS 설치판·AppImage), manual = 알리기만(portable), off = 확인하지 않음(개발 실행·맥·설치 형태 모름). */
export type AppUpdateMode = "auto" | "manual" | "off";

export type AppUpdateState =
  | { readonly kind: "idle" }
  | { readonly kind: "downloading"; readonly version: string }
  | { readonly kind: "ready"; readonly version: string }
  | { readonly kind: "available"; readonly version: string; readonly downloadUrl: string };

export interface AppUpdateStatus {
  readonly mode: AppUpdateMode;
  readonly enabled: boolean;
  readonly currentVersion: string;
  readonly state: AppUpdateState;
}

export interface AppUpdateWhatsNew {
  readonly version: string;
  readonly lines: readonly string[];
}

export const APP_UPDATE_REPO = { owner: "MovieHolic-Plex", repo: "OpenRPGMaker" } as const;
export const APP_UPDATE_FIRST_CHECK_MS = 15_000;
export const APP_UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * 이 실행이 스스로 업데이트할 수 있는가. 판정은 설치 형태로만 한다.
 * - 윈도: electron-builder portable 은 실행할 때 PORTABLE_EXECUTABLE_FILE 을 넣는다 → manual. 그 밖의 패키지 실행은 NSIS 설치판이다.
 * - 리눅스: AppImage 런타임이 APPIMAGE 를 넣는다. 없으면(압축 푼 폴더·deb 등) 바꿀 파일이 없다.
 * - 맥: 서명 없는 앱은 자동 업데이트가 안 된다(Squirrel.Mac 이 서명을 요구). 지금 맥 배포도 없다.
 */
export function appUpdateModeFor(input: {
  readonly platform: NodeJS.Platform | string;
  readonly isPackaged: boolean;
  readonly env: Readonly<Record<string, string | undefined>>;
}): AppUpdateMode {
  if (!input.isPackaged) return "off";
  if (input.platform === "win32") return input.env.PORTABLE_EXECUTABLE_FILE ? "manual" : "auto";
  if (input.platform === "linux") return input.env.APPIMAGE ? "auto" : "off";
  return "off";
}

/** portable 사용자가 누를 링크 — 그 판의 portable exe 를 바로 받는다(고정 이름은 릴리스 워크플로가 붙인다). */
export function portableDownloadUrl(version: string): string {
  const plain = String(version).replace(/^v/, "");
  return `https://github.com/${APP_UPDATE_REPO.owner}/${APP_UPDATE_REPO.repo}/releases/download/v${plain}/OPRN.Studio-windows.exe`;
}

export function appUpdateChipText(state: AppUpdateState): string | null {
  switch (state.kind) {
    case "ready": return `v${shortVersion(state.version)} 준비됨 · 다시 시작`;
    case "available": return `새 버전 있음 · 내려받기`;
    default: return null;
  }
}

export function shortVersion(version: string): string {
  const plain = String(version).replace(/^v/, "");
  return plain.replace(/^(\d+\.\d+)\.0$/, "$1");
}

/**
 * 릴리스 본문(GitHub 피드의 HTML, 또는 마크다운)에서 재시작 뒤 보일 짧은 줄 몇 개를 뽑는다.
 * 「주요 변경」 절이 있으면 그 절의 항목을, 없으면 본문의 첫 항목들을 쓴다. 항목이 없으면 빈 배열.
 */
export function summarizeReleaseNotes(notes: unknown, max = 3): string[] {
  const text = releaseNotesText(notes);
  if (!text) return [];
  const lines = text.split("\n").map((line) => line.trim());
  const headingIndex = lines.findIndex((line) => /^(#{1,6}\s*)?주요 변경/.test(line));
  const start = headingIndex >= 0 ? headingIndex + 1 : 0;
  const items: string[] = [];
  for (let index = start; index < lines.length && items.length < max; index += 1) {
    const line = lines[index];
    if (headingIndex >= 0 && /^#{1,6}\s/.test(line)) break;
    const match = /^(?:[-*•]|\d+\.)\s+(.+)$/.exec(line);
    if (!match) continue;
    const item = match[1].replace(/\s*\(#\d+\)\s*$/, "").replace(/\*\*/g, "").trim();
    if (item) items.push(item.length > 70 ? `${item.slice(0, 69)}…` : item);
  }
  return items;
}

function releaseNotesText(notes: unknown): string {
  if (typeof notes === "string") return htmlToLines(notes);
  // fullChangelog 일 때 electron-updater 는 [{ version, note }] 를 준다. 가장 새 것 하나만 본다.
  if (Array.isArray(notes) && notes.length > 0) {
    const first = notes[0] as { note?: unknown };
    return typeof first?.note === "string" ? htmlToLines(first.note) : "";
  }
  return "";
}

function htmlToLines(source: string): string {
  if (!/<[a-z][\s\S]*>/i.test(source)) return source;
  return source
    .replace(/<h([1-6])[^>]*>/gi, (_m, level: string) => `\n${"#".repeat(Number(level))} `)
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(li|p|ul|ol|div)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'");
}
