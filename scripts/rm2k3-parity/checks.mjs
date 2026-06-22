const REQUIRED_SECTIONS = [
  "battle",
  "database",
  "eventPages",
  "resourceProfiles",
  "runtimePresentation",
  "migration",
  "concurrency",
  "legalGuardrails",
];

const HIGH_RISK_SECTIONS = new Set([
  "battle",
  "database",
  "eventPages",
  "resourceProfiles",
  "runtimePresentation",
  "migration",
  "concurrency",
]);

const ACCEPTED_STATUSES = new Set(["done", "partial", "outOfScope"]);

const CONTRACT_CHECKS = [
  { name: "title", text: "# RM2K3 Fidelity Contract" },
  { name: "runtimePresentation", text: "## Runtime Presentation" },
  { name: "resourceProfiles", text: "## Resource Profiles" },
  { name: "database", text: "## Database Contract" },
  { name: "eventPages", text: "## Event Pages And Commands" },
  { name: "battle", text: "## Battle Contract" },
  { name: "migration", text: "## Migration And Recovery" },
  { name: "concurrency", text: "## Runtime Concurrency" },
  { name: "legalGuardrails", text: "## Must NOT" },
  { name: "matrixFixture", text: "## Parity Matrix Fixture" },
  { name: "noBinaryCompatibilityClaim", text: "Must NOT claim `.lmu`, `.ldb`, `.lmt`, or RM2K3 binary compatibility" },
];

function assertPlainObject(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function readNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

export function parseMatrix(matrixText) {
  try {
    return assertPlainObject(JSON.parse(matrixText), "matrix");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`matrix must be valid JSON: ${reason}`);
  }
}

export function checkContract(contractText) {
  const checks = CONTRACT_CHECKS.map((check) => ({
    name: check.name,
    ok: contractText.includes(check.text),
  }));

  return {
    checks,
    failures: checks
      .filter((check) => !check.ok)
      .map((check) => `contract missing required content check: ${check.name}`),
  };
}

export function checkMatrix(matrix) {
  const failures = [];
  const missingSections = REQUIRED_SECTIONS.filter((sectionName) => !Object.hasOwn(matrix, sectionName));
  const sections = [];
  const rows = [];
  const invalidStatuses = [];
  const missingStatusMetadata = [];
  const highRiskPartials = [];

  for (const sectionName of REQUIRED_SECTIONS) {
    if (missingSections.includes(sectionName)) {
      continue;
    }

    const section = assertPlainObject(matrix[sectionName], `matrix.${sectionName}`);
    const title = readNonEmptyString(section.title, `matrix.${sectionName}.title`);

    if (!Array.isArray(section.checklist)) {
      throw new Error(`matrix.${sectionName}.checklist must be an array`);
    }

    if (section.checklist.length < 3) {
      failures.push(`matrix.${sectionName}.checklist must contain at least 3 rows`);
    }

    sections.push({
      name: sectionName,
      title,
      rowCount: section.checklist.length,
      highRisk: HIGH_RISK_SECTIONS.has(sectionName),
    });

    section.checklist.forEach((entry, rowIndex) => {
      const label = `matrix.${sectionName}.checklist[${rowIndex}]`;
      const row = assertPlainObject(entry, label);
      const id = readNonEmptyString(row.id, `${label}.id`);
      const requirement = readNonEmptyString(row.requirement, `${label}.requirement`);
      const status = readNonEmptyString(row.status, `${label}.status`);
      const reason = typeof row.reason === "string" ? row.reason.trim() : "";
      const guardrail = typeof row.guardrail === "string" ? row.guardrail.trim() : "";

      if (!id.startsWith(sectionName)) {
        failures.push(`${label}.id must start with ${sectionName}`);
      }

      if (requirement.length < 24) {
        failures.push(`${label}.requirement must be at least 24 characters`);
      }

      if (!ACCEPTED_STATUSES.has(status)) {
        invalidStatuses.push({ section: sectionName, id, status });
      }

      if (status === "partial" && reason.length === 0) {
        missingStatusMetadata.push({ section: sectionName, id, status, field: "reason" });
      }

      if (status === "outOfScope") {
        if (reason.length === 0) {
          missingStatusMetadata.push({ section: sectionName, id, status, field: "reason" });
        }

        if (guardrail.length === 0) {
          missingStatusMetadata.push({ section: sectionName, id, status, field: "guardrail" });
        }
      }

      if (HIGH_RISK_SECTIONS.has(sectionName) && status === "partial") {
        highRiskPartials.push({ section: sectionName, id, status, reason });
      }

      rows.push({
        section: sectionName,
        id,
        status,
        reason: reason.length > 0 ? reason : undefined,
        guardrail: guardrail.length > 0 ? guardrail : undefined,
        acceptedStatus: ACCEPTED_STATUSES.has(status),
        highRiskPartial: HIGH_RISK_SECTIONS.has(sectionName) && status === "partial",
      });
    });
  }

  for (const sectionName of missingSections) {
    failures.push(`matrix missing required section: ${sectionName}`);
  }

  for (const row of invalidStatuses) {
    failures.push(`matrix.${row.section} row ${row.id} has invalid status: ${row.status}; expected done, partial, or outOfScope`);
  }

  for (const row of missingStatusMetadata) {
    failures.push(`matrix.${row.section} row ${row.id} status ${row.status} requires non-empty ${row.field}`);
  }

  for (const row of highRiskPartials) {
    failures.push(`matrix.${row.section} row ${row.id} is high-risk partial; finish it or mark a legal guardrail outOfScope`);
  }

  return {
    requiredSections: REQUIRED_SECTIONS,
    highRiskSections: [...HIGH_RISK_SECTIONS],
    acceptedStatuses: [...ACCEPTED_STATUSES],
    missingSections,
    sections,
    rows,
    rowCount: rows.length,
    invalidStatusCount: invalidStatuses.length,
    missingStatusMetadataCount: missingStatusMetadata.length,
    highRiskPartialCount: highRiskPartials.length,
    invalidStatuses,
    missingStatusMetadata,
    highRiskPartials,
    failures,
  };
}
