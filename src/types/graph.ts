export interface Participation {
  olympiad: string;
  year: number;
  medal: 'gold' | 'silver' | 'bronze' | 'honorable-mention' | null;
}

export interface Student {
  id: string;
  name: string;
  searchKey: string;
  participations: Participation[];
}

export interface Edge {
  source: string;
  target: string;
  olympiad: string;
  year: number;
}

export interface GraphData {
  students: Record<string, Student>;
  edges: Edge[];
  metadata: {
    generatedAt: string;
    studentCount: number;
    edgeCount: number;
  };
}

export interface AdjacencyEdge {
  neighborId: string;
  olympiad: string;
  year: number;
}

export type AdjacencyList = Record<string, AdjacencyEdge[]>;

export interface PathHop {
  from: string;
  to: string;
  sharedEvents: Array<{ olympiad: string; year: number }>;
}

export interface ShortestPathResult {
  degree: number;
  path: string[];
  hops: PathHop[];
}
