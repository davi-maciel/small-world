export type OlympiadId = "ipho" | "eupho" | "oibf";
export type Medal = "gold" | "silver" | "bronze" | "honorable-mention" | null;

export interface ScrapedEntry {
  rawName: string;
  olympiadId: OlympiadId;
  year: number;
  medal: Medal;
  rank?: number;
}
