import React, { useState, useEffect, useRef } from 'react';
import { Person, Gender, Privacy, Relation } from '../../types';
import { useApp, generateId } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { t } from '../../i18n';

interface PersonDialogProps {
  personId: string | null;
  onClose: () => void;
  onSave?: (person: Person, isNew: boolean) => void;
  onDelete?: (id: string) => void;
  onSaveRelation?: (relation: Relation) => void;
  onDeleteRelation?: (id: string) => void;
  newPersonPreset?: { x: number; y: number } | null;
}

export function PersonDialog({ personId, onClose, onSave, onDelete, onSaveRelation, onDeleteRelation, newPersonPreset }: PersonDialogProps) {
  const { state, dispatch, updatePerson, deletePerson, setPhoto, addPerson, addRelation } = useApp();
  const { user } = useAuth();
  const isNew = personId === '__new__';
  const person = isNew ? null : state.tree.persons.find(p => p.id === personId);

  const [form, setForm] = useState<Partial<Person>>({
    firstName: '',
    lastName: '',
    gender: 'unknown',
    privacy: 'public',
    birthDate: '',
    deathDate: '',
    birthPlace: '',
    notes: '',
  });
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'basic' | 'relations' | 'notes'>('basic');
  const [relationTarget, setRelationTarget] = useState('');
  const [relationType, setRelationType] = useState<'parent-child' | 'spouse' | 'sibling'>('parent-child');
  const [relationDir, setRelationDir] = useState<'from' | 'to'>('from');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (person) {
      setForm({ ...person });
      setPhotoPreview(state.photos[person.id] || '');
    }
  }, [person, personId]);

  function handleSave() {
    if (isNew) {
      const newP = addPerson({ 
        ...form as Partial<Person>, 
        createdBy: user?.id,
        ...(newPersonPreset || {}) 
      });
      if (photoPreview) setPhoto(newP.id, photoPreview);
      onSave?.(newP, true);
    } else if (person) {
      const updated = { ...person, ...form } as Person;
      updatePerson(updated);
      if (photoPreview && photoPreview !== state.photos[person.id]) {
        setPhoto(person.id, photoPreview);
      }
      onSave?.(updated, false);
    }
    onClose();
  }

  function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    if (person) {
      onDelete ? onDelete(person.id) : deletePerson(person.id);
    }
    onClose();
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleAddRelation() {
    if (!relationTarget || !person) return;
    let relData: Omit<Relation, 'id' | 'createdBy'>;
    if (relationType === 'parent-child') {
      relData = { 
        type: 'parent-child', 
        sourceId: relationDir === 'from' ? person.id : relationTarget, 
        targetId: relationDir === 'from' ? relationTarget : person.id
      };
    } else {
      relData = { 
        type: relationType, 
        sourceId: person.id, 
        targetId: relationTarget
      };
    }
    
    // Создаем полную связь с ID и createdBy
    const fullRelation: Relation = {
      id: generateId(),
      createdBy: user?.id,
      ...relData
    };
    
    // Используем onSaveRelation вместо addRelation для правильной синхронизации
    onSaveRelation?.(fullRelation);
    setRelationTarget('');
  }

  const existingRelations = person
    ? state.tree.relations.filter(r => r.sourceId === person.id || r.targetId === person.id)
    : [];

  const personMap = new Map(state.tree.persons.map(p => [p.id, p]));

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        border: '1px solid rgba(148,163,184,0.2)',
        borderRadius: 16,
        width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px rgba(0,0,0,0.8)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Photo */}
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: photoPreview ? 'transparent' : 'rgba(255,255,255,0.1)',
              border: '2px dashed rgba(148,163,184,0.4)',
              cursor: 'pointer', overflow: 'hidden', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {photoPreview
              ? <img src={photoPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 24 }}>📷</span>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhotoChange} />

          <div style={{ flex: 1 }}>
            <h2 style={{ color: '#e2e8f0', fontFamily: 'Georgia, serif', fontSize: 18, margin: 0 }}>
              {isNew ? t('addPerson') : `${form.firstName} ${form.lastName}`}
            </h2>
          </div>

          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '12px 24px 0', gap: 8 }}>
          {(['basic', 'relations', 'notes'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13,
                background: activeTab === tab ? 'rgba(148,163,184,0.2)' : 'transparent',
                color: activeTab === tab ? '#e2e8f0' : '#64748b',
                fontFamily: 'Georgia, serif',
              }}
            >
              {tab === 'basic' ? '📋 Основное' : tab === 'relations' ? '🔗 Связи' : '📝 Заметки'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {activeTab === 'basic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label={t('firstName')} value={form.firstName || ''} onChange={v => setForm(f => ({ ...f, firstName: v }))} />
                <FormField label={t('lastName')} value={form.lastName || ''} onChange={v => setForm(f => ({ ...f, lastName: v }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label={t('birthDate')} value={form.birthDate || ''} onChange={v => setForm(f => ({ ...f, birthDate: v }))} placeholder="1990" />
                <FormField label={t('deathDate')} value={form.deathDate || ''} onChange={v => setForm(f => ({ ...f, deathDate: v }))} placeholder="2024" />
              </div>
              <FormField label={t('birthPlace')} value={form.birthPlace || ''} onChange={v => setForm(f => ({ ...f, birthPlace: v }))} />

              <div>
                <label style={labelStyle}>{t('gender')}</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {(['male', 'female', 'other', 'unknown'] as Gender[]).map(g => (
                    <button
                      key={g}
                      onClick={() => setForm(f => ({ ...f, gender: g }))}
                      style={{
                        padding: '4px 12px', borderRadius: 12, border: '1px solid',
                        borderColor: form.gender === g ? '#3b82f6' : 'rgba(148,163,184,0.2)',
                        background: form.gender === g ? 'rgba(59,130,246,0.2)' : 'transparent',
                        color: form.gender === g ? '#93c5fd' : '#64748b',
                        cursor: 'pointer', fontSize: 12,
                      }}
                    >
                      {g === 'male' ? '♂' : g === 'female' ? '♀' : g === 'other' ? '⚧' : '?'} {t(g as any)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>{t('privacy')}</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {(['public', 'private'] as Privacy[]).map(pv => (
                    <button key={pv} onClick={() => setForm(f => ({ ...f, privacy: pv }))}
                      style={{
                        padding: '4px 12px', borderRadius: 12, border: '1px solid',
                        borderColor: form.privacy === pv ? '#3b82f6' : 'rgba(148,163,184,0.2)',
                        background: form.privacy === pv ? 'rgba(59,130,246,0.2)' : 'transparent',
                        color: form.privacy === pv ? '#93c5fd' : '#64748b',
                        cursor: 'pointer', fontSize: 12,
                      }}
                    >
                      {pv === 'public' ? '🌍' : '🔒'} {t(pv as any)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'relations' && !isNew && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Existing relations */}
              {existingRelations.length > 0 && (
                <div>
                  <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>Существующие связи</div>
                  {existingRelations.map(rel => {
                    const otherId = rel.sourceId === person?.id ? rel.targetId : rel.sourceId;
                    const other = personMap.get(otherId);
                    const typeIcon = rel.type === 'spouse' ? '💍' : rel.type === 'parent-child' ? (rel.sourceId === person?.id ? '👶' : '👴') : '👥';
                    return (
                      <div key={rel.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: 8, marginBottom: 4 }}>
                        <span>{typeIcon}</span>
                        <span style={{ color: '#e2e8f0', flex: 1, fontSize: 13 }}>{other ? `${other.firstName} ${other.lastName}` : 'Unknown'}</span>
                        <button onClick={() => { onDeleteRelation?.(rel.id); }}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>✕</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add new relation */}
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 12 }}>
                <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>Добавить связь</div>
                <select
                  value={relationType}
                  onChange={e => setRelationType(e.target.value as any)}
                  style={selectStyle}
                >
                  <option value="parent-child">Родитель-ребёнок</option>
                  <option value="spouse">Супруги</option>
                  <option value="sibling">Братья/сёстры</option>
                </select>
                {relationType === 'parent-child' && (
                  <select value={relationDir} onChange={e => setRelationDir(e.target.value as any)} style={{ ...selectStyle, marginTop: 8 }}>
                    <option value="from">Я — родитель</option>
                    <option value="to">Я — ребёнок</option>
                  </select>
                )}
                <select value={relationTarget} onChange={e => setRelationTarget(e.target.value)} style={{ ...selectStyle, marginTop: 8 }}>
                  <option value="">Выберите человека...</option>
                  {state.tree.persons.filter(p => p.id !== person?.id).map(p => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                  ))}
                </select>
                <button onClick={handleAddRelation} style={{ ...btnStyle, marginTop: 8, width: '100%' }}>
                  + Добавить связь
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <textarea
              value={form.notes || ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Заметки о человеке..."
              rows={8}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: 8, color: '#e2e8f0', padding: 12, fontSize: 14,
                resize: 'vertical', fontFamily: 'Georgia, serif', boxSizing: 'border-box',
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px 20px', display: 'flex', gap: 8, borderTop: '1px solid rgba(148,163,184,0.1)' }}>
          <button onClick={handleSave} style={{ ...btnStyle, flex: 1, background: 'rgba(59,130,246,0.3)' }}>
            ✓ {t('save')}
          </button>
          {!isNew && onDelete && (
            <button
              onClick={handleDelete}
              style={{ ...btnStyle, background: deleteConfirm ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.15)', color: '#fca5a5' }}
            >
              {deleteConfirm ? '⚠️ Точно?' : '🗑️'}
            </button>
          )}
          <button onClick={onClose} style={{ ...btnStyle, background: 'rgba(255,255,255,0.08)' }}>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' };
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: 8, color: '#e2e8f0', padding: '8px 12px', fontSize: 14,
  fontFamily: 'Georgia, serif', boxSizing: 'border-box',
};
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
const btnStyle: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.2)',
  color: '#e2e8f0', cursor: 'pointer', fontSize: 13, fontFamily: 'Georgia, serif',
};

function FormField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, marginTop: 4 }}
      />
    </div>
  );
}
