import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAdvancedCommandBody } from "@/editor/panels/eventEditor/commandBodyAdvanced";
import {
  SAMPLE_MOVIE_RESOURCE,
  listMovieResources,
  resolveMovieResourceUrl,
} from "@/editor/panels/eventEditor/playMoviePreview";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, Project } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const WEBM_DATA_URL = "data:video/webm;base64,GkXfo0AgQoaBAULygQRC";
const MP4_DATA_URL = "data:video/mp4;base64,AAAAIGZ0eXBpc29t";

function ctx(replaceCommand = vi.fn()): CommandEditContext {
  return {
    path: [0],
    actions: {
      addCommand: vi.fn(),
      insertCommand: vi.fn(),
      replaceCommand,
      deleteCommand: vi.fn(),
      moveCommand: vi.fn(),
      moveCommandTo: vi.fn(),
    },
  };
}

/**
 * 동영상 업로드는 ResourceKind 에 전용 종류가 없다(`movie` 를 넣으면 RESOURCE_SLICING 의
 * `satisfies Record<ResourceKind, …>` 가 깨진다 — 다른 레인 소유 파일).
 * 그래서 편집기는 업로드 kind 가 아니라 **미디어 타입**으로 동영상을 알아본다.
 */
function withMovies(project: Project): Project {
  project.assets.uploaded["movie-opening"] = {
    id: "movie-opening",
    name: "오프닝 영상",
    kind: "picture",
    dataUrl: WEBM_DATA_URL,
    meta: {},
  };
  project.assets.uploaded["movie-ending"] = {
    id: "movie-ending",
    name: "엔딩 영상",
    kind: "picture",
    dataUrl: MP4_DATA_URL,
    meta: {},
  };
  project.assets.uploaded["picture-note"] = {
    id: "picture-note",
    name: "쪽지 그림",
    kind: "picture",
    dataUrl: "data:image/png;base64,iVBORw0KGgo=",
    meta: {},
  };
  return project;
}

function movieBody(cmd: Extract<Command, { kind: "playMovie" }>, replaceCommand = vi.fn()): FakeElement {
  return renderWithFakeDom(() => renderAdvancedCommandBody(ctx(replaceCommand), cmd)!);
}

function lastCommand(replaceCommand: ReturnType<typeof vi.fn>): Extract<Command, { kind: "playMovie" }> {
  return replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "playMovie" }>;
}

describe("playMovie 편집기 본문", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(withMovies(createBlankProject()));
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("동영상 리소스 목록은 미디어 타입이 동영상인 업로드만 담는다", () => {
    const entries = listMovieResources(store.getCurrent());

    expect(entries.map((entry) => entry.id)).toEqual(["movie-ending", "movie-opening"]);
    expect(entries.map((entry) => entry.name)).toEqual(["엔딩 영상", "오프닝 영상"]);
  });

  it("리소스 URL 은 업로드 동영상만 통과시키고 그림 데이터는 거른다", () => {
    const project = store.getCurrent();

    expect(resolveMovieResourceUrl("movie-opening", project)).toBe(WEBM_DATA_URL);
    expect(resolveMovieResourceUrl("picture-note", project)).toBeNull();
    expect(resolveMovieResourceUrl("", project)).toBeNull();
  });

  it("본문이 동영상 픽커와 항목을 그린다", () => {
    const body = movieBody({ kind: "playMovie", resourceId: "movie-opening" });

    expect(findByTestId(body, "play-movie-command-body")).not.toBeNull();
    const select = findByTestId(body, "play-movie-resource-select");
    expect(select).not.toBeNull();
    expect(select?.children.map((option) => option.value)).toEqual(["", "movie-ending", "movie-opening"]);
    expect(select?.value).toBe("movie-opening");
    expect(findByTestId(body, "play-movie-resource-select-card")?.textContent).toContain("오프닝 영상");
  });

  it("미리보기 표시면이 선택한 동영상을 실제 <video> 로 걸어 둔다", () => {
    const body = movieBody({ kind: "playMovie", resourceId: "movie-opening" });

    const stage = findByTestId(body, "play-movie-preview-stage");
    expect(stage).not.toBeNull();
    const video = findByTestId(body, "play-movie-preview-video");
    expect(video?.tagName).toBe("VIDEO");
    expect(video?.getAttribute("src")).toBe(WEBM_DATA_URL);
    expect(video?.getAttribute("preload")).toBe("metadata");
    expect(video?.getAttribute("controls")).not.toBeNull();
    expect(video?.getAttribute("muted")).not.toBeNull();
    expect(findByTestId(body, "play-movie-sample-note")).toBeNull();
  });

  it("리소스가 없으면 번들 샘플 클립을 재생면에 걸고 그 사실을 밝힌다", () => {
    const body = movieBody({ kind: "playMovie", resourceId: "" });

    expect(findByTestId(body, "play-movie-preview-video")?.getAttribute("src")).toBe(SAMPLE_MOVIE_RESOURCE.url);
    expect(findByTestId(body, "play-movie-sample-note")?.textContent).toContain("샘플");
  });

  it("픽커 선택이 명령의 resourceId 를 갱신한다", () => {
    const replaceCommand = vi.fn();
    const body = movieBody({ kind: "playMovie", resourceId: "movie-opening" }, replaceCommand);

    const select = findByTestId(body, "play-movie-resource-select") as FakeElement;
    select.value = "movie-ending";
    select.dispatchEvent(new Event("change"));

    expect(lastCommand(replaceCommand)).toEqual({ kind: "playMovie", resourceId: "movie-ending" });
    expect(findByTestId(body, "play-movie-preview-video")?.getAttribute("src")).toBe(MP4_DATA_URL);
  });

  it("완료 대기·스킵 허용 토글이 명령 모양에 그대로 반영된다", () => {
    const replaceCommand = vi.fn();
    const body = movieBody({ kind: "playMovie", resourceId: "movie-opening" }, replaceCommand);

    (findByTestId(body, "play-movie-wait-select-segment-true") as FakeElement).dispatchEvent(new Event("click"));
    expect(lastCommand(replaceCommand)).toEqual({ kind: "playMovie", resourceId: "movie-opening", wait: true });

    (findByTestId(body, "play-movie-skippable-select-segment-true") as FakeElement).dispatchEvent(new Event("click"));
    expect(lastCommand(replaceCommand)).toEqual({
      kind: "playMovie",
      resourceId: "movie-opening",
      wait: true,
      skippable: true,
    });

    (findByTestId(body, "play-movie-wait-select-segment-false") as FakeElement).dispatchEvent(new Event("click"));
    expect(lastCommand(replaceCommand)).toEqual({
      kind: "playMovie",
      resourceId: "movie-opening",
      skippable: true,
    });
  });

  it("번들 샘플 클립 파일이 dev 서버 경로 그대로 레포에 있다", () => {
    const filePath = fileURLToPath(new URL(`../public${SAMPLE_MOVIE_RESOURCE.url}`, import.meta.url));

    expect(existsSync(filePath), `${filePath} 가 없다 — node scripts/gen-sample-movie.mjs 로 생성`).toBe(true);
  });
});
