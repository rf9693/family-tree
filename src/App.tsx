import React, { useEffect, useState } from 'react'
import { AppProvider, useApp } from './store/AppContext'
import { useAuth } from './store/AuthContext'
import { AuthPage } from './pages/AuthPage'
import { TreeCanvas } from './components/tree/TreeCanvas'
import { PersonDialog } from './components/panels/PersonDialog'
import { FloatingPanel } from './components/panels/FloatingPanel'
import { Tutorial } from './components/panels/Tutorial'
import { HistoryPanel } from './components/panels/HistoryPanel'
import { useSupabaseSync } from './hooks/useSupabaseSync'
import { initDB } from './utils/storage'
import { Person, Relation } from './types'

function FamilyTreeApp() {
  const { user, profile, signOut, isOwner } = useAuth()
  const { state, dispatch } = useApp()
  const [dialogPersonId, setDialogPersonId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const sync = useSupabaseSync(
    (persons, relations) => dispatch({ type: 'LOAD_FROM_DB', persons, relations }),
    (person) => dispatch({ type: 'MERGE_PERSONS', persons: [person] }),
    (person) => dispatch({ type: 'UPDATE_PERSON', person }),
    (id) => dispatch({ type: 'DELETE_PERSON', id }),
    (relation) => dispatch({ type: 'MERGE_RELATIONS', relations: [relation] }),
    (id) => dispatch({ type: 'DELETE_RELATION', id }),
  )

  useEffect(() => { initDB().catch(console.error) }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); dispatch({ type: 'UNDO' }) }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); dispatch({ type: 'REDO' }) }
      }
      if (e.key === 'Escape') { setDialogPersonId(null); dispatch({ type: 'SELECT', id: null }) }
      const tag = (document.activeElement as HTMLElement)?.tagName
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId && !dialogPersonId && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        const p = state.tree.persons.find(p => p.id === state.selectedId)
        if (p && canDelete(p)) {
          dispatch({ type: 'DELETE_PERSON', id: state.selectedId })
          sync.deletePerson(state.selectedId, `${p.firstName} ${p.lastName}`.trim())
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.selectedId, dialogPersonId, isOwner, user])

  // Может ли текущий пользователь удалить человека
  function canDelete(person: Person): boolean {
    return isOwner || person.createdBy === user?.id
  }

  function handleSavePerson(person: Person, isNew: boolean) {
    if (isNew) dispatch({ type: 'MERGE_PERSONS', persons: [person] })
    else dispatch({ type: 'UPDATE_PERSON', person })
    sync.savePersonWithHistory(person, isNew)
  }

  function handleDeletePerson(id: string) {
    const p = state.tree.persons.find(p => p.id === id)
    if (!p || !canDelete(p)) return
    dispatch({ type: 'DELETE_PERSON', id })
    sync.deletePerson(id, `${p.firstName} ${p.lastName}`.trim())
  }

  function handleSaveRelation(relation: Relation) {
    dispatch({ type: 'MERGE_RELATIONS', relations: [relation] })
    sync.saveRelation(relation)
  }

  function handleDeleteRelation(id: string) {
    if (!isOwner) return
    dispatch({ type: 'DELETE_RELATION', id })
    sync.deleteRelation(id)
  }

  const roleBadge = isOwner
    ? { label: '👑 Владелец', color: '#c9a84c', bg: 'rgba(201,168,76,.15)' }
    : { label: '👤 Участник', color: '#64748b', bg: 'rgba(255,255,255,.05)' }

  // Для текущего открытого диалога — может ли пользователь удалять
  const dialogPerson = state.tree.persons.find(p => p.id === (dialogPersonId || state.editingId))
  const canDeleteDialog = dialogPerson ? canDelete(dialogPerson) : false

  return (
    <div style={{ width:'100vw', height:'100vh', overflow:'hidden', background:'linear-gradient(160deg,#060d1f,#0d1a35 40%,#080d20)', position:'relative' }}>
      <style>{`*{box-sizing:border-box}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(148,163,184,.2);border-radius:2px}@keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

      {/* Header */}
      <div style={{ position:'fixed', top:0, left:0, right:0, height:52, background:'rgba(7,9,15,.95)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(148,163,184,.1)', display:'flex', alignItems:'center', padding:'0 16px', gap:12, zIndex:100 }}>
        <div style={{ fontFamily:'Georgia,serif', fontSize:17, color:'#c9a84c' }}>🌳 Древо рода</div>
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#475569' }}>
          <div style={{ width:5, height:5, borderRadius:'50%', background:'#22c55e' }}/>онлайн
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

      {/* Подсказка для участников */}
      {!isOwner && (
        <div style={{ position:'fixed', top:52, left:0, right:0, zIndex:90, background:'rgba(59,130,246,.06)', borderBottom:'1px solid rgba(59,130,246,.12)', padding:'5px 16px', fontSize:11, color:'#475569', textAlign:'center' }}>
          Вы участник — можете добавлять людей и удалять только тех, кого сами добавили
        </div>
      )}

      <div style={{ paddingTop: isOwner ? 52 : 74 }}>
        <TreeCanvas onDeletePerson={handleDeletePerson} />
      </div>

      <FloatingPanel onAddPerson={() => setDialogPersonId('__new__')} />
      {state.showTutorial && <Tutorial />}

      {(dialogPersonId || state.editingId) && (
        <PersonDialog
          personId={dialogPersonId || state.editingId}
          onClose={() => { setDialogPersonId(null); dispatch({ type: 'EDIT', id: null }) }}
          onSave={handleSavePerson}
          onDelete={canDeleteDialog || dialogPersonId === '__new__' ? handleDeletePerson : undefined}
          onSaveRelation={handleSaveRelation}
          onDeleteRelation={isOwner ? handleDeleteRelation : undefined}
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
    <AppProvider>
      <FamilyTreeApp />
    </AppProvider>
  )
}
