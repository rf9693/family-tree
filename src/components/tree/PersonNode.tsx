import React, { useRef, useCallback } from 'react';
import { Person } from '../../types';
import { useApp } from '../../store/AppContext';

interface PersonNodeProps {
  person: Person;
  isSelected: boolean;
  isFiltered: boolean;
  zoom: number;
}

const genderColors = {
  male: { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd', initials: '#60a5fa' },
  female: { bg: '#3d1a3d', border: '#c084fc', text: '#e879f9', initials: '#d946ef' },
  other: { bg: '#1a3a2a', border: '#34d399', text: '#6ee7b7', initials: '#10b981' },
  unknown: { bg: '#2d2d2d', border: '#6b7280', text: '#9ca3af', initials: '#6b7280' },
};

export function PersonNode({ person, isSelected, isFiltered, zoom }: PersonNodeProps) {
  const { dispatch, state } = useApp();
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const isDragging = useRef(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout>>();
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();

  const colors = genderColors[person.gender];
  const photo = state.photos[person.id];

  const initials = [person.firstName?.[0], person.lastName?.[0]]
    .filter(Boolean)
    .join('')
    .toUpperCase() || '?';

  const years = (() => {
    const b = person.birthDate ? person.birthDate.slice(0, 4) : '';
    const d = person.deathDate ? person.deathDate.slice(0, 4) : '';
    if (b && d) return `${b}–${d}`;
    if (b) return `${b}–`;
    return '';
  })();

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    dragStart.current = { x: e.clientX, y: e.clientY, px: person.x, py: person.y };
    isDragging.current = false;

    const onMove = (me: MouseEvent) => {
      if (!dragStart.current) return;
      const dx = (me.clientX - dragStart.current.x) / zoom;
      const dy = (me.clientY - dragStart.current.y) / zoom;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        isDragging.current = true;
        dispatch({
          type: 'MOVE_PERSON',
          id: person.id,
          x: dragStart.current.px + dx,
          y: dragStart.current.py + dy,
        });
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!isDragging.current) {
        // single click
        dispatch({ type: 'SELECT', id: person.id });
      }
      dragStart.current = null;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [person, zoom, dispatch]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'EDIT', id: person.id });
  }, [person.id, dispatch]);

  // Touch support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragStart.current = { x: touch.clientX, y: touch.clientY, px: person.x, py: person.y };
    isDragging.current = false;

    longPressTimer.current = setTimeout(() => {
      // Long press triggers native contextmenu via custom event
      const event = new MouseEvent('contextmenu', { bubbles: true, clientX: touch.clientX, clientY: touch.clientY });
      (e.target as Element).dispatchEvent(event);
    }, 600);
  }, [person]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragStart.current) return;
    clearTimeout(longPressTimer.current);
    const touch = e.touches[0];
    const dx = (touch.clientX - dragStart.current.x) / zoom;
    const dy = (touch.clientY - dragStart.current.y) / zoom;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      isDragging.current = true;
      dispatch({ type: 'MOVE_PERSON', id: person.id, x: dragStart.current.px + dx, y: dragStart.current.py + dy });
    }
  }, [person, zoom, dispatch]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    clearTimeout(longPressTimer.current);
    if (!isDragging.current) {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        dispatch({ type: 'EDIT', id: person.id });
      } else {
        dispatch({ type: 'SELECT', id: person.id });
        clickTimer.current = setTimeout(() => { clickTimer.current = undefined; }, 300);
      }
    }
    dragStart.current = null;
    isDragging.current = false;
  }, [person.id, dispatch]);

  const w = 160;
  const h = 80;

  return (
    <g
      data-person-id={person.id}
      transform={`translate(${person.x - w / 2}, ${person.y - h / 2})`}
      style={{ cursor: 'grab', opacity: isFiltered ? 0.3 : 1 }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Shadow */}
      <rect x={3} y={3} width={w} height={h} rx={12} fill="rgba(0,0,0,0.4)" />

      {/* Background */}
      <rect
        width={w}
        height={h}
        rx={12}
        fill={colors.bg}
        stroke={isSelected ? '#f59e0b' : person.isMe ? '#f59e0b' : colors.border}
        strokeWidth={isSelected ? 3 : person.isMe ? 2 : 1.5}
        style={{ filter: isSelected ? 'drop-shadow(0 0 8px rgba(245,158,11,0.6))' : 'none' }}
      />

      {/* Photo circle */}
      <clipPath id={`clip-${person.id}`}>
        <circle cx={40} cy={h / 2} r={26} />
      </clipPath>
      {photo ? (
        <image
          href={photo}
          x={14}
          y={h / 2 - 26}
          width={52}
          height={52}
          clipPath={`url(#clip-${person.id})`}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : (
        <>
          <circle cx={40} cy={h / 2} r={26} fill={`${colors.initials}22`} stroke={colors.border} strokeWidth={1} />
          <text
            x={40}
            y={h / 2 + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={14}
            fontWeight="700"
            fill={colors.initials}
            fontFamily="Georgia, serif"
          >
            {initials}
          </text>
        </>
      )}

      {/* Name */}
      <text
        x={75}
        y={h / 2 - 10}
        fontSize={12}
        fontWeight="600"
        fill={colors.text}
        fontFamily="Georgia, serif"
        style={{ pointerEvents: 'none' }}
      >
        <tspan>{person.firstName}</tspan>
      </text>
      {person.lastName && (
        <text
          x={75}
          y={h / 2 + 5}
          fontSize={11}
          fill={colors.text}
          fontFamily="Georgia, serif"
          style={{ pointerEvents: 'none', opacity: 0.8 }}
        >
          {person.lastName}
        </text>
      )}
      {years && (
        <text
          x={75}
          y={h / 2 + 20}
          fontSize={9}
          fill={colors.text}
          fontFamily="Georgia, serif"
          style={{ pointerEvents: 'none', opacity: 0.6 }}
        >
          {years}
        </text>
      )}

      {/* Notes indicator */}
      {person.notes && (
        <circle cx={w - 10} cy={10} r={4} fill="#f59e0b" />
      )}

      {/* Private indicator */}
      {person.privacy === 'private' && (
        <text x={w - 22} y={h - 8} fontSize={10} fill="#6b7280">🔒</text>
      )}

      {/* Me indicator */}
      {person.isMe && (
        <rect x={w / 2 - 10} y={h - 6} width={20} height={4} rx={2} fill="#f59e0b" />
      )}
    </g>
  );
}
