import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AGENT_RULES_SKILL_ID, renderAgentRulesSkill } from "../../src/ai/agentRules.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = join(root, "assistant-skills", AGENT_RULES_SKILL_ID, "SKILL.md");
mkdirSync(dirname(out), { recursive: true });
const text = renderAgentRulesSkill();
writeFileSync(out, text, "utf8");
process.stdout.write(`wrote ${out} — ${text.length} bytes\n`);
