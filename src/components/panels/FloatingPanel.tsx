import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { useApp, generateId } from '../../store/AppContext';
import { t } from '../../i18n';
import { exportJSON, importJSON } from '../../utils/json';
import { exportGEDCOM, parseGEDCOM } from '../../utils/gedcom';
import { Person, Relation } from '../../types';

interface FloatingPanelProps {
  onAddPerson: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canImport: boolean;
  onImport: (persons: Person[], relations: Relation[], label: string) => void;
}

export function FloatingPanel({ onAddPerson, onUndo, onRedo, canUndo, canRedo, canImport, onImport }: FloatingPanelProps) {
  const { state, dispatch } = useApp();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const importGEDRef = useRef<HTMLInputElement>(null);

  function toggleMenu(name: string) {
    setOpenMenu(prev => prev === name ? null : name);
  }

  function handleExportJSON() {
    download('family-tree.json', exportJSON(state.tree), 'application/json');
    setOpenMenu(null);
  }

  function handleExportGEDCOM() {
    const ged = exportGEDCOM(state.tree.persons, state.tree.relations);
    download('family-tree.ged', ged, 'text/plain');
    setOpenMenu(null);
  }

  function readFile(e: React.ChangeEvent<HTMLInputElement>, parse: (text: string) => { persons: Person[]; relations: Relation[] }) {
    const input = e.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const { persons, relations } = parse(ev.target?.result as string);
        if (!persons.length) { toast.error('В файле нет людей'); return; }
        if (!confirm(`Добавить в древо ${persons.length} чел. и ${relations.length} связей из «${file.name}»?`)) return;
        onImport(persons, relations, file.name);
      } catch (err) {
        toast.error(`Ошибка импорта: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
  }

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => readFile(e, importJSON);
  const handleImportGEDCOM = (e: React.ChangeEvent<HTMLInputElement>) => readFile(e, text => parseGEDCOM(text, generateId));

  function handleFitAll() {
    dispatch({ type: 'SET_PAN', x: 0, y: 0 });
    dispatch({ type: 'SET_ZOOM', zoom: 0.8 });
  }


  return (
    <>
      <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportJSON} />
      <input ref={importGEDRef} type="file" accept=".ged,.gedcom" style={{ display: 'none' }} onChange={handleImportGEDCOM} />

      {/* Main floating toolbar */}
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 8, alignItems: 'center',
        background: 'rgba(15,20,40,0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(148,163,184,0.15)',
        borderRadius: 50,
        padding: '8px 16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: 50,
      }}>
        {/* Undo/Redo */}
        <PanelBtn onClick={onUndo} disabled={!canUndo} title="Отменить (Ctrl+Z)">↩</PanelBtn>
        <PanelBtn onClick={onRedo} disabled={!canRedo} title="Повторить (Ctrl+Y)">↪</PanelBtn>

        <div style={{ width: 1, height: 24, background: 'rgba(148,163,184,0.15)', margin: '0 4px' }} />

        {/* Add person */}
        <PanelBtn onClick={onAddPerson} primary title={t('addPerson')}>+</PanelBtn>

        <div style={{ width: 1, height: 24, background: 'rgba(148,163,184,0.15)', margin: '0 4px' }} />

        {/* Zoom controls */}
        <PanelBtn onClick={() => dispatch({ type: 'SET_ZOOM', zoom: state.zoom * 1.2 })} title={t('zoomIn')}>⊕</PanelBtn>
        <span style={{ color: '#64748b', fontSize: 12, minWidth: 40, textAlign: 'center' }}>{Math.round(state.zoom * 100)}%</span>
        <PanelBtn onClick={() => dispatch({ type: 'SET_ZOOM', zoom: state.zoom * 0.8 })} title={t('zoomOut')}>⊖</PanelBtn>
        <PanelBtn onClick={handleFitAll} title={t('fitAll')}>⊡</PanelBtn>

        <div style={{ width: 1, height: 24, background: 'rgba(148,163,184,0.15)', margin: '0 4px' }} />

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <PanelBtn onClick={() => toggleMenu('search')} active={openMenu === 'search'} title={t('search')}>🔍</PanelBtn>
          {openMenu === 'search' && (
            <FloatingMenu style={{ bottom: 52, left: '50%', transform: 'translateX(-50%)', width: 220 }}>
              <input
                autoFocus
                value={state.searchQuery}
                onChange={e => dispatch({ type: 'SET_SEARCH', query: e.target.value })}
                placeholder={t('search') + '...'}
                style={searchInputStyle}
              />
              <label style={checkboxStyle}>
                <input type="checkbox" checked={state.filterAlive} onChange={e => dispatch({ type: 'SET_FILTER_ALIVE', value: e.target.checked })} />
                <span style={{ color: '#94a3b8', fontSize: 13 }}>Только живые</span>
              </label>
            </FloatingMenu>
          )}
        </div>

        {/* Export */}
        <div style={{ position: 'relative' }}>
          <PanelBtn onClick={() => toggleMenu('export')} active={openMenu === 'export'} title={t('export')}>📤</PanelBtn>
          {openMenu === 'export' && (
            <FloatingMenu style={{ bottom: 52, right: 0 }}>
              <MenuBtn onClick={handleExportJSON}>📄 {t('exportJSON')}</MenuBtn>
              <MenuBtn onClick={handleExportGEDCOM}>🌳 {t('exportGEDCOM')}</MenuBtn>
              {canImport && (
                <>
                  <div style={{ height: 1, background: 'rgba(148,163,184,0.1)', margin: '4px 0' }} />
                  <MenuBtn onClick={() => { importRef.current?.click(); setOpenMenu(null); }}>📥 {t('importJSON')}</MenuBtn>
                  <MenuBtn onClick={() => { importGEDRef.current?.click(); setOpenMenu(null); }}>📥 {t('importGEDCOM')}</MenuBtn>
                </>
              )}
            </FloatingMenu>
          )}
        </div>

        {/* Lang */}
        <div style={{ position: 'relative' }}>
          <PanelBtn onClick={() => toggleMenu('lang')} active={openMenu === 'lang'} title="Language" style={{ fontSize: 11 }}>
            {state.lang.toUpperCase()}
          </PanelBtn>
          {openMenu === 'lang' && (
            <FloatingMenu style={{ bottom: 52, right: 0 }}>
              {(['ru', 'en', 'de'] as const).map(lang => (
                <MenuBtn key={lang} onClick={() => { dispatch({ type: 'SET_LANG', lang }); setOpenMenu(null); }}>
                  {lang === 'ru' ? '🇷🇺 Русский' : lang === 'en' ? '🇬🇧 English' : '🇩🇪 Deutsch'}
                </MenuBtn>
              ))}
            </FloatingMenu>
          )}
        </div>
      </div>

    </>
  );
}

interface PanelBtnProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  active?: boolean;
  title?: string;
  style?: React.CSSProperties;
}

function PanelBtn({ children, onClick, disabled, primary, active, title, style }: PanelBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 36, height: 36, borderRadius: '50%', border: 'none',
        background: primary ? 'rgba(59,130,246,0.3)' : active ? 'rgba(255,255,255,0.1)' : 'transparent',
        color: disabled ? '#334155' : primary ? '#93c5fd' : '#94a3b8',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function FloatingMenu({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      position: 'absolute',
      background: 'rgba(15,20,40,0.98)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(148,163,184,0.15)',
      borderRadius: 10, padding: 8,
      minWidth: 180,
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      zIndex: 60,
      ...style,
    }}>
      {children}
    </div>
  );
}

function MenuBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%', textAlign: 'left',
      background: 'none', border: 'none', color: '#94a3b8',
      padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
      fontSize: 13, fontFamily: 'Georgia, serif',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      {children}
    </button>
  );
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const searchInputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: 8, color: '#e2e8f0', padding: '7px 12px', fontSize: 13,
  fontFamily: 'Georgia, serif', boxSizing: 'border-box', marginBottom: 8,
};

const checkboxStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 4px',
};
