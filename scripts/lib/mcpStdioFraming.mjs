export function encodeMcpStdioMessage(message, framing = "content-length") {
  const body = JSON.stringify(message);
  if (framing === "newline") return `${body}\n`;
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

export function createMcpStdioDecoder(onMessage) {
  let buffer = Buffer.alloc(0);
  let detectedFraming = null;

  const parseContentLengthFrame = () => {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd < 0) return false;
    const header = buffer.subarray(0, headerEnd).toString("utf8");
    const lengthMatch = /^Content-Length:\s*(\d+)$/im.exec(header);
    if (!lengthMatch) throw new Error("Missing Content-Length header");
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + Number(lengthMatch[1]);
    if (buffer.length < bodyEnd) return false;
    const body = buffer.subarray(bodyStart, bodyEnd).toString("utf8");
    buffer = buffer.subarray(bodyEnd);
    detectedFraming = "content-length";
    onMessage(JSON.parse(body));
    return true;
  };

  const parseNewlineFrame = () => {
    const lineEnd = buffer.indexOf("\n");
    if (lineEnd < 0) return false;
    const line = buffer.subarray(0, lineEnd).toString("utf8").trim();
    buffer = buffer.subarray(lineEnd + 1);
    if (!line) return true;
    detectedFraming = "newline";
    onMessage(JSON.parse(line));
    return true;
  };

  return {
    push(chunk) {
      buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
      while (buffer.length > 0) {
        const prefix = buffer.subarray(0, Math.min(buffer.length, 15)).toString("utf8").toLowerCase();
        const contentLengthPrefix = "content-length:";
        const contentLengthCandidate = contentLengthPrefix.startsWith(prefix) || prefix.startsWith(contentLengthPrefix);
        const parsed = contentLengthCandidate ? parseContentLengthFrame() : parseNewlineFrame();
        if (!parsed) return;
      }
    },
    framing() {
      return detectedFraming ?? "content-length";
    },
  };
}
