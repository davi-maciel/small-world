'use client';

import { useMemo } from 'react';
import type { Student } from '@/types/graph';
import type { TeachingAdjacency } from '@/types/teaching';
import { getGenealogyStats, getMostInfluentialTeacher, getMostDirectStudents } from '@/lib/teaching';

interface OverallStatsProps {
  teachingAdjacency: TeachingAdjacency;
  teachingPeopleIds: string[];
  studentsMap: Record<string, Student>;
  edgeCount: number;
}

export function OverallStats({ teachingAdjacency, teachingPeopleIds, studentsMap, edgeCount }: OverallStatsProps) {
  const influential = useMemo(() => getMostInfluentialTeacher(teachingAdjacency, teachingPeopleIds), [teachingAdjacency, teachingPeopleIds]);
  const mostStudents = useMemo(() => getMostDirectStudents(teachingAdjacency, teachingPeopleIds), [teachingAdjacency, teachingPeopleIds]);

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 px-2 py-2 text-sm text-gray-600">
      {mostStudents && studentsMap[mostStudents.slug] && (
        <span>
          Mais alunos: {studentsMap[mostStudents.slug].name} ({mostStudents.studentCount})
        </span>
      )}
      {influential && studentsMap[influential.slug] && (
        <span>
          Mais descendentes: {studentsMap[influential.slug].name} ({influential.descendantCount})
        </span>
      )}
      <span>{teachingPeopleIds.length} olímpicos</span>
      <span>{edgeCount} relações</span>
    </div>
  );
}

interface PersonStatsProps {
  student: Student;
  teachingAdjacency: TeachingAdjacency;
}

export function PersonStats({ student, teachingAdjacency }: PersonStatsProps) {
  const stats = useMemo(() => getGenealogyStats(teachingAdjacency, student.id), [teachingAdjacency, student.id]);
  const hasData = stats.teacherCount > 0 || stats.studentCount > 0;

  if (!hasData) {
    return (
      <div className="px-2 py-2 text-sm text-gray-400">
        Nenhum dado de genealogia disponível para este estudante.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 px-2 py-2 text-sm text-gray-600">
      <span>{stats.teacherCount} {stats.teacherCount === 1 ? 'professor' : 'professores'}</span>
      <span>{stats.studentCount} {stats.studentCount === 1 ? 'aluno' : 'alunos'}</span>
      {stats.descendantCount > 0 && <span>{stats.descendantCount} descendentes</span>}
    </div>
  );
}
