import Fuse from 'fuse.js';
import type { Student } from '@/types/graph';

export function createStudentSearch(students: Student[]): Fuse<Student> {
  return new Fuse(students, {
    keys: ['name'],
    threshold: 0.3,
    ignoreDiacritics: true,
  });
}
