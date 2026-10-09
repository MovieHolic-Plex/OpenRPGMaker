export function usage() {
  return [
    "Usage: node scripts/check-oprn-parity.mjs --contract <path> --matrix <path> --evidence <path>",
    "",
    "Checks the frozen RM2K3 fidelity contract and parity matrix for F4 scope fidelity.",
  ].join("\n");
}

export function parseArgs(argv) {
  const parsed = {
    contract: undefined,
    matrix: undefined,
    evidence: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }

    if (!Object.hasOwn(parsed, arg.slice(2))) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }

    const key = arg.slice(2);
    if (parsed[key] !== undefined) {
      throw new Error(`Duplicate argument: ${arg}`);
    }

    parsed[key] = value;
    index += 1;
  }

  for (const key of Object.keys(parsed)) {
    if (typeof parsed[key] !== "string" || parsed[key].trim().length === 0) {
      throw new Error(`--${key} is required`);
    }
  }

  return parsed;
}

export function redactSecrets(message) {
  return message
    .replace(/(token|secret|password|api[_-]?key)=([^&\s]+)/gi, "$1=<redacted>")
    .replace(/(token|secret|password|api[_-]?key)["']?\s*:\s*["'][^"']+["']/gi, "$1: <redacted>");
}
