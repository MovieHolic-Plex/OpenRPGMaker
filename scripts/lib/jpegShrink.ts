// 이미지 축소 → JPEG data URI. jimp 0.x(default export, resize(w, AUTO))와 1.x(named Jimp, resize({w}), getBuffer(mime,{quality}))를 둘 다 받는다.
import * as JimpModule from 'jimp';

type AnyJimp = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const Jimp: AnyJimp = (JimpModule as AnyJimp).Jimp ?? (JimpModule as AnyJimp).default ?? JimpModule;

export async function jpegDataUrl(dataUrl: string, maxWidth: number, quality: number): Promise<string> {
  const image: AnyJimp = await Jimp.read(Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
  const width: number = image.bitmap.width;
  if (width > maxWidth) {
    if (typeof image.scaleToFit === 'function' && !('MIME_JPEG' in Jimp)) image.resize({ w: maxWidth });
    else image.resize(maxWidth, Jimp.AUTO);
  }
  const buffer: Buffer = 'MIME_JPEG' in Jimp
    ? await image.quality(quality).getBufferAsync(Jimp.MIME_JPEG)
    : await image.getBuffer('image/jpeg', { quality });
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

/** PNG 바이트를 maxWidth 로 줄여 PNG base64 로 돌려준다(하네스의 브라우저 렌더 결과 축소용). */
export async function pngShrinkBase64(raw: Buffer, maxWidth: number): Promise<string> {
  const image: AnyJimp = await Jimp.read(raw);
  if (image.bitmap.width > maxWidth) {
    if (!('MIME_JPEG' in Jimp)) image.resize({ w: maxWidth }); else image.resize(maxWidth, Jimp.AUTO);
  }
  const buffer: Buffer = 'MIME_PNG' in Jimp ? await image.getBufferAsync(Jimp.MIME_PNG) : await image.getBuffer('image/png');
  return buffer.toString('base64');
}
