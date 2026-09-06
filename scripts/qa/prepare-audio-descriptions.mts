import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { audioDescriptionProject, AUDIO_QA_BGM_ID } from "../../test/fixtures/audioDescriptions";
import { prepareWebExport } from "../../src/project/webExport";

const output = process.argv[2];
assert.ok(output?.endsWith(".json") && !output.startsWith("-"), "Pass a new output project.json path");
const source = audioDescriptionProject();
assert.equal(source.system.defaultBgmResourceId, AUDIO_QA_BGM_ID);
const before = structuredClone(source);
const prepared = prepareWebExport(source);
assert.equal(Object.hasOwn(prepared.project, "audioDescriptions"), false);
assert.deepEqual(source, before);
await writeFile(output, prepared.projectJson, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({ projectPath: output, audioDescriptionsExcluded: true, sourcePreserved: true }));
