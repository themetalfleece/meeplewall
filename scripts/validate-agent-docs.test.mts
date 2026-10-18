import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NESTED_BUDGET_BYTES,
  ROOT_BUDGET_BYTES,
  barrelExportNames,
  catalogueEntries,
  checkAgentsFile,
  checkCatalogueConfig,
  checkLink,
  checkPackageCatalogue,
  checkRuleIndex,
  checkRuntimeCollision,
  checkSkillFrontmatter,
  checkSkillLock,
  checkSkillReferences,
  checkTableOfContents,
  listedRuleIds,
  readFrontmatter,
  referencedSkills,
} from "./validate-agent-docs.mts";

const VALID_DESCRIPTION =
  "A description long enough for an agent to route a load decision on it.";

function skillMarkdown({
  name = "testing",
  description = VALID_DESCRIPTION,
  body = "# Testing\n",
} = {}) {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`;
}

describe("readFrontmatter", () => {
  it("returns null when the file has no frontmatter block", () => {
    assert.equal(readFrontmatter("# Just a heading\n"), null);
  });

  it("returns null when the opening delimiter is never closed", () => {
    assert.equal(readFrontmatter("---\nname: testing\n"), null);
  });

  it("reads simple key/value pairs", () => {
    assert.deepEqual(readFrontmatter(skillMarkdown()), {
      name: "testing",
      description: VALID_DESCRIPTION,
    });
  });

  it("folds indented continuation lines into the key above them", () => {
    const markdown =
      "---\nname: testing\ndescription: >-\n  First line.\n  Second line.\n---\n";

    assert.equal(
      readFrontmatter(markdown)?.description,
      ">- First line. Second line."
    );
  });

  it("reads a file checked out with CRLF line endings", () => {
    const markdown = skillMarkdown().replaceAll("\n", "\r\n");

    assert.equal(readFrontmatter(markdown)?.name, "testing");
  });

  it("ignores an empty body", () => {
    assert.deepEqual(readFrontmatter("---\n\n---\n"), {});
  });
});

describe("checkSkillFrontmatter", () => {
  it("passes a well-formed skill", () => {
    assert.deepEqual(
      checkSkillFrontmatter({ skill: "testing", markdown: skillMarkdown() }),
      []
    );
  });

  it("flags a missing frontmatter block", () => {
    const errors = checkSkillFrontmatter({
      skill: "testing",
      markdown: "# Testing\n",
    });

    assert.equal(errors.length, 1);
    assert.match(errors[0], /no frontmatter block/);
  });

  it("flags a name that does not match the directory", () => {
    const errors = checkSkillFrontmatter({
      skill: "testing",
      markdown: skillMarkdown({ name: "tests" }),
    });

    assert.match(
      errors.join(" "),
      /frontmatter name is "tests", expected "testing"/
    );
  });

  it("flags a missing name", () => {
    const errors = checkSkillFrontmatter({
      skill: "testing",
      markdown: `---\ndescription: ${VALID_DESCRIPTION}\n---\n`,
    });

    assert.match(errors.join(" "), /\(missing\)/);
  });

  it("flags a description too short to route on", () => {
    const errors = checkSkillFrontmatter({
      skill: "testing",
      markdown: skillMarkdown({ description: "Tests." }),
    });

    assert.match(errors.join(" "), /too short to route on/);
  });

  it("measures a folded description without its block-scalar marker", () => {
    const markdown = `---\nname: testing\ndescription: >-\n  ${VALID_DESCRIPTION}\n---\n`;

    assert.deepEqual(checkSkillFrontmatter({ skill: "testing", markdown }), []);
  });
});

describe("checkRuntimeCollision", () => {
  it("allows a repo skill name", () => {
    assert.deepEqual(checkRuntimeCollision("agent-paperclip"), []);
  });

  it("flags a name the Paperclip runtime already supplies", () => {
    assert.match(
      checkRuntimeCollision("paperclip").join(" "),
      /collides with a Paperclip runtime skill/
    );
  });
});

describe("listedRuleIds", () => {
  it("collects ids from bulleted backtick entries", () => {
    const markdown =
      "- `no-switch` - do not\n- `object-params` - use one object\n";

    assert.deepEqual(
      [...listedRuleIds(markdown)],
      ["no-switch", "object-params"]
    );
  });

  it("ignores single-word backticks, which are not rule ids", () => {
    assert.deepEqual(
      [...listedRuleIds("- `switch` - a keyword, not a rule id\n")],
      []
    );
  });

  it("ignores backticks that are not the start of a list item", () => {
    assert.deepEqual([...listedRuleIds("See `no-switch` for detail.\n")], []);
  });
});

describe("checkRuleIndex", () => {
  const markdown =
    "- `no-switch` - do not\n- `object-params` - use one object\n";

  it("passes when the index and the rule files agree", () => {
    assert.deepEqual(
      checkRuleIndex({
        skill: "typescript-style",
        markdown,
        ruleFiles: ["no-switch", "object-params"],
      }),
      []
    );
  });

  it("skips a skill with no rules directory", () => {
    assert.deepEqual(
      checkRuleIndex({
        skill: "testing",
        markdown: "# no rules\n",
        ruleFiles: [],
      }),
      []
    );
  });

  it("flags a rule file the index does not list", () => {
    const errors = checkRuleIndex({
      skill: "typescript-style",
      markdown,
      ruleFiles: ["no-switch", "object-params", "orphan-rule"],
    });

    assert.match(
      errors.join(" "),
      /rules\/orphan-rule\.md exists but SKILL\.md does not list/
    );
  });

  it("flags an index entry with no rule file", () => {
    const errors = checkRuleIndex({
      skill: "typescript-style",
      markdown,
      ruleFiles: ["no-switch"],
    });

    assert.match(
      errors.join(" "),
      /lists `object-params` but rules\/object-params\.md does not exist/
    );
  });
});

describe("referencedSkills", () => {
  it("extracts skill names from table-of-contents paths", () => {
    const markdown =
      "Read `.agents/skills/testing/SKILL.md` and `.agents/skills/agent-git-policy/SKILL.md`.";

    assert.deepEqual([...referencedSkills(markdown)].sort(), [
      "agent-git-policy",
      "testing",
    ]);
  });

  it("returns nothing when no skill is referenced", () => {
    assert.deepEqual([...referencedSkills("# A heading\n")], []);
  });
});

describe("checkTableOfContents", () => {
  it("passes when both directions agree", () => {
    const markdown = ".agents/skills/testing/ and .agents/skills/nextjs/";

    assert.deepEqual(
      checkTableOfContents({ markdown, skills: ["nextjs", "testing"] }),
      []
    );
  });

  it("flags a skill missing from the table of contents", () => {
    const errors = checkTableOfContents({
      markdown: ".agents/skills/testing/",
      skills: ["nextjs", "testing"],
    });

    assert.deepEqual(errors, [
      "AGENTS.md does not reference .agents/skills/nextjs/.",
    ]);
  });

  it("leaves a dangling reference to checkSkillReferences", () => {
    const errors = checkTableOfContents({
      markdown: ".agents/skills/removed-skill/ and .agents/skills/testing/",
      skills: ["testing"],
    });

    assert.deepEqual(errors, []);
  });
});

describe("checkSkillReferences", () => {
  it("passes when every reference resolves", () => {
    const errors = checkSkillReferences({
      file: ".agents/README.md",
      markdown: ".agents/skills/testing/SKILL.md and .agents/skills/nextjs/",
      skills: ["nextjs", "testing"],
    });

    assert.deepEqual(errors, []);
  });

  it("flags a reference that resolves to nothing, naming the file", () => {
    const errors = checkSkillReferences({
      file: "packages/ui/AGENTS.md",
      markdown: "See `.agents/skills/removed-skill/SKILL.md`.",
      skills: ["testing"],
    });

    assert.deepEqual(errors, [
      "packages/ui/AGENTS.md references .agents/skills/removed-skill/, which does not exist.",
    ]);
  });

  it("catches a dangling reference outside the root table of contents", () => {
    const errors = checkSkillReferences({
      file: ".agents/skills/agent-review-loop/SKILL.md",
      markdown: "How to review is in `.agents/skills/agent-code-review/`.",
      skills: ["agent-review-loop"],
    });

    assert.equal(errors.length, 1);
  });

  it("does not treat a placeholder path as a skill", () => {
    const errors = checkSkillReferences({
      file: ".agents/README.md",
      markdown: "Add a row referencing `.agents/skills/<name>/`.",
      skills: [],
    });

    assert.deepEqual(errors, []);
  });
});

describe("checkAgentsFile", () => {
  const base = {
    path: "AGENTS.md",
    sizeBytes: 100,
    budgetBytes: ROOT_BUDGET_BYTES,
  };

  it("passes a file under its budget", () => {
    assert.deepEqual(checkAgentsFile(base), []);
  });

  it("flags a file over its budget", () => {
    const errors = checkAgentsFile({
      ...base,
      sizeBytes: ROOT_BUDGET_BYTES + 1,
    });

    assert.match(
      errors.join(" "),
      new RegExp(`over its ${ROOT_BUDGET_BYTES} B budget`)
    );
  });

  it("applies the tighter nested budget to a nested file", () => {
    const errors = checkAgentsFile({
      path: "apps/web/AGENTS.md",
      sizeBytes: NESTED_BUDGET_BYTES + 1,
      budgetBytes: NESTED_BUDGET_BYTES,
    });

    assert.match(
      errors.join(" "),
      new RegExp(`over its ${NESTED_BUDGET_BYTES} B budget`)
    );
  });

  it("accepts a file exactly at its budget", () => {
    assert.deepEqual(
      checkAgentsFile({ ...base, sizeBytes: ROOT_BUDGET_BYTES }),
      []
    );
  });
});

describe("checkLink", () => {
  it("passes a correct link", () => {
    assert.deepEqual(
      checkLink({
        link: "CLAUDE.md",
        inspection: { state: "ok", wanted: "AGENTS.md" },
      }),
      []
    );
  });

  it("reports a broken link with the command that fixes it", () => {
    const errors = checkLink({
      link: "CLAUDE.md",
      inspection: { state: "missing", wanted: "AGENTS.md" },
    });

    assert.equal(errors.length, 1);
    assert.match(errors[0], /node scripts\/link-agent-config\.mts/);
  });
});

describe("checkSkillLock", () => {
  const entry = {
    source: "cursor/plugins",
    sourceUrl: "https://github.com/cursor/plugins",
    sourceRef: "70b2dc8",
    forkedAt: "2026-09-28",
  };

  it("passes a complete entry for a real skill", () => {
    assert.deepEqual(
      checkSkillLock({
        lock: { skills: { "writing-style": entry } },
        skills: ["writing-style"],
      }),
      []
    );
  });

  it("tolerates a lock with no skills at all", () => {
    assert.deepEqual(
      checkSkillLock({ lock: {}, skills: ["writing-style"] }),
      []
    );
  });

  it("flags an entry for a skill that does not exist", () => {
    const errors = checkSkillLock({
      lock: { skills: { removed: entry } },
      skills: [],
    });

    assert.match(errors.join(" "), /entry for "removed", which is not a skill/);
  });

  it("flags every missing provenance field", () => {
    const errors = checkSkillLock({
      lock: { skills: { "writing-style": { source: "x" } } },
      skills: ["writing-style"],
    });

    assert.equal(errors.length, 3);
    assert.match(errors.join(" "), /sourceUrl/);
    assert.match(errors.join(" "), /sourceRef/);
    assert.match(errors.join(" "), /forkedAt/);
  });
});

describe("checkCatalogueConfig", () => {
  const entry = {
    packageDir: "packages/ui",
    importName: "@scope/ui",
    skill: "ui-primitives",
  };

  it("passes a complete entry for a real skill", () => {
    assert.deepEqual(
      checkCatalogueConfig({
        config: { catalogues: [entry] },
        skills: ["ui-primitives"],
      }),
      []
    );
  });

  it("tolerates a config with no catalogues", () => {
    assert.deepEqual(checkCatalogueConfig({ config: {}, skills: [] }), []);
  });

  it("flags every missing field", () => {
    const errors = checkCatalogueConfig({
      config: { catalogues: [{}] },
      skills: [],
    });

    assert.equal(errors.length, 3);
    assert.match(errors.join(" "), /packageDir/);
    assert.match(errors.join(" "), /importName/);
    assert.match(errors.join(" "), /skill/);
  });

  it("flags a skill that does not exist", () => {
    const errors = checkCatalogueConfig({
      config: { catalogues: [entry] },
      skills: [],
    });

    assert.match(errors.join(" "), /"ui-primitives", which is not a skill/);
  });
});

describe("barrelExportNames", () => {
  it("reads named re-exports, resolving aliases and skipping types", () => {
    const source = [
      'export { useMounted, useMeasure } from "./useMounted";',
      'export { latest as useLatest } from "./latest";',
      'export { type MeasureResult } from "./types";',
    ].join("\n");

    assert.deepEqual(barrelExportNames(source), [
      "useMounted",
      "useMeasure",
      "useLatest",
    ]);
  });

  it("returns nothing for a file with no named re-exports", () => {
    assert.deepEqual(barrelExportNames('export * from "./all";'), []);
  });
});

describe("catalogueEntries", () => {
  it("collects every backticked name a bullet opens with", () => {
    const markdown = [
      "## Catalogue",
      "",
      "- `Card`, `cardClassName`: a surfaced container.",
      "- `format/`: codecs.",
      "- Not an entry, no leading name.",
    ].join("\n");

    assert.deepEqual(
      catalogueEntries(markdown),
      new Set(["Card", "cardClassName", "format"])
    );
  });

  it("keeps a nested heading inside the section and stops at a sibling", () => {
    const markdown = [
      "## Catalogue",
      "- `hooks/`: the hooks below.",
      "### Hooks",
      "- `useMounted`: true once hydrated.",
      "## Rules",
      "- `Box`: not a catalogue entry.",
    ].join("\n");

    assert.deepEqual(
      catalogueEntries(markdown),
      new Set(["hooks", "useMounted"])
    );
  });

  it("reads CRLF files the same as LF ones", () => {
    const markdown = "## Catalogue\r\n- `Card`: a container.\r\n";

    assert.deepEqual(catalogueEntries(markdown), new Set(["Card"]));
  });

  it("returns null when the skill has no Catalogue section", () => {
    assert.equal(catalogueEntries("## Rules\n- `Box`: layout."), null);
  });
});

describe("checkPackageCatalogue", () => {
  const markdown = [
    "## Catalogue",
    "- `Card`: a container.",
    "- `useMounted`: true once hydrated.",
  ].join("\n");

  function check({
    subpaths = ["./Card"],
    barrelNames = ["useMounted"],
    body = markdown,
  } = {}) {
    return checkPackageCatalogue({
      importName: "@scope/ui",
      skill: "ui-primitives",
      markdown: body,
      subpaths,
      barrelNames,
    });
  }

  it("passes when the catalogue and the exports match exactly", () => {
    assert.deepEqual(check(), []);
  });

  it("ignores the package root export", () => {
    assert.deepEqual(check({ subpaths: [".", "./Card"] }), []);
  });

  it("flags a subpath with no entry", () => {
    assert.deepEqual(check({ subpaths: ["./Card", "./Modal"] }), [
      "ui-primitives does not list @scope/ui/Modal; add an entry to its catalogue.",
    ]);
  });

  it("flags a barrel export with no entry", () => {
    assert.deepEqual(check({ barrelNames: ["useMounted", "useMeasure"] }), [
      "ui-primitives does not list useMeasure from @scope/ui; add an entry to its catalogue.",
    ]);
  });

  it("flags an entry the package no longer exports", () => {
    assert.deepEqual(check({ subpaths: [] }), [
      "ui-primitives lists Card, which @scope/ui no longer exports; update or remove its catalogue entry.",
    ]);
  });

  it("flags a skill with no Catalogue section", () => {
    assert.deepEqual(check({ body: "## Rules\n" }), [
      "ui-primitives has no Catalogue section for @scope/ui.",
    ]);
  });
});
