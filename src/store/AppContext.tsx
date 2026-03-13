import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { Person, Relation, FamilyTree, HistoryEntry } from '../types';
import { saveMeta, savePhoto, getPhoto, deletePhoto } from '../utils/storage';
import { Lang, setLang } from '../i18n';

const MAX_HISTORY = 50;

export interface AppState {
  tree: FamilyTree;
  photos: Record<string, string>;
  selectedId: string | null;
  editingId: string | null;
  zoom: number; panX: number; panY: number;
  history: HistoryEntry[]; historyIndex: number;
  showOnboarding: boolean; onboardingStep: number; isDemoTree: boolean;
  lang: Lang; searchQuery: string; filterAlive: boolean; showTutorial: boolean;
}

type Action =
  | { type: 'LOAD_FROM_DB'; persons: Person[]; relations: Relation[] }
  | { type: 'SET_TREE'; tree: FamilyTree }
  | { type: 'MERGE_PERSONS'; persons: Person[] }
  | { type: 'MERGE_RELATIONS'; relations: Relation[] }
  | { type: 'ADD_PERSON'; person: Person }
  | { type: 'UPDATE_PERSON'; person: Person }
  | { type: 'DELETE_PERSON'; id: string }
  | { type: 'ADD_RELATION'; relation: Relation }
  | { type: 'DELETE_RELATION'; id: string }
  | { type: 'SET_PHOTO'; personId: string; photo: string }
  | { type: 'SELECT'; id: string | null }
  | { type: 'EDIT'; id: string | null }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_PAN'; x: number; y: number }
  | { type: 'UNDO' } | { type: 'REDO' }
  | { type: 'FINISH_ONBOARDING' }
  | { type: 'SET_ONBOARDING_STEP'; step: number }
  | { type: 'REMOVE_DEMO' }
  | { type: 'SET_LANG'; lang: Lang }
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'SET_FILTER_ALIVE'; value: boolean }
  | { type: 'MOVE_PERSON'; id: string; x: number; y: number }
  | { type: 'SET_SHOW_TUTORIAL'; value: boolean };

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function emptyTree(): FamilyTree {
  return { id: generateId(), name: 'Family Tree', persons: [], relations: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

function pushHistory(state: AppState): AppState {
  const entry: HistoryEntry = { persons: [...state.tree.persons], relations: [...state.tree.relations] };
  const newHistory = [...state.history.slice(0, state.historyIndex + 1), entry].slice(-MAX_HISTORY);
  return { ...state, history: newHistory, historyIndex: newHistory.length - 1 };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {

    case 'LOAD_FROM_DB':
      // Полная замена данными из Supabase (убирает демо)
      return {
        ...state,
        isDemoTree: false,
        tree: { ...state.tree, persons: action.persons, relations: action.relations, updatedAt: new Date().toISOString() },
      };

    case 'SET_TREE':
      return { ...state, tree: action.tree };

    case 'MERGE_PERSONS': {
      const map = new Map(state.tree.persons.map(p => [p.id, p]));
      action.persons.forEach(p => map.set(p.id, p));
      return { ...state, tree: { ...state.tree, persons: Array.from(map.values()), updatedAt: new Date().toISOString() } };
    }

    case 'MERGE_RELATIONS': {
      const map = new Map(state.tree.relations.map(r => [r.id, r]));
      action.relations.forEach(r => map.set(r.id, r));
      return { ...state, tree: { ...state.tree, relations: Array.from(map.values()), updatedAt: new Date().toISOString() } };
    }

    case 'ADD_PERSON': {
      const next = pushHistory(state);
      // Предотвращаем дублирование
      if (next.tree.persons.find(p => p.id === action.person.id)) return next;
      return { ...next, tree: { ...next.tree, persons: [...next.tree.persons, action.person], updatedAt: new Date().toISOString() } };
    }

    case 'UPDATE_PERSON': {
      const next = pushHistory(state);
      return { ...next, tree: { ...next.tree, persons: next.tree.persons.map(p => p.id === action.person.id ? action.person : p), updatedAt: new Date().toISOString() } };
    }

    case 'DELETE_PERSON': {
      const next = pushHistory(state);
      return { ...next, selectedId: next.selectedId === action.id ? null : next.selectedId, tree: { ...next.tree, persons: next.tree.persons.filter(p => p.id !== action.id), relations: next.tree.relations.filter(r => r.sourceId !== action.id && r.targetId !== action.id), updatedAt: new Date().toISOString() } };
    }

    case 'ADD_RELATION': {
      const next = pushHistory(state);
      if (next.tree.relations.find(r => r.id === action.relation.id)) return next;
      return { ...next, tree: { ...next.tree, relations: [...next.tree.relations, action.relation], updatedAt: new Date().toISOString() } };
    }

    case 'DELETE_RELATION': {
      const next = pushHistory(state);
      return { ...next, tree: { ...next.tree, relations: next.tree.relations.filter(r => r.id !== action.id), updatedAt: new Date().toISOString() } };
    }

    case 'SET_PHOTO': return { ...state, photos: { ...state.photos, [action.personId]: action.photo } };
    case 'SELECT': return { ...state, selectedId: action.id };
    case 'EDIT': return { ...state, editingId: action.id };
    case 'SET_ZOOM': return { ...state, zoom: Math.min(3, Math.max(0.1, action.zoom)) };
    case 'SET_PAN': return { ...state, panX: action.x, panY: action.y };

    case 'UNDO': {
      if (state.historyIndex <= 0) return state;
      const idx = state.historyIndex - 1;
      return { ...state, historyIndex: idx, tree: { ...state.tree, ...state.history[idx] } };
    }
    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state;
      const idx = state.historyIndex + 1;
      return { ...state, historyIndex: idx, tree: { ...state.tree, ...state.history[idx] } };
    }

    case 'FINISH_ONBOARDING': return { ...state, showOnboarding: false };
    case 'SET_ONBOARDING_STEP': return { ...state, onboardingStep: action.step };
    case 'REMOVE_DEMO': return { ...state, isDemoTree: false, tree: { ...state.tree, persons: state.tree.persons.filter(p => !p.id.startsWith('demo-')), relations: state.tree.relations.filter(r => !r.id.startsWith('dr-')) } };
    case 'SET_LANG': setLang(action.lang); return { ...state, lang: action.lang };
    case 'SET_SEARCH': return { ...state, searchQuery: action.query };
    case 'SET_FILTER_ALIVE': return { ...state, filterAlive: action.value };
    case 'MOVE_PERSON': return { ...state, tree: { ...state.tree, persons: state.tree.persons.map(p => p.id === action.id ? { ...p, x: action.x, y: action.y } : p) } };
    case 'SET_SHOW_TUTORIAL': return { ...state, showTutorial: action.value };
    default: return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  addPerson: (person: Partial<Person>) => Person;
  updatePerson: (person: Person) => void;
  deletePerson: (id: string) => void;
  addRelation: (relation: Omit<Relation, 'id'>) => Relation;
  setPhoto: (personId: string, photo: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const initial: AppState = {
    tree: emptyTree(),
    photos: {}, selectedId: null, editingId: null,
    zoom: 1, panX: 0, panY: 0,
    history: [], historyIndex: -1,
    showOnboarding: false, onboardingStep: 0, isDemoTree: false,
    lang: 'ru', searchQuery: '', filterAlive: false, showTutorial: false,
  };

  const [state, dispatch] = useReducer(reducer, initial);

  useEffect(() => {
    state.tree.persons.forEach(async p => {
      if (!state.photos[p.id]) {
        const photo = await getPhoto(p.id);
        if (photo) dispatch({ type: 'SET_PHOTO', personId: p.id, photo });
      }
    });
  }, [state.tree.persons.length]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  
  // Сохранение в localStorage при изменениях
  useEffect(() => {
    if (state.tree.persons.length > 0 || state.tree.relations.length > 0) {
      localStorage.setItem('familyTree', JSON.stringify({
        tree: state.tree,
        photos: state.photos,
        zoom: state.zoom,
        panX: state.panX,
        panY: state.panY
      }));
    }
  }, [state.tree, state.photos, state.zoom, state.panX, state.panY]);

  // Загрузка из localStorage при старте
  useEffect(() => {
    const saved = localStorage.getItem('familyTree');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.tree) {
          dispatch({ type: 'SET_TREE', tree: data.tree });
          if (data.photos) {
            Object.entries(data.photos).forEach(([personId, photo]) => {
              dispatch({ type: 'SET_PHOTO', personId, photo: photo as string });
            });
          }
          if (data.zoom) dispatch({ type: 'SET_ZOOM', zoom: data.zoom });
          if (data.panX !== undefined && data.panY !== undefined) {
            dispatch({ type: 'SET_PAN', x: data.panX, y: data.panY });
          }
        }
      } catch (e) {
        console.warn('Failed to load saved tree:', e);
      }
    }
  }, []);

  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveMeta(state.tree), 10000);
    return () => clearTimeout(saveTimerRef.current);
  }, [state.tree]);

  const addPerson = useCallback((partial: Partial<Person>): Person => {
    const person: Person = { 
      id: generateId(), 
      firstName: '', 
      lastName: '', 
      gender: 'unknown', 
      privacy: 'public', 
      x: 200 + Math.random() * 400, 
      y: 200 + Math.random() * 200, 
      createdBy: '', // Будет установлено в компоненте
      ...partial 
    };
    dispatch({ type: 'ADD_PERSON', person });
    return person;
  }, []);

  const updatePerson = useCallback((person: Person) => dispatch({ type: 'UPDATE_PERSON', person }), []);
  const deletePerson = useCallback((id: string) => { deletePhoto(id); dispatch({ type: 'DELETE_PERSON', id }); }, []);

  const addRelation = useCallback((rel: Omit<Relation, 'id'>): Relation => {
    const relation: Relation = { 
      id: generateId(), 
      createdBy: '', // Будет установлено в компоненте
      ...rel 
    };
    dispatch({ type: 'ADD_RELATION', relation });
    return relation;
  }, []);

  const setPhoto = useCallback(async (personId: string, photo: string) => {
    await savePhoto(personId, photo);
    dispatch({ type: 'SET_PHOTO', personId, photo });
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch, addPerson, updatePerson, deletePerson, addRelation, setPhoto }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
