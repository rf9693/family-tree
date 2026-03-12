import React from 'react';
import { Person, Relation } from '../../types';

interface RelationLinesProps {
  persons: Person[];
  relations: Relation[];
  selectedId: string | null;
}

export function RelationLines({ persons, relations, selectedId }: RelationLinesProps) {
  const personMap = new Map(persons.map(p => [p.id, p]));

  return (
    <g>
      {relations.map(rel => {
        const src = personMap.get(rel.sourceId);
        const tgt = personMap.get(rel.targetId);
        if (!src || !tgt) return null;

        const isHighlighted = selectedId && (rel.sourceId === selectedId || rel.targetId === selectedId);

        if (rel.type === 'spouse') {
          const mx = (src.x + tgt.x) / 2;
          const my = (src.y + tgt.y) / 2;
          return (
            <g key={rel.id}>
              <line
                x1={src.x} y1={src.y}
                x2={tgt.x} y2={tgt.y}
                stroke={isHighlighted ? '#f59e0b' : '#7c6f3e'}
                strokeWidth={isHighlighted ? 2.5 : 1.5}
                strokeDasharray="none"
              />
              {/* Wedding rings */}
              <circle cx={mx - 5} cy={my} r={5} fill="none" stroke={isHighlighted ? '#f59e0b' : '#b8973c'} strokeWidth={1.5} />
              <circle cx={mx + 5} cy={my} r={5} fill="none" stroke={isHighlighted ? '#f59e0b' : '#b8973c'} strokeWidth={1.5} />
            </g>
          );
        }

        if (rel.type === 'parent-child') {
          // Curved line from parent to child
          const dy = tgt.y - src.y;
          const midY = src.y + dy * 0.5;
          const path = `M ${src.x} ${src.y + 40} C ${src.x} ${midY}, ${tgt.x} ${midY}, ${tgt.x} ${tgt.y - 40}`;
          return (
            <path
              key={rel.id}
              d={path}
              fill="none"
              stroke={isHighlighted ? '#f59e0b' : '#4a5568'}
              strokeWidth={isHighlighted ? 2 : 1.5}
              strokeDasharray="6,3"
              markerEnd="url(#arrowhead)"
            />
          );
        }

        if (rel.type === 'sibling') {
          return (
            <line
              key={rel.id}
              x1={src.x} y1={src.y}
              x2={tgt.x} y2={tgt.y}
              stroke={isHighlighted ? '#f59e0b' : '#2d6a4f'}
              strokeWidth={isHighlighted ? 2 : 1.5}
              strokeDasharray="4,4"
            />
          );
        }

        return null;
      })}
    </g>
  );
}
