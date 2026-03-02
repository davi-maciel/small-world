'use client';

import type { ShortestPathResult, Student } from '@/types/graph';
import { OLYMPIADS } from '@/config/olympiads';
import type { OlympiadId } from '@/config/olympiads';

interface PathDisplayProps {
  result: ShortestPathResult;
  studentsMap: Record<string, Student>;
}

export function PathDisplay({ result, studentsMap }: PathDisplayProps) {
  if (result.degree === 0) {
    return (
      <p className="text-gray-600 text-sm mt-6">É a mesma pessoa!</p>
    );
  }

  if (result.degree === -1) {
    const name1 = studentsMap[result.path[0]]?.name ?? result.path[0];
    const name2 = studentsMap[result.path[1]]?.name ?? result.path[1];
    return (
      <p className="text-gray-600 text-sm mt-6">
        Não foi possível encontrar uma conexão entre {name1} e {name2}.
      </p>
    );
  }

  return (
    <div className="mt-6">
      <p className="text-lg font-medium mb-4">
        Grau de separação: <span className="font-bold">{result.degree}</span>
      </p>

      <div className="space-y-1 text-sm">
        {result.hops.map((hop, i) => {
          const fromName = studentsMap[hop.from]?.name ?? hop.from;
          const toName = studentsMap[hop.to]?.name ?? hop.to;
          const eventsLabel = hop.sharedEvents
            .map((e) => {
              const config = OLYMPIADS[e.olympiad as OlympiadId];
              return { label: `${config?.name ?? e.olympiad} ${e.year}`, color: config?.color ?? '#666' };
            });

          return (
            <div key={i}>
              {i === 0 && (
                <p className="font-medium text-gray-900">{fromName}</p>
              )}
              <div className="flex items-center gap-2 pl-4 py-1">
                <span className="text-gray-400">└─</span>
                <span>
                  {eventsLabel.map((e, j) => (
                    <span key={j}>
                      {j > 0 && ', '}
                      <span style={{ color: e.color }} className="font-medium">{e.label}</span>
                    </span>
                  ))}
                </span>
                <span className="text-gray-400">─→</span>
                <span className="font-medium text-gray-900">{toName}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
