// 화면 검수 판정 규칙(2026-11-11 J-B2): 같은 결함 가르기 · 항목 열쇠 · 급(막음/다듬기) · 자동 오프닝 · 찍을 자리.
// 결함 글은 Terra 판 기록(jrpg-w3 · fun-w3, 2026-11-10)에서 그대로 가져왔다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { TodoStore } from "@/ai/v2/loop/todoStore";
import { editorDefaultsLeft } from "@/ai/v2/shipChecks";
import { closeVqaUnchanged, noteVqaRound, vqaLedgerLines, type VqaFinding } from "@/ai/v2/turn/vqaItems";
import { reviewVqaRound, vqaClassify, vqaDefectLine, vqaFixCall, vqaSameDefect, vqaShotPlan, type VqaDefect, type VqaRound } from "@/ai/v2/vqa";

const START_WHERE = "맵 «별샘 오아시스» (44×36칸 · 시작 맵 · 주인공은 게임에서만 그려짐, 시작 칸 19,35)";
const onMap = (ref: string, what: string, severity: VqaDefect["severity"] = "polish", where = `맵 «${ref}» (20×15칸) · 어딘가`): VqaDefect => ({ where, what, severity, target: { kind: "map", ref } });
const onOpening = (ref: string, what: string, severity: VqaDefect["severity"] = "blocker"): VqaDefect => ({ where: "오프닝 1/4 (애니메틱 시작·중간·끝) · 세 컷 전체", what, severity, target: { kind: "opening", ref } });
const round = (n: number, defects: VqaDefect[], shots: VqaRound["shots"] = [{ where: "", kind: "map", ref: "tomb" }, { where: "", kind: "map", ref: "start" }, { where: "", kind: "map", ref: "lake" }, { where: "", kind: "map", ref: "hall" }]): VqaRound => ({ round: n, shots, defects, ms: 0, reviewer: "test" });

describe("vqaSameDefect — the defect itself, not the location prefix", () => {
  const same: [string, string][] = [
    ["애니메틱 세 컷 중 한 칸이 아무것도 없는 짙은 남색 빈 블록으로 남아 있어 미완성처럼 보인다.", "애니메틱 세 컷 중 한 칸이 아무것도 없는 짙은 남색 빈 블록으로 그대로 남아 있어 미완성처럼 보인다."],
    ["붉은 용 스프라이트가 윗벽 장식 띠에 겹쳐 반쯤 벽 속에 박힌 것처럼 보인다.", "붉은 용 스프라이트의 머리가 윗벽 장식 띠에 맞닿아 벽에 박힌 것처럼 보인다."],
    ["피라미드 맵의 대부분이 빈 모래 바닥이고 상호작용할 만한 오브젝트가 드물다.", "맵의 상당 부분이 빈 모래 바닥이고 상호작용할 만한 오브젝트가 드물다."],
    ["긴 집 내부의 하단 절반이 가구 없이 빈 나무 바닥으로 남아 있어 족장의 방으로는 휑하다.", "긴 집 내부의 하단 절반이 가구 없이 빈 나무 바닥이라 족장의 방으로는 휑하다."],
    ["인물이 벽난로 옆 벽 타일 줄에 걸쳐 서 있는 것처럼 보여, 벽이나 벽난로에 겹쳐 박힌 배치로 읽힌다.", "인물이 벽난로 옆 벽 타일 줄에 걸쳐 서 있어 벽이나 벽난로에 겹친 배치로 보인다."],
    ["호수가 나무 윤곽처럼 이상하게 생겼고, 길이 호수 한가운데로 줄기처럼 끊겨 들어가 어색하다.", "호수가 나무 윤곽처럼 어색한 모양이고 길이 호수 한가운데로 줄기처럼 끊겨 들어가며, 얼음 한복판에 집 두 채가 놓여 있어 부자연스럽다."],
  ];
  const different: [string, string][] = [
    ["붉은 용 스프라이트가 윗벽 장식 띠에 겹쳐 반쯤 벽 속에 박힌 것처럼 보인다.", "보물상자가 방의 오른쪽 벽 경계에 걸쳐 있어 벽에 묻힌 것처럼 보이고 다가가기 어렵다."],
    ["시작 칸 19,35가 맵 이미지 범위(약 30×25칸) 밖이라 주인공이 맵 바깥에서 시작하게 되어 게임을 시작할 수 없다.", "왼쪽 길이 위쪽 건물에 막혀 끝나 어디로도 이어지지 않는 막다른 길이다."],
    ["인물이 벽난로 옆 벽 타일 줄에 걸쳐 서 있는 것처럼 보여, 벽이나 벽난로에 겹쳐 박힌 배치로 읽힌다.", "상자가 어두운 바깥 벽 테두리에 붙어 잘린 것처럼 놓여 있어 방 안쪽 바닥 위의 가구로 보이지 않는다."],
    ["방이 작은데도 왼쪽 아래 절반이 빈 타일 바닥에 항아리 하나뿐이라 휑하다.", "탁자, 방석, 카펫이 서로 겹쳐 배치되어 가구 층이 뒤엉켜 보인다."],
    ["오두막 두 채가 얼음 위에 놓여 있고 호수 모양이 나무 같은 덩어리 형태여서, 얼음낚시 구멍과 함께 배치가 어색하다.", "배가 물이나 얼음 위가 아니라 호수 바깥 눈밭과 나무 사이에 놓여 있어 배치가 어색하다."],
    ["붉은 점무늬 디더링 오버레이가 장면을 거의 가려 낙타와 건물이 알아보기 어렵다.", "애니메틱 세 컷 중 한 칸이 아무것도 없는 짙은 남색 빈 블록으로 남아 있어 미완성처럼 보인다."],
  ];
  it.each(same)("same defect reworded: %s", (a, b) => {
    expect(vqaSameDefect(onMap("m", a, "polish", `${START_WHERE} · 위쪽`), onMap("m", b, "blocker", `${START_WHERE} · 오른쪽 아래`))).toBe(true);
  });
  it.each(different)("different defects on the same map with the same location prefix: %s", (a, b) => {
    expect(vqaSameDefect(onMap("m", a, "polish", `${START_WHERE} · 시작 칸 19,35 (맵 전체)`), onMap("m", b, "polish", `${START_WHERE} · 시작 칸 19,35 (맵 전체)`))).toBe(false);
  });
  it("the same words on another target are another defect (opening 1/4 vs 4/4)", () => {
    const what = "오프닝 컷 구성에 빈 남색 블록이 그대로 노출되어 있다.";
    expect(vqaSameDefect(onOpening("scene-1", what), onOpening("scene-4", what))).toBe(false);
    expect(vqaSameDefect(onOpening("scene-1", what), onOpening("scene-1", what))).toBe(true);
  });
});

