import React, { useState, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { t } from '../../i18n';
import { exportJSON, exportGEDCOM, importJSON, parseGEDCOM } from '../../utils/storage';
import { FamilyTree } from '../../types';

interface FloatingPanelProps {
  onAddPerson: () => void;
}

export function FloatingPanel({ onAddPerson }: FloatingPanelProps) {
  const { state, dispatch } = useApp();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const importGEDRef = useRef<HTMLInputElement>(null);

  function toggleMenu(name: string) {
    setOpenMenu(prev => prev === name ? null : name);
  }

  async function handleExportJSON() {
    const json = await exportJSON(state.tree, state.photos);
    download('family-tree.json', json, 'application/json');
    setOpenMenu(null);
  }

  function handleExportGEDCOM() {
    const ged = exportGEDCOM(state.tree.persons, state.tree.relations);
    download('family-tree.ged', ged, 'text/plain');
    setOpenMenu(null);
  }

  function handleImportJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const tree = importJSON(ev.target!.result as string) as FamilyTree;
        dispatch({ type: 'SET_TREE', tree });
      } catch { alert('Ошибка импорта JSON'); }
    };
    reader.readAsText(file);
    setOpenMenu(null);
  }

  function handleImportGEDCOM(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const { persons, relations } = parseGEDCOM(ev.target!.result as string);
        dispatch({ type: 'SET_TREE', tree: { ...state.tree, persons, relations, updatedAt: new Date().toISOString() } });
      } catch { alert('Ошибка импорта GEDCOM'); }
    };
    reader.readAsText(file);
    setOpenMenu(null);
  }

  function handleFitAll() {
    dispatch({ type: 'SET_PAN', x: 0, y: 0 });
    dispatch({ type: 'SET_ZOOM', zoom: 0.8 });
  }

  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

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
        <PanelBtn onClick={() => dispatch({ type: 'UNDO' })} disabled={!canUndo} title="Undo (Ctrl+Z)">↩</PanelBtn>
        <PanelBtn onClick={() => dispatch({ type: 'REDO' })} disabled={!canRedo} title="Redo">↪</PanelBtn>

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
              <div style={{ height: 1, background: 'rgba(148,163,184,0.1)', margin: '4px 0' }} />
              <MenuBtn onClick={() => { importRef.current?.click(); setOpenMenu(null); }}>📥 {t('importJSON')}</MenuBtn>
              <MenuBtn onClick={() => { importGEDRef.current?.click(); setOpenMenu(null); }}>📥 {t('importGEDCOM')}</MenuBtn>
            </FloatingMenu>
          )}
        </div>

        {/* Demo remove */}
        {state.isDemoTree && (
          <>
            <div style={{ width: 1, height: 24, background: 'rgba(148,163,184,0.15)', margin: '0 4px' }} />
            <PanelBtn onClick={() => dispatch({ type: 'REMOVE_DEMO' })} title={t('removeDemo')} style={{ color: '#f59e0b', fontSize: 11 }}>
              ✕ Demo
            </PanelBtn>
          </>
        )}

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

      {/* Stats bar */}
      <div style={{
        position: 'fixed', top: 16, right: 16,
        background: 'rgba(15,20,40,0.8)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(148,163,184,0.1)',
        borderRadius: 8, padding: '6px 12px',
        color: '#64748b', fontSize: 12,
        fontFamily: 'Georgia, serif',
      }}>
        👥 {state.tree.persons.length} {t('persons')}
      </div>
    </>
  );
}

function PanelBtn({ children, onClick, disabled, primary, active, title, style }: any) {
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

function FloatingMenu({ children, style }: any) {
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

function MenuBtn({ children, onClick }: any) {
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
  URL.revokeObjectURL(url);
}

const searchInputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: 8, color: '#e2e8f0', padding: '7px 12px', fontSize: 13,
  fontFamily: 'Georgia, serif', boxSizing: 'border-box', marginBottom: 8,
};

const checkboxStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 4px',
};
