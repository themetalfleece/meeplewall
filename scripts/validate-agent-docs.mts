#!/usr/bin/env node
/**
 * Guards the agent documentation tree. Without these checks `AGENTS.md` grows
 * back into the always-loaded file the skills split apart, and a skill index
 * silently drifts from the rules it claims to list.
 *
 * Run directly: `node scripts/validate-agent-docs.mts`.
 *
 * The rule functions are pure and exported, so the co-located test can cover
 * their edge cases without a filesystem. Importing this file runs nothing; the
 * `import.meta.main` guard at the bottom is what starts the run.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import {
  REPO_ROOT,
  describeLinkProblem,
  expectedLinks,
  listWorkspaceAgentsDirs,
  toPosix,
  type Inspection,
} from "./agent-links.mts";

/** A root file loads on every task, so it gets the tighter budget. */
export const ROOT_BUDGET_BYTES = 6 * 1024;
export const NESTED_BUDGET_BYTES = 3 * 1024;

/**
 * Skill names the Paperclip runtime materializes. A repo skill sharing one of
 * these would shadow it, so the two namespaces must stay disjoint.
 */
export const RUNTIME_SKILL_NAMES = [
  "paperclip",
  "paperclip-create-agent",
  "paperclip-create-plugin",
  "para-memory-files",
];

/** A description shorter than this cannot route a decision to load the skill. */
const MIN_DESCRIPTION_LENGTH = 40;

const SKILLS_DIR = join(REPO_ROOT, ".agents", "skills");
const ROOT_AGENTS = join(REPO_ROOT, "AGENTS.md");
const SKILL_LOCK = join(REPO_ROOT, ".agents", "skill-lock.json");
const CATALOGUES = join(REPO_ROOT, ".agents", "catalogues.json");

/** Frontmatter keys, folded to single-line strings. */
export type Frontmatter = Record<string, string>;

/** One entry in `.agents/skill-lock.json`. */
export type SkillLockEntry = {
  source?: string;
  sourceUrl?: string;
  sourceRef?: string;
  forkedAt?: string;
};

export type SkillLock = {
  skills?: Record<string, SkillLockEntry>;
};

/**
 * One entry in `.agents/catalogues.json`: a shared package whose exports a
 * skill must list, so an agent can look one up before writing its own.
 */
export type PackageCatalogue = {
  /** The package directory, relative to the repo root (`packages/ui`). */
  packageDir?: string;
  /** The import specifier, used only in messages (`@scope/ui`). */
  importName?: string;
  skill?: string;
  /** A barrel, relative to the package, whose every value export is listed too. */
  barrel?: string;
};

export type CatalogueConfig = {
  catalogues?: PackageCatalogue[];
};

type AgentsFile = { path: string; budgetBytes: number };

// --------------------------------------------------------------------------
// Rules. Pure: they take plain data and return error strings.
// --------------------------------------------------------------------------

/**
 * Splits a leading `---` YAML block off a markdown file, folding indented
 * continuation lines into the key above them. Returns `null` when absent.
 */
export function readFrontmatter(markdown: string): Frontmatter | null {
  const normalized = markdown.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) return null;

  const end = normalized.indexOf("\n---", 4);
  if (end === -1) return null;

  const fields: Frontmatter = {};
  let currentKey: string | null = null;

  for (const line of normalized.slice(4, end).split("\n")) {
    const match = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);

    if (match) {
      currentKey = match[1];
      fields[currentKey] = match[2].trim();
      continue;
    }

    if (currentKey && /^\s+\S/.test(line)) {
      fields[currentKey] = `${fields[currentKey]} ${line.trim()}`.trim();
    }
  }

  return fields;
}

/** Strips a YAML block-scalar marker (`>-`, `|`) off a folded description. */
function plainDescription(value: string | undefined): string {
  return (value ?? "").replace(/^[>|][-+]?\s*/, "").trim();
}

/** Frontmatter is present, `name` matches the directory, `description` can route. */
export function checkSkillFrontmatter({
  skill,
  markdown,
}: {
  skill: string;
  markdown: string;
}): string[] {
  const frontmatter = readFrontmatter(markdown);
  if (!frontmatter) return [`${skill}: SKILL.md has no frontmatter block.`];

  const errors: string[] = [];

  if (frontmatter.name !== skill) {
    errors.push(
      `${skill}: frontmatter name is "${frontmatter.name ?? "(missing)"}", expected "${skill}".`
    );
  }

  const description = plainDescription(frontmatter.description);
  if (description.length < MIN_DESCRIPTION_LENGTH) {
    errors.push(
      `${skill}: description is missing or too short to route on (${description.length} chars, need ${MIN_DESCRIPTION_LENGTH}+).`
    );
  }

  return errors;
}

