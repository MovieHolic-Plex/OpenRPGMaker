"use client";

import { useState } from "react";
import { ASSET_KINDS, AUDIO_KINDS, LICENSES } from "~/lib/kinds";

type ShareType = "asset" | "game";

interface UploadDict {
  title: string; assetTab: string; gameTab: string; name: string; gameTitle: string;
  author: string; kind: string; desc: string; tags: string; fileAsset: string; fileGame: string;
  submit: string; submitting: string; doneAsset: string; doneGame: string; pickFile: string;
  license: string; chooseLicense: string; coverLabel: string; schemaHint: string;
}

export default function UploadForm({ lang, dict }: { lang: string; dict: UploadDict }) {
  const [type, setType] = useState<ShareType>("asset");
  const [kind, setKind] = useState<string>("chipset");
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: React.ReactNode } | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const file = form.get("file") as File | null;
    if (!file || file.size === 0) {
      setStatus({ kind: "err", text: dict.pickFile });
      return;
    }
    const base = {
      author: String(form.get("author") || ""),
      description: String(form.get("description") || ""),
      license: String(form.get("license") || ""),
      tags: String(form.get("tags") || "").split(/[,\s]+/).filter(Boolean),
      website: String(form.get("website") || ""),
    };
    try {
      let url: string;
      let payload: Record<string, unknown>;
      if (type === "asset") {
        const dataUrl = await readAsDataUrl(file);
        const dims = await readImageSize(dataUrl).catch(() => null);
        url = "/api/assets";
        payload = { ...base, name: String(form.get("name") || ""), kind, dataUrl, meta: dims ?? {} };
      } else {
        const dataUrl = await readAsDataUrl(file);
        const cover = form.get("cover") as File | null;
        const coverDataUrl = cover && cover.size > 0 ? await readAsDataUrl(cover) : "";
        url = "/api/games";
        payload = {
          ...base,
          title: String(form.get("name") || ""),
          packageBase64: dataUrl.split(",")[1] ?? "",
          coverDataUrl,
        };
      }
      const res = await postWithProgress(url, payload, setProgress);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      const href = type === "asset" ? `/${lang}/assets/${body.slug}` : `/${lang}/games/${body.slug}`;
      setStatus({
        kind: "ok",
        text: (
          <>
            {type === "asset" ? dict.doneAsset : dict.doneGame}{" "}
            <a className="status-link" href={href}>{body.slug} →</a>
          </>
        ),
      });
      formEl.reset();
    } catch (error) {
      setStatus({ kind: "err", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setProgress(null);
    }
  }

  const accept = type === "asset" ? (AUDIO_KINDS.has(kind) ? "audio/*" : "image/*") : ".oprn,.rpgzzu,application/vnd.openrpg.project+zip";

  return (
    <form className="form-card" onSubmit={onSubmit}>
      <input name="website" type="text" className="hp-field" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div className="type-toggle" role="group" aria-label={dict.title}>
        <button type="button" aria-pressed={type === "asset"} className={type === "asset" ? "active" : ""} onClick={() => setType("asset")}>
          {dict.assetTab}
        </button>
        <button type="button" aria-pressed={type === "game"} className={type === "game" ? "active" : ""} onClick={() => setType("game")}>
          {dict.gameTab}
        </button>
      </div>

      <label htmlFor="name">{type === "asset" ? dict.name : dict.gameTitle}</label>
      <input id="name" name="name" type="text" required maxLength={80} />

      <label htmlFor="author">{dict.author}</label>
      <input id="author" name="author" type="text" placeholder="anonymous" maxLength={40} />

      {type === "asset" && (
        <>
          <label htmlFor="kind">{dict.kind}</label>
          <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {ASSET_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </>
      )}

      <label htmlFor="license">{dict.license}</label>
      <select id="license" name="license" defaultValue="" required>
        <option value="" disabled>{dict.chooseLicense}</option>
        {LICENSES.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>

      <label htmlFor="description">{dict.desc}</label>
      <textarea id="description" name="description" maxLength={2000} />

      <label htmlFor="tags">{dict.tags}</label>
      <input id="tags" name="tags" type="text" placeholder="rtp, village, interior" />

      <label htmlFor="file">{type === "asset" ? dict.fileAsset : dict.fileGame}</label>
      <input id="file" name="file" type="file" accept={accept} required />
      {type === "game" && (
        <>
          <p className="field-hint">{dict.schemaHint}</p>
          <label htmlFor="cover">{dict.coverLabel}</label>
          <input id="cover" name="cover" type="file" accept="image/*" />
        </>
      )}

      <div className="hero-actions">
        <button className="btn btn-primary" type="submit" disabled={progress !== null}>
          {progress !== null ? dict.submitting : dict.submit}
        </button>
      </div>
      {progress !== null && (
        <div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div aria-live="polite">
        {status && <p className={`form-status ${status.kind}`}>{status.text}</p>}
      </div>
    </form>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function readImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("not an image"));
    img.src = dataUrl;
  });
}

function postWithProgress(
  url: string,
  payload: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      resolve(new Response(xhr.responseText, { status: xhr.status, headers: { "Content-Type": "application/json" } }));
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    onProgress(0);
    xhr.send(JSON.stringify(payload));
  });
}
