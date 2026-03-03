import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { normalizeName } from "./lib/names.js";
import { SLUG_ALIASES, PREFERRED_NAMES } from "./lib/aliases.js";
import type { ScrapedEntry, OlympiadId, Medal } from "./lib/types.js";
import { validateGraph } from "./validate.js";

// --- Load raw data ---

function loadJSON<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8"));
}

const iphoMain = loadJSON<ScrapedEntry[]>("data/raw/ipho-unofficial.json");
const iphoSupp = loadJSON<ScrapedEntry[]>("data/raw/ipho-supplementary.json");
const eupho = loadJSON<ScrapedEntry[]>("data/raw/eupho-pdfs.json");
const oibf = loadJSON<ScrapedEntry[]>("data/raw/oibf.json");

console.log(
  `Loaded: ${iphoMain.length} ipho-main, ${iphoSupp.length} ipho-supp, ${eupho.length} eupho, ${oibf.length} oibf`
);

// --- Merge all entries ---

const allEntries: ScrapedEntry[] = [...iphoMain, ...iphoSupp, ...eupho, ...oibf];

// --- Deduplicate and build student records ---

interface Participation {
  olympiad: OlympiadId;
  year: number;
  medal: Medal;
}

interface StudentRecord {
  id: string;
  name: string;
  searchKey: string;
  participations: Participation[];
}

const studentsBySlug = new Map<
  string,
  {
    displayName: string;
    searchKey: string;
    slug: string;
    participations: Map<string, Participation>; // key: "olympiad-year"
  }
>();

for (const entry of allEntries) {
  const normalized = normalizeName(entry.rawName);
  const rawSlug = normalized.slug;
  // Resolve alias to canonical slug
  const slug = SLUG_ALIASES[rawSlug] ?? rawSlug;
  const displayName = PREFERRED_NAMES[slug] ?? normalized.displayName;
  const searchKey = normalizeName(displayName).searchKey;
  const partKey = `${entry.olympiadId}-${entry.year}`;

  let student = studentsBySlug.get(slug);
  if (!student) {
    student = {
      displayName,
      searchKey,
      slug,
      participations: new Map(),
    };
    studentsBySlug.set(slug, student);
  }

  // Prefer names with diacritics (unless PREFERRED_NAMES already set one)
  if (!(slug in PREFERRED_NAMES)) {
    if (hasAccents(displayName) && !hasAccents(student.displayName)) {
      student.displayName = displayName;
      student.searchKey = searchKey;
    }
  }

  const existing = student.participations.get(partKey);
  if (existing) {
    // Merge: prefer non-null medal, prefer ipho-unofficial medal data
    if (!existing.medal && entry.medal) {
      existing.medal = entry.medal;
    }
  } else {
    student.participations.set(partKey, {
      olympiad: entry.olympiadId,
      year: entry.year,
      medal: entry.medal,
    });
  }
}

function hasAccents(name: string): boolean {
  return /[À-ÖØ-öø-ÿ]/.test(name);
}

// --- Build graph ---

const students: Record<string, StudentRecord> = {};

for (const [slug, student] of studentsBySlug) {
  students[slug] = {
    id: slug,
    name: student.displayName,
    searchKey: student.searchKey,
    participations: [...student.participations.values()].sort(
      (a, b) => a.year - b.year || a.olympiad.localeCompare(b.olympiad)
    ),
  };
}

// Build edges: for each (olympiad, year), connect every pair of students
interface Edge {
  source: string;
  target: string;
  olympiad: OlympiadId;
  year: number;
}

const teamMap = new Map<string, string[]>(); // "olympiad-year" -> student IDs

for (const [slug, student] of studentsBySlug) {
  for (const part of student.participations.values()) {
    const key = `${part.olympiad}-${part.year}`;
    let team = teamMap.get(key);
    if (!team) {
      team = [];
      teamMap.set(key, team);
    }
    team.push(slug);
  }
}

const edges: Edge[] = [];

for (const [key, team] of teamMap) {
  const [olympiad, yearStr] = key.split("-");
  const year = parseInt(yearStr, 10);

  // Generate all pairs
  const sorted = [...team].sort();
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      edges.push({
        source: sorted[i],
        target: sorted[j],
        olympiad: olympiad as OlympiadId,
        year,
      });
    }
  }
}

// Sort edges for deterministic output
edges.sort(
  (a, b) =>
    a.year - b.year ||
    a.olympiad.localeCompare(b.olympiad) ||
    a.source.localeCompare(b.source) ||
    a.target.localeCompare(b.target)
);

const graph = {
  students,
  edges,
  metadata: {
    generatedAt: new Date().toISOString(),
    studentCount: Object.keys(students).length,
    edgeCount: edges.length,
  },
};

// --- Validate ---

console.log(
  `\nGraph: ${graph.metadata.studentCount} students, ${graph.metadata.edgeCount} edges`
);

try {
  const { warnings } = validateGraph(graph);
  if (warnings.length > 0) {
    console.warn(`\n⚠ ${warnings.length} warning(s):`);
    for (const w of warnings) {
      console.warn(`  ${w}`);
    }
  }
  console.log("\nValidation passed!");
} catch (e) {
  console.error("Validation FAILED:", e);
  process.exit(1);
}

// --- Write output ---

if (!existsSync("src/data")) {
  mkdirSync("src/data", { recursive: true });
}

writeFileSync("src/data/graph.json", JSON.stringify(graph, null, 2));
console.log("Wrote src/data/graph.json");

// Print some stats
const teamSizes = [...teamMap.entries()].map(
  ([k, v]) => `${k}: ${v.length}`
);
console.log("\nTeam sizes:");
for (const t of teamSizes.sort()) {
  console.log(`  ${t}`);
}
