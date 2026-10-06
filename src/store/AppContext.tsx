import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { Person, Relation, FamilyTree } from '../types';
import { Op } from './commands';
import { Lang, setLang } from '../i18n';

const TUTORIAL_KEY = 'family-tree-tutorial-done';
const LEGACY_KEYS = ['familyTree', 'family-tree-meta', 'family-tree-onboarding'];

export interface AppState {
  tree: FamilyTree;
  loaded: boolean;
  selectedId: string | null;
  editingId: string | null;
  zoom: number; panX: number; panY: number;
  lang: Lang; searchQuery: string; filterAlive: boolean; showTutorial: boolean;
}

export type Action =
  | { type: 'LOAD_FROM_DB'; persons: Person[]; relations: Relation[] }
  | { type: 'APPLY_OPS'; ops: Op[] }
  | { type: 'MOVE_PERSON'; id: string; x: number; y: number }
  | { type: 'SELECT'; id: string | null }
  | { type: 'EDIT'; id: string | null }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_PAN'; x: number; y: number }
  | { type: 'SET_LANG'; lang: Lang }
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'SET_FILTER_ALIVE'; value: boolean }
  | { type: 'SET_SHOW_TUTORIAL'; value: boolean };

export function generateId(): string {
  return crypto.randomUUID();
}

export function applyOps(tree: FamilyTree, ops: Op[]): FamilyTree {
  const persons = new Map(tree.persons.map(p => [p.id, p]));
  const relations = new Map(tree.relations.map(r => [r.id, r]));
  for (const op of ops) {
    switch (op.kind) {
      case 'upsertPerson': persons.set(op.person.id, op.person); break;
      case 'movePerson': {
        const p = persons.get(op.id);
        if (p) persons.set(op.id, { ...p, x: op.x, y: op.y });
        break;
      }
      case 'deletePerson':
        persons.delete(op.id);
        relations.forEach((r, id) => { if (r.sourceId === op.id || r.targetId === op.id) relations.delete(id); });
        break;
      case 'upsertRelation': relations.set(op.relation.id, op.relation); break;
      case 'deleteRelation': relations.delete(op.id); break;
    }
  }
  return { persons: Array.from(persons.values()), relations: Array.from(relations.values()) };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOAD_FROM_DB':
      return { ...state, loaded: true, tree: { persons: action.persons, relations: action.relations } };
    case 'APPLY_OPS': {
      const tree = applyOps(state.tree, action.ops);
      const exists = (id: string | null) => id && tree.persons.some(p => p.id === id) ? id : null;
      return { ...state, tree, selectedId: exists(state.selectedId), editingId: exists(state.editingId) };
    }
    case 'MOVE_PERSON': return { ...state, tree: applyOps(state.tree, [{ kind: 'movePerson', id: action.id, x: action.x, y: action.y }]) };
    case 'SELECT': return { ...state, selectedId: action.id };
    case 'EDIT': return { ...state, editingId: action.id };
    case 'SET_ZOOM': return { ...state, zoom: Math.min(3, Math.max(0.1, action.zoom)) };
    case 'SET_PAN': return { ...state, panX: action.x, panY: action.y };
    case 'SET_LANG': return { ...state, lang: action.lang };
    case 'SET_SEARCH': return { ...state, searchQuery: action.query };
    case 'SET_FILTER_ALIVE': return { ...state, filterAlive: action.value };
    case 'SET_SHOW_TUTORIAL': return { ...state, showTutorial: action.value };
    default: return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, (): AppState => ({
    tree: { persons: [], relations: [] },
    loaded: false,
    selectedId: null, editingId: null,
    zoom: 1, panX: 0, panY: 0,
    lang: 'ru', searchQuery: '', filterAlive: false,
    showTutorial: localStorage.getItem(TUTORIAL_KEY) !== '1',
  }));

  // Old versions cached the whole tree (with photos) in localStorage; Supabase is now the only source of truth.
  useEffect(() => { LEGACY_KEYS.forEach(k => localStorage.removeItem(k)); }, []);

  useEffect(() => { setLang(state.lang); }, [state.lang]);

  useEffect(() => {
    if (!state.showTutorial) localStorage.setItem(TUTORIAL_KEY, '1');
  }, [state.showTutorial]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
