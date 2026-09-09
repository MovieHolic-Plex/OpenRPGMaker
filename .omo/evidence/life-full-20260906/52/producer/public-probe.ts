import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { deserialize, serialize, ProjectFormatError } from "@/project/io";
import { createBlankProject } from "@/project/defaults";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { resolvePlayerBody, playerBodyRect, playerPassageRect } from "@/project/playerFootprint";
import { startSession } from "@/project/session";
import { createSaveSnapshot, applySaveSnapshot } from "@/player/saveSlots";

export function runProbe(): void {
  const evidence = ".omo/evidence/life-full-20260906/52/producer/";
  const project = createBlankProject();
  project.system.playerFootprint = { width: 3, height: 3 };
  project.system.playerPassRows = 1;
  writeFileSync(evidence + "public-input.json", serialize(project));
  const input = readFileSync(evidence + "public-input.json", "utf8");
  const loaded = deserialize(input);
  const session = startSession(loaded, 52);
  const body = resolvePlayerBody(loaded, session);
  assert.deepEqual(body, { footprint: { width: 3, height: 3 }, passRows: 1 });
  const rounds = [];
  let wire = serialize(loaded);
  for (let i = 0; i < 3; i += 1) {
    const next = deserialize(wire);
    assert.deepEqual(normalizeSystemRecords(next.system), next.system);
    assert.equal(serialize(next), wire);
    rounds.push({ cycle: i, body: resolvePlayerBody(next, startSession(next, 52)), stable: true });
    wire = serialize(next);
  }
  const snapshot = createSaveSnapshot(loaded, session);
  const resumed = applySaveSnapshot(loaded, snapshot);
  assert.equal(snapshot.schemaVersion, 5);
  assert.equal(loaded.version, 4);
  assert.deepEqual(resolvePlayerBody(loaded, resumed), body);
  session.playerFootprint = { width: 2, height: 2 };
  session.playerPassRows = 2;
  const overridden = resolvePlayerBody(loaded, session);
  assert.deepEqual(overridden, { footprint: { width: 2, height: 2 }, passRows: 2 });
  const absent = createBlankProject();
  const absentLoaded = deserialize(serialize(absent));
  assert.equal(Object.hasOwn(absentLoaded.system, "playerFootprint"), false);
  assert.equal(Object.hasOwn(absentLoaded.system, "playerPassRows"), false);
  const malformed = createBlankProject();
  malformed.system.playerFootprint = { width: 99, height: 3 };
  malformed.system.playerPassRows = 0;
  assert.throws(() => deserialize(serialize(malformed)), ProjectFormatError);
  const normalized = normalizeSystemRecords(malformed.system);
  assert.deepEqual(normalized.playerFootprint, { width: 8, height: 3 });
  assert.equal(normalized.playerPassRows, 3);
  const result = {
    inputSystem: JSON.parse(input).system,
    parsedSystem: loaded.system,
    projectVersion: loaded.version, saveVersion: snapshot.schemaVersion,
    body, bodyRect: playerBodyRect(body, 5, 7), passageRect: playerPassageRect(body, 5, 7),
    rounds, overridden, resumedBody: resolvePlayerBody(loaded, resumed),
    absentBody: resolvePlayerBody(absentLoaded, startSession(absentLoaded, 52)),
    malformedWireRejected: true, normalizedMalformedBody: resolvePlayerBody({ system: normalized }),
    startingFarmPlots: session.farmPlots,
  };
  writeFileSync(evidence + "public-result.json", JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}
