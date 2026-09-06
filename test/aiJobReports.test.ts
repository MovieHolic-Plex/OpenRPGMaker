import { afterEach, expect, it } from "vitest";
import { fixture, inputFor, resultFor } from "./aiJobsTestSupport.mjs";
import { httpFixture } from "./aiJobsTestSupport.mjs";
import { createBlankProject } from "@/project/defaults";
import { jsonValue } from "@/ai/jobs/checkpointState";
import { renderJobReport, type ReportRenderOptions } from "@/ai/jobs/renderJobReport";
import type { AiJobFamily, AiJobResult, BlobRef, JsonObject } from "@/ai/jobs/contracts";
import type { JobReport } from "@/ai/jobs/reportModel";
import type { Project } from "@/project/types";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { appliedReportBinding } from "../scripts/lib/aiJobs/reports.mjs";
import { commandReportFlow, questReportFlow, reportFlowSvg } from "@/ai/jobs/reportFlow";
import { canonicalJson, canonicalProject } from "@/ai/jobs/resultPatch";
import { openAiJobsRepository } from "../scripts/lib/aiJobs/repository.mjs";
import { createAiJobsScheduler } from "../scripts/lib/aiJobs/scheduler.mjs";
import type { AiJobsRepository, AiJob, AiJobEvent } from "@/ai/jobs/contracts";
import type { AiJobsScheduler } from "../scripts/lib/aiJobs/scheduler.mjs";
function waitFor(scheduler: AiJobsScheduler, predicate: (event: AiJobEvent) => boolean): Promise<AiJobEvent> {
  let off = () => {};
  const signal = new Promise<AiJobEvent>(resolve => { off = scheduler.subscribe(event => { if (predicate(event)) resolve(event); }); });
  return deadline(signal).finally(() => off());
}
function deadline<T>(signal: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([signal, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error("Expected exact report signal not observed")), 30000); })]).finally(() => clearTimeout(timer));
}

async function completedFixture(options: { family?: AiJobFamily; base?: Project; generated?: Project;
  payload?: JsonObject; inputPayload?: JsonObject; artifacts?: BlobRef[]; render?: ReportRenderOptions["renderPreview"];
  crashAfterPreview?: () => boolean;
  proposal?: (repository: AiJobsRepository) => Promise<{ payload: JsonObject; artifacts: BlobRef[] }> } = {}) {
  let providerCalls = 0;
  const f = await httpFixture({ after: cb => cleanups.push(cb) }, {
    renderReport: (result, host) => renderJobReport(result, { ...host, saveReport: async document => {
      const ref = await host.saveReport(document);
      if (options.crashAfterPreview?.() && document.sections.some(s => s.previews.some(p => p.status === "ready"))) throw new Error("Controlled browser crash after durable preview");
      return ref;
    } }, { renderPreview: options.render }),
    dispatchProvider: async () => { providerCalls++; throw new Error("Report must not dispatch providers"); },
  });
  const input = await inputFor(f.repository, { family: options.family ?? "assistant",
    projectSnapshot: await f.repository.putJson(jsonValue(options.base ?? createBlankProject())), payload: options.inputPayload ?? {} });
  const { job } = await f.repository.admit({ idempotencyKey: randomUUID(), input });
  const attemptId = randomUUID(), now = Date.now();
  const proposal = await options.proposal?.(f.repository);
  const result: AiJobResult = { version: 1, family: input.family, jobId: job.id, attemptId, project: input.project,
    baseSnapshot: input.projectSnapshot, generatedSnapshot: options.generated ? await f.repository.putJson(jsonValue(options.generated)) : null,
    artifacts: proposal?.artifacts ?? options.artifacts ?? [], payload: proposal?.payload ?? options.payload ?? { text: "Captured answer" } };
  const resultRef = await f.repository.putJson(jsonValue(result));
  await f.repository.transaction(draft => {
    draft.attempts.push({ id: attemptId, jobId: job.id, stage: "generation", status: "succeeded", startedAt: now, finishedAt: now, error: null });
    const current = draft.jobs.find(j => j.id === job.id)!;
    current.generation = "succeeded"; current.resultRef = resultRef; current.application = "awaiting-review"; current.save = "unsaved";
  });
  const read = async () => await f.repository.readJson(f.scheduler.getJob(job.id).reportRef!) as unknown as JobReport;
  return { ...f, job, input, result, providerCalls: () => providerCalls, read, async run() {
    const done = waitFor(f.scheduler, e => e.jobId === job.id && ["ready", "partial", "failed"].includes(e.states.report));
    f.scheduler.start(); await done; return read();
  } };
}

