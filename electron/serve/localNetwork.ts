// 앱이 여는 팀 호스트가 받아 줄 주소와 팀원에게 보여 줄 주소.
//
// 예전에는 네트워크 카드 목록의 첫 IPv4 하나만 허용했다. Docker·VPN 이 있는 컴퓨터에서는 그 첫 주소가
// 172.17.0.1 같은 가상 브리지일 수 있고, 팀원이 실제 LAN 주소로 들어오면 Host 검사에서 403 이 났다.
// 이 컴퓨터가 실제로 가진 주소만 허용하므로 DNS rebinding 방어(요청 Host = 우리 주소)는 그대로다.

import type { NetworkInterfaceInfo } from "node:os";

type Interfaces = NodeJS.Dict<NetworkInterfaceInfo[]>;

/** 팀원이 쓸 일이 없는 가상 인터페이스. 허용 목록에는 남기되 안내 주소로는 고르지 않는다. */
const VIRTUAL_INTERFACE = /^(docker|br-|veth|virbr|vmnet|vboxnet|cni|flannel|podman|lxc|lxd|utun|llw|awdl|bridge)/i;

function hostPart(address: NetworkInterfaceInfo): string {
  return address.family === "IPv6" ? `[${address.address}]` : address.address;
}

/** 이 컴퓨터로 들어오는 요청이 가질 수 있는 Host 헤더 전부(소문자). */
export function localNetworkHosts(port: number, interfaces: Interfaces, hostname: string): ReadonlySet<string> {
  const hosts = new Set<string>([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);
  for (const list of Object.values(interfaces)) {
    for (const address of list ?? []) {
      if (address.family === "IPv6" && address.address.toLowerCase().startsWith("fe80")) continue;
      hosts.add(`${hostPart(address)}:${port}`.toLowerCase());
    }
  }
  const name = hostname.trim().toLowerCase();
  if (name) {
    hosts.add(`${name}:${port}`);
    if (!name.endsWith(".local")) hosts.add(`${name}.local:${port}`);
  }
  return hosts;
}

function lanRank(ip: string): number {
  if (ip.startsWith("192.168.")) return 0;
  if (ip.startsWith("10.")) return 1;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
  // 100.64.0.0/10 — Tailscale 등 CGNAT 대역. 같은 사무실 LAN 보다 뒤에 둔다.
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return 3;
  return 4;
}

/** 팀원에게 안내할 IPv4 주소. 가상 인터페이스를 빼고 사설 LAN 대역을 앞에 둔다. */
export function preferredLanAddresses(interfaces: Interfaces): readonly string[] {
  const found: { ip: string; rank: number }[] = [];
  for (const [name, list] of Object.entries(interfaces)) {
    if (VIRTUAL_INTERFACE.test(name)) continue;
    for (const address of list ?? []) {
      if (address.internal || address.family !== "IPv4") continue;
      found.push({ ip: address.address, rank: lanRank(address.address) });
    }
  }
  return [...new Set(found.sort((a, b) => a.rank - b.rank).map((entry) => entry.ip))];
}

/**
 * 팀원이 입력한 주소를 참여 URL 로 바꾼다. 스킴이 없으면 http 를 붙인다.
 * 초대 링크의 #join= 비밀은 그대로 둔다(로그인 화면이 읽고 주소에서 지운다).
 */
export function normalizeTeamUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("호스트 주소를 입력해 주세요.");
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`);
  } catch {
    throw new Error("주소 형식이 올바르지 않습니다. 예: http://192.168.0.10:9840");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("http:// 또는 https:// 주소만 열 수 있습니다.");
  if (url.username || url.password) throw new Error("주소에 아이디·비밀번호를 넣을 수 없습니다.");
  return url;
}
