import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function writeEvidence(evidencePath, evidence) {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

export function buildEvidence({ contractPath, matrixPath, evidencePath, contractMeta, matrixMeta, contractResult, matrixResult }) {
  const failures = [...contractResult.failures, ...matrixResult.failures];
  const ok = failures.length === 0;

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    target: "F4. Scope fidelity",
    invocation: "node scripts/check-rm2k3-parity.mjs --contract <path> --matrix <path> --evidence <path>",
    verdict: ok ? "PASS" : "FAIL",
    ok,
    contract: {
      ...contractMeta,
      path: contractPath,
      contentChecks: contractResult.checks,
    },
    matrix: {
      ...matrixMeta,
      path: matrixPath,
      requiredSections: matrixResult.requiredSections,
      highRiskSections: matrixResult.highRiskSections,
      acceptedStatuses: matrixResult.acceptedStatuses,
      missingSections: matrixResult.missingSections,
      sections: matrixResult.sections,
      rows: matrixResult.rows,
      rowCount: matrixResult.rowCount,
      invalidStatusCount: matrixResult.invalidStatusCount,
      missingStatusMetadataCount: matrixResult.missingStatusMetadataCount,
      highRiskPartialCount: matrixResult.highRiskPartialCount,
      invalidStatuses: matrixResult.invalidStatuses,
      missingStatusMetadata: matrixResult.missingStatusMetadata,
      highRiskPartials: matrixResult.highRiskPartials,
    },
    evidencePath,
    failures,
  };
}

export function buildErrorEvidence({ contractPath, matrixPath, evidencePath, message }) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    target: "F4. Scope fidelity",
    verdict: "ERROR",
    ok: false,
    contract: { path: contractPath },
    matrix: { path: matrixPath },
    evidencePath,
    error: message,
  };
}
