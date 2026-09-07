import { describe, expect, it } from "vitest";
import { readStoredZipEntry, readStoredZipEntryNames, writeStoredZip } from "@/project/packageZip";

describe("release ZIP structural integrity", () => {
  it("rejects a local filename that disagrees with the inventoried name", async () => {
    const bytes = new Uint8Array(await writeStoredZip([{ name: "safe.txt", bytes: new Uint8Array([1]) }]).arrayBuffer());
    bytes.set(new TextEncoder().encode("evil.txt"), 30);
    expect(() => readStoredZipEntry(bytes, "safe.txt")).toThrow();
  });
  it("rejects damaged stored content even without a release manifest", async () => {
    const bytes = new Uint8Array(await writeStoredZip([{ name: "safe.txt", bytes: new Uint8Array([1]) }]).arrayBuffer());
    bytes[38] = 2;
    expect(() => readStoredZipEntry(bytes, "safe.txt")).toThrow();
  });
  it("rejects undeclared trailing bytes", async () => {
    const original = new Uint8Array(await writeStoredZip([{ name: "safe.txt", bytes: new Uint8Array([1]) }]).arrayBuffer());
    const bytes = new Uint8Array(original.length + 2); bytes.set(original);
    expect(() => readStoredZipEntryNames(bytes)).toThrow();
  });
});
