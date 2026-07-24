"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PostForm({
  lang,
  dict,
}: {
  lang: string;
  dict: {
    categoryLabel: string;
    categories: Record<string, string>;
    titleField: string;
    bodyField: string;
    yourName: string;
    nameOptional: string;
    publish: string;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: String(form.get("category")),
        title: String(form.get("title") || ""),
        body: String(form.get("body") || ""),
        author: String(form.get("author") || ""),
        lang,
        website: String(form.get("website") || ""),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to publish.");
      return;
    }
    router.push(`/${lang}/board/${data.id}`);
  }

  return (
    <form className="form-card" onSubmit={onSubmit}>
      <input name="website" type="text" className="hp-field" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label htmlFor="category">{dict.categoryLabel}</label>
      <select id="category" name="category" defaultValue="general">
        {Object.entries(dict.categories)
          .filter(([k]) => k !== "all")
          .map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
      </select>
      <label htmlFor="title">{dict.titleField}</label>
      <input id="title" name="title" type="text" required maxLength={120} />
      <label htmlFor="author">{dict.yourName}</label>
      <input id="author" name="author" type="text" placeholder={dict.nameOptional} maxLength={40} />
      <label htmlFor="body">{dict.bodyField}</label>
      <textarea id="body" name="body" required maxLength={10000} rows={8} />
      <div className="hero-actions">
        <button className="btn btn-primary" type="submit" disabled={busy}>{dict.publish}</button>
      </div>
      {error && <p className="form-status err" role="alert">{error}</p>}
    </form>
  );
}
