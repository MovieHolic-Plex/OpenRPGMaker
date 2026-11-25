import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderAdvancedCommandBody } from "@/editor/panels/eventEditor/commandBodyAdvanced";
import { SAMPLE_MOVIE_RESOURCE, listMovieResources, resolveMovieResourceUrl } from "@/editor/panels/eventEditor/playMoviePreview";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, Project } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { newM2Command } from "@/editor/eventCommandFactory";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { openEventCommandEditDialog } from "@/editor/panels/eventEditor/commandEditDialog";
import { parseWeightedBranchTable, serializeWeightedBranchTable, weightedBranchPercents } from "@/editor/panels/eventEditor/weightedBranchTable";
import { isolateTimers } from "./mergedTeardown";

describe("playMovieEditorBody", () => {
  isolateTimers();
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

    it("번들 오디오와 같은 ID의 업로드는 동영상 선택에서 제외한다", () => {
      const project = store.getCurrent();
      const id = "cc0-se-osx-wooded-box-open";
      project.assets.uploaded[id] = { id, name: "충돌 영상", kind: "movie", dataUrl: WEBM_DATA_URL, meta: {} };
      expect(listMovieResources(project).map(entry => entry.id)).toEqual(["movie-ending", "movie-opening"]);
      expect(resolveMovieResourceUrl(id, project)).toBeNull();
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

    it("명령에 지정된 번들 동영상은 대기 설정을 바꿔도 유지한다", () => {
      const replaceCommand = vi.fn();
      const body = movieBody({ kind: "playMovie", resourceId: SAMPLE_MOVIE_RESOURCE.id }, replaceCommand);
      const wait = findByTestId(body, "play-movie-wait-select") as FakeElement;
      wait.value = "false";
      wait.dispatchEvent(new Event("change"));

      expect(lastCommand(replaceCommand)).toMatchObject({ resourceId: SAMPLE_MOVIE_RESOURCE.id, wait: false });
      expect(findByTestId(body, "play-movie-preview-video")?.getAttribute("src")).toBe(SAMPLE_MOVIE_RESOURCE.url);
      expect(findByTestId(body, "play-movie-sample-note")).toBeNull();
    });

    it("픽커 선택이 명령의 resourceId 를 갱신한다", () => {
      const replaceCommand = vi.fn();
      const body = movieBody({ kind: "playMovie", resourceId: "movie-opening" }, replaceCommand);

      const select = findByTestId(body, "play-movie-resource-select") as FakeElement;
      select.value = "movie-ending";
      select.dispatchEvent(new Event("change"));

      // 본문은 대기·스킵을 늘 명시해 쓴다 — 생략은 런타임에서 true 다(commandCatalog playMovie `wait !== false`).
      expect(lastCommand(replaceCommand)).toEqual({ kind: "playMovie", resourceId: "movie-ending", wait: true, skippable: true });
      expect(findByTestId(body, "play-movie-preview-video")?.getAttribute("src")).toBe(MP4_DATA_URL);
    });

    it("완료 대기·스킵 허용 토글이 명령 모양에 그대로 반영된다", () => {
      const replaceCommand = vi.fn();
      // 생략한 대기·스킵은 런타임 기본값 true 로 보인다(commandCatalog playMovie `wait !== false`) — 끄는 쪽부터 누른다.
      const body = movieBody({ kind: "playMovie", resourceId: "movie-opening" }, replaceCommand);

      (findByTestId(body, "play-movie-wait-select-segment-false") as FakeElement).dispatchEvent(new Event("click"));
      expect(lastCommand(replaceCommand)).toEqual({ kind: "playMovie", resourceId: "movie-opening", wait: false, skippable: true });

      (findByTestId(body, "play-movie-skippable-select-segment-false") as FakeElement).dispatchEvent(new Event("click"));
      expect(lastCommand(replaceCommand)).toEqual({ kind: "playMovie", resourceId: "movie-opening", wait: false, skippable: false });

      (findByTestId(body, "play-movie-wait-select-segment-true") as FakeElement).dispatchEvent(new Event("click"));
      expect(lastCommand(replaceCommand)).toEqual({ kind: "playMovie", resourceId: "movie-opening", wait: true, skippable: false });
    });

    it("번들 샘플 클립 파일이 dev 서버 경로 그대로 레포에 있다", () => {
      const filePath = fileURLToPath(new URL(`../public${SAMPLE_MOVIE_RESOURCE.url}`, import.meta.url));

      expect(existsSync(filePath), `${filePath} 가 없다 — node scripts/gen-sample-movie.mjs 로 생성`).toBe(true);
    });
  });
});

