export function codexProcessSpec(platform = process.platform) {
  return {
    command: platform === "win32" ? "codex.exe" : "codex",
    args: ["app-server", "--listen", "stdio://"],
  };
}
