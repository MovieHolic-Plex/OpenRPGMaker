import type { DiagnosticCategory, DiagnosticSnapshot } from "@/util/localDiagnosticSession";

/** Pure local projection, never a transcript reader or external submission. */
export function diagnosticReport(snapshot: DiagnosticSnapshot, sections: readonly DiagnosticCategory[], format: "json" | "markdown"): string {
  const receipts = snapshot.receipts.filter(receipt => sections.includes(receipt.category));
  const report = {
    schema: "oprn-local-diagnostics-v1", sessionId: snapshot.sessionId,
    retention: { maxReceipts: 500, maxMinutes: 30, omitted: snapshot.omitted },
    sections: snapshot.categories.filter(category => sections.includes(category)),
    claims: { written: "Mutation/save receipts are not behavior verification.",
      observed: "Runtime receipts describe only the recorded operation, not overall goal success.",
      revision: "savedGeneration is the latest observed accepted save, not proof of the revision executing in a scene.",
      unverified: "Conversation metadata and warnings/errors do not verify a requested behavior." },
    privacy: "Local metadata only; no conversation text, identifiers, payloads, URLs or automatic send.",
    receipts,
  };
  const json = JSON.stringify(report, null, 2);
  if (format === "json") return json;
  return `# Local diagnostic report\n\nProvenance is attached to every receipt. Written is not observed; goal completion remains unverified.\n\n\`\`\`json\n${json}\n\`\`\`\n`;
}
