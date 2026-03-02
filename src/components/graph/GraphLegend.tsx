'use client';

import { OLYMPIAD_IDS, OLYMPIADS } from '@/config/olympiads';

export function GraphLegend() {
  return (
    <div className="flex gap-4 px-2 py-2">
      {OLYMPIAD_IDS.map((id) => {
        const config = OLYMPIADS[id];
        return (
          <div key={id} className="flex items-center gap-1.5 text-sm text-gray-700">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: config.color }}
            />
            {config.name}
          </div>
        );
      })}
    </div>
  );
}
