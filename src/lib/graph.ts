import type { Edge, AdjacencyList, AdjacencyEdge, ShortestPathResult, PathHop } from '@/types/graph';

export function buildAdjacencyList(edges: Edge[]): AdjacencyList {
  const adj: AdjacencyList = {};

  for (const edge of edges) {
    if (!adj[edge.source]) adj[edge.source] = [];
    if (!adj[edge.target]) adj[edge.target] = [];

    adj[edge.source].push({
      neighborId: edge.target,
      olympiad: edge.olympiad,
      year: edge.year,
    });

    adj[edge.target].push({
      neighborId: edge.source,
      olympiad: edge.olympiad,
      year: edge.year,
    });
  }

  return adj;
}

export function findShortestPath(
  adjacency: AdjacencyList,
  sourceId: string,
  targetId: string
): ShortestPathResult {
  if (sourceId === targetId) {
    return { degree: 0, path: [sourceId], hops: [] };
  }

  const prev: Record<string, string | null> = { [sourceId]: null };
  const visited = new Set<string>([sourceId]);
  const queue: string[] = [sourceId];
  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];

    const neighbors = adjacency[current] || [];
    const seen = new Set<string>();

    for (const edge of neighbors) {
      if (seen.has(edge.neighborId)) continue;
      seen.add(edge.neighborId);

      if (!visited.has(edge.neighborId)) {
        visited.add(edge.neighborId);
        prev[edge.neighborId] = current;

        if (edge.neighborId === targetId) {
          // Reconstruct path
          const path: string[] = [];
          let node: string | null = targetId;
          while (node !== null) {
            path.unshift(node);
            node = prev[node];
          }

          // Collect hops with all shared events
          const hops: PathHop[] = [];
          for (let i = 0; i < path.length - 1; i++) {
            const from = path[i];
            const to = path[i + 1];
            const fromEdges = adjacency[from] || [];
            const sharedEvents: Array<{ olympiad: string; year: number }> = [];

            for (const e of fromEdges) {
              if (e.neighborId === to) {
                sharedEvents.push({ olympiad: e.olympiad, year: e.year });
              }
            }

            hops.push({ from, to, sharedEvents });
          }

          return { degree: path.length - 1, path, hops };
        }

        queue.push(edge.neighborId);
      }
    }
  }

  return { degree: -1, path: [], hops: [] };
}

export function getNeighborhood(
  adjacency: AdjacencyList,
  studentId: string
): { neighborIds: string[]; edges: AdjacencyEdge[] } {
  const edges = adjacency[studentId] || [];
  const neighborIds = [...new Set(edges.map((e) => e.neighborId))];
  return { neighborIds, edges };
}
