import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { PersonNode } from './PersonNode';
import { RelationLines } from './RelationLines';
import { ContextMenu } from '../panels/ContextMenu';

interface ContextMenuState {
  x: number;
  y: number;
  personId: string;
}

interface TreeCanvasProps {
  onEditPerson?: (id: string) => void;
  onAddPerson?: () => void;
  onDeletePerson?: (id: string) => void;
}

export function TreeCanvas({ onEditPerson, onDeletePerson }: TreeCanvasProps) {
  const { state, dispatch } = useApp();
  const { isOwner, user } = useAuth();
  const svgRef = useRef<SVGSVGElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [dimensions, setDimensions] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const lastDist = useRef<number>(0);

  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    if (svgRef.current?.parentElement) ro.observe(svgRef.current.parentElement);
    return () => ro.disconnect();
  }, []);

  // Закрывать контекстное меню при нажатии Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    dispatch({ type: 'SET_ZOOM', zoom: state.zoom * (1 + delta) });
  }, [state.zoom, dispatch]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as SVGElement).tagName === 'svg' ||
       ((e.target as SVGElement).tagName === 'rect' && (e.target as SVGElement).getAttribute('data-bg'))) {
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY };
      dispatch({ type: 'SELECT', id: null });
      setContextMenu(null);
    }
  }, [state.panX, state.panY, dispatch]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    dispatch({ type: 'SET_PAN', x: panStart.current.panX + (e.clientX - panStart.current.x), y: panStart.current.panY + (e.clientY - panStart.current.y) });
  }, [dispatch]);

  const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);

  // Правый клик — ищем ближайший узел
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    // Ищем person-id в элементе или его родителях
    let el = e.target as Element | null;
    let personId: string | null = null;
    while (el && el !== svgRef.current) {
      const id = el.getAttribute('data-person-id');
      if (id) { personId = id; break; }
      el = el.parentElement;
    }
    if (personId) {
      setContextMenu({ x: e.clientX, y: e.clientY, personId });
      dispatch({ type: 'SELECT', id: personId });
    } else {
      setContextMenu(null);
    }
  }, [dispatch]);

  // Touch pan/zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastDist.current = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1) {
      isPanning.current = true;
      panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, panX: state.panX, panY: state.panY };
    }
  }, [state.panX, state.panY]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastDist.current > 0) dispatch({ type: 'SET_ZOOM', zoom: state.zoom * (dist / lastDist.current) });
      lastDist.current = dist;
    } else if (e.touches.length === 1 && isPanning.current) {
      dispatch({ type: 'SET_PAN', x: panStart.current.panX + (e.touches[0].clientX - panStart.current.x), y: panStart.current.panY + (e.touches[0].clientY - panStart.current.y) });
    }
  }, [state.zoom, dispatch]);

  const handleTouchEnd = useCallback(() => { isPanning.current = false; lastDist.current = 0; }, []);

  const lastTap = useRef(0);
  const handleDoubleTap = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTap.current < 300) { dispatch({ type: 'SET_PAN', x: 0, y: 0 }); dispatch({ type: 'SET_ZOOM', zoom: 1 }); }
    lastTap.current = now;
  }, [dispatch]);

  const filtered = state.tree.persons.filter(p => {
    if (state.searchQuery && !`${p.firstName} ${p.lastName}`.toLowerCase().includes(state.searchQuery.toLowerCase())) return false;
    if (state.filterAlive && p.deathDate) return false;
    return true;
  });
  const filteredIds = new Set(filtered.map(p => p.id));
  const uniquePersons = state.tree.persons.filter((p, i, a) => a.findIndex(x => x.id === p.id) === i);
  const uniqueRelations = state.tree.relations.filter((r, i, a) => a.findIndex(x => x.id === r.id) === i);

  return (
    <>
      <svg
        ref={svgRef}
        width={dimensions.w}
        height={dimensions.h}
        style={{ background: 'transparent', cursor: isPanning.current ? 'grabbing' : 'default', touchAction: 'none' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleDoubleTap as any}
      >
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="#4a5568" />
          </marker>
        </defs>

        <rect data-bg="true" x={0} y={0} width={dimensions.w} height={dimensions.h} fill="transparent" />

        <g transform={`translate(${state.panX}, ${state.panY}) scale(${state.zoom})`}>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="0" cy="0" r="0.8" fill="rgba(255,255,255,0.06)" />
          </pattern>
          <rect x={-5000} y={-5000} width={10000} height={10000} fill="url(#grid)" />

          <RelationLines persons={uniquePersons} relations={uniqueRelations} selectedId={state.selectedId} />

          {uniquePersons.map(person => (
            <PersonNode
              key={person.id}
              person={person}
              isSelected={person.id === state.selectedId}
              isFiltered={state.searchQuery !== '' || state.filterAlive ? !filteredIds.has(person.id) : false}
              zoom={state.zoom}
            />
          ))}
        </g>
      </svg>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          personId={contextMenu.personId}
          onClose={() => setContextMenu(null)}
          onEdit={() => {
            dispatch({ type: 'EDIT', id: contextMenu.personId });
            setContextMenu(null);
          }}
          onAddRelative={(type) => {
            // Открываем диалог редактирования с предвыбранным типом связи
            dispatch({ type: 'EDIT', id: contextMenu.personId });
            setContextMenu(null);
          }}
          onDelete={() => {
            onDeletePerson?.(contextMenu.personId);
            setContextMenu(null);
          }}
        />
      )}
    </>
  );
}
