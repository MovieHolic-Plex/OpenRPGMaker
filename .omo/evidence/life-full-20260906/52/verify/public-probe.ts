import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { serialize as serializeProject, deserialize as parseProject, ProjectFormatError } from "@/project/io";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { resolvePlayerBody, playerBodyRect, playerPassageRect } from "@/project/playerFootprint";
import { startSession } from "@/project/session";
import { createSaveSnapshot, applySaveSnapshot, readSaveSlot, saveSlotKey } from "@/player/saveSlots";
import { createSaveSnapshot as legacySnapshot } from "../../../../../test/fixtures/life-full/saveSlots.phase1";
import { createLegacyLifeProject } from "../../../../../test/fixtures/life-full/legacyProject";

const E = ".omo/evidence/life-full-20260906/52/verify/captures/";
function capture(name: string, value: unknown): void {
  writeFileSync(E + name + ".json", JSON.stringify(value, (_key, v: unknown) =>
    v === undefined ? { $type: "undefined" } : typeof v === "number" && !Number.isFinite(v) ? { $number: String(v) } : v, 2) + "\n");
}
function wire(name: string, raw: string): string { writeFileSync(E + name + ".wire.json", raw); return readFileSync(E + name + ".wire.json", "utf8"); }
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  key(i: number): string | null { return [...this.data.keys()][i] ?? null; }
  getItem(k: string): string | null { return this.data.get(k) ?? null; }
  setItem(k: string, v: string): void { this.data.set(k, v); }
  removeItem(k: string): void { this.data.delete(k); }
}
export function runProbe(): void {
  mkdirSync(E, { recursive: true });
  const summary: unknown[] = [];
  const cases = [
    { name: "3x3-pass1", fields: { playerFootprint: { width: 3, height: 3 }, playerPassRows: 1 }, expected: { footprint: { width: 3, height: 3 }, passRows: 1 } },
    { name: "2x5-pass2", fields: { playerFootprint: { width: 2, height: 5 }, playerPassRows: 2 }, expected: { footprint: { width: 2, height: 5 }, passRows: 2 } },
    { name: "8x8-pass7", fields: { playerFootprint: { width: 8, height: 8 }, playerPassRows: 7 }, expected: { footprint: { width: 8, height: 8 }, passRows: 7 } },
    { name: "4x6-default", fields: { playerFootprint: { width: 4, height: 6 } }, expected: { footprint: { width: 4, height: 6 }, passRows: 6 } },
    { name: "pass-only", fields: { playerPassRows: 1 }, expected: { footprint: { width: 1, height: 1 }, passRows: 1 } },
    { name: "absent", fields: {}, expected: { footprint: { width: 1, height: 1 }, passRows: 1 } },
    { name: "undefined", fields: { playerFootprint: undefined, playerPassRows: undefined }, expected: { footprint: { width: 1, height: 1 }, passRows: 1 } },
  ];
  for (const c of cases) {
    const input = createLegacyLifeProject(); Object.assign(input.system, c.fields); capture(c.name + "-input", input);
    const inputWire = wire(c.name + "-input", serializeProject(input));
    let project = parseProject(inputWire); capture(c.name + "-parsed", project);
    const canonical = serializeProject(project);
    if (c.name === "absent" || c.name === "undefined") assert.equal(canonical, inputWire);
    for (const key of ["playerFootprint", "playerPassRows"] as const) assert.equal(Object.hasOwn(project.system, key), c.fields[key] !== undefined);
    for (let cycle = 0; cycle < 4; cycle++) {
      const session = startSession(project, 5201); const body = resolvePlayerBody(project, session);
      capture(c.name + `-cycle${cycle}`, { project, session, body });
      assert.deepEqual(body, c.expected); assert.equal(project.version, 4);
      assert.equal(session.playerFootprint, undefined); assert.equal(session.playerPassRows, undefined); assert.deepEqual(session.farmPlots, {});
      assert.deepEqual(normalizeSystemRecords(project.system), project.system);
      const output = wire(c.name + `-cycle${cycle}`, serializeProject(project)); assert.equal(output, canonical); project = parseProject(output);
    }
    summary.push({ name: c.name, body: resolvePlayerBody(project), cycles: 4, byteStable: true });
  }
  const project = parseProject(readFileSync(E + "3x3-pass1-input.wire.json", "utf8"));
  const baseWire = serializeProject(project); const session = startSession(project, 5201);
  const body = resolvePlayerBody(project, session);
  assert.deepEqual(playerBodyRect(body, 5, 7), { left: 4, right: 6, top: 5, bottom: 7 });
  assert.deepEqual(playerPassageRect(body, 5, 7), { left: 4, right: 6, top: 7, bottom: 7 });
  const overrides = [
    { fields: { playerPassRows: 2 }, expected: { footprint: { width: 3, height: 3 }, passRows: 2 } },
    { fields: { playerFootprint: { width: 2, height: 5 } }, expected: { footprint: { width: 2, height: 5 }, passRows: 1 } },
    { fields: { playerFootprint: { width: 2, height: 5 }, playerPassRows: 4 }, expected: { footprint: { width: 2, height: 5 }, passRows: 4 } },
    { fields: { playerFootprint: { width: 2, height: 1 }, playerPassRows: 3 }, expected: { footprint: { width: 2, height: 1 }, passRows: 1 } },
  ];
  overrides.forEach((c, i) => {
    const live = startSession(project, 5201); Object.assign(live, c.fields); const resolved = resolvePlayerBody(project, live);
    capture(`override${i}`, { project, inputSession: live, resolved }); assert.deepEqual(resolved, c.expected); assert.equal(serializeProject(project), baseWire);
  });
  for (const version of [4, 5]) {
    const snapshot = version === 4 ? legacySnapshot(project, session) : createSaveSnapshot(project, session);
    assert.equal(snapshot.schemaVersion, version);
    const raw = wire(`save${version}-input`, JSON.stringify(snapshot)); const storage = new MemoryStorage(); storage.setItem(saveSlotKey(1), raw);
    const parsed = readSaveSlot(storage, 1); capture(`save${version}-parsed`, parsed); assert.equal(parsed.kind, "present");
    if (parsed.kind !== "present") throw new Error("Missing save");
    assert.equal(parsed.snapshot.schemaVersion, 5); const resumed = applySaveSnapshot(project, parsed.snapshot);
    capture(`save${version}-resumed`, resumed); assert.deepEqual(resolvePlayerBody(project, resumed), body); assert.equal(storage.getItem(saveSlotKey(1)), raw);
    assert.equal(serializeProject(project), baseWire);
  }
  const malformed = [
    { fp: { width: 99, height: 99 }, rows: 99, expected: { footprint: { width: 8, height: 8 }, passRows: 8 } },
    { fp: { width: -2, height: 3 }, rows: 0, expected: { footprint: { width: 1, height: 3 }, passRows: 3 } },
    { fp: { width: 2.5, height: 3 }, rows: -1, expected: { footprint: { width: 1, height: 3 }, passRows: 3 } },
    { fp: { width: "3", height: 4 }, rows: 1.5, expected: { footprint: { width: 1, height: 4 }, passRows: 4 } },
    { fp: null, rows: 2, expected: { footprint: { width: 1, height: 1 }, passRows: 1 } },
    { fp: { width: 3, height: Number.MAX_SAFE_INTEGER + 1 }, rows: 2, expected: { footprint: { width: 3, height: 1 }, passRows: 1 } },
    ...[NaN, Infinity, -Infinity].map(v => ({ fp: { width: v, height: 3 }, rows: v, expected: { footprint: { width: 1, height: 3 }, passRows: 3 } })),
  ];
  malformed.forEach((c, i) => {
    const input = createLegacyLifeProject(); Object.assign(input.system, { playerFootprint: c.fp, playerPassRows: c.rows });
    capture(`invalid${i}-input`, input); const raw = wire(`invalid${i}-input`, serializeProject(input));
    let rejection: unknown;
    try { parseProject(raw); } catch (error) { assert.ok(error instanceof ProjectFormatError); rejection = { name: error.name, message: error.message }; }
    assert.ok(rejection); const normalized = normalizeSystemRecords(input.system); capture(`invalid${i}-normalized`, { normalized, rejection });
    assert.deepEqual(resolvePlayerBody(input), c.expected); assert.deepEqual(resolvePlayerBody({ system: normalized }), c.expected);
    assert.deepEqual(normalizeSystemRecords(normalized), normalized); input.system = normalized;
    const parsed = parseProject(wire(`invalid${i}-normalized`, serializeProject(input))); const live = startSession(parsed, 5201);
    capture(`invalid${i}-result`, { parsed, live, body: resolvePlayerBody(parsed, live) }); assert.deepEqual(resolvePlayerBody(parsed, live), c.expected);
  });
  const result = { status: "confirmed", cases: summary, overrides: overrides.length, malformed: malformed.length, projectVersion: 4, saveInputs: [4, 5], saveParsedVersion: 5, body, bodyRect: playerBodyRect(body, 5, 7), passageRect: playerPassageRect(body, 5, 7), startingFarmPlots: session.farmPlots };
  capture("result", result); console.log(JSON.stringify(result, null, 2));
}
