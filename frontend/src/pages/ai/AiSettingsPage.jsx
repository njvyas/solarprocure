import React, { useState, useEffect, useCallback } from 'react';
import { aiAPI, apiCall} from '../utils/api';
import { useAuth } from '../../contexts/AuthContext';


const PROVIDERS = [
  { value:'anthropic', label:'Anthropic (Claude)', models:['claude-opus-4-6','claude-sonnet-4-6','claude-haiku-4-5-20251001'], url:'https://console.anthropic.com/settings/keys' },
  { value:'openai',    label:'OpenAI (GPT)',        models:['gpt-4o','gpt-4o-mini','gpt-4-turbo','gpt-3.5-turbo'], url:'https://platform.openai.com/api-keys' },
  { value:'gemini',    label:'Google Gemini',       models:['gemini-1.5-pro','gemini-1.5-flash','gemini-2.0-flash'], url:'https://aistudio.google.com/app/apikey' },
  { value:'mistral',   label:'Mistral AI',          models:['mistral-large-latest','mistral-small-latest','open-mistral-7b'], url:'https://console.mistral.ai/api-keys' },
  { value:'cohere',    label:'Cohere',              models:['command-r-plus','command-r','command'], url:'https://dashboard.cohere.com/api-keys' },
  { value:'custom',    label:'Custom / Self-hosted', models:[], url:null },
];

