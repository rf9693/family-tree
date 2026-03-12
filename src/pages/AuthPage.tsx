import React, { useState } from 'react'
import { useAuth } from '../store/AuthContext'

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  async function handleSubmit() {
    setError(''); setLoading(true)
    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(error.message)
    } else {
      if (!fullName.trim()) { setError('Введите имя'); setLoading(false); return }
      const { error } = await signUp(email, password, fullName)
      if (error) setError(error.message)
      else setSuccess('Проверьте почту для подтверждения регистрации!')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 30% 40%, rgba(201,168,76,.06), transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(59,130,246,.05), transparent 60%), #07090f',
      fontFamily: 'Georgia, serif', padding: 20,
    }}>
      {/* Stars */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            width: Math.random() * 2 + 0.5, height: Math.random() * 2 + 0.5,
            borderRadius: '50%', background: 'white',
            opacity: Math.random() * 0.5 + 0.1,
          }} />
        ))}
      </div>

      <div style={{
        position: 'relative', zIndex: 1,
        background: 'linear-gradient(160deg, #0d1220, #111827)',
        border: '1px solid rgba(148,163,184,.2)',
        borderRadius: 20, padding: '40px 36px',
        width: '100%', maxWidth: 420,
        boxShadow: '0 30px 60px rgba(0,0,0,.8)',
        animation: 'fadeUp .5s ease-out',
      }}>
        <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🌳</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: '#c9a84c', fontWeight: 'normal', margin: 0 }}>
            Древо рода
          </h1>
          <p style={{ color: '#475569', fontSize: 14, marginTop: 6 }}>
            Семейное древо для всей семьи
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', marginBottom: 28, background: 'rgba(255,255,255,.04)', borderRadius: 12, padding: 4 }}>
          {(['login', 'register'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
              style={{
                flex: 1, padding: '9px', border: 'none', borderRadius: 10,
                background: mode === m ? 'rgba(255,255,255,.1)' : 'transparent',
                color: mode === m ? '#e2e8f0' : '#475569',
                cursor: 'pointer', fontSize: 14, fontFamily: 'Georgia, serif',
                transition: 'all .15s',
              }}>
              {m === 'login' ? '🔑 Войти' : '✨ Регистрация'}
            </button>
          ))}
        </div>

        {success ? (
          <div style={{ background: 'rgba(22,163,74,.15)', border: '1px solid rgba(22,163,74,.3)', borderRadius: 12, padding: 16, color: '#86efac', fontSize: 14, textAlign: 'center', lineHeight: 1.6 }}>
            ✅ {success}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'register' && (
              <div>
                <label style={labelStyle}>Ваше имя</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Иван Петров" style={inputStyle}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
              </div>
            )}
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="ivan@example.com" style={inputStyle}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>
            <div>
              <label style={labelStyle}>Пароль</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" style={inputStyle}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 10, padding: '10px 14px', color: '#fca5a5', fontSize: 13 }}>
                ⚠️ {error}
              </div>
            )}

            <button onClick={handleSubmit} disabled={loading} style={{
              padding: '14px', borderRadius: 50, border: '1px solid rgba(201,168,76,.3)',
              background: loading ? 'rgba(201,168,76,.05)' : 'linear-gradient(135deg, rgba(201,168,76,.25), rgba(201,168,76,.1))',
              color: '#c9a84c', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 16, fontFamily: 'Georgia, serif', marginTop: 4,
              transition: 'all .2s',
            }}>
              {loading ? '...' : mode === 'login' ? '→ Войти' : '→ Создать аккаунт'}
            </button>
          </div>
        )}

        <p style={{ textAlign: 'center', color: '#334155', fontSize: 12, marginTop: 24, lineHeight: 1.5 }}>
          Ваши данные хранятся в защищённой базе данных.<br />
          Доступ только для членов вашей семьи.
        </p>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, textTransform: 'uppercase',
  letterSpacing: '.08em', color: '#475569', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(148,163,184,.15)',
  color: '#e2e8f0', fontSize: 15, fontFamily: 'Georgia, serif', outline: 'none',
  transition: 'border-color .15s', boxSizing: 'border-box',
}