const cleanups: Array<() => unknown> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

it("persists a useful immutable shell before a browser failure", async () => {
  const f = await fixture({ after: cb => cleanups.push(cb) }, {
    executeJob: async (input, host) => resultFor(input, host, { text: "Captured answer survives Chromium failure" }),
    renderReport: async () => { throw new Error("Controlled Chromium launch failure"); },
  });
  const done = waitFor(f.scheduler, event => event.states.report === "failed");
  const { job } = await f.scheduler.admit({ idempotencyKey: "report-shell", input: await inputFor(f.repository) });
  await done;
  const failed = f.scheduler.getJob(job.id);
  expect(failed.reportRef, "a failed browser must leave a readable report, not only a generation blob").not.toBeNull();
  const shell = await f.repository.readJson(failed.reportRef!);
  expect(shell).toMatchObject({ jobId: job.id, result: failed.resultRef, output: { text: "Captured answer survives Chromium failure" } });
});

it("retains successful previews across provider-free retry, frozen snapshots, reconnects and restart", async () => {
  const base = createBlankProject(), generated = structuredClone(base);
  generated.commonEvents = ["one", "two"].map(id => ({ id, name: id, trigger: "none", commands: [{ kind: "text", body: `captured ${id}` }] }));
  let fail = true;
  const rendered: string[] = [];
  const f = await completedFixture({ base, generated, render: async (section, _p, render) => {
    rendered.push(section.id);
    if (section.objectId === "common/two" && fail) throw new Error("Controlled second preview failure");
    return render();
  } });
  const first = await f.run(), firstRef = f.scheduler.getJob(f.job.id).reportRef!;
  expect(f.scheduler.getJob(f.job.id).report).toBe("partial");
  const success = first.sections.find(s => s.objectId === "common/one")!.previews[0].artifact!;
  const originalBytes = await f.repository.readBlob(firstRef);
  const firstInbox = await (await f.request("/inbox")).json();
  expect(firstInbox.inbox).toHaveLength(1);
  generated.commonEvents[0].commands = [{ kind: "text", body: "LATER HUMAN EDIT" }];
  await f.repository.putJson(jsonValue(generated));
  expect(await f.repository.readBlob(firstRef)).toEqual(originalBytes);
  fail = false;
  const done = waitFor(f.scheduler, e => e.jobId === f.job.id && e.states.report === "ready");
  await f.scheduler.retry(f.job.id, { stage: "report" }); await done;
  const report = await f.read();
  expect(rendered.filter(id => id === "commands:common/one:generated")).toHaveLength(1);
  expect(report.sections.find(s => s.objectId === "common/one")!.previews[0].artifact).toEqual(success);
  expect(JSON.stringify(report)).not.toContain("LATER HUMAN EDIT");
  expect(f.providerCalls()).toBe(0);
  expect(f.repository.snapshot().attempts.filter(a => a.stage === "generation")).toHaveLength(1);
  const [a, b] = await Promise.all([f.request("/inbox"), f.request("/inbox")]);
  expect(await a.json()).toEqual(await b.json());
  expect((await (await f.request("/inbox")).json()).inbox).toEqual(firstInbox.inbox);
  await f.post(`/inbox/${firstInbox.inbox[0].eventSeq}/read`, {});
  await f.post(`/inbox/${firstInbox.inbox[0].eventSeq}/read`, {});
  expect((await f.request(`/${f.job.id}/artifacts/${success.sha256}`)).status).toBe(200);
  const foreign = await f.repository.putBlob(new Uint8Array([91, 92]), "image/png");
  expect((await f.request(`/${f.job.id}/artifacts/${foreign.sha256}`)).status).toBe(404);
  await f.scheduler.close(); await f.repository.close();
  const reopened = await openAiJobsRepository({ directory: f.directory });
  try {
    expect(await reopened.readBlob(firstRef)).toEqual(originalBytes);
    expect(reopened.snapshot().inbox).toHaveLength(1);
    expect(reopened.snapshot().inbox[0].readAt).not.toBeNull();
  } finally { await reopened.close(); }
}, 30000);

