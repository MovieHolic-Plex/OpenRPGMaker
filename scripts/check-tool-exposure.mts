/** tile 모드 노출 쿼터 점검 — 실내 세션 도구가 상한(40) 트림에서 살아남는지 확인. */
import { toOpenAiTools } from "../src/editor/tools/toolRegistry.ts";

const tools = toOpenAiTools(undefined, { mode: "tile" });
const names = tools.map((t) => t.function.name);
console.log("tile mode 노출 수:", tools.length);
console.log("interior 포함:", names.filter((n) => n.includes("interior")).join(", ") || "없음");
console.log(names.join(", "));
