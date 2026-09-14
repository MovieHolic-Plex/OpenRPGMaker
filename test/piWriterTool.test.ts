import { describe, expect, it, vi } from "vitest";
import { createWriterTool } from "../scripts/lib/piWriterTool";

const writer = { provider: "openai-codex", model: "chosen-writer", thinkingLevel: "high" as const };
const response = (finish = "stop") => ({ completion: { choices: [{ finish_reason: finish, message: { content: "어서 오세요, 여행자님." } }] } });

describe("Writer consultation", () => {
  it("routes prose through the selected writer and returns text without editing", async () => {
    const complete = vi.fn().mockResolvedValue(response());
    const tool = createWriterTool(writer, complete, "writer-test-token");
    const signal = new AbortController().signal;
    expect(await tool.execute("t", { brief: "친절한 여관 주인의 대사" }, signal)).toEqual({ content: [{ type: "text", text: "어서 오세요, 여행자님." }] });
    expect(complete).toHaveBeenCalledWith("openai-codex", expect.objectContaining({ model: "chosen-writer", reasoning: { effort: "high" } }), { apiKey: "writer-test-token", signal });
  });
  it("rejects truncated output, invalid briefs and cancellation", async () => {
    const complete = vi.fn().mockResolvedValue(response("length"));
    const tool = createWriterTool(writer, complete);
    await expect(tool.execute("t", { brief: "대사" })).rejects.toThrow("완료");
    complete.mockClear();
    await expect(tool.execute("t", { brief: "" })).rejects.toThrow("brief");
    await expect(tool.execute("t", { brief: "대사" }, AbortSignal.abort())).rejects.toThrow();
    expect(complete).not.toHaveBeenCalled();
  });
});
