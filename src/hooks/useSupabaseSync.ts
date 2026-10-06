import { useEffect, useCallback, useState } from 'react'
import { supabase, DBPerson, DBRelation } from '../lib/supabase'
import { Person, Relation, Gender, Privacy, RelationType } from '../types'
import { Op, HistoryAction } from '../store/commands'
import { Action } from '../store/AppContext'
import { useAuth } from '../store/AuthContext'

export function dbToLocal(p: DBPerson): Person {
  return {
    id: p.id, firstName: p.first_name ?? '', lastName: p.last_name ?? '',
    birthDate: p.birth_date ?? undefined, deathDate: p.death_date ?? undefined, birthPlace: p.birth_place ?? undefined,
    gender: (p.gender as Gender) || 'unknown', notes: p.notes ?? undefined, privacy: (p.privacy as Privacy) || 'public',
    photo: p.photo_url ?? undefined, x: p.x ?? 0, y: p.y ?? 0, isMe: p.is_me,
    createdBy: p.created_by ?? undefined,
  }
}

function personFields(p: Person) {
  return {
    first_name: p.firstName, last_name: p.lastName,
    birth_date: p.birthDate || null, death_date: p.deathDate || null, birth_place: p.birthPlace || null,
    gender: p.gender, notes: p.notes || null, privacy: p.privacy,
    photo_url: p.photo || null, x: p.x, y: p.y, is_me: p.isMe || false,
  }
}

export function dbToRelation(r: DBRelation): Relation {
  return { id: r.id, type: r.type as RelationType, sourceId: r.source_id, targetId: r.target_id, createdBy: r.created_by ?? undefined }
}

export type LoggedAction = HistoryAction | 'undo' | 'redo'

export function useSupabaseSync(dispatch: React.Dispatch<Action>) {
  const { user, profile, isOwner } = useAuth()
  const [connected, setConnected] = useState(false)
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine)

  const loadAll = useCallback(async () => {
    const [persons, relations] = await Promise.all([
      supabase.from('persons').select('*'),
      supabase.from('relations').select('*'),
    ])
    if (persons.error || relations.error) throw persons.error || relations.error
    dispatch({
      type: 'LOAD_FROM_DB',
      persons: (persons.data as DBPerson[]).map(dbToLocal),
      relations: (relations.data as DBRelation[]).map(dbToRelation),
    })
  }, [dispatch])

  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    const apply = (ops: Op[]) => dispatch({ type: 'APPLY_OPS', ops })

    const channel = supabase.channel('tree-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'persons' }, payload => {
        if (payload.eventType === 'DELETE') apply([{ kind: 'deletePerson', id: (payload.old as DBPerson).id }])
        else apply([{ kind: 'upsertPerson', person: dbToLocal(payload.new as DBPerson) }])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'relations' }, payload => {
        if (payload.eventType === 'DELETE') apply([{ kind: 'deleteRelation', id: (payload.old as DBRelation).id }])
        else apply([{ kind: 'upsertRelation', relation: dbToRelation(payload.new as DBRelation) }])
      })
      .subscribe(status => {
        const ok = status === 'SUBSCRIBED'
        setConnected(ok)
        // Reload after (re)connecting so changes missed while offline are picked up.
        if (ok) loadAll().catch(e => console.error('loadAll error', e))
      })

    return () => { supabase.removeChannel(channel) }
  }, [userId, dispatch, loadAll])

  useEffect(() => {
    const on = () => setBrowserOnline(true)
    const off = () => setBrowserOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const persistOps = useCallback(async (ops: Op[]) => {
    if (!userId) throw new Error('Не выполнен вход')
    for (const op of ops) {
      switch (op.kind) {
        case 'upsertPerson': {
          // Update first so the creator (created_by) of an existing row is never touched.
          const upd = await supabase.from('persons').update(personFields(op.person)).eq('id', op.person.id).select('id')
          if (upd.error) throw upd.error
          if (!upd.data?.length) {
            const ins = await supabase.from('persons').insert({
              id: op.person.id, ...personFields(op.person), created_by: op.person.createdBy || userId,
            })
            if (ins.error) throw ins.error
          }
          break
        }
        case 'movePerson': {
          const { error } = await supabase.from('persons').update({ x: op.x, y: op.y }).eq('id', op.id)
          if (error) throw error
          break
        }
        case 'deletePerson': {
          const { error } = await supabase.from('persons').delete().eq('id', op.id)
          if (error) throw error
          break
        }
        case 'upsertRelation': {
          const r = op.relation
          const { error } = await supabase.from('relations').upsert({
            id: r.id, type: r.type, source_id: r.sourceId, target_id: r.targetId,
            created_by: isOwner && r.createdBy ? r.createdBy : userId,
          })
          if (error) throw error
          break
        }
        case 'deleteRelation': {
          const { error } = await supabase.from('relations').delete().eq('id', op.id)
          if (error) throw error
          break
        }
      }
    }
  }, [userId, isOwner])

  const logHistory = useCallback(async (action: LoggedAction, entityId: string, entityName: string) => {
    if (!user) return
    const { error } = await supabase.from('history').insert({
      user_id: user.id,
      user_name: profile?.full_name || user.email || 'Аноним',
      action, entity_id: entityId || null, entity_name: entityName,
    })
    if (error) console.error('logHistory error', error)
  }, [user, profile])

  return { online: connected && browserOnline, loadAll, persistOps, logHistory }
}
