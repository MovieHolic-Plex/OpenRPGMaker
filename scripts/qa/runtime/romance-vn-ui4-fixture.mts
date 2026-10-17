// 런타임 QA 입력(수리 PR): 2단계 픽스처 위에 인물 11명(엔딩 11개)을 더해 엔딩 체크리스트가 12행 + 공통 행으로 넘치게 한다.
//   bun scripts/qa/runtime/romance-vn-ui4-fixture.mts <outDir> [language]
import { readFileSync, writeFileSync } from "node:fs";
import { deserialize, serialize } from "../../../src/project/io.ts";
process.argv[3] = process.argv[3] ?? "ko";
await import("./romance-vn-ui2-fixture.mts");
const outDir = process.argv[2]!;
const project: any = deserialize(readFileSync(`${outDir}/project.json`, "utf8"));
const proof = JSON.parse(readFileSync(`${outDir}/proof.json`, "utf8"));
const names = ["하나", "민준", "지아", "도윤", "서연", "준호", "예린", "시우", "다은", "태양", "유진"];
project.characters = project.characters ?? {};
names.forEach((name, index) => {
  const id = `char_extra_${index + 1}`;
  project.characters[id] = { ...(project.characters[id] ?? {}), displayName: name };
  project.endings.push({ id: `ending_with_${id}_happy`, name: `${name}와 해피`, priority: 3, conditions: [{ kind: "friendshipAtLeast", npcKey: id, value: 60 }] });
  if (index % 3 === 0) project.endings.push({ id: `ending_with_${id}_normal`, name: `${name}와 평범`, priority: 2, conditions: [{ kind: "friendshipAtLeast", npcKey: id, value: 25 }] });
});
writeFileSync(`${outDir}/project.json`, serialize(project));
writeFileSync(`${outDir}/proof.json`, JSON.stringify({ ...proof, extraCharacters: names.length, totalEndings: project.endings.length }, null, 1));
console.log(JSON.stringify({ endings: project.endings.length }));
