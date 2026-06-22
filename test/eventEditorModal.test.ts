import { describe, expect, it } from "vitest";
import { renderEventEditor } from "@/editor/panels/eventEditor";
import { openEventCommandPicker } from "@/editor/panels/eventEditor/commandPicker";
import { openNpcGraphicDialog } from "@/editor/panels/eventEditor/graphicDialog";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";

describe("RPG Maker style event editor entry points", () => {
  it("exposes the sidebar launcher and modal editor entry points", () => {
    expect(typeof renderEventEditor).toBe("function");
    expect(typeof openEventEditorModal).toBe("function");
    expect(typeof openEventCommandPicker).toBe("function");
    expect(typeof openNpcGraphicDialog).toBe("function");
  });
});
