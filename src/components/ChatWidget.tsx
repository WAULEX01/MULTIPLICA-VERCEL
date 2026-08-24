import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import type { AppDatabase, UserSession } from '../services/db';
import { generateUUID } from '../services/db';

interface ChatWidgetProps {
  db: AppDatabase;
  session: UserSession;
  onUpdateDatabase: (db: AppDatabase) => void;
  onlineProfiles: any[];
  isOpen?: boolean;
  onToggle?: () => void;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({ db, session, onUpdateDatabase, onlineProfiles, isOpen: externalOpen, onToggle }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = onToggle !== undefined;
  const isOpen = isControlled ? (externalOpen !== undefined ? externalOpen : internalOpen) : internalOpen;
  const setIsOpen = (val: boolean) => {
    if (onToggle) onToggle();
    else setInternalOpen(val);
  };
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter messages for global chat
  const chatMessages = (db.messageHistory || [])
    .filter(m => m.weekKey === 'GLOBAL_CHAT')
    .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

  const unreadCount = chatMessages.filter(m => m.senderId !== session.personId && new Date(m.sentAt).getTime() > (Number(localStorage.getItem('last_chat_read')) || 0)).length;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      localStorage.setItem('last_chat_read', Date.now().toString());
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [chatMessages.length, isOpen]);

  const handleSend = () => {
    if (!message.trim()) return;

    const newMessage = {
      id: 'msg_' + generateUUID(),
      senderId: session.personId || '',
      receiverId: 'ALL',
      weekKey: 'GLOBAL_CHAT',
      sentAt: new Date().toISOString(),
      message: message.trim()
    };

    const newDb = {
      ...db,
      messageHistory: [...(db.messageHistory || []), newMessage]
    };

    onUpdateDatabase(newDb);

    setMessage('');
  };

  return (
    <>
      {/* Floating Button — only when not externally controlled */}
      {!isOpen && !isControlled && (
        <button 
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: 'var(--power-orange)',
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            zIndex: 1000,
            fontWeight: 600,
            fontSize: '0.9rem'
          }}
          className="animate-fade chat-widget-btn"
        >
          <MessageCircle size={20} />
          <span>Chat ({onlineProfiles.length} online)</span>
          {unreadCount > 0 && (
            <span style={{
              background: '#ef4444',
              color: 'white',
              fontSize: '0.7rem',
              padding: '2px 6px',
              borderRadius: '10px',
              marginLeft: '4px'
            }}>
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '320px',
          height: '450px',
          backgroundColor: 'var(--power-surface)',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          overflow: 'hidden'
        }} className="animate-fade chat-widget-window">
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, var(--power-orange) 0%, #d94f00 100%)',
            color: 'white',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageCircle size={20} />
              <span style={{ fontWeight: 600 }}>Chat dos Líderes</span>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: 0 }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: 'var(--power-black)'
          }}>
            {chatMessages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '20px', fontSize: '0.9rem' }}>
                Nenhuma mensagem ainda. Seja o primeiro a dizer olá!
              </div>
            ) : (
              chatMessages.map(msg => {
                const isMe = msg.senderId === session.personId;
                const sender = db.people.find(p => p.id === msg.senderId);
                return (
                  <div key={msg.id} style={{
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {!isMe && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--power-muted)', marginBottom: '2px', marginLeft: '4px' }}>
                        {sender?.name || 'Desconhecido'}
                      </span>
                    )}
                    <div style={{
                      background: isMe ? 'var(--power-orange)' : 'var(--power-raised)',
                      color: isMe ? 'var(--power-black)' : 'var(--power-white)',
                      padding: '8px 12px',
                      borderRadius: '12px',
                      borderBottomRightRadius: isMe ? '4px' : '12px',
                      borderBottomLeftRadius: !isMe ? '4px' : '12px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      fontSize: '0.9rem',
                      lineHeight: '1.4'
                    }}>
                      {msg.message}
                    </div>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', alignSelf: isMe ? 'flex-end' : 'flex-start', marginTop: '4px', margin: '0 4px' }}>
                      {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{
            padding: '12px',
            borderTop: '1px solid var(--power-line)',
            backgroundColor: 'var(--power-surface)',
            display: 'flex',
            gap: '8px'
          }}>
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Digite uma mensagem..."
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '20px',
                border: '1px solid var(--power-muted)',
                outline: 'none',
                fontSize: '0.9rem'
              }}
            />
            <button
              onClick={handleSend}
              disabled={!message.trim()}
              style={{
                background: message.trim() ? 'var(--power-orange)' : 'var(--power-line)',
                color: message.trim() ? 'white' : '#94a3b8',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: message.trim() ? 'pointer' : 'default',
                transition: 'background 0.2s'
              }}
            >
              <Send size={16} style={{ marginLeft: '2px' }} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
