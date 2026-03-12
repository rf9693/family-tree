export type Gender = 'male' | 'female' | 'other' | 'unknown';
export type RelationType = 'parent-child' | 'spouse' | 'sibling';
export type Privacy = 'public' | 'private';

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  photo?: string; // base64 or blob URL
  gender: Gender;
  notes?: string;
  privacy: Privacy;
  x: number;
  y: number;
  isMe?: boolean;
}

export interface Relation {
  id: string;
  type: RelationType;
  sourceId: string;
  targetId: string;
  marriageDate?: string;
  divorceDate?: string;
}

export interface FamilyTree {
  id: string;
  name: string;
  persons: Person[];
  relations: Relation[];
  createdAt: string;
  updatedAt: string;
}

export interface HistoryEntry {
  persons: Person[];
  relations: Relation[];
}
