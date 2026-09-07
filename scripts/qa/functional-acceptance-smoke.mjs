#!/usr/bin/env node
// Public session/declaration/runtime APIs only. No private ledger injection, remote writes or live model billing.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { firefox } from "playwright";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:9841");
assert(["127.0.0.1", "localhost"].includes(origin.hostname), "Use an isolated loopback worktree server");
const output = resolve(process.argv[3] ?? "output/evidence/functional-acceptance/public-smoke.json");
// Firefox avoids Chromium's host-netlink ERR_NETWORK_CHANGED cancellation on this Linux worker.
const browser = await firefox.launch({ headless: true });
const page = await browser.newPage();
page.on("console", message => { if (message.type() === "error") console.error(message.text()); });
page.on("requestfailed", request => console.error(`Request failed: ${request.url()} ${request.failure()?.errorText}`));
const blockedWrites = [];
await page.route("**/*", async route => {
  const request = route.request();
  if (!["GET", "HEAD"].includes(request.method())) {
    blockedWrites.push({ method: request.method(), url: request.url() });
    return route.fulfill({ status: 403, body: "Smoke harness forbids writes" });
  }
  if (new URL(request.url()).origin !== origin.origin) return route.abort("blockedbyclient");
  if (new URL(request.url()).pathname === "/functional-acceptance-smoke") {
    return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><html><body>Functional acceptance API smoke</body></html>" });
  }
  return route.continue();
});
let deadline;
try {
  await page.goto(new URL("/functional-acceptance-smoke", origin).href, { waitUntil: "domcontentloaded" });
  const result = await Promise.race([
    page.evaluate(async () => {
      const [{ AssistantSession }, { createLlmIntentDeclarer, resetIntentDeclarationCache }, { defaultAiConfig }, { functionalFixture, suspendedCorridorFixture }, { PLAY_TOOLS }] = await Promise.all([
        import("/src/ai/assistantSession.ts"), import("/src/ai/intentDeclarationClient.ts"), import("/src/ai/llmClient.ts"),
        import("/test/fixtures/functionalAcceptance.ts"), import("/src/editor/tools/playTools.ts"),
      ]);
      const config = { ...defaultAiConfig(), agentMode: "chat", model: "scripted-worker", liteModel: "scripted-intent", apiKey: "test", maxToolCalls: 12 };
      const complete = () => ({ message: { role: "assistant", content: "SMOKE_COMPLETE" }, finishReason: "stop" });
      const toolCall = (name, args) => ({ message: { role: "assistant", content: null, tool_calls: [
        { id: name, type: "function", function: { name, arguments: JSON.stringify(args) } },
      ] }, finishReason: "tool_calls" });
      const check = (condition, message, observed) => { if (!condition) throw new Error(`${message}: ${JSON.stringify(observed)}`); };
      async function run(variant) {
        resetIntentDeclarationCache();
        const f = variant === "corridor-fails" ? suspendedCorridorFixture() : functionalFixture();
        if (variant === "purchase-fails" || variant === "replacement-fails") f.project.session.gold = 1;
        if (variant === "roundtrip-fails") f.destination.events = [];
        if (variant === "reward-fails") f.reward.pages[0].commands[0].amount = 1;
        const declaration = { mode: "modify", space: "none", needsPlan: false,
          functionalAcceptance: [
            { kind: "shopPurchase", target: { mapId: f.origin.id }, start: f.project.startPos, seller: { eventId: f.seller.id }, item: { id: "item_potion" }, count: 2, unitPrice: 10 },
            { kind: "mapRoundTrip", target: { mapId: f.origin.id }, start: f.project.startPos, destination: { mapId: f.destination.id }, outgoing: { eventId: f.outgoing.id }, returning: { eventId: f.returning.id } },
          ],
          npcRewards: [{ target: { eventId: f.reward.id }, grants: [{ kind: "item", id: "item_potion", count: 2 }], oneTime: true }],
        };
        const scripted = variant === "replacement-fails" ? [toolCall("set_work_plan", {
          goal: "Replace requested checks", layers: [{ title: "Skip", items: [{ id: "work", title: "Skip", instruction: "Skip" }] }],
          requirements: [{ id: "request-1:functional:0", title: "Easy replacement", required: false,
            criteria: [{ kind: "mapCount", targets: [{ mapId: f.origin.id }], count: 1 }] }],
        }), toolCall("skip_work_item", { itemId: "work" }), toolCall("repair_acceptance", {
          itemId: "request-1:functional:0", criteria: [{ kind: "mapCount", targets: [{ mapId: f.origin.id }], count: 1 }],
        })] : [];
        let cursor = 0;
        const session = new AssistantSession(f.project, { config,
          declareIntent: createLlmIntentDeclarer({ getConfig: () => config, chat: async () => ({
            message: { role: "assistant", content: JSON.stringify(declaration) }, finishReason: "stop",
          }) }), chat: async () => scripted[cursor++] ?? complete(),
        });
        const response = await session.sendUserMessage("Buy two potions from the seller for ten gold each, walk to the other map and back, and give two potions from the NPC only once", () => {}, AbortSignal.timeout(30000));
        const snapshot = session.getAcceptanceSnapshot();
        const kinds = snapshot?.items.map(item => ({ kind: JSON.parse(item.evidence[0].expected).kind, status: item.status, passed: item.evidence[0].passed }));
        check(kinds?.length === 3, "Request obligations missing", snapshot);
        const failedIndex = ["roundtrip-fails", "corridor-fails"].includes(variant) ? 1 : variant === "reward-fails" ? 2 : 0;
        if (variant === "happy") {
          check(snapshot.status === "verified" && kinds.every(item => item.passed), "Happy path failed", snapshot);
          const changed = structuredClone(f.project);
          changed.session.gold = 1;
          session.refreshAcceptance(changed);
          check(session.getAcceptanceSnapshot().items[0].evidence[0].passed === false, "Stale purchase proof survived", session.getAcceptanceSnapshot());
        } else {
          check(snapshot.status !== "verified" && !kinds[failedIndex].passed, "Broken behavior was accepted", snapshot);
          check(response.assistantText !== "SMOKE_COMPLETE", "Model success prose escaped failed acceptance", response);
        }
        return { variant, status: snapshot.status, checks: kinds, staleRevalidation: variant === "happy" ? "rejected" : undefined };
      }
      const cases = [];
      for (const variant of ["happy", "purchase-fails", "roundtrip-fails", "reward-fails", "replacement-fails", "corridor-fails"]) cases.push(await run(variant));
      const f = functionalFixture();
      const sceneTool = PLAY_TOOLS.find(tool => tool.name === "run_scene_test");
      const transaction = sceneTool.run(f.project, { mapId: f.project.startMapId, start: f.project.startPos, steps: [
        { kind: "walk", to: { x: f.seller.x, y: f.seller.y }, adjacent: true }, { kind: "interact", eventId: f.seller.id },
        { kind: "purchase", eventId: f.seller.id, itemId: "item_potion", count: 2, unitPrice: 10 },
        { kind: "expect", goldDelta: -20, inventoryDelta: { item_potion: 2 }, interactionComplete: true },
      ] });
      check(transaction.data.ok && transaction.data.finalState.gold === 80 && transaction.data.finalState.inventory.item_potion === 2, "Public shop transaction failed", transaction);
      const corridor = suspendedCorridorFixture();
      const suspension = [false, true].map(split => sceneTool.run(corridor.project, { mapId: corridor.origin.id, start: corridor.project.startPos, steps: [
        ...(split ? [{ kind: "walk", to: { x: 1, y: 2 } }] : []), { kind: "walk", to: { x: 1, y: 4 } },
      ] }).data);
      check(suspension.every(result => !result.ok && result.finalState.mapId === corridor.origin.id && result.finalState.y === 2 && result.finalState.gold === 100), "Split/unsplit walks bypassed a held shop", suspension);
      resetIntentDeclarationCache();
      const requirementId = "request-1:functional:0";
      const known = { kind: "shopPurchase", seller: { eventId: f.seller.id }, item: { id: "item_potion" }, count: 2 };
      const full = { ...known, target: { mapId: f.origin.id }, start: f.project.startPos, unitPrice: 10 };
      const declarations = [
        { functionalAcceptance: [{ kind: "functionalUnresolved", reason: "Specify price and entry", expectations: known }] },
        { functionalRefinements: [{ requirementId, criterion: { kind: "shopPurchase", target: full.target, start: full.start } }] },
        { functionalRefinements: [{ requirementId, criterion: { kind: "shopPurchase", unitPrice: 10 } }] },
      ];
      let declarationIndex = 0, repairAttempted = false, workerRepairRejected = false;
      const clarificationSession = new AssistantSession(f.project, { config,
        declareIntent: createLlmIntentDeclarer({ getConfig: () => config, chat: async () => ({ message: { role: "assistant", content: JSON.stringify({ mode: "modify", needsPlan: false, ...declarations[declarationIndex++] }) }, finishReason: "stop" }) }),
        chat: async () => {
          if (declarationIndex === 3 && !repairAttempted) {
            repairAttempted = true;
            return toolCall("repair_acceptance", { itemId: requirementId, criteria: [{ ...full, count: 1 }] });
          }
          return complete();
        },
      });
      const clarificationStatuses = [];
      for (const text of ["Let test_seller sell two potions, but the price and entry are not decided.", "Use the actual project entry.", "Set the price to ten gold each."]) {
        await clarificationSession.sendUserMessage(text, event => { if (event.type === "tool_call" && event.name === "repair_acceptance") workerRepairRejected = !event.result.ok; }, AbortSignal.timeout(30000));
        clarificationStatuses.push(clarificationSession.getAcceptanceSnapshot().status);
      }
      const clarified = clarificationSession.getAcceptanceSnapshot();
      check(JSON.stringify(clarificationStatuses) === JSON.stringify(["blocked", "blocked", "verified"])
        && clarified.items.length === 1 && clarified.items[0].id === requirementId && clarified.items[0].source.requestId === "request-1"
        && clarified.items[0].refinements.length === 2 && JSON.parse(clarified.items[0].evidence[0].expected).count === 2 && workerRepairRejected,
      "Trusted clarification lost provenance or weakened the contract", { clarificationStatuses, clarified, workerRepairRejected });
      return { cases, suspension, clarification: { statuses: clarificationStatuses, requirement: clarified.items[0], workerRepairRejected }, transaction: transaction.data, scope: "Scripted model boundary; real public session/parser and engine/interpreter/transaction modules. No authored remote project or graphical-player QA." };
    }),
    new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error("Public API smoke exceeded 120 seconds")), 120000); }),
  ]);
  assert.equal(blockedWrites.length, 0, `Unexpected write attempts: ${JSON.stringify(blockedWrites)}`);
  await mkdir(resolve(output, ".."), { recursive: true });
  await writeFile(output, `${JSON.stringify({ ok: true, browser: "firefox", origin: origin.origin, ...result }, null, 2)}\n`);
  console.log(`PASS: 3 behaviors, hostile/stale cases, suspended corridor, trusted clarification, immutable replacement, public transaction. Evidence: ${output}`);
} finally {
  clearTimeout(deadline);
  await browser.close();
}
