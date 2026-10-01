/**
 * 노드 쪽 이미지 생성 — god-tibo-imagen 서버(`POST /v1/generate/json`).
 * 주소는 OPRN_HARNESS_IMAGE_URL 로 바꾼다. 출력 크기는 참고 이미지 비율을 따른다(약 1254x1254).
 * 에디터 안에서는 이 파일 대신 src/ai/imageGenerationClient.ts 를 쓴다(같은 프롬프트·같은 도트화).
 */
const DEFAULT_URL = "http://mdc-server:8091";
const TIMEOUT_MS = 25 * 60 * 1000;

export type GenerateRequest = { prompt: string; reference: Buffer; slug: string };

export function imageServiceUrl(): string {
  return (process.env.OPRN_HARNESS_IMAGE_URL ?? DEFAULT_URL).replace(/\/$/, "");
}

export async function generateImage(request: GenerateRequest, attempts = 2): Promise<Buffer> {
  let lastError = "";
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${imageServiceUrl()}/v1/generate/json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: request.prompt,
          slug: request.slug,
          return_base64: true,
          fallback: false,
          priority: 10,
          reference_b64: request.reference.toString("base64"),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const body = (await response.json().catch(() => null)) as { image_b64?: string; error?: string } | null;
      if (response.ok && body?.image_b64) return Buffer.from(body.image_b64, "base64");
      // 502 MISSING_IMAGE_GENERATION_OUTPUT 는 흔하다 — 한 번 더 시도한다.
      lastError = `HTTP ${response.status} ${(body?.error ?? "").slice(0, 160)}`;
    } catch (error) {
      lastError = String(error).slice(0, 160);
    }
  }
  throw new Error(`이미지 생성 실패 (${request.slug}): ${lastError}`);
}

/** 동시에 limit 개씩 돌린다. 실패한 것은 null. */
export async function mapLimit<T, R>(items: T[], limit: number, work: (item: T, index: number) => Promise<R>): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      try {
        results[index] = await work(items[index]!, index);
      } catch (error) {
        console.error(String(error instanceof Error ? error.message : error));
      }
    }
  });
  await Promise.all(runners);
  return results;
}