/** Repo skills must not shadow a runtime-supplied skill of the same name. */
export function checkRuntimeCollision(skill: string): string[] {
  if (!RUNTIME_SKILL_NAMES.includes(skill)) return [];

  return [
    `${skill}: collides with a Paperclip runtime skill of the same name.`,
  ];
}

/** Rule ids an index lists, as `` - `<id>` `` lines. */
export function listedRuleIds(markdown: string): Set<string> {
  const ids = new Set<string>();

  for (const match of markdown.matchAll(
    /^\s*-\s+`([a-z0-9]+(?:-[a-z0-9]+)+)`/gm
  )) {
    ids.add(match[1]);
  }

  return ids;
}

/** An index and its `rules/` directory must agree in both directions. */
export function checkRuleIndex({
  skill,
  markdown,
  ruleFiles,
}: {
  skill: string;
  markdown: string;
  ruleFiles: string[];
}): string[] {
  if (ruleFiles.length === 0) return [];

  const listed = listedRuleIds(markdown);
  const errors: string[] = [];

  for (const file of ruleFiles) {
    if (!listed.has(file)) {
      errors.push(
        `${skill}: rules/${file}.md exists but SKILL.md does not list \`${file}\`.`
      );
    }
  }

  for (const id of listed) {
    if (!ruleFiles.includes(id)) {
      errors.push(
        `${skill}: SKILL.md lists \`${id}\` but rules/${id}.md does not exist.`
      );
    }
  }

  return errors;
}

/** Skill directory names referenced anywhere in a markdown file. */
export function referencedSkills(markdown: string): Set<string> {
  const names = new Set<string>();

  for (const match of markdown.matchAll(/\.agents\/skills\/([a-z0-9-]+)\//g)) {
    names.add(match[1]);
  }

  return names;
}

/**
 * Every skill reaches the root table of contents, so a reader with no skill
 * listing still learns it exists. Dangling references are not this rule's job:
 * `checkSkillReferences` covers those across the whole tree.
 */
export function checkTableOfContents({
  markdown,
  skills,
}: {
  markdown: string;
  skills: string[];
}): string[] {
  const referenced = referencedSkills(markdown);

  return skills
    .filter((skill) => !referenced.has(skill))
    .map((skill) => `AGENTS.md does not reference .agents/skills/${skill}/.`);
}

/**
 * A skill path that resolves to nothing, in any file that points at one. Skills
 * cross-reference each other heavily, so checking only the root table would let
 * a rename leave every other pointer dangling with a green gate.
 */
export function checkSkillReferences({
  file,
  markdown,
  skills,
}: {
  file: string;
  markdown: string;
  skills: string[];
}): string[] {
  const errors: string[] = [];

  for (const name of referencedSkills(markdown)) {
    if (!skills.includes(name)) {
      errors.push(
        `${file} references .agents/skills/${name}/, which does not exist.`
      );
    }
  }

  return errors;
}

/** An `AGENTS.md` must stay within its byte budget. */
export function checkAgentsFile({
  path,
  sizeBytes,
  budgetBytes,
}: {
  path: string;
  sizeBytes: number;
  budgetBytes: number;
}): string[] {
  if (sizeBytes <= budgetBytes) return [];

  return [
    `${path} is ${sizeBytes} B, over its ${budgetBytes} B budget. Move the long-form content into a skill.`,
  ];
}

/** A tool link must be a real symlink to its target, not a placeholder or a copy. */
export function checkLink({
  link,
  inspection,
}: {
  link: string;
  inspection: Inspection;
}): string[] {
  if (inspection.state === "ok") return [];

  return [describeLinkProblem({ link, inspection })];
}

/** Every forked skill records where it came from, so an upgrade stays diffable. */
export function checkSkillLock({
  lock,
  skills,
}: {
  lock: SkillLock;
  skills: string[];
}): string[] {
  const errors: string[] = [];
  const required = ["source", "sourceUrl", "sourceRef", "forkedAt"] as const;

  for (const [name, entry] of Object.entries(lock.skills ?? {})) {
    if (!skills.includes(name)) {
      errors.push(
        `skill-lock.json has an entry for "${name}", which is not a skill.`
      );
      continue;
    }

    for (const field of required) {
      if (!entry[field]) {
        errors.push(`skill-lock.json entry "${name}" is missing "${field}".`);
      }
    }
  }

  return errors;
}

/** Every catalogue entry names its package, its import and an existing skill. */
export function checkCatalogueConfig({
  config,
  skills,
}: {
  config: CatalogueConfig;
  skills: string[];
}): string[] {
  const errors: string[] = [];

  for (const [index, entry] of (config.catalogues ?? []).entries()) {
    for (const field of ["packageDir", "importName", "skill"] as const) {
      if (!entry[field]) {
        errors.push(`catalogues.json entry ${index} is missing "${field}".`);
      }
    }

    if (entry.skill && !skills.includes(entry.skill)) {
      errors.push(
        `catalogues.json entry ${index} names "${entry.skill}", which is not a skill.`
      );
    }
  }

  return errors;
}

/**
 * Value names a barrel re-exports through `export { ... }`, aliases resolved
 * and `type` exports skipped. `export *` and declarations are not read, so a
 * catalogued barrel sticks to named re-exports.
 */
export function barrelExportNames(source: string): string[] {
  const names: string[] = [];

  for (const match of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const raw of match[1].split(",")) {
      const entry = raw.trim();
      if (!entry || entry.startsWith("type ")) continue;

      const alias = entry.split(/\s+as\s+/).pop();
      if (alias) names.push(alias);
    }
  }

  return names;
}

