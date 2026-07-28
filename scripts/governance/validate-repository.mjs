import { access, readFile, readdir } from "node:fs/promises";
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
}

if (failures.length > 0) {
  console.error("Repository governance validation failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Repository governance validation passed.");
