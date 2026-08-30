// movie 는 일급 ResourceKind 다: 리소스 매니저 카테고리 · 가져오기 규칙 · playMovie 필드가
// 모두 같은 종류 이름 하나를 가리킨다. 자유 입력(free text) 자리는 남지 않는다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RESOURCE_SLICING } from "@/assets/resourceSlicing";
import { commandSchemaFor } from "@/editor/eventCommands/schema/defineCommand";
import "@/editor/eventCommands/schema/catalog";
import { mediaImportRuleFor } from "@/editor/panels/resourceManagerMediaImport";
import { RESOURCE_MANAGER_CATEGORIES, renderResourceManager } from "@/editor/panels/resourceManager";
import { renderSchemaForm } from "@/editor/panels/eventEditor/schemaCommandBody";
import { listMovieResources } from "@/editor/panels/eventEditor/playMoviePreview";
import { getResourceProfileSpec, RESOURCE_PROFILE_SPECS, validateResourceDimensions } from "@/project/resourceProfiles";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io/serialize";
import { store } from "@/project/store";
import type { Command, Project, ResourceKind } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { el } from "@/util/dom";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

// 컴파일 시점 계약: "movie" 가 ResourceKind 유니온의 멤버다.
const MOVIE_KIND = "movie" satisfies ResourceKind;

/** 미디어 타입 추측으로는 절대 동영상으로 안 보이는 업로드 — 종류(kind)만이 근거다. */
function withMovieUpload(project: Project): Project {
  project.assets.uploaded["movie-intro"] = {
    id: "movie-intro",
    name: "인트로",
    kind: MOVIE_KIND,
    dataUrl: "data:application/octet-stream;base64,AAAA",
    meta: {},
  };
  return project;
}

function ctx(): CommandEditContext {
  return {
    path: [0],
    actions: {
      addCommand: vi.fn(),
      insertCommand: vi.fn(),
      replaceCommand: vi.fn(),
      deleteCommand: vi.fn(),
      moveCommand: vi.fn(),
      moveCommandTo: vi.fn(),
    },
  };
}

describe("movie ResourceKind", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(withMovieUpload(createBlankProject()));
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("프로필 스펙과 절단 표가 동영상 미디어로 등재한다", () => {
    const spec = getResourceProfileSpec(MOVIE_KIND);

    expect(spec.kind).toBe(MOVIE_KIND);
    expect(spec.media).toBe("video");
    expect(RESOURCE_SLICING[MOVIE_KIND].kind).toBe("video");
  });

  it("동영상은 이미지 규격 검사를 받지 않는다", () => {
    const result = validateResourceDimensions(MOVIE_KIND, 1920, 1080);

    expect(result.ok).toBe(true);
  });

  it("리소스 매니저 카테고리 목록이 등재된 모든 종류를 덮고 동영상 칸을 갖는다", () => {
    const categoryKinds = RESOURCE_MANAGER_CATEGORIES.map((category) => category.kind);

    expect(categoryKinds).toContain(MOVIE_KIND);
    expect([...categoryKinds].sort()).toEqual(RESOURCE_PROFILE_SPECS.map((spec) => spec.kind).sort());
  });

  it("동영상 가져오기 규칙이 동영상 컨테이너만 받는다", () => {
    const rule = mediaImportRuleFor(MOVIE_KIND);

    expect(rule?.dataUrlPrefix).toBe("data:video/");
    expect(rule?.accept).toContain("video/webm");
    expect(mediaImportRuleFor("picture")).toBeNull();
  });

  it("동영상 카테고리를 고르면 파일 입력이 동영상 파일을 받는다", () => {
    const panel = renderWithFakeDom(() => {
      const container = el("div");
      renderResourceManager(container);
      return container;
    });
    const movieRow = findByTestId(panel, "resource-category-list")
      ?.children.find((row) => row.textContent === "동영상");
    expect(movieRow, "동영상 카테고리 버튼이 없다").toBeDefined();

    (movieRow as FakeElement).dispatchEvent(new Event("click"));

    expect(findByTestId(panel, "resource-file-input")?.accept).toContain(".webm");
  });

  it("playMovie 의 resourceId 는 등재된 리소스 종류를 소스로 가리킨다", () => {
    const field = commandSchemaFor("playMovie")?.fields.resourceId;

    expect(field?.type).toBe("record");
    const source = field?.type === "record" ? field.source : undefined;
    expect(source).toBe(MOVIE_KIND);
    expect(RESOURCE_PROFILE_SPECS.map((spec) => spec.kind)).toContain(source);
  });

  it("동영상 목록은 미디어 추측이 아니라 리소스 종류로 업로드를 담는다", () => {
    const entries = listMovieResources(store.getCurrent());

    expect(entries.map((entry) => entry.id)).toContain("movie-intro");
  });

  it("스키마 폼이 resourceId 를 자유 입력이 아니라 동영상 픽커로 그린다", () => {
    const schema = commandSchemaFor("playMovie");
    if (schema === undefined) throw new Error("playMovie 스키마가 등록되지 않았다");
    const cmd: Command = { kind: "playMovie", resourceId: "movie-intro" };

    const form = renderWithFakeDom(() => renderSchemaForm(ctx(), cmd, schema));

    expect(findByTestId(form, "play-movie-resource-id-input")).toBeNull();
    const picker = findByTestId(form, "play-movie-resource-id-picker");
    expect(picker?.tagName, "동영상 픽커 <select> 가 없다").toBe("SELECT");
    expect(picker?.children.map((option) => option.value)).toEqual(["", "movie-intro"]);
    expect(picker?.value).toBe("movie-intro");
  });

  it("movie 업로드가 serialize/deserialize 왕복한다", () => {
    const project = withMovieUpload(createBlankProject());
    const round = deserialize(serialize(project));
    expect(round.assets.uploaded["movie-intro"]?.kind).toBe("movie");
  });
});
