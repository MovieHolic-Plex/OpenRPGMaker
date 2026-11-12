// 명세 은행의 수치 표 — 칸 이름·읽는 법·좋은 쪽, 은행 합계, 전/후 대조. 제품 코드를 끌어오지 않는다.
/** 값 하나: 수 또는 [분자, 분모]. */
export type Value = number | [number, number];
export interface GameMetrics { id: string; kind?: string; values: Record<string, Value>; lines: Record<string, string[]>; probeErrors: string[] }

/** better: up = 클수록 좋다 · down = 작을수록 좋다 · none = 좋고 나쁨이 없다(크기·참고). 비율은 분자/분모로 견준다. */
export const METRICS: readonly { key: string; label: string; better: "up" | "down" | "none" }[] = [
  { key: "complete", label: "기계 «완료»(마지막 턴)", better: "up" },
  { key: "todoDone", label: "할 일 끝/전체", better: "up" },
  { key: "todoBlocked", label: "할 일 막힘", better: "down" },
  { key: "gateProblems", label: "끝맺음 관문이 짚은 문제", better: "down" },
  { key: "gameBlockers", label: "게임 검사 막힘", better: "down" },
  { key: "blueprintBlockers", label: "청사진 걷기 막힘", better: "down" },
  { key: "shipBlockers", label: "출하 차단", better: "down" },
  { key: "autoplayEnding", label: "자동 플레이 엔딩 도달", better: "up" },
  { key: "exitsOnRoad", label: "출구가 길 위(길 있는 맵)", better: "up" },
  { key: "exitsFullWidth", label: "가장자리 출구가 길 폭 전체", better: "up" },
  { key: "exitsRoadless", label: "길 없는 맵의 출구", better: "none" },
  { key: "arriveRoad", label: "도착 칸이 길 위", better: "up" },
  { key: "arriveInside", label: "도착 칸이 가장자리 줄 안쪽", better: "up" },
  { key: "arriveFacing", label: "도착해 안쪽을 봄", better: "up" },
  { key: "entrancesEnterable", label: "선언된 건물 입구 가운데 들어가지는 것", better: "up" },
  { key: "entrancesSilent", label: "눌러도 반응 없는 입구", better: "down" },
  { key: "lockedOnEntrance", label: "잠김 한 줄이 건물 입구에", better: "up" },
  { key: "lockedOffEntrance", label: "잠김 한 줄이 입구 아닌 칸에", better: "down" },
  { key: "purposeBuildings", label: "바깥 맵의 건물(목적 탐침)", better: "none" },
  { key: "purposeEnterable", label: "들어가지는 건물/건물(목적 탐침)", better: "up" },
  { key: "purposeRoleBuildings", label: "역할 있는 건물/건물(들어감·문 앞 사람)", better: "up" },
  { key: "purposeFiller", label: "채움 건물/건물(목적 탐침)", better: "down" },
  { key: "purposePeople", label: "바깥 맵의 사람(목적 탐침)", better: "none" },
  { key: "purposeRoute", label: "길 몫 — 길 칸/걷는 칸(목적 탐침)", better: "up" },
  { key: "purposeArea", label: "바깥 맵 넓이(칸, 목적 탐침)", better: "none" },
  { key: "gateWrongPrereq", label: "잠김 글이 틀린 선행 조건을 말함", better: "down" },
  { key: "objectiveTextTail", label: "목표 글의 대상 ≠ 표시 대상", better: "down" },
  { key: "sideQuestObjective", label: "곁 퀘스트가 본편 목표를 바꿈", better: "down" },
  { key: "foeStaysAfterWin", label: "이긴 적이 맵에 남음", better: "down" },
  { key: "foeFieldBattleSprite", label: "필드 그림 ≠ 전투 그림", better: "down" },
  { key: "offThemeBackdrop", label: "주제 밖 전투 배경(숲)", better: "down" },
  { key: "craftingLoot", label: "상자에서 재료가 나옴", better: "down" },
  { key: "levelAfterBattles", label: "길 위 전투 뒤 레벨", better: "none" },
  { key: "routeShare", label: "길이 밟는 칸/걷는 칸", better: "up" },
  { key: "walkablePerStop", label: "꼭 들를 곳 하나당 걷는 칸", better: "down" },
  { key: "stepsOnPath", label: "길이 들른 단계", better: "none" },
  { key: "arrowFirstStepWrong", label: "화살표 첫 걸음 불일치", better: "down" },
  { key: "arrowIntoWall", label: "화살표가 벽을 봄", better: "down" },
  { key: "arrowAcrossBlocked", label: "화살표가 막힌 칸을 가로지름", better: "down" },
  { key: "arrowWalkUnreached", label: "화살표대로 걸어 못 닿음", better: "down" },
  { key: "artGaps", label: "없는 그림 줄(art-gap)", better: "none" },
  { key: "missingArt", label: "그림 없음 줄(전부)", better: "none" },
  { key: "hudUnusedGauges", label: "HUD 의 안 쓰는 게이지", better: "down" },
  { key: "guidesOff", label: "필드 안내 끔(화살표·표식·목표 꼬리 없음)", better: "up" },
  { key: "maps", label: "맵", better: "none" },
  { key: "events", label: "이벤트", better: "none" },
  { key: "replayPlayed", label: "재생한 호출/전체", better: "none" },
  { key: "replaySame", label: "그때와 같은 결과의 호출", better: "none" },
  { key: "replayWritesSame", label: "그때와 같은 결과의 쓰기 호출", better: "none" },
  { key: "trustMapTiles", label: "저장본과 타일이 같은 맵", better: "none" },
  { key: "trustEvents", label: "저장본과 짝지은 이벤트", better: "none" },
  { key: "trustEventContent", label: "저장본과 내용까지 같은 이벤트", better: "none" },
];

