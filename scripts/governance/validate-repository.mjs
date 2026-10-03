import { access, readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");

const requiredFiles = [
  ".github/CODEOWNERS",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/bug-report.yml",
  ".github/ISSUE_TEMPLATE/product-change.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/dependabot.yml",
  "CONTRIBUTING.md",
  "NOTICE.md",
  "SECURITY.md",
  "docs/06-planning/REPOSITORY_GOVERNANCE.md",
];

const failures = [];

async function exists(relativePath) {
  try {
    await access(path.join(repositoryRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

for (const relativePath of requiredFiles) {
  if (!(await exists(relativePath))) {
    failures.push(`Missing required governance file: ${relativePath}`);
  }
}

if (await exists("NOTICE.md")) {
  const notice = (await read("NOTICE.md")).toLowerCase();
  if (!notice.includes("publicly visible") || !notice.includes("not") || !notice.includes("open source")) {
    failures.push("NOTICE.md must state that the publicly visible repository is not open source.");
  }
}

if (await exists("CONTRIBUTING.md")) {
  const contributing = (await read("CONTRIBUTING.md")).toLowerCase();
  if (!contributing.includes("automation must never delete unrelated branches")) {
    failures.push("CONTRIBUTING.md must prohibit automation from deleting unrelated branches.");
  }
  if (!contributing.includes("partial work must remain open")) {
    failures.push("CONTRIBUTING.md must require partial work to remain open and documented.");
  }
}

if (await exists(".github/CODEOWNERS")) {
  const codeowners = await read(".github/CODEOWNERS");
  if (!codeowners.includes("/.github/ @Ankit6149")) {
    failures.push("CODEOWNERS must assign repository automation and governance ownership.");
  }
}

const workflowsDirectory = path.join(repositoryRoot, ".github/workflows");
if (await exists(".github/workflows/repository-finalization.yml")) {
  failures.push("The destructive repository-finalization workflow must not exist.");
}

if (await exists(".github/workflows")) {
  const workflowFiles = (await readdir(workflowsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => entry.name);

  for (const workflowFile of workflowFiles) {
    const relativePath = `.github/workflows/${workflowFile}`;
    const content = await read(relativePath);
    const deletesBranches = /git\s+push\s+origin\s+--delete/i.test(content);
    const enumeratesAllBranches = /git\s+ls-remote\s+--heads/i.test(content);

    if (deletesBranches && enumeratesAllBranches) {
      failures.push(`${relativePath} enumerates and deletes remote branches; use GitHub post-merge head deletion instead.`);
    }
  }

  const cleanupWorkflow = await read('.github/workflows/branch-cleanup.yml');
  for (const marker of [
    'gh api --paginate',
    'pulls?state=open',
    'grep -Fqx -- "$branch" "$protected_refs"',
    'sort -u > "$RUNNER_TEMP/open-pr-current.txt"',
    'git merge-base --is-ancestor "$expected_sha" "origin/$default_branch"',
    'git push --force-with-lease="refs/heads/$branch:$expected_sha" origin ":refs/heads/$branch"',
    "--format='%(refname:strip=3)%09%(objectname)'",
  ]) {
    if (!cleanupWorkflow.includes(marker)) {
      failures.push(`Branch cleanup is missing a current-head safety check: ${marker}`);
    }
  }
  if (/audited_delete|is_audited_for_deletion|permanently approved branch/i.test(cleanupWorkflow)) {
    failures.push('Branch cleanup must not delete by static branch-name approval.');
  }
  if (!/pull-requests:\s*read/.test(cleanupWorkflow) || !/contents:\s*write/.test(cleanupWorkflow)) {
    failures.push('Branch cleanup must use only pull-request read and branch-content write permissions.');
  }

  const branchSafetyTest = await read('scripts/governance/test-branch-cleanup-safety.mjs');
  if (!branchSafetyTest.includes('force-with-lease') || !branchSafetyTest.includes("'--is-ancestor'")) {
    failures.push('Branch cleanup safety fixture must exercise Git ancestry and stale-head leases.');
  }
  const branchSafetyResult = spawnSync(process.execPath, ['scripts/governance/test-branch-cleanup-safety.mjs'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (branchSafetyResult.status !== 0) {
    failures.push(`Branch cleanup safety fixture failed: ${(branchSafetyResult.stderr || branchSafetyResult.stdout).trim()}`);
  }
}

if (failures.length > 0) {
  console.error("Repository governance validation failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Repository governance validation passed.");
