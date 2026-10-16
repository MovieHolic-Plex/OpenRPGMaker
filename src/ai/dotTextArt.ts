import { DotTextImageError, generateDotTextImage, type DotTextChat, type DotTextImage, type DotTextImageRequest } from "./dotTextImage";
import { IMAGE_PURPOSES, isPixelDrawPurpose, type ImagePurpose } from "./imageRoute";

/**
 * 낱장 도트 입구(2026-10-16). `generateAiImage` 가 도트 용도를 거절하는 짝 — 도트 용도는 여기로 온다.
 *
 * 모델 호출은 두 곳에서 온다. 브라우저는 «도트 저작 모델» 칸을 읽는 기본 호출(`dotTextBrowserChat`, 동적 import 라 Bun 워커가
 * 브라우저 코드를 끌어오지 않는다), Bun 워커는 실행 시작 때 `setDotTextChat` 으로 꽂은 호출이다(요청에 실린 도트 저작 모델).
 * 설정이 없으면(옛 설정) 도트 저작 모델은 계획·최종 판단 모델을 따라간다 — 설정을 몰래 만들지 않는다.
 */
let chatOverride: DotTextChat | undefined;

/** 워커·테스트·헤드리스 하네스가 브라우저 호출 대신 쓸 텍스트 모델 호출을 꽂는다. undefined 로 되돌린다. */
export function setDotTextChat(chat: DotTextChat | undefined): void {
  chatOverride = chat;
}

/** 꽂아 둔 호출이 있는가 — 컷신 도구가 «헤드리스 이미지 하네스» 와 «실제 도트 경로» 를 가르는 데 쓴다. */
export function hasDotTextChat(): boolean {
  return chatOverride !== undefined;
}

export interface GenerateDotArtRequest extends DotTextImageRequest {
  readonly purpose: ImagePurpose;
}

/** 도트 용도(낱장) 한 장을 텍스트 모델로 만든다. 낱장 도트가 아닌 용도(생성형·공방·업로드)로 부르면 거절한다. */
export async function generateDotArt(request: GenerateDotArtRequest): Promise<DotTextImage> {
  if (!isPixelDrawPurpose(request.purpose)) {
    throw new DotTextImageError(`「${IMAGE_PURPOSES[request.purpose].label}」은(는) 낱장 도트 용도가 아닙니다 — 생성형은 generateAiImage, 타일셋·기물은 공방을 쓰세요.`);
  }
  const chat = chatOverride ?? (await import("./dotTextBrowserChat")).createBrowserDotTextChat();
  return generateDotTextImage(request, chat);
}
