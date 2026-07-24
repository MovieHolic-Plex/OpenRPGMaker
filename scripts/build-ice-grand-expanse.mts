import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  IceGrandExpanseInstallError,
  installIceGrandExpanse,
} from "../src/project/defaults/iceGrandExpanse.ts";
import { deserialize } from "../src/project/io/serialize.ts";

type BuildArgs = {
  readonly projectJson: string;
  readonly expectedCanonicalMapHash?: string;
};

class IceGrandExpanseBuildError extends Error {
  readonly code: "ARGUMENT_INVALID" | "REMOTE_MUTATION_NOT_IMPLEMENTED";

  constructor(code: "ARGUMENT_INVALID" | "REMOTE_MUTATION_NOT_IMPLEMENTED", message: string) {
    super(message);
    this.name = "IceGrandExpanseBuildError";
    this.code = code;
  }
}

export function parseBuildIceGrandExpanseArgs(argv: readonly string[]): BuildArgs {
  let projectJson = "";
  let expectedCanonicalMapHash: string | undefined;
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--save" || key === "--verify-reload") {
      throw new IceGrandExpanseBuildError(
        "REMOTE_MUTATION_NOT_IMPLEMENTED",
        "Supabase mutation is reserved for Todo 8 and is disabled in this builder",
      );
    }
    if (value === undefined || (key !== "--project-json" && key !== "--expected-canonical-map-sha")) {
      throw new IceGrandExpanseBuildError("ARGUMENT_INVALID", "Expected --project-json and optional canonical SHA pairs");
    }
    if (key === "--project-json") projectJson = value;
    if (key === "--expected-canonical-map-sha") expectedCanonicalMapHash = value;
  }
  if (!projectJson || !/^[a-f0-9]{64}$/u.test(expectedCanonicalMapHash ?? "0".repeat(64))) {
    throw new IceGrandExpanseBuildError("ARGUMENT_INVALID", "A project JSON path and valid optional SHA-256 are required");
  }
  return expectedCanonicalMapHash === undefined ? { projectJson } : { projectJson, expectedCanonicalMapHash };
}

async function main(): Promise<void> {
  const args = parseBuildIceGrandExpanseArgs(process.argv.slice(2));
  const absoluteProjectPath = args.projectJson === "-" ? null : path.resolve(args.projectJson);
  const rawProject = absoluteProjectPath === null
    ? await readStandardInput()
    : await readFile(absoluteProjectPath, "utf8");
  const project = deserialize(rawProject.replace(/^\uFEFF/u, ""));
  const result = await installIceGrandExpanse(project, {
    expectedCanonicalMapHash: args.expectedCanonicalMapHash,
  });
  process.stdout.write(`${JSON.stringify({
    kind: result.kind,
    manifest: result.manifest,
    mapHash: result.mapHash,
    mutatedRemote: false,
    sourcePath: absoluteProjectPath === null
      ? "stdin"
      : path.relative(process.cwd(), absoluteProjectPath).replaceAll("\\", "/"),
  })}\n`);
}

async function readStandardInput(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

const entryPath = process.argv[1];
if (entryPath !== undefined && import.meta.url === pathToFileURL(entryPath).href) {
  main().catch((error: unknown) => { // no-excuse-ok: catch -- top-level CLI boundary
    const payload = error instanceof IceGrandExpanseBuildError || error instanceof IceGrandExpanseInstallError
      ? { code: error.code, message: error.message }
      : { code: "BUILD_FAILED", message: error instanceof Error ? error.message : "Unknown build failure" };
    process.stderr.write(`${JSON.stringify(payload)}\n`);
    process.exitCode = 1;
  });
}