it("reports actual read-only text without fake imagery or usage totals", async () => {
  const base = createBlankProject();
  const f = await completedFixture({ base, generated: base, payload: { text: "Actual captured answer", completion: "complete" } });
  const report = await f.run();
  expect(report.sections).toEqual([]);
  expect(report.output.text).toBe("Actual captured answer");
  expect(report.usage).toBeNull();
  expect(report.states).toEqual({ generation: "succeeded", application: "awaiting-review", save: "unsaved" });
});

it("keeps an already durable preview when the browser crashes, then retries only unfinished rendering", async () => {
  const base = createBlankProject(), generated = structuredClone(base);
  generated.commonEvents = ["first", "second"].map(id => ({ id, name: id, trigger: "none", commands: [{ kind: "text", body: id }] }));
  let crash = true;
  const f = await completedFixture({ base, generated, crashAfterPreview: () => crash });
  const failed = await f.run();
  expect(f.scheduler.getJob(f.job.id).report).toBe("failed");
  const first = failed.sections.find(s => s.objectId === "common/first")!.previews[0];
  expect(first.status).toBe("ready");
  expect(failed.sections.find(s => s.objectId === "common/second")!.previews[0].status).toBe("pending");
  crash = false;
  const done = waitFor(f.scheduler, e => e.jobId === f.job.id && e.states.report === "ready");
  await f.scheduler.retry(f.job.id, { stage: "report" }); await done;
  expect((await f.read()).sections.find(s => s.objectId === "common/first")!.previews[0]).toEqual(first);
  expect(f.providerCalls()).toBe(0);
  expect(f.repository.snapshot().attempts.filter(a => a.stage === "generation")).toHaveLength(1);
});

it("enumerates every map and asset, aligns region comparisons, and marks missing/unsupported previews", async () => {
  const base = createBlankProject(), generated = structuredClone(base);
  const original = base.maps[base.startMapId];
  for (let i = 0; i < 5; i++) {
    const id = `map-${i}`;
    base.maps[id] = { ...structuredClone(original), id, name: id };
    generated.maps[id] = { ...structuredClone(base.maps[id]), name: `Changed ${i}` };
  }
  generated.assets.uploaded.remote = { id: "remote", name: "Not captured", kind: "picture", dataUrl: "https://mutable.invalid/image.png", meta: {} };
  const f = await completedFixture({ family: "region", base, generated,
    payload: { mapId: "map-0", region: { x: 1, y: 1, width: 2, height: 3 } } });
  const report = await f.run();
  expect(new Set(report.sections.filter(s => s.kind === "map").map(s => s.objectId)).size).toBe(5);
  const aligned = report.sections.filter(s => s.objectId === "map-0");
  expect(aligned).toHaveLength(2);
  expect(aligned[0].data.crop).toEqual(aligned[1].data.crop);
  expect(aligned[0].data.scale).toBe(aligned[1].data.scale);
  expect(aligned.every(s => s.previews[0].status === "missing")).toBe(true);
  expect(report.sections.find(s => s.objectId === "remote")!.previews[0].status).toBe("unsupported");
  expect(JSON.stringify(report.sections)).not.toContain("lowerTiles");
}, 30000);

