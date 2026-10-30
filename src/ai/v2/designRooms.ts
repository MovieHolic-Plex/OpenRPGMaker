// 손 도트 실내 방 설계 받기 — 설계(zones[].design) 없이 짓게 된 방은 짓기 전에 같은 모델(env.sideChat)에게 설계를 따로 받는다.
//
// 왜(2026-10-29 맵 같음 감사 map-sameness-1029): 23판 중 여관 1층 13개가 같은 16×14 선술집 홀(장소 견본 tavern), 방탈출 방 16개가 같은
// 나무 서재(손 견본 통째 이식)였다. 설계 되돌려 보내기(make_place 한 번)를 받고도 설계 없이 다시 오거나(argon 추리), style:modern 이라
// 되돌려 보내기를 건너뛰거나(flash 방탈출), 끝맺음 장소 자동 짓기가 모델 없이 견본을 깔았다. 사용자 원칙: 방은 모델이 설계하고,
// 함수는 조화·검사만 하고 고친 것을 알린다 — 견본은 참고로만 보여 주고 깔지 않는다.
//
// 여기서 하는 일: 설계가 빈 구역(위층 포함, keep 으로 원래 방을 지키는 구역은 빼고)을 모아 room_parts 재료와 함께 한 번 묻고,
// 받은 design 을 구역에 넣어 돌려준다. 함수는 설계 내용(모양·크기·가구)을 고르지 않는다. 두 번 다 못 받으면 명세를 그대로 돌려주고
// 그 사실을 알린다(빌더가 예전 길로 짓는다 — 보고에 «모델 설계 없음»으로 남는다).
import type { PiAssistantV2Env } from "./env";
import type { PlaceSpec, ZoneSpec } from "./types";
import type { Project } from "@/project/types";
import type { RoomDesign } from "@/editor/handInterior/designRoom";
import { HAND_INTERIOR_TILESET_ID } from "@/editor/handInterior/builder";

const HAND_LAYOUT_ROOM_TAG = "hand-layout-room";
import { interiorTilesetOf } from "./builders/interior";
import { roomParts } from "./roomParts";
import { ROOM_IDEA_RULE, roomIdeasFor } from "./roomIdeas";

/** 이 명세가 손 도트 실내(v5)로 지어지나 — 설계는 이 칩셋에서만 쓴다. */
export function buildsHandInterior(project: Project, spec: PlaceSpec): boolean {
  return spec.type === "interior" && !!project.tilesets[HAND_INTERIOR_TILESET_ID] && interiorTilesetOf(project, spec).tilesetId === HAND_INTERIOR_TILESET_ID;
}

