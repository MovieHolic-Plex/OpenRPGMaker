import { readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { flattenImports } from "../scripts/css-flatten.mjs";

/** Read a CSS surface's direct-import family in the same order as the app. */
export function readCssFamily(entry: string, facade: string): string {
  const root = resolve(".");
  const slash = facade.lastIndexOf("/");
  const directory = slash === -1 ? "" : facade.slice(0, slash);
  const filename = slash === -1 ? facade : facade.slice(slash + 1);
  const family = `${directory}/${filename.replace(/^\d{2}-/u, "").replace(/\.css$/u, "")}`;
  const files = flattenImports(resolve(root, entry))
    .filter((item) => item.copy === 1)
    .map((item) => item.file)
    .filter((file) => {
      const rel = relative(root, file).split("\\").join("/");
      return rel === facade || (rel.startsWith(`${family}.part-`) && rel.endsWith(".css"));
    });
  if (files.length === 0) throw new Error(`CSS family is not imported: ${facade}`);
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}