it("uses real DB record artwork bindings and image proposals, not live records", async () => {
  const base = createBlankProject(), generated = structuredClone(base);
  generated.database.items[0].name = "Captured item";
  generated.database.items[0].iconResourceId = "uncaptured-icon";
  generated.assets.uploaded["uncaptured-icon"] = { id: "uncaptured-icon", name: "Unpinned icon", kind: "picture", dataUrl: "https://mutable.invalid/icon.png", meta: {} };
  const db = await completedFixture({ family: "database", base, generated });
  const report = await db.run();
  const item = report.sections.find(s => s.objectId === `items/${generated.database.items[0].id}`)!;
  expect(item, JSON.stringify(report.failure)).toBeDefined();
  expect((item.data.record as JsonObject).name).toBe("Captured item");
  expect(item.previews[0]).toMatchObject({ id: "iconResourceId", role: "artwork", status: "unsupported" });
  const image = await completedFixture({ family: "image", proposal: async repo => {
    const artifact = await repo.putBlob(new Uint8Array([1, 2, 3]), "application/octet-stream");
    return { artifacts: [artifact], payload: { proposal: { resource: { name: "Captured image", artifact: jsonValue(artifact), width: 32, height: 16 }, destination: { kind: "database-field", recordId: "item-A" } } } };
  } });
  const imageReport = await image.run();
  expect(imageReport.sections[0].previews[0].status).toBe("unsupported");
  expect((imageReport.sections[0].data.proposal as JsonObject).destination).toEqual({ kind: "database-field", recordId: "item-A" });
});

it("renders deterministic event/quest structure and canonical branches without treating conditions/routes as commands", async () => {
  const commands: JsonObject[] = [
    { kind: "fork", condition: { kind: "all", conditions: [{ kind: "switch", switchId: "s", value: true }] }, then: [{ kind: "text", body: "참" }], else: [] },
    { kind: "shop", goods: [], failedTransactionBranch: [{ kind: "text", body: "실패" }] },
    { kind: "choices", options: [{ text: "선택", branch: [] }], cancelBehavior: "branch", cancelBranch: [{ kind: "text", body: "취소" }] },
    { kind: "moveEvent", eventId: "e", route: { commands: [{ kind: "wait", ms: 10 }] } },
  ];
  const graph = commandReportFlow(commands);
  expect(graph.nodes.filter(n => (n.value as JsonObject).kind === "switch" || (n.value as JsonObject).kind === "wait")).toEqual([]);
  expect(graph.nodes.some(n => n.label.includes("실패"))).toBe(true);
  expect(graph.nodes.some(n => n.label.includes("취소"))).toBe(true);
  expect(reportFlowSvg(graph)).toEqual(reportFlowSvg(commandReportFlow(commands)));
  const event = await completedFixture({ family: "event-commands", proposal: async repo => {
    const proposalRef = await repo.putJson({ baseCommands: [], finalCommands: commands, review: { excludedRowIds: [] } });
    return { artifacts: [proposalRef], payload: { proposalRef: jsonValue(proposalRef) } };
  } });
  const eventReport = await event.run();
  expect(eventReport.sections[0].data.finalCommands).toEqual(commands);
  expect(eventReport.sections[0].previews[0].status).toBe("ready");
  const quest = { kind: "graph", id: "q", title: "Quest", nodes: [{ id: "a", description: "시작", completesWhen: { kind: "switch", switchId: "s", value: true } }, { id: "b", description: "완료", completesWhen: { kind: "switch", switchId: "s", value: true } }], edges: [{ from: "a", to: "b" }] };
  expect(questReportFlow(quest).edges).toEqual([{ from: "a", to: "b", label: "requires" }]);
  const base = createBlankProject(), generated = structuredClone(base);
  generated.switches.push({ id: "s", name: "Quest switch" });
  generated.quests = [quest as unknown as NonNullable<Project["quests"]>[number]];
  generated.commonEvents = [{ id: "ce", name: "Common event", trigger: "none", commands: [{ kind: "text", body: "actual" }] }];
  generated.database.troops[0].battleEventPages = [{ id: "stable-page", name: "Troop page", conditions: [], span: "battle", commands: [{ kind: "text", body: "battle" }] }];
  const f = await completedFixture({ base, generated });
  const report = await f.run();
  expect(report.sections.find(s => s.kind === "quest")!.previews[0].status).toBe("ready");
  expect(report.sections.some(s => s.objectId === `troop/${generated.database.troops[0].id}/stable-page`)).toBe(true);
});

