/** World chipset geometry shared by descriptions, discovery and construction. */
export const WORLD_STRUCTURE_RULES = {
  textureKey: "tex_easyrpg_chipset_world",
  tileSize: 16,
  columns: 30,
  transparentColor: "#ff678b",
  bridge: {
    vertical: { deck: 472, direction: "vertical", layer: "upper" },
    horizontal: { deck: 443, support: 473, direction: "horizontal", layer: "upper" },
    shortCrossings: [412, 442],
    approach: 13,
  },
  mountain: {
    surfaces: { grass: 78, dirt: 81, snow: 168 },
    wall: [[171, 172, 173], [201, 202, 203]],
    stair: 374,
    path: 13,
    maxTiers: 4,
  },
} as const;

export const WORLD_BRIDGE_DESCRIPTIONS: Readonly<Record<number, string>> = {
  412: "World 독립형 짧은 석교. 가로 띠와 빈 픽셀이 있어 긴 세로 다리의 끝으로 쓰면 보행면이 끊긴다. 한 칸 개울의 동서 건널목으로 배치하며 긴 세로 교량은 472를 연속 사용한다.",
  442: "World 독립형 짧은 석교의 변형. 아래쪽 지지 그림과 횡단 띠를 포함하므로 472의 세로 반복 끝에 붙이지 않는다. 한 칸 개울의 동서 건널목으로 쓴다.",
  472: "World 남북 석교의 반복 몸통. 세로 교량 전체를 이 타일로 연결하고 양끝은 육지의 평평한 진입부와 접속한다. 412·442를 양끝에 붙이지 않는다. 동서 이탈은 막는다.",
  443: "World 동서 석교의 윗줄 보행면. 바로 아래 473 지지부와 두 행으로 조립하고 좌우 반복한다. 동서 통행이며 남북 이탈은 막는다.",
  473: "World 동서 석교의 아랫줄 지지부. 바로 위 443 보행면과 두 행으로 조립한다. 보행면이나 오른쪽 끝이 아니며 통행을 막는다.",
};

// Only exactly identified old bundled prose is eligible for migration.
const LEGACY_BRIDGE_DESCRIPTIONS: Readonly<Record<number, string>> = {
  412: "World 세로 석조 다리의 위쪽 턱·진입 마감. 아래 반복 몸통 472와 접하는 끝 조각으로 검토해 쓴다. 가로로 솟은 턱이 있어 세로 몸통처럼 반복하면 틈과 단차가 생긴다. 접속·통행은 별도 검증한다.",
  442: "World 세로 석조 다리의 아래쪽 턱·마감 조각. 반복 몸통 472의 끝에 맞춰 쓴다. 412·442를 일렬로 반복하는 자동 조립은 없다. 물 위 접속과 통행을 별도 검증한다.",
  472: "World 세로 석조 다리의 반복 몸통. 양옆 난간 사이로 남북 방향 바닥이 이어진다. 세로 길이를 늘릴 때 반복하고 끝의 412·442 계열 턱은 별도로 조립한다. 물 위 보행을 별도 설정한다.",
};

export function correctedWorldBridgeDescription(tile: number, current: string | undefined): string | undefined {
  return current === LEGACY_BRIDGE_DESCRIPTIONS[tile] && current !== undefined
    ? WORLD_BRIDGE_DESCRIPTIONS[tile] : undefined;
}