export const show = (v: Value | undefined): string => v === undefined ? "-" : typeof v === "number" ? String(v) : `${v[0]}/${v[1]}`;
/** 수와 비율을 같이: 108/263(41.1%). 분모가 없거나 몫이 아닌 칸(걷는 칸/들를 곳)은 수만. */
export const showRate = (v: Value | undefined): string => v === undefined || typeof v === "number" || !v[1] || v[0] > v[1] ? show(v) : `${v[0]}/${v[1]}(${((v[0] / v[1]) * 100).toFixed(v[1] >= 200 ? 1 : 0)}%)`;
/** 견줄 수 — 비율은 분자/분모(분모 0 은 없음). */
const scalar = (v: Value | undefined): number | undefined => v === undefined ? undefined : typeof v === "number" ? v : v[1] ? v[0] / v[1] : undefined;

export function sumMetrics(games: readonly GameMetrics[]): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const g of games) for (const [key, v] of Object.entries(g.values)) {
    const prev = out[key];
    if (typeof v === "number") out[key] = (typeof prev === "number" ? prev : 0) + v;
    else { const p = Array.isArray(prev) ? prev : [0, 0]; out[key] = [p[0]! + v[0], p[1]! + v[1]]; }
  }
  return out;
}

/** a → b 가 나빠졌나(-1) · 좋아졌나(+1) · 같거나 판단 없음(0).
 * 비율 칸(분자/분모)은 비율로 견주되, **분모만 줄거나 늘어서 비율이 움직인 것은 나빠짐·좋아짐이 아니다**:
 * 나빠짐 = 비율이 나빠졌고 나쁜 쪽의 수(작을수록 좋은 칸은 분자, 클수록 좋은 칸은 분모−분자)가 늘었다.
 * 좋아짐 = 비율이 좋아졌고 나쁜 쪽의 수가 줄었거나 좋은 쪽의 수가 늘었다. (2026-11-11 #4617 대조: 건물이 346 → 232 로 줄자
 * «눌러도 반응 없는 입구 110/379 → 108/263» 이 수는 줄었는데 나빠짐으로 찍혔다.) 한쪽에 분모가 없으면(0) 수로만 견준다. */
export function direction(key: string, a: Value | undefined, b: Value | undefined): -1 | 0 | 1 {
  const def = METRICS.find((m) => m.key === key);
  if (!def || def.better === "none" || a === undefined || b === undefined) return 0;
  if (typeof a === "number" || typeof b === "number") {
    const x = scalar(a), y = scalar(b);
    if (x === undefined || y === undefined || Math.abs(x - y) < 1e-9) return 0;
    return (y > x) === (def.better === "up") ? 1 : -1;
  }
  const bad = (v: [number, number]): number => def.better === "down" ? v[0] : v[1] - v[0];
  const good = (v: [number, number]): number => def.better === "down" ? v[1] - v[0] : v[0];
  const moreBad = bad(b) > bad(a), lessBad = bad(b) < bad(a), moreGood = good(b) > good(a);
  if (!a[1] || !b[1]) return moreBad ? -1 : lessBad || moreGood ? 1 : 0;
  // 비율은 «좋은 쪽의 몫»으로 맞춘다 — 클수록 좋다.
  const rate = (v: [number, number]): number => good(v) / v[1];
  // 0.1%p 안의 움직임은 같은 것으로 본다(큰 분모에서 28.43% → 28.36% 같은 줄).
  if (Math.abs(rate(a) - rate(b)) < 0.001) return 0;
  if (rate(b) < rate(a)) return moreBad ? -1 : 0;
  return lessBad || moreGood ? 1 : 0;
}
/** 비율은 움직였는데 좋아짐·나빠짐이 아닌 것 — 분모만 바뀐 줄. */
export function denominatorOnly(key: string, a: Value | undefined, b: Value | undefined): boolean {
  if (!Array.isArray(a) || !Array.isArray(b) || !a[1] || !b[1] || a[1] === b[1]) return false;
  const def = METRICS.find((m) => m.key === key);
  return !!def && def.better !== "none" && Math.abs(a[0] / a[1] - b[0] / b[1]) >= 0.001 && direction(key, a, b) === 0;
}