it.each(["cluster-edit", "range-classify", "unclassified-analysis", "knowledge-analysis", "question-followup", "proposal-draft", "structure-kit-metadata"])("retains tileset %s atlas, every crop and exact proposal metadata", async operation => {
  const base = createBlankProject(), tilesetId = base.maps[base.startMapId].tilesetId;
  const f = await completedFixture({ family: "tileset", base, inputPayload: { operation, tilesetId, selectedTiles: [0, 2, 4] },
    payload: { kind: operation, tilesetId, mapping: { tiles: [{ tile: 6, label: "changed metadata" }] } } });
  const report = await f.run();
  const section = report.sections.find(s => s.kind === "tileset")!;
  expect(section.data.changedTileIds).toEqual([0, 2, 4, 6]);
  expect(section.previews.map(p => p.id)).toEqual(["atlas", "tile/0", "tile/2", "tile/4", "tile/6"]);
  expect(section.previews.every(p => p.status === "missing")).toBe(true);
  expect((section.data.proposal as JsonObject).kind).toBe(operation);
});

async function uploadApplied(f: Awaited<ReturnType<typeof completedFixture>>, project: Project, draft = false, noChanges = false) {
  const serialized = canonicalJson(draft ? { project: canonicalProject(project), draftId: "draft-A", owner: { kind: "common-event", commonEventId: "ce" },
    commands: [{ kind: "text", body: "Actual reviewed draft" }], resources: {} } : canonicalProject(project));
  const hash = createHash("sha256").update(serialized).digest("hex");
  const claim = { claimId: randomUUID(), receiptId: randomUUID(), project: f.job.project, resultSha256: f.scheduler.getJob(f.job.id).resultRef!.sha256,
    baselineSha256: f.input.projectSnapshot.sha256 };
  expect((await f.post(`/${f.job.id}/application/prepare`, claim)).status).toBe(200);
  const upload = await f.post(`/${f.job.id}/application/artifact`, { claimId: claim.claimId, receiptId: claim.receiptId,
    project: claim.project, resultSha256: claim.resultSha256, serialized, snapshotSha256: hash });
  expect(upload.status).toBe(200);
  const artifact = (await upload.json()).artifact as BlobRef;
  const receipt = { claimId: claim.claimId, receiptId: claim.receiptId, project: claim.project, resultSha256: claim.resultSha256,
    application: "applied", save: "unsaved", evidence: { appliedSnapshotSha256: hash, appliedArtifact: artifact,
      scope: draft ? "draft" : "project", hashScheme: draft ? "command-draft-canonical-json-v1" : "project-canonical-json-no-event-drafts-v1", noChanges }, saveEvidence: null };
  const done = waitFor(f.scheduler, e => e.jobId === f.job.id && e.states.application === "applied" && ["ready", "partial", "failed"].includes(e.states.report));
  expect((await f.post(`/${f.job.id}/application/evidence`, receipt)).status).toBe(200);
  await done;
  return { claim, receipt, artifact, hash };
}

it("refreshes late receipt/save evidence without relabeling generated output or altering an earlier revision", async () => {
  const base = createBlankProject(), generated = structuredClone(base), applied = structuredClone(base);
  generated.maps[base.startMapId].name = "Generated map";
  applied.maps[base.startMapId].name = "Actual applied map including merge";
  const f = await completedFixture({ base, generated });
  const initial = await f.run(), initialRef = f.scheduler.getJob(f.job.id).reportRef!;
  const initialBytes = await f.repository.readBlob(initialRef);
  expect(initial.applied.status).toBe("not-applied");
  const { claim, artifact, hash } = await uploadApplied(f, applied);
  const report = await f.read();
  expect(report.applied).toMatchObject({ status: "available", scope: "project", artifact, noChanges: false });
  const map = report.sections.filter(s => s.kind === "map");
  expect((map.find(s => s.phase === "generated")!.data.map as JsonObject).name).toBe("Generated map");
  expect((map.find(s => s.phase === "applied")!.data.map as JsonObject).name).toBe("Actual applied map including merge");
  expect(map.find(s => s.phase === "applied")!.snapshot).toEqual(artifact);
  expect(report.states.save).toBe("unsaved");
  expect(await f.repository.readBlob(initialRef)).toEqual(initialBytes);
  const saved = waitFor(f.scheduler, e => e.jobId === f.job.id && e.states.save === "saved" && ["ready", "partial"].includes(e.states.report));
  expect((await f.post(`/${f.job.id}/application/save-evidence`, { claimId: claim.claimId, receiptId: claim.receiptId,
    project: claim.project, resultSha256: claim.resultSha256, saveAttemptId: "reload-proof", save: "saved",
    saveEvidence: { method: "reload", confirmedSnapshotSha256: hash } })).status).toBe(200);
  await saved;
  expect((await f.read()).states.save).toBe("saved");
  expect(f.providerCalls()).toBe(0);
}, 30000);

