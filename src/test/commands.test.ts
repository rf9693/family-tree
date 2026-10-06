import { describe, it, expect } from 'vitest'
import { applyOps } from '../store/AppContext'
import {
  addPersonCommand, updatePersonCommand, movePersonCommand, deletePersonCommand,
  addRelationCommand, deleteRelationCommand, importCommand,
} from '../store/commands'
import type { FamilyTree, Person, Relation } from '../types'

const person = (id: string, extra: Partial<Person> = {}): Person => ({
  id, firstName: id, lastName: 'Иванов', gender: 'male', privacy: 'public', x: 0, y: 0, createdBy: 'u1', ...extra,
})
const rel = (id: string, sourceId: string, targetId: string, type: Relation['type'] = 'parent-child'): Relation => ({
  id, type, sourceId, targetId, createdBy: 'u1',
})

const base: FamilyTree = {
  persons: [person('a'), person('b', { gender: 'female' })],
  relations: [rel('r1', 'a', 'b', 'spouse')],
}

function roundTrip(tree: FamilyTree, cmd: ReturnType<typeof addPersonCommand>) {
  const done = applyOps(tree, cmd.redo)
  const undone = applyOps(done, cmd.undo)
  return { done, undone }
}

const sortTree = (t: FamilyTree) => ({
  persons: [...t.persons].sort((x, y) => x.id.localeCompare(y.id)),
  relations: [...t.relations].sort((x, y) => x.id.localeCompare(y.id)),
})

describe('applyOps / commands', () => {
  it('adds a person with a relation and undoes it', () => {
    const { done, undone } = roundTrip(base, addPersonCommand(person('c'), [rel('r2', 'a', 'c')]))
    expect(done.persons.map(p => p.id)).toContain('c')
    expect(done.relations.map(r => r.id)).toContain('r2')
    expect(sortTree(undone)).toEqual(sortTree(base))
  })

  it('does not duplicate a person when applied twice', () => {
    const cmd = addPersonCommand(person('c'))
    const twice = applyOps(applyOps(base, cmd.redo), cmd.redo)
    expect(twice.persons.filter(p => p.id === 'c')).toHaveLength(1)
  })

  it('updates a person and keeps createdBy', () => {
    const prev = base.persons[0]
    const { done, undone } = roundTrip(base, updatePersonCommand(prev, { ...prev, firstName: 'Пётр' }))
    expect(done.persons.find(p => p.id === 'a')).toMatchObject({ firstName: 'Пётр', createdBy: 'u1' })
    expect(sortTree(undone)).toEqual(sortTree(base))
  })

  it('moves a person and moves it back on undo', () => {
    const { done, undone } = roundTrip(base, movePersonCommand(base.persons[0], { x: 0, y: 0 }, { x: 50, y: 70 }))
    expect(done.persons.find(p => p.id === 'a')).toMatchObject({ x: 50, y: 70 })
    expect(undone.persons.find(p => p.id === 'a')).toMatchObject({ x: 0, y: 0 })
  })

  it('deletes a person with relations and restores them on undo', () => {
    const { done, undone } = roundTrip(base, deletePersonCommand(base.persons[0], base.relations))
    expect(done.persons.map(p => p.id)).toEqual(['b'])
    expect(done.relations).toHaveLength(0)
    expect(sortTree(undone)).toEqual(sortTree(base))
  })

  it('adds and deletes relations reversibly', () => {
    const add = roundTrip(base, addRelationCommand(rel('r2', 'b', 'a', 'sibling'), 'b — a'))
    expect(add.done.relations).toHaveLength(2)
    expect(sortTree(add.undone)).toEqual(sortTree(base))
    const del = roundTrip(base, deleteRelationCommand(base.relations[0], 'a — b'))
    expect(del.done.relations).toHaveLength(0)
    expect(sortTree(del.undone)).toEqual(sortTree(base))
  })

  it('import overwrites existing ids and undo restores the previous state', () => {
    const cmd = importCommand([person('a', { firstName: 'Новый' }), person('z')], [rel('r9', 'a', 'z')], base, 'file.json')
    const { done, undone } = roundTrip(base, cmd)
    expect(done.persons).toHaveLength(3)
    expect(done.persons.find(p => p.id === 'a')?.firstName).toBe('Новый')
    expect(sortTree(undone)).toEqual(sortTree(base))
  })
})