export function table(rows: readonly string[][]): string {
  const width = (s: string) => [...s].reduce((n, ch) => n + (/[ᄀ-ￜ]/u.test(ch) ? 2 : 1), 0);
  const cols = rows[0]!.map((_, i) => Math.max(...rows.map((r) => width(r[i] ?? ""))));
  return rows.map((r) => r.map((cell, i) => cell + " ".repeat(cols[i]! - width(cell))).join("  ").trimEnd()).join("\n");
}

/** 게임 하나의 표(칸 · 값). */
export function gameTable(m: GameMetrics): string {
  return table([["칸", "값"], ...METRICS.filter((d) => m.values[d.key] !== undefined).map((d) => [d.label, show(m.values[d.key])])]);
}

/** 은행 전/후 대조 — 칸마다 합계의 전/후와, 그 칸이 나빠진 게임 목록. */
export function diffReport(a: readonly GameMetrics[], b: readonly GameMetrics[], nameA: string, nameB: string): { text: string; worse: number; rows: { key: string; label: string; a: string; b: string; dir: number; denominatorOnly: boolean; worseGames: string[]; betterGames: string[] }[] } {
  const ids = a.map((g) => g.id).filter((id) => b.some((g) => g.id === id));
  const A = a.filter((g) => ids.includes(g.id)), B = b.filter((g) => ids.includes(g.id));
  const sa = sumMetrics(A), sb = sumMetrics(B);
  const rows = METRICS.filter((d) => sa[d.key] !== undefined || sb[d.key] !== undefined).map((d) => {
    const worseGames: string[] = [], betterGames: string[] = [];
    for (const id of ids) {
      const x = A.find((g) => g.id === id)!.values[d.key], y = B.find((g) => g.id === id)!.values[d.key];
      const dir = direction(d.key, x, y);
      if (dir < 0) worseGames.push(`${id}(${showRate(x)}→${showRate(y)})`); else if (dir > 0) betterGames.push(`${id}(${showRate(x)}→${showRate(y)})`);
    }
    return { key: d.key, label: d.label, a: showRate(sa[d.key]), b: showRate(sb[d.key]), dir: direction(d.key, sa[d.key], sb[d.key]), denominatorOnly: denominatorOnly(d.key, sa[d.key], sb[d.key]), worseGames, betterGames };
  });
  const mark = (dir: number, denominator = false) => dir > 0 ? "▲ 좋아짐" : dir < 0 ? "▼ 나빠짐" : denominator ? "(분모만 바뀜)" : "";
  const only = [...a.map((g) => g.id).filter((id) => !ids.includes(id)).map((id) => `${id}(앞에만)`), ...b.map((g) => g.id).filter((id) => !ids.includes(id)).map((id) => `${id}(뒤에만)`)];
  const text = [
    `은행 대조 — ${nameA} → ${nameB} · 게임 ${ids.length}${only.length ? ` · 한쪽에만 있는 것 ${only.join(", ")}` : ""}`,
    table([["칸", nameA, nameB, "합계", "나빠진 게임"], ...rows.map((r) => [r.label, r.a, r.b, mark(r.dir, r.denominatorOnly), r.worseGames.join(" ")])]),
    "",
    rows.some((r) => r.worseGames.length) ? `나빠진 칸이 있는 게임:\n${rows.filter((r) => r.worseGames.length).map((r) => `  ${r.label}: ${r.worseGames.join(", ")}`).join("\n")}` : "나빠진 칸 없음",
    "(비율 칸은 수와 비율을 같이 적는다. 분모만 줄거나 늘어 비율이 움직인 줄은 나빠짐·좋아짐으로 치지 않는다.)",
    "(수치는 그림을 보지 않은 것이다 — 화면 미검증. 그림은 각 게임 폴더의 maps/ 에 있다)",
  ].join("\n");
  return { text, worse: rows.reduce((n, r) => n + r.worseGames.length, 0), rows };
}
