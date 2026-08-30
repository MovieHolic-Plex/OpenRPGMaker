import { newCommand } from "../src/editor/eventCommandFactory.ts";
import { COMMAND_KINDS } from "../src/project/commandKindRegistry.ts";
import { COMMAND_GUARANTEES } from "../src/project/commandGuaranteeRegistry.ts";
const ai = COMMAND_KINDS.filter((k) => COMMAND_GUARANTEES[k].authoringSurfaces.includes("ai"));
const withRes = ai.filter((k) => "resourceId" in (newCommand(k as never) as Record<string, unknown>));
console.log("resourceId kinds:", withRes.join(", "));
const total = ai.map((k) => `- ${k}: ${JSON.stringify(newCommand(k as never))}`).join("\n").length;
const trimmed = ai.filter((k)=>!withRes.includes(k)).map((k) => `- ${k}: ${JSON.stringify(newCommand(k as never))}`).join("\n").length;
console.log("example block chars: all=" + total + " without-resource=" + trimmed);
