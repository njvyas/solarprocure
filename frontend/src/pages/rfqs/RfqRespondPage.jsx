import React, { useState, useEffect } from 'react';
import { rfqsAPI } from '../utils/api';
import { useParams } from 'react-router-dom';

const apiFetch = (p,o={}) => fetch(`${API}${p}`,{...o,headers:{'Content-Type':'application/json',...(o.headers||{})}}).then(r=>r.json());

export default function RfqRespondPage() {
  const { token } = useParams();
  const [data,setData]=useState(null); const [loading,setLoading]=useState(true);
  const [err,setErr]=useState(''); const [submitted,setSubmitted]=useState(false);
  const [items,setItems]=useState([]);
  const [form,setForm]=useState({currency:'INR',validityDays:30,deliveryWeeks:'',paymentTerms:'',notes:''});

  useEffect(()=>{
    apiFetch(`/rfqs/token/${token}`)
      .then(res=>{ if(res.success){setData(res.data); setItems((res.data.items||[]).map(i=>({rfqItemId:i.id,lineNumber:i.line_number,description:i.description,unit:i.unit,quantity:i.quantity,unitRate:'',makeModel:'',notes:''}))); }
        else setErr(res.error||'Invalid link');
        setLoading(false);
      });
  },[token]);

  const submit = async()=>{
    const validItems=items.filter(i=>i.unitRate&&parseFloat(i.unitRate)>0);
    if(!validItems.length){setErr('Please enter at least one unit rate.');return;}
    const res=await apiFetch(`/quotes/submit/${token}`,{method:'POST',body:JSON.stringify({...form,items:validItems.map(i=>({...i,unitRate:parseFloat(i.unitRate),quantity:parseFloat(i.quantity)}))})});
    if(res.success){setSubmitted(true);}else{setErr(res.error||'Submission failed');}
  };

  const fmtINR=n=>n?`₹${parseFloat(n).toLocaleString('en-IN',{maximumFractionDigits:0})}`:'';
  const totalCalc=items.reduce((sum,i)=>sum+(parseFloat(i.unitRate)||0)*(parseFloat(i.quantity)||0),0);

  if(loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--color-text-secondary)'}}>Loading...</div>;
  if(err&&!data) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--color-text-danger)'}}>{err}</div>;

  if(submitted) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--color-background-tertiary)'}}>
      <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'2rem',maxWidth:480,textAlign:'center'}}>
        <div style={{width:48,height:48,borderRadius:'50%',background:'var(--color-background-success)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1rem',fontSize:22}}>✓</div>
        <h2 style={{fontSize:'18px',fontWeight:500,marginBottom:'0.5rem'}}>Quote submitted</h2>
        <p style={{color:'var(--color-text-secondary)',fontSize:'14px'}}>Your quote for {data?.rfq?.title} has been received. You will be contacted regarding the outcome.</p>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'var(--color-background-tertiary)',padding:'2rem 1rem'}}>
      <div style={{maxWidth:800,margin:'0 auto'}}>
        <div style={{marginBottom:'1.5rem'}}>
          <p style={{fontSize:'13px',color:'var(--color-text-secondary)',margin:'0 0 4px'}}>Quote request from {data?.rfq?.tenant_name}</p>
          <h1 style={{fontSize:'22px',fontWeight:500,margin:'0 0 4px'}}>{data?.rfq?.title}</h1>
          <div style={{display:'flex',gap:'12px',fontSize:'13px',color:'var(--color-text-secondary)'}}>
            <code>{data?.rfq?.rfq_number}</code>
            {data?.rfq?.submission_deadline&&<span>Deadline: {new Date(data.rfq.submission_deadline).toLocaleDateString()}</span>}
            {data?.rfq?.delivery_location&&<span>Delivery: {data.rfq.delivery_location}</span>}
          </div>
        </div>

        {err&&<div style={{padding:'10px',marginBottom:'1rem',background:'var(--color-background-danger)',color:'var(--color-text-danger)',borderRadius:'var(--border-radius-md)',fontSize:'13px'}}>{err}</div>}

        {/* Line items */}
        <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',marginBottom:'1rem',overflow:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px',minWidth:700}}>
            <thead><tr style={{background:'var(--color-background-secondary)'}}>
              {['#','Category','Description','Unit','Qty','Your unit rate (₹) *','Make/Model','Total'].map(h=>(<th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:500,fontSize:'12px',color:'var(--color-text-secondary)',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>{h}</th>))}
            </tr></thead>
            <tbody>
              {items.map((item,idx)=>(
                <tr key={item.rfqItemId} style={{borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                  <td style={{padding:'8px 12px',color:'var(--color-text-secondary)'}}>{item.lineNumber}</td>
                  <td style={{padding:'8px 12px'}}>{data?.items[idx]?.category}</td>
                  <td style={{padding:'8px 12px'}}>{item.description}</td>
                  <td style={{padding:'8px 12px'}}>{item.unit}</td>
                  <td style={{padding:'8px 12px',textAlign:'right'}}>{item.quantity}</td>
                  <td style={{padding:'4px 8px'}}><input type="number" min="0" step="0.01" value={item.unitRate} onChange={e=>setItems(p=>p.map((x,i)=>i===idx?{...x,unitRate:e.target.value}:x))} style={{width:'120px',boxSizing:'border-box'}} placeholder="0.00" /></td>
                  <td style={{padding:'4px 8px'}}><input value={item.makeModel} onChange={e=>setItems(p=>p.map((x,i)=>i===idx?{...x,makeModel:e.target.value}:x))} style={{width:'120px',boxSizing:'border-box'}} placeholder="Brand/Model" /></td>
                  <td style={{padding:'8px 12px',textAlign:'right',fontWeight:500}}>{fmtINR((parseFloat(item.unitRate)||0)*(parseFloat(item.quantity)||0))}</td>
                </tr>
              ))}
              <tr style={{background:'var(--color-background-secondary)',fontWeight:500}}>
                <td colSpan={7} style={{padding:'10px 12px',textAlign:'right'}}>Total</td>
                <td style={{padding:'10px 12px',textAlign:'right'}}>₹{totalCalc.toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Quote terms */}
        <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',padding:'1.5rem',marginBottom:'1.5rem'}}>
          <h3 style={{fontSize:'14px',fontWeight:500,margin:'0 0 1rem'}}>Quote terms</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px'}}>
            {[['validityDays','Valid for (days)','number'],['deliveryWeeks','Delivery (weeks)','number'],['currency','Currency','text']].map(([k,l,t])=>(
              <div key={k}><label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>{l}</label><input value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} type={t} style={{width:'100%',boxSizing:'border-box'}} /></div>
            ))}
          </div>
          <div style={{marginTop:'12px'}}><label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>Payment terms</label><input value={form.paymentTerms} onChange={e=>setForm(p=>({...p,paymentTerms:e.target.value}))} style={{width:'100%',boxSizing:'border-box'}} placeholder="e.g. 30% advance, 70% on delivery" /></div>
          <div style={{marginTop:'12px'}}><label style={{display:'block',fontSize:'13px',color:'var(--color-text-secondary)',marginBottom:'3px'}}>Notes</label><textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} rows={3} style={{width:'100%',boxSizing:'border-box',resize:'vertical'}} /></div>
        </div>

        <button onClick={submit} style={{width:'100%',padding:'12px',background:'var(--color-text-primary)',color:'var(--color-background-primary)',border:'none',borderRadius:'var(--border-radius-md)',fontSize:'14px',fontWeight:500,cursor:'pointer'}}>
          Submit quote — ₹{totalCalc.toLocaleString('en-IN',{maximumFractionDigits:0})}
        </button>
      </div>
    </div>
  );
}
