import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildArtGaps, parseArtReview, toolReportsIn } from "@/harnesses/assistant-capability/node/mapVqa/artGaps";
import { caught, plant, RECIPE_CLASSES, type Recipe } from "@/harnesses/assistant-capability/node/mapVqa/decoys";
import { factsText, isBlankMap, mapFacts } from "@/harnesses/assistant-capability/node/mapVqa/facts";
import { buildHudTally, parseHudReview, type HudShot } from "@/harnesses/assistant-capability/node/mapVqa/hudVerdict";
import { parsePatterns } from "@/harnesses/assistant-capability/node/mapVqa/patterns";
import { buildTally, loadReviewer, parseReview, type MapReview } from "@/harnesses/assistant-capability/node/mapVqa/verdict";
import { extractJson, VISUAL_JUDGE } from "@/harnesses/assistant-capability/node/visualJudge";
import { createBlankProject } from "@/project/defaults";

// 조수가 깐 맵의 그림 검수(map-vqa)에서 모델 없이 볼 수 있는 것: 묶음·씨앗의 모양, 사실 읽기, 심은 결함의 조리법,
// 검수자 답 읽기(형식이 어긋나면 답이 아니다), 집계(미검증은 깨끗한 맵으로 세지 않는다), 보정의 «잡았다» 판정.

const DATA = resolve("harness-data/assistant-capability/map-vqa");
const reviewer = loadReviewer();
const review = (id: string, defects: MapReview["defects"], status: MapReview["status"] = "reviewed"): MapReview => ({
  id, group: "A:run", label: id, context: "", map: { name: id, width: 20, height: 15, tilesetId: "t", standalone: false, walkableShare: 1, exits: 0, people: 0, invisible: 0 },
  pictureSha256: "x", promptVersion: reviewer.version, judge: VISUAL_JUDGE, status, purpose: "", checked: {}, defects,
});

describe("map-vqa 묶음과 씨앗", () => {
  it("맵 깔기 요청은 좌표·크기 없는 한국어 문장이고 id 가 겹치지 않는다", () => {
    const set = JSON.parse(readFileSync(resolve(DATA, "requests.json"), "utf8"));
    expect(set.jobs.length).toBeGreaterThanOrEqual(15);
    expect(new Set(set.jobs.map((job: any) => job.id)).size).toBe(set.jobs.length);
    for (const job of set.jobs) {
      expect(job.request).toMatch(/[가-힣]/u);
      expect(job.request).not.toMatch(/\(\s*\d+\s*,\s*\d+\s*\)|\d+\s*[x×]\s*\d+/u);
    }
    expect(set.jobs.filter((job: any) => job.maps === 2).length).toBeGreaterThanOrEqual(3);
  });
  it("보정 씨앗의 조리법은 모두 있고, 조리법이 받는 종류는 검수자의 종류 목록 안에 있다", () => {
    const seed = JSON.parse(readFileSync(resolve(DATA, "calibration.json"), "utf8"));
    for (const decoy of seed.decoys) expect(Object.keys(RECIPE_CLASSES)).toContain(decoy.recipe);
    for (const classes of Object.values(RECIPE_CLASSES)) for (const id of classes) expect(Object.keys(reviewer.classes)).toContain(id);
    for (const positive of seed.positives) for (const expectation of positive.expect) for (const id of expectation.classes) expect(Object.keys(reviewer.classes)).toContain(id);
    // 사용자가 꼽은 종류가 목록에 다 있다.
    for (const id of ["exit-off-road", "road-to-nowhere", "enclosure-unreadable", "passage-mismatch", "invisible-event-misplaced", "empty-expanse", "wrong-surface", "cut-off-piece", "repeated-stamp", "doorless-building", "people-placement"]) {
      expect(Object.keys(reviewer.classes)).toContain(id);
    }
  });
});

