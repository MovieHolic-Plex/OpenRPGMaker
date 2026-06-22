export type SystemShellScreen = "title" | "play" | "main-menu" | "load" | "game-over";

export type SystemShellState = {
  readonly screen: SystemShellScreen;
  readonly message?: string;
};

export type SystemShellAction =
  | { readonly kind: "start-new-game" }
  | { readonly kind: "open-load" }
  | { readonly kind: "open-menu" }
  | { readonly kind: "close-menu" }
  | { readonly kind: "game-over" }
  | { readonly kind: "return-title" };

export function createSystemShellState(screen: SystemShellScreen): SystemShellState {
  return { screen };
}

export function reduceSystemShell(
  _state: SystemShellState,
  action: SystemShellAction
): SystemShellState {
  switch (action.kind) {
    case "start-new-game":
      return { screen: "play" };
    case "open-load":
      return { screen: "load" };
    case "open-menu":
      return { screen: "main-menu" };
    case "close-menu":
      return { screen: "play" };
    case "game-over":
      return { screen: "game-over" };
    case "return-title":
      return { screen: "title" };
    default:
      return assertNever(action);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected shell action: ${JSON.stringify(value)}`);
}
