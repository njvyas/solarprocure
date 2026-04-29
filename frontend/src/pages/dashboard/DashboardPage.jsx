import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { tenantsAPI } from '../../utils/api';

function StatCard({ label, value, sub }) {
  return (
    <div style={{ background:'var(--color-background-secondary)', borderRadius:'var(--border-radius-md)', padding:'1rem' }}>
      <p style={{ fontSize:'13px', color:'var(--color-text-secondary)', margin:'0 0 6px' }}>{label}</p>
      <p style={{ fontSize:'24px', fontWeight:500, margin:'0 0 4px' }}>{value}</p>
      {sub && <p style={{ fontSize:'12px', color:'var(--color-text-tertiary)', margin:0 }}>{sub}</p>}
    </div>
  );
}

const STAGES = [
  { stage:1,  name:'Foundation + Auth + RBAC',       done:true  },
  { stage:2,  name:'Vendor self-registration',        done:true  },
  { stage:3,  name:'Vendor management',               done:true  },
  { stage:4,  name:'BOM engine',                      done:true  },
  { stage:5,  name:'RFQ system',                      done:true  },
  { stage:6,  name:'Quote submission',                done:true  },
  { stage:7,  name:'Reverse bidding',                 done:true  },
  { stage:8,  name:'Comparison engine',               done:true  },
  { stage:9,  name:'Approval workflow (POs)',         done:true  },
  { stage:10, name:'Backup & restore',                done:true  },
  { stage:11, name:'Audit & reporting',               done:true  },
  { stage:12, name:'Tenant settings + user profiles', done:true  },
  { stage:13, name:'Admin settings GUI + email + setup wizard', done:true  },
];

export default function DashboardPage() {
  const { user, can } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (can('tenants','read')) {
      tenantsAPI.stats().then(({ data }) => setStats(data.data)).catch(()=>{}).finally(()=>setLoading(false));
    } else { setLoading(false); }
  }, [can]);

  const done = STAGES.filter(s=>s.done).length;

  return (
    <div>
      <div style={{ marginBottom:'2rem' }}>
        <h1 style={{ fontSize:'22px', fontWeight:500, margin:'0 0 4px' }}>Dashboard</h1>
        <p style={{ color:'var(--color-text-secondary)', fontSize:'14px', margin:0 }}>
          Welcome back, {user?.firstName} {user?.lastName}
        </p>
      </div>

      {loading ? (
        <p style={{ color:'var(--color-text-secondary)' }}>Loading...</p>
      ) : stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'12px', marginBottom:'2rem' }}>
          <StatCard label="Total users"     value={stats.users?.total??0}          sub={`${stats.users?.active??0} active`} />
          <StatCard label="Roles"           value={stats.roles?.total??0}          />
          <StatCard label="Audit logs (30d)" value={stats.recentAuditLogs??0}      />
          <StatCard label="Stages complete" value={`${done} / ${STAGES.length}`}  sub="All stages complete" />
          <StatCard label="AI providers"    value={stats.activeAiProviders ?? 0}   sub={`${stats.totalAiInsights ?? 0} insights run`} />
        </div>
      )}

      <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', padding:'1.5rem' }}>
        <h2 style={{ fontSize:'16px', fontWeight:500, marginBottom:'1rem' }}>Implementation roadmap</h2>
        {STAGES.map(({ stage, name, done: isDone }) => (
          <div key={stage} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'8px 0', borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
            <span style={{
              width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'12px', fontWeight:500, flexShrink:0,
              background: isDone ? 'var(--color-background-success)' : 'var(--color-background-secondary)',
              color: isDone ? 'var(--color-text-success)' : 'var(--color-text-secondary)',
            }}>{stage}</span>
            <span style={{ fontSize:'14px', color: isDone ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>{name}</span>
            {isDone && <span style={{ marginLeft:'auto', fontSize:'12px', background:'var(--color-background-success)', color:'var(--color-text-success)', padding:'2px 8px', borderRadius:'var(--border-radius-md)' }}>Complete</span>}
            {!isDone && <span style={{ marginLeft:'auto', fontSize:'12px', background:'var(--color-background-warning)', color:'var(--color-text-warning)', padding:'2px 8px', borderRadius:'var(--border-radius-md)' }}>Pending</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