describe("맵의 사실 읽기", () => {
  const project = createBlankProject() as any;
  const mapId = project.startMapId;
  it("빈 맵: 모든 칸을 걷고, 네 가장자리가 출구 없이 열려 있다", () => {
    const facts = mapFacts(project, mapId, true);
    expect(facts.walkableShare).toBe(1);
    expect(facts.mainAreaShare).toBe(1);
    expect(facts.openEdges.map((run) => run.edge).sort()).toEqual(["east", "north", "south", "west"]);
    expect(facts.openEdges.every((run) => !run.hasExit)).toBe(true);
    expect(facts.events).toEqual([]);
    expect(factsText(facts)).toContain("STAND-ALONE");
  });
  it("아무것도 그리지 않은 맵은 빈 맵이고, 한 칸이라도 다른 타일이 있으면 아니다", () => {
    const map: any = Object.values((createBlankProject() as any).maps)[0];
    expect(isBlankMap(map)).toBe(true);
    expect(isBlankMap({ ...map, upperTiles: map.upperTiles.map((tile: number, index: number) => index === 7 ? 123 : tile) })).toBe(false);
  });
  it("맨땅 가장자리에 심은 출구는 E 번호표와 가장자리 이름을 달고, 그 구간은 «출구 있음»이 된다", () => {
    const planted = plant("exit-on-bare-edge", project, mapId, mapFacts(project, mapId, true))!;
    expect(planted).not.toBeNull();
    const facts = mapFacts(planted.project, mapId, false);
    const exit = facts.events.find((event) => event.kind === "exit")!;
    expect(exit.tag).toBe("E1");
    expect(exit.edge).toBeDefined();
    expect(exit.visible).toBe(false);
    expect(facts.openEdges.filter((run) => run.hasExit).length).toBe(1);
    expect(planted.region.w * planted.region.h).toBeLessThanOrEqual(9);
  });
  it("안 칠한 구멍은 그 칸들을 모든 층에서 비우고, 원본 문서는 건드리지 않는다", () => {
    const before = JSON.stringify(project.maps[mapId].lowerTiles);
    const planted = plant("unpainted-hole", project, mapId, mapFacts(project, mapId, true))!;
    const map = (planted.project as any).maps[mapId], { x, y, w, h } = planted.region;
    expect([w, h]).toEqual([6, 5]);
    for (let cy = y; cy < y + h; cy += 1) for (let cx = x; cx < x + w; cx += 1) expect(map.lowerTiles[cy * map.width + cx]).toBe(-1);
    expect(JSON.stringify(project.maps[mapId].lowerTiles)).toBe(before);
  });
  it("그 맵에 맞지 않는 조리법은 null 이다(넓게 열린 들판에는 막을 문이 없다)", () => {
    const facts = mapFacts(project, mapId, true);
    for (const recipe of ["wall-off", "locked-text-on-way", "person-on-roof"] as Recipe[]) expect(plant(recipe, project, mapId, facts)).toBeNull();
  });
});

describe("검수자 답 읽기", () => {
  const size = { width: 20, height: 15 };
  const good = { purpose: "마을", checked: { exits: "ok" }, defects: [
    { class: "empty-expanse", severity: "polish", region: { x: 0, y: 0, w: 5, h: 5 }, evidence: "빈 모래" },
    { class: "exit-off-road", severity: "blocker", region: { x: 18, y: 14, w: 9, h: 9 }, evidence: "출구가 맨땅" },
  ] };
  it("결함을 심각한 순으로 놓고 영역을 맵 안으로 자른다", () => {
    const parsed = parseReview(`앞말 ${JSON.stringify(good)} 뒷말`, reviewer, size)!;
    expect(parsed.defects.map((defect) => defect.severity)).toEqual(["blocker", "polish"]);
    expect(parsed.defects[0]!.region).toEqual({ x: 18, y: 14, w: 2, h: 1 });
  });
  it("없는 종류·없는 심각도·빈 근거·JSON 아님은 답이 아니다(null → 그 호출을 다시 한다)", () => {
    const bad = (patch: Record<string, unknown>) => JSON.stringify({ ...good, defects: [{ ...good.defects[0], ...patch }] });
    expect(parseReview(bad({ class: "made-up" }), reviewer, size)).toBeNull();
    expect(parseReview(bad({ severity: "minor" }), reviewer, size)).toBeNull();
    expect(parseReview(bad({ evidence: " " }), reviewer, size)).toBeNull();
    expect(parseReview(bad({ evidence: "The door is blocked." }), reviewer, size)).toBeNull();
    expect(parseReview(bad({ region: { x: "a" } }), reviewer, size)).toBeNull();
    expect(parseReview("괜찮아 보입니다.", reviewer, size)).toBeNull();
    expect(parseReview(JSON.stringify({ purpose: "x" }), reviewer, size)).toBeNull();
  });
  it("결함이 없다는 답은 빈 목록이다", () => {
    expect(parseReview('{"purpose":"방","defects":[]}', reviewer, size)!.defects).toEqual([]);
  });
  it("extractJson 은 글 속의 JSON 한 덩어리를 꺼낸다", () => {
    expect(extractJson('```json\n{"a":[1,2]}\n```')).toEqual({ a: [1, 2] });
    expect(extractJson("없음")).toBeNull();
  });
});

