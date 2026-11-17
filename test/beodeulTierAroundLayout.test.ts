// 큰 건물 문 뒤에 모델이 방이 모자란 배치를 보냈을 때 — 2026-11-17 r8 실모델(«갈매나루», Opus 5.5 medium)의 녹화 호출로 본다.
//  D1: 모델은 hints.door [8,27](첨탑 성당, xlarge)과 제 배치(24×22, 방 셋)를 같이 보냈고 빌더는 알림만 붙였다 — 초대형 구성이 한 번도 서지 않았다.
//      이제 모델의 배치를 본채의 큰 방으로 그대로 두고 구성의 나머지 방 · 맵을 둘레에 지어 잇는다. hints.rooms 1 이면 배치 그대로.
//  D2: hints.door 없이 v5 낱말로 쓴 여관이 v5 로 깔려 한 게임에 실내 칩셋이 둘이었다 — 이제 그 게임의 표로 깔고 바꾼 것을 알린다.
//  D3: 모델의 배치로 깐 여관이 다음 턴에 «배치 실내가 아니다» 로 거절됐다 — 맵이 그 배치의 선언을 지니면 기록을 이어 받는다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import type { ToolContext } from "@/editor/tools/types";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { withTodoLoop } from "@/ai/v2/loop/todoTools";
import { V2Session } from "@/ai/v2/turn/session";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import { indexProject } from "@/ai/v2/loop/refs";
import { loadPlaces, savePlaces } from "@/ai/v2/tools/placeMemory";

const SLOW = 300_000;
const F = JSON.parse(readFileSync(new URL("./fixtures/r8-galmae-cathedral.json", import.meta.url), "utf8")) as { village: Record<string, unknown>; calls: Record<string, Record<string, unknown>> };
const TASK = "포구 마을 «갈매나루»에서 시작하는 짧은 JRPG 를 만들어 줘. 광장 곁에는 마을에서 가장 큰 건물인 대성당이 있는데, 안에 들어가면 넓은 예배당이야. 대성당 지하에서 옛 지하 묘지로 내려가.";
type Res = { ok: boolean; mapIds: string[]; summary: string; warnings: string[] };

function turn(project?: Project) {
  const p = project ?? (() => { const b = createBlankProject(); b.maps[b.startMapId] = { ...(F.village as object), id: b.startMapId } as never; return b; })();
  const ctx: ToolContext = { project: p, currentMapId: p.startMapId, assistantRun: true };
  const env = { ctx, request: { task: TASK, provider: "local-cli:claude", mapIds: [], project: p, projectKey: "r8-fixture" } as never, emit: () => {}, record: () => {}, sideChat: async () => JSON.stringify({ score: 7, majors: [] }), checkpoint: async () => {},
    preferToolNextTurn: () => {}, clearToolPreference: () => {} } as unknown as PiAssistantV2Env;
  const session = new V2Session();
  const tools = withTodoLoop(env, session.todo, session.loop, createV2Tools(env, session), session.hooks);
  const call = async (name: string, args: unknown): Promise<string[]> => (await tools.find((t) => t.name === name)!.execute(`c-${name}`, args)).content.filter((c) => c.type === "text").map((c) => (c as { text?: string }).text ?? "");
  /** dungeonBelow false = 청사진에서 대성당 아래 던전 장소를 뺀다(구성의 지하 묘 맵이 선다). */
  const start = async (dungeonBelow: boolean) => {
    await call("todo", { op: "init", list: [{ phase: "p", items: [{ content: "대성당", id: "c", check: { kind: "none" } }] }] });
    const bp = F.calls["001.2"] as { places: { kind: string }[] };
    await call("write_blueprint", dungeonBelow ? bp : { ...bp, places: bp.places.filter((pl) => pl.kind !== "dungeon") });
  };
  const make = async (spec: unknown): Promise<Res> => JSON.parse((await call("make_place", { spec }))[0]!) as Res;
  return { ctx, session, call, start, make };
}
/** 맵에 깐 칸 배치 선언(기물 · 랜드마크). */
const declOf = (p: Project, mapId: string) => JSON.parse(String((p.maps[mapId]!.locations ?? []).find((l) => (l.tags ?? []).includes("interior-layout") && (l.tags ?? []).includes("decl"))!.note)) as { objects: { id: string; x: number; y: number }[]; landmark?: { id: string; x: number; y: number } };
const roomsOn = (p: Project, mapId: string) => (p.maps[mapId]!.locations ?? []).filter((l) => (l.tags ?? []).includes("hand-layout-room")).length;
/** 이 맵의 이벤트가 옮겨 가는 다른 맵들(맵 id → 이벤트 수). */
const transfersFrom = (p: Project, mapId: string) => {
  const out = new Map<string, number>();
  for (const e of p.maps[mapId]!.events ?? []) for (const pg of e.pages ?? []) for (const c of (pg.commands ?? []) as unknown as { kind?: string; mapId?: string }[]) if (c.kind === "transfer" && c.mapId && c.mapId !== mapId) out.set(c.mapId, (out.get(c.mapId) ?? 0) + 1);
  return out;
};

