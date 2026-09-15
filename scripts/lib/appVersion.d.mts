// scripts/lib/appVersion.d.mts
// scripts/lib/appVersion.mjs 의 타입 선언. TS 호출자(src/brand.ts, 테스트)가 쓴다.

export type AppVersionMeta = {
  /** package.json 의 릴리스 버전. */
  readonly version: string;
  /** 사람이 읽는 라벨 — `0.1.0` 또는 `0.1.0-dev.184+gddc7a88`. */
  readonly label: string;
  /** 가장 가까운 `v*` 태그. 없으면 null. */
  readonly tag: string | null;
  /** 그 태그 이후 커밋 수(태그가 없으면 저장소 전체 커밋 수). */
  readonly commitsSinceTag: number;
  /** `g` + 짧은 sha. git 을 못 쓰면 `unknown`. */
  readonly commit: string;
  /** 추적 중인 파일이 수정된 상태로 빌드됐는가. */
  readonly dirty: boolean;
  /** 빌드 시각(ISO). */
  readonly builtAt: string;
};

export type AppVersionLabelInput = Pick<
  AppVersionMeta,
  "version" | "tag" | "commitsSinceTag" | "commit" | "dirty"
>;

export declare function readPackageVersion(root: string): string;

export declare function parseDescribe(
  describe: string | null | undefined,
): { tag: string | null; commitsSinceTag: number | null; commit: string; dirty: boolean } | null;

export declare function appVersionLabel(meta: AppVersionLabelInput): string;

export declare function readAppVersion(root?: string): AppVersionMeta;

export declare function appVersionDefine(meta: AppVersionMeta): Record<string, string>;

export declare function appVersionPlugin(): {
  name: string;
  config: (config?: { root?: string }) => { define: Record<string, string> };
};