describe("집계와 보정 판정", () => {
  const blocker = { class: "passage-mismatch", severity: "blocker" as const, region: { x: 5, y: 5, w: 2, h: 2 }, evidence: "문이 막힘" };
  const major = { class: "exit-off-road", severity: "major" as const, region: { x: 0, y: 7, w: 1, h: 1 }, evidence: "출구가 맨땅" };
  const polish = { class: "empty-expanse", severity: "polish" as const, region: { x: 10, y: 0, w: 5, h: 5 }, evidence: "빈 곳" };
  it("막힘이 많은 종류가 먼저 오고, 검수자가 답하지 못한 맵은 깨끗한 맵으로 세지 않는다", () => {
    const tally = buildTally([review("a", [blocker, major]), review("b", [major, polish]), review("c", []), review("d", [], "unreviewed")], {}, reviewer);
    expect(tally.totals).toMatchObject({ maps: 4, reviewed: 3, withBlocker: 1, withMajorOrWorse: 2, clean: 1, blocker: 1, major: 2, polish: 1 });
    expect(tally.ranked.map((row) => row.class)).toEqual(["passage-mismatch", "exit-off-road", "empty-expanse"]);
    expect(tally.ranked.map((row) => row.score)).toEqual([3, 2, 0]);
    expect(tally.byClass["exit-off-road"]).toEqual({ blocker: 0, major: 2, polish: 0, maps: 2 });
    expect(tally.unreviewed.map((row) => row.id)).toEqual(["d"]);
  });
  it("심은 결함: major 이상 + 받는 종류 + 자리 겹침이어야 잡은 것이다", () => {
    const planted = { x: 4, y: 4, w: 2, h: 2 };
    expect(caught(review("a", [blocker]), ["passage-mismatch"], planted)).toMatchObject({ strict: true, loose: true });
    // 종류가 다르면 엄격하게는 놓친 것(느슨하게만 잡음).
    expect(caught(review("a", [blocker]), ["repeated-stamp"], planted)).toMatchObject({ strict: false, loose: true });
    // 다듬기 등급으로만 적으면 놓친 것.
    expect(caught(review("a", [{ ...blocker, severity: "polish" }]), ["passage-mismatch"], planted)).toMatchObject({ strict: false, loose: false });
    // 먼 자리의 결함은 그 결함이 아니다.
    expect(caught(review("a", [{ ...blocker, region: { x: 15, y: 12, w: 1, h: 1 } }]), ["passage-mismatch"], planted)).toMatchObject({ strict: false, loose: false });
  });
});

