import type { AiProjectIdentity, JsonObject } from "@/ai/jobs/contracts";
import type { Project, Command } from "@/project/types";

export interface ApplicationRecord {
  readonly key: string;
  readonly jobId: string;
  readonly project: AiProjectIdentity;
  readonly resultSha256: string;
  readonly claimId: string;
  readonly receiptId: string;
  readonly prepare: JsonObject;
  readonly before: Project;
  readonly beforeSnapshotSha256?: string;
  readonly proposed: Project;
  readonly draftBefore?: readonly Command[];
  readonly draftAfter?: readonly Command[];
  readonly draftOnly: boolean;
  readonly noChanges?: boolean;
  readonly phase: "prepared" | "applied" | "conflict" | "outcome-unknown";
  readonly applied?: Project;
  readonly serialized?: string;
  readonly evidence?: JsonObject;
  readonly saveRequest?: JsonObject;
  readonly saveAttemptId?: string;
  readonly saveAcknowledged?: boolean;
}
export const APPLICATION_DATABASE = "oprn-ai-job-applications-v1";
/** No eviction and no memory fallback: request success alone is not durable admission. */
export async function openApplicationRecords(factory: IDBFactory = indexedDB): Promise<ApplicationRecords> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(APPLICATION_DATABASE, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("records", { keyPath: "key" }); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Application storage upgrade blocked"));
    request.onsuccess = () => resolve(request.result);
  });
  database.onversionchange = () => database.close();
  return new ApplicationRecords(database);
}
export class ApplicationRecords {
  constructor(private readonly database: IDBDatabase) {}
  private transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const tx = this.database.transaction("records", mode, { durability: "strict" });
      let value: T;
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(tx.error ?? new Error("Application transaction aborted"));
      tx.onerror = () => { /* onabort is the terminal failure signal; do not preventDefault. */ };
      const request = operation(tx.objectStore("records"));
      request.onsuccess = () => { value = request.result; };
    });
  }
  get(key: string): Promise<ApplicationRecord | undefined> { return this.transaction("readonly", store => store.get(key)); }
  async put(record: ApplicationRecord): Promise<void> { await this.transaction("readwrite", store => store.put(record)); }
  close(): void { this.database.close(); }
}
