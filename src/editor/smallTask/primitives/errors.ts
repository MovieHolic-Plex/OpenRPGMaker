import { SmallTaskError } from "../target";

export const STALE_COMMAND_LIST = "명령 목록이 바뀌었어요. 이벤트를 다시 읽어 주세요.";
export const SELECT_EVENT_PAGE = "이벤트 페이지가 여러 개예요. 고칠 페이지를 선택해 주세요.";
export const MAP_REMOVAL_DRAFT_REFUSAL = "맵 삭제 초안 보호: ";

export class PrimitiveError extends SmallTaskError {
  constructor(message: string) {
    super(message);
    this.name = "PrimitiveError";
  }
}
