type InlineToken = { readonly index: number; readonly marker: string };
type InlineDelimiter = { readonly marker: string; readonly tagName: "strong" | "em" };

type InlineSpan = {
  readonly parent: HTMLElement;
  readonly text: string;
  readonly startIndex: number;
  readonly delimiter: InlineDelimiter;
};

export function renderMarkdown(text: string): HTMLElement {
  const root = document.createElement("div");
  root.className = "md";

  const lines = text.replace(/\r\n?/gu, "\n").split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (isBlank(line)) {
      index += 1;
      continue;
    }

    if (isFence(line)) {
      const block = readFencedCode(lines, index);
      root.append(block.element);
      index = block.nextIndex;
      continue;
    }

    const heading = headingFor(line);
    if (heading) {
      root.append(heading);
      index += 1;
      continue;
    }

    if (unorderedItemText(line) !== null) {
      const block = readList(lines, index, "ul");
      root.append(block.element);
      index = block.nextIndex;
      continue;
    }

    if (orderedItemText(line) !== null) {
      const block = readList(lines, index, "ol");
      root.append(block.element);
      index = block.nextIndex;
      continue;
    }

    if (blockquoteText(line) !== null) {
      const block = readBlockquote(lines, index);
      root.append(block.element);
      index = block.nextIndex;
      continue;
    }

    const table = tableHeader(lines, index);
    const block = table ? readTable(lines, index, table) : readParagraph(lines, index);
    root.append(block.element);
    index = block.nextIndex;
  }

  return root;
}

type TableHeader = {
  readonly cells: readonly string[];
  readonly alignments: readonly ("left" | "center" | "right" | "")[];
};

function tableHeader(lines: readonly string[], index: number): TableHeader | null {
  const delimiter = lines[index + 1] ?? "";
  if (!/^[\s|:-]+$/u.test(delimiter)) return null;
  const markers = splitTableRow(delimiter);
  if (!markers || !markers.every((cell) => /^:?-{3,}:?$/u.test(cell))) return null;
  const cells = splitTableRow(lines[index] ?? "");
  if (!cells || cells.length !== markers.length) return null;
  return {
    cells,
    alignments: markers.map((cell) => cell.endsWith(":") ? (cell.startsWith(":") ? "center" : "right") : cell.startsWith(":") ? "left" : ""),
  };
}

function splitTableRow(line: string): string[] | null {
  const text = line.trim();
  const cells: string[] = [];
  let cell = "";
  let lastPipe = -1;
  let index = 0;
  while (index < text.length) {
    const char = text.charAt(index);
    if (char === "\\" && index + 1 < text.length) {
      const next = text.charAt(index + 1);
      cell += next === "|" ? next : char + next;
      index += 2;
      continue;
    }
    if (char === "`") {
      const span = readCodeSpan(text, index);
      if (span) {
        cell += text.slice(index, span.nextIndex);
        index = span.nextIndex;
        continue;
      }
      // An unmatched run is literal; do not reinterpret its suffix as an opener.
      do { cell += text.charAt(index++); } while (text.charAt(index) === "`");
      continue;
    }
    if (char === "|") {
      cells.push(cell.trim());
      cell = "";
      lastPipe = index;
    } else {
      cell += char;
    }
    index += 1;
  }
  if (lastPipe < 0) return null;
  cells.push(cell.trim());
  if (text.startsWith("|")) cells.shift();
  if (lastPipe === text.length - 1) cells.pop();
  return cells.length > 0 ? cells : null;
}

function readTable(lines: readonly string[], startIndex: number, header: TableHeader): { readonly element: HTMLElement; readonly nextIndex: number } {
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const body = document.createElement("tbody");
  const appendRow = (parent: HTMLElement, cells: readonly string[], tag: "th" | "td"): void => {
    const row = document.createElement("tr");
    cells.forEach((text, index) => {
      const cell = document.createElement(tag);
      if (tag === "th") cell.setAttribute("scope", "col");
      const alignment = header.alignments[index];
      if (alignment) cell.style.textAlign = alignment;
      appendInline(cell, text);
      row.append(cell);
    });
    parent.append(row);
  };
  appendRow(head, header.cells, "th");
  let index = startIndex + 2;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (isBlank(line) || isFence(line) || startsBlock(line)) break;
    const cells = splitTableRow(line);
    if (!cells || cells.length !== header.cells.length) break;
    appendRow(body, cells, "td");
    index += 1;
  }
  table.append(head, body);
  return { element: table, nextIndex: index };
}

