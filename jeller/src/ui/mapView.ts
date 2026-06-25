// 팔도(동아시아) 지도 — SVG 헥스 그리드 + 폴링 갱신.
// STEP 1 메인 화면: 고을 색(=세력 색)이 세계 틱에 따라 변하는 걸 본다.

import type { Nation, Territory } from "@/types";
import { selectAll } from "@/api/client";
import { axialToPixel, computeViewBox, hexPoints } from "@/render/hex";

const POLL_INTERVAL_MS = 5000;

interface MapSnapshot {
  territories: Territory[];
  nations: Map<string, Nation>;
}

async function fetchSnapshot(): Promise<MapSnapshot> {
  const [territories, nations] = await Promise.all([
    selectAll<Territory>("territories"),
    selectAll<Nation>("nations"),
  ]);
  return {
    territories,
    nations: new Map(nations.map((n) => [n.id, n])),
  };
}

const NEUTRAL_COLOR = "#3a3f4b"; // 미개척/무주공산
const STROKE_COLOR = "#1a1d22";

function renderMap(container: HTMLElement, snap: MapSnapshot): void {
  const coords = snap.territories.map((t) => ({ q: t.q, r: t.r }));
  const { viewBox } = computeViewBox(coords);

  const hexes = snap.territories
    .map((t) => {
      const { x, y } = axialToPixel(t.q, t.r);
      const nation = t.nation_id ? snap.nations.get(t.nation_id) : null;
      const fill = nation ? nation.color : NEUTRAL_COLOR;
      const capital = nation && nation.capital_territory_id === t.id;
      const star = capital
        ? `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="14" fill="#fff">★</text>`
        : "";
      const label = `<text x="${x}" y="${y + HEX_LABEL_OFFSET}" text-anchor="middle" font-size="9" fill="#e8e8e8">${escapeXml(t.name)}</text>`;
      const info = `<text x="${x}" y="${y + HEX_LABEL_OFFSET + 11}" text-anchor="middle" font-size="7" fill="#b8b8b8">${t.troops}兵</text>`;
      return `<g>
        <polygon points="${hexPoints(x, y)}" fill="${fill}" stroke="${STROKE_COLOR}" stroke-width="1.5" />
        ${star}${label}${info}
      </g>`;
    })
    .join("");

  // 범례
  const legend = Array.from(snap.nations.values())
    .filter((n) => !n.eliminated)
    .map(
      (n, i) =>
        `<g transform="translate(${i * 90}, 0)">
          <rect width="12" height="12" fill="${n.color}" stroke="${STROKE_COLOR}" />
          <text x="16" y="10" font-size="10" fill="#ddd">${escapeXml(n.name)}${n.eliminated ? " (망)" : ""}</text>
        </g>`
    )
    .join("");

  container.innerHTML = `
    <div class="map-header">
      <h2>천하 팔도</h2>
      <span class="poll-hint">5초마다 갱신 · 세계 틱 5분</span>
    </div>
    <svg viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" class="map-svg">
      ${hexes}
    </svg>
    <svg viewBox="0 0 ${snap.nations.size * 90} 16" class="legend-svg">${legend}</svg>
  `;
}

const HEX_LABEL_OFFSET = -2;

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

/** 맵 뷰 부팅. 폴링 시작 후 첫 렌더. */
export async function bootMapView(container: HTMLElement): Promise<() => void> {
  // 즉시 첫 렌더 시도 (실패해도 계속 시도)
  const refresh = async () => {
    try {
      const snap = await fetchSnapshot();
      renderMap(container, snap);
    } catch (e) {
      container.innerHTML = `<div class="map-error">세계 불러오기 실패: ${escapeXml(String(e))}<br/><span class="poll-hint">Supabase(192.168.100.121) 연결·마이그레이션 적용을 확인하세요.</span></div>`;
    }
  };

  await refresh();
  const timer = window.setInterval(refresh, POLL_INTERVAL_MS);

  return () => window.clearInterval(timer);
}
