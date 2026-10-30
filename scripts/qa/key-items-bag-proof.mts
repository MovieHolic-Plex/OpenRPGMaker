// 일반 장르 가방 「중요한 물건」 증거 — 분류 칸, presentItem 기본 후보, 옛 프로젝트 불변, SQLite 저장·재로드.
// 실행: node node_modules/vite-node/dist/cli.mjs --script scripts/qa/key-items-bag-proof.mts [출력.json]
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initLocalProjectStore } from "../../electron/local-store/store";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { inventoryViewEntries, type InventoryView } from "@/player/playerInventoryView";
import { isKeyItem } from "@/player/playerBagPockets";
import { presentableItems } from "@/player/interpreter/presentItem";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import type { Command, Project } from "@/project/types";
import { runSceneTest } from "@/testing/sceneTestRunner";

const ctx = { project: createBlankProject(), assistantRun: false };
const call = (name: string, args: Record<string, unknown>) => {
  const r = runTool(ctx, name, args, { dryRun: false });
  if (!r.ok) throw new Error(`${name}: ${r.summary}`);
  return r;
};
call("upsert_item", { item: { id: "item_tonic", name: "쑥 달인 물", price: 30, type: "medicine", occasion: "always", hpRecovery: { flat: 30, percentMax: 0 } } });
call("upsert_item", { item: { id: "item_rope", name: "끊긴 두레박줄", price: 0, occasion: "never", description: "칼로 벤 자국." } });
call("upsert_item", { item: { id: "item_letter", name: "젖은 편지", price: 15, pocket: "key", description: "먹이 번졌다." } });
call("upsert_item", { item: { id: "item_trinket", name: "놋쇠 방울", price: 40, occasion: "never" } });

const project: Project = ctx.project;
const ev = { id: "ev_present", name: "검시관", x: 10, y: 6, trigger: { kind: "action" },
  commands: [{ kind: "presentItem", prompt: "무엇을 보일까?", options: [{ itemId: "item_rope", branch: [{ kind: "text", body: "이 줄이로군." }] }],
    otherwiseBranch: [{ kind: "text", body: "그건 상관없네." }], cancelBranch: [] } as unknown as Command] };
project.maps[project.startMapId]!.events.push(ev as never);

const session = startSession(project);
for (const id of ["item_tonic", "item_rope", "item_letter", "item_trinket"]) session.inventory[id] = 1;
const rowsOf = (view: InventoryView) => {
  const entries = project.database.items.filter((i) => (session.inventory[i.id] ?? 0) > 0).map((i) => ({ label: i.name, value: "1개", testId: `status-menu-item-${i.id}` }));
  let next: InventoryView | undefined;
  const rows = inventoryViewEntries(entries, project, session, view, (v) => { next = v; });
  const filter = rows.find((r) => r.testId === "inventory-filter")!;
  filter.onActivate?.();
  return { items: rows.filter((r) => r.testId?.startsWith("status-menu-item-")).map((r) => r.label), filterLabel: filter.value, filterHint: filter.description, next: next?.filter };
};
const allView = rowsOf({ filter: "all", sort: "default" });
const keyView = rowsOf({ filter: "key", sort: "default" });
const otherView = rowsOf({ filter: "other", sort: "default" });
const presentCandidates = presentableItems(session, ev.commands[0] as never, project).map((i) => i.itemId);
const giftPrompt = { kind: "presentItem", options: [{ itemId: "item_tonic", branch: [] }] } as never;
const giftCandidates = presentableItems(session, giftPrompt, project).map((i) => i.itemId).sort();
const noKeySession = startSession(project); noKeySession.inventory.item_tonic = 1;
const noKeyRows = inventoryViewEntries([{ label: "쑥 달인 물", value: "1개", testId: "status-menu-item-item_tonic" }], project, noKeySession, { filter: "all", sort: "default" });
const noKeyFilter = noKeyRows.find((r) => r.testId === "inventory-filter")!;

