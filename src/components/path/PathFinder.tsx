'use client';

import { useState } from 'react';
import type Fuse from 'fuse.js';
import type { Student, AdjacencyList, ShortestPathResult } from '@/types/graph';
import { findShortestPath } from '@/lib/graph';
import { StudentCombobox } from '@/components/search/StudentCombobox';
import { PathDisplay } from '@/components/path/PathDisplay';

interface PathFinderProps {
  students: Student[];
  adjacencyList: AdjacencyList;
  fuse: Fuse<Student>;
  studentsMap: Record<string, Student>;
}

export function PathFinder({ students, adjacencyList, fuse, studentsMap }: PathFinderProps) {
  const [student1, setStudent1] = useState<Student | null>(null);
  const [student2, setStudent2] = useState<Student | null>(null);
  const [result, setResult] = useState<ShortestPathResult | null>(null);

  const handleCalculate = () => {
    if (!student1 || !student2) return;
    const r = findShortestPath(adjacencyList, student1.id, student2.id);
    // For the "not connected" case, store the IDs in path for display
    if (r.degree === -1) {
      r.path = [student1.id, student2.id];
    }
    setResult(r);
  };

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estudante 1
          </label>
          <StudentCombobox
            students={students}
            selected={student1}
            onSelect={(s) => { setStudent1(s); setResult(null); }}
            fuse={fuse}
            placeholder="Buscar estudante..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estudante 2
          </label>
          <StudentCombobox
            students={students}
            selected={student2}
            onSelect={(s) => { setStudent2(s); setResult(null); }}
            fuse={fuse}
            excludeIds={student1 ? [student1.id] : []}
            placeholder="Buscar estudante..."
          />
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={handleCalculate}
          disabled={!student1 || !student2}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Calcular
        </button>
      </div>

      {result && <PathDisplay result={result} studentsMap={studentsMap} />}
    </div>
  );
}
