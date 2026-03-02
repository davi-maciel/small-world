import { getDocumentProxy, extractText } from "unpdf";
import { writeFileSync } from "fs";
import type { ScrapedEntry, Medal } from "../lib/types.js";

const PDF_URLS: Record<number, string> = {
  2017: "https://eupho.ee/wp-content/uploads/2020/07/1stEuPhO_results.pdf",
  2018: "https://eupho.ee/wp-content/uploads/2020/07/eupho18-results.pdf",
  2019: "https://eupho.ee/wp-content/uploads/2020/07/EuPhO2019_results.pdf",
  2020: "https://eupho.ee/wp-content/uploads/2020/07/EuPhO-2020-results.pdf",
  2021: "https://eupho.ee/wp-content/uploads/2021/06/EuPhO2021-results.pdf",
  2022: "https://eupho.ee/wp-content/uploads/2022/05/EuPhO2022-awards.pdf",
  2023: "https://eupho.ee/wp-content/uploads/2023/06/EuPhO23-results.pdf",
  2024: "https://eupho.ee/wp-content/uploads/2024/07/EuPhO-2024-results-resultsforweb.pdf",
  2025: "https://eupho.ee/wp-content/uploads/2025/06/EuPhO_2025_results-3.pdf",
};

function parseMedal(text: string): Medal {
  const lower = text.toLowerCase().trim();
  if (lower.startsWith("g") || lower.includes("gold")) return "gold";
  if (lower.startsWith("s") || lower.includes("silver")) return "silver";
  if (lower.startsWith("b") || lower.includes("bronze")) return "bronze";
  if (lower.includes("honora") || lower.includes("honoura") || lower.includes("hm"))
    return "honorable-mention";
  return null;
}

function extractBrazilians(allText: string[], year: number): ScrapedEntry[] {
  const entries: ScrapedEntry[] = [];
  const fullText = allText.join("\n");
  const lines = fullText.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Skip header lines
    if (/^(Names|Given|Rank|MAX|SUM|Theory|Exp|Country)/i.test(line)) continue;
    if (/^(do not increment|Average)/i.test(line)) continue;

    const isBrazilian =
      /\bBrazil\b/i.test(line) || /\bBRA[-\s]/i.test(line);
    if (!isBrazilian) continue;

    const entry = parseLine(line, year);
    if (entry) entries.push(entry);
  }

  return entries;
}

function parseLine(line: string, year: number): ScrapedEntry | null {
  // Format 1 (2017): "5 Diogo Netto Brazil 10 6 6.5 22.5 7.5 2 9.5 32 Gold"
  // Format 2 (2018): "17 Vinicius de Alcântara Névoa Brazil 5,0 7,5 5,0 17,5 2,2 0,5 2,7 20,2 Silver"
  // Format 3 (2019): "Brazil Ygor De Santana Moura 25.2 Silver Medal"
  // Format 4 (2020): "Brazil Alexandre Silva Bastos De Almeida 2 0.7 2.7 ..."
  // Format 5 (2021): "Bruno Makoto Tanabe de Lima Brazil 5 6.8 ..."
  // Format 6 (2022): "BRA-S2 Everton Albuquerque de OliveiraBrazil male 8.8 ..."
  // Format 7 (2023): "Alberto Akira Ito Albernaz Brazil 0.7 2.5 0 ... 27 G"
  // Format 8 (2024): "Bruno Machado Feltran Brazil 0.3 2.0 ... 26.4 S"
  // Format 9 (2025): "Lucas Praça Oliveira Brazil 4.1 0 4 ..."

  // Try to extract medal from end of line
  let medal: Medal = null;
  const medalMatch = line.match(
    /\b(Gold|Silver|Bronze|Honourable|Honorable|HM)\s*(Medal|Mention)?\s*$/i
  );
  if (medalMatch) {
    medal = parseMedal(medalMatch[0]);
  }
  // Single letter medal at end (G, S, B) — used in 2023-2025
  if (!medal) {
    const singleMedalMatch = line.match(/\s([GSB])\s*$/);
    if (singleMedalMatch) {
      medal = parseMedal(singleMedalMatch[1]);
    }
  }

  let rawName: string | null = null;

  // Format 6 (2022): BRA-S# prefix
  const braIdMatch = line.match(/^BRA-S\d+\s+(.+?)(?:\s*Brazil)\s+(?:male|female)\s/i);
  if (braIdMatch) {
    rawName = braIdMatch[1].trim();
    // The name might be concatenated with "Brazil" without space
    rawName = rawName.replace(/Brazil$/i, "").trim();
  }

  // Format 3 (2019) / Format 4 (2020): "Brazil Name ..."
  if (!rawName) {
    const brazilFirstMatch = line.match(
      /^Brazil\s+([A-ZÀ-Ö][a-zà-ö]+(?:\s+(?:De|Da|Do|Dos|Das|de|da|do|dos|das|e|Di|[A-ZÀ-Ö][a-zà-ö]+))*)\s+[\d]/i
    );
    if (brazilFirstMatch) {
      rawName = brazilFirstMatch[1].trim();
    }
  }

  // Format 1 (2017) / Format 2 (2018): "Rank Name Brazil scores..."
  if (!rawName) {
    const rankFirstMatch = line.match(
      /^\d+\s+(.+?)\s+Brazil\s+[\d,]/i
    );
    if (rankFirstMatch) {
      rawName = rankFirstMatch[1].trim();
    }
  }

  // Format 5 (2021) / Format 7-9 (2023-2025): "Name Brazil scores..."
  if (!rawName) {
    const nameFirstMatch = line.match(
      /^([A-ZÀ-Ö][a-zà-ö]+(?:\s+(?:De|Da|Do|Dos|Das|de|da|do|dos|das|e|Di|[A-ZÀ-Ö][a-zà-ö]+))*)\s+Brazil\s+[\d]/i
    );
    if (nameFirstMatch) {
      rawName = nameFirstMatch[1].trim();
    }
  }

  if (!rawName) {
    console.warn(`  [${year}] Could not parse name from: ${line.substring(0, 80)}...`);
    return null;
  }

  // Determine medal from scores if not found at end of line
  // For 2020 (no medals in PDF) and 2021/2025 (medals may not be at end)
  // We'll leave medal as null if not found - build-graph can handle it

  return {
    rawName,
    olympiadId: "eupho",
    year,
    medal,
  };
}

