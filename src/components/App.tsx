'use client';

import { useMemo } from 'react';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import type { GraphData, Student } from '@/types/graph';
import { buildAdjacencyList } from '@/lib/graph';
import { createStudentSearch } from '@/lib/search';
import { PathFinder } from '@/components/path/PathFinder';
import { GraphExplorer } from '@/components/graph/GraphExplorer';
import { ParticipationTable } from '@/components/table/ParticipationTable';

interface AppProps {
  data: GraphData;
}

export function App({ data }: AppProps) {
  const students = useMemo(
    () => Object.values(data.students).sort((a, b) => a.name.localeCompare(b.name)),
    [data.students]
  );

  const adjacencyList = useMemo(
    () => buildAdjacencyList(data.edges),
    [data.edges]
  );

  const fuse = useMemo(
    () => createStudentSearch(students),
    [students]
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-4 sm:py-8">
        <h1 className="font-serif text-3xl tracking-wide mb-4 sm:text-4xl sm:mb-6">🌐 SMALL WORLD</h1>

        <TabGroup>
          <TabList className="flex gap-1 overflow-x-auto border-b border-gray-200 mb-4 sm:mb-6">
            <Tab className="shrink-0 px-3 py-2 text-sm font-medium text-gray-600 whitespace-nowrap border-b-2 border-transparent data-[selected]:border-gray-900 data-[selected]:text-gray-900 outline-none cursor-pointer sm:px-4">
              Participações
            </Tab>
            <Tab className="shrink-0 px-3 py-2 text-sm font-medium text-gray-600 whitespace-nowrap border-b-2 border-transparent data-[selected]:border-gray-900 data-[selected]:text-gray-900 outline-none cursor-pointer sm:px-4">
              Grau de Separação
            </Tab>
            <Tab className="shrink-0 px-3 py-2 text-sm font-medium text-gray-600 whitespace-nowrap border-b-2 border-transparent data-[selected]:border-gray-900 data-[selected]:text-gray-900 outline-none cursor-pointer sm:px-4">
              Explorar Grafo
            </Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              <ParticipationTable students={students} />
            </TabPanel>
            <TabPanel>
              <PathFinder
                students={students}
                adjacencyList={adjacencyList}
                fuse={fuse}
                studentsMap={data.students}
              />
            </TabPanel>
            <TabPanel>
              <GraphExplorer
                students={students}
                edges={data.edges}
                adjacencyList={adjacencyList}
                fuse={fuse}
                studentsMap={data.students}
              />
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </div>
    </div>
  );
}
