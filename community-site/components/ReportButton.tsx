"use client";

import { useState } from "react";

export default function ReportButton({ type, id, label, doneLabel }: { type: string; id: string; label: string; doneLabel: string }) {
  const [state, setState] = useState<"idle" | "done">("idle");

  async function report() {
    const reason = window.prompt("Reason? (optional)") ?? "";
    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, reason }),
    });
    if (res.ok) setState("done");
  }

  return (
    <button className="report-btn" onClick={report} disabled={state === "done"}>
      {state === "done" ? doneLabel : label}
    </button>
  );
}
