// editor/whatsNew/whatsNewModel.ts
// 「새 소식」의 순수 계산 — 마지막으로 본 버전 이후 릴리스를 모아 보여 줄 목록을 만든다.
// 데이터는 빌드가 CHANGELOG.md 에서 거른 것(scripts/lib/whatsNew.mjs, 가상 모듈 virtual:oprn-whats-new)이다.
import { compareVersions } from "../../../electron/shared/updates";

export type WhatsNewKind = "new" | "fix";

export type WhatsNewItem = {
  readonly kind: WhatsNewKind;
  readonly scope: string | null;
  readonly text: string;
  readonly sha: string | null;
};

export type WhatsNewRelease = {
  readonly version: string;
  readonly date: string | null;
  readonly items: readonly WhatsNewItem[];
  /** 그 릴리스에서 걸러 낸(개발 내부) 항목 수. */
  readonly hidden: number;
};

export type WhatsNewData = { readonly releases: readonly WhatsNewRelease[] };

export type WhatsNewDigestItem = WhatsNewItem & { readonly version: string };

export type WhatsNewDigest = {
  /** 이 범위의 시작(마지막으로 본 버전). 처음이면 null. */
  readonly from: string | null;
  readonly to: string;
  readonly releaseCount: number;
  readonly items: readonly WhatsNewDigestItem[];
  readonly hidden: number;
  /** 번들에 실린 릴리스보다 더 오래전에 봤다 — 「전체 변경 기록」을 권한다. */
  readonly truncated: boolean;
};

/** 처음 여는 사람에게는 최근 이만큼만 보인다. 40개를 다 보이면 아무도 안 읽는다. */
export const FIRST_VISIT_RELEASES = 3;
/** 한 번에 보일 항목 상한. 넘치면 최신부터 자른다. */
export const DIGEST_ITEM_LIMIT = 60;

/** 릴리스 번호만 남긴다 — 빌드 라벨 `0.39.0-dev.3+gabc` 은 `0.39.0` 이 된다. */
export function releaseCore(version: string): string {
  const match = /^(\d+\.\d+\.\d+)/.exec(String(version ?? ""));
  return match ? match[1]! : "0.0.0";
}

/**
 * lastSeen 다음부터 current 까지의 릴리스를 모은다. current 보다 새 릴리스(번들에 있을 리 없지만)는 뺀다.
 * lastSeen 이 없으면 최근 FIRST_VISIT_RELEASES 개.
 */
export function buildDigest(data: WhatsNewData, current: string, lastSeen: string | null): WhatsNewDigest {
  const to = releaseCore(current);
  const upToCurrent = data.releases.filter((release) => compareVersions(release.version, to) <= 0);
  const ordered = [...upToCurrent].sort((a, b) => compareVersions(b.version, a.version));
  const seen = lastSeen ? releaseCore(lastSeen) : null;
  const range = seen ? ordered.filter((release) => compareVersions(release.version, seen) > 0) : ordered.slice(0, FIRST_VISIT_RELEASES);
  const oldest = ordered[ordered.length - 1];
  const truncated = Boolean(seen && oldest && compareVersions(seen, oldest.version) < 0 && ordered.length >= FIRST_VISIT_RELEASES);
  const items: WhatsNewDigestItem[] = [];
  let hidden = 0;
  for (const release of range) {
    hidden += release.hidden;
    for (const item of release.items) items.push({ ...item, version: release.version });
  }
  const overflow = Math.max(0, items.length - DIGEST_ITEM_LIMIT);
  return {
    from: seen,
    to,
    releaseCount: range.length,
    items: items.slice(0, DIGEST_ITEM_LIMIT),
    hidden: hidden + overflow,
    truncated,
  };
}

/** 톱바 점을 켤지 — 마지막으로 본 버전보다 지금 버전에 보일 것이 있을 때. */
export function hasUnseenNews(data: WhatsNewData, current: string, lastSeen: string | null): boolean {
  if (!lastSeen) return buildDigest(data, current, null).items.length > 0;
  return buildDigest(data, current, lastSeen).items.length > 0;
}

/** 범위 영역은 코드 범위 이름(`battle`)이라 사용자 말로 바꾼다. 모르는 범위는 「편집기」로 묶는다. */
const AREA_LABELS: Readonly<Record<string, string>> = {
  editor: "편집기",
  "event-editor": "이벤트",
  events: "이벤트",
  map: "맵",
  maps: "맵",
  tileset: "타일",
  tiles: "타일",
  database: "자료집",
  db: "자료집",
  ai: "AI 조수",
  "ai-tools": "AI 조수",
  assistant: "AI 조수",
  pi: "AI 조수",
  tools: "AI 조수",
  studio: "AI 조수",
  battle: "전투",
  runtime: "게임 실행",
  player: "게임 실행",
  title: "타이틀",
  opening: "타이틀",
  team: "팀",
  host: "팀",
  electron: "앱",
  start: "앱",
  store: "저장",
  save: "저장",
  persistence: "저장",
  "local-store": "저장",
  places: "소재",
  content: "소재",
  assets: "소재",
};

export function areaLabel(scope: string | null): string {
  if (!scope) return "일반";
  const first = scope.split(",")[0]!.trim().toLowerCase();
  return AREA_LABELS[first] ?? "소재";
}
