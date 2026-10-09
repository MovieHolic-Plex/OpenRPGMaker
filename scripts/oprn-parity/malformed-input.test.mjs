import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const requiredSections = [
  "battle",
  "database",
  "eventPages",
  "resourceProfiles",
  "runtimePresentation",
  "migration",
  "concurrency",
  "legalGuardrails",
];

const contractText = [
  "# RM2K3 Fidelity Contract",
  "## Runtime Presentation",
  "## Resource Profiles",
  "## Database Contract",
  "## Event Pages And Commands",
  "## Battle Contract",
  "## Migration And Recovery",
  "## Runtime Concurrency",
  "## Must NOT",
  "## Parity Matrix Fixture",
  "Must NOT claim `.lmu`, `.ldb`, `.lmt`, or RM2K3 binary compatibility",
].join("\n");

function runParity(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/check-oprn-parity.mjs", ...args], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];

    child.stdout.on("data", (chunk) => {
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr.push(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code: code ?? -1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

function matrixWithStatus(status) {
  const matrix = {};
  let statusInserted = false;
  for (const sectionName of requiredSections) {
    const firstRowStatus = statusInserted ? "done" : status;
    statusInserted = true;
    matrix[sectionName] = {
      title: `${sectionName} title`,
      checklist: [
        { id: `${sectionName}-1`, requirement: `${sectionName} requirement row one long enough`, status: firstRowStatus },
        { id: `${sectionName}-2`, requirement: `${sectionName} requirement row two long enough`, status: "done" },
        { id: `${sectionName}-3`, requirement: `${sectionName} requirement row three long enough`, status: "done" },
      ],
    };
  }
  return matrix;
}

async function writeCase(matrixText) {
  const dir = await mkdtemp(join(tmpdir(), "oprn-parity-"));
  await mkdir(dir, { recursive: true });
  const contractPath = join(dir, "contract.md");
  const matrixPath = join(dir, "matrix.json");
  const evidencePath = join(dir, "evidence.json");
  await writeFile(contractPath, contractText, "utf8");
  await writeFile(matrixPath, matrixText, "utf8");
  return { contractPath, matrixPath, evidencePath };
}

test("writes ERROR evidence when the matrix JSON is malformed", async () => {
  const paths = await writeCase("{");

  const result = await runParity(["--contract", paths.contractPath, "--matrix", paths.matrixPath, "--evidence", paths.evidencePath]);
  const evidence = JSON.parse(await readFile(paths.evidencePath, "utf8"));

  assert.equal(result.code, 2);
  assert.match(result.stderr, /matrix must be valid JSON/);
  assert.equal(evidence.verdict, "ERROR");
});

test("writes FAIL evidence when a matrix row uses an invalid status", async () => {
  const paths = await writeCase(JSON.stringify(matrixWithStatus("blocked")));

  const result = await runParity(["--contract", paths.contractPath, "--matrix", paths.matrixPath, "--evidence", paths.evidencePath]);
  const evidence = JSON.parse(await readFile(paths.evidencePath, "utf8"));

  assert.equal(result.code, 1);
  assert.match(result.stderr, /invalid status: blocked/);
  assert.equal(evidence.verdict, "FAIL");
  assert.equal(evidence.matrix.invalidStatusCount, 1);
});