describe("없는 그림 장부", () => {
  it("도구 결과 글에서 «그림이 없다» 신고를 꺼낸다 — 엔딩 그림 이야기는 맵 그림이 아니다", () => {
    const text = [
      '"missingArt":["항구에 정박한 배 (카드 대기: 그림 완성·선택 전, 맵에 없음)"]',
      "「항구에 정박한 배」 그리기 카드를 대기열에 올렸다(floor, 2×1칸 — 놓을 자리 (51,22) 칸 (51,22), 칩셋 beodeul_city). 아직 그려지지 않았고",
      "「고대 유적 석조 입구」과(와) 이름이 맞는 기물이 이 칩셋에 이미 있다 — 새로 그리지 말고 이것을 써라: bd-mpart-ivy-arch(담쟁이 아치(정원 입구)) → stamp_object(",
      "협탁(12,5) — N 쪽을 보는 그림이 없다(그대로 둠)",
      "고침: 방 곁굴 의 특징 crystals 은 놓을 빈 바닥·그림이 없어 빠졌다.",
      " ✗blocked ships 항구에 드나드는 배 표현하기 — 배 그림이 아직 공방 대기 중이라 배치할 objectId가 없고",
      " ✓ g7 [출하 차단 ending-closure] 엔딩 「도시의 숨」이 장면으로 맺지 않는다: 마지막 그림이 없다 — presentation.backgroundResourceId",
    ].join("\n");
    const reports = toolReportsIn("make_place", text);
    expect(reports.map((report) => `${report.kind}:${report.thing}`)).toEqual([
      "missing-art:항구에 정박한 배", "card-queued:항구에 정박한 배", "stand-in-offered:고대 유적 석조 입구", "no-direction-art:협탁 (N 쪽을 보는 그림)", "feature-dropped:crystals", "blocked-todo:항구에 드나드는 배 표현하기",
    ]);
    expect(reports.find((report) => report.kind === "card-queued")!.chipset).toBe("beodeul_city");
    expect(reports.find((report) => report.kind === "stand-in-offered")!.instead).toContain("bd-mpart-ivy-arch");
    expect(toolReportsIn("todo", "엔딩 「도시의 숨」: 마지막 그림이 없다")).toEqual([]);
  });
  it("검수자 답: 이름은 한국어, 가리킨 곳은 request·event·label 가운데 하나여야 한다", () => {
    const size = { width: 20, height: 15 };
    const good = parseArtReview('{"theme":"사막 시장","missing":[{"thing":"노점","count":3,"named_by":"label","where":{"x":1,"y":2,"w":30,"h":2},"instead":"맨바닥"}],"wrong_theme":[{"thing":"battle-scenery-forest","kind":"backdrop","fitting":"사막 전투 배경","why":"숲 배경"}]}', size)!;
    expect(good.missing[0]).toMatchObject({ thing: "노점", count: 3, namedBy: "label", instead: "맨바닥", unsure: false });
    expect(good.wrongTheme[0]).toMatchObject({ kind: "backdrop", fitting: "사막 전투 배경" });
    expect(parseArtReview('{"missing":[{"thing":"stall","named_by":"label"}],"wrong_theme":[]}', size)).toBeNull();
    expect(parseArtReview('{"missing":[{"thing":"노점","named_by":"story"}],"wrong_theme":[]}', size)).toBeNull();
    expect(parseArtReview('{"missing":[]}', size)).toBeNull();
    expect(parseArtReview('{"missing":[],"wrong_theme":[]}', size)).toEqual({ theme: "", missing: [], wrongTheme: [] });
  });
  it("장부: 같은 것으로 묶인 이름은 한 줄이고, 바란 실행이 많은 것이 먼저 온다", () => {
    const where = (group: string, label: string) => ({ group, label, chipset: "beodeul_city", theme: "" });
    const rows = buildArtGaps([
      { source: "reviewer", thing: "좌판", instead: "맨바닥", where: where("A:r1", "m1") },
      { source: "reviewer", thing: "노점", instead: "맨바닥", where: where("A:r2", "m2") },
      { source: "tool", thing: "배", instead: "없음", where: where("B:harbor", "맵 깔기 harbor") },
      { source: "reviewer", thing: "배", instead: "", unsure: true, where: where("B:harbor", "m3") },
      { source: "theme", thing: "사막 전투 배경", instead: "battle-scenery-forest", kind: "backdrop", where: where("A:r1", "m1") },
    ], { 좌판: "노점" });
    expect(rows.map((row) => [row.thing, row.runs, row.maps])).toEqual([["노점", 2, 2], ["배", 1, 2], ["사막 전투 배경", 1, 1]]);
    expect(rows[0]).toMatchObject({ fromReviewer: 2, fromTools: 0, unsureOnly: false, instead: ["맨바닥"], names: ["좌판", "노점"] });
    expect(rows[1]).toMatchObject({ fromReviewer: 1, fromTools: 1, unsureOnly: false });
    expect(rows[2]).toMatchObject({ wrongTheme: 1, instead: ["battle-scenery-forest"] });
  });
});