function readCodeSpan(text: string, startIndex: number): { readonly content: string; readonly nextIndex: number } | null {
  const runs = /`+/gu;
  runs.lastIndex = startIndex;
  const opening = runs.exec(text);
  if (!opening || opening.index !== startIndex) return null;
  const contentStart = runs.lastIndex;
  for (let closing = runs.exec(text); closing; closing = runs.exec(text)) {
    if (closing[0].length === opening[0].length) {
      return { content: text.slice(contentStart, closing.index), nextIndex: runs.lastIndex };
    }
  }
  return null;
}

function readFencedCode(lines: readonly string[], startIndex: number): { readonly element: HTMLElement; readonly nextIndex: number } {
  const codeLines: string[] = [];
  let index = startIndex + 1;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (isFence(line)) {
      index += 1;
      break;
    }
    codeLines.push(line);
    index += 1;
  }

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = codeLines.join("\n");
  pre.append(code);
  return { element: pre, nextIndex: index };
}

function readList(lines: readonly string[], startIndex: number, tagName: "ul" | "ol"): { readonly element: HTMLElement; readonly nextIndex: number } {
  const list = document.createElement(tagName);
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const itemText = tagName === "ul" ? unorderedItemText(line) : orderedItemText(line);
    if (itemText === null) break;

    const item = document.createElement("li");
    appendInline(item, itemText);
    list.append(item);
    index += 1;
  }

  return { element: list, nextIndex: index };
}

function readBlockquote(lines: readonly string[], startIndex: number): { readonly element: HTMLElement; readonly nextIndex: number } {
  const quoteLines: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const text = blockquoteText(line);
    if (text === null) break;
    quoteLines.push(text);
    index += 1;
  }

  const quote = document.createElement("blockquote");
  appendInlineWithBreaks(quote, quoteLines.join("\n"));
  return { element: quote, nextIndex: index };
}

function readParagraph(lines: readonly string[], startIndex: number): { readonly element: HTMLElement; readonly nextIndex: number } {
  const paragraphLines: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (isBlank(line) || isFence(line) || startsBlock(line) || tableHeader(lines, index)) break;
    paragraphLines.push(line);
    index += 1;
  }

  const paragraph = document.createElement("p");
  appendInlineWithBreaks(paragraph, paragraphLines.join("\n"));
  return { element: paragraph, nextIndex: index };
}

function headingFor(line: string): HTMLElement | null {
  const match = line.match(/^(#{1,}) (.*)$/u);
  const marker = match?.[1];
  const content = match?.[2];
  if (!marker || content === undefined) return null;

  const level = Math.min(marker.length, 6);
  const heading = document.createElement(`h${level}`);
  appendInline(heading, content);
  return heading;
}

function appendInlineWithBreaks(parent: HTMLElement, text: string): void {
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    if (index > 0) parent.append(document.createElement("br"));
    appendInline(parent, lines[index] ?? "");
  }
}

function appendInline(parent: HTMLElement, text: string): void {
  let index = 0;

  while (index < text.length) {
    const token = nextInlineToken(text, index);
    if (!token) {
      appendText(parent, text.slice(index));
      return;
    }

    appendText(parent, text.slice(index, token.index));
    const nextIndex = appendInlineToken(parent, text, token);
    if (nextIndex === token.index) {
      appendText(parent, text.charAt(token.index));
      index = token.index + 1;
      continue;
    }
    index = nextIndex;
  }
}

function appendInlineToken(parent: HTMLElement, text: string, token: InlineToken): number {
  if (token.marker === "[") return appendLink(parent, text, token.index);
  if (token.marker === "`") {
    const span = readCodeSpan(text, token.index);
    if (!span) {
      const marker = text.slice(token.index).match(/^`+/u)?.[0] ?? "`";
      appendText(parent, marker);
      return token.index + marker.length;
    }
    const code = document.createElement("code");
    code.textContent = span.content;
    parent.append(code);
    return span.nextIndex;
  }
  if (token.marker === "**") return appendDelimited({ parent, text, startIndex: token.index, delimiter: { marker: "**", tagName: "strong" } });
  if (token.marker === "__") return appendDelimited({ parent, text, startIndex: token.index, delimiter: { marker: "__", tagName: "strong" } });
  if (token.marker === "*") return appendDelimited({ parent, text, startIndex: token.index, delimiter: { marker: "*", tagName: "em" } });
  if (token.marker === "_") return appendDelimited({ parent, text, startIndex: token.index, delimiter: { marker: "_", tagName: "em" } });
  return token.index;
}

