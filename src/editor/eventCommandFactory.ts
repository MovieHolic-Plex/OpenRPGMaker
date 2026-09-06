import type { Command } from "@/project/types";
import { store } from "@/project/store";
import { newCommand as createCommand } from "./eventCommandFactoryCore";
export function newCommand(kind: Command["kind"]): Command { return createCommand(kind, store.getCurrent()); }
export { newM2Command } from "./eventCommandFactoryCore";
