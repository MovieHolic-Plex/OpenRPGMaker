// 조수 v2 숲길 설계 지시서(brief)와 그 검사 — 설계는 모델이, 함수는 검사만 한다.
//
// 왜(2026-10-30 감독 지시, 사용자 규칙 「설계는 모델 몫, 함수는 검사·조화」):
//   · 같은 시작 저장본·같은 요청이면 모델이 늘 같은 숲길을 냈다(sc-1030fr opus 3판 「굽이 3·wide·갈림 0.30왼·0.65오」, terra 「굽이 4·갈림 0.48왼」).
//   · 실마리 두 줄을 도구 설명 끝에 붙여도 terra 는 세 판 모두 무시했다(omo-fr-t: 굽이 3~4·wide·갈림 0.3~0.65 왼 상자 하나).
//   · 함수가 각도를 설계에 직접 넣는 판(929c37054f)은 사용자 규칙 위반이라 되돌렸다.
// 그래서: 세션마다 무작위 지시서 둘(영어, 숫자로 확인 가능한 것)을 도구 설명에 싣고, 첫 설계 호출을 짓기 전에 검사한다 —
//   지시서를 안 따랐거나, 이 프로젝트의 앞선 숲길·측정된 모델 버릇(HABITS)과 거의 같으면 짓지 않고 영어로 되돌린다(ok:false).
//   되돌림은 두 번까지. 그 뒤에는 받아 짓고, 결과 글에 무엇이 빠졌는지 적어 보고에 넣게 한다.
import type { PiToolCallRecord, PiToolShape } from "@/ai/piAgent/toolAdapter";
import type { Project } from "@/project/types";

export interface RouteDesign {
  readonly bends?: number; readonly sway?: string; readonly entryAt?: number; readonly exitAt?: number; readonly width?: string;
  readonly branches?: readonly { readonly at?: number; readonly toward?: string; readonly length?: number; readonly end?: string }[];
  readonly clearings?: readonly { readonly at?: number; readonly size?: string; readonly toward?: string }[];
}
interface BriefItem { readonly id: string; readonly text: string; readonly fix: string; readonly groups: readonly string[]; readonly ok: (d: RouteDesign) => boolean }

const branches = (d: RouteDesign) => d.branches ?? [];
const clearings = (d: RouteDesign) => d.clearings ?? [];
const sideOf = (t?: string) => (/^r/iu.test(t ?? "") ? "right" : /^l/iu.test(t ?? "") ? "left" : "");