function appendLink(parent: HTMLElement, text: string, startIndex: number): number {
  const labelEnd = text.indexOf("](", startIndex + 1);
  if (labelEnd < 0) return startIndex;

  const urlStart = labelEnd + 2;
  const urlEnd = findLinkUrlEnd(text, urlStart);
  if (urlEnd < 0) return startIndex;

  const label = text.slice(startIndex + 1, labelEnd);
  const url = text.slice(urlStart, urlEnd);

  if (!isSafeLinkUrl(url)) {
    appendText(parent, label);
    return urlEnd + 1;
  }

  const anchor = document.createElement("a");
  anchor.textContent = label;
  anchor.setAttribute("href", url);
  anchor.setAttribute("target", "_blank");
  anchor.setAttribute("rel", "noopener noreferrer");
  parent.append(anchor);
  return urlEnd + 1;
}

function appendDelimited(span: InlineSpan): number {
  const contentStart = span.startIndex + span.delimiter.marker.length;
  const contentEnd = span.text.indexOf(span.delimiter.marker, contentStart);
  if (contentEnd < 0) return span.startIndex;

  const element = document.createElement(span.delimiter.tagName);
  const content = span.text.slice(contentStart, contentEnd);
  appendInline(element, content);
  span.parent.append(element);
  return contentEnd + span.delimiter.marker.length;
}

function findLinkUrlEnd(text: string, startIndex: number): number {
  let depth = 0;
  for (let index = startIndex; index < text.length; index += 1) {
    const char = text.charAt(index);
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char !== ")") continue;
    if (depth === 0) return index;
    depth -= 1;
  }
  return -1;
}

function nextInlineToken(text: string, startIndex: number): InlineToken | null {
  let bestIndex = text.length;
  let marker = "";

  for (const candidate of ["[", "`", "**", "__", "*", "_"]) {
    const index = text.indexOf(candidate, startIndex);
    if (index < 0) continue;
    if (index < bestIndex || (index === bestIndex && candidate.length > marker.length)) {
      bestIndex = index;
      marker = candidate;
    }
  }

  return marker ? { index: bestIndex, marker } : null;
}

function appendText(parent: HTMLElement, text: string): void {
  if (text) parent.append(document.createTextNode(text));
}

function startsBlock(line: string): boolean {
  return isHeadingLine(line) || unorderedItemText(line) !== null || orderedItemText(line) !== null || blockquoteText(line) !== null;
}

function isBlank(line: string): boolean {
  return /^\s*$/u.test(line);
}

function isHeadingLine(line: string): boolean {
  return /^(#{1,}) (.*)$/u.test(line);
}

function isFence(line: string): boolean {
  return line.trim().startsWith("```");
}

function unorderedItemText(line: string): string | null {
  return line.match(/^[-*+] (.*)$/u)?.[1] ?? null;
}

function orderedItemText(line: string): string | null {
  return line.match(/^\d+\. (.*)$/u)?.[1] ?? null;
}

function blockquoteText(line: string): string | null {
  return line.match(/^> (.*)$/u)?.[1] ?? null;
}

function isSafeLinkUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}