async function scrapePdf(year: number, url: string): Promise<ScrapedEntry[]> {
  console.log(`\n[${year}] Fetching PDF...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

  const buffer = await res.arrayBuffer();
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });

  console.log(`[${year}] Extracted ${text.length} pages`);

  const entries = extractBrazilians(text, year);
  console.log(
    `[${year}] Found ${entries.length} Brazilian entries: ${entries.map((e) => e.rawName).join(", ")}`
  );

  return entries;
}

// Manual overrides for years where PDF text extraction is unreliable.
// Names confirmed from SBF articles and news sources.
const MANUAL_OVERRIDES: Record<number, ScrapedEntry[]> = {
  2025: [
    { rawName: "Lucas Praça Oliveira", olympiadId: "eupho", year: 2025, medal: "silver" },
    { rawName: "Patrick Avelar Santos Silva", olympiadId: "eupho", year: 2025, medal: "silver" },
    { rawName: "Luiz Cláudio Germano Da Costa", olympiadId: "eupho", year: 2025, medal: "bronze" },
    { rawName: "Elias do Nascimento Barros", olympiadId: "eupho", year: 2025, medal: "honorable-mention" },
    { rawName: "Vitor Takashi Hideshima", olympiadId: "eupho", year: 2025, medal: null },
  ],
};

// Medal corrections for years where PDF doesn't include medal info in extracted text.
// Data from SBF (sbfisica.org.br) articles.
const MEDAL_CORRECTIONS: Record<number, Record<string, Medal>> = {
  2020: {
    "Alexandre Silva Bastos De Almeida": "silver",
    "Alessandro Da Cunha Menegon": "bronze",
    "João Lucas Farias Vasconcelos": "honorable-mention",
    "Wanderson Faustino Patrício": "honorable-mention",
  },
  2021: {
    "Bruno Makoto Tanabe de Lima": "silver",
    "Alicia Duarte Silva": "silver",
    "Wesley Antônio Machado Andrade de Aguiar": "bronze",
    "Pedro Ulisses De Lima Quadros": "bronze",
    "Ian Seo Takose": "bronze",
  },
  2022: {
    "Everton Albuquerque de Oliveira": "silver",
    "Natan Uchoa": "bronze",
    "João Gabriel Pepato de Oliveira": "bronze",
    "Gabriel Hemétrio de Menezes": "honorable-mention",
    "Alicia Duarte Silva": "honorable-mention",
  },
};

async function scrapeAll(): Promise<ScrapedEntry[]> {
  const allEntries: ScrapedEntry[] = [];
  const years = Object.keys(PDF_URLS)
    .map(Number)
    .sort((a, b) => a - b);

  for (const year of years) {
    if (MANUAL_OVERRIDES[year]) {
      console.log(`\n[${year}] Using manual override (${MANUAL_OVERRIDES[year].length} entries)`);
      allEntries.push(...MANUAL_OVERRIDES[year]);
      continue;
    }
    const entries = await scrapePdf(year, PDF_URLS[year]);
    allEntries.push(...entries);
    // Small delay between downloads
    await new Promise((r) => setTimeout(r, 500));
  }

  return allEntries;
}

const entries = await scrapeAll();

// Apply medal corrections
for (const entry of entries) {
  const corrections = MEDAL_CORRECTIONS[entry.year];
  if (corrections && entry.rawName in corrections) {
    entry.medal = corrections[entry.rawName];
  }
}

console.log(`\nTotal: ${entries.length} entries`);

const byYear = new Map<number, number>();
for (const e of entries) byYear.set(e.year, (byYear.get(e.year) ?? 0) + 1);
const sorted = [...byYear.entries()].sort((a, b) => a[0] - b[0]);
console.log("By year:", sorted.map(([y, c]) => `${y}:${c}`).join(" "));

writeFileSync("data/raw/eupho-pdfs.json", JSON.stringify(entries, null, 2));
console.log("Wrote data/raw/eupho-pdfs.json");
