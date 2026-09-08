/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from "vitest";
import { localDiagnostics, startLocalDiagnostics } from "@/editor/localDiagnostics";
import { openLocalDiagnosticsDialog } from "@/editor/panels/localDiagnosticsDialog";
import { recordEditActivity } from "@/editor/editActivityLog";
import { createLogger } from "@/util/logger";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { publishDiagnostic } from "@/util/diagnosticObserver";

afterEach(() => { localDiagnostics.clear(); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function button(id: string): HTMLButtonElement {
  const value = document.querySelector(`[data-testid="${id}"]`);
  if (!(value instanceof HTMLButtonElement)) throw new Error(`Missing button ${id}`);
  return value;
}
function check(id: string): void {
  const value = document.querySelector(`[data-testid="${id}"]`);
  if (!(value instanceof HTMLInputElement)) throw new Error(`Missing input ${id}`);
  value.click();
}
it("subscribes to real authoring/log sources only after consent and clears on project switch", () => {
  expect(startLocalDiagnostics(true, ["authoring", "warning"])).toBe(true);
  recordEditActivity({ scope: "map", origin: "ai", generation: 42, label: "secret private prompt" });
  createLogger("test").warn("secret private endpoint", { token: "private" });
  expect(localDiagnostics.snapshot().receipts).toEqual(expect.arrayContaining([
    expect.objectContaining({ category: "authoring", generation: 42, origin: "ai" }),
    expect.objectContaining({ category: "warning", phase: "reported" }),
  ]));
  store.replaceProject(createBlankProject());
  expect(localDiagnostics.snapshot()).toMatchObject({ active: false, sessionId: null, receipts: [] });
});
it("requires category choices and explicit consent, then exposes persistent stop/clear", () => {
  openLocalDiagnosticsDialog();
  expect(button("diagnostics-start").disabled).toBe(true);
  check("diagnostics-category-movement");
  expect(button("diagnostics-start").disabled).toBe(true);
  check("diagnostics-consent");
  button("diagnostics-start").click();
  expect(localDiagnostics.snapshot().active).toBe(true);
  expect(button("diagnostics-stop").isConnected).toBe(true);
  button("diagnostics-stop").click();
  expect(localDiagnostics.snapshot().active).toBe(false);
  button("diagnostics-clear").click();
  expect(localDiagnostics.snapshot().sessionId).toBeNull();
});
it("previews selected sections but cancellation never writes clipboard, file or transcript", async () => {
  const write = vi.fn(async () => undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText: write } });
  startLocalDiagnostics(true, ["movement", "error"]);
  publishDiagnostic({ category: "movement", phase: "completed", x: 2, y: 3 });
  publishDiagnostic({ category: "error", phase: "reported" });
  const storage = vi.spyOn(Storage.prototype, "setItem");
  const network = vi.spyOn(globalThis, "fetch");
  openLocalDiagnosticsDialog();
  check("diagnostics-section-error");
  button("diagnostics-preview").click();
  const preview = document.querySelector<HTMLTextAreaElement>("[data-testid=diagnostics-preview-text]");
  expect(JSON.parse(preview?.value ?? "null").receipts).toHaveLength(1);
  button("diagnostics-copy").click();
  button("app-modal-cancel").click();
  await Promise.resolve();
  expect(write).not.toHaveBeenCalled();
  expect(storage).not.toHaveBeenCalled();
  expect(network).not.toHaveBeenCalled();
});
it.each(["json", "markdown"])("copies exactly the %s preview only after confirmation", async format => {
  const copied = Promise.withResolvers<string>();
  const deadline = setTimeout(() => copied.reject(new Error("Clipboard signal missing")), 1000);
  const write = vi.fn(async (text: string) => { copied.resolve(text); });
  vi.stubGlobal("navigator", { clipboard: { writeText: write } });
  startLocalDiagnostics(true, ["movement"]);
  publishDiagnostic({ category: "movement", phase: "completed", x: 1, y: 2 });
  openLocalDiagnosticsDialog();
  const select = document.querySelector<HTMLSelectElement>("[data-testid=diagnostics-format]");
  if (!select) throw new Error("Expected report format select");
  select.value = format; select.dispatchEvent(new Event("change"));
  button("diagnostics-preview").click();
  const expected = document.querySelector<HTMLTextAreaElement>("[data-testid=diagnostics-preview-text]")?.value;
  expect(write).not.toHaveBeenCalled();
  button("diagnostics-copy").click();
  expect(write).not.toHaveBeenCalled();
  button("app-modal-confirm").click();
  try { expect(await copied.promise).toBe(expected); } finally { clearTimeout(deadline); }
  expect(write).toHaveBeenCalledOnce();
});
it("invalidates a pending export when its project/session is replaced", async () => {
  const write = vi.fn(async () => undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText: write } });
  startLocalDiagnostics(true, ["movement"]);
  openLocalDiagnosticsDialog(); button("diagnostics-preview").click();
  button("diagnostics-copy").click();
  store.replaceProject(createBlankProject());
  button("app-modal-confirm").click();
  await Promise.resolve();
  expect(write).not.toHaveBeenCalled();
  expect(document.querySelector("[data-testid=local-diagnostics-dialog]")).toBeNull();
});
