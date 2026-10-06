import { describe, it, expect } from 'vitest'
import { exportJSON, importJSON } from '../utils/json'
import { exportGEDCOM, parseGEDCOM, toGedcomDate, fromGedcomDate } from '../utils/gedcom'
import type { FamilyTree, Person, Relation } from '../types'

const person = (id: string, extra: Partial<Person> = {}): Person => ({
  id, firstName: id.toUpperCase(), lastName: 'Петров', gender: 'unknown', privacy: 'public', x: 0, y: 0, ...extra,
})
const rel = (id: string, type: Relation['type'], sourceId: string, targetId: string): Relation => ({ id, type, sourceId, targetId })

const tree: FamilyTree = {
  persons: [
    person('dad', { gender: 'male', birthDate: '1950-03-12', birthPlace: 'Тула' }),
    person('mom', { gender: 'female', birthDate: '1952', deathDate: '2020-01-05' }),
    person('kid', { gender: 'male', notes: 'строка 1\nстрока 2' }),
    person('stepkid', { gender: 'female' }),
  ],
  relations: [
    rel('s', 'spouse', 'dad', 'mom'),
    rel('p1', 'parent-child', 'dad', 'kid'),
    rel('p2', 'parent-child', 'mom', 'kid'),
    rel('p3', 'parent-child', 'mom', 'stepkid'),
  ],
}

describe('JSON', () => {
  it('round-trips a tree', () => {
    const back = importJSON(exportJSON(tree))
    expect(back.persons).toHaveLength(4)
    expect(back.relations).toHaveLength(4)
    expect(back.persons.find(p => p.id === 'dad')?.birthPlace).toBe('Тула')
  })

  it('rejects invalid files', () => {
    expect(() => importJSON('not json')).toThrow()
    expect(() => importJSON(JSON.stringify({ foo: 1 }))).toThrow()
  })

  it('drops relations pointing to unknown people', () => {
    const back = importJSON(JSON.stringify({ persons: [person('a')], relations: [rel('r', 'spouse', 'a', 'x')] }))
    expect(back.persons).toHaveLength(1)
    expect(back.relations).toHaveLength(0)
  })
})

describe('GEDCOM', () => {
  it('converts dates both ways', () => {
    expect(toGedcomDate('1950-03-12')).toBe('12 MAR 1950')
    expect(toGedcomDate('1952')).toBe('1952')
    expect(fromGedcomDate('12 MAR 1950')).toBe('1950-03-12')
    expect(fromGedcomDate('1952')).toBe('1952')
  })

  it('assigns HUSB/WIFE by gender and children only to their own parents', () => {
    const ged = exportGEDCOM(tree.persons, tree.relations)
    const fams = ged.split(/\n(?=0 )/).filter(r => / FAM\s*$/m.test(r.split('\n')[0]))
    expect(fams).toHaveLength(2)
    const both = fams.find(f => f.includes('HUSB') && f.includes('WIFE'))!
    expect(both.match(/1 CHIL/g)).toHaveLength(1)
    const single = fams.find(f => f !== both)!
    expect(single).toContain('WIFE')
    expect(single).not.toContain('HUSB')
    expect(single.match(/1 CHIL/g)).toHaveLength(1)
  })

  it('round-trips people and relations', () => {
    let n = 0
    const back = parseGEDCOM(exportGEDCOM(tree.persons, tree.relations), () => `id${n++}`)
    expect(back.persons).toHaveLength(4)
    const byName = new Map(back.persons.map(p => [p.firstName, p]))
    const dad = byName.get('DAD')!, mom = byName.get('MOM')!, kid = byName.get('KID')!, step = byName.get('STEPKID')!
    expect(dad).toMatchObject({ gender: 'male', birthDate: '1950-03-12', birthPlace: 'Тула', lastName: 'Петров' })
    expect(mom).toMatchObject({ gender: 'female', birthDate: '1952', deathDate: '2020-01-05' })
    expect(kid.notes).toBe('строка 1\nстрока 2')

    const has = (type: Relation['type'], a: string, b: string) =>
      back.relations.some(r => r.type === type && r.sourceId === a && r.targetId === b)
    expect(has('spouse', dad.id, mom.id) || has('spouse', mom.id, dad.id)).toBe(true)
    expect(has('parent-child', dad.id, kid.id)).toBe(true)
    expect(has('parent-child', mom.id, kid.id)).toBe(true)
    expect(has('parent-child', mom.id, step.id)).toBe(true)
    expect(has('parent-child', dad.id, step.id)).toBe(false)
    expect(back.relations).toHaveLength(4)

    // generation layout: parents above children
    expect(dad.y).toBeLessThan(kid.y)
  })
})
