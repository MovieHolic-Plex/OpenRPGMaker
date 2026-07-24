export type IceGrandExpanseGameplayErrorCode = "GATE_CLOSED" | "CONTACT_BLOCKED" | "ROUTE_UNREACHABLE";

export class IceGrandExpanseGameplayError extends Error {
  readonly name = "IceGrandExpanseGameplayError";
  constructor(
    readonly code: IceGrandExpanseGameplayErrorCode,
    readonly x: number,
    readonly y: number,
    readonly reason: string,
  ) {
    super(`${code}:${x},${y}:${reason}`);
  }
}