function gameProject(): Project {
  const p = createBlankProject() as Project;
  const start = p.maps[p.startMapId]!;
  start.name = "별샘 오아시스";
  p.startPos = { x: 3, y: 4 } as Project["startPos"];
  p.system.opening = {
    enabled: true, skippable: true,
    scenes: [
      { id: "bp-open-1", kind: "animatic", narration: "", durationMs: 4000, composition: { width: 384, height: 216, layers: [] } },
      { id: "mine-1", kind: "animatic", narration: "", durationMs: 4000, composition: { width: 384, height: 216, layers: [] } },
    ],
  } as never;
  return p;
}

describe("vqaShotPlan", () => {
  it("gives every map shot its size in cells and every animatic shot its own target", () => {
    const p = gameProject();
    const start = p.maps[p.startMapId]!;
    const plan = vqaShotPlan(p, new Set());
    const map = plan.find((s) => s.kind === "map" && s.ref === p.startMapId)!;
    expect(map.where).toContain(`${start.width}×${start.height}칸`);
    expect(map.where).toContain("시작 칸 3,4");
    expect(plan.filter((s) => s.kind === "opening").map((s) => s.ref)).toEqual(["mine-1", "bp-open-1"]);
  });
  it("puts auto-built map-crop opening shots after the maps", () => {
    const plan = vqaShotPlan(gameProject(), new Set());
    expect(plan.findIndex((s) => s.ref === "bp-open-1")).toBeGreaterThan(plan.findIndex((s) => s.kind === "map"));
    expect(plan.findIndex((s) => s.ref === "mine-1")).toBeLessThan(plan.findIndex((s) => s.kind === "map"));
  });
  it("photographs the staged opening around its cell", () => {
    const p = gameProject();
    const start = p.maps[p.startMapId]!;
    p.system.opening!.stage = { mapId: start.id, x: 2, y: 2, eventId: "ev_opening_stage" };
    const stage = vqaShotPlan(p, new Set()).find((s) => s.region)!;
    expect(stage.kind).toBe("opening");
    expect(stage.ref).toBe(`stage:${start.id}:ev_opening_stage`);
    expect(stage.region!.mapId).toBe(start.id);
    expect(stage.region!.x).toBe(0);
    expect(stage.region!.w).toBeLessThanOrEqual(start.width);
    expect(stage.where).toContain("오프닝 무대");
  });
  it("tells the reviewer the map size instead of letting it estimate from pixels", async () => {
    const p = gameProject();
    let prompt = "";
    const shots = vqaShotPlan(p, new Set()).filter((s) => s.kind === "map").map((s) => ({ where: s.where, kind: s.kind, ref: s.ref!, image: "data:," }));
    await reviewVqaRound({ task: "판타지 RPG 게임 하나 만들어 줘.", shots, round: 1, previous: [], reviewer: "test", chat: async (messages) => { prompt = (messages[0] as { content: { text?: string }[] }).content[0]!.text ?? ""; return '{"defects":[]}'; } });
    expect(prompt).toContain("칸 · 시작 맵");
    expect(prompt).toMatch(/Never estimate the map size/u);
  });
});

