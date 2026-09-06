import type { AiJob, BlobRef, JsonObject } from "@/ai/jobs/contracts";
import { sha256HexBytes } from "@/util/sha256";

export class ApplicationClient {
  constructor(private readonly root = "/api/ai-jobs", private readonly transport: typeof fetch = (...args) => fetch(...args)) {}
  async detail(jobId: string): Promise<{ job: AiJob; manifest: BlobRef[] }> {
    const response = await this.transport(`${this.root}/${encodeURIComponent(jobId)}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Job detail HTTP ${response.status}`);
    return response.json();
  }
  async post(jobId: string, action: string, body: JsonObject): Promise<unknown> {
    const session = await this.transport(`${this.root}/session`, { cache: "no-store" });
    if (!session.ok) throw new Error(`Job session HTTP ${session.status}`);
    const { csrfToken } = await session.json() as { csrfToken: string };
    const response = await this.transport(`${this.root}/${encodeURIComponent(jobId)}/application/${action}`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-AI-Jobs-CSRF": csrfToken }, body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Application ${action} HTTP ${response.status}: ${await response.text()}`);
    return response.json();
  }
  async bytes(jobId: string, ref: BlobRef): Promise<Uint8Array> {
    const response = await this.transport(`${this.root}/${encodeURIComponent(jobId)}/artifacts/${ref.sha256}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Job artifact HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== ref.byteLength || await sha256HexBytes(bytes) !== ref.sha256) throw new Error("Job artifact integrity mismatch");
    return bytes;
  }
  async json<T>(jobId: string, ref: BlobRef): Promise<T> { return JSON.parse(new TextDecoder().decode(await this.bytes(jobId, ref))) as T; }
}
