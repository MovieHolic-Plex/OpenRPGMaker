#!/usr/bin/env python3
"""Image-capable blind reviewer: send PNGs inline to gemini-4-argon-high and save the raw reply verbatim.

Why: the Claude Code `argon` subagent cannot see images, so its picture verdicts are blind.
This calls the local OpenAI-compatible proxy (CLIProxyAPI, default http://127.0.0.1:8318) directly,
with each image as a data URI, and writes the model's answer unedited to <out.txt>.

usage:
  python3 scripts/qa/argon-vqa.py <out.txt> <prompt.txt> <img1.png> [img2.png ...]

env:
  ANTHROPIC_AUTH_TOKEN  proxy key (already set for Claude Code on this box; never printed or written)
  ARGON_VQA_BASE        proxy base URL, default http://127.0.0.1:8318
  ARGON_VQA_MODEL       default gemini-4-argon-high (bare gemini-4-argon returns 400)

The output file starts with one header line (model and image paths), then the raw reply.
Retries up to 6 times on errors (429/5xx) with growing backoff. No tests run here.
"""
import base64
import json
import os
import sys
import time
import urllib.request


def main() -> int:
    if len(sys.argv) < 4:
        print(__doc__, file=sys.stderr)
        return 2
    out, prompt_path, *imgs = sys.argv[1:]
    token = os.environ.get("ANTHROPIC_AUTH_TOKEN")
    if not token:
        print("ANTHROPIC_AUTH_TOKEN is not set", file=sys.stderr)
        return 2
    base = os.environ.get("ARGON_VQA_BASE", "http://127.0.0.1:8318").rstrip("/")
    model = os.environ.get("ARGON_VQA_MODEL", "gemini-4-argon-high")
    with open(prompt_path, encoding="utf-8") as f:
        content = [{"type": "text", "text": f.read()}]
    for p in imgs:
        with open(p, "rb") as f:
            data = base64.b64encode(f.read()).decode()
        content.append({"type": "text", "text": f"Image: {os.path.basename(p)}"})
        content.append({"type": "image_url", "image_url": {"url": "data:image/png;base64," + data}})
    body = json.dumps({"model": model, "messages": [{"role": "user", "content": content}], "max_tokens": 8000}).encode()
    text = None
    for attempt in range(6):
        try:
            req = urllib.request.Request(f"{base}/v1/chat/completions", data=body,
                                         headers={"content-type": "application/json", "Authorization": "Bearer " + token})
            with urllib.request.urlopen(req, timeout=600) as r:
                text = json.load(r)["choices"][0]["message"]["content"]
            if text:
                break
        except Exception as e:  # noqa: BLE001 — report and retry; the token is never in the message
            print(f"retry {attempt}: {type(e).__name__} {str(e)[:200]}", file=sys.stderr)
        time.sleep(20 * (attempt + 1))
    if not text:
        print("argon-vqa: no reply after 6 attempts", file=sys.stderr)
        return 1
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write(f"model: {model} (direct, images inline: {', '.join(imgs)})\n\n{text}")
    print(text[:1500])
    return 0


if __name__ == "__main__":
    sys.exit(main())
