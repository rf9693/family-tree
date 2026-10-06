import { Person, Relation } from '../types';

export type Op =
  | { kind: 'upsertPerson'; person: Person }
  | { kind: 'deletePerson'; id: string }
  | { kind: 'movePerson'; id: string; x: number; y: number }
  | { kind: 'upsertRelation'; relation: Relation }
  | { kind: 'deleteRelation'; id: string };

export type HistoryAction =
  | 'add_person' | 'update_person' | 'delete_person' | 'move_person'
  | 'add_relation' | 'delete_relation' | 'import';

// A reversible user action. `redo` applies it, `undo` reverts it.
export interface Command {
  action: HistoryAction;
  entityId: string;
  entityName: string;
  redo: Op[];
  undo: Op[];
}

export function personName(p: Pick<Person, 'firstName' | 'lastName'>): string {
  return `${p.firstName} ${p.lastName}`.trim() || 'Без имени';
}

export function addPersonCommand(person: Person, relations: Relation[] = []): Command {
  return {
    action: 'add_person', entityId: person.id, entityName: personName(person),
    redo: [{ kind: 'upsertPerson', person }, ...relations.map(relation => ({ kind: 'upsertRelation' as const, relation }))],
    undo: [...relations.map(r => ({ kind: 'deleteRelation' as const, id: r.id })), { kind: 'deletePerson', id: person.id }],
  };
}

export function updatePersonCommand(prev: Person, next: Person): Command {
  return {
    action: 'update_person', entityId: next.id, entityName: personName(next),
    redo: [{ kind: 'upsertPerson', person: next }],
    undo: [{ kind: 'upsertPerson', person: prev }],
  };
}

export function movePersonCommand(person: Person, from: { x: number; y: number }, to: { x: number; y: number }): Command {
  return {
    action: 'move_person', entityId: person.id, entityName: personName(person),
    redo: [{ kind: 'movePerson', id: person.id, ...to }],
    undo: [{ kind: 'movePerson', id: person.id, ...from }],
  };
}

// `relations` are all relations attached to the person; they are removed with it (DB cascades) and restored on undo.
export function deletePersonCommand(person: Person, relations: Relation[]): Command {
  return {
    action: 'delete_person', entityId: person.id, entityName: personName(person),
    redo: [{ kind: 'deletePerson', id: person.id }],
    undo: [{ kind: 'upsertPerson', person }, ...relations.map(relation => ({ kind: 'upsertRelation' as const, relation }))],
  };
}

export function addRelationCommand(relation: Relation, label: string): Command {
  return {
    action: 'add_relation', entityId: relation.id, entityName: label,
    redo: [{ kind: 'upsertRelation', relation }],
    undo: [{ kind: 'deleteRelation', id: relation.id }],
  };
}

export function deleteRelationCommand(relation: Relation, label: string): Command {
  return {
    action: 'delete_relation', entityId: relation.id, entityName: label,
    redo: [{ kind: 'deleteRelation', id: relation.id }],
    undo: [{ kind: 'upsertRelation', relation }],
  };
}

export function importCommand(persons: Person[], relations: Relation[], existing: { persons: Person[]; relations: Relation[] }, label: string): Command {
  const prevPersons = new Map(existing.persons.map(p => [p.id, p]));
  const prevRelations = new Map(existing.relations.map(r => [r.id, r]));
  const undo: Op[] = [];
  relations.forEach(r => {
    const prev = prevRelations.get(r.id);
    undo.push(prev ? { kind: 'upsertRelation', relation: prev } : { kind: 'deleteRelation', id: r.id });
  });
  persons.forEach(p => {
    const prev = prevPersons.get(p.id);
    undo.push(prev ? { kind: 'upsertPerson', person: prev } : { kind: 'deletePerson', id: p.id });
  });
  return {
    action: 'import', entityId: '', entityName: label,
    redo: [
      ...persons.map(person => ({ kind: 'upsertPerson' as const, person })),
      ...relations.map(relation => ({ kind: 'upsertRelation' as const, relation })),
    ],
    undo,
  };
}
