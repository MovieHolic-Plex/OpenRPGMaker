// 조수 v2 generate_art 가 등록하기 전에 «그림이 실제로 디코드 가능한가» 를 바이트로 본다(순수 함수 — jimp·DOM 없음).
// 왜(오너·리드 2026-11-09): 제공자가 돌려준 dataUrl 을 그대로 등록하면 잘린 JPEG·깨진 base64 가 타이틀 배경이 되어 화면은 검은 칸인데 관문은 «그림 있음» 으로 통과한다.
// 실측: 실생성 한 장은 815 KB JPEG(image/jpeg) 였고 시험은 1px PNG 만 썼다 — 두 형식 모두의 «끝까지 온 파일» 조건을 검사한다.

type ImageCheck = { readonly ok: true; readonly mime: "image/png" | "image/jpeg" | "image/webp"; readonly bytes: number } | { readonly ok: false; readonly reason: string };

function decodeBase64(payload: string): Uint8Array | null {
  try {
    const binary = atob(payload.replace(/\s+/gu, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch { return null; }
}

const startsWith = (b: Uint8Array, sig: readonly number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/** data:image/(png|jpeg|webp);base64,… 가 형식에 맞는 «끝까지 온» 파일인가. 크기·화풍은 보지 않는다. */
export function checkImageDataUrl(dataUrl: unknown): ImageCheck {
  if (typeof dataUrl !== "string") return { ok: false, reason: "dataUrl is not a string" };
  const m = /^data:(image\/(?:png|jpeg|webp));base64,(.*)$/isu.exec(dataUrl);
  if (!m) return { ok: false, reason: "not a base64 data:image/png|jpeg|webp URL" };
  const bytes = decodeBase64(m[2]!);
  if (!bytes || bytes.length < 16) return { ok: false, reason: "base64 payload cannot be decoded or is empty" };
  const mime = m[1]!.toLowerCase() as "image/png" | "image/jpeg" | "image/webp";
  if (mime === "image/png") {
    if (!startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ok: false, reason: "PNG signature is wrong" };
    // 마지막 12바이트가 IEND 청크(길이 0 + «IEND» + CRC) 여야 끝까지 온 파일이다.
    const tail = bytes.slice(bytes.length - 12);
    if (!(tail[4] === 0x49 && tail[5] === 0x45 && tail[6] === 0x4e && tail[7] === 0x44)) return { ok: false, reason: "PNG is truncated (no IEND chunk at the end)" };
  } else if (mime === "image/jpeg") {
    if (!startsWith(bytes, [0xff, 0xd8, 0xff])) return { ok: false, reason: "JPEG signature is wrong" };
    // 끝 마커 FFD9(뒤에 0 패딩이 몇 바이트 붙을 수 있다).
    let end = bytes.length - 1;
    while (end > 1 && bytes[end] === 0) end -= 1;
    if (!(bytes[end - 1] === 0xff && bytes[end] === 0xd9)) return { ok: false, reason: "JPEG is truncated (no end-of-image marker)" };
  } else {
    if (!(startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8))) return { ok: false, reason: "WEBP signature is wrong" };
    const declared = (bytes[4]! | (bytes[5]! << 8) | (bytes[6]! << 16) | (bytes[7]! << 24)) >>> 0;
    if (declared + 8 > bytes.length) return { ok: false, reason: "WEBP is truncated (RIFF length exceeds the data)" };
  }
  return { ok: true, mime, bytes: bytes.length };
}