/** 지시서 항목 — 문장은 모델에게 가는 영어, ok 는 보낸 설계 숫자만 본다. groups 가 겹치는 항목끼리는 함께 뽑지 않는다. */
export const BRIEF_ITEMS: readonly BriefItem[] = [
  { id: "early-branch", text: "a branch right after the entrance (a branch with at ≤ 0.3) so the player chooses a way at once", fix: "add a branch with at ≤ 0.3", groups: [], ok: (d) => branches(d).some((b) => Number(b.at) <= 0.3) },
  { id: "straight", text: "few bends (bends 1–2) and one large clearing (clearings[].size \"large\")", fix: "set bends to 1 or 2 and add a clearing with size \"large\"", groups: ["bends"], ok: (d) => Number(d.bends) <= 2 && clearings(d).some((c) => c.size === "large") },
  { id: "twisty", text: "many bends (bends 5–6) on a narrow path (width \"narrow\")", fix: "set bends to 5 or 6 and width to \"narrow\"", groups: ["bends", "width"], ok: (d) => Number(d.bends) >= 5 && d.width === "narrow" },
  { id: "diagonal", text: "enter at one end (entryAt ≤ 0.15 or ≥ 0.85) so the path crosses the forest diagonally", fix: "set entryAt to ≤ 0.15 or ≥ 0.85", groups: ["entry"], ok: (d) => Number(d.entryAt) <= 0.15 || Number(d.entryAt) >= 0.85 },
  { id: "same-side", text: "two branches toward the same side — one half of the forest is deep", fix: "make two branches share the same toward", groups: [], ok: (d) => ["left", "right"].some((s) => branches(d).filter((b) => sideOf(b.toward) === s).length >= 2) },
  { id: "rest-clearing", text: "one branch that ends in a clearing (end \"clearing\") as a resting spot", fix: "give one branch end \"clearing\"", groups: [], ok: (d) => branches(d).some((b) => b.end === "clearing") },
  { id: "open", text: "a wide path (width \"wide\") with two or more clearings — an open wood", fix: "set width to \"wide\" and give at least two clearings", groups: ["width"], ok: (d) => d.width === "wide" && clearings(d).length >= 2 },
  { id: "long-branch", text: "one long branch (length ≥ 0.85) that runs beside the main path before it stops", fix: "give one branch length ≥ 0.85", groups: [], ok: (d) => branches(d).some((b) => Number(b.length) >= 0.85) },
  { id: "many-branches", text: "a gentle path (sway \"gentle\") with three or more branches — many ways to choose", fix: "set sway to \"gentle\" and give at least three branches", groups: ["sway"], ok: (d) => d.sway === "gentle" && branches(d).length >= 3 },
  { id: "late-reward", text: "the chest branch late (a branch with at ≥ 0.75 and end \"chest\") — a last side path before the end", fix: "put a branch with end \"chest\" at ≥ 0.75", groups: [], ok: (d) => branches(d).some((b) => Number(b.at) >= 0.75 && b.end === "chest") },
];

/** 세션마다 겹치지 않는 지시서 둘. */
export function pickForestBrief(rand: () => number = Math.random): readonly BriefItem[] {
  const a = BRIEF_ITEMS[Math.floor(rand() * BRIEF_ITEMS.length)]!;
  const rest = BRIEF_ITEMS.filter((b) => b.id !== a.id && !b.groups.some((g) => a.groups.includes(g)));
  return [a, rest[Math.floor(rand() * rest.length)]!];
}
export const briefText = (brief: readonly BriefItem[]) =>
  ` Route brief for this session (design the first map to it unless the request or story clearly says otherwise; it is checked before building): ${brief.map((b, i) => `(${i + 1}) ${b.text}`).join("; ")}.`;

/**
 * 측정된 모델 버릇 — 같은 요청에 모델이 거듭 낸 설계(숲길 장면 벤치, 시작 저장본 bases/fantasy). 이것과 거의 같으면 «앞선 판과 같다».
 * 출처: sc-1030fr·fr2(opus·terra), omo-fr-t·omo-fr-o·omo-fr2-local(2026-10-30).
 */
export const ROUTE_HABITS: readonly { readonly label: string; readonly d: RouteDesign }[] = [
  { label: "opus habit (bends 3, wide, branches 0.30 left / 0.65 right)", d: { bends: 3, sway: "wide", entryAt: 0.5, branches: [{ at: 0.3, toward: "left" }, { at: 0.65, toward: "right" }] } },
  { label: "terra habit (bends 4, one branch 0.48 left)", d: { bends: 4, sway: "normal", entryAt: 0.5, branches: [{ at: 0.48, toward: "left", end: "chest" }] } },
  { label: "terra habit (bends 3–4, wide, chest branch 0.3–0.65 left, one clearing)", d: { bends: 3, sway: "wide", entryAt: 0.5, branches: [{ at: 0.5, toward: "left", end: "chest" }], clearings: [{ at: 0.8, size: "medium" }] } },
  { label: "terra habit (bends 5, wide, chest branch 0.5 left, clearing 0.8)", d: { bends: 5, sway: "wide", entryAt: 0.5, branches: [{ at: 0.5, toward: "left", end: "chest" }], clearings: [{ at: 0.8, size: "medium" }] } },
  { label: "terra habit (bends 3–4, gentle, chest 0.35–0.45 left, clearing branch 0.7 right)", d: { bends: 3, sway: "gentle", entryAt: 0.5, branches: [{ at: 0.4, toward: "left", end: "chest" }, { at: 0.7, toward: "right", end: "clearing" }] } },
];

