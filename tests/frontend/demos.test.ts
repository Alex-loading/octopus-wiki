import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyDemoDraft, projectLink, resolveDemoLinks, splitDemoTags, validateDemoDraft } from "../../src/app/content/demos.ts";

test("project links accept deployments and repositories, and may be cleared", () => {
  assert.equal(projectLink(" https://example.com/app?q=1#demo "), "https://example.com/app?q=1#demo");
  assert.equal(projectLink("https://github.com/octopus/wiki"), "https://github.com/octopus/wiki");
  assert.equal(projectLink("http://localhost:3000"), "http://localhost:3000/");
  assert.equal(projectLink(" "), "");
  for (const url of ["javascript:alert(1)", "data:text/html,test", "//evil.example", "https://user:password@example.com", "https://", "https://exa mple.com", "https:\\evil.example"])
    assert.throws(() => projectLink(url), /项目链接/);
});

test("project writes normalize text, deduplicate tags, preserve visibility and clear links", () => {
  const draft = { ...emptyDemoDraft(), title: " 作品 ", description: " 简介 ", tags: ["React", " React ", ""], deploymentUrl: " ", githubUrl: " ", isPublic: false };
  const payload = validateDemoDraft(draft);
  assert.equal(payload.title, "作品");
  assert.equal(payload.description, "简介");
  assert.equal(payload.demo_url, null);
  assert.equal(payload.repo_url, null);
  assert.equal(payload.project_url, null);
  assert.equal(payload.is_public, false);
  assert.deepEqual(payload.tags, ["React"]);
  assert.deepEqual(splitDemoTags("React， TypeScript,React\nSVG"), ["React", "TypeScript", "SVG"]);
});

test("both link fields are optional and validation identifies the invalid field", () => {
  const draft = { ...emptyDemoDraft(), title: "作品", description: "简介" };
  for (const deploymentUrl of ["", "https://example.com/app"]) {
    for (const githubUrl of ["", "https://github.com/example/project"]) {
      const payload = validateDemoDraft({ ...draft, deploymentUrl, githubUrl });
      assert.equal(payload.demo_url, deploymentUrl || null);
      assert.equal(payload.repo_url, githubUrl || null);
      assert.equal(payload.project_url, null);
    }
  }
  assert.throws(() => validateDemoDraft({ ...draft, deploymentUrl: "javascript:alert(1)" }), /部署链接/);
  assert.throws(() => validateDemoDraft({ ...draft, githubUrl: "javascript:alert(1)" }), /GitHub 链接/);
});

test("legacy links are classified correctly and explicit fields take precedence", () => {
  assert.deepEqual(resolveDemoLinks({ project_url: "https://github.com/example/project" }), {
    deploymentUrl: "", githubUrl: "https://github.com/example/project",
  });
  for (const url of ["https://example.com/app", "https://example.github.io/project", "https://github.com.example.com/app"]) {
    assert.deepEqual(resolveDemoLinks({ project_url: url }), { deploymentUrl: url, githubUrl: "" });
  }
  assert.deepEqual(resolveDemoLinks({ demo_url: "https://example.com/app", repo_url: "https://github.com/example/new", project_url: "https://github.com/example/old" }), {
    deploymentUrl: "https://example.com/app", githubUrl: "https://github.com/example/new",
  });
  assert.deepEqual(resolveDemoLinks({ demo_url: null, repo_url: null, project_url: null }), { deploymentUrl: "", githubUrl: "" });
  assert.deepEqual(resolveDemoLinks({ demo_url: "javascript:alert(1)", repo_url: "data:text/html,test", project_url: "javascript:alert(1)" }), { deploymentUrl: "", githubUrl: "" });
});

test("invalid project fields are rejected before writing", () => {
  const draft = { ...emptyDemoDraft(), title: "作品", description: "简介" };
  for (const change of [
    { title: " " }, { description: "" }, { category: "x".repeat(41) },
    { status: "unknown" }, { date: "2026-13" }, { colors: ["red", "blue"] },
    { longDescription: "x".repeat(10001) }, { tags: ["x".repeat(51)] },
    { isPublic: "true" },
  ]) assert.throws(() => validateDemoDraft({ ...draft, ...change } as any));
});
