/**
 * The symlinks that point each tool at `.agents/`, shared by the link script
 * and the validator so both agree on what "correct" means.
 *
 * Windows needs three things the obvious implementation gets wrong. Targets
 * are written with forward slashes, so the committed link text is the same on
 * every OS. `readlink` returns backslashes there, so targets are normalised
 * before comparing. And with `core.symlinks=false`, git checks a link out as a
 * plain file holding the target path, which is recognised as a placeholder and
 * replaced with a real link.
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, posix, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Monorepo directories whose children may carry a nested `AGENTS.md`. */
export const WORKSPACE_ROOTS = ["apps", "features", "packages"];

export const LINK_SCRIPT = "node scripts/link-agent-config.mts";

/** A git placeholder is a few bytes of path; anything larger is real content. */
const PLACEHOLDER_MAX_BYTES = 1024;

export type LinkState =
  "ok" | "missing" | "placeholder" | "not-a-symlink" | "wrong-target";

export type Inspection = { state: LinkState; wanted: string; actual?: string };

/** What is on disk at a link path, read once so classification stays pure. */
export type LinkEntry =
  | { kind: "missing" }
  | { kind: "symlink"; target: string }
  | { kind: "file"; text: string | null }
  | { kind: "directory" };

/** Converts an OS path to the forward-slash form used in messages and links. */
export function toPosix(path: string): string {
  return path.split(sep).join("/");
}

/** Decides a link's state from what is on disk and the target it should have. */
export function classifyLink({
  wanted,
  entry,
}: {
  wanted: string;
  entry: LinkEntry;
}): Inspection {
  if (entry.kind === "missing") return { state: "missing", wanted };

  if (entry.kind === "symlink") {
    const actual = entry.target.replaceAll("\\", "/");
    if (actual !== wanted) return { state: "wrong-target", wanted, actual };

    return { state: "ok", wanted };
  }

  if (entry.kind === "file" && entry.text?.trim() === wanted) {
    return { state: "placeholder", wanted };
  }

  return { state: "not-a-symlink", wanted };
}

/** Only these states can be repaired without `--override`. */
export function isSafeToWrite(state: LinkState): boolean {
  return state === "missing" || state === "placeholder";
}

/** One sentence naming what is wrong with a link and the command that fixes it. */
export function describeLinkProblem({
  link,
  inspection,
}: {
  link: string;
  inspection: Inspection;
}): string {
  const { state, wanted, actual } = inspection;

  if (state === "ok") return `${link} is correct.`;

  if (state === "missing") {
    return `${link} is missing (expected a link to ${wanted}). Run \`${LINK_SCRIPT}\`.`;
  }

  if (state === "placeholder") {
    return `${link} is a plain file holding the link text, which is how git checks out a symlink when core.symlinks is false. Run \`${LINK_SCRIPT}\` to replace it with a real link.`;
  }

  if (state === "not-a-symlink") {
    return `${link} is a regular file or directory, not a link to ${wanted}. Run \`${LINK_SCRIPT} --override\` to replace it.`;
  }

  if (state === "wrong-target") {
    return `${link} points at ${actual}, expected ${wanted}. Run \`${LINK_SCRIPT} --override\` to fix it.`;
  }

  const unreachable: never = state;
  throw new Error(`Unhandled link state: ${String(unreachable)}`);
}

/** A link path and the file it should point at, both repo-relative with `/`. */
export class AgentLink {
  readonly link: string;
  readonly target: string;

  constructor({ link, target }: { link: string; target: string }) {
    this.link = link;
    this.target = target;
  }

  /** The link text: the target relative to the link's own directory. */
  get wanted(): string {
    return posix.relative(posix.dirname(this.link), this.target);
  }

  inspect(): Inspection {
    return classifyLink({ wanted: this.wanted, entry: this.#readEntry() });
  }

  /** Replaces whatever is at the link path with a symlink to the target. */
  write(): void {
    const linkPath = join(REPO_ROOT, this.link);
    const targetPath = join(REPO_ROOT, this.target);

    if (!existsSync(targetPath)) {
      throw new Error(
        `Cannot link ${this.link}: ${this.target} does not exist.`
      );
    }

    this.#remove(linkPath);
    mkdirSync(dirname(linkPath), { recursive: true });

    // Windows creates file and directory links differently. Ignored elsewhere.
    const type = statSync(targetPath).isDirectory() ? "dir" : "file";

    try {
      symlinkSync(this.wanted, linkPath, type);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;

      throw new Error(
        `Cannot create ${this.link}: Windows only lets an elevated shell or Developer Mode create symlinks. Enable Developer Mode and rerun.`
      );
    }
  }

  #readEntry(): LinkEntry {
    const linkPath = join(REPO_ROOT, this.link);

    let stats;
    try {
      stats = lstatSync(linkPath);
    } catch {
      return { kind: "missing" };
    }

    if (stats.isSymbolicLink()) {
      return { kind: "symlink", target: readlinkSync(linkPath) };
    }

    if (stats.isDirectory()) return { kind: "directory" };

    if (stats.size > PLACEHOLDER_MAX_BYTES) return { kind: "file", text: null };

    return { kind: "file", text: readFileSync(linkPath, "utf8") };
  }

  /** Unlinks a link or file in place; only a real directory is removed recursively. */
  #remove(linkPath: string): void {
    let stats;
    try {
      stats = lstatSync(linkPath);
    } catch {
      return;
    }

    if (stats.isDirectory() && !stats.isSymbolicLink()) {
      rmSync(linkPath, { recursive: true });
      return;
    }

    unlinkSync(linkPath);
  }
}

/** Every link each tool needs, keyed by tool so the link script can filter. */
export const TOOL_LINKS: Record<string, AgentLink[]> = {
  claude: [
    new AgentLink({ link: "CLAUDE.md", target: "AGENTS.md" }),
    new AgentLink({ link: ".claude/skills", target: ".agents/skills" }),
    new AgentLink({
      link: ".claude/settings.json",
      target: ".agents/wrappers/claude/settings.json",
    }),
  ],
  cursor: [
    new AgentLink({
      link: ".cursor/BUGBOT.md",
      target: ".agents/wrappers/cursor/BUGBOT.md",
    }),
  ],
};

/** Repo-relative directories under a workspace root that hold an `AGENTS.md`. */
export function listWorkspaceAgentsDirs(): string[] {
  const dirs: string[] = [];

  for (const root of WORKSPACE_ROOTS) {
    const rootPath = join(REPO_ROOT, root);
    if (!existsSync(rootPath)) continue;

    for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const workspace = `${root}/${entry.name}`;
      if (existsSync(join(REPO_ROOT, workspace, "AGENTS.md"))) {
        dirs.push(workspace);
      }
    }
  }

  return dirs;
}

/** The tool links for the given tools, plus a `CLAUDE.md` beside every nested `AGENTS.md`. */
export function expectedLinks(
  tools: string[] = Object.keys(TOOL_LINKS)
): AgentLink[] {
  const nested = listWorkspaceAgentsDirs().map(
    (workspace) =>
      new AgentLink({
        link: `${workspace}/CLAUDE.md`,
        target: `${workspace}/AGENTS.md`,
      })
  );

  return [...tools.flatMap((tool) => TOOL_LINKS[tool] ?? []), ...nested];
}
