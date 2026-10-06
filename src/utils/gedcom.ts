import { Person, Relation, Gender } from '../types';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function toGedcomDate(date: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return date;
  return `${parseInt(m[3], 10)} ${MONTHS[parseInt(m[2], 10) - 1]} ${m[1]}`;
}

export function fromGedcomDate(date: string): string {
  const m = date.trim().toUpperCase().match(/^(\d{1,2}) ([A-Z]{3}) (\d{4})$/);
  if (!m) return date.trim();
  const month = MONTHS.indexOf(m[2]);
  if (month < 0) return date.trim();
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function textLines(level: number, tag: string, text: string): string[] {
  const [first, ...rest] = text.split(/\r?\n/);
  return [`${level} ${tag} ${first}`, ...rest.map(l => `${level + 1} CONT ${l}`)];
}

interface Family {
  husb?: string;
  wife?: string;
  children: string[];
}

function orderSpouses(a: Person | undefined, b: Person | undefined): [Person | undefined, Person | undefined] {
  if (a?.gender === 'female' || b?.gender === 'male') return [b, a];
  return [a, b];
}

export function exportGEDCOM(persons: Person[], relations: Relation[]): string {
  const byId = new Map(persons.map(p => [p.id, p]));
  const xref = new Map(persons.map((p, i) => [p.id, `@I${i + 1}@`]));

  // Families keyed by the sorted pair of parent/spouse ids.
  const families = new Map<string, Family>();
  const family = (ids: string[]): Family => {
    const key = [...ids].sort().join('|');
    let fam = families.get(key);
    if (!fam) {
      const [h, w] = orderSpouses(byId.get(ids[0]), byId.get(ids[1]));
      fam = { husb: h?.id, wife: w?.id, children: [] };
      families.set(key, fam);
    }
    return fam;
  };

  relations
    .filter(r => r.type === 'spouse' && byId.has(r.sourceId) && byId.has(r.targetId))
    .forEach(r => family([r.sourceId, r.targetId]));

  const parentsOf = new Map<string, string[]>();
  relations
    .filter(r => r.type === 'parent-child' && byId.has(r.sourceId) && byId.has(r.targetId))
    .forEach(r => parentsOf.set(r.targetId, [...(parentsOf.get(r.targetId) || []), r.sourceId]));
  parentsOf.forEach((parents, childId) => {
    family(parents.slice(0, 2)).children.push(childId);
  });

  const famList = Array.from(families.values());
  const famXref = new Map(famList.map((f, i) => [f, `@F${i + 1}@`]));

  const lines: string[] = ['0 HEAD', '1 SOUR FAMILY_TREE', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];

  persons.forEach(p => {
    lines.push(`0 ${xref.get(p.id)} INDI`);
    lines.push(`1 NAME ${p.firstName} /${p.lastName}/`);
    if (p.firstName) lines.push(`2 GIVN ${p.firstName}`);
    if (p.lastName) lines.push(`2 SURN ${p.lastName}`);
    lines.push(`1 SEX ${p.gender === 'male' ? 'M' : p.gender === 'female' ? 'F' : 'U'}`);
    if (p.birthDate || p.birthPlace) {
      lines.push('1 BIRT');
      if (p.birthDate) lines.push(`2 DATE ${toGedcomDate(p.birthDate)}`);
      if (p.birthPlace) lines.push(`2 PLAC ${p.birthPlace}`);
    }
    if (p.deathDate) {
      lines.push('1 DEAT');
      lines.push(`2 DATE ${toGedcomDate(p.deathDate)}`);
    }
    if (p.notes) lines.push(...textLines(1, 'NOTE', p.notes));
    famList.forEach(f => {
      if (f.husb === p.id || f.wife === p.id) lines.push(`1 FAMS ${famXref.get(f)}`);
      if (f.children.includes(p.id)) lines.push(`1 FAMC ${famXref.get(f)}`);
    });
  });

  famList.forEach(f => {
    lines.push(`0 ${famXref.get(f)} FAM`);
    if (f.husb) lines.push(`1 HUSB ${xref.get(f.husb)}`);
    if (f.wife) lines.push(`1 WIFE ${xref.get(f.wife)}`);
    f.children.forEach(c => lines.push(`1 CHIL ${xref.get(c)}`));
  });

  lines.push('0 TRLR');
  return lines.join('\n');
}

// Places people in rows by generation (parents above children).
export function layoutByGeneration(persons: Person[], relations: Relation[]): Person[] {
  const parents = new Map<string, string[]>();
  relations.filter(r => r.type === 'parent-child').forEach(r => {
    parents.set(r.targetId, [...(parents.get(r.targetId) || []), r.sourceId]);
  });
  const gen = new Map<string, number>();
  const visiting = new Set<string>();
  const depth = (id: string): number => {
    const known = gen.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const ps = parents.get(id) || [];
    const d = ps.length ? Math.max(...ps.map(depth)) + 1 : 0;
    visiting.delete(id);
    gen.set(id, d);
    return d;
  };
  persons.forEach(p => depth(p.id));
  // Spouses share the deeper generation of the two.
  relations.filter(r => r.type === 'spouse').forEach(r => {
    const d = Math.max(gen.get(r.sourceId) ?? 0, gen.get(r.targetId) ?? 0);
    gen.set(r.sourceId, d);
    gen.set(r.targetId, d);
  });
  const rowCount = new Map<number, number>();
  return persons.map(p => {
    const g = gen.get(p.id) ?? 0;
    const i = rowCount.get(g) ?? 0;
    rowCount.set(g, i + 1);
    return { ...p, x: 120 + i * 200, y: 120 + g * 180 };
  });
}

export function parseGEDCOM(gedcom: string, newId: () => string): { persons: Person[]; relations: Relation[] } {
  const persons = new Map<string, Person>();
  const families: Family[] = [];
  const ids = new Map<string, string>();
  const idFor = (ref: string) => {
    let id = ids.get(ref);
    if (!id) { id = newId(); ids.set(ref, id); }
    return id;
  };

  let indi: Person | null = null;
  let fam: Family | null = null;
  let event: 'BIRT' | 'DEAT' | null = null;
  let inNote = false;

  for (const raw of gedcom.split(/\r?\n/)) {
    const line = raw.replace(/^\uFEFF/, '').trim();
    const m = line.match(/^(\d+)\s+(@[^@]+@\s+)?(\w+)(?:\s(.*))?$/);
    if (!m) continue;
    const level = parseInt(m[1], 10);
    const ref = m[2]?.trim();
    const tag = m[3];
    const value = (m[4] ?? '').trim();

    if (level === 0) {
      indi = null; fam = null; event = null; inNote = false;
      if (ref && tag === 'INDI') {
        indi = { id: idFor(ref), firstName: '', lastName: '', gender: 'unknown', privacy: 'public', x: 0, y: 0 };
        persons.set(indi.id, indi);
      } else if (ref && tag === 'FAM') {
        fam = { children: [] };
        families.push(fam);
      }
      continue;
    }

    if (indi) {
      if (level === 1) {
        event = null; inNote = false;
        if (tag === 'NAME') {
          const nm = value.match(/^(.*?)\s*\/(.*?)\/\s*(.*)$/);
          if (nm) {
            indi.firstName = [nm[1], nm[3]].filter(Boolean).join(' ').trim();
            indi.lastName = nm[2].trim();
          } else {
            indi.firstName = value;
          }
        } else if (tag === 'SEX') {
          const g: Gender = value === 'M' ? 'male' : value === 'F' ? 'female' : 'unknown';
          indi.gender = g;
        } else if (tag === 'BIRT' || tag === 'DEAT') {
          event = tag;
        } else if (tag === 'NOTE') {
          indi.notes = value;
          inNote = true;
        }
      } else if (level === 2) {
        if (tag === 'DATE' && event === 'BIRT') indi.birthDate = fromGedcomDate(value);
        if (tag === 'DATE' && event === 'DEAT') indi.deathDate = fromGedcomDate(value);
        if (tag === 'PLAC' && event === 'BIRT') indi.birthPlace = value;
        if (inNote && (tag === 'CONT' || tag === 'CONC')) {
          indi.notes = (indi.notes ?? '') + (tag === 'CONT' ? '\n' : '') + value;
        }
      }
    }

    if (fam && level === 1 && /^@[^@]+@$/.test(value)) {
      if (tag === 'HUSB') fam.husb = idFor(value);
      if (tag === 'WIFE') fam.wife = idFor(value);
      if (tag === 'CHIL') fam.children.push(idFor(value));
    }
  }

  const relations: Relation[] = [];
  families.forEach(f => {
    const parentIds = [f.husb, f.wife].filter((id): id is string => !!id && persons.has(id));
    if (parentIds.length === 2) {
      relations.push({ id: newId(), type: 'spouse', sourceId: parentIds[0], targetId: parentIds[1] });
    }
    f.children.filter(c => persons.has(c)).forEach(childId => {
      parentIds.forEach(parentId => {
        relations.push({ id: newId(), type: 'parent-child', sourceId: parentId, targetId: childId });
      });
    });
  });

  return { persons: layoutByGeneration(Array.from(persons.values()), relations), relations };
}
