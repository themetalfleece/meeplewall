#!/usr/bin/env node
/**
 * Links the tool-specific config paths to the single source of truth in
 * `.agents/`. Each tool reads a different path for the same content, so the
 * content lives once and every tool gets a symlink to it.
 *
 * Usage:
 *   node scripts/link-agent-config.mts            link every tool, skip correct links
 *   node scripts/link-agent-config.mts --check    report drift, write nothing
 *   node scripts/link-agent-config.mts --override replace files and wrong links too
 *   node scripts/link-agent-config.mts claude     limit to one tool
 *
 * A missing link, or a git placeholder file holding the link text, is always
 * written. A real file or a link pointing elsewhere needs `--override`.
 */
import {
  TOOL_LINKS,
  describeLinkProblem,
  expectedLinks,
  isSafeToWrite,
} from "./agent-links.mts";

function main(): void {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const override = args.includes("--override");
  const tools = args.filter((arg) => !arg.startsWith("--"));

  const selected = tools.length > 0 ? tools : Object.keys(TOOL_LINKS);
  const unknown = selected.filter((tool) => !(tool in TOOL_LINKS));

  if (unknown.length > 0) {
    console.error(
      `Unknown tool(s): ${unknown.join(", ")}. Known: ${Object.keys(TOOL_LINKS).join(", ")}`
    );
    process.exit(1);
  }

  const links = expectedLinks(selected);
  const problems: string[] = [];
  let written = 0;

  for (const agentLink of links) {
    const inspection = agentLink.inspect();

    if (inspection.state === "ok") continue;

    const blocked = !isSafeToWrite(inspection.state) && !override;

    if (check || blocked) {
      problems.push(describeLinkProblem({ link: agentLink.link, inspection }));
      continue;
    }

    agentLink.write();
    written += 1;
    console.log(`linked ${agentLink.link} -> ${agentLink.wanted}`);
  }

  if (problems.length > 0) {
    console.error(`\n${problems.length} link problem(s):`);
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }

  console.log(
    check
      ? `All ${links.length} agent config links are correct.`
      : `${written} link(s) written, ${links.length} total.`
  );
}

main();