it("strictly rejects every mismatched applied artifact binding and preserves noChanges/draft distinctions", async () => {
  const base = createBlankProject();
  const f = await completedFixture({ base, generated: base }); await f.run();
  await uploadApplied(f, base, false, true);
  const job = f.scheduler.getJob(f.job.id);
  expect((await f.read()).applied.noChanges).toBe(true);
  const corruptions: Array<(j: AiJob) => AiJob> = [
    j => ({ ...j, applicationEvidence: { ...j.applicationEvidence, artifact: { ...(j.applicationEvidence!.artifact as JsonObject), receiptId: "foreign" } } }),
    j => ({ ...j, applicationEvidence: { ...j.applicationEvidence, artifact: { ...(j.applicationEvidence!.artifact as JsonObject), resultSha256: "a".repeat(64) } } }),
    j => ({ ...j, applicationEvidence: { ...j.applicationEvidence, artifact: { ...(j.applicationEvidence!.artifact as JsonObject), ref: { sha256: "b".repeat(64), byteLength: 1, mediaType: "application/json" } } } }),
    j => ({ ...j, applicationEvidence: { ...j.applicationEvidence, receipt: { ...(j.applicationEvidence!.receipt as JsonObject), evidence: { ...((j.applicationEvidence!.receipt as JsonObject).evidence as JsonObject), hashScheme: "wrong-scheme" } } } }),
    j => ({ ...j, applicationEvidence: {} }),
  ];
  for (const corrupt of corruptions) expect(appliedReportBinding(corrupt(structuredClone(job))).status).toBe("unavailable");
  const draft = await completedFixture({ base, generated: base }); await draft.run();
  await uploadApplied(draft, base, true);
  const report = await draft.read();
  expect(report.applied.scope).toBe("draft");
  expect(report.sections.filter(s => s.phase === "applied")).toEqual([]);
  expect(report.sections.find(s => s.phase === "applied-draft")!.data.commands).toEqual([{ kind: "text", body: "Actual reviewed draft" }]);
  expect(report.states.save).toBe("unsaved");
}, 30000);

it.each(["failed", "cancelled", "interrupted"] as const)("exposes retained staged output after %s generation without a fabricated result", async status => {
  const f = await fixture({ after: cb => cleanups.push(cb) }, { renderReport: (result, host) => renderJobReport(result, host) });
  const input = await inputFor(f.repository), { job } = await f.repository.admit({ idempotencyKey: randomUUID(), input });
  const artwork = await f.repository.putBlob(new Uint8Array([1, 2, 3]), "image/png");
  const text = await f.repository.putJson({ text: "Actual completed text stage" });
  const attemptId = randomUUID(), now = Date.now();
  const checkpoint = await f.repository.putJson({ version: 1, jobId: job.id, attemptId, inputSha256: job.inputRef.sha256,
    stageKey: "database/artwork", state: { patch: { name: "Retained generated record" }, failure: { stage: "postprocess" } }, artifacts: [jsonValue(artwork), jsonValue(text)] });
  await f.repository.transaction(draft => {
    draft.attempts.push({ id: attemptId, jobId: job.id, stage: "generation", status, startedAt: now, finishedAt: now, error: "controlled downstream failure" });
    const current = draft.jobs.find(j => j.id === job.id)!; current.generation = status; current.checkpointRef = checkpoint;
  });
  const done = waitFor(f.scheduler, e => e.jobId === job.id && e.states.report === "partial");
  f.scheduler.start(); await done;
  const report = await f.repository.readJson(f.scheduler.getJob(job.id).reportRef!) as unknown as JobReport;
  expect(report).toMatchObject({ source: "checkpoint", result: null, generatedSnapshot: null, states: { generation: status }, checkpoint });
  expect(report.sections).toHaveLength(2);
  expect(report.sections.every(s => s.phase === "staged")).toBe(true);
  expect(report.artifacts).toContainEqual(artwork);
  expect(report.artifacts).toContainEqual(text);
  expect(JSON.stringify(report.output)).toContain("Retained generated record");
  expect(f.repository.snapshot().operations).toEqual([]);
});

