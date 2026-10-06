import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AppProvider, useApp, generateId } from './store/AppContext'
import { useAuth } from './store/AuthContext'
import { AuthPage } from './pages/AuthPage'
import { TreeCanvas, RelativeType } from './components/tree/TreeCanvas'
import { PersonDialog } from './components/panels/PersonDialog'
import { FloatingPanel } from './components/panels/FloatingPanel'
import { Tutorial } from './components/panels/Tutorial'
import { HistoryPanel } from './components/panels/HistoryPanel'
import { useSupabaseSync } from './hooks/useSupabaseSync'
import { useUndo, RunMode } from './hooks/useUndo'
import { Person, Relation } from './types'
import {
  Command, personName, addPersonCommand, updatePersonCommand, movePersonCommand, deletePersonCommand,
  addRelationCommand, deleteRelationCommand, importCommand,
} from './store/commands'

// Relation to create together with a person added from the context menu.
interface PendingRelation {
  sourcePersonId: string;
  relationType: Relation['type'];
  sourceIsParent: boolean; // for parent-child: true when the existing person is the parent
}

type DialogState =
  | { mode: 'edit'; personId: string }
  | { mode: 'new'; position: { x: number; y: number }; pending?: PendingRelation }

const RELATIVE_OFFSETS: Record<RelativeType, { x: number; y: number }> = {
  child: { x: 0, y: 200 },
  parent: { x: 0, y: -200 },
  spouse: { x: 220, y: 0 },
  sibling: { x: -220, y: 0 },
}

function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

