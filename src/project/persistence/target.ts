import type { SupabaseProjectConfig } from "../supabaseProjectConfig";

/** 원격 행 대상. url·projectId·anonKey — 지금의 SupabaseProjectConfig 와 같은 모양이다. */
export type RemoteProjectTarget = SupabaseProjectConfig;

/**
 * 저장 대상. P1 에서는 원격 모양 하나다. Electron 어댑터를 붙이는 단계에서
 * `RemoteProjectTarget | LocalProjectTarget` 유니언으로 넓힌다 — 그때 컴파일러가 대상을
 * 만들고 비교하는 자리를 전부 찍어 준다. 지금 dead branch 를 두지 않는다.
 */
export type ProjectTarget = RemoteProjectTarget;

/** 대상 비교용 키. 자격증명은 넣지 않는다(로그·Map 키로 쓴다). */
export function projectTargetKey(target: ProjectTarget): string {
  return `remote:${target.url}:${target.projectId}`;
}

/** saveRouting 에 있던 정의를 옮겼다. 같은 url·projectId·anonKey 면 같은 대상이다. */
export function sameProjectTarget(a: ProjectTarget, b: ProjectTarget | null): boolean {
  return b !== null && a.url === b.url && a.projectId === b.projectId && a.anonKey === b.anonKey;
}
