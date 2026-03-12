import React, { useState, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { saveOnboarding } from '../../utils/storage';

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const { addPerson, setPhoto, dispatch } = useApp();
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function handleStart() {
    setStep(1);
  }

  function handleCreateMe() {
    if (!firstName.trim()) return;
    const me = addPerson({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      isMe: true,
      gender: 'unknown',
      x: 500,
      y: 300,
    });
    if (photoPreview) setPhoto(me.id, photoPreview);
    dispatch({ type: 'REMOVE_DEMO' });
    setStep(2);
  }

  function handleFinish() {
    saveOnboarding(true);
    dispatch({ type: 'FINISH_ONBOARDING' });
    dispatch({ type: 'SET_SHOW_TUTORIAL', value: true });
    onComplete();
  }

  function handleSkip() {
    saveOnboarding(true);
    dispatch({ type: 'FINISH_ONBOARDING' });
    onComplete();
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'linear-gradient(135deg, #0a0a1a 0%, #0f1b35 50%, #0a1628 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Georgia, serif',
    }}>
      {/* Animated stars */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: Math.random() * 2 + 1,
            height: Math.random() * 2 + 1,
            borderRadius: '50%',
            background: 'white',
            opacity: Math.random() * 0.6 + 0.2,
            animation: `twinkle ${Math.random() * 3 + 2}s infinite alternate`,
          }} />
        ))}
      </div>

      <style>{`
        @keyframes twinkle { from { opacity: 0.2; } to { opacity: 0.8; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
      `}</style>

      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: 500, width: '100%', padding: 24,
        animation: 'fadeInUp 0.6s ease-out',
      }}>

        {step === 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16, animation: 'pulse 3s infinite' }}>🌳</div>
            <h1 style={{ color: '#e2e8f0', fontSize: 28, margin: '0 0 12px', fontWeight: 'normal' }}>
              Древо рода
            </h1>
            <p style={{ color: '#64748b', fontSize: 15, margin: '0 0 32px', lineHeight: 1.6 }}>
              Сохраните историю вашей семьи.<br />
              Создайте красивое генеалогическое древо.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button onClick={handleStart} style={primaryBtnStyle}>
                🌱 Начать
              </button>
              <button onClick={handleSkip} style={secondaryBtnStyle}>
                Перейти к демо-версии
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>👤</div>
              <h2 style={{ color: '#e2e8f0', fontSize: 22, margin: '0 0 8px', fontWeight: 'normal' }}>
                Давайте начнём с вас
              </h2>
              <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Введите ваше имя</p>
            </div>

            {/* Photo */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  width: 80, height: 80, borderRadius: '50%',
                  border: '2px dashed rgba(148,163,184,0.4)',
                  cursor: 'pointer', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.05)',
                  transition: 'border-color 0.2s',
                }}
              >
                {photoPreview
                  ? <img src={photoPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 28, opacity: 0.6 }}>📷</span>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhotoChange} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <input
                autoFocus
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Имя *"
                onKeyDown={e => e.key === 'Enter' && handleCreateMe()}
                style={inputStyle}
              />
              <input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Фамилия"
                onKeyDown={e => e.key === 'Enter' && handleCreateMe()}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleCreateMe} disabled={!firstName.trim()} style={{ ...primaryBtnStyle, flex: 1, opacity: firstName.trim() ? 1 : 0.5 }}>
                Продолжить →
              </button>
              <button onClick={handleSkip} style={{ ...secondaryBtnStyle, flex: '0 0 auto', padding: '12px 16px' }}>
                Пропустить
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ color: '#e2e8f0', fontSize: 22, margin: '0 0 12px', fontWeight: 'normal' }}>
              Добро пожаловать, {firstName}!
            </h2>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 20, marginBottom: 24, textAlign: 'left' }}>
              <div style={{ color: '#94a3b8', fontSize: 14, marginBottom: 12, fontWeight: 'bold' }}>Как пользоваться:</div>
              <div style={{ color: '#64748b', fontSize: 13, lineHeight: 2 }}>
                <div>➕ Нажмите <strong style={{ color: '#93c5fd' }}>+</strong> чтобы добавить родственника</div>
                <div>✏️ <strong style={{ color: '#93c5fd' }}>Двойной клик</strong> по узлу для редактирования</div>
                <div>✋ <strong style={{ color: '#93c5fd' }}>Перетащите</strong> узлы для перемещения</div>
                <div>🔍 <strong style={{ color: '#93c5fd' }}>Колесо мыши</strong> или pinch для масштаба</div>
              </div>
            </div>
            <button onClick={handleFinish} style={primaryBtnStyle}>
              🌳 Открыть моё древо
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '14px 28px', borderRadius: 50, border: 'none',
  background: 'linear-gradient(135deg, rgba(59,130,246,0.4) 0%, rgba(139,92,246,0.4) 100%)',
  color: '#e2e8f0', cursor: 'pointer', fontSize: 15,
  fontFamily: 'Georgia, serif',
  border: '1px solid rgba(148,163,184,0.2)',
  transition: 'all 0.2s',
} as any;

const secondaryBtnStyle: React.CSSProperties = {
  padding: '14px 28px', borderRadius: 50,
  background: 'transparent',
  border: '1px solid rgba(148,163,184,0.15)',
  color: '#64748b', cursor: 'pointer', fontSize: 14,
  fontFamily: 'Georgia, serif',
};

const inputStyle: React.CSSProperties = {
  padding: '12px 16px', borderRadius: 10,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(148,163,184,0.2)',
  color: '#e2e8f0', fontSize: 15, fontFamily: 'Georgia, serif',
  outline: 'none',
};
