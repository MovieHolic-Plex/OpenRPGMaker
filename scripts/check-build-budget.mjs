import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

const EXIT_OVER_BUDGET = 1;
const EXIT_INPUT_ERROR = 2;
const BYTES_PER_KB = 1024;

function usage() {
  return [
    "Usage: node scripts/check-build-budget.mjs --max-chunk-kb <number> --evidence <path> [--dist <dir> | --fixture <path>] [--approval <path>]",
    "",
    "Checks Vite production JS chunks from dist or a JSON fixture manifest.",
  ].join("\n");
}

function parseArgs(argv) {
  const parsed = {
    dist: "dist",
    evidence: undefined,
    fixture: undefined,
    approval: undefined,
    maxChunkKb: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];

    if (arg === "--max-chunk-kb") {
      parsed.maxChunkKb = value;
      index += 1;
    } else if (arg === "--evidence") {
      parsed.evidence = value;
      index += 1;
    } else if (arg === "--dist") {
      parsed.dist = value;
      index += 1;
    } else if (arg === "--fixture") {
      parsed.fixture = value;
      index += 1;
    } else if (arg === "--approval") {
      parsed.approval = value;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }

    if (value === undefined && arg.startsWith("--") && arg !== "--help") {
      throw new Error(`Missing value for ${arg}`);
    }
  }

  const maxChunkKb = Number(parsed.maxChunkKb);
  if (!Number.isFinite(maxChunkKb) || maxChunkKb <= 0) {
    throw new Error("--max-chunk-kb must be a positive number");
  }

  if (typeof parsed.evidence !== "string" || parsed.evidence.length === 0) {
    throw new Error("--evidence is required");
  }

  if (parsed.fixture !== undefined && parsed.dist !== "dist") {
    throw new Error("Use either --fixture or --dist, not both");
  }

  return {
    dist: parsed.dist,
    evidence: parsed.evidence,
    fixture: parsed.fixture,
    approval: parsed.approval,
    maxChunkKb,
  };
}

function normalizeChunkName(name) {
  return name.split(/[\\/]/).join("/");
}

function assertPlainObject(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function readStringField(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function readByteSize(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer byte count`);
  }
  return value;
}

async function readFixtureChunks(fixturePath) {
  const contents = await readFile(fixturePath, "utf8");
  const parsed = assertPlainObject(JSON.parse(contents), "fixture");
  if (!Array.isArray(parsed.chunks)) {
    throw new Error("fixture.chunks must be an array");
  }

  return parsed.chunks.map((entry, index) => {
    const chunk = assertPlainObject(entry, `fixture.chunks[${index}]`);
    return {
      name: normalizeChunkName(readStringField(chunk.name, `fixture.chunks[${index}].name`)),
      bytes: readByteSize(chunk.bytes, `fixture.chunks[${index}].bytes`),
    };
  });
}

async function listJsChunks(distPath) {
  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    const chunks = [];

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        chunks.push(...await walk(fullPath));
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        const info = await stat(fullPath);
        chunks.push({
          name: normalizeChunkName(relative(distPath, fullPath).split(sep).join("/")),
          bytes: info.size,
        });
      }
    }

    return chunks;
  }

  return walk(distPath);
}

function wildcardToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`);
}

async function readApprovals(approvalPath) {
  try {
    const contents = await readFile(approvalPath, "utf8");
    const parsed = assertPlainObject(JSON.parse(contents), "approval");
    if (!Array.isArray(parsed.approvals)) {
      throw new Error("approval.approvals must be an array");
    }

    return parsed.approvals.map((entry, index) => {
      const approval = assertPlainObject(entry, `approval.approvals[${index}]`);
      const namePattern = normalizeChunkName(readStringField(approval.namePattern, `approval.approvals[${index}].namePattern`));
      const maxChunkKb = Number(approval.maxChunkKb);
      if (!Number.isFinite(maxChunkKb) || maxChunkKb <= 0) {
        throw new Error(`approval.approvals[${index}].maxChunkKb must be a positive number`);
      }

      return {
        namePattern,
        maxChunkKb,
        reason: readStringField(approval.reason, `approval.approvals[${index}].reason`),
        approvedBy: readStringField(approval.approvedBy, `approval.approvals[${index}].approvedBy`),
        matcher: wildcardToRegExp(namePattern),
      };
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function approvalForChunk(chunk, approvals) {
  return approvals.find((approval) => approval.matcher.test(chunk.name) && chunk.bytes <= approval.maxChunkKb * BYTES_PER_KB);
}

async function writeEvidence(evidencePath, evidence) {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

function buildEvidence({ mode, sourcePath, maxChunkKb, approvalPath, approvals, chunks }) {
  const maxChunkBytes = maxChunkKb * BYTES_PER_KB;
  const sortedChunks = [...chunks].sort((left, right) => left.name.localeCompare(right.name));
  const measuredChunks = sortedChunks.map((chunk) => {
    const approval = approvalForChunk(chunk, approvals);
    const overLimit = chunk.bytes > maxChunkBytes;
    const status = overLimit ? (approval === undefined ? "overBudget" : "approvedOverBudget") : "withinBudget";

    return {
      name: chunk.name,
      bytes: chunk.bytes,
      kb: Number((chunk.bytes / BYTES_PER_KB).toFixed(2)),
      status,
      ...(approval === undefined
        ? {}
        : {
            approval: {
              namePattern: approval.namePattern,
              maxChunkKb: approval.maxChunkKb,
              approvedBy: approval.approvedBy,
              reason: approval.reason,
            },
          }),
    };
  });

  const failures = measuredChunks
    .filter((chunk) => chunk.status === "overBudget")
    .map((chunk) => `${chunk.name} is ${chunk.kb} kB, above ${maxChunkKb} kB`);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode,
    source: sourcePath,
    maxChunkKb,
    maxChunkBytes,
    approvalPath,
    approvalsLoaded: approvals.length,
    status: failures.length > 0 ? "overBudget" : "pass",
    overBudget: failures.length > 0,
    chunks: measuredChunks,
    failures,
  };
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exit(EXIT_INPUT_ERROR);
  }

  const evidencePath = resolve(args.evidence);
  const approvalPath = resolve(args.approval ?? join(dirname(evidencePath), "build-budget-approvals.json"));

  try {
    const mode = args.fixture === undefined ? "dist" : "fixture";
    const sourcePath = resolve(args.fixture ?? args.dist);
    const [chunks, approvals] = await Promise.all([
      args.fixture === undefined ? listJsChunks(sourcePath) : readFixtureChunks(sourcePath),
      readApprovals(approvalPath),
    ]);

    const evidence = buildEvidence({
      mode,
      sourcePath,
      maxChunkKb: args.maxChunkKb,
      approvalPath,
      approvals,
      chunks,
    });
    await writeEvidence(evidencePath, evidence);

    if (evidence.overBudget) {
      console.error(`Build budget failed: ${evidence.failures.join("; ")}`);
      process.exit(EXIT_OVER_BUDGET);
    }

    console.log(`Build budget passed: ${evidence.chunks.length} JS chunk(s) checked`);
  } catch (error) {
    const evidence = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      status: "error",
      overBudget: false,
      error: error instanceof Error ? error.message : String(error),
    };
    await writeEvidence(evidencePath, evidence);
    console.error(`Build budget error: ${evidence.error}`);
    process.exit(EXIT_INPUT_ERROR);
  }
}

await main();
