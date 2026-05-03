import type { TeachingEdge, TeachingAdjacency, GenealogyStats } from '@/types/teaching';

export function buildTeachingAdjacency(edges: TeachingEdge[]): TeachingAdjacency {
  const teachers: Record<string, string[]> = {};
  const students: Record<string, string[]> = {};

  for (const edge of edges) {
    if (!teachers[edge.student]) teachers[edge.student] = [];
    teachers[edge.student].push(edge.teacher);

    if (!students[edge.teacher]) students[edge.teacher] = [];
    students[edge.teacher].push(edge.student);
  }

  return { teachers, students };
}

function bfsCollect(
  adjacency: Record<string, string[]>,
  startId: string
): Set<string> {
  const visited = new Set<string>();
  const queue = [startId];
  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];
    const neighbors = adjacency[current] || [];
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    }
  }

  return visited;
}

export function getAncestors(
  adjacency: TeachingAdjacency,
  slug: string
): Set<string> {
  return bfsCollect(adjacency.teachers, slug);
}

export function getDescendants(
  adjacency: TeachingAdjacency,
  slug: string
): Set<string> {
  return bfsCollect(adjacency.students, slug);
}

export function getGenealogyStats(
  adjacency: TeachingAdjacency,
  slug: string
): GenealogyStats {
  const directTeachers = adjacency.teachers[slug] || [];
  const directStudents = adjacency.students[slug] || [];
  const ancestors = getAncestors(adjacency, slug);
  const descendants = getDescendants(adjacency, slug);

  // Depth: longest chain upward to a root
  let depth = 0;
  const depthQueue: Array<{ id: string; d: number }> = [{ id: slug, d: 0 }];
  const depthVisited = new Set<string>();
  let dHead = 0;
  while (dHead < depthQueue.length) {
    const { id, d } = depthQueue[dHead++];
    const parents = adjacency.teachers[id] || [];
    for (const p of parents) {
      if (!depthVisited.has(p)) {
        depthVisited.add(p);
        const nd = d + 1;
        if (nd > depth) depth = nd;
        depthQueue.push({ id: p, d: nd });
      }
    }
  }

  return {
    teacherCount: directTeachers.length,
    studentCount: directStudents.length,
    ancestorCount: ancestors.size,
    descendantCount: descendants.size,
    depth,
  };
}

export function getMostInfluentialTeacher(
  adjacency: TeachingAdjacency,
  allPeopleIds: string[]
): { slug: string; descendantCount: number } | null {
  let best: { slug: string; descendantCount: number } | null = null;

  for (const id of allPeopleIds) {
    const descendants = getDescendants(adjacency, id);
    if (!best || descendants.size > best.descendantCount) {
      best = { slug: id, descendantCount: descendants.size };
    }
  }

  return best;
}

export function getMostDirectStudents(
  adjacency: TeachingAdjacency,
  allPeopleIds: string[]
): { slug: string; studentCount: number } | null {
  let best: { slug: string; studentCount: number } | null = null;

  for (const id of allPeopleIds) {
    const count = (adjacency.students[id] || []).length;
    if (!best || count > best.studentCount) {
      best = { slug: id, studentCount: count };
    }
  }

  return best;
}