describe("weightedBranchUx", () => {
  isolateTimers();
  describe("weighted branch storage", () => {
    it("matches runtime numeric-field parsing when names are blank or contain extra separators", () => {
      expect(parseWeightedBranchTable("=2\na=3=extra\nzero=0\nbad=NaN").map(row => row.weight)).toEqual([2, 3]);
    });
    it("keeps one runtime outcome when a name contains separators or newlines", () => {
      const table = serializeWeightedBranchTable([{ label: "a=b\nc", weight: 0.1234567890123456 }]);
      expect(table.split("\n")).toHaveLength(1);
      expect(table.split("=")).toHaveLength(2);
      expect(parseWeightedBranchTable(table)[0]?.weight).toBe(0.1234567890123456);
    });
    it("does not round tiny positive odds to zero", () => {
      const percentages = weightedBranchPercents([{ label: "a", weight: 1 }, { label: "b", weight: 99999 }]);
      expect(percentages[0]).toBeCloseTo(0.001, 8);
      expect(percentages.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 10);
    });
  });
  describe("weighted branch command UX", () => {
    let restoreDom: () => void;
    let replaced: Command | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
      replaced = undefined;
    });
    afterEach(() => restoreDom());

    function render(table = "success=1\nfailure=1", resultVariableId = "") {
      const cmd = { ...newM2Command("m2-211-weighted-branch"), fields: { table, resultVariableId, custom: "preserved" } };
      return renderWithFakeDom(() => renderCommandBody({
        path: [0], lockKind: true, getCurrentCommand: () => replaced ?? cmd,
        actions: {
          addCommand: () => {}, insertCommand: () => {},
          replaceCommand: (_path, command) => { replaced = command; },
          deleteCommand: () => {}, moveCommand: () => {}, moveCommandTo: () => {},
        },
      }, cmd));
    }
    function control(body: FakeElement, id: string): FakeElement {
      const node = findByTestId(body, id);
      if (!node) throw new Error(`Missing control ${id}`);
      return node;
    }
    function change(node: FakeElement, value: string, event = "input") {
      node.value = value;
      node.dispatchEvent(new Event(event));
    }
    function fields() {
      if (replaced?.kind !== "m2Command") throw new Error("No command update");
      return replaced.fields;
    }
    it("initializes percentages, row bars and zero-based mapping without writing on open", () => {
      const body = render();
      expect(control(body, "weighted-branch-chance-0").value).toBe("50");
      expect(control(body, "weighted-branch-chance-1").value).toBe("50");
      expect(control(body, "weighted-branch-meter-0").getAttribute("aria-valuenow")).toBe("50");
      expect(control(body, "weighted-branch-index-0").textContent).toBe("0");
      expect(control(body, "weighted-branch-index-1").textContent).toBe("1");
      expect(replaced).toBeUndefined();
    });
    it("redistributes the remainder proportionally when one percentage changes", () => {
      const body = render("a=2\nb=3\nc=5");
      const input = control(body, "weighted-branch-chance-0");
      input.focus();
      change(input, "60");
      const rows = parseWeightedBranchTable(String(fields().table));
      expect(rows).toHaveLength(3);
      expect(rows[0]?.weight).toBe(60);
      expect(rows[1]?.weight).toBeCloseTo(15, 12);
      expect(rows[2]?.weight).toBeCloseTo(25, 12);
      expect(control(body, "weighted-branch-chance-1").value).toBe("15");
      expect(control(body, "weighted-branch-meter-2").getAttribute("aria-valuenow")).toBe("25");
      expect(control(body, "weighted-branch-chance-0")).toBe(input);
      expect(document.activeElement).toBe(input);
      expect(fields().custom).toBe("preserved");
    });
    it("preserves exact authored table when only the destination changes", () => {
      const project = createBlankProject();
      const variable = project.variables[0];
      if (!variable) throw new Error("Missing fixture variable");
      project.variables.push({ ...variable, id: "roll", name: "Roll" });
      store.replace(project);
      const table = " =2\r\na=3=legacy\r\nbad\r\nz=0";
      const body = render(table);
      const picker = control(body, "weighted-branch-result-variable").querySelector("select");
      if (!picker) throw new Error("Missing picker select");
      expect(picker.options.map(option => option.value)).toContain("roll");
      change(picker, "roll", "change");
      expect(fields().table).toBe(table);
      expect(fields().resultVariableId).toBe("roll");
      expect(control(body, "weighted-branch-destination").dataset.variableId).toBe("roll");
    });
    it("preserves exact weight precision and focused name node while composing", () => {
      const body = render("a=0.1234567890123456\nb=3");
      const name = control(body, "weighted-branch-label-0");
      name.focus();
      name.dispatchEvent(new Event("compositionstart"));
      change(name, "성");
      expect(replaced).toBeUndefined();
      name.value = "성공";
      name.dispatchEvent(new Event("compositionend"));
      expect(parseWeightedBranchTable(String(fields().table))[0]).toEqual({ label: "성공", weight: 0.1234567890123456 });
      expect(control(body, "weighted-branch-label-0")).toBe(name);
      expect(document.activeElement).toBe(name);
    });
    it("leaves the committed table unchanged for incomplete and out-of-range percentages", () => {
      const body = render();
      const input = control(body, "weighted-branch-chance-0");
      for (const value of ["", "-1", "101"]) {
        change(input, value);
        expect(replaced).toBeUndefined();
        expect(input.getAttribute("aria-invalid")).toBe("true");
      }
    });
    it("keeps zero-chance rows editable but excludes them from runtime mapping", () => {
      const body = render("a=1\nb=1\nc=1");
      change(control(body, "weighted-branch-chance-1"), "0");
      expect(parseWeightedBranchTable(String(fields().table)).map(row => row.label)).toEqual(["a", "c"]);
      expect(control(body, "weighted-branch-index-1").dataset.resultValue).toBe("");
      expect(control(body, "weighted-branch-index-2").textContent).toBe("1");
      expect(control(body, "weighted-branch-chance-1").value).toBe("0");
    });
    it("focuses the new name on add and the nearest remaining name on removal", () => {
      const body = render();
      control(body, "weighted-branch-add-row").click();
      expect(document.activeElement).toBe(control(body, "weighted-branch-label-2"));
      expect(parseWeightedBranchTable(String(fields().table))).toHaveLength(3);
      control(body, "weighted-branch-remove-2").click();
      expect(document.activeElement).toBe(control(body, "weighted-branch-label-1"));
      expect(parseWeightedBranchTable(String(fields().table))).toHaveLength(2);
    });
    it("shows a nonzero display and proportional meter for sub-percent outcomes", () => {
      const body = render("rare=1\ncommon=99999999");
      expect(Number(control(body, "weighted-branch-chance-0").value)).toBeGreaterThan(0);
      expect(Number(control(body, "weighted-branch-meter-0").getAttribute("aria-valuenow"))).toBeGreaterThan(0);
    });
    function openModal(table: string) {
      // 설정 창의 확인은 이 명령 하나에 검사기를 돌려 없는 변수를 가리키면 막는다(#5023) — 결과 변수 roll 은 프로젝트에 있어야 한다.
      const project = createBlankProject();
      const variable = project.variables[0];
      if (!variable) throw new Error("Missing fixture variable");
      project.variables.push({ ...variable, id: "roll", name: "Roll" });
      store.replace(project);
      openEventCommandEditDialog({
        initial: { ...newM2Command("m2-211-weighted-branch"), fields: { table, resultVariableId: "roll" } },
        onApply: command => { replaced = command; },
      });
      return renderWithFakeDom(() => document.body);
    }
    it.each(["", "-1", "101"])("blocks modal Confirm with invalid chance %j and focuses the field", invalid => {
      const body = openModal("a=60\nb=40");
      const input = control(body, "weighted-branch-chance-0");
      change(input, invalid);
      control(body, "event-command-edit-ok").click();
      expect(replaced).toBeUndefined();
      expect(findByTestId(body, "event-command-edit-dialog") !== null).toBe(true);
      expect(document.activeElement === input).toBe(true);
      control(body, "event-command-edit-cancel").click();
    });
    it("retains named zero rows through actual Confirm and reopen with positive-only mapping", () => {
      const body = openModal("a=1\npaused=1\nc=1");
      change(control(body, "weighted-branch-chance-1"), "0");
      control(body, "event-command-edit-ok").click();
      const table = String(fields().table);
      expect(findByTestId(body, "event-command-edit-dialog")).toBeNull();
      openModal(table);
      expect(control(body, "weighted-branch-label-1").value).toBe("paused");
      expect(control(body, "weighted-branch-chance-1").value).toBe("0");
      expect(control(body, "weighted-branch-index-1").dataset.resultValue).toBe("");
      expect(control(body, "weighted-branch-index-2").dataset.resultValue).toBe("1");
      expect(parseWeightedBranchTable(table).map(row => row.label)).toEqual(["a", "c"]);
      control(body, "event-command-edit-cancel").click();
    });
    it("blocks an authored all-zero table without silently seeding positive chances", () => {
      const body = openModal("a=0\nb=0");
      expect(control(body, "weighted-branch-chance-0").value).toBe("0");
      control(body, "event-command-edit-ok").click();
      expect(replaced).toBeUndefined();
      expect(findByTestId(body, "event-command-edit-dialog") !== null).toBe(true);
      change(control(body, "weighted-branch-chance-0"), "100");
      control(body, "event-command-edit-ok").click();
      expect(fields().table).toBe("a=100\nb=0");
    });
    it("keeps the last positive row when removing it would enable zero-chance outcomes", () => {
      const body = openModal("a=100\npaused=0");
      control(body, "weighted-branch-remove-0").click();
      expect(control(body, "weighted-branch-label-0").value).toBe("a");
      expect(control(body, "weighted-branch-chance-1").value).toBe("0");
      control(body, "event-command-edit-cancel").click();
    });
    it("does not show certainty for the counterpart of a tiny positive chance", () => {
      const body = render("rare=1\ncommon=999999");
      expect(control(body, "weighted-branch-chance-0").value).toBe("0.0001");
      expect(control(body, "weighted-branch-chance-1").value).toBe("99.9999");
    });
    it("keeps a lone result at 100 percent and prevents removing it", () => {
      const body = render("only=8");
      expect(control(body, "weighted-branch-chance-0").value).toBe("100");
      expect(control(body, "weighted-branch-chance-0").disabled).toBe(true);
      expect(control(body, "weighted-branch-remove-0").disabled).toBe(true);
    });
  });
});
