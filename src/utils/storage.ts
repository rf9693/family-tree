import { Person, Relation, FamilyTree } from '../types';

const DB_NAME = 'family-tree-db';
const DB_VERSION = 1;
const PHOTOS_STORE = 'photos';
const META_KEY = 'family-tree-meta';

let db: IDBDatabase | null = null;

export async function initDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const database = (e.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(PHOTOS_STORE)) {
        database.createObjectStore(PHOTOS_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => {
      db = (e.target as IDBOpenDBRequest).result;
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function savePhoto(personId: string, dataUrl: string): Promise<void> {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db!.transaction(PHOTOS_STORE, 'readwrite');
    const store = tx.objectStore(PHOTOS_STORE);
    store.put({ id: personId, data: dataUrl });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPhoto(personId: string): Promise<string | null> {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db!.transaction(PHOTOS_STORE, 'readonly');
    const store = tx.objectStore(PHOTOS_STORE);
    const request = store.get(personId);
    request.onsuccess = () => resolve(request.result?.data || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deletePhoto(personId: string): Promise<void> {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db!.transaction(PHOTOS_STORE, 'readwrite');
    const store = tx.objectStore(PHOTOS_STORE);
    store.delete(personId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function saveMeta(tree: FamilyTree): void {
  try {
    const data = {
      ...tree,
      persons: tree.persons.map(p => ({ ...p, photo: undefined })),
    };
    localStorage.setItem(META_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save meta', e);
  }
}

export function loadMeta(): FamilyTree | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FamilyTree;
  } catch {
    return null;
  }
}

export function saveOnboarding(done: boolean): void {
  localStorage.setItem('family-tree-onboarding', done ? '1' : '0');
}

export function loadOnboarding(): boolean {
  return localStorage.getItem('family-tree-onboarding') === '1';
}

export async function exportJSON(tree: FamilyTree, photos: Record<string, string>): Promise<string> {
  const data = {
    ...tree,
    persons: tree.persons.map(p => ({
      ...p,
      photo: photos[p.id] || undefined,
    })),
  };
  return JSON.stringify(data, null, 2);
}

export function importJSON(json: string): FamilyTree {
  return JSON.parse(json) as FamilyTree;
}

export function exportGEDCOM(persons: Person[], relations: Relation[]): string {
  const lines: string[] = ['0 HEAD', '1 GEDC', '2 VERS 5.5.1', '1 CHAR UTF-8'];

  persons.forEach(p => {
    lines.push(`0 @I${p.id}@ INDI`);
    lines.push(`1 NAME ${p.firstName} /${p.lastName}/`);
    if (p.gender === 'male') lines.push('1 SEX M');
    else if (p.gender === 'female') lines.push('1 SEX F');
    if (p.birthDate) {
      lines.push('1 BIRT');
      lines.push(`2 DATE ${p.birthDate}`);
    }
    if (p.deathDate) {
      lines.push('1 DEAT');
      lines.push(`2 DATE ${p.deathDate}`);
    }
    if (p.notes) lines.push(`1 NOTE ${p.notes}`);
  });

  // Family records for spouse relations
  const spouseRelations = relations.filter(r => r.type === 'spouse');
  const processed = new Set<string>();
  spouseRelations.forEach(r => {
    const key = [r.sourceId, r.targetId].sort().join('-');
    if (processed.has(key)) return;
    processed.add(key);
    const famId = key.replace('-', '_');
    lines.push(`0 @F${famId}@ FAM`);
    lines.push(`1 HUSB @I${r.sourceId}@`);
    lines.push(`1 WIFE @I${r.targetId}@`);
    // children
    relations
      .filter(cr => cr.type === 'parent-child' && (cr.sourceId === r.sourceId || cr.sourceId === r.targetId))
      .forEach(cr => lines.push(`1 CHIL @I${cr.targetId}@`));
  });

  lines.push('0 TRLR');
  return lines.join('\n');
}

export function parseGEDCOM(gedcom: string): { persons: Person[]; relations: Relation[] } {
  const persons: Person[] = [];
  const relations: Relation[] = [];
  const lines = gedcom.split('\n').map(l => l.trim());

  let currentIndi: Partial<Person> | null = null;
  let currentFam: { id: string; husb?: string; wife?: string; children: string[] } | null = null;
  let inBirt = false;
  let inDeat = false;

  lines.forEach(line => {
    const parts = line.match(/^(\d+)\s+(@\S+@)?\s*(\w+)?\s*(.*)?$/);
    if (!parts) return;
    const [, level, xref, tag, value] = parts;
    const lvl = parseInt(level);

    if (lvl === 0) {
      if (currentIndi) persons.push({ x: 0, y: 0, ...currentIndi } as Person);
      if (currentFam) {
        if (currentFam.husb && currentFam.wife) {
          relations.push({ id: `r-${Date.now()}-${Math.random()}`, type: 'spouse', sourceId: currentFam.husb, targetId: currentFam.wife });
        }
        currentFam.children.forEach(childId => {
          const parentId = currentFam!.husb || currentFam!.wife;
          if (parentId) {
            relations.push({ id: `r-${Date.now()}-${Math.random()}`, type: 'parent-child', sourceId: parentId, targetId: childId });
          }
        });
      }
      currentIndi = null;
      currentFam = null;
      inBirt = false;
      inDeat = false;

      if (xref && tag === 'INDI') {
        const id = xref.replace(/@/g, '').replace('I', '');
        currentIndi = { id, firstName: '', lastName: '', gender: 'unknown', privacy: 'public' };
      } else if (xref && tag === 'FAM') {
        currentFam = { id: xref.replace(/@/g, ''), children: [] };
      }
    }

    if (currentIndi) {
      if (lvl === 1 && tag === 'NAME' && value) {
        const nameMatch = value.match(/^(.*?)\s*\/(.*)\/\s*$/);
        if (nameMatch) {
          currentIndi.firstName = nameMatch[1].trim();
          currentIndi.lastName = nameMatch[2].trim();
        } else {
          currentIndi.firstName = value.trim();
        }
      }
      if (lvl === 1 && tag === 'SEX') {
        currentIndi.gender = value === 'M' ? 'male' : value === 'F' ? 'female' : 'unknown';
      }
      if (lvl === 1 && tag === 'BIRT') inBirt = true;
      if (lvl === 1 && tag === 'DEAT') inDeat = true;
      if (lvl === 1 && tag !== 'BIRT' && tag !== 'DEAT') { inBirt = false; inDeat = false; }
      if (lvl === 2 && tag === 'DATE') {
        if (inBirt) currentIndi.birthDate = value;
        if (inDeat) currentIndi.deathDate = value;
      }
      if (lvl === 1 && tag === 'NOTE') currentIndi.notes = value;
    }

    if (currentFam) {
      if (lvl === 1 && tag === 'HUSB' && value) currentFam.husb = value.replace(/@/g, '').replace('I', '');
      if (lvl === 1 && tag === 'WIFE' && value) currentFam.wife = value.replace(/@/g, '').replace('I', '');
      if (lvl === 1 && tag === 'CHIL' && value) currentFam.children.push(value.replace(/@/g, '').replace('I', ''));
    }
  });

  // auto-layout
  const cols = Math.ceil(Math.sqrt(persons.length));
  persons.forEach((p, i) => {
    p.x = (i % cols) * 220 + 100;
    p.y = Math.floor(i / cols) * 180 + 100;
  });

  return { persons, relations };
}
