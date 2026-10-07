// 웹 낱장 올리기: 파일 해시를 브라우저에서 세고 → blob 을 올리고 → 서버가 낱장 팩으로 감싼다.
(() => {
  const form = document.getElementById("upload-form");
  if (!form) return;
  const status = document.getElementById("upload-status");
  const csrf = document.querySelector('meta[name="csrf"]')?.getAttribute("content") ?? "";
  const kind = form.elements.namedItem("kind");
  const fileInput = form.elements.namedItem("file");
  const specLine = document.getElementById("upload-spec");
  // 종류별 규격(문구·크기)은 서버가 data-specs 에 넣어 준다. 최종 판정은 서버가 다시 한다.
  const specs = JSON.parse(form.dataset.specs || "{}");
  // 문구는 화면 언어로 서버가 양식의 data-msg-* 에 넣어 준다.
  const msg = (key) => form.dataset[`msg${key[0].toUpperCase()}${key.slice(1)}`] ?? key;
  const say = (text, tone = "") => { status.textContent = text; status.className = `upload-status ${tone}`; };
  const sizeOf = async (file) => {
    if (file.type !== "image/png") return null;
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return null;
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  };
  /** 규격에 맞지 않으면 화면 언어 문구를, 맞거나 확인할 수 없으면 "" 를 돌려준다. */
  const sizeProblem = async () => {
    const spec = specs[kind.value];
    const file = fileInput.files?.[0];
    if (!spec || !file || !(spec.width || spec.tile)) return "";
    const size = await sizeOf(file);
    if (!size) return "";
    const ok = spec.tile
      ? size.width % spec.tile === 0 && size.height % spec.tile === 0
      : size.width === spec.width && size.height === spec.height;
    return ok ? "" : msg("badsize").replace("{0}", `${size.width}×${size.height}`).replace("{1}", spec.text);
  };
  const syncKind = async () => {
    specLine.textContent = specs[kind.value]?.text ?? "";
    const problem = await sizeProblem();
    if (problem) say(problem, "error");
    else if (status.classList.contains("error")) say("");
  };
  kind.addEventListener("change", syncKind);
  fileInput.addEventListener("change", syncKind);
  syncKind();
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
    const problem = await sizeProblem();
    if (problem) return say(problem, "error");
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
