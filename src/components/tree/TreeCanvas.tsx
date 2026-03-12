import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { PersonNode } from './PersonNode';
import { RelationLines } from './RelationLines';

export function TreeCanvas() {
  const { state, dispatch } = useApp();
  const svgRef = useRef<SVGSVGElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [dimensions, setDimensions] = useState({ w: window.innerWidth, h: window.innerHeight });

  // Pinch zoom
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

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    dispatch({ type: 'SET_ZOOM', zoom: state.zoom * (1 + delta) });
  }, [state.zoom, dispatch]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Only pan if clicking on background
    if ((e.target as SVGElement).tagName === 'svg' || (e.target as SVGElement).tagName === 'rect' && (e.target as SVGElement).getAttribute('data-bg')) {
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY };
      dispatch({ type: 'SELECT', id: null });
    }
  }, [state.panX, state.panY, dispatch]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    dispatch({ type: 'SET_PAN', x: panStart.current.panX + dx, y: panStart.current.panY + dy });
  }, [dispatch]);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

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
      if (lastDist.current > 0) {
        const scale = dist / lastDist.current;
        dispatch({ type: 'SET_ZOOM', zoom: state.zoom * scale });
      }
      lastDist.current = dist;
    } else if (e.touches.length === 1 && isPanning.current) {
      const dx = e.touches[0].clientX - panStart.current.x;
      const dy = e.touches[0].clientY - panStart.current.y;
      dispatch({ type: 'SET_PAN', x: panStart.current.panX + dx, y: panStart.current.panY + dy });
    }
  }, [state.zoom, dispatch]);

  const handleTouchEnd = useCallback(() => {
    isPanning.current = false;
    lastDist.current = 0;
  }, []);

  // Double tap to center
  const lastTap = useRef(0);
  const handleDoubleTap = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      dispatch({ type: 'SET_PAN', x: 0, y: 0 });
      dispatch({ type: 'SET_ZOOM', zoom: 1 });
    }
    lastTap.current = now;
  }, [dispatch]);

  // Filter persons
  const filtered = state.tree.persons.filter(p => {
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      if (!`${p.firstName} ${p.lastName}`.toLowerCase().includes(q)) return false;
    }
    if (state.filterAlive && p.deathDate) return false;
    return true;
  });
  const filteredIds = new Set(filtered.map(p => p.id));

  // Debug: check for duplicates
  const personIds = state.tree.persons.map(p => p.id);
  const duplicateIds = personIds.filter((id, index) => personIds.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    console.warn('Duplicate person IDs found:', duplicateIds);
  }

  const relationIds = state.tree.relations.map(r => r.id);
  const duplicateRelIds = relationIds.filter((id, index) => relationIds.indexOf(id) !== index);
  if (duplicateRelIds.length > 0) {
    console.warn('Duplicate relation IDs found:', duplicateRelIds);
  }

  const transform = `translate(${state.panX}, ${state.panY}) scale(${state.zoom})`;

  return (
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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleDoubleTap}
    >
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill="#4a5568" />
        </marker>
        <filter id="blur-bg">
          <feGaussianBlur stdDeviation="0.5" />
        </filter>
      </defs>

      {/* Background grid */}
      <rect data-bg="true" x={0} y={0} width={dimensions.w} height={dimensions.h} fill="transparent" />

      <g transform={transform}>
        {/* Grid dots */}
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="0.8" fill="rgba(255,255,255,0.06)" />
        </pattern>
        <rect x={-5000} y={-5000} width={10000} height={10000} fill="url(#grid)" />

        {/* Relations */}
        <RelationLines
          persons={state.tree.persons.filter((person, index, arr) => arr.findIndex(p => p.id === person.id) === index)}
          relations={state.tree.relations.filter((relation, index, arr) => arr.findIndex(r => r.id === relation.id) === index)}
          selectedId={state.selectedId}
        />

        {/* Person nodes */}
        {state.tree.persons
          .filter((person, index, arr) => arr.findIndex(p => p.id === person.id) === index)
          .map(person => (
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
  );
}
