import { describe, expect, it } from "vitest";
import { contractFailure, WebExportContractError } from "@/project/playerDeploymentErrors";

function failure(path?: string | readonly string[]): WebExportContractError {
  try {
    contractFailure("runtime-asset-unavailable", path);
  } catch (error) {
    if (error instanceof WebExportContractError) return error;
    throw error;
  }
  throw new Error("contractFailure returned");
}

describe("web export contract errors", () => {
  it("names a relative zip path on the failure", () => {
    const error = failure("assets/fonts/Galmuri9.woff2");

    expect(error.code).toBe("runtime-asset-unavailable");
    expect(error.paths).toEqual(["assets/fonts/Galmuri9.woff2"]);
    expect(error.message).toBe(
      "A declared player runtime asset is unavailable. Redeploy the runtime assets. (assets/fonts/Galmuri9.woff2)",
    );
  });

  it("names both sides of a case collision, including a non-ascii path", () => {
    const error = failure(["assets/uploaded/STRASSE.png", "assets/uploaded/Straße.png"]);

    expect(error.paths).toEqual(["assets/uploaded/STRASSE.png", "assets/uploaded/Straße.png"]);
    expect(error.message).toContain("assets/uploaded/STRASSE.png, assets/uploaded/Straße.png");
  });

  it("drops host paths, URLs, and thrown sentences", () => {
    const error = failure([
      "C:/private/build/player.js",
      "https://cdn.example/secret-token",
      "fixture dependency unavailable",
      "../assets/secret.png",
      "/assets/from-root.png",
      "assets/ok.png",
    ]);

    expect(error.paths).toEqual(["assets/ok.png"]);
    expect(error.message).not.toContain("C:/private");
    expect(error.message).not.toContain("secret");
    expect(error.message).not.toContain("fixture dependency");
    expect(String(error)).toContain("assets/ok.png");
  });

  it("keeps the generic message when nothing safe can be shown", () => {
    const error = failure("C:/private/build/player.js");

    expect(error.paths).toEqual([]);
    expect(error.message).toBe("A declared player runtime asset is unavailable. Redeploy the runtime assets.");
  });
});
