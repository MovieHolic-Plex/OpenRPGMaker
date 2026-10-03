import type { UploadedAsset } from './types';

// The ZIP writer and exported player must agree without importing editor catalogs.
export function safeFileName(value: string): string {
  const safe = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-').replace(/\s+/g, '-');
  return safe || 'oprn';
}

export function webUploadedAssetPath(asset: UploadedAsset): string {
  return `assets/uploaded/${safeFileName(asset.id)}.${asset.ref?.extension ?? dataUrlExtension(asset.dataUrl ?? '')}`;
}

function dataUrlExtension(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  const media = dataUrl.slice(0, comma >= 0 ? comma : dataUrl.length).toLowerCase();
  if (media.includes('image/jpeg')) return 'jpg';
  if (media.includes('image/webp')) return 'webp';
  if (media.includes('image/gif')) return 'gif';
  if (media.includes('video/mp4')) return 'mp4';
  if (media.includes('video/webm')) return 'webm';
  if (media.includes('video/ogg')) return 'ogv';
  if (media.includes('audio/mpeg')) return 'mp3';
  if (media.includes('audio/wav')) return 'wav';
  if (media.includes('audio/ogg')) return 'ogg';
  return 'png';
}
