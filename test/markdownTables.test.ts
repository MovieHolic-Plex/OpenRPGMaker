// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/util/markdown";
import { createConversationLogHost, renderStreamedMarkdown } from "@/editor/panels/aiConversationLog";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

function cells(root: ParentNode, selector: string): (string | null)[] {
  return Array.from(root.querySelectorAll(selector), (cell) => cell.textContent);
}

const wideHeaders = Array.from({ length: 24 }, (_, index) => `column-${index}`);
const wideValues = wideHeaders.map((_, index) => `value-${index}-abcdefghijklmnopqrstuvwxyz`);
const wideAnswer = [
  "```text", "literal | code", "```",
  `| ${wideHeaders.join(" | ")} |`,
  `| ${wideHeaders.map(() => "---").join(" | ")} |`,
  `| ${wideValues.join(" | ")} |`,
].join("\n");

describe("Markdown pipe tables", () => {
  it("renders a real 24-column table when it follows fenced code", () => {
    const root = renderMarkdown(wideAnswer);

    expect(root.querySelectorAll("table")).toHaveLength(1);
    expect(cells(root, "thead > tr > th")).toEqual(wideHeaders);
    expect(cells(root, "tbody > tr > td")).toEqual(wideValues);
    expect(root.querySelector("pre > code")?.textContent).toBe("literal | code");
    expect(root.querySelector("th")?.getAttribute("scope")).toBe("col");
  });

  it.each(["none", "both", "leading", "trailing"])("accepts %s outer pipes", (outer) => {
    const row = (text: string): string => `${outer === "both" || outer === "leading" ? "| " : ""}${text}${outer === "both" || outer === "trailing" ? " |" : ""}`;
    const root = renderMarkdown(["A | B", "--- | ---", "one | two", "three | four"].map(row).join("\r\n"));

    expect(cells(root, "th")).toEqual(["A", "B"]);
    expect(cells(root, "td")).toEqual(["one", "two", "three", "four"]);
  });

  it("renders alignment and safe inline formatting when cells contain Markdown", () => {
    const root = renderMarkdown("Left | Center | Right | Default\n:--- | :---: | ---: | ---\n**bold** | *em* | `code` | [site](https://example.com)");

    for (const tag of ["th", "td"]) {
      expect(Array.from(root.querySelectorAll(tag), (cell) => cell.style.textAlign)).toEqual(["left", "center", "right", ""]);
    }
    expect(root.querySelector("td > strong")?.textContent).toBe("bold");
    expect(root.querySelector("td > em")?.textContent).toBe("em");
    expect(root.querySelector("td > code")?.textContent).toBe("code");
    expect(root.querySelector("td > a")?.getAttribute("href")).toBe("https://example.com");
    expect(root.querySelector("td > a")?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("keeps escaped pipes and matching code spans within their cells", () => {
    const root = renderMarkdown([
      "| A\\|B | `C|D` | E |",
      "| --- | --- | --- |",
      "| x\\|y | `a|b` | ``a`|b`` |",
      "| \\| | tail\\| | ``x|y`` |",
    ].join("\n"));

    expect(cells(root, "th")).toEqual(["A|B", "C|D", "E"]);
    expect(cells(root, "td")).toEqual(["x|y", "a|b", "a`|b", "|", "tail|", "x|y"]);
    expect(cells(root, "td > code")).toEqual(["a|b", "a`|b", "x|y"]);
  });

  it("does not hide separators after escaped backslashes or unmatched backticks", () => {
    const root = renderMarkdown("A | B\n--- | ---\nslash\\\\| right\n`unclosed | end");

    expect(cells(root, "td")).toEqual(["slash\\\\", "right", "`unclosed", "end"]);
  });

  it.each([
    "A | B\n--- | --\none | two",
    "A | B\n--- | --- | ---\none | two",
    "A | B\n--- | :--x\none | two",
    "A | B\n--- | \none | two",
    "ordinary | prose\nmore | words",
    "`A|B`\n---\ntext",
    "A\\|B\n---\ntext",
  ])("leaves malformed or non-table input as paragraphs: %s", (text) => {
    const root = renderMarkdown(text);

    expect(root.querySelector("table")).toBeNull();
    expect(root.querySelector("p")).not.toBeNull();
  });

  it("ends a table before a row with a different number of cells", () => {
    const root = renderMarkdown("A | B\n--- | ---\none | two\nextra | cells | here\nplain tail");

    expect(cells(root, "td")).toEqual(["one", "two"]);
    expect(root.querySelector("p")?.textContent).toBe("extra | cells | hereplain tail");
  });

  it("retains empty cells and supports a header-only or single-column table", () => {
    const root = renderMarkdown("| A | B |\n| --- | --- |\n| | |\n\n| Only |\n| --- |\n");

    expect(root.querySelectorAll("table")).toHaveLength(2);
    expect(cells(root, "td")).toEqual(["", ""]);
    expect(cells(root, "th")).toEqual(["A", "B", "Only"]);
  });

  it("keeps HTML and script URLs inert when they occur in headers and cells", () => {
    const root = renderMarkdown([
      '| <img src=x onerror="alert(1)"> | <script>alert(1)</script> |',
      "| --- | --- |",
      '| <svg onload="alert(1)"> | [bad](javascript:alert(1)) |',
      '| [bad](data:text/html,<script>alert(1)</script>) | [bad](JaVaScRiPt:alert(1)) |',
      '| `<script>alert(1)</script>` | [safe](https://example.com/"onclick="alert(1)) |',
    ].join("\n"));

    expect(root.querySelectorAll("td")).toHaveLength(6);
    expect(root.querySelector("script, img, svg, [onload], [onerror], [onclick]")).toBeNull();
    expect(root.querySelectorAll("a")).toHaveLength(1);
    expect(root.querySelector("a")?.getAttribute("href")).toBe('https://example.com/"onclick="alert(1)');
    expect(root.querySelector("th")?.textContent).toBe('<img src=x onerror="alert(1)">');
    expect(root.querySelector("td > code")?.textContent).toBe("<script>alert(1)</script>");
    expect(cells(root, "td").slice(1, 4)).toEqual(["bad", "bad", "bad"]);
  });

  it("preserves adjacent paragraphs, headings, lists, quotes and fenced pipe syntax", () => {
    const root = renderMarkdown([
      "intro", "A | B", "--- | ---", "one | two", "# heading",
      "- list | prose", "1. ordered | prose", "> quote | prose", "tail",
      "```", "A | B", "--- | ---", "one | two", "```",
    ].join("\n"));

    expect(Array.from(root.children, (node) => node.tagName)).toEqual(["P", "TABLE", "H1", "UL", "OL", "BLOCKQUOTE", "P", "PRE"]);
    expect(cells(root, "td")).toEqual(["one", "two"]);
    expect(cells(root, "li")).toEqual(["list | prose", "ordered | prose"]);
    expect(root.querySelector("pre > code")?.textContent).toBe("A | B\n--- | ---\none | two");
  });
});

describe("assistant table rendering integration", () => {
  it.each(["stream-finalization", "history-restoration"])("renders a table through %s without replacing the answer renderer", (path) => {
    store.replace(createBlankProject());
    const log = document.createElement("div");
    log.className = "ai-chat-log";
    const host = createConversationLogHost({ log, removeStartScreen: () => undefined });

    if (path === "stream-finalization") {
      const body = host.appendBubble("assistant", "");
      for (const chunk of [wideAnswer.slice(0, 53), wideAnswer.slice(53)]) {
        body.textContent = (body.textContent ?? "") + chunk;
      }
      renderStreamedMarkdown(body);
    } else {
      host.renderConversationEntry({ kind: "assistant", text: wideAnswer });
    }

    expect(log.querySelectorAll(".ai-command-row-body .md table")).toHaveLength(1);
    expect(cells(log, "th")).toEqual(wideHeaders);
    expect(cells(log, "td")).toEqual(wideValues);
  });
});
