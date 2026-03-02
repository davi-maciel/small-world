import { z } from "zod";

const MedalSchema = z
  .enum(["gold", "silver", "bronze", "honorable-mention"])
  .nullable();

const ParticipationSchema = z.object({
  olympiad: z.enum(["ipho", "eupho", "oibf"]),
  year: z.number().int().min(1967).max(new Date().getFullYear()),
  medal: MedalSchema,
});

const StudentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  searchKey: z.string().min(1),
  participations: z.array(ParticipationSchema).min(1),
});

const EdgeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  olympiad: z.enum(["ipho", "eupho", "oibf"]),
  year: z.number().int(),
});

const GraphSchema = z.object({
  students: z.record(z.string(), StudentSchema),
  edges: z.array(EdgeSchema),
  metadata: z.object({
    generatedAt: z.string(),
    studentCount: z.number().int().nonnegative(),
    edgeCount: z.number().int().nonnegative(),
  }),
});

export type Graph = z.infer<typeof GraphSchema>;

export function validateGraph(data: unknown): Graph {
  const graph = GraphSchema.parse(data);

  const studentIds = new Set(Object.keys(graph.students));

  // Verify metadata counts
  if (graph.metadata.studentCount !== studentIds.size) {
    throw new Error(
      `studentCount ${graph.metadata.studentCount} != actual ${studentIds.size}`
    );
  }
  if (graph.metadata.edgeCount !== graph.edges.length) {
    throw new Error(
      `edgeCount ${graph.metadata.edgeCount} != actual ${graph.edges.length}`
    );
  }

  // Verify every edge references valid students
  for (const edge of graph.edges) {
    if (!studentIds.has(edge.source)) {
      throw new Error(`Edge source "${edge.source}" not found in students`);
    }
    if (!studentIds.has(edge.target)) {
      throw new Error(`Edge target "${edge.target}" not found in students`);
    }
    if (edge.source >= edge.target) {
      throw new Error(
        `Edge source "${edge.source}" should be < target "${edge.target}" (alphabetical)`
      );
    }

    // Verify both students participated in the edge's olympiad+year
    const srcStudent = graph.students[edge.source];
    const tgtStudent = graph.students[edge.target];
    const srcHas = srcStudent.participations.some(
      (p) => p.olympiad === edge.olympiad && p.year === edge.year
    );
    const tgtHas = tgtStudent.participations.some(
      (p) => p.olympiad === edge.olympiad && p.year === edge.year
    );
    if (!srcHas || !tgtHas) {
      throw new Error(
        `Edge ${edge.source}-${edge.target} (${edge.olympiad} ${edge.year}): ` +
          `missing participation (src=${srcHas}, tgt=${tgtHas})`
      );
    }
  }

  // Check for duplicate edges
  const edgeKeys = new Set<string>();
  for (const edge of graph.edges) {
    const key = `${edge.source}|${edge.target}|${edge.olympiad}|${edge.year}`;
    if (edgeKeys.has(key)) {
      throw new Error(`Duplicate edge: ${key}`);
    }
    edgeKeys.add(key);
  }

  // Verify student IDs match keys
  for (const [id, student] of Object.entries(graph.students)) {
    if (student.id !== id) {
      throw new Error(`Student key "${id}" != student.id "${student.id}"`);
    }
  }

  return graph;
}