it("fences cancelled report checkpoints and rejects foreign preview references", async () => {
  const entered = deferred(), release = deferred();
  const base = createBlankProject(), generated = structuredClone(base);
  generated.commonEvents = [{ id: "ce", name: "Flow", trigger: "none", commands: [{ kind: "text", body: "retained" }] }];
  const f = await completedFixture({ base, generated, render: async (_section, _preview, render) => { entered.resolve(); await release.promise; return render(); } });
  const interrupted = waitFor(f.scheduler, e => e.jobId === f.job.id && e.states.report === "interrupted");
  f.scheduler.start();
  try { await deadline(entered.promise); await f.scheduler.cancel(f.job.id); await interrupted; }
  finally { release.resolve(); }
  const ref = f.scheduler.getJob(f.job.id).reportRef;
  await f.scheduler.close();
  expect(f.scheduler.getJob(f.job.id).reportRef).toEqual(ref);
  expect(f.scheduler.getJob(f.job.id).generation).toBe("succeeded");
  const repo = f.repository;
  const foreign = await repo.putBlob(new Uint8Array([9]), "image/png");
  const scheduler = createAiJobsScheduler({ repository: repo, renderReport: async (_r, host) => {
    await expect(host.readBlob(foreign)).rejects.toThrow("manifest");
    await expect(host.saveReport({ ...host.report.document, artifacts: [...host.report.document.artifacts, foreign] })).rejects.toThrow("manifest");
    const original = host.report.document.sections[0];
    await expect(host.saveReport({ ...host.report.document, sections: [{ ...original, phase: "applied" }] })).rejects.toThrow("receipt-bound");
    return renderJobReport(_r, host);
  } });
  try {
    const done = waitFor(scheduler, e => e.jobId === f.job.id && e.states.report === "ready");
    await scheduler.retry(f.job.id, { stage: "report" }); await done;
  } finally { await scheduler.close(); }
}, 30000);

it("does not repeat captured binary artwork in gallery revisions", async () => {
  const base = createBlankProject(), generated = structuredClone(base);
  const encoded = Buffer.alloc(256 * 1024, 42).toString("base64");
  for (let i = 0; i < 4; i++) generated.assets.uploaded[`large-${i}`] = {
    id: `large-${i}`, name: `Captured artwork ${i}`, kind: "picture", dataUrl: `data:image/png;base64,${encoded}`, meta: { width: 512, height: 512 },
  };
  const f = await completedFixture({ base, generated, render: async () => { throw new Error("Controlled decoder fault"); } });
  const report = await f.run();
  expect(report.sections.filter(s => s.kind === "artwork")).toHaveLength(4);
  const serialized = JSON.stringify(report);
  expect(serialized.includes("data:image/")).toBe(false);
  expect(serialized.length).toBeLessThan(24_000);
  for (const r of report.artifacts.filter(r => r.mediaType === "application/json" && r.sha256 !== report.input.sha256
    && r.sha256 !== report.result?.sha256 && r.sha256 !== report.baseSnapshot.sha256 && r.sha256 !== report.generatedSnapshot?.sha256)) {
    expect((await f.repository.readBlob(r)).byteLength).toBeLessThan(24_000);
  }
});
