import { describe, expect, it } from "vitest";
import { deserialize } from "@/project/io";
import type { Command } from "@/project/types";

function walkCommands(commands: readonly Command[] | undefined, visit: (cmd: Command) => void): void {
  if (!commands) return;
  for (const cmd of commands) {
    visit(cmd);
    if (cmd.kind === "choices") {
      for (const option of cmd.options) walkCommands(option.branch, visit);
      walkCommands(cmd.cancelBranch, visit);
    } else if (cmd.kind === "fork") {
      walkCommands(cmd.then, visit);
      walkCommands(cmd.else, visit);
    } else if (cmd.kind === "loop") {
      walkCommands(cmd.body, visit);
    } else if (cmd.kind === "shop") {
      walkCommands(cmd.transactionBranch, visit);
    } else if (cmd.kind === "promoteActor" || cmd.kind === "evolveMonster") {
      walkCommands(cmd.successBranch, visit);
      walkCommands(cmd.failureBranch, visit);
    }
  }
}

async function readOptionalText(path: string): Promise<string | null> {
  const moduleName = "node:fs";
  const fsModule = (await import(/* @vite-ignore */ moduleName)) as {
    readonly existsSync?: (p: string) => boolean;
    readonly readFileSync?: (p: string, enc: string) => string;
  };
  if (typeof fsModule.existsSync !== "function" || typeof fsModule.readFileSync !== "function") return null;
  if (!fsModule.existsSync(path)) return null;
  return fsModule.readFileSync(path, "utf8");
}

describe("forward-compatible command kind validation", () => {
  it("loads remote fable-village snapshot with setEventGraphicPattern", async () => {
    const raw = await readOptionalText("tmp-fable-project.json");
    if (!raw) return;
    const loaded = deserialize(raw);
    expect(Object.keys(loaded.maps).length).toBeGreaterThan(0);
    let patternCount = 0;
    for (const map of Object.values(loaded.maps)) {
      for (const event of map.events) {
        for (const page of event.pages ?? []) {
          walkCommands(page.commands, (cmd) => {
            if (cmd.kind === "setEventGraphicPattern") patternCount += 1;
          });
        }
      }
    }
    expect(patternCount).toBeGreaterThan(0);
  });
});
