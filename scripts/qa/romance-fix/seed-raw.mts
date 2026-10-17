// 인터뷰 브리프 → 조수 턴 시작 전(뼈대·하네스 시드 전)의 새 프로젝트 JSON. romance-scene-contract.mjs 의 baseline 용.
import { readFileSync, writeFileSync } from "node:fs";
import { createNewProjectSeed } from "../../../src/editor/genrePacks.ts";
import { newProjectChoiceById } from "../../../src/editor/newProjectChoices.ts";
import { normalizeGameDesignBrief } from "../../../src/project/gameDesignBrief.ts";
import { deserialize, serialize } from "../../../src/project/io.ts";
const input = JSON.parse(readFileSync(process.argv[2]!, "utf8"));
const choice = newProjectChoiceById(input.presetId)!;
const brief = normalizeGameDesignBrief({ ...input.brief, version: 1, presetId: input.presetId });
const seed = createNewProjectSeed(choice.packId, input.title.trim() || "새 프로젝트");
seed.gameDesignBrief = brief;
const project = deserialize(serialize(seed));
writeFileSync(process.argv[3]!, serialize(project));
console.log("raw baseline", project.startMapId, Object.keys(project.maps).length);
