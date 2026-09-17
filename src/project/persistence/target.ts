/** 원격 행 대상. url·projectId·anonKey — 포트가 정의를 소유한다. */
export type RemoteProjectTarget = {
  readonly url: string;
  readonly projectId: string;
  readonly anonKey: string;
};

/** 로컬 폴더 대상. 폴더 경로와 프로젝트 UUID — 자격증명이 없다. */
export type LocalProjectTarget = {
  readonly kind: "local";
  readonly projectDir: string;
  readonly projectId: string;
};

/** 저장 대상. 원격이면 URL·projectId·anonKey, 로컬이면 폴더 경로와 UUID. */
export type ProjectTarget = RemoteProjectTarget | LocalProjectTarget;

export function isLocalTarget(target: ProjectTarget): target is LocalProjectTarget {
  return "kind" in target && target.kind === "local";
}

export function isRemoteTarget(target: ProjectTarget): target is RemoteProjectTarget {
  return !isLocalTarget(target);
}

/** 대상 비교용 키. 자격증명은 넣지 않는다(로그·Map 키로 쓴다). */
export function projectTargetKey(target: ProjectTarget): string {
  return isLocalTarget(target) ? `local:${target.projectDir}:${target.projectId}` : `remote:${target.url}:${target.projectId}`;
}

/** saveRouting 에 있던 정의를 옮겼다. 로컬은 폴더 경로, 원격은 url·projectId·anonKey 로 비교한다. */
export function sameProjectTarget(a: ProjectTarget, b: ProjectTarget | null): boolean {
  if (b === null) return false;
  if (isLocalTarget(a) || isLocalTarget(b)) {
    return isLocalTarget(a) && isLocalTarget(b) && a.projectDir === b.projectDir;
  }
  return a.url === b.url && a.projectId === b.projectId && a.anonKey === b.anonKey;
}
