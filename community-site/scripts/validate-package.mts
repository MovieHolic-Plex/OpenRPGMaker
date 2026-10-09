import { readFile } from "node:fs/promises";
import { createProjectPackage, readProjectPackage } from "@/project/package";

const file = process.argv[2];
if (!file) {
  console.error("usage: validate-package.mts <package-file>");
  process.exit(2);
}

try {
  const bytes = await readFile(file);
  const project = await readProjectPackage(new Blob([bytes]));
  const normalized = createProjectPackage(project);
  const normalizedBase64 = Buffer.from(await normalized.arrayBuffer()).toString("base64");
  console.log(
    JSON.stringify({
      ok: true,
      title: project.meta.title,
      mapCount: Object.keys(project.maps).length,
      uploadedAssetCount: Object.keys(project.assets.uploaded).length,
      normalizedBase64,
    }),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.log(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}