describe("vqaClassify — auto-built opening is a builder defect by fact", () => {
  it.each([
    ["오프닝 컷이 건물 벽과 모래 타일만 확대한 맵 조각이라 인물이나 사건 같은 이야기 내용이 전혀 보이지 않는다.", "blocker"],
    ["오프닝 2/4가 긴 집 내부 맵을 그대로 잘라 낸 장면이고 주인공이나 NPC가 없다.", "polish"],
  ] as const)("bp-open scene: %s", (what, severity) => {
    const c = vqaClassify(onOpening("bp-open-2", what, severity));
    expect(c.fixable).toBe(false);
    expect(c.kind).toBe("builder-opening");
  });
  it("the same wording on a scene the model authored is model work, fixed by restaging — never by turning the opening off", () => {
    const d = onOpening("mine-1", "오프닝 컷이 건물 벽과 모래 타일만 확대한 맵 조각이라 인물이나 사건 같은 이야기 내용이 전혀 보이지 않는다.");
    expect(vqaClassify(d).fixable).toBe(true);
    expect(vqaFixCall(d)).toContain("author_opening_stage");
    expect(vqaDefectLine(d, 0)).toContain("do not turn the opening off");
  });
  it("the ship gate's opening line does not offer turning the opening off either", () => {
    const line = editorDefaultsLeft(createBlankProject() as Project).find((b) => b.id === "opening")!.message;
    expect(line).toContain("author_opening_stage");
    expect(line).not.toMatch(/enabled:false\} 로 끈다/u);
  });
});

