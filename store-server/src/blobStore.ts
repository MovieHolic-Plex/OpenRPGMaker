import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** sha256 주소의 불변 파일 저장소. 같은 바이트는 한 번만 쓴다. */
export class BlobStore {
  constructor(private readonly root: string) {
    mkdirSync(root, { recursive: true });
  }

  pathOf(sha256: string): string {
    return join(this.root, sha256.slice(0, 2), sha256.slice(2, 4), sha256);
  }

  has(sha256: string): boolean {
    return existsSync(this.pathOf(sha256));
  }

  /** 해시가 맞을 때만 쓴다. 임시 파일에 쓰고 옮겨서 반쯤 쓴 파일이 남지 않게 한다. */
  put(sha256: string, bytes: Uint8Array): void {
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== sha256) throw new Error("sha256 mismatch");
    const target = this.pathOf(sha256);
    if (existsSync(target)) return;
    mkdirSync(dirname(target), { recursive: true });
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(temp, bytes, { flag: "wx" });
    renameSync(temp, target);
  }

  remove(sha256: string): void {
    rmSync(this.pathOf(sha256), { force: true });
  }

  read(sha256: string): Buffer {
    return readFileSync(this.pathOf(sha256));
  }
}
