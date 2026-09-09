/** @vitest-environment happy-dom */
import { expect, it } from "vitest";
import { installEventEditorCustomSelects } from "@/editor/panels/eventEditor/customSelect";

it("hands focused native control ownership to its newly enhanced trigger", async () => {
  // Given: validation focuses a select before the host's insertion observer enhances it.
  const root = document.createElement("div");
  document.body.append(root);
  const controller = installEventEditorCustomSelects(root);
  try {
    const select = document.createElement("select");
    select.dataset.testid = "validation-select";
    const option = document.createElement("option");
    option.value = "one"; option.textContent = "one";
    select.append(option);
    const enhanced = new Promise<void>((resolve, reject) => {
      const observer = new MutationObserver(() => {
        if (!root.querySelector("[data-custom-select-for]")) return;
        clearTimeout(timeout); observer.disconnect(); resolve();
      });
      const timeout = setTimeout(() => { observer.disconnect(); reject(new Error("Missing select enhancement")); }, 2000);
      observer.observe(root, { childList: true, subtree: true });
    });
    // When: insertion and immediate field navigation happen in one action.
    root.append(select);
    select.focus();
    await enhanced;
    // Then: reparenting has not stranded focus on the hidden native control/body.
    expect(document.activeElement).toBe(root.querySelector("[data-custom-select-for]"));
  } finally { controller.dispose(); root.remove(); }
});
