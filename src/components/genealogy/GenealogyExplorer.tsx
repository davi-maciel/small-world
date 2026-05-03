'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import type { Student } from '@/types/graph';
import type { TeachingEdge, TeachingAdjacency } from '@/types/teaching';
import { getAncestors, getDescendants } from '@/lib/teaching';
import { createStudentSearch } from '@/lib/search';
import { StudentCombobox } from '@/components/search/StudentCombobox';
import { TeachingTreeCanvas } from '@/components/genealogy/TeachingTreeCanvas';
import type { TeachingTreeCanvasHandle, TeachingNode, TeachingLink } from '@/components/genealogy/TeachingTreeCanvas';
import { OverallStats, PersonStats } from '@/components/genealogy/GenealogyStats';

interface GenealogyExplorerProps {
  students: Student[];
  studentsMap: Record<string, Student>;
  teachingEdges: TeachingEdge[];
  teachingAdjacency: TeachingAdjacency;
  teachingPeopleIds: string[];
}

const EMPTY_SET = new Set<string>();

export function GenealogyExplorer({
  students,
  studentsMap,
  teachingEdges,
  teachingAdjacency,
  teachingPeopleIds,
}: GenealogyExplorerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isFullGraph, setIsFullGraph] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const canvasRef = useRef<TeachingTreeCanvasHandle>(null);

  const selectedStudent = selectedId ? studentsMap[selectedId] ?? null : null;

  const handleSelectStudent = useCallback((student: Student) => {
    setSelectedId(student.id);
    setIsFullGraph(false);
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedId(nodeId);
    if (isFullGraph) {
      setIsFullGraph(false);
      setShowLabels(true);
    }
  }, [isFullGraph]);

  const handleEnterFullGraph = useCallback(() => {
    setIsFullGraph(true);
    setShowLabels(false);
  }, []);

  const handleExitFullGraph = useCallback(() => {
    setIsFullGraph(false);
    setShowLabels(true);
  }, []);

  const handleDownloadPNG = useCallback(() => {
    const highResUrl = canvasRef.current?.renderHighRes(3);
    if (highResUrl) {
      const link = document.createElement('a');
      link.download = selectedId && !isFullGraph ? `genealogia-${selectedId}.png` : 'genealogia-completa.png';
      link.href = highResUrl;
      link.click();
    }
  }, [selectedId, isFullGraph]);

  const ancestorIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    return getAncestors(teachingAdjacency, selectedId);
  }, [selectedId, teachingAdjacency]);

  const descendantIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    return getDescendants(teachingAdjacency, selectedId);
  }, [selectedId, teachingAdjacency]);

  // Subtree: only ancestors + selected + descendants
  const { nodes, links } = useMemo((): { nodes: TeachingNode[]; links: TeachingLink[] } => {
    if (!selectedId) return { nodes: [], links: [] };

    const subtreeIds = new Set<string>([selectedId, ...ancestorIds, ...descendantIds]);

    const nodes: TeachingNode[] = [...subtreeIds]
      .map((id) => {
        const student = studentsMap[id];
        if (!student) return null;
        return { id: student.id, name: student.name };
      })
      .filter((n): n is TeachingNode => n !== null);

    const links: TeachingLink[] = teachingEdges
      .filter((e) => subtreeIds.has(e.teacher) && subtreeIds.has(e.student))
      .map((e) => ({ source: e.teacher, target: e.student }));

    return { nodes, links };
  }, [selectedId, ancestorIds, descendantIds, teachingEdges, studentsMap]);

  // Full graph: all people and all edges
  const fullGraphData = useMemo((): { nodes: TeachingNode[]; links: TeachingLink[] } => {
    const nodes: TeachingNode[] = teachingPeopleIds
      .map((id) => {
        const student = studentsMap[id];
        if (!student) return null;
        return { id: student.id, name: student.name };
      })
      .filter((n): n is TeachingNode => n !== null);

    const links: TeachingLink[] = teachingEdges.map((e) => ({
      source: e.teacher,
      target: e.student,
    }));

    return { nodes, links };
  }, [teachingPeopleIds, studentsMap, teachingEdges]);

  // Filter combobox to only people in the teaching data
  const teachingStudents = useMemo(
    () => students.filter((s) => teachingPeopleIds.includes(s.id)),
    [students, teachingPeopleIds]
  );

  const teachingFuse = useMemo(
    () => createStudentSearch(teachingStudents),
    [teachingStudents]
  );

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {!isFullGraph && (
          <div className="max-w-sm flex-1">
            <StudentCombobox
              students={teachingStudents}
              selected={selectedStudent}
              onSelect={handleSelectStudent}
              fuse={teachingFuse}
              placeholder="Buscar estudante..."
            />
          </div>
        )}
        {(selectedId || isFullGraph) && (
          <div className={`flex items-center gap-4 ${isFullGraph ? 'w-full' : 'w-full sm:w-auto'}`}>
            {isFullGraph ? (
              <button
                type="button"
                onClick={handleExitFullGraph}
                className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer select-none"
              >
                ← Voltar
              </button>
            ) : selectedId ? (
              <button
                type="button"
                onClick={handleEnterFullGraph}
                className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer select-none"
              >
                Ver grafo completo
              </button>
            ) : null}
            <div className={`flex items-center gap-4 ${isFullGraph ? 'ml-auto' : 'ml-auto sm:ml-0'}`}>
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
            </div>
          </div>
        )}
      </div>

      {selectedStudent && !isFullGraph && (
        <PersonStats
          student={selectedStudent}
          teachingAdjacency={teachingAdjacency}
        />
      )}

      {isFullGraph ? (
        <TeachingTreeCanvas
          ref={canvasRef}
          nodes={fullGraphData.nodes}
          links={fullGraphData.links}
          selectedId={null}
          showLabels={showLabels}
          onNodeClick={handleNodeClick}
          ancestorIds={EMPTY_SET}
          descendantIds={EMPTY_SET}
          nodeColor="#0891B2"
        />
      ) : selectedId ? (
        <TeachingTreeCanvas
          ref={canvasRef}
          nodes={nodes}
          links={links}
          selectedId={selectedId}
          showLabels={showLabels}
          onNodeClick={handleNodeClick}
          ancestorIds={ancestorIds}
          descendantIds={descendantIds}
          nodeColor="#0891B2"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 h-[350px] border border-gray-200 rounded-lg text-gray-400 text-sm sm:h-[500px]">
          <span>Selecione um estudante para explorar a genealogia.</span>
          <button
            type="button"
            onClick={handleEnterFullGraph}
            className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer select-none underline"
          >
            Ver grafo completo
          </button>
        </div>
      )}

      <OverallStats
        teachingAdjacency={teachingAdjacency}
        teachingPeopleIds={teachingPeopleIds}
        studentsMap={studentsMap}
        edgeCount={teachingEdges.length}
      />
    </div>
  );
}
