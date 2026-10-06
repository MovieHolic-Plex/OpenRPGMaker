// 웹 낱장 올리기: 파일 해시를 브라우저에서 세고 → blob 을 올리고 → 서버가 낱장 팩으로 감싼다.
(() => {
  const form = document.getElementById("upload-form");
  if (!form) return;
  const status = document.getElementById("upload-status");
  const csrf = document.querySelector('meta[name="csrf"]')?.getAttribute("content") ?? "";
  const kind = form.elements.namedItem("kind");
  const tileRow = form.querySelector(".tile-size");
  const syncKind = () => { tileRow.hidden = kind.value !== "tileset"; };
  kind.addEventListener("change", syncKind);
  syncKind();
  // 문구는 화면 언어로 서버가 양식의 data-msg-* 에 넣어 준다.
  const msg = (key) => form.dataset[`msg${key[0].toUpperCase()}${key.slice(1)}`] ?? key;
  const say = (text, tone = "") => { status.textContent = text; status.className = `upload-status ${tone}`; };
  const hex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const api = async (path, init) => {
    const response = await fetch(path, { ...init, headers: { "x-csrf-token": csrf, ...(init.headers ?? {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error([body.message ?? `HTTP ${response.status}`, ...(body.details ?? [])].join("\n"));
    return body;
  };
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) return say(msg("choose"), "error");
    const button = form.querySelector("button[data-testid=upload-submit]");
    button.disabled = true;
    try {
      say(msg("hashing"));
      const bytes = await file.arrayBuffer();
      const sha256 = hex(await crypto.subtle.digest("SHA-256", bytes));
      say(msg("sending"));
      await api("/api/v1/blobs", { method: "POST", headers: { "x-sha256": sha256, "content-type": "application/octet-stream" }, body: bytes });
      say(msg("creating"));
      const created = await api("/api/v1/single", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          blob: sha256,
          fileName: file.name,
          kind: data.get("kind"),
          tileSize: Number(data.get("tileSize")),
          title: String(data.get("title") ?? ""),
          summary: String(data.get("summary") ?? ""),
          description: String(data.get("description") ?? ""),
          tags: String(data.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
          license: data.get("license"),
          aiGenerated: data.get("ai") === "yes",
          credits: String(data.get("credits") ?? ""),
        }),
      });
      say(created.status === "pending" ? `${msg("done")} ${msg("pending")}` : msg("done"), "ok");
      const link = document.createElement("a");
      link.href = `/items/${created.slug}`;
      link.textContent = ` ${msg("view")}`;
      link.dataset.testid = "upload-result-link";
      status.append(link);
      form.reset();
      syncKind();
    } catch (error) {
      say(error instanceof Error ? error.message : String(error), "error");
    } finally {
      button.disabled = false;
    }
  });
})();
