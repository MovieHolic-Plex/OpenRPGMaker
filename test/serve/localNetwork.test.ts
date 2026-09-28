import { describe, expect, it } from "vitest";
import { localNetworkHosts, normalizeTeamUrl, preferredLanAddresses } from "../../electron/serve/localNetwork";

const iface = (address: string, family: "IPv4" | "IPv6" = "IPv4", internal = false) =>
  ({ address, family, internal, netmask: "", mac: "", cidr: null }) as never;

// 2026-09-28: 앱 팀 호스트가 네트워크 카드 목록의 첫 IPv4 하나만 받아, Docker·VPN 이 있는 컴퓨터에서 팀원이 403 이었다.
describe("앱 팀 호스트 주소", () => {
  const interfaces = { lo: [iface("127.0.0.1", "IPv4", true)], docker0: [iface("172.17.0.1")], ens18: [iface("192.168.100.124"), iface("fe80::1", "IPv6")], tailscale0: [iface("100.73.251.77")] };

  it("이 컴퓨터의 모든 주소와 호스트 이름을 받고, 다른 이름은 받지 않는다", () => {
    const hosts = localNetworkHosts(9840, interfaces, "Mdc-Server");
    for (const host of ["127.0.0.1:9840", "localhost:9840", "172.17.0.1:9840", "192.168.100.124:9840", "100.73.251.77:9840", "mdc-server:9840", "mdc-server.local:9840"]) expect(hosts.has(host)).toBe(true);
    expect(hosts.has("evil.example:9840")).toBe(false);
    expect(hosts.has("192.168.100.124:9841")).toBe(false);
    expect([...hosts].some((host) => host.startsWith("[fe80"))).toBe(false);
  });

  it("안내 주소는 가상 인터페이스를 빼고 사설 LAN 을 앞에 둔다", () => {
    expect(preferredLanAddresses(interfaces)).toEqual(["192.168.100.124", "100.73.251.77"]);
  });

  it("팀원 입력 주소를 정규화한다", () => {
    expect(normalizeTeamUrl(" 192.168.0.10:9840 ").href).toBe("http://192.168.0.10:9840/");
    expect(normalizeTeamUrl("http://h:9840/?hostProject=x#join=secret").hash).toBe("#join=secret");
    expect(() => normalizeTeamUrl("")).toThrow();
    expect(() => normalizeTeamUrl("file:///etc/passwd")).toThrow();
    expect(() => normalizeTeamUrl("http://user:pw@h:1")).toThrow();
  });
});
