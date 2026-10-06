import { describe, expect, it } from "vitest";
import { isPrivateHost, sameOriginUrl } from "../electron/main/assetStoreClient";

describe("asset store client address rules", () => {
  it("allows plain http only for private hosts", () => {
    for (const host of ["localhost", "127.0.0.1", "[::1]", "10.0.0.5", "192.168.1.2", "172.20.0.1", "100.73.251.77", "mdc-server"]) expect(isPrivateHost(host), host).toBe(true);
    for (const host of ["10.evil.com", "192.168.1.2.evil.com", "100.73.251.77.nip.io", "store.openrpgmaker.com", "100.128.0.1", "172.32.0.1", "8.8.8.8"]) expect(isPrivateHost(host), host).toBe(false);
  });

  it("opens only same-origin login pages", () => {
    expect(sameOriginUrl("https://store.openrpgmaker.com/device?code=AB", "https://store.openrpgmaker.com")).toBe("https://store.openrpgmaker.com/device?code=AB");
    expect(sameOriginUrl("file:///etc/passwd", "https://store.openrpgmaker.com")).toBeNull();
    expect(sameOriginUrl("https://evil.example/device", "https://store.openrpgmaker.com")).toBeNull();
    expect(sameOriginUrl("not a url", "https://store.openrpgmaker.com")).toBeNull();
  });
});
