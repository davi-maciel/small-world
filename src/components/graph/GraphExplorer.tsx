'use client';

import { useReducer, useMemo, useCallback } from 'react';
import type Fuse from 'fuse.js';
import type { Student, Edge, AdjacencyList } from '@/types/graph';
import { getNeighborhood } from '@/lib/graph';
import { StudentCombobox } from '@/components/search/StudentCombobox';
import { GraphCanvas } from '@/components/graph/GraphCanvas';
import type { GraphNode, GraphLink } from '@/components/graph/GraphCanvas';
import { GraphLegend } from '@/components/graph/GraphLegend';

interface GraphExplorerProps {
  students: Student[];
  edges: Edge[];
  adjacencyList: AdjacencyList;
  fuse: Fuse<Student>;
  studentsMap: Record<string, Student>;
}

interface GraphExplorerState {
  rootId: string | null;
  visibleNodeIds: Set<string>;
  expandedNodeIds: Set<string>;
}

type GraphExplorerAction =
  | { type: 'INIT'; studentId: string }
  | { type: 'TOGGLE'; studentId: string };

function createReducer(adjacencyList: AdjacencyList) {
  return function reducer(
    state: GraphExplorerState,
    action: GraphExplorerAction
  ): GraphExplorerState {
    switch (action.type) {
      case 'INIT': {
        const { neighborIds } = getNeighborhood(adjacencyList, action.studentId);
        const visibleNodeIds = new Set([action.studentId, ...neighborIds]);
        return {
          rootId: action.studentId,
          visibleNodeIds,
          expandedNodeIds: new Set([action.studentId]),
        };
      }

      case 'TOGGLE': {
        if (action.studentId === state.rootId) return state;

        const isExpanded = state.expandedNodeIds.has(action.studentId);

        if (isExpanded) {
          // Collapse
          const newExpanded = new Set(state.expandedNodeIds);
          newExpanded.delete(action.studentId);

          const newVisible = new Set(state.visibleNodeIds);
          const { neighborIds } = getNeighborhood(adjacencyList, action.studentId);

          // Collect all neighbors of remaining expanded nodes
          const reachable = new Set<string>();
          for (const expId of newExpanded) {
            const { neighborIds: expNeighbors } = getNeighborhood(adjacencyList, expId);
            for (const n of expNeighbors) reachable.add(n);
          }

          for (const nId of neighborIds) {
            if (nId === state.rootId) continue;
            if (newExpanded.has(nId)) continue;
            if (reachable.has(nId)) continue;
            newVisible.delete(nId);
          }

          return { ...state, visibleNodeIds: newVisible, expandedNodeIds: newExpanded };
        } else {
          // Expand
          const { neighborIds } = getNeighborhood(adjacencyList, action.studentId);
          const newVisible = new Set(state.visibleNodeIds);
          for (const nId of neighborIds) newVisible.add(nId);

          const newExpanded = new Set(state.expandedNodeIds);
          newExpanded.add(action.studentId);

          return { ...state, visibleNodeIds: newVisible, expandedNodeIds: newExpanded };
        }
      }

      default:
        return state;
    }
  };
}

const initialState: GraphExplorerState = {
  rootId: null,
  visibleNodeIds: new Set(),
  expandedNodeIds: new Set(),
};

export function GraphExplorer({
  students,
  edges,
  adjacencyList,
  fuse,
  studentsMap,
}: GraphExplorerProps) {
  const reducer = useMemo(() => createReducer(adjacencyList), [adjacencyList]);
  const [state, dispatch] = useReducer(reducer, initialState);

  const selectedStudent = state.rootId ? studentsMap[state.rootId] ?? null : null;

  const handleSelectStudent = useCallback((student: Student) => {
    dispatch({ type: 'INIT', studentId: student.id });
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    dispatch({ type: 'TOGGLE', studentId: nodeId });
  }, []);

  const { nodes, links } = useMemo((): { nodes: GraphNode[]; links: GraphLink[] } => {
    if (!state.rootId) return { nodes: [], links: [] };

    const nodes: GraphNode[] = [];
    for (const id of state.visibleNodeIds) {
      const student = studentsMap[id];
      if (!student) continue;
      nodes.push({
        id: student.id,
        name: student.name,
        isRoot: id === state.rootId,
        isExpanded: state.expandedNodeIds.has(id),
      });
    }

    // Collect visible edges and compute curvatures
    const visibleEdges = edges.filter(
      (e) => state.visibleNodeIds.has(e.source) && state.visibleNodeIds.has(e.target)
    );

    // Group by pair for curvature
    const pairMap = new Map<string, typeof visibleEdges>();
    for (const e of visibleEdges) {
      const key = [e.source, e.target].sort().join('|');
      if (!pairMap.has(key)) pairMap.set(key, []);
      pairMap.get(key)!.push(e);
    }

    const links: GraphLink[] = [];
    for (const group of pairMap.values()) {
      const curvatures =
        group.length === 1
          ? [0]
          : group.length === 2
            ? [0.25, -0.25]
            : [0.3, 0, -0.3];

      for (let i = 0; i < group.length; i++) {
        const e = group[i];
        links.push({
          source: e.source,
          target: e.target,
          olympiad: e.olympiad,
          year: e.year,
          curvature: curvatures[i] ?? 0,
        });
      }
    }

    return { nodes, links };
  }, [state, edges, studentsMap]);

  return (
    <div>
      <div className="mb-4 max-w-sm">
        <StudentCombobox
          students={students}
          selected={selectedStudent}
          onSelect={handleSelectStudent}
          fuse={fuse}
          placeholder="Buscar estudante..."
        />
      </div>

      {state.rootId ? (
        <>
          <div className="sm:hidden">
            <GraphLegend />
          </div>
          <GraphCanvas
            nodes={nodes}
            links={links}
            onNodeClick={handleNodeClick}
          />
          <div className="hidden sm:block">
            <GraphLegend />
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-[350px] border border-gray-200 rounded-lg text-gray-400 text-sm sm:h-[500px]">
          Selecione um estudante para explorar o grafo.
        </div>
      )}
    </div>
  );
}
