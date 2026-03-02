export const OLYMPIAD_IDS = ['ipho', 'eupho', 'oibf'] as const;
export type OlympiadId = (typeof OLYMPIAD_IDS)[number];

export interface OlympiadConfig {
  id: OlympiadId;
  name: string;
  fullName: string;
  color: string;
}

export const OLYMPIADS: Record<OlympiadId, OlympiadConfig> = {
  ipho: {
    id: 'ipho',
    name: 'IPhO',
    fullName: 'Olimpíada Internacional de Física',
    color: '#2563EB',
  },
  eupho: {
    id: 'eupho',
    name: 'EuPhO',
    fullName: 'Olimpíada Europeia de Física',
    color: '#CA8A04',
  },
  oibf: {
    id: 'oibf',
    name: 'OIbF',
    fullName: 'Olimpíada Ibero-americana de Física',
    color: '#DC2626',
  },
};
