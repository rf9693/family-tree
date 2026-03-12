import React, { useEffect, useCallback, useState } from 'react'
import { useAuth } from './store/AuthContext'
import { AuthPage } from './pages/AuthPage'
import { TreeCanvas } from './components/tree/TreeCanvas'
import { PersonDialog } from './components/panels/PersonDialog'
import { FloatingPanel } from './components/panels/FloatingPanel'
import { Tutorial } from './components/panels/Tutorial'
import { HistoryPanel } from './components/panels/HistoryPanel'
import { useSupabaseSync } from './hooks/useSupabaseSync'
import { AppProvider, useApp } from './store/AppContext'
import { initDB } from './utils/storage'
import { Person, Relation } from './types'

function FamilyTreeApp() {
  const { user, profile, signOut } = useAuth()
  const { state, dispatch } = useApp()
  const [dialogPersonId, setDialogPersonId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const sync = useSupabaseSync(
    (persons: Person[]) => dispatch({ type: 'MERGE_PERSONS', persons }),
    (relations: Relation[]) => dispatch({ type: 'MERGE_RELATIONS', relations }),
    (person: Person) => dispatch({ type: 'ADD_PERSON', person }),
    (person: Person) => dispatch({ type: 'UPDATE_PERSON', person }),
    (id: string) => dispatch({ type: 'DELETE_PERSON', id }),
    (relation: Relation) => dispatch({ type: 'ADD_RELATION', relation }),
    (id: string) => dispatch({ type: 'DELETE_RELATION', id }),
  )

  useEffect(() => { initDB().catch(console.error) }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); dispatch({ type: 'UNDO' }) }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); dispatch({ type: 'REDO' }) }
      }
      if (e.key === 'Escape') { setDialogPersonId(null); dispatch({ type: 'SELECT', id: null }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleSavePerson(person: Person, isNew: boolean) {
    if (isNew) dispatch({ type: 'ADD_PERSON', person })
    else dispatch({ type: 'UPDATE_PERSON', person })
    sync.savePersonWithHistory(person, isNew)
  }

  function handleDeletePerson(id: string) {
    const p = state.tree.persons.find(p => p.id === id)
    const name = p ? `${p.firstName} ${p.lastName}`.trim() : ''
    dispatch({ type: 'DELETE_PERSON', id })
    sync.deletePerson(id, name)
  }

  function handleSaveRelation(relation: Relation) {
    dispatch({ type: 'ADD_RELATION', relation })
    sync.saveRelation(relation)
  }

  function handleDeleteRelation(id: string) {
    dispatch({ type: 'DELETE_RELATION', id })
    sync.deleteRelation(id)
  }

  return (
    <div style={{ width:'100vw', height:'100vh', overflow:'hidden', background:'linear-gradient(160deg,#060d1f,#0d1a35 40%,#080d20)', position:'relative' }}>
      <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}*{box-sizing:border-box}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(148,163,184,.2);border-radius:2px}select option{background:#0f1b35;color:#e2e8f0}`}</style>

      {/* Header */}
      <div style={{ position:'fixed', top:0, left:0, right:0, height:52, background:'rgba(7,9,15,.92)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(148,163,184,.1)', display:'flex', alignItems:'center', padding:'0 20px', gap:16, zIndex:100 }}>
        <div style={{ fontFamily:'Georgia,serif', fontSize:18, color:'#c9a84c', display:'flex', alignItems:'center', gap:8 }}>🌳 Древо рода</div>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#475569' }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e' }}/>онлайн
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:12, color:'#475569' }}>👥 {state.tree.persons.length}</span>
          <button onClick={() => setShowHistory(v => !v)} style={{ display:'flex', alignItems:'center', gap:6, background: showHistory ? 'rgba(201,168,76,.15)' : 'rgba(255,255,255,.05)', border:'1px solid rgba(148,163,184,.15)', borderRadius:8, color: showHistory ? '#c9a84c' : '#94a3b8', cursor:'pointer', padding:'6px 12px', fontSize:13, fontFamily:'Georgia,serif' }}>
            📋 История
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:30, height:30, borderRadius:'50%', background:'rgba(201,168,76,.2)', border:'1px solid rgba(201,168,76,.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#c9a84c', fontWeight:600 }}>
              {(profile?.full_name || user?.email || '?')[0].toUpperCase()}
            </div>
            <span style={{ fontSize:13, color:'#64748b', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {profile?.full_name || user?.email}
            </span>
          </div>
          <button onClick={signOut} style={{ background:'none', border:'1px solid rgba(148,163,184,.1)', borderRadius:8, color:'#475569', cursor:'pointer', padding:'6px 10px', fontSize:12, fontFamily:'Georgia,serif' }}>Выйти</button>
        </div>
      </div>

      <div style={{ paddingTop:52 }}>
        <TreeCanvas />
      </div>
      <FloatingPanel onAddPerson={() => setDialogPersonId('__new__')} />
      {state.showTutorial && <Tutorial />}

      {(dialogPersonId || state.editingId) && (
        <PersonDialog
          personId={dialogPersonId || state.editingId}
          onClose={() => { setDialogPersonId(null); dispatch({ type: 'EDIT', id: null }) }}
          onSave={handleSavePerson}
          onDelete={handleDeletePerson}
          onSaveRelation={handleSaveRelation}
          onDeleteRelation={handleDeleteRelation}
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
  return <FamilyTreeAppWithStore />
}

function FamilyTreeAppWithStore() {
  return (
    <AppProvider initialOnboarding={false}>
      <FamilyTreeApp />
    </AppProvider>
  )
}
