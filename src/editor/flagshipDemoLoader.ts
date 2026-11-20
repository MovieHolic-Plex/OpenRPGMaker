import type { FlagshipDemoId } from "@/project/flagship/types";
import type { Project } from "@/project/types";
import { dismissToastsByKey, toast } from "@/util/toast";
import { createLogger } from "@/util/logger";

/**
 * 대표 데모(폴른 스타 등)를 편집기에서 여는 모든 경로의 공용 입구.
 *
 * 왜: 메뉴·컨셉 피드 «열기/플레이»가 브라우저에서 createFlagshipDemoProject 로 모든 맵을 다시 짓고 있었다
 * (약 15MB JS + 메인 스레드 5~130초, chrono-bell 131초 — 탭이 멈춘다). 빌드(npm run bake:demos)가 이미
 * dist/demos/<id>.project.json 으로 구워 두므로 그 파일을 앱 기준 주소로 읽는다(Electron·웹 공통).
 * 데스크톱 패키지도 굽는다(desktop-release.yml·release-desktop.mjs·npm run package — 2026-10-27 전에는 빠져 있어
 * 데스크톱 앱에서 폴른 스타가 「데모를 열지 못했습니다」로 끝났다). 구운 파일이 없을 때만 빌더로 짓는다.
 */

export interface LoadedFlagshipDemo {
  readonly project: Project;
  readonly title: string;
  readonly source: "baked" | "built";
  readonly elapsedMs: number;
}

export const FLAGSHIP_DEMO_LOAD_FAILURE = "앱에 포함된 예제 데이터를 불러오지 못했습니다.";
const log = createLogger("demo");

/** 구운 편집용 프로젝트를 읽는다. dev 서버·파일 없음·SPA HTML 폴백이면 null. */
async function loadBakedFlagshipDemo(id: FlagshipDemoId): Promise<Project | null> {
  if (import.meta.env.DEV) return null;
  try {
    const response = await fetch(new URL(`demos/${id}.project.json`, document.baseURI));
    // 정적 호스트의 SPA 폴백(HTML 200)은 구운 파일이 아니다. 데스크톱 app:// 은 file: 로 흘려 content-type 이
    // 비어 올 수 있어 «HTML 이 아닐 때» JSON 파싱을 시도한다.
    if (!response.ok || (response.headers.get("content-type") ?? "").includes("html")) return null;
    const { preloadBundledTilesetDefinitions } = await import("@/project/defaults/defaultAssets");
    const { deserializeParsed } = await import("@/project/io");
    const data: unknown = await response.json();
    const tilesets = (data as { tilesets?: unknown } | null)?.tilesets;
    if (tilesets && typeof tilesets === "object") await preloadBundledTilesetDefinitions(Object.keys(tilesets));
    return deserializeParsed(data);
  } catch (error) {
    log.warn("구운 데모를 읽지 못해 직접 짓습니다.", error);
    return null;
  }
}

export async function loadFlagshipDemoProject(id: FlagshipDemoId): Promise<LoadedFlagshipDemo> {
  const started = performance.now();
  const baked = await loadBakedFlagshipDemo(id);
  if (baked) {
    return { project: baked, title: baked.meta.title, source: "baked", elapsedMs: performance.now() - started };
  }
  // 빌더는 예제 그림 수십 MB 를 끌고 온다 — 편집기 첫 화면 번들에 넣지 않고, 구운 파일이 없을 때만 받는다.
  const [{ createFlagshipDemoProject }, { withAllBgmAssumedInstalled }] = await Promise.all([
    import("@/project/flagship"),
    import("@/assets/installedBgm"),
  ]);
  // 굽기와 같은 조건으로 짓는다 — 설치 안 된 곡은 지정만 되고, 팩을 받으면 그대로 울린다.
  const demo = withAllBgmAssumedInstalled(() => createFlagshipDemoProject(id));
  return { project: demo.project, title: demo.manifest.title, source: "built", elapsedMs: performance.now() - started };
}

let busy = false;

export interface OpenFlagshipDemoOptions {
  /** open: 편집 가능한 새 프로젝트 폴더로 만든다(저장·재로드). play: 메모리에 올려 바로 시험 플레이. */
  readonly action: "open" | "play";
  /** 컨셉 피드 창 같은 가림막을 닫는다. 불러오기가 성공한 뒤에 부른다. */
  readonly closeOverlay?: () => void;
}

