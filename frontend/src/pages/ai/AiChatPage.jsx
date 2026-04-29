import React, { useState, useEffect, useRef, useCallback } from 'react';
import { aiAPI, apiCall} from '../utils/api';
import { useAuth } from '../../contexts/AuthContext';


const SUGGESTED = [
  'Which vendors have the highest risk of delivery delays?',
  'What is our spend trend for the last 6 months?',
  'Which RFQs had the lowest vendor participation?',
  'Where are our biggest cost-saving opportunities?',
  'Which vendor should I prefer for solar modules?',
  'How many POs are pending approval right now?',
];

export default function AiChatPage() {
  const { can } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const bottomRef = useRef(null);

  const loadSessions = useCallback(async () => {
    const res = await apiCall('/ai/chat');
    setSessions(res.data || []);
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [messages]);

  const loadSession = async (id) => {
    const res = await apiCall(`/ai/chat/${id}`);
    setActiveSession(id);
    setMessages(res.data?.messages || []);
  };

  const send = async (text) => {
    const msg = text || input;
    if (!msg.trim() || sending) return;
    setInput(''); setSending(true); setErr('');

    // Optimistic UI
    const optimistic = [...messages, { role:'user', content:msg }];
    setMessages(optimistic);

    const res = await apiCall('/ai/chat', {
      method:'POST',
      body: JSON.stringify({ message:msg, sessionId: activeSession || undefined })
    });

    if (!res.success) {
      setErr(res.error);
      setMessages(messages); // rollback
    } else {
      if (!activeSession) {
        setActiveSession(res.data.sessionId);
        loadSessions();
      }
      setMessages([...optimistic, { role:'assistant', content:res.data.reply }]);
    }
    setSending(false);
  };

  const newChat = () => {
    setActiveSession(null);
    setMessages([]);
    setInput('');
  };

  if (!can('ai','use')) return <p style={{color:'var(--color-text-danger)'}}>Access denied</p>;

  return (
    <div style={{height:'calc(100vh - 120px)',display:'flex',gap:'16px'}}>
      {/* Sidebar */}
      <div style={{width:240,flexShrink:0,display:'flex',flexDirection:'column',gap:'8px'}}>
        <button onClick={newChat} style={{width:'100%',padding:'8px',background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',cursor:'pointer',fontSize:'14px'}}>
          + New chat
        </button>
        <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:'4px'}}>
          {sessions.map(s=>(
            <button key={s.id} onClick={()=>loadSession(s.id)}
              style={{padding:'8px 10px',textAlign:'left',background:activeSession===s.id?'var(--color-background-secondary)':'transparent',border:'none',borderRadius:'var(--border-radius-md)',cursor:'pointer',fontSize:'13px',color:activeSession===s.id?'var(--color-text-primary)':'var(--color-text-secondary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {s.title || 'Chat session'}
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div style={{flex:1,display:'flex',flexDirection:'column',background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',overflow:'hidden'}}>
        {/* Header */}
        <div style={{padding:'1rem 1.25rem',borderBottom:'0.5px solid var(--color-border-tertiary)',display:'flex',alignItems:'center',gap:'10px'}}>
          <span style={{fontSize:'20px'}}>🤖</span>
          <div>
            <p style={{fontWeight:500,margin:'0 0 2px',fontSize:'14px'}}>Procurement AI Assistant</p>
            <p style={{fontSize:'12px',color:'var(--color-text-secondary)',margin:0}}>Ask anything about your vendors, RFQs, spend, and procurement data</p>
          </div>
        </div>

        {/* Messages */}
        <div style={{flex:1,overflowY:'auto',padding:'1.25rem',display:'flex',flexDirection:'column',gap:'12px'}}>
          {messages.length===0 && (
            <div>
              <p style={{fontSize:'14px',color:'var(--color-text-secondary)',marginBottom:'1rem'}}>Try asking:</p>
              <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                {SUGGESTED.map((s,i)=>(
                  <button key={i} onClick={()=>send(s)}
                    style={{padding:'6px 12px',fontSize:'13px',background:'var(--color-background-secondary)',border:'0.5px solid var(--color-border-secondary)',borderRadius:'var(--border-radius-md)',cursor:'pointer',color:'var(--color-text-secondary)',textAlign:'left',lineHeight:1.4}}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m,i)=>(
            <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
              <div style={{maxWidth:'72%',padding:'10px 14px',borderRadius:'var(--border-radius-lg)',fontSize:'14px',lineHeight:1.6,
                background:m.role==='user'?'var(--color-text-primary)':'var(--color-background-secondary)',
                color:m.role==='user'?'var(--color-background-primary)':'var(--color-text-primary)'}}>
                {m.content.split('\n').map((line,j)=><p key={j} style={{margin:j===0?0:'4px 0 0'}}>{line}</p>)}
              </div>
            </div>
          ))}
          {sending && (
            <div style={{display:'flex',justifyContent:'flex-start'}}>
              <div style={{padding:'10px 14px',background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-lg)',fontSize:'14px',color:'var(--color-text-secondary)'}}>
                <span style={{letterSpacing:'2px'}}>···</span>
              </div>
            </div>
          )}
          {err && <p style={{color:'var(--color-text-danger)',fontSize:'13px',textAlign:'center'}}>{err}</p>}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{padding:'1rem',borderTop:'0.5px solid var(--color-border-tertiary)',display:'flex',gap:'8px'}}>
          <input value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder="Ask about your procurement data..."
            style={{flex:1,boxSizing:'border-box'}} disabled={sending} />
          <button onClick={()=>send()} disabled={sending||!input.trim()}
            style={{padding:'8px 16px',background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',cursor:'pointer',opacity:sending||!input.trim()?0.5:1,flexShrink:0}}>
            {sending ? '...' : '→'}
          </button>
        </div>
      </div>
    </div>
  );
}
