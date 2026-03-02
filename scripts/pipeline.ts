import { execSync } from "child_process";

const steps = [
  { name: "IPhO unofficial", cmd: "npx tsx scripts/scrapers/ipho-unofficial.ts" },
  { name: "IPhO supplementary", cmd: "npx tsx scripts/scrapers/ipho-supplementary.ts" },
  { name: "EuPhO PDFs", cmd: "npx tsx scripts/scrapers/eupho-pdfs.ts" },
  { name: "Build graph", cmd: "npx tsx scripts/build-graph.ts" },
];

for (const step of steps) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Running: ${step.name}`);
  console.log("=".repeat(60));
  execSync(step.cmd, { stdio: "inherit" });
}

console.log("\nPipeline complete!");
