import { useEffect, useCallback } from 'react'
import { supabase, DBPerson, DBRelation } from '../lib/supabase'
import { Person, Relation } from '../types'
import { useAuth } from '../store/AuthContext'

function dbToLocal(p: DBPerson): Person {
  return {
    id: p.id, firstName: p.first_name, lastName: p.last_name,
    birthDate: p.birth_date, deathDate: p.death_date, birthPlace: p.birth_place,
    gender: p.gender as any, notes: p.notes, privacy: p.privacy as any,
    photo: p.photo_url, x: p.x, y: p.y, isMe: p.is_me,
    createdBy: p.created_by,
  }
}

function localToDB(p: Person): Omit<DBPerson, 'created_at' | 'updated_at'> {
  return {
    id: p.id, first_name: p.firstName, last_name: p.lastName,
    birth_date: p.birthDate, death_date: p.deathDate, birth_place: p.birthPlace,
    gender: p.gender, notes: p.notes, privacy: p.privacy,
    photo_url: p.photo, x: p.x, y: p.y, is_me: p.isMe || false,
  }
}

export function useSupabaseSync(
  onLoad: (persons: Person[], relations: Relation[]) => void,
  onPersonAdded: (person: Person) => void,
  onPersonUpdated: (person: Person) => void,
  onPersonDeleted: (id: string) => void,
  onRelationAdded: (relation: Relation) => void,
  onRelationDeleted: (id: string) => void,
) {
  const { user, profile } = useAuth()

  useEffect(() => {
    if (!user) return
    loadAll()

    const personsChannel = supabase.channel('persons-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'persons' }, payload => {
        if (payload.new.created_by !== user.id) onPersonAdded(dbToLocal(payload.new as DBPerson))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'persons' }, payload => {
        if (payload.new.created_by !== user.id) onPersonUpdated(dbToLocal(payload.new as DBPerson))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'persons' }, payload => {
        onPersonDeleted(payload.old.id)
      })
      .subscribe()

    const relationsChannel = supabase.channel('relations-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'relations' }, payload => {
        if (payload.new.created_by !== user.id)
          onRelationAdded({ id: payload.new.id, type: payload.new.type, sourceId: payload.new.source_id, targetId: payload.new.target_id })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'relations' }, payload => {
        onRelationDeleted(payload.old.id)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(personsChannel)
      supabase.removeChannel(relationsChannel)
    }
  }, [user])

  async function loadAll() {
    const [{ data: persons }, { data: relations }] = await Promise.all([
      supabase.from('persons').select('*'),
      supabase.from('relations').select('*'),
    ])
    const up = (persons || []).filter((p, i, a) => a.findIndex(x => x.id === p.id) === i)
    const ur = (relations || []).filter((r, i, a) => a.findIndex(x => x.id === r.id) === i)
    onLoad(
      up.map(dbToLocal),
      ur.map(r => ({ id: r.id, type: r.type, sourceId: r.source_id, targetId: r.target_id }))
    )
  }

  async function logHistory(action: string, entityId: string, entityName: string, details?: any) {
    if (!user) return
    await supabase.from('history').insert({
      user_id: user.id,
      user_name: profile?.full_name || user.email || 'Аноним',
      action, entity_id: entityId, entity_name: entityName, details,
    })
  }

  const savePerson = useCallback(async (person: Person) => {
    if (!user) return
    const { error } = await supabase.from('persons').upsert({ ...localToDB(person), created_by: user.id })
    if (error) console.error('savePerson error', error)
  }, [user])

  const savePersonWithHistory = useCallback(async (person: Person, isNew: boolean) => {
    await savePerson(person)
    const name = `${person.firstName} ${person.lastName}`.trim() || 'Без имени'
    await logHistory(isNew ? 'add_person' : 'update_person', person.id, name)
  }, [savePerson, user, profile])

  const deletePerson = useCallback(async (id: string, name: string) => {
    if (!user) return
    await supabase.from('persons').delete().eq('id', id)
    await logHistory('delete_person', id, name)
  }, [user, profile])

  const saveRelation = useCallback(async (relation: Relation) => {
    if (!user) return
    await supabase.from('relations').upsert({
      id: relation.id, type: relation.type,
      source_id: relation.sourceId, target_id: relation.targetId, created_by: user.id,
    })
    await logHistory('add_relation', relation.id, relation.type)
  }, [user, profile])

  const deleteRelation = useCallback(async (id: string) => {
    if (!user) return
    await supabase.from('relations').delete().eq('id', id)
    await logHistory('delete_relation', id, '')
  }, [user, profile])

  const savePersonPosition = useCallback(async (id: string, x: number, y: number) => {
    if (!user) return
    await supabase.from('persons').update({ x, y }).eq('id', id)
  }, [user])

  return { savePerson, savePersonWithHistory, deletePerson, saveRelation, deleteRelation, savePersonPosition, loadAll }
}