/** 설계가 필요한 구역 — 설계가 없고 원래 방 지키기(keep)도 아닌 것. 구역이 없으면 장소 이름 한 방, 2층 이상인데 위층 구역이 없으면 위층 방 하나. */
export function zonesNeedingDesign(spec: PlaceSpec): { zones: ZoneSpec[]; need: number[] } {
  let zones: ZoneSpec[] = spec.zones?.length ? [...spec.zones] : [{ kind: spec.name, purpose: spec.name }];
  if ((spec.floors ?? 1) >= 2 && !zones.some((z) => (z.floor ?? 1) === 2)) zones = [...zones, { kind: "inn_room", purpose: `${spec.name} 위층 방`, floor: 2 }];
  const need = zones.map((z, i) => (!z.design && !z.keep ? i : -1)).filter((i) => i >= 0);
  return { zones, need };
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** 같은 게임에 이미 선 방(맵 이름·크기) — «다른 방과 다르게»의 재료. */
function builtRooms(project: Project): string[] {
  const out: string[] = [];
  for (const m of Object.values(project.maps)) for (const l of m.locations ?? []) {
    if (!(l.tags ?? []).includes(HAND_LAYOUT_ROOM_TAG)) continue;
    out.push(`${m.name ?? m.id}/${l.name} ${l.w ?? "?"}×${l.h ?? "?"}`);
    if (out.length >= 12) return out;
  }
  return out;
}

function promptFor(project: Project, spec: PlaceSpec, zones: readonly ZoneSpec[], need: readonly number[], task: string, retryNote?: string): string {
  const purposes = need.map((i) => `${zones[i]!.kind} ${zones[i]!.purpose ?? ""}`).join(" ");
  const parts = roomParts(project, `${purposes} ${spec.name} ${spec.theme ?? ""}`, undefined, HAND_INTERIOR_TILESET_ID, 40);
  const lines = [
    "너는 RPG 손 도트 실내 방을 설계하는 사람이다. 아래 장소의 방들을 직접 설계해 JSON 하나로만 답한다(설명 글 없이).",
    `요청: ${clip(task.replace(/\s+/gu, " "), 500)}`,
    `게임: ${project.meta.title ?? ""} · 장소: ${spec.name}${spec.theme ? ` · 분위기: ${spec.theme}` : ""}${spec.size ? ` · 크기: ${spec.size}` : ""}`,
    "설계할 방(i 는 번호):",
    ...need.map((i) => { const z = zones[i]!; return `- i=${i} kind=${z.kind} 용도=${z.purpose ?? z.kind}${(z.floor ?? 1) > 1 ? ` (${z.floor}층)` : ""}${z.anchors?.length ? ` 꼭 넣을 물건: ${z.anchors.join("·")}` : ""}`; }),
    ...(zones.some((z, i) => !need.includes(i) && z.design) ? [`이미 설계된 같은 장소 방: ${zones.filter((z, i) => !need.includes(i) && z.design).map((z) => `${z.kind} ${z.design!.shape ?? "rect"} ${z.design!.w ?? "?"}×${z.design!.h ?? "?"}`).join(", ")}`] : []),
    ...(builtRooms(project).length ? [`이 게임에 이미 선 방(모양·크기·배치를 이것과 다르게): ${builtRooms(project).join(", ")}`] : []),
    "design 꼴: {shape, corner?, w, h, door, floor, wall, groups:[{name, at, pos?, rug?, items:[{id, dx?, dy?, count?}]}]}",
    "- shape: rect 네모(작은 방) · L ㄱ자(corner 귀퉁이를 도려 냄) · U ㄷ자 · T ㅜ자 · bay 창가 돌출 · alcove 알코브(corner). 방 이야기에 맞는 모양을 네가 고른다.",
    ...(parts ? parts.shapes.map((s) => `  · ${s}`) : []),
    ...(need.some((i) => (zones[i]!.floor ?? 1) > 1) ? ["- 위층 방: 아래층에서 올라오는 계단통(3×2)이 위층 방 하나의 빈 바닥에 선다 — 위층 방 중 하나는 바닥 6×4 이상으로 비워 둘 자리를 둔다(복도·계단참을 따로 설계해도 된다)."] : []),
    "- w×h = 바닥 칸(벽면 줄 빼고). 방 용도와 가구 양에 맞춘다 — 빈 바닥이 넓으면 방이 너무 큰 것이다. door = 남쪽 출구 left·center·right.",
    "- at = north·south·west·east·center·nw·ne·sw·se, pos 0~1 = 그 벽을 따라 자리. 책장·진열장 같은 벽 가구와 창·지도(걸이, dy -2)는 북벽(north·nw·ne)에만.",
    "- 의자는 chair N/S/E/W(그쪽을 봄) — 탁자·책상 쪽을 보게. 무엇을 몇 개 놓을지는 네 목록이 전부다(함수는 더하지 않고, 칩셋에 없는 이름·겹침·문 앞 통로만 고친다).",
    ...(parts ? [
      `바닥 재질 floor: ${parts.floors.join(", ")}`,
      `벽면 재질 wall: ${parts.walls.join(", ")}`,
      `깔개 rug: ${parts.rugs.join(", ")}`,
      "기물(id | 이름 | 크기 | 놓는 곳):",
      ...parts.items.map((l) => `  ${l}`),
      `탁상 물건(id): ${parts.goods.join(", ")}`,
      "참고 견본(바닥 좌표의 배치 요약 — 읽고 참고만 한다, 같은 배치·같은 크기로 베끼지 않는다. 옛 서재 견본은 뺐다):",
      ...parts.references.slice(0, 2).map((r) => `  ${r.id} 바닥 ${r.floorSize}: ${clip(r.items.join(", "), 400)}`),
      `설계 꼴 예(모양만 보는 예 — 기물은 네 방 용도 것으로): ${JSON.stringify(parts.shapeExamples[0]?.zones)}`,
    ] : []),
    `답 꼴: {"rooms":[{"i":${need[0] ?? 0},"design":{...}}${need.length > 1 ? ",…" : ""}]} — 방마다 하나.`,
    ...(retryNote ? [`앞 답을 읽지 못했다(${retryNote}). JSON 하나로만 다시 답한다.`] : []),
  ];
  return lines.join("\n");
}

/** 모델 답에서 방 설계를 읽는다 — {rooms:[{i,design}]} · {zones:[…]} · 배열 · {design} 모두 받는다. */
export function readDesignReply(reply: string, need: readonly number[], zones: readonly ZoneSpec[]): Map<number, RoomDesign> {
  const out = new Map<number, RoomDesign>();
  const start = reply.indexOf("{"), startA = reply.indexOf("[");
  const from = start < 0 ? startA : startA < 0 ? start : Math.min(start, startA);
  if (from < 0) return out;
  const end = Math.max(reply.lastIndexOf("}"), reply.lastIndexOf("]"));
  let json: unknown;
  try { json = JSON.parse(reply.slice(from, end + 1)); } catch { return out; }
  const j = json as Record<string, unknown>;
  const list: unknown[] = Array.isArray(json) ? json : Array.isArray(j.rooms) ? j.rooms : Array.isArray(j.zones) ? j.zones : j.design ? [j] : [];
  const looksDesign = (d: unknown): d is RoomDesign => !!d && typeof d === "object" && (Array.isArray((d as RoomDesign).groups) || typeof (d as RoomDesign).w === "number");
  list.forEach((e, k) => {
    const r = (e ?? {}) as Record<string, unknown>;
    const d = looksDesign(r.design) ? r.design : looksDesign(r) ? (r as RoomDesign) : undefined;
    if (!d) return;
    const byI = typeof r.i === "number" ? r.i : typeof r.index === "number" ? r.index : undefined;
    const byKind = typeof r.kind === "string" ? need.find((i) => zones[i]!.kind === r.kind && !out.has(i)) : undefined;
    const i = byI !== undefined && need.includes(byI) ? byI : byKind ?? need.filter((n) => !out.has(n))[0] ?? need[k];
    if (i !== undefined && !out.has(i)) out.set(i, d);
  });
  return out;
}

/**
 * 설계가 빈 손 도트 실내 구역을 같은 모델에게 설계받아 채운다. 손 도트 실내가 아니거나 다 설계됐으면 그대로.
 * notes: 무엇을 받았는지·못 받았는지(조수 보고·짓기 경고에 싣는다).
 */
export async function designMissingRooms(env: PiAssistantV2Env, spec: PlaceSpec, why: string): Promise<{ spec: PlaceSpec; notes: string[] }> {
  const project = env.ctx.project;
  if (!buildsHandInterior(project, spec)) return { spec, notes: [] };
  const { zones, need } = zonesNeedingDesign(spec);
  if (!need.length) return { spec, notes: [] };
  const task = String(env.request.task ?? "");
  env.emit({ type: "execution_status", name: "v2.design", ok: true, summary: `「${spec.name}」 방 ${need.length}개 설계를 모델에게 받는 중(${why})` });
  // 구성 아이디어 그림(사용자가 고른 실내 기준) — 글과 함께 싣는다. 못 읽으면 글만.
  const purposes = need.map((i) => `${zones[i]!.kind} ${zones[i]!.purpose ?? ""}`).join(" ");
  const ideas: { text: string; url: string }[] = [];
  if (env.readPublicAsset) for (const idea of roomIdeasFor(`${purposes} ${spec.name}`)) {
    const url = await env.readPublicAsset(idea.file).catch(() => undefined);
    if (url) ideas.push({ text: `구성 아이디어 ${idea.id}: ${idea.idea}`, url });
  }
  // 그림은 한 장으로 합쳐 싣는다(room_parts 와 같은 까닭 — 그림 여러 장 뒤 Gemini 계열이 짓지 못한 판이 늘었다).
  const sheet = ideas.length > 1 && env.combinePictures ? await env.combinePictures(ideas.map((x) => x.url)).catch(() => undefined) : undefined;
  const pics = sheet ? [sheet] : ideas.slice(0, 1).map((x) => x.url);
  const ask = (body: string) => ideas.length
    ? [{ role: "user", content: [{ type: "text", text: `${body}\n${ROOM_IDEA_RULE}\n그림 한 장(왼쪽부터 차례로): ${(sheet ? ideas : ideas.slice(0, 1)).map((x) => x.text).join(" / ")}` }, ...pics.map((url) => ({ type: "image_url", image_url: { url } }))] }]
    : [{ role: "user", content: body }];
  let got = new Map<number, RoomDesign>();
  let problem = "";
  for (let attempt = 0; attempt < 2 && got.size < need.length; attempt++) {
    try {
      const reply = await env.sideChat(ask(promptFor(project, spec, zones, need, task, attempt ? problem : undefined)), env.signal);
      const read = readDesignReply(reply, need, zones);
      for (const [i, d] of read) if (!got.has(i)) got.set(i, d);
      problem = got.size < need.length ? `방 ${need.length}개 중 ${got.size}개만 읽었다` : "";
    } catch (error) {
      problem = `호출 실패: ${error instanceof Error ? error.message.slice(0, 120) : String(error).slice(0, 120)}`;
    }
  }
  if (!got.size) {
    env.emit({ type: "execution_status", name: "v2.design", ok: false, summary: `「${spec.name}」 방 설계를 받지 못했다 — ${problem}` });
    return { spec, notes: [`모델 설계 없음: 「${spec.name}」 방 설계를 모델에게 두 번 물었지만 받지 못해(${problem}) 예전 길(함수 배치)로 지었다 — design 을 채워 edit_place 로 다시 짓는다`] };
  }
  got = new Map([...got].filter(([i]) => need.includes(i)));
  const filled = zones.map((z, i) => (got.has(i) ? { ...z, design: got.get(i)! } : z));
  const desc = [...got].map(([i, d]) => `${zones[i]!.kind} ${d.shape ?? "rect"} ${d.w ?? "?"}×${d.h ?? "?"} 묶음 ${(d.groups ?? []).length}`).join(", ");
  env.emit({ type: "execution_status", name: "v2.design", ok: true, summary: `「${spec.name}」 방 설계 받음: ${desc}` });
  return { spec: { ...spec, zones: filled }, notes: [`방 설계(${why}): 함수가 견본을 깔지 않고 같은 모델에게 따로 설계를 받아 지었다 — ${desc}${got.size < need.length ? ` (방 ${need.length - got.size}개는 받지 못해 함수 배치)` : ""}`] };
}
