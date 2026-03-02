import * as cheerio from "cheerio";
import { writeFileSync } from "fs";
import type { ScrapedEntry, Medal } from "../lib/types.js";

const URLS = [
  "https://olimpiada.webnode.com.br/equipes-brasileiras/fisica/ipho/",
  "http://olimpiadascientificas.org/equipes-brasileiras/fisica/ipho/",
];

function parseMedal(text: string): Medal {
  const lower = text.toLowerCase();
  if (lower.includes("ouro") || lower.includes("gold")) return "gold";
  if (lower.includes("prata") || lower.includes("silver")) return "silver";
  if (lower.includes("bronze")) return "bronze";
  if (lower.includes("menção") || lower.includes("honrosa") || lower.includes("honourable") || lower.includes("honorable"))
    return "honorable-mention";
  return null;
}

async function fetchHTML(): Promise<string> {
  for (const url of URLS) {
    try {
      console.log(`Trying ${url}...`);
      const res = await fetch(url);
      if (res.ok) {
        console.log(`Success: ${url}`);
        return await res.text();
      }
      console.log(`HTTP ${res.status} from ${url}`);
    } catch (e) {
      console.log(`Failed: ${url} — ${e}`);
    }
  }
  throw new Error("All URLs failed");
}

async function scrape(): Promise<ScrapedEntry[]> {
  const html = await fetchHTML();
  const $ = cheerio.load(html);

  // Get all text content from the main content area
  // The page uses <strong> tags for year headers and plain text/br for entries
  const content = $(".wm-content, .content, article, main, body").first();
  const rawText = content.text();

  const entries: ScrapedEntry[] = [];
  let currentYear: number | null = null;

  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Match year headers like "2011- Bangkok, Tailândia" or "2011 - Bangkok"
    const yearMatch = line.match(/^(\d{4})\s*[-–—]/);
    if (yearMatch) {
      currentYear = parseInt(yearMatch[1], 10);
      continue;
    }

    if (!currentYear) continue;

    // Match student lines like "Name (SP) - Medalha de Ouro" or "Name (SP)"
    const studentMatch = line.match(/^(.+?)\s*\(([A-Z]{2})\)\s*(?:[-–—]\s*(.+))?$/);
    if (studentMatch) {
      const rawName = studentMatch[1].trim();
      const medal = studentMatch[3] ? parseMedal(studentMatch[3]) : null;

      // Skip if the name looks like a header/meta info
      if (rawName.length < 3 || /^\d/.test(rawName)) continue;

      entries.push({
        rawName,
        olympiadId: "ipho",
        year: currentYear,
        medal,
      });
    }
  }

  return entries;
}

const entries = await scrape();
console.log(`Scraped ${entries.length} entries`);

const byYear = new Map<number, number>();
for (const e of entries) byYear.set(e.year, (byYear.get(e.year) ?? 0) + 1);
const sorted = [...byYear.entries()].sort((a, b) => a[0] - b[0]);
console.log("By year:", sorted.map(([y, c]) => `${y}:${c}`).join(" "));

writeFileSync("data/raw/ipho-supplementary.json", JSON.stringify(entries, null, 2));
console.log("Wrote data/raw/ipho-supplementary.json");