const start = { x: 10, y: 7 };
const scene = (steps: unknown[]) => {
  const initial = startSession(project);
  for (const id of ["item_tonic", "item_rope", "item_letter", "item_trinket"]) initial.inventory[id] = 1;
  return runSceneTest(project, { mapId: project.startMapId, start, steps } as never, undefined, { initialSession: initial });
};
const presentRope = scene([{ kind: "set", x: 10, y: 7, facing: "up" }, { kind: "interact", eventId: "ev_present" }, { kind: "present", itemId: "item_rope" }, { kind: "wait", ticks: 600 }]);
const presentTonic = scene([{ kind: "set", x: 10, y: 7, facing: "up" }, { kind: "interact", eventId: "ev_present" }, { kind: "present", itemId: "item_tonic" }]);

// 옛 프로젝트(중요한 물건 없음): 분류 네 칸 그대로, presentItem 은 소지품 전체
const legacy = createBlankProject();
legacy.database.items.push({ ...project.database.items.find((i) => i.id === "item_tonic")! });
const legacySession = startSession(legacy); legacySession.inventory.item_tonic = 2;
const legacyRows = inventoryViewEntries([{ label: "쑥 달인 물", value: "2개", testId: "status-menu-item-item_tonic" }], legacy, legacySession, { filter: "key", sort: "default" });
const legacyFilter = legacyRows.find((r) => r.testId === "inventory-filter")!;
const legacyPresent = presentableItems(legacySession, ev.commands[0] as never, legacy).map((i) => i.itemId);

// SQLite 저장 → 다시 열기
const dir = mkdtempSync(join(tmpdir(), "oprn-keyitems-proof-"));
const first = await initLocalProjectStore({ projectDir: dir });
const saved = await first.saveProject(project);
const reloaded = (await initLocalProjectStore({ projectDir: dir })).loadSnapshot()!.project;
rmSync(dir, { recursive: true, force: true });
const reloadedKeys = reloaded.database.items.filter(isKeyItem).map((i) => i.id).filter((id) => ["item_rope", "item_letter", "item_tonic", "item_trinket"].includes(id)).sort();

const out = {
  keyIds: project.database.items.filter(isKeyItem).map((i) => i.id).filter((id) => id.startsWith("item_") && ["item_rope", "item_letter", "item_tonic", "item_trinket"].includes(id)).sort(),
  allView, keyView, otherView, presentCandidates, giftCandidates,
  noKeyHeld: { filterHint: noKeyFilter.description },
  presentRope: { ok: presentRope.ok, failure: presentRope.failureReason ?? null, said: JSON.stringify(presentRope.finalState.messages).includes("이 줄이로군") },
  presentTonicRejected: !presentTonic.ok && /not presentable/u.test(presentTonic.failureReason ?? ""),
  legacy: { filterLabel: legacyFilter.value, filterHint: legacyFilter.description, present: legacyPresent },
  storage: { kind: saved.kind, reloadedKeys },
};
const allOk = out.keyIds.includes("item_letter") && out.keyIds.includes("item_rope") && !out.keyIds.includes("item_trinket") && !out.keyIds.includes("item_tonic")
  && giftCandidates.join() === "item_letter,item_rope,item_tonic,item_trinket" && !String(noKeyFilter.description).includes("중요한")
  && allView.next === "key" && [...keyView.items].sort().join() === ["끊긴 두레박줄", "젖은 편지"].sort().join() && keyView.filterLabel === "중요한 물건"
  && !otherView.items.includes("끊긴 두레박줄") && otherView.items.includes("놋쇠 방울")
  && presentCandidates.sort().join() === "item_letter,item_rope" && out.presentRope.ok && out.presentRope.said && out.presentTonicRejected
  && legacyFilter.value === "전체" && !String(legacyFilter.description).includes("중요한") && legacyPresent.join() === "item_tonic"
  && saved.kind === "saved" && reloadedKeys.join() === "item_letter,item_rope";
const result = { allOk, ...out };
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));
process.exit(allOk ? 0 : 1);
