"use client";

import { useState } from "react";

export default function LikeButton({ type, id, initialLikes, label }: { type: string; id: string; initialLikes: number; label: string }) {
  const [likes, setLikes] = useState(initialLikes);
  const [done, setDone] = useState(false);

  async function like() {
    if (done) return;
    setDone(true);
    setLikes((n) => n + 1);
    const res = await fetch("/api/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id }),
    });
    if (res.ok) {
      const body = await res.json();
      setLikes(body.likes);
    } else {
      setLikes((n) => n - 1);
    }
  }

  return (
    <button className={`like-btn${done ? " liked" : ""}`} onClick={like} disabled={done} aria-pressed={done}>
      <span aria-hidden>▲</span> {label} · {likes}
    </button>
  );
}
