// 같은 호출을 아무 변화 없이 되풀이하는 퇴행 루프를 끊는다.
// 실측(2026-09-25 Rasak 민가 시험 N2): stamp_layer_block 을 같은 칸·같은 값으로 137번 부르다 시간 상한에 죽었다 —
// 인자 키 순서만 바꿔 가며 불렀으므로 키를 정렬해 비교한다. 3번째에 한 번 일러 주고, 12번째에 실행을 멈춘다.
export const REPEAT_STEER_AT = 3;
export const REPEAT_STOP_AT = 12;

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort()
      .map(key => [key, canonical((value as Record<string, unknown>)[key])]));
  }
  return value;
}

export type RepeatVerdict = { readonly action: "steer" | "stop"; readonly count: number; readonly message: string } | null;

export class PiRepeatBreaker {
  private key = "";
  private count = 0;
  private steered = false;

  /** 도구 호출 하나가 끝날 때 부른다. changed = 이 호출로 프로젝트(맵)가 바뀌었는가. */
  observe(name: string, args: unknown, changed: boolean): RepeatVerdict {
    const key = `${name}\u0000${JSON.stringify(canonical(args ?? null))}`;
    if (changed || key !== this.key) {
      this.key = changed ? "" : key;
      this.count = changed ? 0 : 1;
      this.steered = false;
      return null;
    }
    this.count += 1;
    if (this.count >= REPEAT_STOP_AT) {
      return { action: "stop", count: this.count, message: `같은 ${name} 호출을 변화 없이 ${this.count}번 되풀이해 멈췄습니다.` };
    }
    if (this.count >= REPEAT_STEER_AT && !this.steered) {
      this.steered = true;
      return { action: "steer", count: this.count,
        message: `[반복 감지] ${name} 을(를) 같은 인자로 ${this.count}번 불렀지만 맵이 바뀌지 않았다. 이미 적용된 상태다. `
          + "같은 호출을 다시 하지 말고 다음 할 일로 넘어가거나, 끝났으면 결과를 보고하라." };
    }
    return null;
  }
}
