// 다음 부팅의 index.html 로더가 읽는다. 번들이 뜨기 전에 프로젝트 숫자를 보여 주려면
// 이번 로드에서 짧은 세 줄을 남겨 둬야 한다. 모델이 연결되지 않았으면 기능 이름만 남긴다.

export const BOOT_BRIEF_STORAGE_KEY = "oprn:boot-brief";

export const BOOT_TIP_LINES = ["맵·이벤트 편집", "AI 어시스턴트", "자동 저장"] as const;

export interface BootBriefProject {
  readonly meta: { readonly title: string };
  readonly maps: Readonly<Record<string, unknown>>;
  readonly tilesets: Readonly<Record<string, unknown>>;
  readonly database: { readonly items: readonly unknown[] };
}

export function bootBriefLines(project: BootBriefProject, aiReady: boolean): readonly [string, string, string] {
  if (!aiReady) return BOOT_TIP_LINES;
  const title = project.meta.title.trim() || "제목 없는 프로젝트";
  const maps = Object.keys(project.maps).length;
  const items = project.database.items.length;
  const tilesets = Object.keys(project.tilesets).length;
  return [title, `맵 ${maps}개 · 아이템 ${items}개`, `타일셋 ${tilesets}개`];
}

export function rememberBootBrief(project: BootBriefProject, aiReady: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(BOOT_BRIEF_STORAGE_KEY, JSON.stringify(bootBriefLines(project, aiReady)));
  } catch {
    // 사생활 보호 모드 등 저장 불가는 다음 부팅이 기능 팁으로 남으면 된다.
  }
}
