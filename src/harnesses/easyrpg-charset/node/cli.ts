import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  CHARSET_LLM_WARNING_KO,
  EASYRPG_CHARSET_HARNESS,
  charsetLlmWarning,
  isRecommendedCharsetLlm,
} from "../harness";

function extractModelFlag(args: readonly string[]): { model: string | undefined; strict: boolean; rest: string[] } {
  let model: string | undefined;
  let strict = false;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i]!;
    if (token === "--strict") {
      strict = true;
      continue;
    }
    if (token === "--model" && i + 1 < args.length) {
      model = args[i + 1];
      rest.push(token, args[i + 1]!);
      i += 1;
      continue;
    }
    if (token.startsWith("--model=")) {
      model = token.slice("--model=".length);
      rest.push(token);
      continue;
    }
    rest.push(token);
  }
  return { model: model ?? process.env.OPRN_CHARSET_MODEL, strict, rest };
}

function runPython(scriptPath: string, scriptArgs: readonly string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(process.env.PYTHON3 ?? "python3", [scriptPath, ...scriptArgs], { stdio: "inherit" });
    child.once("error", (error) => {
      console.error(error.message);
      resolve(1);
    });
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

export async function run(argv: string[]): Promise<number> {
  const [stage, ...rawArgs] = argv;
  if (!stage || stage === "--help" || stage === "-h") {
    console.log(`${EASYRPG_CHARSET_HARNESS.title}\n⚠️  ${CHARSET_LLM_WARNING_KO}\n`);
    console.log(EASYRPG_CHARSET_HARNESS.stages.map((s) => `  ${s.id.padEnd(12)} ${s.summary}`).join("\n"));
    return 0;
  }

  const extraHelperStages = new Set(["face-check", "kinematics-check"]);
  if (!EASYRPG_CHARSET_HARNESS.stages.some((s) => s.id === stage) && !extraHelperStages.has(stage)) {
    console.error(`모르는 단계: ${stage}`);
    return 2;
  }

  const { model, strict, rest } = extractModelFlag(rawArgs);

  if (stage === "check-model") {
    const positional = rest.find((arg) => !arg.startsWith("-"));
    const targetModel = model ?? positional;
    if (isRecommendedCharsetLlm(targetModel)) {
      console.log(`[OK] 권장 LLM 확인됨: ${targetModel} (Carbon / Fable 계열)`);
      return 0;
    }
    console.error(charsetLlmWarning(targetModel));
    return strict ? 2 : 0;
  }

  if (model !== undefined) {
    const warning = charsetLlmWarning(model);
    if (warning) {
      console.error(warning);
      if (strict) return 2;
    }
  } else if (stage === "seed") {
    console.error(`[안내] ${CHARSET_LLM_WARNING_KO}`);
  }

  if (stage === "install") {
    const installScript = fileURLToPath(new URL("../../charset-actor/install_fantasy_people.py", import.meta.url));
    const installArgs = rest.filter((arg, idx) => {
      if (arg === "--model") return false;
      if (idx > 0 && rest[idx - 1] === "--model") return false;
      return !arg.startsWith("--model=");
    });
    return runPython(installScript, installArgs);
  }

  const batchScript = fileURLToPath(
    new URL("../../../../assistant-skills/easyrpg-charset-batch/scripts/easyrpg_batch.py", import.meta.url),
  );
  return runPython(batchScript, [stage, ...rest]);
}
