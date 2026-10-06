export type Gender = 'male' | 'female' | 'other' | 'unknown';
export type RelationType = 'parent-child' | 'spouse' | 'sibling';
export type Privacy = 'public' | 'private';

export interface Person {
  id: string;
  createdBy?: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  photo?: string;
  gender: Gender;
  notes?: string;
  privacy: Privacy;
  x: number;
  y: number;
  isMe?: boolean;
}

export interface Relation {
  id: string;
  createdBy?: string;
  type: RelationType;
  sourceId: string;
  targetId: string;
}

export interface FamilyTree {
  persons: Person[];
  relations: Relation[];
}
