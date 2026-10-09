"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Comment {
  id: string;
  body: string;
  author: string;
  created_at: string;
}

export default function CommentSection({
  parentType,
  parentId,
  initialComments,
  dict,
}: {
  parentType: string;
  parentId: string;
  initialComments: Comment[];
  dict: { comments: string; writeComment: string; postComment: string; yourName: string; nameOptional: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentType,
        parentId,
        author: String(form.get("author") || ""),
        body: String(form.get("body") || ""),
        website: String(form.get("website") || ""),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to post.");
      return;
    }
    (event.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <section className="comments">
      <h3>{dict.comments} ({initialComments.length})</h3>
      {initialComments.length === 0 && <p className="dim">—</p>}
      <ul className="comment-list">
        {initialComments.map((c) => (
          <li key={c.id} className="comment">
            <div className="comment-head">
              <strong>{c.author}</strong>
              <span className="dim">{new Date(c.created_at).toLocaleDateString()}</span>
            </div>
            <p>{c.body}</p>
          </li>
        ))}
      </ul>
      <form className="comment-form" onSubmit={onSubmit}>
        <h4>{dict.writeComment}</h4>
        <input name="website" type="text" className="hp-field" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <input name="author" type="text" placeholder={`${dict.yourName} (${dict.nameOptional})`} maxLength={40} />
        <textarea name="body" required maxLength={2000} rows={3} />
        <button className="btn btn-primary" type="submit" disabled={busy}>{dict.postComment}</button>
        {error && <p className="form-status err" role="alert">{error}</p>}
      </form>
    </section>
  );
}
