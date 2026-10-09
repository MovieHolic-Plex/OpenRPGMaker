import { createHash, createHmac } from "node:crypto";

/**
 * Cloudflare R2(S3 호환) — 스토어 그림·소리 파일을 내보내는 곳. 서명(SigV4)은 직접 한다(의존성 0).
 * 버킷은 비공개다. 서버가 「내줘도 되는가」를 확인한 뒤 짧은 서명 주소로 돌려보낸다(app.ts /api/v1/blobs/:sha).
 * 받는 쪽 전송량은 R2 가 요금을 받지 않으므로 seogo 대역폭·요금이 늘지 않는다.
 */
export interface R2Config {
  readonly accountId: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucket: string;
}

const REGION = "auto";
const SERVICE = "s3";
/** 서명 주소는 한 시간 단위로 같은 값을 준다 — 브라우저 캐시가 그 시간 동안 맞는다. 유효 두 시간. */
const PRESIGN_WINDOW_SECONDS = 3600;
const PRESIGN_EXPIRES_SECONDS = 2 * 3600;

const sha256Hex = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest();
const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const amzDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export class R2 {
  readonly origin: string;

  constructor(private readonly config: R2Config) {
    this.origin = `https://${config.accountId}.r2.cloudflarestorage.com`;
  }

  private keyPath(sha256: string): string {
    return `/${encode(this.config.bucket)}/blobs/${sha256}`;
  }

  private signingKey(day: string): Buffer {
    const kDate = hmac(`AWS4${this.config.secretAccessKey}`, day);
    return hmac(hmac(hmac(kDate, REGION), SERVICE), "aws4_request");
  }

  private signature(method: string, path: string, query: string, headers: [string, string][], payloadHash: string, date: string): string {
    const canonicalHeaders = headers.map(([name, value]) => `${name}:${value.trim()}\n`).join("");
    const signedHeaders = headers.map(([name]) => name).join(";");
    const request = [method, path, query, canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${date.slice(0, 8)}/${REGION}/${SERVICE}/aws4_request`;
    const toSign = ["AWS4-HMAC-SHA256", date, scope, sha256Hex(request)].join("\n");
    return createHmac("sha256", this.signingKey(date.slice(0, 8))).update(toSign).digest("hex");
  }

  private async send(method: "PUT" | "HEAD" | "DELETE", sha256: string, body?: Uint8Array, extra: Record<string, string> = {}): Promise<Response> {
    const date = amzDate(new Date());
    const payloadHash = body ? sha256Hex(body) : sha256Hex("");
    const host = new URL(this.origin).host;
    const headers: [string, string][] = [
      ["host", host],
      ...Object.entries(extra).map(([name, value]) => [name.toLowerCase(), value] as [string, string]),
      ["x-amz-content-sha256", payloadHash],
      ["x-amz-date", date],
    ];
    headers.sort(([a], [b]) => a.localeCompare(b));
    const path = this.keyPath(sha256);
    const signature = this.signature(method, path, "", headers, payloadHash, date);
    const credential = `${this.config.accessKeyId}/${date.slice(0, 8)}/${REGION}/${SERVICE}/aws4_request`;
    const authorization = `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${headers.map(([n]) => n).join(";")}, Signature=${signature}`;
    return fetch(this.origin + path, {
      method,
      headers: Object.fromEntries([...headers.filter(([n]) => n !== "host"), ["authorization", authorization]]),
      ...(body ? { body: body as unknown as BodyInit } : {}),
      signal: AbortSignal.timeout(120_000),
    });
  }

  /** 내용 주소라 바뀌지 않는다 — 1년 immutable 캐시를 붙여 올린다. */
  async put(sha256: string, bytes: Uint8Array, mime: string): Promise<void> {
    const response = await this.send("PUT", sha256, bytes, { "content-type": mime, "cache-control": "public, max-age=31536000, immutable" });
    if (!response.ok) throw new Error(`R2 put ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }

  async has(sha256: string): Promise<boolean> {
    const response = await this.send("HEAD", sha256);
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`R2 head ${response.status}`);
    return true;
  }

  async remove(sha256: string): Promise<void> {
    const response = await this.send("DELETE", sha256);
    if (!response.ok && response.status !== 404) throw new Error(`R2 delete ${response.status}`);
  }

  /** 읽기 전용 서명 주소. 같은 시간대에는 같은 주소를 준다. */
  presign(sha256: string, now = Date.now()): string {
    const start = new Date(Math.floor(now / 1000 / PRESIGN_WINDOW_SECONDS) * PRESIGN_WINDOW_SECONDS * 1000);
    const date = amzDate(start);
    const path = this.keyPath(sha256);
    const params: [string, string][] = [
      ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
      ["X-Amz-Credential", `${this.config.accessKeyId}/${date.slice(0, 8)}/${REGION}/${SERVICE}/aws4_request`],
      ["X-Amz-Date", date],
      ["X-Amz-Expires", String(PRESIGN_EXPIRES_SECONDS)],
      ["X-Amz-SignedHeaders", "host"],
    ];
    const query = params.map(([k, v]) => `${encode(k)}=${encode(v)}`).sort().join("&");
    const signature = this.signature("GET", path, query, [["host", new URL(this.origin).host]], "UNSIGNED-PAYLOAD", date);
    return `${this.origin}${path}?${query}&X-Amz-Signature=${signature}`;
  }
}

export function r2ConfigFromEnv(env: NodeJS.ProcessEnv): R2Config | null {
  const accountId = env.STORE_R2_ACCOUNT_ID?.trim();
  const accessKeyId = env.STORE_R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.STORE_R2_SECRET_ACCESS_KEY?.trim();
  const bucket = env.STORE_R2_BUCKET?.trim();
  if (!accountId && !accessKeyId && !secretAccessKey && !bucket) return null;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) throw new Error("STORE_R2_ACCOUNT_ID·ACCESS_KEY_ID·SECRET_ACCESS_KEY·BUCKET 은 넷 다 있어야 합니다.");
  return { accountId, accessKeyId, secretAccessKey, bucket };
}
