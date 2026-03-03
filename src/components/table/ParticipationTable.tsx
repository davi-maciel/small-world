'use client';

import { useMemo, useState } from 'react';
import type { Student } from '@/types/graph';
import { OLYMPIADS, OLYMPIAD_IDS } from '@/config/olympiads';
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

interface SortCriterion {
  column: SortColumn;
  direction: SortDirection;
}

interface ParticipationTableProps {
  students: Student[];
}

export function ParticipationTable({ students }: ParticipationTableProps) {
  const [sortStack, setSortStack] = useState<SortCriterion[]>([
    { column: 'name', direction: 'asc' },
  ]);
  const [filterOlympiad, setFilterOlympiad] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');

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

  const years = useMemo(
    () => [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a),
    [rows]
  );

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filterOlympiad !== 'all' && r.olympiad !== filterOlympiad) return false;
      if (filterYear !== 'all' && r.year !== Number(filterYear)) return false;
      return true;
    });
  }, [rows, filterOlympiad, filterYear]);

  const compareByColumn = (a: ParticipationRow, b: ParticipationRow, column: SortColumn): number => {
    switch (column) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'olympiad': {
        const configA = OLYMPIADS[a.olympiad as OlympiadId];
        const configB = OLYMPIADS[b.olympiad as OlympiadId];
        return (configA?.name ?? a.olympiad).localeCompare(configB?.name ?? b.olympiad);
      }
      case 'year':
        return a.year - b.year;
      case 'medal': {
        const rankA = a.medal ? (MEDAL_RANK[a.medal] ?? 4) : 4;
        const rankB = b.medal ? (MEDAL_RANK[b.medal] ?? 4) : 4;
        return rankA - rankB;
      }
      default:
        return 0;
    }
  };

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];

    sorted.sort((a, b) => {
      for (const { column, direction } of sortStack) {
        const dir = direction === 'asc' ? 1 : -1;
        const cmp = compareByColumn(a, b, column);
        if (cmp !== 0) return dir * cmp;
      }
      return 0;
    });

    return sorted;
  }, [filteredRows, sortStack]);

  const handleSort = (column: SortColumn) => {
    setSortStack((prev) => {
      const existing = prev.find((s) => s.column === column);
      if (existing && prev[0].column === column) {
        // Already primary: toggle direction
        return prev.map((s) =>
          s.column === column
            ? { ...s, direction: s.direction === 'asc' ? 'desc' : 'asc' }
            : s
        );
      }
      // Move/add to front, keep the rest as tiebreakers
      const rest = prev.filter((s) => s.column !== column);
      return [{ column, direction: 'asc' }, ...rest];
    });
  };

  const SortIndicator = ({ column }: { column: SortColumn }) => {
    const index = sortStack.findIndex((s) => s.column === column);
    if (index === -1) return <span className="text-gray-300 ml-1">↕</span>;
    const arrow = sortStack[index].direction === 'asc' ? '↑' : '↓';
    if (index === 0) return <span className="ml-1">{arrow}</span>;
    return <span className="text-gray-400 ml-1">{arrow}</span>;
  };

  const headerClass = 'px-2 py-2 text-left text-sm font-medium text-gray-700 cursor-pointer select-none hover:bg-gray-50 sm:px-4';

  const selectClass = 'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500';

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <select
          value={filterOlympiad}
          onChange={(e) => setFilterOlympiad(e.target.value)}
          className={selectClass}
        >
          <option value="all">Todas as olimpíadas</option>
          {OLYMPIAD_IDS.map((id) => (
            <option key={id} value={id}>{OLYMPIADS[id].name}</option>
          ))}
        </select>
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className={selectClass}
        >
          <option value="all">Todos os anos</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
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
    </div>
  );
}
