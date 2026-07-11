/**
 * 대형 마을 시공 로그 — 단계별 JSONL + human text + final report.
 * 파일은 시공 중 계속 flush 해서 중간에 죽어도 흔적이 남는다.
 *
 * Node 전용 fs/path 는 정적 import 하지 않는다 (app tsconfig에 node 타입 없음).
 * 스크립트 런타임에서는 process.getBuiltinModule / createRequire 로 지연 로드한다.
 */

export type LogLevel = "info" | "step" | "warn" | "error" | "qa";

export type BuildLogEvent = {
  readonly t: string;
  readonly level: LogLevel;
  readonly step?: string;
  readonly message: string;
  readonly data?: unknown;
};

type FsSync = {
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  existsSync(path: string): boolean;
  renameSync(from: string, to: string): void;
  writeFileSync(path: string, data: string, encoding?: string): void;
};

type PathSync = {
  join(...parts: string[]): string;
};

function pathJoin(...parts: string[]): string {
  return parts
    .filter((p) => p.length > 0)
    .join("/")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/");
}

function isFsSync(value: unknown): value is FsSync {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<FsSync>;
  return typeof candidate.writeFileSync === "function"
    && typeof candidate.mkdirSync === "function"
    && typeof candidate.existsSync === "function"
    && typeof candidate.renameSync === "function";
}

function isPathSync(value: unknown): value is PathSync {
  if (!value || typeof value !== "object") return false;
  return typeof (value as Partial<PathSync>).join === "function";
}

function loadNodeIo(): { fs: FsSync; path: PathSync } | null {
  try {
    const proc = (globalThis as { process?: {
      versions?: { node?: string };
      getBuiltinModule?: (id: string) => unknown;
    } }).process;
    if (!proc?.versions?.node) return null;

    // Node 22+: sync builtin access without import
    if (typeof proc.getBuiltinModule === "function") {
      const fs = proc.getBuiltinModule("fs");
      const path = proc.getBuiltinModule("path");
      if (isFsSync(fs) && isPathSync(path)) return { fs, path };
    }

    // Fallback: CommonJS require when available (tsx/node with createRequire polyfill)
    const req = (globalThis as { require?: (id: string) => unknown }).require;
    if (typeof req === "function") {
      const fs = req("node:fs");
      const path = req("node:path");
      if (isFsSync(fs) && isPathSync(path)) return { fs, path };
    }
  } catch {
    /* browser or restricted env */
  }
  return null;
}

export class LargeVillageBuildLog {
  readonly outDir: string;
  readonly startedAt: string;
  private readonly events: BuildLogEvent[] = [];
  private readonly textLines: string[] = [];
  private stepIndex = 0;
  private readonly fs: FsSync | null;
  private readonly pathJoinImpl: (...parts: string[]) => string;

  constructor(outDir = pathJoin("output", "evidence", "large-river-market-village")) {
    const io = loadNodeIo();
    this.fs = io?.fs ?? null;
    this.pathJoinImpl = io?.path.join.bind(io.path) ?? pathJoin;
    this.outDir = outDir;
    this.startedAt = new Date().toISOString();
    if (this.fs) {
      this.fs.mkdirSync(this.outDir, { recursive: true });
      // 이전 런 로그는 archive
      const prevJsonl = this.pathJoinImpl(this.outDir, "build.jsonl");
      if (this.fs.existsSync(prevJsonl)) {
        const stamp = this.startedAt.replace(/[:.]/g, "-");
        try {
          this.fs.renameSync(prevJsonl, this.pathJoinImpl(this.outDir, `build-${stamp}.jsonl.bak`));
        } catch {
          /* ignore */
        }
      }
    }
    this.info("log-open", `시공 로그 시작 → ${this.outDir}`, { startedAt: this.startedAt });
  }

  step(name: string, message: string, data?: unknown): void {
    this.stepIndex += 1;
    const label = `S${String(this.stepIndex).padStart(2, "0")}:${name}`;
    this.write("step", message, data, label);
  }

  info(message: string, detail?: string, data?: unknown): void {
    this.write("info", detail ? `${message} — ${detail}` : message, data);
  }

  warn(message: string, data?: unknown): void {
    this.write("warn", message, data);
  }

  error(message: string, data?: unknown): void {
    this.write("error", message, data);
  }

  qa(message: string, data?: unknown): void {
    this.write("qa", message, data);
  }

  private write(level: LogLevel, message: string, data?: unknown, step?: string): void {
    const event: BuildLogEvent = {
      t: new Date().toISOString(),
      level,
      step,
      message,
      data,
    };
    this.events.push(event);
    const prefix = step ? `[${level.toUpperCase()}][${step}]` : `[${level.toUpperCase()}]`;
    const line =
      data === undefined
        ? `${event.t} ${prefix} ${message}`
        : `${event.t} ${prefix} ${message} ${safeJson(data)}`;
    this.textLines.push(line);
    // eslint-disable-next-line no-console
    console.log(line);
    this.flush();
  }

  flush(): void {
    if (!this.fs) return;
    this.fs.writeFileSync(
      this.pathJoinImpl(this.outDir, "build.jsonl"),
      this.events.map((e) => JSON.stringify(e)).join("\n") + "\n",
      "utf8",
    );
    this.fs.writeFileSync(
      this.pathJoinImpl(this.outDir, "build.log"),
      this.textLines.join("\n") + "\n",
      "utf8",
    );
  }

  writeAsciiMap(name: string, ascii: string): void {
    if (this.fs) {
      this.fs.writeFileSync(this.pathJoinImpl(this.outDir, name), ascii, "utf8");
    }
    this.info("ascii-map", name, { bytes: ascii.length });
  }

  finish(report: Record<string, unknown>): string {
    const warnCount = this.events.filter((e) => e.level === "warn").length;
    const errorCount = this.events.filter((e) => e.level === "error").length;
    const finalReport: Record<string, unknown> = {
      ...report,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      eventCount: this.events.length,
      warnCount,
      errorCount,
      logDir: this.outDir,
    };
    if (this.fs) {
      this.fs.writeFileSync(
        this.pathJoinImpl(this.outDir, "report.json"),
        JSON.stringify(finalReport, null, 2),
        "utf8",
      );
    }
    this.info("log-close", "시공 로그 종료", {
      warnCount,
      errorCount,
      ok: finalReport.ok ?? errorCount === 0,
    });
    this.flush();
    return this.pathJoinImpl(this.outDir, "report.json");
  }

  get warnings(): string[] {
    return this.events.filter((e) => e.level === "warn").map((e) => e.message);
  }

  get errors(): string[] {
    return this.events.filter((e) => e.level === "error").map((e) => e.message);
  }
}

function safeJson(data: unknown): string {
  try {
    const s = JSON.stringify(data);
    return s.length > 800 ? `${s.slice(0, 800)}…` : s;
  } catch {
    return "[unserializable]";
  }
}
