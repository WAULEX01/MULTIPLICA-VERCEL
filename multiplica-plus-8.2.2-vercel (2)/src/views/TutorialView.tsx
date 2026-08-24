import React, { useState } from 'react';
import type { UserSession } from '../services/db';
import { Sparkles, Calendar, MessageSquare, AlertTriangle, Smile, HelpCircle } from 'lucide-react';

interface TutorialViewProps {
  session: UserSession;
}

export const TutorialView: React.FC<TutorialViewProps> = ({ session }) => {
  // Simulators states
  const [mockPresence, setMockPresence] = useState<{ [key: string]: boolean }>({
    '1': true,
    '2': false,
    '3': true
  });
  
  const [showMockWAModal, setShowMockWAModal] = useState(false);
  const [waTargetName, setWaTargetName] = useState('');
  const [waMessageText, setWaMessageText] = useState('');
  
  const [mockRadarContacted, setMockRadarContacted] = useState(false);

  // Toggle mock presence
  const handleToggleMock = (id: string) => {
    setMockPresence(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const openMockWAModal = (name: string, isFemale: boolean) => {
    const firstName = name.split(' ')[0];
    const msg = isFemale 
      ? `Olá, minha querida irmã ${firstName}! Parabéns pelo seu aniversário! 🎂🎉 Que o Senhor Deus te abençoe grandemente...`
      : `Olá, meu querido irmão ${firstName}! Parabéns pelo seu aniversário! 🎂🎉 Que o Senhor Deus te abençoe grandemente...`;
    
    setWaTargetName(name);
    setWaMessageText(msg);
    setShowMockWAModal(true);
  };

  const totalMockPresent = Object.values(mockPresence).filter(Boolean).length;

  return (
    <div className="animate-fade">
      {/* 1. Header do Projeto */}
      <div 
        style={{
          background: 'linear-gradient(135deg, var(--power-orange) 0%, var(--power-orange) 100%)',
          borderRadius: '24px',
          padding: '2.5rem 2rem',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: '2.5rem',
          boxShadow: '0 10px 25px -5px rgba(124, 58, 237, 0.3)'
        }}
      >
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '800px' }}>
          <span style={{ 
            background: 'rgba(255, 255, 255, 0.2)', 
            padding: '0.35rem 0.85rem', 
            borderRadius: '50px', 
            fontSize: '0.75rem', 
            fontWeight: 700, 
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            marginBottom: '1rem'
          }}>
            <Sparkles size={12} />
            Projeto de Acompanhamento
          </span>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Olá, {session.name}! Bem-vindo ao Projeto Multiplicadores — IEAD-Jota
          </h1>
          <p style={{ fontSize: '1rem', color: '#e0e7ff', marginTop: '0.75rem', lineHeight: 1.5, opacity: 0.9 }}>
            Idealizado pelo Pr. Wagner Camargos, o projeto visa fortalecer o cuidado de cada membro através de multiplicadores capacitados. Este aplicativo foi feito sob medida para facilitar a sua missão diária!
          </p>
        </div>
        
        {/* Glow decoration */}
        <div style={{
          position: 'absolute',
          right: '-5%',
          top: '-20%',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          filter: 'blur(40px)',
          zIndex: 1
        }}></div>
      </div>

      <div className="responsive-split split-2-1">
        
        {/* Lado Esquerdo: Simuladores Interativos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Card Introdução ao Multiplicador */}
          <div className="glass-card" style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-main)' }}>
              <HelpCircle size={20} style={{ color: 'var(--power-orange)' }} />
              O que faz um Multiplicador no App?
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--power-muted)', lineHeight: 1.6, margin: 0 }}>
              Como multiplicador, você é a linha de frente do cuidado pastoral. Suas principais atribuições no aplicativo são:
              registrar a frequência dos cultos em poucos cliques, enviar parabéns fraternos aos aniversariantes do seu departamento e resgatar pessoas ausentes monitorando o radar inteligente.
            </p>
          </div>

          {/* SIMULADOR 1: Chamada em Linhas */}
          <div className="glass-card" style={{ padding: '1.75rem', border: '1px solid rgba(37,99,235,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px dashed var(--power-line)', paddingBottom: '0.75rem' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
                  <Calendar size={18} />
                  Simulador: Registrar Presença
                </h4>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--power-muted)' }}>Toque na linha de qualquer membro para alternar</p>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, background: 'rgba(255, 97, 1, 0.10)', color: 'var(--power-orange)', padding: '0.25rem 0.5rem', borderRadius: '6px' }}>
                {totalMockPresent} de 3 presentes
              </span>
            </div>

            {/* List items mimicking the new line-based layout */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* Member 1 */}
              <div 
                onClick={() => handleToggleMock('1')}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.65rem 1rem',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--power-line)',
                  borderLeft: mockPresence['1'] ? '5px solid #10b981' : '5px solid #ef4444',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'transform 0.1s'
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text-main)' }}>Lucas Silva</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--power-muted)', marginLeft: '0.5rem' }}>• Membro Ativo</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: mockPresence['1'] ? '#10b981' : '#ef4444', marginRight: '0.5rem' }}>
                    {mockPresence['1'] ? 'Presente' : 'Falta'}
                  </span>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: mockPresence['1'] ? '#10b981' : '#ef4444'
                  }}></div>
                </div>
              </div>

              {/* Member 2 */}
              <div 
                onClick={() => handleToggleMock('2')}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.65rem 1rem',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--power-line)',
                  borderLeft: mockPresence['2'] ? '5px solid #10b981' : '5px solid #ef4444',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text-main)' }}>Ana Souza</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--power-muted)', marginLeft: '0.5rem' }}>• Obreira</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: mockPresence['2'] ? '#10b981' : '#ef4444', marginRight: '0.5rem' }}>
                    {mockPresence['2'] ? 'Presente' : 'Falta'}
                  </span>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: mockPresence['2'] ? '#10b981' : '#ef4444'
                  }}></div>
                </div>
              </div>

              {/* Member 3 */}
              <div 
                onClick={() => handleToggleMock('3')}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.65rem 1rem',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--power-line)',
                  borderLeft: mockPresence['3'] ? '5px solid #10b981' : '5px solid #ef4444',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text-main)' }}>Mateus Ferreira</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--power-muted)', marginLeft: '0.5rem' }}>• Liderança</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: mockPresence['3'] ? '#10b981' : '#ef4444', marginRight: '0.5rem' }}>
                    {mockPresence['3'] ? 'Presente' : 'Falta'}
                  </span>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: mockPresence['3'] ? '#10b981' : '#ef4444'
                  }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* SIMULADOR 2: Aniversariantes e WhatsApp */}
          <div className="glass-card" style={{ padding: '1.75rem', border: '1px solid rgba(16,185,129,0.15)' }}>
            <h4 style={{ margin: '0 0 1.25rem 0', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
              <Smile size={18} />
              Simulador: Enviar Parabéns no WhatsApp
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div 
                style={{
                  background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.12) 0%, rgba(255, 97, 1, 0.12) 100%)',
                  border: '1px solid #fde68a',
                  borderRadius: '12px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#fcd34d' }}>Mariana Costa 🎂</p>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: '#b45309' }}>Faz aniversário HOJE (28 anos) • Célula Jovens</p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => openMockWAModal('Mariana Costa', true)}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderColor: '#10b981',
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.75rem',
                    width: 'auto',
                    margin: 0
                  }}
                >
                  <MessageSquare size={12} />
                  Parabéns
                </button>
              </div>

              <div 
                style={{
                  background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.13) 0%, #dcfce7 100%)',
                  border: '1px solid rgba(34, 197, 94, 0.34)',
                  borderRadius: '12px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#86efac' }}>Roberto Camargo 🎁</p>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: '#15803d' }}>Faz aniversário na quinta-feira • Membro</p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={() => openMockWAModal('Roberto Camargo', false)}
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    borderColor: '#10b981',
                    color: '#15803d',
                    padding: '0.4rem 0.75rem',
                    width: 'auto',
                    margin: 0
                  }}
                >
                  <MessageSquare size={12} />
                  Felicitar
                </button>
              </div>
            </div>
          </div>

          {/* SIMULADOR 3: Radar de Ausências */}
          <div className="glass-card" style={{ padding: '1.75rem', border: '1px solid rgba(239,68,68,0.15)' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
              <AlertTriangle size={18} />
              Simulador: Resgatar com o Radar
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--power-muted)', marginBottom: '1.25rem' }}>
              O radar avisa quando alguém falta 3 ou mais domingos seguidos. Veja como cuidar no simulador abaixo:
            </p>

            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #fecaca',
              padding: '1rem',
              borderRadius: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#991b1b' }}>Júnior Alencar</p>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: '#b91c1c' }}>Faltou nos últimos 4 cultos de Domingo! 🔴</p>
              </div>
              <button
                type="button"
                className="btn btn-danger"
                disabled={mockRadarContacted}
                onClick={() => {
                  setMockRadarContacted(true);
                  alert(`Simulação: Link de contato gerado! Uma mensagem personalizada no WhatsApp foi copiada para você enviar a Júnior Alencar. Ele se sentirá lembrado e amado!`);
                }}
                style={{
                  background: mockRadarContacted ? 'var(--power-muted)' : '#dc2626',
                  borderColor: mockRadarContacted ? 'var(--power-muted)' : '#dc2626',
                  color: 'white',
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.75rem',
                  width: 'auto',
                  margin: 0,
                  fontWeight: 700
                }}
              >
                {mockRadarContacted ? '✅ Contatado' : '📞 Enviar Mensagem de Amor'}
              </button>
            </div>
          </div>
        </div>

        {/* Lado Direito: Destaques e Visão Espiritual */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Card Destaques Tecnológicos */}
          <div className="glass-card" style={{ padding: '1.75rem', background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.02) 0%, rgba(37, 99, 235, 0.02) 100%)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--color-text-main)' }}>Destaques do Multiplica PLUS</h3>
            
            <ul style={{ paddingLeft: '1.25rem', margin: 0, fontSize: '0.85rem', color: 'var(--power-muted)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <li>
                <strong>Sincronização delta em 1 clique:</strong> Qualquer alteração (chamada, cadastro, etc.) é enviada para a nuvem na Supabase de forma instantânea.
              </li>
              <li>
                <strong>Notificações Inteligentes:</strong> Sempre que você abrir o app, se houver um aniversariante do dia no seu departamento, o celular avisa você!
              </li>
              <li>
                <strong>Fórmula de Engajamento:</strong> Suas ações no aplicativo (presenças anotadas, tempo gasto cuidando de pessoas) contam pontos para o ranking saudável do sistema.
              </li>
              <li>
                <strong>Segurança de Dados:</strong> Login seguro e controle de permissões. Suas alterações são gravadas sob o seu nome no histórico de auditoria.
              </li>
            </ul>
          </div>

          {/* Visão Espiritual do Pastor Wagner */}
          <div 
            style={{
              background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.12) 0%, rgba(255, 97, 1, 0.12) 100%)',
              border: '1px solid #fde68a',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 4px 12px rgba(251, 191, 36, 0.05)'
            }}
          >
            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#fcd34d', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Smile size={16} />
              Palavra do Idealizador
            </h4>
            <p style={{ fontSize: '0.825rem', color: '#78350f', lineHeight: 1.5, fontStyle: 'italic', margin: 0 }}>
              "O projeto Multiplicadores nasceu no coração de Deus para que nenhuma ovelha da IEAD-Jota se sinta desamparada. Este aplicativo é um facilitador tecnológico, mas lembre-se: a ferramenta só ajuda, quem garante a vitória e o cuidado é o próprio Senhor Deus através do seu amor pelas vidas. Prossiga firme, pois o seu trabalho no Senhor não é em vão!"
            </p>
            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#b45309', marginTop: '0.75rem', textAlign: 'right' }}>
              — Pr. Wagner Camargos
            </span>
          </div>
        </div>

      </div>

      {/* MOCK WHATSAPP SEND MODAL (Simulator helper) */}
      {showMockWAModal && (
        <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', zIndex: 999 }}>
          <div className="modal-content" style={{ maxWidth: '450px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
                <MessageSquare size={20} />
                Simulador: Enviando WhatsApp
              </h3>
            </div>
            
            <p style={{ fontSize: '0.8rem', color: 'var(--power-muted)', marginBottom: '1rem' }}>
              O aplicativo iria abrir o WhatsApp Web ou o app do celular com o seguinte texto pronto para enviar para <strong>{waTargetName}</strong>:
            </p>
            
            <div style={{ background: 'rgba(22, 163, 74, 0.13)', border: '1px solid rgba(34, 197, 94, 0.34)', borderRadius: '8px', padding: '1rem', fontSize: '0.8rem', color: '#86efac', minHeight: '100px', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {waMessageText}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowMockWAModal(false)}
                style={{ flex: 1, margin: 0 }}
              >
                Voltar
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={() => {
                  setShowMockWAModal(false);
                  alert(`Simulação concluída! No aplicativo real, a tela do WhatsApp abriria com a mensagem pronta de parabéns para ${waTargetName}.`);
                }}
                style={{ flex: 1, background: '#10b981', borderColor: '#10b981', margin: 0 }}
              >
                Concluir Simulação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
