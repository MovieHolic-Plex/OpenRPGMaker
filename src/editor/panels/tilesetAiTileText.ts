import { describeChipsetTile } from "@/project/defaults/chipsetMapping";

export function tileExplanation(tile: number): string {
  const description = describeChipsetTile(tile);
  const terrain = terrainKoreanName(description.label);
  const layer = description.layer === "upper" ? "상위 레이어" : "하위 레이어";
  const role = roleKoreanName(description.repeatRole);
  return `${tile}번은 ${terrain} 타일입니다. ${layer}에서 권장 용도는 ${role}입니다.`;
}

function terrainKoreanName(label: string): string {
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes("waterfall")) return "폭포";
  if (lowerLabel.includes("shore")) return "물가 경계";
  if (lowerLabel.includes("water")) return "물";
  if (lowerLabel.includes("grass")) return "잔디";
  if (lowerLabel.includes("dirt")) return "흙길";
  if (lowerLabel.includes("sand")) return "모래";
  if (lowerLabel.includes("stone")) return "석재";
  if (lowerLabel.includes("house")) return "건물";
  return label;
}

function roleKoreanName(role: ReturnType<typeof describeChipsetTile>["repeatRole"]): string {
  if (role === "body") return "반복되는 중심 지형";
  if (role === "edge") return "가장자리 전환 경계";
  if (role === "detail") return "디테일 장식";
  if (role === "object") return "오브젝트";
  if (role === "variant") return "변형 패턴";
  return "단일 칩";
}
