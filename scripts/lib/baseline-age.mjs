// 기준선 나이 경고. 모든 CSS 게이트가 공유한다.
//
// 왜 필요한가: 기준선은 "지금 알고 있는 빚"인데, 시간이 지나면 그 전제가 조용히 낡는다.
// `dead-css-baseline.json` 은 2026-09-01 이후 관련 커밋 1,130개가 지나가도록 갱신되지
// 않았고, 그 사이 새로 생긴 죽은 클래스가 "새 위반"으로 매번 보고되면서 아무도 안 읽는
// 빨간불이 됐다. 게이트가 나이를 스스로 말하지 않으면 사람은 절대 확인하지 않는다.
//
// **실패로 만들지 않는다.** 만료로 실패시키면 바쁜 날 누군가 게이트를 꺼 버린다 —
// 이 리포에서 이미 일어난 일이다(GitHub Actions 는 리포 수준에서 꺼져 있다).
// 경고는 보이되 초록을 막지 않는 것이 목적이다.
import { readFileSync } from "node:fs";

export const STALE_DAYS = 30;

// 기준선마다 시각 필드 이름이 다르다. 새로 만들 땐 generatedAt 을 쓴다.
const TIME_FIELDS = ["generatedAt", "ranAt", "updatedAt", "createdAt"];

export function baselineAgeDays(doc, now = Date.now()) {
  for (const f of TIME_FIELDS) {
    const raw = doc?.[f];
    if (!raw) continue;
    const t = Date.parse(raw);
    if (Number.isFinite(t)) return (now - t) / 86400000;
  }
  return null;
}

/**
 * 기준선이 오래됐으면 stderr 에 한 줄 경고한다. 반환값은 없고 종료 코드에 영향을 주지 않는다.
 * @returns {{ days: number|null, stale: boolean }}
 */
export function warnIfStale(path, label, { staleDays = STALE_DAYS, now = Date.now(), log = console.error } = {}) {
  let doc;
  try { doc = JSON.parse(readFileSync(path, "utf8")); } catch { return { days: null, stale: false }; }
  const days = baselineAgeDays(doc, now);
  if (days === null) {
    log(`  ⓘ ${label}: 기준선에 생성 시각이 없다 — 갱신할 때 generatedAt 을 넣어라.`);
    return { days: null, stale: false };
  }
  if (days > staleDays) {
    log(`  ⓘ ${label}: 기준선이 ${Math.floor(days)}일 됐다(기준 ${staleDays}일). 유예 목록이 현실과 어긋났을 수 있다.`);
    return { days, stale: true };
  }
  return { days, stale: false };
}