/**
 * Names the bullets of a skill's `Catalogue` section open with, a trailing
 * slash dropped: `` - `Card`, `cardClassName`: ... `` yields both. The section
 * runs to the next heading at its own level or above, so a nested heading
 * stays inside it. `null` when there is no such section.
 */
export function catalogueEntries(markdown: string): Set<string> | null {
  const entries = new Set<string>();
  let sectionLevel: number | null = null;
  let found = false;

  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const heading = /^(#+)\s+(.*)$/.exec(line);

    if (heading) {
      const level = heading[1].length;

      if (heading[2].trim() === "Catalogue") {
        sectionLevel = level;
        found = true;
      } else if (sectionLevel !== null && level <= sectionLevel) {
        sectionLevel = null;
      }

      continue;
    }

    if (sectionLevel === null) continue;

    const bullet = /^- ((?:`[^`]+`(?:, )?)+):/.exec(line);
    if (!bullet) continue;

    for (const name of bullet[1].matchAll(/`([^`]+)`/g)) {
      entries.add(name[1].replace(/\/$/, ""));
    }
  }

  return found ? entries : null;
}

/**
 * A skill's catalogue against the package it lists, in both directions: every
 * subpath (and every name the catalogued barrel exports) has an entry, and
 * every entry still names a real export. The second direction catches a
 * removal or a rename's old name, which would send the next agent looking for
 * something that is gone.
 */
export function checkPackageCatalogue({
  importName,
  skill,
  markdown,
  subpaths,
  barrelNames,
}: {
  importName: string;
  skill: string;
  markdown: string;
  subpaths: string[];
  barrelNames: string[];
}): string[] {
  const entries = catalogueEntries(markdown);

  if (entries === null) {
    return [`${skill} has no Catalogue section for ${importName}.`];
  }

  const errors: string[] = [];
  const subpathNames = subpaths
    .map((subpath) => subpath.replace(/^\.\//, ""))
    .filter((name) => name !== ".");

  for (const name of subpathNames) {
    if (!entries.has(name)) {
      errors.push(
        `${skill} does not list ${importName}/${name}; add an entry to its catalogue.`
      );
    }
  }

  for (const name of barrelNames) {
    if (!entries.has(name)) {
      errors.push(
        `${skill} does not list ${name} from ${importName}; add an entry to its catalogue.`
      );
    }
  }

  const exported = new Set([...subpathNames, ...barrelNames]);

  for (const name of entries) {
    if (!exported.has(name)) {
      errors.push(
        `${skill} lists ${name}, which ${importName} no longer exports; update or remove its catalogue entry.`
      );
    }
  }

  return errors;
}

// --------------------------------------------------------------------------
// Filesystem. Reads the tree and feeds the rules above.
// --------------------------------------------------------------------------

/** Every directory under `.agents/skills` is a skill named for its directory. */
function listSkills(): string[] | null {
  if (!existsSync(SKILLS_DIR)) return null;

  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Rule ids a skill ships, derived from `rules/*.md`. Empty when it has none. */
function listRuleFiles(skill: string): string[] {
  const rulesDir = join(SKILLS_DIR, skill, "rules");
  if (!existsSync(rulesDir)) return [];

  return readdirSync(rulesDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""))
    .sort();
}

/** The root `AGENTS.md` plus every nested one under a workspace directory. */
function listAgentsFiles(): AgentsFile[] {
  const root: AgentsFile[] = existsSync(ROOT_AGENTS)
    ? [{ path: ROOT_AGENTS, budgetBytes: ROOT_BUDGET_BYTES }]
    : [];

  const nested = listWorkspaceAgentsDirs().map((workspace) => ({
    path: join(REPO_ROOT, workspace, "AGENTS.md"),
    budgetBytes: NESTED_BUDGET_BYTES,
  }));

  return [...root, ...nested];
}

/**
 * Every markdown file that can carry a skill reference: the `AGENTS.md` set
 * plus the whole `.agents/` tree, which is where the skills, the roles and the
 * per-tool wrappers cross-reference each other.
 */
function listDocFiles(): string[] {
  const files = listAgentsFiles().map((entry) => entry.path);
  const agentsDir = join(REPO_ROOT, ".agents");

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(full);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".md")) files.push(full);
    }
  };

  if (existsSync(agentsDir)) walk(agentsDir);

  return files;
}