/** 두 설계의 차이 점수 — 1 이하면 «거의 같다». */
export function designDistance(a: RouteDesign, b: RouteDesign): number {
  let s = 0;
  const db = Math.abs(Number(a.bends ?? 4) - Number(b.bends ?? 4)); s += db >= 2 ? 2 : db;
  if ((a.sway ?? "normal") !== (b.sway ?? "normal")) s += 1;
  if ((a.width ?? "normal") !== (b.width ?? "normal")) s += 1;
  if (Math.abs(Number(a.entryAt ?? 0.5) - Number(b.entryAt ?? 0.5)) >= 0.25) s += 2; // 비스듬히 가로지르면 모양이 크게 바뀐다
  const ab = branches(a), bb = branches(b);
  s += Math.min(2, Math.abs(ab.length - bb.length));
  const used = new Set<number>(); let unmatched = 0;
  for (const x of ab) {
    const k = bb.findIndex((y, i) => !used.has(i) && sideOf(y.toward) === sideOf(x.toward) && Math.abs(Number(y.at ?? 0.5) - Number(x.at ?? 0.5)) <= 0.12);
    if (k < 0) unmatched += 1; else used.add(k);
  }
  s += Math.min(2, unmatched);
  if (clearings(a).length !== clearings(b).length) s += 1;
  return s;
}

/** 숲길 도구가 맵 위치(tags forest-route)에 남긴 설계 줄 → 설계 숫자. 「굽이 5 · 휨 wide · 폭 normal · 들어옴 0.48 · … · 갈림 0.50왼11→chest · 빈터 0.80medium」 */
export function parseRouteLine(line: string): RouteDesign {
  const num = (re: RegExp) => { const m = re.exec(line); return m ? Number(m[1]) : undefined; };
  const word = (re: RegExp) => { const m = re.exec(line); return m && !/보통/u.test(m[1]!) ? m[1] : "normal"; };
  const br = /갈림 ([^·]*)/u.exec(line)?.[1] ?? "";
  const cl = /빈터 ([^·]*)$/u.exec(line)?.[1] ?? "";
  return {
    bends: num(/굽이 (\d+)/u), sway: word(/휨 (\S+)/u), width: word(/폭 (\S+)/u), entryAt: num(/들어옴 ([\d.]+)/u),
    branches: [...br.matchAll(/([\d.]+)(왼|오)\d*→(\w+)/gu)].map((m) => ({ at: Number(m[1]), toward: m[2] === "왼" ? "left" : "right", end: m[3] })),
    clearings: [...cl.matchAll(/([\d.]+)(small|medium|large)/gu)].map((m) => ({ at: Number(m[1]), size: m[2] })),
  };
}
export function earlierRoutes(project: Project | undefined): { label: string; d: RouteDesign }[] {
  return Object.values(project?.maps ?? {}).flatMap((m) => (m.locations ?? []).filter((l) => (l.tags ?? []).includes("forest-route") && l.note)
    .map((l) => ({ label: `earlier route in this project «${m.name}» (${l.note})`, d: parseRouteLine(l.note!) })));
}