describe("종류 안의 되풀이 묶기", () => {
  const lines = [
    { id: 1, label: "마을", severity: "major", evidence: "문이 막혔다" },
    { id: 2, label: "마을", severity: "blocker", evidence: "문이 막혔다" },
    { id: 3, label: "항구", severity: "major", evidence: "물이 걸어진다" },
  ];
  it("모든 줄이 정확히 한 묶음에 들어야 답이고, 건수·맵 수는 배정에서 센다", () => {
    const groups = parsePatterns(JSON.stringify({ groups: [{ pattern: "걸어지는 물", fix_hint: "물 칸을 막는다", ids: [3] }, { pattern: "막힌 문", fix_hint: "문 칸을 연다", ids: [1, 2] }] }), lines)!;
    expect(groups.map(group => [group.pattern, group.count, group.blocker, group.maps])).toEqual([["막힌 문", 2, 1, 1], ["걸어지는 물", 1, 0, 1]]);
  });
  it("빠진 줄 · 두 번 든 줄 · 없는 번호 · 한국어가 아닌 이름은 답이 아니다", () => {
    expect(parsePatterns(JSON.stringify({ groups: [{ pattern: "막힌 문", ids: [1, 2] }] }), lines)).toBeNull();
    expect(parsePatterns(JSON.stringify({ groups: [{ pattern: "막힌 문", ids: [1, 2, 3] }, { pattern: "걸어지는 물", ids: [3] }] }), lines)).toBeNull();
    expect(parsePatterns(JSON.stringify({ groups: [{ pattern: "막힌 문", ids: [1, 2, 3, 4] }] }), lines)).toBeNull();
    expect(parsePatterns(JSON.stringify({ groups: [{ pattern: "blocked door", ids: [1, 2, 3] }] }), lines)).toBeNull();
  });
});

describe("HUD 화면 검수(답 읽기와 집계)", () => {
  it("검수자 답: 큰 결함이 먼저 오고, 없는 종류·blocker·한국어 아닌 근거·screen 없음은 답이 아니다", () => {
    const ok = parseHudReview('{"screen":"왼쪽 위 마력 막대, 오른쪽 위 목표 줄","defects":[{"class":"objective-text","severity":"polish","evidence":"목표 글이 두 줄로 어색하게 끊긴다"},{"class":"unused-gauge","severity":"major","evidence":"«마력 43/43» 막대가 혼자 떠 있다"}]}');
    expect(ok?.defects.map(defect => [defect.class, defect.severity])).toEqual([["unused-gauge", "major"], ["objective-text", "polish"]]);
    expect(parseHudReview('{"screen":"x","defects":[{"class":"nope","severity":"major","evidence":"한글"}]}')).toBeNull();
    expect(parseHudReview('{"screen":"x","defects":[{"class":"other","severity":"blocker","evidence":"한글"}]}')).toBeNull();
    expect(parseHudReview('{"screen":"x","defects":[{"class":"other","severity":"major","evidence":"english only"}]}')).toBeNull();
    expect(parseHudReview('{"defects":[]}')).toBeNull();
  });
  it("집계: 검수 못 한 화면은 세지 않고, 건너뛴 게임은 게임 수에 안 들며, 보정 전이라고 적는다", () => {
    const shot = (id: string, group: string, status: HudShot["status"], defects: HudShot["defects"]): HudShot => ({ id, group, label: `${group} · ${id}`, mapName: id, start: false, file: "", chip: null, status, screen: "", defects });
    const tally = buildHudTally([
      shot("a", "A:g1", "reviewed", [{ class: "unused-gauge", severity: "major", evidence: "마력" }]),
      shot("b", "A:g1", "reviewed", [{ class: "unused-gauge", severity: "major", evidence: "마력" }, { class: "unreadable", severity: "polish", evidence: "글" }]),
      shot("c", "A:g2", "reviewed", []),
      shot("d", "A:g2", "unreviewed", []),
    ], [{ group: "A:g1", label: "g1", factsText: "", unused: ["mp"] }, { group: "A:g2", label: "g2", factsText: "", unused: [] }, { group: "B:x", label: "x", factsText: "", unused: [], skipped: "건너뜀" }], {});
    expect(tally.totals).toMatchObject({ games: 2, shots: 4, reviewed: 3, unreviewed: 1, shotsWithMajor: 2, gamesWithMajor: 1, major: 2, polish: 1 });
    expect(tally.ranked.map(row => [row.class, row.major, row.polish, row.shots, row.games])).toEqual([["unused-gauge", 2, 0, 2, 1], ["unreadable", 0, 1, 1, 1]]);
    expect(tally.calibration.status).toBe("uncalibrated");
  });
});
