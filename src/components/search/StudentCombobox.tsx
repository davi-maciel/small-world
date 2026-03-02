'use client';

import { useState } from 'react';
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react';
import type Fuse from 'fuse.js';
import type { Student } from '@/types/graph';

interface StudentComboboxProps {
  students: Student[];
  selected: Student | null;
  onSelect: (student: Student) => void;
  fuse: Fuse<Student>;
  excludeIds?: string[];
  placeholder?: string;
}

export function StudentCombobox({
  students,
  selected,
  onSelect,
  fuse,
  excludeIds = [],
  placeholder = 'Buscar estudante...',
}: StudentComboboxProps) {
  const [query, setQuery] = useState('');

  const excludeSet = new Set(excludeIds);

  const filtered = query === ''
    ? students.filter((s) => !excludeSet.has(s.id)).slice(0, 20)
    : fuse
        .search(query)
        .map((r) => r.item)
        .filter((s) => !excludeSet.has(s.id));

  return (
    <Combobox
      value={selected}
      onChange={(student) => {
        if (student) {
          onSelect(student);
          setQuery('');
        }
      }}
    >
      <div className="relative">
        <ComboboxInput
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          displayValue={(student: Student | null) => student?.name ?? ''}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
          <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </ComboboxButton>
        <ComboboxOptions className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              Nenhum estudante encontrado.
            </div>
          ) : (
            filtered.map((student) => (
              <ComboboxOption
                key={student.id}
                value={student}
                className="cursor-pointer select-none px-3 py-2 text-sm data-[focus]:bg-gray-100"
              >
                {student.name}
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
}