describe("r8 대성당 — 모델의 배치가 큰 건물의 본당이 되고 구성의 방 · 맵이 둘레에 선다", () => {
  const cathedral = F.calls["001.7"]!;

  it("청사진에 대성당 지하의 던전이 있으면: 방 여덟 이상 · 모델의 본당 기물은 제자리(옮긴 만큼) · 지하 맵을 따로 짓지 않는다", async () => {
    const t = turn();
    await t.start(true);
    const r = await t.make(cathedral);
    expect(r.ok, r.summary).toBe(true);
    expect(r.summary).toMatch(/the building outside is xlarge \(bd-house-cathedral\), so your layout is laid as its main hall and the xlarge plan is built around it — (\d+) rooms on \d+ map\(s\)/u);
    const rooms = r.mapIds.reduce((n, id) => n + roomsOn(t.ctx.project, id), 0);
    expect(rooms, r.summary).toBeGreaterThanOrEqual(8);
    // 모델의 배치: 방 · 랜드마크 · 기물이 그대로 — 좌표만 옮긴 만큼
    const shift = /every coordinate moved by \(\+(\d+),\+(\d+)\)/u.exec(r.summary)!;
    const [dx, dy] = [Number(shift[1]), Number(shift[2])];
    const decl = declOf(t.ctx.project, r.mapIds[0]!);
    const L = cathedral.layout as { landmark: { id: string; x: number; y: number }; objects: { id: string; x: number; y: number; repeat?: { count?: number; dx?: number; dy?: number } }[] };
    expect(decl.landmark).toMatchObject({ id: L.landmark.id, x: L.landmark.x + dx, y: L.landmark.y + dy });
    const pews = L.objects.filter((o) => o.id === "pew").flatMap((o) => Array.from({ length: o.repeat?.count ?? 1 }, (_, k) => `${o.x + dx + k * (o.repeat?.dx ?? 0)},${o.y + dy + k * (o.repeat?.dy ?? 0)}`));
    const laid = new Set(decl.objects.filter((o) => o.id === "pew").map((o) => `${o.x},${o.y}`));
    expect(pews.length).toBeGreaterThan(10);
    for (const p of pews) expect(laid.has(p), p).toBe(true);
    for (const id of ["nave", "stairroom", "vestry"]) expect(r.summary).toContain(id);
    // 내려가는 길은 하나 — 청사진의 «옛 지하 묘지» 가 그 아래다(구성의 지하 묘 맵은 짓지 않고 그렇게 적는다)
    expect(r.summary).toContain("your blueprint's «옛 지하 묘지» is reached from this place");
    expect(r.mapIds.map((id) => t.ctx.project.maps[id]!.name)).not.toContain("갈매나루 대성당 · 지하 묘");
    // 결과 글은 영어로 붙인 방과 문 자리를 적는다
    expect(r.summary).toMatch(/Added rooms [^:]*: [a-z /]+ at \(\d+,\d+\)–\(\d+,\d+\), door \(\d+,\d+\)/u);
    expect(t.ctx.project.maps[r.mapIds[0]!]!.tilesetId).toBe("beodeul_city");
  }, SLOW);

  it("청사진에 그 아래 던전이 없으면 구성의 지하 묘 맵을 짓고 모델의 «stairs down» 하나로만 잇는다 — 내려가는 길은 하나다", async () => {
    const t = turn();
    await t.start(false);
    const r = await t.make(cathedral);
    expect(r.ok, r.summary).toBe(true);
    const crypt = r.mapIds.find((id) => t.ctx.project.maps[id]!.name === "갈매나루 대성당 · 지하 묘");
    expect(crypt, r.summary).toBeTruthy();
    const rooms = r.mapIds.reduce((n, id) => n + roomsOn(t.ctx.project, id), 0);
    expect(rooms, r.summary).toBeGreaterThanOrEqual(8);
    const down = () => [...transfersFrom(t.ctx.project, r.mapIds[0]!)].filter(([id]) => /지하 묘/u.test(t.ctx.project.maps[id]?.name ?? ""));
    expect(down()).toHaveLength(1);
    expect(down()[0]![1]).toBe(1);
    expect(r.summary).toMatch(/crypt map «갈매나루 대성당 · 지하 묘» \(map_[^)]+\) — reached by the stairs down at \(\d+,\d+\)/u);
  }, SLOW);

  it("hints.rooms 1 이면 모델의 배치 그대로 — 겉은 초대형이지만 안은 청한 대로라고 적는다", async () => {
    const t = turn();
    await t.start(true);
    const r = await t.make({ ...cathedral, hints: { ...(cathedral.hints as object), rooms: 1 } });
    expect(r.ok, r.summary).toBe(true);
    expect(r.mapIds).toHaveLength(1);
    expect(roomsOn(t.ctx.project, r.mapIds[0]!)).toBe(3);
    expect(r.warnings.join(" ")).toContain("the building outside is xlarge (bd-house-cathedral), but the inside is one room as you asked (hints.rooms 1)");
  }, SLOW);
});

