import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderMarkdown } from "@/util/markdown";
import { FakeElement, installFakeDom, renderWithFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

function render(text: string): FakeElement {
  return renderWithFakeDom(() => renderMarkdown(text));
}

describe("renderMarkdown", () => {
  it("renders heading levels", () => {
    const container = render("### Title");

    const heading = container.childNodes[0];
    expect(container.className).toBe("md");
    expect(heading).toBeInstanceOf(FakeElement);
    if (!(heading instanceof FakeElement)) throw new Error("heading missing");
    expect(heading.tagName).toBe("H3");
    expect(heading.textContent).toBe("Title");
  });

  it("renders unordered and ordered list items", () => {
    const container = render(["- Alpha", "- Beta", "", "1. First", "2. Second"].join("\n"));

    const unorderedList = container.querySelector("ul");
    const orderedList = container.querySelector("ol");
    const unorderedItems = unorderedList ? [...unorderedList.querySelectorAll("li")].map((item) => item.textContent) : [];
    const orderedItems = orderedList ? [...orderedList.querySelectorAll("li")].map((item) => item.textContent) : [];
    expect(unorderedItems).toEqual(["Alpha", "Beta"]);
    expect(orderedItems).toEqual(["First", "Second"]);
  });

  it("renders bold and inline code spans", () => {
    const container = render("Use **bold** and `code`.");

    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelector("p > code")?.textContent).toBe("code");
    expect(container.textContent).toBe("Use bold and code.");
  });

  it("renders fenced code literally without inline parsing", () => {
    const container = render(["```", "**bold**", "`code`", "```"].join("\n"));

    const code = container.querySelector("pre > code");
    expect(code?.textContent).toBe("**bold**\n`code`");
    expect(code?.querySelector("strong")).toBeNull();
  });

  it("renders safe http links with external navigation attributes", () => {
    const container = render("[site](https://example.com/docs)");

    const anchor = container.querySelector("a");
    expect(anchor?.textContent).toBe("site");
    expect(anchor?.getAttribute("href")).toBe("https://example.com/docs");
    expect(anchor?.getAttribute("target")).toBe("_blank");
    expect(anchor?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders unsafe and relative links as plain label text", () => {
    const container = render("[bad](javascript:alert(1)) and [local](/docs)");

    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("bad and local");
  });

  it("keeps HTML input as literal text without creating elements", () => {
    const container = render("<img src=x onerror=alert(1)>\n\n<script>alert(1)</script>");

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });
});