describe("noteVqaRound — findings ↔ todo items", () => {
  const dragon = onMap("tomb", "붉은 용 스프라이트가 윗벽 장식 띠에 겹쳐 반쯤 벽 속에 박힌 것처럼 보인다.", "blocker");
  const dragonAgain = onMap("tomb", "붉은 용 스프라이트의 머리가 윗벽 장식 띠에 맞닿아 벽에 박힌 것처럼 보인다.", "blocker");
  const chest = onMap("tomb", "보물상자가 방의 오른쪽 벽 경계에 걸쳐 있어 벽에 묻힌 것처럼 보이고 다가가기 어렵다.", "blocker");
  const sparse = onMap("hall", "긴 집 내부의 하단 절반이 가구 없이 빈 나무 바닥으로 남아 있어 족장의 방으로는 휑하다.");
  const boat = onMap("lake", "배가 물이나 얼음 위가 아니라 호수 바깥 눈밭과 나무 사이에 놓여 있어 배치가 어색하다.");
  const crop = onOpening("bp-open-1", "오프닝이 인물도 사건도 없는 통나무집 외관 맵 캡처 한 장뿐이다.");
  const project = createBlankProject() as Project;

  function firstRound() {
    const book: VqaFinding[] = [];
    const store = new TodoStore();
    const out = noteVqaRound(book, store, round(1, [dragon, sparse, boat, crop]), project);
    return { book, store, out };
  }

  it("round 1: blockers and polish with a fix call become items; outside and call-less polish stay in the ledger", () => {
    const { store, out, book } = firstRound();
    expect(out.offered).toEqual([dragon, sparse]);
    expect(out.outside.map((f) => f.defect)).toEqual([crop]);
    expect(store.items.map((i) => i.severity)).toEqual([undefined, "polish"]);
    expect(vqaLedgerLines(book, store).join("\n")).toContain("배가 물이나 얼음 위가 아니라");
    expect(vqaLedgerLines(book, store).join("\n")).toContain("builder-opening");
  });

  it("round 2: an unrelated defect on the same map is a new item, not «stuck»; the repeated one closes with its own reason", () => {
    const { book, store } = firstRound();
    const [dragonItem, sparseItem] = store.items;
    store.markOffered();
    for (const item of [...store.items]) store.done(item, undefined);
    const content = dragonItem!.content;
    const out = noteVqaRound(book, store, round(2, [chest, dragonAgain]), project);
    expect(out.offered).toEqual([chest]);
    expect(out.left.map((f) => f.itemId)).toEqual([dragonItem!.id]);
    expect(dragonItem!.status).toBe("blocked");
    expect(dragonItem!.blockedReason).toContain("붉은 용");
    expect(dragonItem!.blockedReason).not.toContain("보물상자");
    expect(dragonItem!.content).toBe(content);
    expect(store.holds(dragonItem!)).toBe(true);
    // 빈 방 결함은 2판에 없다 — 조수가 닫은 대로 끝.
    expect(sparseItem!.status).toBe("completed");
    const chestItem = store.items.at(-1)!;
    expect(chestItem.content).toContain("보물상자");
    expect(chestItem.status).not.toBe("blocked");
  });

  it("an item is keyed by its defect: a new turn's round 1 never rewrites it with another defect", () => {
    const { store } = firstRound();
    const before = store.items.map((i) => [i.id, i.content]);
    // 새 턴 = 새 장부, 1판부터 다시. 옛 순번 열쇠(vqa:1:0)였다면 첫 항목이 «보물상자»로 덮였다.
    noteVqaRound([], store, round(1, [chest]), project);
    expect(store.items.slice(0, before.length).map((i) => [i.id, i.content])).toEqual(before);
    expect(store.items).toHaveLength(before.length + 1);
  });

  it("polish seen again is kept as «remaining polish»: it does not hold completion and is not reopened", () => {
    const { book, store } = firstRound();
    const sparseItem = store.items[1]!;
    store.markOffered();
    for (const item of [...store.items]) store.done(item, undefined);
    noteVqaRound(book, store, round(2, [sparse]), project);
    expect(sparseItem.status).toBe("blocked");
    expect(store.holds(sparseItem)).toBe(false);
    // 3판에도 그대로 — 다시 열지 않는다.
    const out = noteVqaRound(book, store, round(3, [sparse]), project);
    expect(out.opened).toEqual([]);
    expect(sparseItem.status).toBe("blocked");
    // 다음 턴 «계속»에서도 다시 열지 않는다.
    const next = new TodoStore();
    next.restore(JSON.parse(JSON.stringify({ ...store.serialize("계속"), items: [...store.items, { id: "t9", phase: "p", content: "열린 일", status: "pending", attempts: 0, source: "model" }] })));
    expect(next.get(sparseItem.id)!.status).toBe("blocked");
  });

  it("a defect whose picture was not taken this round is not «gone»", () => {
    const { book, store } = firstRound();
    const dragonItem = store.items[0]!;
    store.markOffered();
    store.block(dragonItem, "옮길 칸을 찾지 못함");
    noteVqaRound(book, store, round(2, [], [{ where: "", kind: "map", ref: "start" }]), project);
    expect(dragonItem.status).toBe("blocked");
    noteVqaRound(book, store, round(3, []), project);
    expect(dragonItem.status).toBe("completed");
  });

  it("offers nothing once no round is left to look again (polish 3, blockers 5)", () => {
    const store = new TodoStore();
    expect(noteVqaRound([], store, round(3, [sparse]), project).opened).toEqual([]);
    expect(noteVqaRound([], store, round(3, [dragon]), project).opened).toHaveLength(1);
    const book: VqaFinding[] = [];
    expect(noteVqaRound(book, new TodoStore(), round(5, [chest]), project).opened).toEqual([]);
    expect(vqaLedgerLines(book, new TodoStore())[0]).toContain("판이 남지 않아 건네지 못함");
  });

  it("a round that could not be reviewed changes nothing", () => {
    const { book, store } = firstRound();
    const before = JSON.stringify(store.items);
    expect(noteVqaRound(book, store, { ...round(2, []), problem: "검수자 빈 답" }, project).opened).toEqual([]);
    expect(JSON.stringify(store.items)).toBe(before);
  });

  it("nothing changed after the hand-off: handed items close as still there, even ones the model marked done", () => {
    const { book, store } = firstRound();
    store.markOffered();
    for (const item of [...store.items]) store.done(item, undefined);
    const left = closeVqaUnchanged(book, store);
    expect(left).toHaveLength(2);
    expect(store.items.map((i) => i.status)).toEqual(["blocked", "blocked"]);
    expect(store.items.map((i) => store.holds(i))).toEqual([true, false]);
  });
});
