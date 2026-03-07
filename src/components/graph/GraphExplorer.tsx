'use client';

import { useReducer, useMemo, useCallback, useState, useRef } from 'react';
import type Fuse from 'fuse.js';
import type { Student, Edge, AdjacencyList } from '@/types/graph';
import { getNeighborhood } from '@/lib/graph';
import { StudentCombobox } from '@/components/search/StudentCombobox';
import { GraphCanvas } from '@/components/graph/GraphCanvas';
import type { GraphNode, GraphLink, GraphCanvasHandle } from '@/components/graph/GraphCanvas';
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
  fitVersion: number;
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
          fitVersion: state.fitVersion + 1,
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

          let removedAnyNode = false;
          for (const nId of neighborIds) {
            if (nId === state.rootId) continue;
            if (newExpanded.has(nId)) continue;
            if (reachable.has(nId)) continue;
            newVisible.delete(nId);
            removedAnyNode = true;
          }

          return {
            ...state,
            visibleNodeIds: newVisible,
            expandedNodeIds: newExpanded,
            fitVersion: removedAnyNode ? state.fitVersion + 1 : state.fitVersion,
          };
        } else {
          // Expand
          const { neighborIds } = getNeighborhood(adjacencyList, action.studentId);
          const newVisible = new Set(state.visibleNodeIds);
          let addedAnyNode = false;
          for (const nId of neighborIds) {
            if (!newVisible.has(nId)) addedAnyNode = true;
            newVisible.add(nId);
          }

          const newExpanded = new Set(state.expandedNodeIds);
          newExpanded.add(action.studentId);

          return {
            ...state,
            visibleNodeIds: newVisible,
            expandedNodeIds: newExpanded,
            fitVersion: addedAnyNode ? state.fitVersion + 1 : state.fitVersion,
          };
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
  fitVersion: 0,
};

const EMPTY_EXPANDED = new Set<string>();

export function GraphExplorer({
  students,
  edges,
  adjacencyList,
  fuse,
  studentsMap,
}: GraphExplorerProps) {
  const reducer = useMemo(() => createReducer(adjacencyList), [adjacencyList]);
  const [state, dispatch] = useReducer(reducer, initialState);

  const [showLabels, setShowLabels] = useState(true);
  const [isFullGraph, setIsFullGraph] = useState(false);
  const [manualFitVersion, setManualFitVersion] = useState(0);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<GraphCanvasHandle>(null);

  const selectedStudent = state.rootId ? studentsMap[state.rootId] ?? null : null;

  const handleSelectStudent = useCallback((student: Student) => {
    dispatch({ type: 'INIT', studentId: student.id });
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    dispatch({ type: 'TOGGLE', studentId: nodeId });
  }, []);

  const handleEnterFullGraph = useCallback(() => {
    setIsFullGraph(true);
    setShowLabels(false);
    setManualFitVersion((v) => v + 1);
  }, []);

  const handleExitFullGraph = useCallback(() => {
    setIsFullGraph(false);
    setManualFitVersion((v) => v + 1);
  }, []);

  const handleDownloadPNG = useCallback(() => {
    const filename = isFullGraph ? 'grafo-completo.png' : `grafo-${state.rootId ?? 'grafo'}.png`;

    // Use high-res offscreen render for full graph
    const highResUrl = isFullGraph ? canvasRef.current?.renderHighRes(3) : null;
    if (highResUrl) {
      const link = document.createElement('a');
      link.download = filename;
      link.href = highResUrl;
      link.click();
      return;
    }

    // Fallback: capture canvas directly
    const canvas = graphContainerRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [state.rootId, isFullGraph]);

  const { nodes, links } = useMemo((): { nodes: GraphNode[]; links: GraphLink[] } => {
    if (isFullGraph || !state.rootId) return { nodes: [], links: [] };

    const nodes: GraphNode[] = [];
    for (const id of state.visibleNodeIds) {
      const student = studentsMap[id];
      if (!student) continue;
      nodes.push({
        id: student.id,
        name: student.name,
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
  }, [state, edges, studentsMap, isFullGraph]);

  const fullGraphData = useMemo((): { nodes: GraphNode[]; links: GraphLink[] } | null => {
    if (!isFullGraph) return null;

    const nodes: GraphNode[] = students.map((s) => {
      const olympiadSet = new Set(s.participations.map((p) => p.olympiad));
      return {
        id: s.id,
        name: s.name,
        isMultiOlympiad: olympiadSet.size > 1,
      };
    });

    const pairMap = new Map<string, Edge[]>();
    for (const e of edges) {
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
  }, [isFullGraph, students, edges]);

  const activeFitVersion = state.fitVersion + manualFitVersion;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {isFullGraph ? (
          <button
            type="button"
            onClick={handleExitFullGraph}
            className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer select-none"
          >
            &larr; Voltar
          </button>
        ) : (
          <div className="max-w-sm flex-1">
            <StudentCombobox
              students={students}
              selected={selectedStudent}
              onSelect={handleSelectStudent}
              fuse={fuse}
              placeholder="Buscar estudante..."
            />
          </div>
        )}
        <div className="flex items-center gap-4">
          {!isFullGraph && (
            <button
              type="button"
              onClick={handleEnterFullGraph}
              className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer select-none"
            >
              Ver grafo completo
            </button>
          )}
          {(isFullGraph || state.rootId) && (
            <>
              <button
                type="button"
                onClick={handleDownloadPNG}
                className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer select-none"
              >
                Baixar PNG
              </button>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <span>Nomes</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showLabels}
                  onClick={() => setShowLabels((v) => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${showLabels ? 'bg-gray-800' : 'bg-gray-300'}`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${showLabels ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
                  />
                </button>
              </label>
            </>
          )}
        </div>
      </div>

      {isFullGraph ? (
        <div ref={graphContainerRef}>
          <div className="sm:hidden">
            <GraphLegend />
          </div>
          <GraphCanvas
            ref={canvasRef}
            nodes={fullGraphData!.nodes}
            links={fullGraphData!.links}
            rootId={null}
            expandedNodeIds={EMPTY_EXPANDED}
            fitVersion={activeFitVersion}
            onNodeClick={handleNodeClick}
            showLabels={showLabels}
            fullGraph
          />
          <div className="hidden sm:block">
            <GraphLegend />
          </div>
        </div>
      ) : state.rootId ? (
        <div ref={graphContainerRef}>
          <div className="sm:hidden">
            <GraphLegend />
          </div>
          <GraphCanvas
            nodes={nodes}
            links={links}
            rootId={state.rootId}
            expandedNodeIds={state.expandedNodeIds}
            fitVersion={activeFitVersion}
            onNodeClick={handleNodeClick}
            showLabels={showLabels}
          />
          <div className="hidden sm:block">
            <GraphLegend />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-[350px] border border-gray-200 rounded-lg text-gray-400 text-sm sm:h-[500px]">
          Selecione um estudante para explorar o grafo.
        </div>
      )}
    </div>
  );
}
