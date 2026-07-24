import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export interface EditorCheckResult {
  ok: boolean;
  mapCount?: number;
  uploadedAssetCount?: number;
  normalizedBase64?: string;
  error?: string;
}

export async function validatePackageWithEditor(bytes: Buffer): Promise<EditorCheckResult> {
  const siteRoot = process.cwd();
  const repoRoot = path.resolve(siteRoot, "..");
  const script = path.join(siteRoot, "scripts", "validate-package.mts");
  const dir = await mkdtemp(path.join(tmpdir(), "openrpg-pkg-"));
  const file = path.join(dir, "upload.oprn");
  await writeFile(file, bytes);
  try {
    return await runEditorCheck(script, file, repoRoot);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runEditorCheck(script: string, file: string, cwd: string): Promise<EditorCheckResult> {
  return new Promise((resolve) => {
    const executable = process.platform === "win32" ? "npx.cmd" : "npx";
    const child = spawn(executable, ["tsx", script, file], {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let settled = false;
    const finish = (result: EditorCheckResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, error: "editor validation timed out" });
    }, 90_000);
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.on("error", () => {
      clearTimeout(timer);
      finish({ ok: false, error: "editor validation failed to start" });
    });
    child.on("close", () => {
      clearTimeout(timer);
      const line = stdout.trim().split("\n").pop() ?? "";
      try {
        const result: unknown = JSON.parse(line);
        finish(parseEditorCheckResult(result));
      } catch {
        finish({ ok: false, error: "editor validator returned an invalid response" });
      }
    });
  });
}

function parseEditorCheckResult(value: unknown): EditorCheckResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "editor validator returned an invalid response" };
  }
  const ok = Reflect.get(value, "ok");
  if (ok !== true) return { ok: false, error: "editor rejected the package" };
  const mapCount = Reflect.get(value, "mapCount");
  const uploadedAssetCount = Reflect.get(value, "uploadedAssetCount");
  const normalizedBase64 = Reflect.get(value, "normalizedBase64");
  if (
    typeof mapCount !== "number"
    || typeof uploadedAssetCount !== "number"
    || typeof normalizedBase64 !== "string"
  ) {
    return { ok: false, error: "editor validator returned an invalid response" };
  }
  return { ok: true, mapCount, uploadedAssetCount, normalizedBase64 };
}