export default function AiSettingsPage() {
  const { can } = useAuth();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState({});
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ provider:'anthropic', name:'', apiKey:'', model:'', baseUrl:'', isDefault:false });

  const canManage = can('ai','manage');

  const load = useCallback(async () => {
    const res = await apiCall('/ai/providers');
    setProviders(res.data || []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const addProvider = async () => {
    setErr('');
    if (!form.name || !form.apiKey) { setErr('Name and API key are required'); return; }
    const res = await apiCall('/ai/providers', { method:'POST', body:JSON.stringify(form) });
    if (!res.success) { setErr(res.error); return; }
    setAdding(false);
    setForm({ provider:'anthropic', name:'', apiKey:'', model:'', baseUrl:'', isDefault:false });
    setSuccess('Provider added successfully');
    load();
  };

  const toggleActive = async (id, isActive) => {
    await apiCall(`/ai/providers/${id}`, { method:'PATCH', body:JSON.stringify({ isActive: !isActive }) });
    load();
  };

  const setDefault = async (id) => {
    await apiCall(`/ai/providers/${id}`, { method:'PATCH', body:JSON.stringify({ isDefault: true }) });
    load();
  };

  const deleteProvider = async (id) => {
    if (!confirm('Delete this AI provider?')) return;
    await apiCall(`/ai/providers/${id}`, { method:'DELETE' });
    load();
  };

  const testProvider = async (id) => {
    setTesting(id);
    const res = await apiCall(`/ai/providers/${id}/test`, { method:'POST' });
    setTestResult(prev => ({ ...prev, [id]: res.data }));
    setTesting(null);
  };

  const selectedProv = PROVIDERS.find(p => p.value === form.provider);

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:500,margin:'0 0 4px'}}>AI Settings</h1>
          <p style={{color:'var(--color-text-secondary)',fontSize:'14px',margin:0}}>Configure AI providers for predictive analytics</p>
        </div>
        {canManage && <button onClick={()=>setAdding(true)}>+ Add provider</button>}
      </div>

      {err && <div style={{padding:'10px',marginBottom:'1rem',background:'var(--color-background-danger)',color:'var(--color-text-danger)',borderRadius:'var(--border-radius-md)',fontSize:'13px'}}>{err}</div>}
      {success && <div style={{padding:'10px',marginBottom:'1rem',background:'var(--color-background-success)',color:'var(--color-text-success)',borderRadius:'var(--border-radius-md)',fontSize:'13px'}}>{success}</div>}

      {/* Info */}
      <div style={{padding:'12px 16px',marginBottom:'1.5rem',background:'var(--color-background-info)',border:'0.5px solid var(--color-border-info)',borderRadius:'var(--border-radius-md)',fontSize:'13px',color:'var(--color-text-info)'}}>
        API keys are AES-256 encrypted at rest. Only the last 4 characters are stored in plaintext for identification. Keys are never returned to the frontend after saving.
      </div>

      {/* Provider list */}
      {loading ? <p style={{color:'var(--color-text-secondary)'}}>Loading...</p>
      : providers.length === 0 ? (
        <div style={{textAlign:'center',padding:'3rem',background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)'}}>
          <p style={{fontSize:'32px',margin:'0 0 1rem'}}>🤖</p>
          <h2 style={{fontSize:'16px',fontWeight:500,marginBottom:'0.5rem'}}>No AI providers configured</h2>
          <p style={{color:'var(--color-text-secondary)',fontSize:'14px',marginBottom:'1.5rem'}}>Add an AI provider to enable predictive analytics and intelligent insights.</p>
          {canManage && <button onClick={()=>setAdding(true)}>Add your first provider</button>}
        </div>
      ) : (
        <div style={{display:'grid',gap:'12px'}}>
          {providers.map(p => {
            const provMeta = PROVIDERS.find(x => x.value === p.provider);
            const tr = testResult[p.id];
            return (
              <div key={p.id} style={{background:'var(--color-background-primary)',border:`0.5px solid ${p.is_default?'var(--color-border-info)':'var(--color-border-tertiary)'}`,borderRadius:'var(--border-radius-lg)',padding:'1.25rem'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
                  <div style={{display:'flex',gap:'12px',alignItems:'flex-start'}}>
                    <div style={{width:40,height:40,borderRadius:8,background:'var(--color-background-secondary)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>
                      {p.provider==='anthropic'?'🔶':p.provider==='openai'?'⚡':p.provider==='gemini'?'💎':p.provider==='mistral'?'🌪':p.provider==='cohere'?'🌊':'⚙️'}
                    </div>
                    <div>
                      <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'4px'}}>
                        <h3 style={{fontSize:'15px',fontWeight:500,margin:0}}>{p.name}</h3>
                        {p.is_default && <span style={{fontSize:'11px',background:'var(--color-background-info)',color:'var(--color-text-info)',padding:'2px 6px',borderRadius:'var(--border-radius-md)'}}>Default</span>}
                        <span style={{fontSize:'11px',background:p.is_active?'var(--color-background-success)':'var(--color-background-secondary)',color:p.is_active?'var(--color-text-success)':'var(--color-text-secondary)',padding:'2px 6px',borderRadius:'var(--border-radius-md)'}}>{p.is_active?'Active':'Inactive'}</span>
                      </div>
                      <p style={{fontSize:'13px',color:'var(--color-text-secondary)',margin:'0 0 2px'}}>{provMeta?.label || p.provider} {p.model && `• ${p.model}`}</p>
                      <p style={{fontSize:'12px',color:'var(--color-text-tertiary)',margin:0}}>Key: ****{p.api_key_hint} {p.last_used_at && `• Last used: ${new Date(p.last_used_at).toLocaleDateString()}`}</p>
                      {tr && <p style={{fontSize:'12px',margin:'6px 0 0',color:tr.success?'var(--color-text-success)':'var(--color-text-danger)'}}>{tr.success ? `✓ Test OK: "${tr.response}"` : `✗ ${tr.error}`}</p>}
                    </div>
                  </div>
                  {canManage && (
                    <div style={{display:'flex',gap:'6px',flexWrap:'wrap',justifyContent:'flex-end'}}>
                      <button onClick={()=>testProvider(p.id)} disabled={testing===p.id} style={{padding:'5px 10px',fontSize:'12px'}}>{testing===p.id?'Testing...':'Test'}</button>
                      {!p.is_default && <button onClick={()=>setDefault(p.id)} style={{padding:'5px 10px',fontSize:'12px'}}>Set default</button>}
                      <button onClick={()=>toggleActive(p.id,p.is_active)} style={{padding:'5px 10px',fontSize:'12px',color:p.is_active?'var(--color-text-warning)':'var(--color-text-success)'}}>{p.is_active?'Disable':'Enable'}</button>
                      <button onClick={()=>deleteProvider(p.id)} style={{padding:'5px 10px',fontSize:'12px',color:'var(--color-text-danger)'}}>Delete</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add provider modal */}
      {adding && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'1rem'}}>
          <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'1.5rem',width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto'}}>
            <h3 style={{fontSize:'16px',fontWeight:500,margin:'0 0 1.25rem'}}>Add AI provider</h3>

            <div style={{marginBottom:'0.75rem'}}>
              <label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>Provider *</label>
              <select value={form.provider} onChange={e=>setForm(p=>({...p,provider:e.target.value,model:'',apiKey:''}))} style={{width:'100%'}}>
                {PROVIDERS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            <div style={{marginBottom:'0.75rem'}}>
              <label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>Display name *</label>
              <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder={`e.g. ${selectedProv?.label} Production`} style={{width:'100%',boxSizing:'border-box'}} />
            </div>

            <div style={{marginBottom:'0.75rem'}}>
              <label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>
                API key *
                {selectedProv?.url && <a href={selectedProv.url} target="_blank" rel="noopener noreferrer" style={{marginLeft:8,fontSize:'12px',color:'var(--color-text-info)'}}>Get key ↗</a>}
              </label>
              <input value={form.apiKey} onChange={e=>setForm(p=>({...p,apiKey:e.target.value}))} type="password" placeholder="sk-..." style={{width:'100%',boxSizing:'border-box'}} autoComplete="off" />
            </div>

            <div style={{marginBottom:'0.75rem'}}>
              <label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>Model</label>
              {selectedProv?.models.length > 0 ? (
                <select value={form.model} onChange={e=>setForm(p=>({...p,model:e.target.value}))} style={{width:'100%'}}>
                  <option value="">Auto (use provider default)</option>
                  {selectedProv.models.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input value={form.model} onChange={e=>setForm(p=>({...p,model:e.target.value}))} placeholder="model-name" style={{width:'100%',boxSizing:'border-box'}} />
              )}
            </div>

            {form.provider === 'custom' && (
              <div style={{marginBottom:'0.75rem'}}>
                <label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>Base URL (OpenAI-compatible endpoint) *</label>
                <input value={form.baseUrl} onChange={e=>setForm(p=>({...p,baseUrl:e.target.value}))} placeholder="https://your-server/v1/chat/completions" style={{width:'100%',boxSizing:'border-box'}} />
              </div>
            )}

            <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',marginBottom:'1.25rem',cursor:'pointer'}}>
              <input type="checkbox" checked={form.isDefault} onChange={e=>setForm(p=>({...p,isDefault:e.target.checked}))} />
              Set as default provider
            </label>

            {err && <p style={{color:'var(--color-text-danger)',fontSize:'13px',margin:'0 0 0.75rem'}}>{err}</p>}

            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button onClick={()=>{setAdding(false);setErr('');}}>Cancel</button>
              <button onClick={addProvider} disabled={!form.name||!form.apiKey} style={{background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',padding:'8px 16px',cursor:'pointer',opacity:!form.name||!form.apiKey?0.5:1}}>Save provider</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
