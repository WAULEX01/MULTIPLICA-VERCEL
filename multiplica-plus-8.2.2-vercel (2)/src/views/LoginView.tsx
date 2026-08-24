// src/views/LoginView.tsx
import { useState } from 'react';
import type { UserSession, AppDatabase } from '../services/db';
import { apiLogin } from '../services/api';
import { KeyRound, ShieldAlert, Lock } from 'lucide-react';

interface LoginViewProps {
  db: AppDatabase;
  onLogin: (session: UserSession) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ db: _db, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    setLoading(true);
    try {
      const session = await apiLogin(username, password);
      if (session) {
        onLogin(session);
      } else {
        setError('Usuário ou Senha incorretos. Verifique as credenciais e tente novamente.');
      }
    } catch (err) {
      console.error('[Login Supabase]', err);
      setError('Não foi possível validar o acesso agora. Confira a conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container animate-fade">
      {/* Left side: Hero Banner Image */}
      <div className="login-hero-side">
        <div className="login-hero-overlay"></div>
        <div className="login-hero-content">
          <img 
            src="logo.png" 
            alt="Multiplica Plus" 
            className="login-hero-logo" 
          />
          <h2>Multiplica PLUS <span className="login-version">v8.2.1</span></h2>
          <p style={{ letterSpacing: '2.5px', fontWeight: 700, color: '#ff9a5f', margin: '0.25rem 0' }}>IEAD - JOTA</p>
          <p style={{ fontSize: '0.85rem', opacity: 0.8, margin: '0.25rem 0' }}>Templo JK</p>
          <div className="login-hero-footer-quote">
            "Acolhendo vidas, multiplicando o Reino."
          </div>
        </div>
      </div>

      {/* Right side: Form Card */}
      <div className="login-form-side">
        <div className="login-form-card">
          <div className="login-form-header">
            <div className="login-mobile-logo-wrapper" style={{ display: 'none', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <img 
                src="logo.png" 
                alt="Multiplica Plus" 
                style={{ width: '210px', height: '210px', objectFit: 'contain', borderRadius: '28px' }} 
              />
            </div>
            <h3>Acesse sua Conta</h3>
            <p>Gerenciamento e discipulado de membros da IEAD-JK</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label htmlFor="login-username">Nome de Usuário</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-username"
                  type="text"
                  className="form-control"
                  placeholder="Ex: PASTOR_WAGNER"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{ paddingLeft: '2.75rem', textTransform: 'uppercase' }}
                  required
                />
                <KeyRound
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '1.1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--power-muted)'
                  }}
                />
              </div>
            </div>

            <div className="form-group" style={{ textAlign: 'left', marginTop: '1.25rem' }}>
              <label htmlFor="login-password">Senha de Acesso</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type="password"
                  className="form-control"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '2.75rem' }}
                  required
                />
                <Lock
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '1.1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--power-muted)'
                  }}
                />
              </div>
            </div>

            {error && (
              <div role="alert" aria-live="polite" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#ef4444',
                background: 'rgba(239, 68, 68, 0.15)',
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                fontSize: '0.85rem',
                margin: '1.25rem 0',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                textAlign: 'left'
              }}>
                <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ marginTop: '1.5rem' }} disabled={loading}>
              {loading ? 'Verificando...' : 'Entrar no Sistema'}
            </button>
          </form>

          <div className="login-form-footer">
            <p>Multiplica PLUS &copy; {new Date().getFullYear()} - IEAD Templo JK</p>
          </div>
        </div>
      </div>
    </div>
  );
};