function FamilyTreeApp() {
  const { user, profile, signOut, isOwner, canDelete, canImport } = useAuth()
  const { state, dispatch } = useApp()
  const [newDialog, setNewDialog] = useState<Extract<DialogState, { mode: 'new' }> | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const sync = useSupabaseSync(dispatch)
  const { persistOps, logHistory, loadAll } = sync

  const run = useCallback(async (cmd: Command, mode: RunMode) => {
    const ops = mode === 'undo' ? cmd.undo : cmd.redo
    dispatch({ type: 'APPLY_OPS', ops })
    try {
      await persistOps(ops)
      if (cmd.action !== 'move_person') {
        logHistory(mode === 'do' ? cmd.action : mode, cmd.entityId, cmd.entityName)
      }
      return true
    } catch (e) {
      console.error('persist error', e)
      toast.error(`Не удалось сохранить изменения: ${errorMessage(e)}`)
      // Re-sync with the database so the screen shows what is actually saved.
      loadAll().catch(err => console.error('loadAll error', err))
      return false
    }
  }, [dispatch, persistOps, logHistory, loadAll])

  const { execute, undo, redo, canUndo, canRedo } = useUndo(run)

  const relationLabel = useCallback((r: Relation) => {
    const byId = new Map(state.tree.persons.map(p => [p.id, p]))
    const a = byId.get(r.sourceId), b = byId.get(r.targetId)
    return `${a ? personName(a) : '?'} — ${b ? personName(b) : '?'}`
  }, [state.tree.persons])

  const deletePerson = useCallback((id: string) => {
    const p = state.tree.persons.find(p => p.id === id)
    if (!p || !canDelete(p.createdBy)) return
    const rels = state.tree.relations.filter(r => r.sourceId === id || r.targetId === id)
    execute(deletePersonCommand(p, rels))
  }, [state.tree, canDelete, execute])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
      if (e.key === 'Escape') { setNewDialog(null); dispatch({ type: 'EDIT', id: null }); return }
      if (typing) return
      const dialogOpen = !!newDialog || !!state.editingId
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase()
        if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
        if (key === 'y' || (key === 'z' && e.shiftKey)) { e.preventDefault(); redo() }
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId && !dialogOpen) {
        deletePerson(state.selectedId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.selectedId, state.editingId, newDialog, undo, redo, deletePerson, dispatch])

  function viewportCenter() {
    return {
      x: (window.innerWidth / 2 - state.panX) / state.zoom,
      y: (window.innerHeight / 2 - state.panY) / state.zoom,
    }
  }

  function handleAddRelative(personId: string, relativeType: RelativeType) {
    const source = state.tree.persons.find(p => p.id === personId)
    if (!source) return
    const offset = RELATIVE_OFFSETS[relativeType]
    const pending: PendingRelation = relativeType === 'child' || relativeType === 'parent'
      ? { sourcePersonId: personId, relationType: 'parent-child', sourceIsParent: relativeType === 'child' }
      : { sourcePersonId: personId, relationType: relativeType, sourceIsParent: false }
    dispatch({ type: 'EDIT', id: null })
    setNewDialog({ mode: 'new', position: { x: source.x + offset.x, y: source.y + offset.y }, pending })
  }

  function handleSavePerson(person: Person, isNew: boolean) {
    if (isNew) {
      const pending = newDialog?.pending
      const rels: Relation[] = pending ? [{
        id: generateId(),
        createdBy: user?.id,
        type: pending.relationType,
        sourceId: pending.relationType === 'parent-child' && !pending.sourceIsParent ? person.id : pending.sourcePersonId,
        targetId: pending.relationType === 'parent-child' && !pending.sourceIsParent ? pending.sourcePersonId : person.id,
      }] : []
      execute(addPersonCommand(person, rels))
    } else {
      const prev = state.tree.persons.find(p => p.id === person.id)
      if (prev) execute(updatePersonCommand(prev, person))
    }
  }

  const handleMovePerson = useCallback((person: Person, from: { x: number; y: number }, to: { x: number; y: number }) => {
    execute(movePersonCommand(person, from, to))
  }, [execute])

  function handleImport(persons: Person[], relations: Relation[], label: string) {
    const owned = persons.map(p => ({ ...p, createdBy: p.createdBy || user?.id }))
    execute(importCommand(owned, relations, state.tree, label))
  }

  function handleCloseDialog() {
    setNewDialog(null)
    dispatch({ type: 'EDIT', id: null })
  }

  const roleBadge = isOwner
    ? { label: '👑 Владелец', color: '#c9a84c', bg: 'rgba(201,168,76,.15)' }
    : { label: '👤 Участник', color: '#64748b', bg: 'rgba(255,255,255,.05)' }

  const editingPerson = state.editingId ? state.tree.persons.find(p => p.id === state.editingId) : undefined
  const dialog: DialogState | null = newDialog ?? (editingPerson ? { mode: 'edit', personId: editingPerson.id } : null)

  return (
    <div style={{ width:'100vw', height:'100vh', overflow:'hidden', background:'linear-gradient(160deg,#060d1f,#0d1a35 40%,#080d20)', position:'relative' }}>
      <style>{`*{box-sizing:border-box}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(148,163,184,.2);border-radius:2px}@keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

      {/* Header */}
      <div style={{ position:'fixed', top:0, left:0, right:0, height:52, background:'rgba(7,9,15,.95)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(148,163,184,.1)', display:'flex', alignItems:'center', padding:'0 16px', gap:12, zIndex:100 }}>
        <div style={{ fontFamily:'Georgia,serif', fontSize:17, color:'#c9a84c' }}>🌳 Древо рода</div>
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color: sync.online ? '#475569' : '#f87171' }}>
          <div style={{ width:5, height:5, borderRadius:'50%', background: sync.online ? '#22c55e' : '#ef4444' }}/>
          {sync.online ? 'онлайн' : 'нет соединения'}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:11, color:'#475569' }}>👥 {state.tree.persons.length}</span>
          <div style={{ padding:'3px 10px', borderRadius:20, background: roleBadge.bg, border:`1px solid ${roleBadge.color}33`, fontSize:11, color: roleBadge.color }}>
            {roleBadge.label}
          </div>
          <button onClick={() => setShowHistory(v => !v)} style={{ display:'flex', alignItems:'center', gap:5, background: showHistory ? 'rgba(201,168,76,.15)' : 'rgba(255,255,255,.05)', border:'1px solid rgba(148,163,184,.12)', borderRadius:7, color: showHistory ? '#c9a84c' : '#94a3b8', cursor:'pointer', padding:'5px 10px', fontSize:12, fontFamily:'Georgia,serif' }}>
            📋 История
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(201,168,76,.2)', border:'1px solid rgba(201,168,76,.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#c9a84c', fontWeight:600 }}>
              {(profile?.full_name || user?.email || '?')[0].toUpperCase()}
            </div>
            <span style={{ fontSize:12, color:'#64748b', maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {profile?.full_name || user?.email}
            </span>
          </div>
          <button onClick={signOut} style={{ background:'none', border:'1px solid rgba(148,163,184,.1)', borderRadius:7, color:'#475569', cursor:'pointer', padding:'5px 9px', fontSize:11, fontFamily:'Georgia,serif' }}>Выйти</button>
        </div>
      </div>

      {!isOwner && (
        <div style={{ position:'fixed', top:52, left:0, right:0, zIndex:90, background:'rgba(59,130,246,.06)', borderBottom:'1px solid rgba(59,130,246,.12)', padding:'5px 16px', fontSize:11, color:'#475569', textAlign:'center' }}>
          Вы участник — можете добавлять людей и удалять только тех, кого сами добавили
        </div>
      )}

      <div style={{ paddingTop: isOwner ? 52 : 74 }}>
        <TreeCanvas
          onDeletePerson={deletePerson}
          onAddRelative={handleAddRelative}
          onMovePerson={handleMovePerson}
        />
      </div>

      {state.loaded && state.tree.persons.length === 0 && !dialog && (
        <div style={{ position:'fixed', top:'45%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center', color:'#475569', fontFamily:'Georgia,serif', pointerEvents:'none' }}>
          <div style={{ fontSize:40, marginBottom:8 }}>🌱</div>
          Древо пока пустое — нажмите «+» внизу, чтобы добавить первого человека
        </div>
      )}

      <FloatingPanel
        onAddPerson={() => { dispatch({ type: 'EDIT', id: null }); setNewDialog({ mode: 'new', position: viewportCenter() }) }}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        canImport={canImport}
        onImport={handleImport}
      />
      {state.showTutorial && <Tutorial />}

      {dialog && (
        <PersonDialog
          key={dialog.mode === 'edit' ? dialog.personId : 'new'}
          personId={dialog.mode === 'edit' ? dialog.personId : null}
          newPersonPosition={dialog.mode === 'new' ? dialog.position : undefined}
          onClose={handleCloseDialog}
          onSave={handleSavePerson}
          onDelete={editingPerson && canDelete(editingPerson.createdBy) ? deletePerson : undefined}
          onAddRelation={r => execute(addRelationCommand(r, relationLabel(r)))}
          onDeleteRelation={r => execute(deleteRelationCommand(r, relationLabel(r)))}
        />
      )}

      {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#07090f' }}>
      <div style={{ color:'#c9a84c', fontSize:18, fontFamily:'Georgia,serif' }}>🌳 Загрузка...</div>
    </div>
  )
  if (!user) return <AuthPage />
  return (
    <AppProvider key={user.id}>
      <FamilyTreeApp />
    </AppProvider>
  )
}