describe("r8 여관 — 한 게임 한 실내 칩셋, 다음 턴에도 고칠 수 있다", () => {
  it("hints.door 없이 v5 낱말로 쓴 여관은 그 게임의 표(버들항)로 깔고 바꾼 조각을 한 줄씩 알린다 — 거절하지 않는다", async () => {
    const t = turn();
    await t.start(true);
    const r = await t.make(F.calls["001.127"]);
    expect(r.ok, r.summary).toBe(true);
    expect(t.ctx.project.maps[r.mapIds[0]!]!.tilesetId).toBe("beodeul_city");
    expect(r.warnings.join(" ")).toContain("laid with this game's interior chipset beodeul_city");
    expect(r.warnings).toContain('swapped piece "roundtable" → "round table" (not in this chipset\'s table — its nearest id)');
    expect(r.warnings.some((w) => /^swapped piece "bed blue" ×2 → "[^"]*bed"/u.test(w)), r.warnings.join("\n")).toBe(true);
  }, SLOW);

  it("깐 뒤 맵에 무엇을 찍어 지문이 바뀌어도, 맵이 그 배치의 선언을 지니면 다음 턴이 기록을 이어 받는다(review_layout 이 그 맵을 안다)", async () => {
    const t = turn();
    await t.start(true);
    const r = await t.make(F.calls["001.127"]);
    expect(r.ok, r.summary).toBe(true);
    const mapId = r.mapIds[0]!;
    const memory = savePlaces(t.session, t.ctx.project, indexProject(t.ctx.project));
    // 턴 끝 뒤에 맵이 바뀌었다(찍은 기물 한 칸)
    const later = structuredClone(t.ctx.project);
    const m = later.maps[mapId]!;
    later.maps[mapId] = { ...m, upperTiles: m.upperTiles.map((v, i) => (i === m.width * 9 + 12 ? v + 1 : v)) };
    const next = new V2Session();
    const got = loadPlaces(memory, next, later, indexProject(later));
    expect(got.stale).toBe(0);
    expect(next.placeOf(mapId)?.spec.name).toBe("갈매나루 여관");
    // 선언이 없어진 맵(통째로 바뀐 맵)은 전처럼 버린다
    const wiped = structuredClone(later);
    wiped.maps[mapId] = { ...wiped.maps[mapId]!, locations: [] };
    const gone = new V2Session();
    expect(loadPlaces(memory, gone, wiped, indexProject(wiped)).stale).toBeGreaterThanOrEqual(1);
    expect(gone.placeOf(mapId)).toBeUndefined();
  }, SLOW);
});
