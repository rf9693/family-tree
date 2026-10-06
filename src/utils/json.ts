import { Person, Relation, FamilyTree, Gender, Privacy, RelationType } from '../types';

export function exportJSON(tree: FamilyTree): string {
  return JSON.stringify({ persons: tree.persons, relations: tree.relations }, null, 2);
}

const GENDERS: Gender[] = ['male', 'female', 'other', 'unknown'];
const RELATION_TYPES: RelationType[] = ['parent-child', 'spouse', 'sibling'];

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

export function importJSON(json: string): FamilyTree {
  const data = JSON.parse(json);
  if (!data || !Array.isArray(data.persons) || !Array.isArray(data.relations)) {
    throw new Error('Неверный формат файла');
  }
  const persons: Person[] = (data.persons as Raw[])
    .filter(p => p && typeof p.id === 'string')
    .map(p => ({
      id: p.id as string,
      createdBy: str(p.createdBy),
      firstName: str(p.firstName) ?? '',
      lastName: str(p.lastName) ?? '',
      birthDate: str(p.birthDate),
      deathDate: str(p.deathDate),
      birthPlace: str(p.birthPlace),
      photo: str(p.photo),
      gender: GENDERS.includes(p.gender as Gender) ? p.gender as Gender : 'unknown',
      notes: str(p.notes),
      privacy: (p.privacy === 'private' ? 'private' : 'public') as Privacy,
      x: typeof p.x === 'number' ? p.x : 0,
      y: typeof p.y === 'number' ? p.y : 0,
      isMe: p.isMe === true,
    }));
  const ids = new Set(persons.map(p => p.id));
  const relations: Relation[] = (data.relations as Raw[])
    .filter(r => r && typeof r.id === 'string'
      && RELATION_TYPES.includes(r.type as RelationType)
      && ids.has(r.sourceId as string) && ids.has(r.targetId as string))
    .map(r => ({
      id: r.id as string,
      createdBy: str(r.createdBy),
      type: r.type as RelationType,
      sourceId: r.sourceId as string,
      targetId: r.targetId as string,
    }));
  return { persons, relations };
}
