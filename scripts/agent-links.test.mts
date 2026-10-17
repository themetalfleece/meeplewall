import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AgentLink,
  classifyLink,
  describeLinkProblem,
  isSafeToWrite,
} from "./agent-links.mts";

describe("AgentLink.wanted", () => {
  it("is the target itself for a link at the repo root", () => {
    const agentLink = new AgentLink({ link: "CLAUDE.md", target: "AGENTS.md" });

    assert.equal(agentLink.wanted, "AGENTS.md");
  });

  it("is relative to the link's directory, with forward slashes", () => {
    const agentLink = new AgentLink({
      link: ".claude/settings.json",
      target: ".agents/wrappers/claude/settings.json",
    });

    assert.equal(agentLink.wanted, "../.agents/wrappers/claude/settings.json");
  });
});

describe("classifyLink", () => {
  const wanted = "../.agents/skills";

  it("reports a missing path", () => {
    assert.equal(
      classifyLink({ wanted, entry: { kind: "missing" } }).state,
      "missing"
    );
  });

  it("accepts a symlink with the wanted target", () => {
    assert.equal(
      classifyLink({ wanted, entry: { kind: "symlink", target: wanted } })
        .state,
      "ok"
    );
  });

  it("accepts a Windows symlink whose target reads back with backslashes", () => {
    const entry = { kind: "symlink" as const, target: "..\\.agents\\skills" };

    assert.equal(classifyLink({ wanted, entry }).state, "ok");
  });

  it("reports a symlink pointing elsewhere, with its actual target", () => {
    const inspection = classifyLink({
      wanted,
      entry: { kind: "symlink", target: "../skills" },
    });

    assert.deepEqual(inspection, {
      state: "wrong-target",
      wanted,
      actual: "../skills",
    });
  });

  it("recognises the placeholder git writes when core.symlinks is false", () => {
    assert.equal(
      classifyLink({ wanted, entry: { kind: "file", text: wanted } }).state,
      "placeholder"
    );
  });

  it("treats a file with real content as not a symlink", () => {
    const entry = {
      kind: "file" as const,
      text: "# CLAUDE.md\n\nSee AGENTS.md",
    };

    assert.equal(classifyLink({ wanted, entry }).state, "not-a-symlink");
  });

  it("treats a file too large to read as not a symlink", () => {
    assert.equal(
      classifyLink({ wanted, entry: { kind: "file", text: null } }).state,
      "not-a-symlink"
    );
  });

  it("treats a real directory as not a symlink", () => {
    assert.equal(
      classifyLink({ wanted, entry: { kind: "directory" } }).state,
      "not-a-symlink"
    );
  });
});

describe("isSafeToWrite", () => {
  it("writes over a missing path or a placeholder", () => {
    assert.equal(isSafeToWrite("missing"), true);
    assert.equal(isSafeToWrite("placeholder"), true);
  });

  it("leaves a real file and a link pointing elsewhere to --override", () => {
    assert.equal(isSafeToWrite("not-a-symlink"), false);
    assert.equal(isSafeToWrite("wrong-target"), false);
  });
});

describe("describeLinkProblem", () => {
  it("names the override flag only where it is needed", () => {
    const placeholder = describeLinkProblem({
      link: "CLAUDE.md",
      inspection: { state: "placeholder", wanted: "AGENTS.md" },
    });
    const regularFile = describeLinkProblem({
      link: "CLAUDE.md",
      inspection: { state: "not-a-symlink", wanted: "AGENTS.md" },
    });

    assert.doesNotMatch(placeholder, /--override/);
    assert.match(regularFile, /--override/);
  });

  it("names both targets for a link pointing elsewhere", () => {
    const message = describeLinkProblem({
      link: "CLAUDE.md",
      inspection: {
        state: "wrong-target",
        wanted: "AGENTS.md",
        actual: "../AGENTS.md",
      },
    });

    assert.match(message, /points at \.\.\/AGENTS\.md, expected AGENTS\.md/);
  });
});
