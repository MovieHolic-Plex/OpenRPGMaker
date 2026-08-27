// 툴 능력 색인 섹션을 증거 파일로 덤프한다(수동 실행 전용).
//   npx vite-node scripts/dump-tool-capability-index.mts [outPath]
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildToolCapabilityIndex } from "@/ai/toolCapabilityIndex";
import { activeTools } from "@/editor/tools";

const out = process.argv[2] ?? ".omo/evidence/ai-editor-reach-20260827/capability-index-section.txt";
const section = buildToolCapabilityIndex();
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${section}\n`, "utf8");
console.log(`wrote ${out}: chars=${section.length}, indexedTools=${activeTools().length}`);
