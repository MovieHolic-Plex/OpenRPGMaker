/**
 * AI 툴 레지스트리 통계 리포터 — 기능 문서(아티팩트/위키)의 수치 정본.
 * 도메인별 활성 툴 수, deprecated 수, 시스템 스킬 수를 실측해 표로 출력한다.
 * 실행: npx tsx scripts/report-ai-tool-stats.mts [--json]
 */
import { allTools, activeTools } from "../src/editor/tools/toolRegistry.ts";
import type { ToolDomain } from "../src/editor/tools/types.ts";

const DOMAIN_LABELS: Record<string, string> = {
  tile: "타일 어휘·시공",
  map: "맵",
  event: "이벤트·NPC",
  database: "데이터베이스",
  quest: "퀘스트·스토리",
  world: "월드 그래프",
  battle: "전투 밸런스",
  system: "시스템·리팩터",
  core: "코어(상시 노출)",
};

function primaryDomain(domains: readonly ToolDomain[] | undefined): string {
  if (!domains || domains.length === 0) return "(미태깅)";
  return domains.find((domain) => domain !== "core") ?? domains[0]!;
}

const active = activeTools();
const deprecatedCount = allTools().length - active.length;

const byDomain = new Map<string, string[]>();
for (const tool of active) {
  const key = primaryDomain(tool.domains);
  const bucket = byDomain.get(key);
  if (bucket) bucket.push(tool.name);
  else byDomain.set(key, [tool.name]);
}

let systemSkillCount: number | null = null;
try {
  const { SYSTEM_SKILLS } = await import("../src/ai/skills.ts");
  systemSkillCount = SYSTEM_SKILLS.length;
} catch {
  // skills.ts가 브라우저 전용 의존을 갖게 되면 조용히 생략(툴 통계는 그대로 유효).
}

const rows = [...byDomain.entries()].sort((a, b) => b[1].length - a[1].length);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({
    activeTotal: active.length,
    deprecated: deprecatedCount,
    systemSkills: systemSkillCount,
    domains: Object.fromEntries(rows.map(([domain, names]) => [domain, { count: names.length, tools: names }])),
  }, null, 2));
} else {
  console.log(`활성 툴 합계: ${active.length} (deprecated ${deprecatedCount} 별도)`);
  if (systemSkillCount !== null) console.log(`시스템 스킬: ${systemSkillCount}`);
  console.log("");
  console.log("| 도메인 | 개수 | 대표 툴 |");
  console.log("|---|---|---|");
  for (const [domain, names] of rows) {
    const label = DOMAIN_LABELS[domain] ?? domain;
    console.log(`| ${label} (${domain}) | ${names.length} | ${names.slice(0, 5).join(", ")}${names.length > 5 ? " …" : ""} |`);
  }
}
