import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "vite";
import { PNG } from "pngjs";
import { createHash } from "node:crypto";
import { aiJobsPlugin } from "../../../../scripts/lib/aiJobs/vitePlugin.mjs";
import { createBrowserRuntime } from "../../../../scripts/lib/aiJobs/browserExecutor.mjs";

// Real HTTP, repository, Chromium, worker dispatcher and domain executors.
// Only the paid provider's wire endpoint is controlled. This is not editor UI QA.
const evidence = resolve(".omo/evidence/ai-job-queue/task-4-runtime");
const directory = await mkdtemp(join(tmpdir(), "ai-family-runtime-"));
const cacheDirectory = await mkdtemp(join(tmpdir(), "ai-family-vite-cache-"));
const previousDirectory = process.env.AI_JOBS_DIRECTORY;
process.env.AI_JOBS_DIRECTORY = directory;
const physical = new Map();
const picture = new PNG({ width: 5, height: 5 });
picture.data.fill(255);
for (let y = 1; y < 4; y++) for (let x = 1; x < 4; x++) {
  const offset = (y * 5 + x) * 4;
  picture.data[offset] = 30;
  picture.data[offset + 1] = 70;
  picture.data[offset + 2] = 150;
}
const imageBytes = PNG.sync.write(picture);
const imageDataUrl = `data:image/png;base64,${imageBytes.toString("base64")}`;
const imageRef = {
  sha256: createHash("sha256").update(imageBytes).digest("hex"),
  byteLength: imageBytes.length, mediaType: "image/png",
};
const knowledge = { summary: "Runtime knowledge", proposals: [
  { template: "desk", tileIds: [4, 5], name: "Desk", confidence: 0.7 },
] };
const wire = createHttpServer(async (request, response) => {
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const { request: operation, jobId, key } = JSON.parse(Buffer.concat(chunks).toString());
    physical.set(jobId, [...(physical.get(jobId) ?? []), key]);
    let body;
    if (operation.kind === "image") {
      body = { image: {
        dataUrl: imageDataUrl, mimeType: "image/png",
        model: operation.body.model, provider: operation.provider,
      } };
    } else {
      const context = JSON.stringify(operation.body.messages);
      let call;
      let content = context.includes("RUNTIME_DATABASE")
        ? JSON.stringify({ name: "Runtime Potion", price: 37 })
        : context.includes("RUNTIME_EVENT")
          ? JSON.stringify([{ kind: "text", body: "Generated in the isolated worker" }])
          : null;
      if (key.startsWith("tileset/")) {
        const operationName = key.split("/")[1];
        if (["cluster-edit", "range-classify", "unclassified-analysis"].includes(operationName)) {
          content = key.endsWith("/0") ? JSON.stringify({
            mode: "question", space: "none", facility: null, targetMapId: null,
            useSelection: false, clarify: null, clarifyOptions: [], needsPlan: false,
            resetsContext: false, tools: [], summary: "Inspect captured tiles",
          }) : "Inspected the captured tiles without changing them.";
        } else if (operationName === "structure-kit-metadata") {
          content = JSON.stringify({
            description: "Runtime structure", tags: ["fixture"],
            placement: [{ zone: "againstWall", facing: "north", strength: "hard" }],
          });
        } else if (operationName === "proposal-draft") {
          content = JSON.stringify({ tiles: [{ tile: 4, label: "Left" }, { tile: 5, label: "Right" }] });
        } else content = JSON.stringify(knowledge);
      }
      if (key.startsWith("assistant/") || key.startsWith("region/")) {
        const region = key.startsWith("region/");
        const name = region ? "create_map" : "upsert_item";
        if (key.endsWith("/0")) {
          content = JSON.stringify({
            mode: "modify", space: region ? "outdoor" : "none", facility: null,
            targetMapId: null, useSelection: region, clarify: null, clarifyOptions: [],
            needsPlan: false, resetsContext: false, tools: [name], summary: "Runtime fixture",
          });
        } else if (key.endsWith("/1")) {
          call = { id: `runtime-${name}`, type: "function", function: {
            name, arguments: JSON.stringify(region
              ? { name: "Runtime interior", width: 8, height: 8 }
              : { item: { id: "runtime-assistant-item", name: "Assistant item", price: 19 } }),
          } };
        } else content = "Completed the captured private job.";
      }
      if (call) body = { choices: [{
        finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [call] },
      }] };
      else {
        assert.notEqual(content, null, "Unexpected provider scenario");
        body = { choices: [{ finish_reason: "stop", message: { role: "assistant", content } }] };
      }
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: String(error) }));
  }
});
let server;
let streamController;
let streamReader;
let consume;
const outcomes = new Map();
const waiters = new Map();
const receipts = [];
function waitForOutcome(jobId) {
  const existing = outcomes.get(jobId);
  if (existing) return Promise.resolve(existing);
  const deferred = Promise.withResolvers();
  const timer = setTimeout(() => deferred.reject(new Error(`No terminal outcome for ${jobId}`)), 90000);
  waiters.set(jobId, deferred.resolve);
  return deferred.promise.finally(() => {
    clearTimeout(timer);
    waiters.delete(jobId);
  });
}
try {
  const listening = once(wire, "listening");
  wire.listen(0, "127.0.0.1");
  await listening;
  const wireOrigin = `http://127.0.0.1:${wire.address().port}`;
  server = await createServer({
    configFile: false, envFile: false, root: process.cwd(), cacheDir: cacheDirectory,
    resolve: { alias: { "@": resolve("src") } },
    server: { host: "127.0.0.1", port: 19841, strictPort: true },
    plugins: [aiJobsPlugin(async ({ origin, cacheDir }) => {
      const runtime = await createBrowserRuntime({
        origin,
        cacheDir,
        dispatchProvider: async (request, context) => {
          const response = await fetch(wireOrigin, {
            method: "POST", signal: context.signal,
            body: JSON.stringify({ request, jobId: context.jobId, key: context.key }),
          });
          assert.equal(response.status, 200);
          return response.json();
        },
      });
      return { ...runtime, executeJob: async (input, host, signal) => {
        try { return await runtime.executeJob(input, host, signal); }
        catch (error) {
          console.log("EXECUTOR_ERROR", input.family, error.message);
          throw error;
        }
      } };
    })],
  });
  await server.listen();
  await server.environments.client.depsOptimizer?.scanProcessing;
  console.log("DEPS_SCAN_READY");
  const origin = "http://127.0.0.1:19841";
  const { createBlankProject } = await server.ssrLoadModule("/src/project/defaults.ts");
  const seed = createBlankProject();
  const mapId = seed.startMapId;
  const tilesetId = seed.maps[mapId].tilesetId;
  seed.tilesets[tilesetId].tileGroups = [{
    id: "runtime-group", name: "Group", tileIds: [4, 5], defaultLayer: "lower",
    role: "prop", description: "", placementRules: "", origin: "ai", source: "ai",
  }];
  seed.tilesets[tilesetId].structureKits = [{
    id: "runtime-kit", kind: "section", name: "Kit", width: 2, height: 1,
    rows: [{ tiles: [4, 5] }], learnedFrom: "db-authored",
  }];
  const seedPage = {
    id: "runtime-page", name: "Greeting", commands: [{ kind: "text", body: "Original" }],
    conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
  };
  seed.maps[mapId].events.push({
    id: "runtime-event", x: 1, y: 1, trigger: seedPage.trigger,
    commands: seedPage.commands, pages: [seedPage],
  });
  const { deserialize } = await server.ssrLoadModule("/src/project/io/serialize.ts");
  const project = deserialize(JSON.stringify(seed));
  const page = project.maps[mapId].events[0].pages[0];
  const sessionResponse = await fetch(`${origin}/api/ai-jobs/session`);
  const session = await sessionResponse.json();
  assert.equal(session.generationAvailable, true);
  const headers = {
    Origin: origin, Cookie: sessionResponse.headers.get("set-cookie").split(";")[0],
    "X-AI-Jobs-CSRF": session.csrfToken, "Content-Type": "application/json",
  };
  streamController = new AbortController();
  const stream = await fetch(`${origin}/api/ai-jobs/events?after=0`, { signal: streamController.signal });
  assert.equal(stream.status, 200);
  streamReader = stream.body.getReader();
  consume = (async () => {
    let buffer = "";
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await streamReader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame.split("\n").find(line => line.startsWith("data: "));
        if (!data) continue;
        const event = JSON.parse(data.slice(6));
        if (event.kind !== "outcome") continue;
        outcomes.set(event.jobId, event);
        waiters.get(event.jobId)?.(event);
      }
    }
  })();
  consume.catch(() => {});
  const config = {
    authMode: "chatgpt", providerId: "google-antigravity",
    model: "gemini-3.7-flash", maxTokens: 4096, maxToolCalls: 8,
  };
  const context = { budgetChars: 18000, preferenceMemorySection: "", currentMapId: mapId };
  const { analyzeCapturedTilesetReview } = await server.ssrLoadModule("/src/editor/tilesetAiQuestionAnalysis.ts");
  const { review } = await analyzeCapturedTilesetReview(project.tilesets[tilesetId], {
    requestId: "runtime-captured-review", feedback: [], imageDataUrl,
    request: async () => JSON.stringify(knowledge),
  });
  const tilesetCase = (operation, fields) => ({
    id: `tileset-${operation}`, family: "tileset", target: { tilesetId },
    payload: { operation, tilesetId, config, context, ...fields },
  });
  const scenarios = [
    { id: "assistant", family: "assistant", target: {}, payload: {
      instruction: "Create the requested single item.", domain: "database", context,
      config: { ...config, agentMode: "chat", liteModel: config.model },
    } },
    { id: "database", family: "database", target: {}, payload: {
      kind: "item", brief: "RUNTIME_DATABASE potion", config, withArtwork: true,
    } },
    { id: "event-commands", family: "event-commands", target: {
      kind: "map-event-page", mapId, eventId: "runtime-event", pageId: page.id,
    }, payload: {
      prompt: "RUNTIME_EVENT greeting", config, baseCommands: [{ kind: "text", body: "Unsaved draft" }],
      selection: null, preferenceMemorySection: "",
    } },
    { id: "image", family: "image", target: { kind: "system", field: "titleResourceId" },
      payload: { prompt: "Runtime title image", resourceId: "runtime-title-image",
        name: "Runtime title", kind: "title", postprocess: "flatten" } },
    { id: "region", family: "region", target: { mapId }, payload: {
      instruction: "Create one small private interior map.", mapId,
      region: { x: 2, y: 2, width: 6, height: 6 }, mode: "task", context,
      config: { ...config, agentMode: "chat", liteModel: config.model },
    } },
    tilesetCase("knowledge-analysis", { atlas: imageRef, feedback: [] }),
    tilesetCase("proposal-draft", {
      selectedTiles: [4, 5], setupChoice: {
        intent: "objectDetail", repeatability: "noRepeat", scope: "rules", structure: "single",
      },
      snapshot: { image: imageRef, summary: "Captured runtime map" }, lockedAnswer: "",
    }),
    tilesetCase("question-followup", {
      atlas: imageRef, review, proposalId: review.proposals[0].id, answer: "upper", turns: [],
    }),
    tilesetCase("structure-kit-metadata", { kitId: "runtime-kit" }),
    tilesetCase("cluster-edit", { groupId: "runtime-group", instruction: "Inspect only; do not change tiles." }),
    tilesetCase("range-classify", {
      rect: { x: 4, y: 0, w: 2, h: 1 }, tileIds: [4, 5], instruction: "Inspect only; do not change tiles.",
    }),
    tilesetCase("unclassified-analysis", {
      sampleTiles: [4, 5], total: 2, instruction: "Inspect only; do not change tiles.",
    }),
  ];
  const selected = scenarios.filter(scenario => !process.env.AI_JOB_PROOF_FAMILY
    || scenario.family === process.env.AI_JOB_PROOF_FAMILY);
  assert.ok(selected.length > 0);
  for (const scenario of selected) {
    const response = await fetch(`${origin}/api/ai-jobs`, {
      method: "POST", headers: { ...headers, "Idempotency-Key": `runtime-${scenario.id}` },
      body: JSON.stringify({
        input: {
          version: 1, family: scenario.family, target: scenario.target, payload: scenario.payload,
          project: { backend: "local", projectId: "runtime-family-proof" },
          mode: scenario.family === "region" ? scenario.payload.mode : "review", dependsOn: [],
        },
        projectSnapshot: project, artwork: [{ mediaType: "image/png", base64: imageBytes.toString("base64") }],
      }),
    });
    assert.equal(response.status, 202);
    const { job } = await response.json();
    const terminal = await waitForOutcome(job.id);
    assert.equal(terminal.states.generation, "succeeded", JSON.stringify(terminal));
    const detailResponse = await fetch(`${origin}/api/ai-jobs/${job.id}`);
    assert.equal(detailResponse.status, 200);
    const { job: finished } = await detailResponse.json();
    assert.equal(finished.application, "awaiting-review");
    assert.equal(finished.save, "unsaved");
    const readArtifact = async ref => {
      const artifact = await fetch(`${origin}/api/ai-jobs/${job.id}/artifacts/${ref.sha256}`);
      assert.equal(artifact.status, 200);
      return artifact;
    };
    const result = await (await readArtifact(finished.resultRef)).json();
    if (scenario.family === "assistant") {
      const generated = await (await readArtifact(result.generatedSnapshot)).json();
      assert.equal(generated.database.items.find(item => item.id === "runtime-assistant-item")?.price, 19);
      assert.deepEqual(physical.get(job.id), ["assistant/provider/0", "assistant/provider/1", "assistant/provider/2"]);
    } else if (scenario.family === "database") {
      const generated = await (await readArtifact(result.generatedSnapshot)).json();
      assert.equal(generated.database.items.find(item => item.name === "Runtime Potion")?.price, 37);
      const bytes = await (await readArtifact(result.payload.artwork.processed)).arrayBuffer();
      const png = PNG.sync.read(Buffer.from(bytes));
      assert.equal(png.data[3], 0);
      assert.equal(png.data[(2 * 5 + 2) * 4 + 3], 255);
      assert.deepEqual(physical.get(job.id), ["database/text", "database/artwork"]);
    } else if (scenario.family === "event-commands") {
      assert.equal(result.generatedSnapshot, null);
      const proposal = await (await readArtifact(result.artifacts[0])).json();
      assert.deepEqual(proposal.baseCommands, [{ kind: "text", body: "Unsaved draft" }]);
      assert.deepEqual(proposal.finalCommands, [{ kind: "text", body: "Generated in the isolated worker" }]);
      assert.deepEqual(physical.get(job.id), ["event-commands/assist/0"]);
    } else if (scenario.family === "image") {
      const generated = await (await readArtifact(result.generatedSnapshot)).json();
      assert.equal(generated.system.titleResourceId, "runtime-title-image");
      assert.equal(generated.system.titleScreen.backgroundResourceId, "runtime-title-image");
      const image = result.payload.proposal.resource;
      const png = PNG.sync.read(Buffer.from(await (await readArtifact(image.artifact)).arrayBuffer()));
      assert.equal(png.data[3], 0);
      assert.deepEqual(physical.get(job.id), ["image/provider/generate"]);
    } else if (scenario.family === "region") {
      const generated = await (await readArtifact(result.generatedSnapshot)).json();
      const added = Object.values(generated.maps).filter(map => !project.maps[map.id]);
      assert.equal(added.length, 1);
      assert.equal(added[0].name, "Runtime interior");
      assert.equal(result.payload.mapsAdded, 1);
      assert.equal(result.payload.applied, false);
      assert.deepEqual(physical.get(job.id), ["region/provider/0", "region/provider/1", "region/provider/2"]);
    } else {
      const operation = scenario.payload.operation;
      const cluster = ["cluster-edit", "range-classify", "unclassified-analysis"].includes(operation);
      assert.equal(result.payload.kind, cluster ? "cluster" : operation);
      assert.equal(result.payload.completion, "complete");
      assert.equal(result.generatedSnapshot === null, !cluster);
      assert.ok(physical.get(job.id).every(key => key.startsWith(`tileset/${operation}/provider/`)));
      if (!cluster) assert.equal(physical.get(job.id).length, 1);
      if (operation === "knowledge-analysis" || operation === "question-followup") {
        assert.ok(result.payload.review.proposals.length > 0);
      } else if (operation === "proposal-draft") assert.equal(result.payload.mapping.tiles.length, 2);
      else if (operation === "structure-kit-metadata") assert.equal(result.payload.metadata.description, "Runtime structure");
    }
    assert.equal(project.database.items.some(item => item.name === "Runtime Potion"), false);
    assert.equal(page.commands[0].body, "Original");
    const receipt = { scenario: scenario.id, family: scenario.family, jobId: job.id, status: finished.generation,
      application: finished.application, save: finished.save, operations: physical.get(job.id),
      result: finished.resultRef.sha256 };
    receipts.push(receipt);
    console.log("FAMILY_PASS", JSON.stringify(receipt));
  }
  await mkdir(evidence, { recursive: true });
  await writeFile(join(evidence, process.env.AI_JOB_PROOF_FAMILY
    ? `results-${process.env.AI_JOB_PROOF_FAMILY}.json` : "results.json"), JSON.stringify(receipts, null, 2));
  console.log("ALL_FAMILIES_PASS", JSON.stringify({
    scenarios: receipts.length, families: [...new Set(receipts.map(receipt => receipt.family))],
  }));
} finally {
  streamController?.abort();
  if (streamReader) await streamReader.cancel().catch(error => {
    if (!streamController?.signal.aborted) throw error;
  });
  if (consume) await consume.catch(error => {
    if (!streamController?.signal.aborted) throw error;
  });
  if (server) await server.close();
  wire.closeAllConnections();
  await new Promise(resolve => wire.close(resolve));
  await rm(directory, { recursive: true, force: true });
  await rm(cacheDirectory, { recursive: true, force: true });
  if (previousDirectory === undefined) delete process.env.AI_JOBS_DIRECTORY;
  else process.env.AI_JOBS_DIRECTORY = previousDirectory;
  console.log("CLEANUP", "owned HTTP/Chromium/repository closed; user project untouched");
}