const show = (d: RouteDesign) => JSON.stringify(d);
/** 첫 설계 검사 — 막을 이유(영어)들. 비면 통과. */
export function briefProblems(designs: readonly RouteDesign[], brief: readonly BriefItem[], earlier: readonly { label: string; d: RouteDesign }[]): { problems: string[]; fixes: string[] } {
  const problems: string[] = []; const fixes: string[] = [];
  const first = designs[0];
  if (!first) return { problems: ["no designs were sent, so the route would be the default frame (bends 4, no branches)"], fixes: ["send designs[0] that follows the route brief: " + brief.map((b) => b.fix).join("; ")] };
  const missed = brief.filter((b) => !b.ok(first));
  if (missed.length) { problems.push(`designs[0] ignores the route brief (${missed.map((b) => `«${b.text}»`).join(", ")})`); fixes.push(...missed.map((b) => b.fix)); }
  designs.forEach((d, i) => {
    const twin = [...earlier, ...ROUTE_HABITS].find((e) => designDistance(d, e.d) <= 1);
    if (twin) { problems.push(`designs[${i}] matches a previous route — ${twin.label}`); fixes.push(`designs[${i}]: change bends by 2+, move or flip its branches, or change width/clearings`); }
    designs.slice(0, i).forEach((p, j) => { if (designDistance(d, p) <= 1) { problems.push(`designs[${i}] is the same as designs[${j}]`); fixes.push(`make designs[${i}] differ from designs[${j}]`); } });
  });
  return { problems, fixes };
}

const MAX_REJECTS = 2;
/**
 * author_forest_route 감싸개: 설명 끝에 이 세션의 지시서, 첫 짓기 전에 briefProblems — 걸리면 짓지 않고 ok:false(최대 2번),
 * 그다음은 받아 짓고 빠진 것을 결과 글에 적는다. 첫 짓기가 성공하면 그 뒤 호출은 검사하지 않는다(다음 숲길은 도구 자체 경고가 본다).
 */
export function withForestRouteBrief(tools: PiToolShape[], project: () => Project | undefined, record?: (r: PiToolCallRecord) => void, rand: () => number = Math.random): PiToolShape[] {
  const brief = pickForestBrief(rand);
  let rejects = 0; let built = false;
  return tools.map((tool): PiToolShape => tool.name !== "author_forest_route" ? tool : ({
    ...tool,
    description: `${tool.description ?? ""}${briefText(brief)}`,
    descriptionTail: briefText(brief), // toolExposure.englishToolCopy 가 영어 설명 뒤에 다시 붙인다
    async execute(id, params, signal) {
      if (built) return tool.execute(id, params, signal);
      const args = (params && typeof params === "object" ? params : {}) as { designs?: RouteDesign[]; terrain?: string; terrains?: string[] };
      if (args.terrain === "edge" || ((args.terrains ?? []).length > 0 && (args.terrains ?? []).every((t) => t === "edge"))) return tool.execute(id, params, signal);
      const designs = Array.isArray(args.designs) ? args.designs : [];
      const { problems, fixes } = briefProblems(designs, brief, earlierRoutes(project()));
      if (problems.length && rejects < MAX_REJECTS) {
        rejects += 1;
        const summary = `Rejected: ${problems.join("; ")}. Nothing was built. You sent: designs = ${designs.length ? designs.map(show).join(", ") : "(none)"}. `
          + `Route brief: ${brief.map((b, i) => `(${i + 1}) ${b.text}`).join("; ")}. Change at least: ${[...new Set(fixes)].join("; ")}. Call author_forest_route again with the changed designs (try ${rejects}/${MAX_REJECTS}).`;
        record?.({ toolCallId: id, name: tool.name, args: params, result: { ok: false, summary } } as PiToolCallRecord);
        return { content: [{ type: "text", text: JSON.stringify({ ok: false, summary }) }] } as Awaited<ReturnType<PiToolShape["execute"]>>;
      }
      const result = await tool.execute(id, params, signal);
      const body = (result.content.find((c) => c.type === "text") as { text?: string } | undefined)?.text ?? "";
      let ok = true; try { ok = (JSON.parse(body.split("\n")[0] ?? "") as { ok?: unknown }).ok !== false; } catch { ok = !/실행 실패/u.test(body); }
      if (!ok) return result;
      built = true;
      if (!problems.length) return result;
      const note = `[Route brief not met] Built after ${rejects} rejected tries — still: ${problems.join("; ")}. Say this in your final report (the route may look like an earlier one).`;
      return { ...result, content: [...result.content, { type: "text", text: note }] } as typeof result;
    },
  } as PiToolShape & { readonly descriptionTail: string }));
}
