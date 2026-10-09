import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import {
  isGenrePackAssertionReceipt,
  verifyGenrePackAssertionReceipts,
  type GenrePackAssertion,
  type GenrePackAssertionReceipt,
} from "../src/project/genrePackReadiness";
import {
  evaluateOfficialGenrePackReadinessMatrix,
  OFFICIAL_GENRE_PACK_IDS,
  OFFICIAL_GENRE_PACK_REQUIREMENTS,
  type OfficialGenrePackId,
} from "../src/project/officialGenrePackRequirements";
import { deserialize, serialize } from "../src/project/io";
import { sha256HexText } from "../src/util/sha256";

const receiptPath = process.argv[2];
const projectPath = process.argv[3];
if (!receiptPath || !projectPath) {
  console.error("Usage: npm run verify:genre-packs -- <assertion-receipts.json> <serialized-project.json>");
  process.exit(2);
}

const REPOSITORY_ROOT = process.cwd();
const ALLOWED_EVIDENCE_ROOTS = ["evidence", "output/evidence", ".omo/evidence"]
  .map((path) => resolve(REPOSITORY_ROOT, path));

type EvidenceValidation = Readonly<{ ok: boolean; code?: string }>;

async function validateEvidenceFile(
  assertion: GenrePackAssertion,
  receipt: GenrePackAssertionReceipt<string>
): Promise<EvidenceValidation> {
  const evidence = assertion.evidence?.trim();
  if (!evidence) return { ok: false, code: "evidence-path-missing" };
  const candidate = resolve(REPOSITORY_ROOT, evidence);
  const lexicalRoot = ALLOWED_EVIDENCE_ROOTS.find((root) => isInside(root, candidate));
  if (!lexicalRoot) return { ok: false, code: "evidence-outside-allowed-root" };

  let actualPath: string;
  try {
    actualPath = await realpath(candidate);
    const info = await stat(actualPath);
    if (!info.isFile()) return { ok: false, code: "evidence-not-a-file" };
  } catch {
    return { ok: false, code: "evidence-file-missing" };
  }

  let actualRoot: string;
  try {
    actualRoot = await realpath(lexicalRoot);
  } catch {
    return { ok: false, code: "evidence-root-missing" };
  }
  if (!isInside(actualRoot, actualPath)) return { ok: false, code: "evidence-outside-allowed-root" };

  let evidenceReceipt: unknown;
  try {
    evidenceReceipt = JSON.parse(await readFile(actualPath, "utf8"));
  } catch {
    return { ok: false, code: "invalid-evidence-json" };
  }
  if (!isAssertionEvidenceReceipt(evidenceReceipt)) return { ok: false, code: "invalid-evidence-schema" };
  if (evidenceReceipt.packId !== receipt.packId) return { ok: false, code: "evidence-pack-id-mismatch" };
  if (evidenceReceipt.assertionId !== assertion.assertionId) {
    return { ok: false, code: "evidence-assertion-id-mismatch" };
  }
  if (evidenceReceipt.projectRevision !== receipt.projectRevision) {
    return { ok: false, code: "evidence-project-revision-mismatch" };
  }
  if (evidenceReceipt.status !== assertion.status) return { ok: false, code: "evidence-status-mismatch" };
  return { ok: true };
}

function isInside(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
}

function isAssertionEvidenceReceipt(value: unknown): value is Readonly<{
  schemaVersion: 1;
  packId: string;
  assertionId: string;
  projectRevision: string;
  status: "passed" | "failed";
}> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Readonly<Record<string, unknown>>;
  const allowed = new Set(["schemaVersion", "packId", "assertionId", "projectRevision", "status"]);
  if (Object.keys(record).some((key) => !allowed.has(key))) return false;
  return record.schemaVersion === 1
    && typeof record.packId === "string"
    && typeof record.assertionId === "string"
    && typeof record.projectRevision === "string"
    && /^[a-f0-9]{64}$/.test(record.projectRevision)
    && (record.status === "passed" || record.status === "failed");
}

async function main(): Promise<void> {
  const project = deserialize(await readFile(resolve(projectPath!), "utf8"));
  const projectRevision = await sha256HexText(serialize(project));
  const parsed: unknown = JSON.parse(await readFile(resolve(receiptPath!), "utf8"));
  const receipts = Array.isArray(parsed) ? parsed : [];
  const evidenceValidation = new WeakMap<object, EvidenceValidation>();
  await Promise.all(receipts.flatMap((value) => {
    if (!isGenrePackAssertionReceipt(value)) return [];
    return value.assertions.map(async (assertion) => {
      evidenceValidation.set(assertion, await validateEvidenceFile(assertion, value));
    });
  }));

  const receiptVerification = verifyGenrePackAssertionReceipts(
    OFFICIAL_GENRE_PACK_REQUIREMENTS,
    receipts,
    {
      expectedProjectRevision: projectRevision,
      validateEvidence: (assertion) => evidenceValidation.get(assertion) ?? {
        ok: false,
        code: "evidence-validation-missing",
      },
    }
  );
  const receiptsByPack = Object.fromEntries(receipts
    .filter(isGenrePackAssertionReceipt)
    .map((receipt) => [receipt.packId, receipt])) as Partial<Record<
      OfficialGenrePackId,
      GenrePackAssertionReceipt<OfficialGenrePackId>
    >>;
  const readiness = evaluateOfficialGenrePackReadinessMatrix(project, receiptsByPack, projectRevision);
  const packs = Object.fromEntries(OFFICIAL_GENRE_PACK_IDS.map((packId) => {
    const evidenceOk = receiptVerification.packs[packId].ok;
    const readinessStatus = readiness.packs[packId].status;
    return [packId, {
      ok: evidenceOk && readinessStatus === "ready",
      evidenceOk,
      readinessStatus,
    }];
  }));
  const result = {
    ok: receiptVerification.ok && readiness.ready,
    projectRevision,
    allowedEvidenceRoots: ALLOWED_EVIDENCE_ROOTS,
    receiptVerification,
    readiness,
    packs,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((cause) => {
  console.error(cause instanceof Error ? cause.message : String(cause));
  process.exit(2);
});