function repoPath(path: string): string {
  return toPosix(relative(REPO_ROOT, path));
}

/** Checks each catalogued package against its skill. Absent config means none. */
function checkCatalogues(skills: string[]): string[] {
  if (!existsSync(CATALOGUES)) return [];

  const config = JSON.parse(
    readFileSync(CATALOGUES, "utf8")
  ) as CatalogueConfig;
  const configErrors = checkCatalogueConfig({ config, skills });

  if (configErrors.length > 0) return configErrors;

  const errors: string[] = [];

  for (const entry of config.catalogues ?? []) {
    const { packageDir = "", importName = "", skill = "", barrel } = entry;
    const manifestPath = join(REPO_ROOT, packageDir, "package.json");
    const skillFile = join(SKILLS_DIR, skill, "SKILL.md");

    // A missing SKILL.md is already reported by the per-skill checks.
    if (!existsSync(skillFile)) continue;

    if (!existsSync(manifestPath)) {
      errors.push(
        `catalogues.json names ${packageDir}, which has no package.json.`
      );
      continue;
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      exports?: Record<string, unknown>;
    };
    const barrelPath = barrel ? join(REPO_ROOT, packageDir, barrel) : null;

    if (barrelPath && !existsSync(barrelPath)) {
      errors.push(
        `catalogues.json names ${packageDir}/${barrel}, which does not exist.`
      );
      continue;
    }

    errors.push(
      ...checkPackageCatalogue({
        importName,
        skill,
        markdown: readFileSync(skillFile, "utf8"),
        subpaths: Object.keys(manifest.exports ?? {}),
        barrelNames: barrelPath
          ? barrelExportNames(readFileSync(barrelPath, "utf8"))
          : [],
      })
    );
  }

  return errors;
}

function main(): void {
  const skills = listSkills();

  if (skills === null) {
    console.error(
      "agent docs validation failed: .agents/skills does not exist."
    );
    process.exit(1);
  }

  const errors: string[] = [];

  for (const skill of skills) {
    errors.push(...checkRuntimeCollision(skill));

    const skillFile = join(SKILLS_DIR, skill, "SKILL.md");

    if (!existsSync(skillFile)) {
      errors.push(`${skill}: no SKILL.md.`);
      continue;
    }

    const markdown = readFileSync(skillFile, "utf8");

    errors.push(...checkSkillFrontmatter({ skill, markdown }));
    errors.push(
      ...checkRuleIndex({ skill, markdown, ruleFiles: listRuleFiles(skill) })
    );
  }

  if (!existsSync(ROOT_AGENTS)) {
    errors.push("AGENTS.md does not exist at the repo root.");
  } else {
    errors.push(
      ...checkTableOfContents({
        markdown: readFileSync(ROOT_AGENTS, "utf8"),
        skills,
      })
    );
  }

  const docFiles = listDocFiles();

  for (const file of docFiles) {
    errors.push(
      ...checkSkillReferences({
        file: repoPath(file),
        markdown: readFileSync(file, "utf8"),
        skills,
      })
    );
  }

  const agentsFiles = listAgentsFiles();

  for (const { path, budgetBytes } of agentsFiles) {
    errors.push(
      ...checkAgentsFile({
        path: repoPath(path),
        sizeBytes: readFileSync(path).byteLength,
        budgetBytes,
      })
    );
  }

  const links = expectedLinks();

  for (const agentLink of links) {
    errors.push(
      ...checkLink({ link: agentLink.link, inspection: agentLink.inspect() })
    );
  }

  if (!existsSync(SKILL_LOCK)) {
    errors.push(".agents/skill-lock.json does not exist.");
  } else {
    const lock = JSON.parse(readFileSync(SKILL_LOCK, "utf8")) as SkillLock;
    errors.push(...checkSkillLock({ lock, skills }));
  }

  errors.push(...checkCatalogues(skills));

  if (errors.length > 0) {
    console.error(
      `agent docs validation failed with ${errors.length} error(s):\n`
    );
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  console.log(
    `agent docs OK: ${skills.length} skills, ${agentsFiles.length} AGENTS.md files, ${links.length} links, ${docFiles.length} files checked for skill references.`
  );
}

if (import.meta.main) main();
