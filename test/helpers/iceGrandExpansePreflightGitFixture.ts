import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";

type GitFixtureRequest = {
  readonly files: Readonly<Record<string, string>>;
  readonly root: string;
};

export async function initializePreflightGitFixture(request: GitFixtureRequest): Promise<void> {
  execFileSync("git", ["init", "--quiet"], { cwd: request.root });
  execFileSync("git", ["config", "user.email", "preflight@example.invalid"], { cwd: request.root });
  execFileSync("git", ["config", "user.name", "Preflight Test"], { cwd: request.root });
  const fileNames = Object.keys(request.files);
  for (const fileName of fileNames) await writeFile(path.join(request.root, fileName), request.files[fileName] ?? "", "utf8");
  execFileSync("git", ["add", ...fileNames], { cwd: request.root });
  execFileSync("git", ["commit", "--quiet", "-m", "seed"], { cwd: request.root });
}
