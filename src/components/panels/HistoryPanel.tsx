import React, { useEffect, useState } from 'react'
import { supabase, DBHistory } from '../../lib/supabase'

interface HistoryPanelProps {
  onClose: () => void
}

const ACTION_LABELS: Record<string, { icon: string; label: string }> = {
  add_person:    { icon: '➕', label: 'Добавил человека' },
  update_person: { icon: '✏️', label: 'Изменил человека' },
  delete_person: { icon: '🗑️', label: 'Удалил человека' },
  add_relation:  { icon: '🔗', label: 'Добавил связь' },
  delete_relation: { icon: '✂️', label: 'Удалил связь' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins} мин назад`
  if (hours < 24) return `${hours} ч назад`
  if (days < 7) return `${days} дн назад`
  return new Date(dateStr).toLocaleDateString('ru-RU')
}

export function HistoryPanel({ onClose }: HistoryPanelProps) {
  const [history, setHistory] = useState<DBHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
    // Realtime subscription
    const channel = supabase
      .channel('history-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'history' }, payload => {
        setHistory(prev => [payload.new as DBHistory, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadHistory() {
    const { data } = await supabase
      .from('history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    setHistory(data || [])
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: 340, zIndex: 200,
      background: 'linear-gradient(160deg, #0d1220, #0f1827)',
      borderLeft: '1px solid rgba(148,163,184,.15)',
      display: 'flex', flexDirection: 'column',
      boxShadow: '-8px 0 32px rgba(0,0,0,.5)',
      animation: 'slideIn .25s ease-out',
    }}>
      <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

      {/* Header */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(148,163,184,.1)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>📋</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#e2e8f0' }}>История изменений</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{history.length} записей</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, padding: '4px 8px', borderRadius: 6 }}>✕</button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading && <div style={{ color: '#475569', textAlign: 'center', padding: 40, fontSize: 14 }}>Загрузка...</div>}
        {!loading && history.length === 0 && (
          <div style={{ color: '#475569', textAlign: 'center', padding: 40, fontSize: 14, lineHeight: 1.8 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            Изменений пока нет
          </div>
        )}
        {history.map((item, i) => {
          const act = ACTION_LABELS[item.action] || { icon: '•', label: item.action }
          return (
            <div key={item.id} style={{
              display: 'flex', gap: 12, padding: '10px 0',
              borderBottom: i < history.length - 1 ? '1px solid rgba(148,163,184,.06)' : 'none',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(255,255,255,.05)', border: '1px solid rgba(148,163,184,.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}>{act.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.4 }}>
                  <span style={{ color: '#c9a84c', fontWeight: 600 }}>{item.user_name || 'Кто-то'}</span>
                  {' '}{act.label}
                  {item.entity_name && <span style={{ color: '#94a3b8' }}>{' «'}{item.entity_name}{'»'}</span>}
                </div>
                <div style={{ fontSize: 11, color: '#334155', marginTop: 3 }}>{timeAgo(item.created_at)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
