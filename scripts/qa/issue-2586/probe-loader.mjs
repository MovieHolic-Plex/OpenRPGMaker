import { existsSync, readFileSync, statSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import { stripTypeScriptTypes } from "node:module";
const ALIASES = { "@/project/store": `${process.cwd()}/scripts/qa/issue-2586/store-stub.ts` };
export async function resolve(specifier, context, next) {
  if (process.env.PROBE_STORE_STUB === "1" && ALIASES[specifier]) return { url: pathToFileURL(ALIASES[specifier]).href, shortCircuit: true };
  if (specifier.startsWith("@/") || specifier.startsWith(".")) {
    const url = specifier.startsWith("@/") ? pathToFileURL(`${process.cwd()}/src/${specifier.slice(2)}`) : new URL(specifier, context.parentURL);
    const path = fileURLToPath(url);
    for (const suffix of ["", ".ts", ".tsx", ".js", "/index.ts"]) {
      if (existsSync(path + suffix) && statSync(path + suffix).isFile()) return { url: pathToFileURL(path + suffix).href, shortCircuit: true };
    }
  }
  return next(specifier, context);
}
export async function load(url, context, next) {
  const source = () => readFileSync(fileURLToPath(url), "utf8");
  if (url.endsWith(".ts")) return { format: "module", shortCircuit: true, source: stripTypeScriptTypes(source(), { mode: "transform" }) };
  if (url.endsWith(".json")) return { format: "module", shortCircuit: true, source: `export default ${source()}` };
  return next(url, context);
}
