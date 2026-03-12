import React, { useEffect } from 'react';
import { useApp } from '../../store/AppContext';

interface ContextMenuProps {
  x: number;
  y: number;
  personId: string;
  onClose: () => void;
  onEdit: () => void;
  onAddRelative: (type: string) => void;
}

export function ContextMenu({ x, y, personId, onClose, onEdit, onAddRelative }: ContextMenuProps) {
  const { deletePerson } = useApp();

  useEffect(() => {
    const handler = () => onClose();
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [onClose]);

  const items = [
    { icon: '✏️', label: 'Редактировать', action: onEdit },
    { icon: '👶', label: 'Добавить ребёнка', action: () => onAddRelative('child') },
    { icon: '👴', label: 'Добавить родителя', action: () => onAddRelative('parent') },
    { icon: '💍', label: 'Добавить супруга/у', action: () => onAddRelative('spouse') },
    { icon: '👥', label: 'Добавить брата/сестру', action: () => onAddRelative('sibling') },
    { divider: true },
    { icon: '🗑️', label: 'Удалить', action: () => { deletePerson(personId); onClose(); }, danger: true },
  ] as any[];

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: x, top: y,
        background: 'rgba(15,20,40,0.98)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(148,163,184,0.15)',
        borderRadius: 10,
        padding: 6,
        minWidth: 200,
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        zIndex: 80,
        animation: 'fadeInUp 0.15s ease-out',
      }}
    >
      {items.map((item, i) => {
        if (item.divider) return <div key={i} style={{ height: 1, background: 'rgba(148,163,184,0.1)', margin: '4px 0' }} />;
        return (
          <button
            key={i}
            onClick={() => { item.action(); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', textAlign: 'left',
              background: 'none', border: 'none',
              color: item.danger ? '#f87171' : '#94a3b8',
              padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
              fontSize: 13, fontFamily: 'Georgia, serif',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = item.danger ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