/** 성공하면 true. 이미 열고 있는 중이면 false. */
export async function openFlagshipDemo(id: FlagshipDemoId, options: OpenFlagshipDemoOptions): Promise<boolean> {
  if (busy) return false;
  busy = true;
  const progressKey = Symbol("flagship-demo-progress");
  toast("데모를 불러오는 중입니다… (큰 프로젝트는 몇 초 걸립니다)", { kind: "info", key: progressKey, durationMs: 10 * 60 * 1000 });
  try {
    const { store } = await import("@/project/store");
    const demo = await loadFlagshipDemoProject(id);
    if (options.action === "open" && window.oprn?.start) {
      try {
        const { saveBeforeLeaving, withFolderSwitchEditsHeld } = await import("@/editor/leaveProject");
        return await withFolderSwitchEditsHeld(async () => {
          if (!(await saveBeforeLeaving())) throw new Error("현재 프로젝트를 먼저 저장하지 못했습니다.");
          return createEditableCopy(demo);
        });
      } catch (error) {
        log.error(`데모 복사 실패 (${id})`, error);
        toast("예제를 새 프로젝트 폴더로 복사하지 못했습니다. 현재 작업의 저장 상태와 새 폴더의 쓰기 권한을 확인해 주세요.", {
          kind: "error",
          action: {
            label: "저장 없이 예제 열기",
            onClick: async () => {
              const { confirmDiscardToLeave } = await import("@/editor/leaveProject");
              if (!(await confirmDiscardToLeave("저장 없이 예제 열기"))) return;
              const url = new URL(window.location.href);
              const lang = url.searchParams.get("lang");
              url.search = "";
              url.hash = "";
              url.searchParams.set("demo", id);
              if (lang) url.searchParams.set("lang", lang);
              store.leaveProjectSession();
              window.location.assign(url.href);
            },
          },
        });
        return false;
      }
    }
    store.replaceProject(demo.project, { label: `${demo.title} 데모 ${options.action === "play" ? "플레이" : "열기"}`, origin: "human" });
    const { focusProjectStartMap } = await import("@/editor/mapSelection");
    focusProjectStartMap();
    options.closeOverlay?.();
    if (options.action === "play") {
      toast(`${demo.title} 데모를 불러왔습니다.`, "ok");
      window.dispatchEvent(new CustomEvent("oprn:test-play-window"));
    } else {
      toast(`${demo.title} 데모를 불러왔습니다. 저장 서버에 연결되지 않아 이 탭에만 열렸습니다.`, "ok");
    }
    return true;
  } catch (error) {
    log.error(`데모 열기 실패 (${id})`, error);
    toast(FLAGSHIP_DEMO_LOAD_FAILURE, "error");
    return false;
  } finally {
    dismissToastsByKey(progressKey);
    busy = false;
  }
}

/**
 * 데모를 «내 프로젝트»로 만든다: 새 프로젝트 폴더에 시드로 저장하고 재로드한다(편집이 저장·재로드된다).
 * 저장 브리지가 없으면(순수 정적 웹) false — 호출자가 메모리 열기로 내려간다.
 * 재로드가 일어나면 이 함수는 사실상 돌아오지 않는다.
 */
async function createEditableCopy(demo: Pick<LoadedFlagshipDemo, "project" | "title">): Promise<boolean> {
  const suggested = await window.oprn?.start?.suggestProjectDir?.({ title: demo.title }).catch(() => null);
  const { createProjectFolderWithSeed } = await import("@/editor/projectFolderActions");
  if (!(await createProjectFolderWithSeed(demo.title, demo.project, suggested?.projectDir))) return false;
  window.location.reload();
  return true;
}

/**
 * 코드로 짓는 다른 예제(Scarloxy 등)도 같은 길로 연다 — 지금 프로젝트를 덮어쓰지 않고 새 프로젝트 폴더로.
 * 저장 브리지가 없으면 false(호출자가 확인 뒤 메모리 열기로 내려간다).
 */
export async function openProjectAsNewFolder(project: Project, title: string): Promise<boolean> {
  const { saveOrConfirmLeave, withFolderSwitchEditsHeld } = await import("@/editor/leaveProject");
  return withFolderSwitchEditsHeld(async () => {
    if (!(await saveOrConfirmLeave("예제 프로젝트 열기"))) return false;
    return createEditableCopy({ project, title });
  });
}
