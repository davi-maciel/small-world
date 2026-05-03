export interface TeachingEdge {
  teacher: string;
  student: string;
}

export interface TeachingData {
  edges: TeachingEdge[];
  metadata: {
    generatedAt: string;
    edgeCount: number;
    respondentCount: number;
  };
}

export interface TeachingAdjacency {
  /** studentSlug → [teacherSlugs] */
  teachers: Record<string, string[]>;
  /** teacherSlug → [studentSlugs] */
  students: Record<string, string[]>;
}

export interface GenealogyStats {
  teacherCount: number;
  studentCount: number;
  ancestorCount: number;
  descendantCount: number;
  depth: number;
}
