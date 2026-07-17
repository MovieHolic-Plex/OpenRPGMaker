import { afterEach, describe, expect, it } from "vitest";
import {
  PROJECT_NAME_URL_PARAM,
  PROJECT_URL_PARAM,
  readProjectFromUrl,
  syncProjectToUrl,
} from "@/project/projectUrl";

afterEach(() => {
  // jsdom / node: reset location search via history when available
  if (typeof window !== "undefined" && window.history?.replaceState) {
    window.history.replaceState(null, "", "/");
  }
});

describe("projectUrl", () => {
  it("reads project and name from the query string", () => {
    expect(readProjectFromUrl("?project=rpg-zzu-editor-demo-village&name=%EC%97%90%EB%94%94%ED%84%B0%20%EB%8D%B0%EB%AA%A8%20%EB%A7%88%EC%9D%84")).toEqual({
      projectId: "rpg-zzu-editor-demo-village",
      projectName: "에디터 데모 마을",
    });
  });

  it("accepts legacy projectId param", () => {
    expect(readProjectFromUrl("?projectId=legacy-id")).toEqual({
      projectId: "legacy-id",
      projectName: null,
    });
  });

  it("prefers project over projectId when both are set", () => {
    expect(readProjectFromUrl("?project=new-id&projectId=old-id").projectId).toBe("new-id");
  });

  it("writes project and name into the address bar", () => {
    if (typeof window === "undefined" || !window.history?.replaceState) return;
    syncProjectToUrl({
      projectId: "rpg-zzu-editor-demo-village",
      projectName: "에디터 데모 마을",
    });
    const params = new URLSearchParams(window.location.search);
    expect(params.get(PROJECT_URL_PARAM)).toBe("rpg-zzu-editor-demo-village");
    expect(params.get(PROJECT_NAME_URL_PARAM)).toBe("에디터 데모 마을");
    expect(params.get("projectId")).toBeNull();
  });

  it("clears project params when projectId is empty", () => {
    if (typeof window === "undefined" || !window.history?.replaceState) return;
    syncProjectToUrl({ projectId: "keep-me", projectName: "이름" });
    syncProjectToUrl({ projectId: null });
    const params = new URLSearchParams(window.location.search);
    expect(params.get(PROJECT_URL_PARAM)).toBeNull();
    expect(params.get(PROJECT_NAME_URL_PARAM)).toBeNull();
  });
});
