// status — 분류(첫 태그)별 후보·그림·검사 실패·받음·버림·대기 수.
import { currentImageSha, listCandidates, readCheck, readDecisions } from "./data";

export async function status(_argv: string[]): Promise<number> {
  const decisions = readDecisions();
  const rows = new Map<string, { total: number; drawn: number; flagged: number; accepted: number; rejected: number; waiting: number }>();
  for (const concept of listCandidates()) {
    const tag = concept.tags[0]!;
    const row = rows.get(tag) ?? { total: 0, drawn: 0, flagged: 0, accepted: 0, rejected: 0, waiting: 0 };
    row.total += 1;
    const sha = currentImageSha(concept.slug);
    if (sha) row.drawn += 1;
    const checked = readCheck(concept.slug);
    if (checked && checked.imageSha === sha && !checked.ok) row.flagged += 1;
    const decision = decisions[concept.slug];
    if (decision && decision.imageSha === sha) decision.verdict === "accept" ? (row.accepted += 1) : (row.rejected += 1);
    else if (sha) row.waiting += 1;
    rows.set(tag, row);
  }
  console.log("분류\t후보\t그림\t검사경고\t받음\t버림\t대기");
  const sum = { total: 0, drawn: 0, flagged: 0, accepted: 0, rejected: 0, waiting: 0 };
  for (const [tag, row] of rows) {
    console.log(`${tag}\t${row.total}\t${row.drawn}\t${row.flagged}\t${row.accepted}\t${row.rejected}\t${row.waiting}`);
    for (const key of Object.keys(sum) as (keyof typeof sum)[]) sum[key] += row[key];
  }
  console.log(`합계\t${sum.total}\t${sum.drawn}\t${sum.flagged}\t${sum.accepted}\t${sum.rejected}\t${sum.waiting}`);
  return 0;
}
