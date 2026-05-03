import { readFileSync, writeFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { normalizeName } from "./lib/names.js";
import { SLUG_ALIASES } from "./lib/aliases.js";

// --- Load graph.json to validate slugs ---

const graph = JSON.parse(readFileSync("src/data/graph.json", "utf-8"));
const knownSlugs = new Set<string>(Object.keys(graph.students));

// --- Parse CSV ---

const csv = readFileSync("data/raw/teaching.csv", "utf-8");
const records: string[][] = parse(csv, {
  columns: false,
  skip_empty_lines: true,
  from_line: 2,
  relax_column_count: true,
});

// --- Name resolution ---

function resolveSlug(rawName: string): string | null {
  const normalized = normalizeName(rawName);
  const slug = SLUG_ALIASES[normalized.slug] ?? normalized.slug;
  return knownSlugs.has(slug) ? slug : null;
}

function parseNameField(field: string): { rawName: string; slug: string } | null {
  const match = field.trim().match(/^(.+?)\s*\([^)]+\)\s*$/);
  if (!match) return null;
  const rawName = match[1].trim();
  const slug = resolveSlug(rawName);
  if (!slug) return null;
  return { rawName, slug };
}

function parseTeacherList(field: string): Array<{ rawName: string; slug: string | null }> {
  if (!field || !field.trim()) return [];

  // Split on "), " to handle commas inside parentheses.
  // Each teacher entry is "Name (Olympiad Year, Olympiad Year)".
  const chunks = field.split("), ");
  const results: Array<{ rawName: string; slug: string | null }> = [];

  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i].trim();
    if (i < chunks.length - 1) chunk += ")";

    const match = chunk.match(/^(.+?)\s*\([^)]+\)\s*$/);
    if (!match) continue;

    const rawName = match[1].trim();
    const slug = resolveSlug(rawName);
    results.push({ rawName, slug });
  }

  return results;
}

// --- Process rows ---

interface TeachingEdge {
  teacher: string;
  student: string;
}

const edges: TeachingEdge[] = [];
const warnings: string[] = [];
const respondents = new Set<string>();

for (const record of records) {
  const [, respondentRaw, teachersRaw] = record;

  const respondent = parseNameField(respondentRaw);
  if (!respondent) {
    const name = respondentRaw?.trim().match(/^(.+?)\s*\(/)?.[1] ?? respondentRaw;
    warnings.push(`Respondent not in graph: "${name}"`);
    continue;
  }

  respondents.add(respondent.slug);

  const teachers = parseTeacherList(teachersRaw);
  for (const teacher of teachers) {
    if (!teacher.slug) {
      warnings.push(`Teacher not in graph: "${teacher.rawName}" (listed by ${respondent.rawName})`);
      continue;
    }
    if (teacher.slug === respondent.slug) {
      warnings.push(`Self-loop skipped: "${teacher.rawName}" listed themselves as teacher`);
      continue;
    }
    edges.push({ teacher: teacher.slug, student: respondent.slug });
  }
}

// --- Deduplicate and sort ---

const seen = new Set<string>();
const uniqueEdges: TeachingEdge[] = [];
for (const e of edges) {
  const key = `${e.teacher}|${e.student}`;
  if (seen.has(key)) continue;
  seen.add(key);
  uniqueEdges.push(e);
}

uniqueEdges.sort(
  (a, b) => a.teacher.localeCompare(b.teacher) || a.student.localeCompare(b.student)
);

// --- Write output ---

const output = {
  edges: uniqueEdges,
  metadata: {
    generatedAt: new Date().toISOString(),
    edgeCount: uniqueEdges.length,
    respondentCount: respondents.size,
  },
};

writeFileSync("src/data/teaching.json", JSON.stringify(output, null, 2));
console.log(
  `Teaching graph: ${output.metadata.respondentCount} respondents, ${output.metadata.edgeCount} edges`
);

if (warnings.length > 0) {
  console.warn(`\n⚠ ${warnings.length} warning(s):`);
  for (const w of warnings) console.warn(`  ${w}`);
}

// --- Stats ---

const allPeople = new Set([...uniqueEdges.map((e) => e.teacher), ...uniqueEdges.map((e) => e.student)]);
console.log(`\n${allPeople.size} unique people in teaching graph`);
