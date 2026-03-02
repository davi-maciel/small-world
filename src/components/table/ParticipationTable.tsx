'use client';

import { useMemo, useState } from 'react';
import type { Student } from '@/types/graph';
import { OLYMPIADS } from '@/config/olympiads';
import type { OlympiadId } from '@/config/olympiads';

interface ParticipationRow {
  name: string;
  olympiad: string;
  year: number;
  medal: string | null;
}

const MEDAL_LABELS: Record<string, string> = {
  gold: 'Ouro',
  silver: 'Prata',
  bronze: 'Bronze',
  'honorable-mention': 'Menção Honrosa',
};

const MEDAL_RANK: Record<string, number> = {
  gold: 0,
  silver: 1,
  bronze: 2,
  'honorable-mention': 3,
};

type SortColumn = 'name' | 'olympiad' | 'year' | 'medal';
type SortDirection = 'asc' | 'desc';

interface ParticipationTableProps {
  students: Student[];
}

export function ParticipationTable({ students }: ParticipationTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const rows = useMemo(() => {
    const result: ParticipationRow[] = [];
    for (const student of students) {
      for (const p of student.participations) {
        result.push({
          name: student.name,
          olympiad: p.olympiad,
          year: p.year,
          medal: p.medal,
        });
      }
    }
    return result;
  }, [students]);

  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    const dir = sortDirection === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      switch (sortColumn) {
        case 'name':
          return dir * a.name.localeCompare(b.name);
        case 'olympiad': {
          const configA = OLYMPIADS[a.olympiad as OlympiadId];
          const configB = OLYMPIADS[b.olympiad as OlympiadId];
          return dir * (configA?.name ?? a.olympiad).localeCompare(configB?.name ?? b.olympiad);
        }
        case 'year':
          return dir * (a.year - b.year);
        case 'medal': {
          const rankA = a.medal ? (MEDAL_RANK[a.medal] ?? 4) : 4;
          const rankB = b.medal ? (MEDAL_RANK[b.medal] ?? 4) : 4;
          return dir * (rankA - rankB);
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [rows, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  const headerClass = 'px-2 py-2 text-left text-sm font-medium text-gray-700 cursor-pointer select-none hover:bg-gray-50 sm:px-4';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className={headerClass} onClick={() => handleSort('name')}>
              Nome<SortIndicator column="name" />
            </th>
            <th className={headerClass} onClick={() => handleSort('olympiad')}>
              Olimpíada<SortIndicator column="olympiad" />
            </th>
            <th className={headerClass} onClick={() => handleSort('year')}>
              Ano<SortIndicator column="year" />
            </th>
            <th className={headerClass} onClick={() => handleSort('medal')}>
              Premiação<SortIndicator column="medal" />
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, i) => {
            const config = OLYMPIADS[row.olympiad as OlympiadId];
            return (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-2 py-2 text-gray-900 sm:px-4">{row.name}</td>
                <td className="px-2 py-2 sm:px-4" style={{ color: config?.color }}>
                  {config?.name ?? row.olympiad}
                </td>
                <td className="px-2 py-2 text-gray-700 sm:px-4">{row.year}</td>
                <td className="px-2 py-2 text-gray-700 sm:px-4">
                  {row.medal ? MEDAL_LABELS[row.medal] ?? row.medal : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
