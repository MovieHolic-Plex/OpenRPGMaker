/// <reference path="../../src/harnesses/monster-collect-species/node/pngjs.d.ts" />
// 큰 참고 그림을 정수 배율 최근접으로 줄인다(D5: 참고 그림 비용 낮추기). 워커(Bun) 전용 — pngjs.
//
// 왜 1568px·정수 배율·«손실 없을 때만»인가: Claude 는 긴 변 1568px 를 넘는 그림을 어차피 줄여 받고 그 크기로 값을 매긴다.
// GPT·Gemini 는 타일 수로 매겨 큰 그림이 비싸다. 참고 그림은 대부분 도트를 k배로 키운 비교 시트다 — k×k 칸이 모두 한 색이면
// 1/k 로 줄여도 정보가 하나도 줄지 않는다. 1배 칩셋 시트처럼 칸마다 색이 다르면 그대로 둔다(읽음 관문을 약하게 하지 않는다).
// 실측(2026-10-20): 번들 참고 그림 1,167장 중 긴 변 중앙값 640px, 1,568px 초과는 소수(해적 군도·캠퍼스·실내 시트 비교 그림).
import { PNG } from "pngjs";

export const REFERENCE_IMAGE_MAX_EDGE = 1568;

export async function shrinkReferenceImage(dataUrl: string, maxEdge = REFERENCE_IMAGE_MAX_EDGE): Promise<string> {
  const match = /^data:image\/png;base64,(.+)$/su.exec(dataUrl);
  if (!match) return dataUrl;
  const source = PNG.sync.read(Buffer.from(match[1]!, "base64"));
  const needed = Math.ceil(Math.max(source.width, source.height) / maxEdge);
  if (needed <= 1) return dataUrl;
  // 손실 없는 배율 중 needed 이상의 가장 작은 것(도트가 3배로 키워졌으면 3 — 2 는 칸 경계와 안 맞아 손실이다).
  // k×k 칸이 모두 같은 색일 때만 k 로 줄인다.
  let factor = 1;
  for (let k = needed; k <= 8; k++) if (uniformBlocks(source, k)) { factor = k; break; }
  if (factor <= 1) return dataUrl;
  const width = Math.floor(source.width / factor), height = Math.floor(source.height / factor);
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const from = ((y * factor) * source.width + x * factor) * 4, to = (y * width + x) * 4;
    out.data[to] = source.data[from]!; out.data[to + 1] = source.data[from + 1]!; out.data[to + 2] = source.data[from + 2]!; out.data[to + 3] = source.data[from + 3]!;
  }
  return `data:image/png;base64,${PNG.sync.write(out).toString("base64")}`;
}

function uniformBlocks(image: PNG, k: number): boolean {
  if (image.width % k || image.height % k) return false;
  const data = image.data;
  for (let y = 0; y < image.height; y++) {
    const rowBase = (y - (y % k)) * image.width;
    for (let x = 0; x < image.width; x++) {
      const at = (y * image.width + x) * 4, anchor = (rowBase + (x - (x % k))) * 4;
      if (data[at] !== data[anchor] || data[at + 1] !== data[anchor + 1] || data[at + 2] !== data[anchor + 2] || data[at + 3] !== data[anchor + 3]) return false;
    }
  }
  return true;
}
