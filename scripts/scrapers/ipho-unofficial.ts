import * as cheerio from "cheerio";
import { writeFileSync } from "fs";
import type { ScrapedEntry, Medal } from "../lib/types.js";

const URL = "https://ipho-unofficial.org/countries/BRA/individual";

function parseMedal(awardCell: cheerio.Cheerio<cheerio.Element>, $: cheerio.CheerioAPI): Medal {
  const img = awardCell.find("img");
  if (img.length) {
    const src = img.attr("src") ?? "";
    if (src.includes("gold")) return "gold";
    if (src.includes("silver")) return "silver";
    if (src.includes("bronze")) return "bronze";
    if (src.includes("honourable")) return "honorable-mention";
  }
  const text = awardCell.text().trim().toLowerCase();
  if (text.includes("honourable") || text.includes("honorable")) return "honorable-mention";
  if (text.includes("gold")) return "gold";
  if (text.includes("silver")) return "silver";
  if (text.includes("bronze")) return "bronze";
  return null;
}

async function scrape(): Promise<ScrapedEntry[]> {
  console.log(`Fetching ${URL}...`);
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const entries: ScrapedEntry[] = [];

  // Try tbody#table_body first, then generic tbody, then table rows
  let rows = $("tbody#table_body tr");
  if (!rows.length) rows = $("table tbody tr");
  if (!rows.length) rows = $("table tr");

  console.log(`Found ${rows.length} rows`);

  rows.each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 4) return;

    const yearText = $(cells[0]).text().trim();
    const year = parseInt(yearText, 10);
    if (isNaN(year)) return;

    const rawName = $(cells[1]).text().trim();
    if (!rawName) return;

    const rankText = $(cells[2]).text().trim();
    const rank = parseInt(rankText, 10);

    const medal = parseMedal($(cells[3]), $);

    entries.push({
      rawName,
      olympiadId: "ipho",
      year,
      medal,
      ...(isNaN(rank) ? {} : { rank }),
    });
  });

  return entries;
}

const entries = await scrape();
console.log(`Scraped ${entries.length} entries`);

// Show year distribution
const byYear = new Map<number, number>();
for (const e of entries) byYear.set(e.year, (byYear.get(e.year) ?? 0) + 1);
const sorted = [...byYear.entries()].sort((a, b) => a[0] - b[0]);
console.log("By year:", sorted.map(([y, c]) => `${y}:${c}`).join(" "));

writeFileSync("data/raw/ipho-unofficial.json", JSON.stringify(entries, null, 2));
console.log("Wrote data/raw/ipho-unofficial.json");
