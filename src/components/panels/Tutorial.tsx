import React, { useState } from 'react';
import { useApp } from '../../store/AppContext';

export function Tutorial() {
  const { dispatch } = useApp();
  const [step, setStep] = useState(0);

  const steps = [
    { icon: '➕', text: 'Нажмите кнопку + внизу экрана, чтобы добавить нового человека в ваше древо', highlight: 'add' },
    { icon: '✋', text: 'Перетаскивайте карточки, чтобы расположить древо удобно', highlight: 'drag' },
    { icon: '✏️', text: 'Дважды кликните по карточке, чтобы редактировать информацию', highlight: 'edit' },
    { icon: '🔗', text: 'Используйте панель связей при редактировании, чтобы связать родственников', highlight: 'link' },
  ];

  if (step >= steps.length) return null;

  const current = steps[step];

  return (
    <div style={{
      position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(15,20,40,0.98)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(245,158,11,0.3)',
      borderRadius: 16, padding: '16px 24px',
      maxWidth: 380, width: '90%',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,158,11,0.1)',
      zIndex: 55,
      animation: 'fadeInUp 0.3s ease-out',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <span style={{ fontSize: 28, flexShrink: 0 }}>{current.icon}</span>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#e2e8f0', fontSize: 14, margin: '0 0 12px', lineHeight: 1.5, fontFamily: 'Georgia, serif' }}>
            {current.text}
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4, flex: 1 }}>
              {steps.map((_, i) => (
                <div key={i} style={{
                  width: i === step ? 16 : 6, height: 6, borderRadius: 3,
                  background: i === step ? '#f59e0b' : 'rgba(255,255,255,0.15)',
                  transition: 'all 0.3s',
                }} />
              ))}
            </div>
            <button
              onClick={() => { if (step < steps.length - 1) setStep(s => s + 1); else dispatch({ type: 'SET_SHOW_TUTORIAL', value: false }); }}
              style={{
                padding: '6px 16px', borderRadius: 20, border: 'none',
                background: 'rgba(245,158,11,0.2)', color: '#f59e0b',
                cursor: 'pointer', fontSize: 13, fontFamily: 'Georgia, serif',
              }}
            >
              {step < steps.length - 1 ? 'Далее →' : 'Понятно ✓'}
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_SHOW_TUTORIAL', value: false })}
              style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12 }}
            >
              Пропустить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
