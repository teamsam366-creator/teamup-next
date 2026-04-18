'use client';

import { useEffect, useMemo, useState } from 'react';
import { db, auth, functions } from './firebase';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';

const ADMIN_UIDS = new Set([
  'evTQJpWDdxYkhAdiZausCnbnZb62',
  'dy5JRtY4A3dYmG1tol3OkPQDSDT2',
  'YMN7sIbVbJZXKIwOH903Yd2ndTU2',
]);

export default function Home() {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  if (!ready) return <LoadingScreen />;
  return <TeamUpApp />;
}

function TeamUpApp() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [state, setState] = useState({
    users: [], accounts: [], tasks: [], sessions: [],
    settings: { globalRate: 6 }, paymentRecords: [], projects: [],
    routeTab: 'accounts', adminTab: 'tasks',
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user) await loadData(setState);
    });
    return () => unsub();
  }, []);

  if (!authReady) return <LoadingScreen />;
  if (!firebaseUser) return <LoginView />;

  const user = currentUser(firebaseUser, state);
  if (!user) return <LoadingScreen />;

  if (user.role === 'admin') {
    return (
      <AdminView user={user} state={state} setState={setState} />
    );
  }

  return <UserView user={user} state={state} setState={setState} />;
}

function LoadingScreen() {
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f5f7fa'}}>
      <div style={{padding:'16px 24px',background:'#fff',borderRadius:12,border:'1px solid #e4e9f0',color:'#8492a6',fontSize:14}}>
        جاري الاتصال بقاعدة البيانات...
      </div>
    </div>
  );
}

function LoginView() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('teamup_email') || '';
    const savedPass = localStorage.getItem('teamup_pass') || '';
    if (savedEmail) { setEmail(savedEmail); setRemember(true); }
    if (savedPass) setPass(savedPass);
  }, []);

  const doLogin = async () => {
    if (!email || !pass) return setErr('Please enter email and password');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      if (remember) { localStorage.setItem('teamup_email', email); localStorage.setItem('teamup_pass', pass); }
      else { localStorage.removeItem('teamup_email'); localStorage.removeItem('teamup_pass'); }
    } catch (e) {
      setErr('Invalid email or password');
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="mb20" style={{textAlign:'center'}}>
          <span style={{color:'#2563eb',fontWeight:800,fontSize:28,letterSpacing:-1}}>Team</span>
          <span style={{color:'#1a2332',fontWeight:800,fontSize:28,letterSpacing:-1}}>UP</span>
        </div>
        {err && <div className="notice">{err}</div>}
        <div className="field mb12">
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email" />
        </div>
        <div className="field mb12">
          <label className="label">Password</label>
          <input className="input" type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="password" onKeyDown={e=>e.key==='Enter'&&doLogin()} />
        </div>
        <label style={{display:'flex',alignItems:'center',gap:10,color:'#8492a6',fontSize:14,marginBottom:12,cursor:'pointer'}}>
          <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} />
          Remember me
        </label>
        <button className="btn btn-primary" style={{width:'100%'}} onClick={doLogin} disabled={loading}>
          {loading ? '...' : 'Sign In'}
        </button>
      </div>
    </div>
  );
}

function currentUser(firebaseUser, state) {
  if (!firebaseUser) return null;
  const uid = firebaseUser.uid;
  const email = firebaseUser.email || '';
  const displayName = firebaseUser.displayName || email.split('@')[0];
  if (ADMIN_UIDS.has(uid)) return { id: uid, role: 'admin', name: displayName, email };
  const dbUser = state.users.find(u => u.id === uid || u.email === email);
  if (dbUser) return dbUser;
  return { id: uid, role: 'user', name: displayName, email };
}

async function loadData(setState) {
  const cols = ['users', 'accounts', 'tasks', 'sessions', 'paymentRecords', 'projects'];
  const results = await Promise.all(cols.map(c => getDocs(collection(db, c))));
  const [users, accounts, tasks, sessions, paymentRecords, projects] = results.map(s => s.docs.map(d => d.data()));
  const settingsSnap = await getDocs(collection(db, 'settings'));
  const settings = settingsSnap.docs.find(d => d.id === 'main')?.data() || { globalRate: 6 };
  setState(prev => ({ ...prev, users, accounts, tasks, sessions, paymentRecords, projects, settings }));
  cols.forEach(colName => {
    onSnapshot(collection(db, colName), snap => {
      if (snap.metadata.hasPendingWrites) return;
      const data = snap.docs.map(d => d.data());
      setState(prev => ({ ...prev, [colName]: data }));
    });
  });
}

// ── Admin ──
function AdminView({ user, state, setState }) {
  const tabs = ['tasks', 'billing', 'accounts', 'users', 'settings', 'payments'];
  return (
    <div id="app">
      <Header user={user} />
      <div style={{maxWidth:1400,margin:'0 auto',padding:24}}>
        <div className="nav">
          {tabs.map(t => (
            <button key={t} className={`tab ${state.adminTab===t?'active':''}`} onClick={()=>setState(p=>({...p,adminTab:t}))}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
        {state.adminTab==='tasks' && <AdminTasksView state={state} setState={setState} />}
        {state.adminTab==='billing' && <AdminBillingView state={state} setState={setState} />}
        {state.adminTab==='accounts' && <AdminAccountsView state={state} setState={setState} />}
        {state.adminTab==='users' && <AdminUsersView state={state} setState={setState} />}
        {state.adminTab==='settings' && <AdminSettingsView state={state} setState={setState} />}
        {state.adminTab==='payments' && <AdminPaymentsView state={state} setState={setState} />}
      </div>
    </div>
  );
}

// ── User ──
function UserView({ user, state, setState }) {
  const { routeTab } = state;
  const accounts = visibleAccountsFor(user, state);
  const myTasks = state.tasks.filter(t => t.userId === user.id);
  const needAttention = myTasks.filter(t => t.status==='revision'||t.status==='rejected').length;
  return (
    <div id="app">
      <Header user={user} />
      <div style={{maxWidth:1400,margin:'0 auto',padding:24}}>
        {needAttention > 0 && <div className="notice">⚠️ You have {needAttention} task log(s) that need your attention.</div>}
        <div className="nav">
          <button className={`tab ${routeTab==='accounts'?'active':''}`} onClick={()=>setState(p=>({...p,routeTab:'accounts'}))}>Accounts</button>
          <button className={`tab ${routeTab==='tasks'?'active':''}`} onClick={()=>setState(p=>({...p,routeTab:'tasks'}))}>
            Task Logs {needAttention>0&&<span className="badge b-red">{needAttention}</span>}
          </button>
        </div>
        {routeTab==='accounts' && <UserAccountsTab accounts={accounts} user={user} state={state} setState={setState} />}
        {routeTab==='tasks' && <UserTasksTab myTasks={myTasks} user={user} state={state} setState={setState} />}
      </div>
    </div>
  );
}

function Header({ user }) {
  return (
    <div className="header">
      <div className="brand">
        <span style={{color:'#2563eb',fontWeight:800,letterSpacing:-1,fontSize:22}}>Team</span>
        <span style={{color:'#1a2332',fontWeight:800,letterSpacing:-1,fontSize:22}}>UP</span>
      </div>
      <div className="row">
        {user && <span className="badge b-blue">{user.name}</span>}
        <button className="btn btn-soft" onClick={()=>signOut(auth)}>Sign Out</button>
      </div>
    </div>
  );
}

// ── User Accounts Tab ──
function UserAccountsTab({ accounts, user, state, setState }) {
  const todayStr = new Date().toISOString().slice(0,10);
  return (
    <div className="grid grid-3">
      {accounts.map(acc => {
        const sess = state.sessions.find(s=>s.accountId===acc.id&&s.active);
        const mine = sess && sess.userId===user.id;
        const busy = sess && !mine;
        const used = state.tasks.filter(t=>t.account===`Account ${acc.number}`&&t.workDate===todayStr).reduce((s,t)=>s+parseDuration(t.duration),0);
        const usedH = used/3600;
        const pct = Math.min(100,(usedH/(acc.maxHours||10))*100);
        return (
          <div key={acc.id} className="card account-card">
            <div className="account-top">
              <div>
                <div className="account-name">🖥️ Account {acc.number}</div>
                {acc.project && <div className="muted">{acc.project}</div>}
              </div>
              <span className={`badge ${acc.accountStatus==='paused'?'b-yellow':mine?'b-green':busy?'b-red':'b-blue'}`}>
                {acc.accountStatus==='paused'?'Stopped':mine?'Connected':busy?'In Use':'Available'}
              </span>
            </div>
            <div className="info-box mb12">
              <div className="kv"><span className="muted">ID:</span><span className="mono">{acc.anydeskId}</span></div>
              <div className="kv"><span className="muted">🔑:</span><span className="mono">{acc.anydeskPass}</span></div>
            </div>
            <div className="info-box mb12">
              <div className="kv"><strong>Today limit</strong><span className="mono">{usedH.toFixed(2)}h / {(acc.maxHours||10).toFixed(2)}h</span></div>
              <div className="progress"><div className="bar" style={{width:`${pct}%`}}></div></div>
            </div>
            {mine
              ? <button className="btn btn-red" style={{width:'100%'}} onClick={()=>logoutAccount(acc.id,setState,state)}>Logout</button>
              : <button className="btn btn-primary" style={{width:'100%'}} disabled={busy||acc.accountStatus==='paused'} onClick={()=>loginAccount(acc,user,state,setState)}>
                  {acc.accountStatus==='paused'?'Stopped':busy?'Unavailable':'Login'}
                </button>
            }
          </div>
        );
      })}
    </div>
  );
}

// ── User Tasks Tab ──
function UserTasksTab({ myTasks, user, state, setState }) {
  const [modal, setModal] = useState(null);
  return (
    <div>
      <div className="row mb12" style={{justifyContent:'flex-end'}}>
        <button className="btn btn-green" onClick={()=>setModal('new')}>+ Add New Task</button>
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Work Date</th><th>Platform</th><th>Duration</th><th>Account</th><th>Notes</th><th>Project</th><th>Review Note</th><th>Status</th><th>Payment</th><th>Action</th></tr></thead>
          <tbody>
            {!myTasks.length && <tr><td colSpan="10" className="empty">No task logs yet</td></tr>}
            {[...myTasks].sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt)).map(t=>(
              <tr key={t.id} style={{opacity:t.paid?0.6:1}}>
                <td><strong>{fmtDate(t.workDate)}</strong><br/><span className="small">{fmtUTC(t.submittedAt)}</span></td>
                <td>{t.platform}</td>
                <td className="mono">{fmtDurationFromInput(t.duration)}</td>
                <td>{t.account}</td>
                <td>{t.notes||'—'}</td>
                <td>{t.projectName||'—'}</td>
                <td>{t.reviewNote||'—'}</td>
                <td><span className={`badge ${t.status==='reviewed'?'b-green':t.status==='pending'?'b-blue':t.status==='revision'?'b-yellow':'b-red'}`}>{t.status}</span></td>
                <td>{t.paid?<span className="badge b-green">Paid</span>:<span className="badge">Open</span>}</td>
                <td>{(t.status==='revision'||t.status==='rejected')&&!t.paid?<button className="btn btn-soft" onClick={()=>setModal(t)}>Edit</button>:'—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && <TaskModal task={modal==='new'?null:modal} user={user} state={state} setState={setState} onClose={()=>setModal(null)} />}
    </div>
  );
}

// ── Admin Tasks ──
function AdminTasksView({ state, setState }) {
  const [modal, setModal] = useState(null);
  const items = state.tasks.filter(t=>!t.paid).sort((a,b)=>{
    const p={pending:0,revision:1,rejected:2,reviewed:3};
    return (p[a.status]??99)-(p[b.status]??99)||new Date(b.submittedAt)-new Date(a.submittedAt);
  });
  return (
    <div>
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Work Date</th><th>User</th><th>Platform</th><th>Duration</th><th>Account</th><th>Project</th><th>Payout Rate</th><th>Notes</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {!items.length && <tr><td colSpan="10" className="empty">No logs</td></tr>}
            {items.map(t=>(
              <tr key={t.id}>
                <td><strong>{fmtDate(t.workDate)}</strong><br/><span className="small">{fmtUTC(t.submittedAt)}</span></td>
                <td>{t.userName}</td><td>{t.platform}</td>
                <td className="mono">{fmtDurationFromInput(t.duration)}</td>
                <td>{t.account}</td><td>{t.projectName||'—'}</td>
                <td style={{color:'#059669',fontWeight:700}}>${userRateForTask(t,state)}/hr</td>
                <td>{t.notes||'—'}</td>
                <td><span className={`badge ${t.status==='reviewed'?'b-green':t.status==='pending'?'b-blue':t.status==='revision'?'b-yellow':'b-red'}`}>{t.status}</span></td>
                <td><button className="btn btn-soft" onClick={()=>setModal(t)}>Review</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && <ReviewModal task={modal} onClose={()=>setModal(null)} setState={setState} state={state} />}
    </div>
  );
}

// ── Admin Billing ──
function AdminBillingView({ state, setState }) {
  const today = new Date().toISOString().slice(0,10);
  const wb = getWeekBounds(today);
  const [f, setF] = useState({user:'all',account:'all',from:wb.start,to:wb.end});
  const names = ['all',...state.users.map(u=>u.name)];
  const accounts = ['all',...state.accounts.map(a=>`Account ${a.number}`)];

  const reviewedTasks = state.tasks.filter(t=>
    t.status==='reviewed' &&
    within(t.workDate,f.from,f.to) &&
    (f.user==='all'||t.userName===f.user) &&
    (f.account==='all'||t.account===f.account)
  );
  const dailyRows = [...reviewedTasks].sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt));
  const totalRevenue = dailyRows.reduce((s,t)=>{const hrs=parseDuration(t.duration)/3600;const acc=state.accounts.find(a=>`Account ${a.number}`===t.account)||{};return s+(hrs*(acc.accountRate||0));},0);
  const totalPayout = dailyRows.reduce((s,t)=>{const hrs=parseDuration(t.duration)/3600;return s+(hrs*userRateForTask(t,state));},0);
  const openTasks = dailyRows.filter(t=>!t.paid).length;

  return (
    <div>
      <div className="grid grid-4 mb16">
        <div className="stat"><div className="v" style={{color:'#0b6aa9'}}>${totalRevenue.toFixed(2)}</div><div className="l">Total Revenue</div></div>
        <div className="stat"><div className="v" style={{color:'#059669'}}>${totalPayout.toFixed(2)}</div><div className="l">Total Payout</div></div>
        <div className="stat"><div className="v" style={{color:'#7c3aed'}}>${(totalRevenue-totalPayout).toFixed(2)}</div><div className="l">Total Profit</div></div>
        <div className="stat"><div className="v" style={{color:'#d97706'}}>{openTasks}</div><div className="l">Open Tasks</div></div>
      </div>
      <div className="card p20 mb16">
        <div className="section-title">Billing — Task Level</div>
        <div className="grid" style={{gridTemplateColumns:'repeat(4,minmax(0,1fr))'}}>
          <div className="field"><label className="label">User</label><select className="select" value={f.user} onChange={e=>setF({...f,user:e.target.value})}>{names.map(n=><option key={n}>{n}</option>)}</select></div>
          <div className="field"><label className="label">Account</label><select className="select" value={f.account} onChange={e=>setF({...f,account:e.target.value})}>{accounts.map(n=><option key={n}>{n}</option>)}</select></div>
          <div className="field"><label className="label">From</label><input className="input" type="date" value={f.from} onChange={e=>setF({...f,from:e.target.value})} /></div>
          <div className="field"><label className="label">To</label><input className="input" type="date" value={f.to} onChange={e=>setF({...f,to:e.target.value})} /></div>
        </div>
        <div className="row mt16" style={{gap:10}}>
          <button className="btn btn-soft" onClick={()=>exportToExcel(dailyRows,f,state)}>Export Excel</button>
          <button className="btn btn-soft" onClick={()=>exportToPDF(dailyRows,f,state)}>Export PDF</button>
        </div>
      </div>
      <div className="card p20">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>User</th><th>Account</th><th>Project/Notes</th><th>Duration</th><th style={{color:'#0b6aa9'}}>Revenue</th><th style={{color:'#059669'}}>Payout</th><th style={{color:'#7c3aed'}}>Profit</th><th>Status</th></tr></thead>
            <tbody>
              {!dailyRows.length && <tr><td colSpan="9" className="empty">No reviewed tasks in this period</td></tr>}
              {dailyRows.map(t=>{
                const secs=parseDuration(t.duration);const hrs=secs/3600;
                const acc=state.accounts.find(a=>`Account ${a.number}`===t.account)||{};
                const revenue=hrs*(acc.accountRate||0);const payout=hrs*userRateForTask(t,state);
                return (
                  <tr key={t.id} style={{opacity:t.paid?0.6:1}}>
                    <td><strong>{fmtDate(t.workDate)}</strong><br/><span className="small">{fmtUTC(t.submittedAt)}</span></td>
                    <td>{t.userName}</td><td>{t.account}</td><td>{t.projectName||t.notes||'—'}</td>
                    <td className="mono">{fmtDuration(secs)}</td>
                    <td style={{color:'#0b6aa9',fontWeight:700}}>${revenue.toFixed(2)}</td>
                    <td style={{color:'#059669',fontWeight:700}}>${payout.toFixed(2)}</td>
                    <td style={{color:'#7c3aed',fontWeight:700}}>${(revenue-payout).toFixed(2)}</td>
                    <td>
                      <select className="select" value={t.paid?'paid':'open'} style={{minWidth:100}} onChange={async e=>{
                        const paid=e.target.value==='paid';
                        await updateDoc(doc(db,'tasks',t.id),{paid});
                        setState(prev=>({...prev,tasks:prev.tasks.map(x=>x.id===t.id?{...x,paid}:x)}));
                      }}><option value="open">Open</option><option value="paid">Paid</option></select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {dailyRows.length>0&&(
              <tfoot><tr style={{background:'#f8fafc',fontWeight:700}}>
                <td colSpan="5"><strong>Total ({dailyRows.length})</strong></td>
                <td style={{color:'#0b6aa9'}}><strong>${totalRevenue.toFixed(2)}</strong></td>
                <td style={{color:'#059669'}}><strong>${totalPayout.toFixed(2)}</strong></td>
                <td style={{color:'#7c3aed'}}><strong>${(totalRevenue-totalPayout).toFixed(2)}</strong></td>
                <td></td>
              </tr></tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Admin Payments ──
function AdminPaymentsView({ state, setState }) {
  const today = new Date().toISOString().slice(0,10);
  const [preset, setPreset] = useState('week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const getRange = () => {
    const now = new Date(today+'T00:00:00Z');
    if (preset==='week') { const wb=getWeekBounds(today); return {from:wb.start,to:wb.end}; }
    if (preset==='month') {
      const y=now.getUTCFullYear(),m=now.getUTCMonth();
      const from=`${y}-${String(m+1).padStart(2,'0')}-01`;
      const lastDay=new Date(Date.UTC(y,m+1,0)).getUTCDate();
      return {from,to:`${y}-${String(m+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`};
    }
    if (preset==='last30') return {from:new Date(now.getTime()-29*86400000).toISOString().slice(0,10),to:today};
    return {from:customFrom,to:customTo};
  };

  const {from,to} = getRange();

  // Paid tasks filtered by period for Summary by User
  const paidInPeriod = useMemo(() => {
    return state.tasks.filter(t=>t.paid&&t.status==='reviewed'&&within(t.workDate,from,to));
  }, [state.tasks, from, to]);

  // All paid tasks for Payment Batches (all time)
  const allPaidTasks = useMemo(() => {
    return state.tasks.filter(t=>t.paid&&t.status==='reviewed')
      .sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt));
  }, [state.tasks]);

  // Summary by User (filtered by period)
  const byUser = useMemo(() => {
    const map = {};
    paidInPeriod.forEach(t => {
      const hrs=parseDuration(t.duration)/3600;
      const acc=state.accounts.find(a=>`Account ${a.number}`===t.account)||{};
      const revenue=hrs*Number(acc.accountRate||0);
      const payout=hrs*userRateForTask(t,state);
      const profit=revenue-payout;
      if (!map[t.userId]) {
        const usr=state.users.find(u=>u.id===t.userId)||{};
        map[t.userId]={userId:t.userId,userName:t.userName,binanceId:usr.binanceId||'—',tasksCount:0,revenue:0,payout:0,profit:0};
      }
      map[t.userId].tasksCount++;
      map[t.userId].revenue+=revenue;
      map[t.userId].payout+=payout;
      map[t.userId].profit+=profit;
    });
    return Object.values(map).sort((a,b)=>a.userName.localeCompare(b.userName));
  }, [paidInPeriod, state]);

  // Payment Batches (all time)
  const batchRows = useMemo(() => {
    const map = {};
    allPaidTasks.forEach(t => {
      const wb=getWeekBounds(t.workDate);
      const hrs=parseDuration(t.duration)/3600;
      const acc=state.accounts.find(a=>`Account ${a.number}`===t.account)||{};
      const revenue=hrs*Number(acc.accountRate||0);
      const payout=hrs*userRateForTask(t,state);
      if (!map[wb.start]) map[wb.start]={start:wb.start,end:wb.end,tasksCount:0,revenue:0,payout:0,profit:0};
      map[wb.start].tasksCount++;
      map[wb.start].revenue+=revenue;
      map[wb.start].payout+=payout;
      map[wb.start].profit+=(revenue-payout);
    });
    return Object.values(map).sort((a,b)=>new Date(b.start)-new Date(a.start));
  }, [allPaidTasks, state]);

  // Cards from period
  const totalRevenue = byUser.reduce((s,u)=>s+u.revenue,0);
  const totalPayout = byUser.reduce((s,u)=>s+u.payout,0);
  const totalProfit = byUser.reduce((s,u)=>s+u.profit,0);

  return (
    <div>
      {/* Period Filter */}
      <div className="card p20 mb16">
        <div className="row" style={{gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <span style={{fontWeight:600,fontSize:14,color:'#1a2332'}}>Period:</span>
          {[['week','This Week'],['month','This Month'],['last30','Last 30 Days'],['custom','Custom']].map(([val,label])=>(
            <button key={val} className={`btn ${preset===val?'btn-primary':'btn-soft'}`} style={{minHeight:34,padding:'6px 14px',fontSize:13}} onClick={()=>setPreset(val)}>
              {label}
            </button>
          ))}
          {preset==='custom' && (
            <>
              <input className="input" type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} style={{width:150}} />
              <span style={{color:'#8492a6'}}>→</span>
              <input className="input" type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} style={{width:150}} />
            </>
          )}
          {from&&to&&<span className="badge b-blue">{fmtDate(from)} → {fmtDate(to)}</span>}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-4 mb16">
        <div className="stat"><div className="v" style={{color:'#1a2332'}}>{paidInPeriod.length}</div><div className="l">Paid Tasks</div></div>
        <div className="stat"><div className="v" style={{color:'#0b6aa9'}}>${totalRevenue.toFixed(2)}</div><div className="l">Total Revenue</div></div>
        <div className="stat"><div className="v" style={{color:'#d97706'}}>${totalPayout.toFixed(2)}</div><div className="l">Total Payout</div></div>
        <div className="stat"><div className="v" style={{color:'#059669'}}>${totalProfit.toFixed(2)}</div><div className="l">Total Profit</div></div>
      </div>

      {/* Summary by User */}
      <div className="card p20 mb16">
        <div className="section-title">Summary by User</div>
        <div className="small mb16" style={{color:'#8492a6'}}>Paid tasks grouped by user — within selected period</div>
        {!byUser.length
          ? <div className="empty">No paid tasks in this period</div>
          : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>User</th><th>Binance ID</th><th>Tasks</th><th style={{color:'#0b6aa9'}}>Revenue</th><th style={{color:'#d97706'}}>Payout</th><th style={{color:'#059669'}}>Profit</th></tr></thead>
              <tbody>
                {byUser.map(u=>(
                  <tr key={u.userId||u.userName}>
                    <td><strong>{u.userName}</strong></td>
                    <td className="mono">{u.binanceId}</td>
                    <td>{u.tasksCount}</td>
                    <td style={{color:'#0b6aa9',fontWeight:700}}>${u.revenue.toFixed(2)}</td>
                    <td style={{color:'#d97706',fontWeight:700}}>${u.payout.toFixed(2)}</td>
                    <td style={{color:'#059669',fontWeight:700}}>${u.profit.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{background:'#f8fafc',fontWeight:700}}>
                  <td colSpan="2"><strong>Total</strong></td>
                  <td><strong>{paidInPeriod.length}</strong></td>
                  <td style={{color:'#0b6aa9'}}><strong>${totalRevenue.toFixed(2)}</strong></td>
                  <td style={{color:'#d97706'}}><strong>${totalPayout.toFixed(2)}</strong></td>
                  <td style={{color:'#059669'}}><strong>${totalProfit.toFixed(2)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Payment Batches — All Time */}
      <div className="card p20">
        <div className="section-title">Payment Batches — All Time</div>
        <div className="small mb16" style={{color:'#8492a6'}}>Weekly archive of all paid tasks</div>
        {!batchRows.length
          ? <div className="empty">No payment batches yet</div>
          : (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {batchRows.map(batch=>(
              <div key={batch.start} style={{display:'flex',flexDirection:'row',justifyContent:'space-between',alignItems:'center',border:'1px solid var(--line)',borderRadius:10,padding:'14px 18px',flexWrap:'wrap',gap:12}}>
                <div>
                  <div style={{fontWeight:700,fontSize:14}}>{fmtDate(batch.start)} → {fmtDate(batch.end)}</div>
                  <div className="small">{batch.tasksCount} paid task{batch.tasksCount!==1?'s':''}</div>
                </div>
                <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                  <div style={{background:'#eff6ff',borderRadius:8,padding:'6px 14px',textAlign:'center'}}>
                    <div style={{fontSize:11,color:'#8492a6'}}>Revenue</div>
                    <div style={{fontWeight:700,color:'#0b6aa9'}}>${batch.revenue.toFixed(2)}</div>
                  </div>
                  <div style={{background:'#fffbeb',borderRadius:8,padding:'6px 14px',textAlign:'center'}}>
                    <div style={{fontSize:11,color:'#8492a6'}}>Payout</div>
                    <div style={{fontWeight:700,color:'#d97706'}}>${batch.payout.toFixed(2)}</div>
                  </div>
                  <div style={{background:'#ecfdf5',borderRadius:8,padding:'6px 14px',textAlign:'center'}}>
                    <div style={{fontSize:11,color:'#8492a6'}}>Profit</div>
                    <div style={{fontWeight:700,color:'#059669'}}>${batch.profit.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Admin Accounts ──
function AdminAccountsView({ state, setState }) {
  const [modal, setModal] = useState(null);
  const todayStr = new Date().toISOString().slice(0,10);
  return (
    <div>
      <div className="row mb12"><button className="btn btn-green" onClick={()=>setModal('new')}>+ Add Account</button></div>
      <div className="grid grid-3">
        {state.accounts.map(acc=>{
          const used=state.tasks.filter(t=>t.account===`Account ${acc.number}`&&t.workDate===todayStr).reduce((s,t)=>s+parseDuration(t.duration),0)/3600;
          const activeSess=state.sessions.find(s=>s.accountId===acc.id&&s.active);
          const activeUser=activeSess?state.users.find(u=>u.id===activeSess.userId)||{name:activeSess.userName}:null;
          return(
            <div key={acc.id} className="card account-card">
              <div className="account-top">
                <div><div className="account-name">🖥️ Account {acc.number}</div><div className="muted">{acc.project||'No project assigned'}</div></div>
                <span className={`badge ${acc.accountStatus==='paused'?'b-yellow':activeSess?'b-green':'b-blue'}`}>{acc.accountStatus==='paused'?'Stopped':activeSess?'In Use':'Available'}</span>
              </div>
              <div className="info-box mb12">
                <div className="kv"><span className="muted">ID:</span><span className="mono">{acc.anydeskId}</span></div>
                <div className="kv"><span className="muted">🔑:</span><span className="mono">{acc.anydeskPass}</span></div>
              </div>
              <div className="row mb12"><span className="muted">💰 Revenue ${acc.accountRate}/hr</span><span className="muted">🕒 Limit {acc.maxHours}h</span></div>
              {activeSess&&(
                <div className="info-box mb12" style={{borderColor:'#bfdbfe',background:'#eff6ff'}}>
                  <div className="kv"><span style={{fontSize:12,color:'#2563eb',fontWeight:600}}>👤 Active user</span><span className="mono" style={{color:'#1a2332',fontWeight:700}}>{activeUser?.name}</span></div>
                  <div className="row mt16" style={{justifyContent:'flex-end'}}><button className="btn btn-red" style={{fontSize:12,minHeight:32,padding:'6px 12px'}} onClick={()=>logoutAccount(acc.id,setState,state)}>Force Logout</button></div>
                </div>
              )}
              <div className="info-box mb12">
                <div className="kv"><strong>Today</strong><span className="mono">{used.toFixed(2)}h / {(acc.maxHours||10).toFixed(2)}h</span></div>
                <div className="progress"><div className="bar" style={{width:`${Math.min(100,(used/(acc.maxHours||10))*100)}%`}}></div></div>
              </div>
              <div className="row">
                <button className="btn btn-soft" onClick={()=>setModal(acc)}>Edit</button>
                <button className={`btn ${acc.accountStatus==='paused'?'btn-green':'btn-yellow'}`} onClick={()=>toggleAccountStatus(acc,setState)}>{acc.accountStatus==='paused'?'Start':'Stop'}</button>
                <button className="btn btn-red" onClick={()=>deleteAccount(acc,state,setState)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
      {modal&&<AccountModal account={modal==='new'?null:modal} state={state} setState={setState} onClose={()=>setModal(null)} />}
    </div>
  );
}

// ── Admin Users ──
function AdminUsersView({ state, setState }) {
  const [modal, setModal] = useState(null);
  return (
    <div>
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Binance ID</th><th>Action</th></tr></thead>
          <tbody>
            {!state.users.length&&<tr><td colSpan="4" className="empty">No users</td></tr>}
            {state.users.map(u=>(<tr key={u.id}><td><strong>{u.name}</strong></td><td>{u.email}</td><td className="mono">{u.binanceId||'—'}</td><td><button className="btn btn-soft" onClick={()=>setModal(u)}>Edit</button></td></tr>))}
          </tbody>
        </table>
      </div>
      {modal&&<UserModal user={modal} setState={setState} state={state} onClose={()=>setModal(null)} />}
    </div>
  );
}

// ── Admin Settings ──
function AdminSettingsView({ state, setState }) {
  const [modal, setModal] = useState(null);
  return (
    <div style={{maxWidth:600}}>
      <div className="card p24">
        <div className="section-title">Projects & Payout Rates</div>
        <div className="table-wrap mb16">
          <table className="table">
            <thead><tr><th>Project</th><th>Payout Rate</th><th>Action</th></tr></thead>
            <tbody>
              {!state.projects.length&&<tr><td colSpan="3" className="empty">No projects yet</td></tr>}
              {state.projects.map(p=>(<tr key={p.id}><td><strong>{p.name}</strong></td><td className="mono">${Number(p.userRate||0).toFixed(2)}/hr</td><td><button className="btn btn-soft" style={{minHeight:32,padding:'4px 10px',fontSize:12}} onClick={()=>setModal(p)}>Edit</button><button className="btn btn-red" style={{minHeight:32,padding:'4px 10px',fontSize:12}} onClick={()=>deleteProject(p,setState)}>Delete</button></td></tr>))}
            </tbody>
          </table>
        </div>
        <button className="btn btn-green" onClick={()=>setModal('new')}>+ Add Project</button>
      </div>
      {modal&&<ProjectModal project={modal==='new'?null:modal} setState={setState} onClose={()=>setModal(null)} />}
    </div>
  );
}

// ── Modals ──
function TaskModal({ task, user, state, setState, onClose }) {
  const isEdit=!!task;
  const parts=durationToParts(task?.duration||'');
  const [form, setForm]=useState({workDate:task?.workDate||new Date().toISOString().slice(0,10),platform:task?.platform||'outlier',h:parts.h,m:parts.m,s:parts.s,account:task?.account||'',projectName:task?.projectName||'',notes:task?.notes||''});
  const visible=user.role==='admin'?state.accounts:visibleAccountsFor(user,state);
  const preview=fmtDuration(parseInt(form.h||0)*3600+parseInt(form.m||0)*60+parseInt(form.s||0));
  const save=async()=>{
    const duration=`${form.h||0}h ${form.m||0}m ${form.s||0}s`;
    if(parseDuration(duration)<=0||!form.account) return alert('Duration and account are required');
    const payload={workDate:form.workDate,platform:form.platform,duration,payType:'task',projectName:form.projectName,account:form.account,notes:form.notes};
    try{
      if(isEdit){await updateDoc(doc(db,'tasks',task.id),{...payload,status:'pending',reviewNote:''});setState(prev=>({...prev,tasks:prev.tasks.map(t=>t.id===task.id?{...t,...payload,status:'pending',reviewNote:''}:t)}));}
      else{const fn=httpsCallable(functions,'addTask');await fn(payload);}
      onClose();
    }catch(e){alert('Error: '+(e.message||'Unknown'));}
  };
  return(
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="row mb16"><div className="section-title">{isEdit?'Edit Task':'Log New Task'}</div><button className="btn btn-soft right" onClick={onClose}>Close</button></div>
        <div className="grid grid-2">
          <div className="field"><label className="label">Date (UTC)</label><input className="input" type="date" value={form.workDate} onChange={e=>setForm({...form,workDate:e.target.value})} /></div>
          <div className="field"><label className="label">Platform</label><input className="input" value={form.platform} onChange={e=>setForm({...form,platform:e.target.value})} /></div>
          <div className="field" style={{gridColumn:'1/-1'}}>
            <label className="label">Duration</label>
            <div className="duration-boxes">
              <div className="mini"><input type="number" min="0" value={form.h} onChange={e=>setForm({...form,h:e.target.value})} /><span>h</span></div>
              <div className="mini"><input type="number" min="0" max="59" value={form.m} onChange={e=>setForm({...form,m:e.target.value})} /><span>m</span></div>
              <div className="mini"><input type="number" min="0" max="59" value={form.s} onChange={e=>setForm({...form,s:e.target.value})} /><span>s</span></div>
            </div>
            <div className="small mt16">Preview: {preview}</div>
          </div>
          <div className="field"><label className="label">Account</label><select className="select" value={form.account} onChange={e=>setForm({...form,account:e.target.value})}><option value="">Select...</option>{visible.map(a=><option key={a.id} value={`Account ${a.number}`}>Account {a.number}</option>)}</select></div>
          <div className="field"><label className="label">Project</label><select className="select" value={form.projectName} onChange={e=>setForm({...form,projectName:e.target.value})}><option value="">Select project...</option>{state.projects.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}</select></div>
          <div className="field" style={{gridColumn:'1/-1'}}><label className="label">Notes</label><input className="input" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
        </div>
        <div className="row mt16"><button className="btn btn-primary" onClick={save}>Save</button></div>
      </div>
    </div>
  );
}

function ReviewModal({ task, onClose, setState, state }) {
  const [note, setNote]=useState(task.reviewNote||'');
  const review=async(status)=>{
    try{await updateDoc(doc(db,'tasks',task.id),{status,reviewNote:note});setState(prev=>({...prev,tasks:prev.tasks.map(t=>t.id===task.id?{...t,status,reviewNote:note}:t)}));onClose();}
    catch(e){alert('Error: '+e.message);}
  };
  return(
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="row mb16"><div className="section-title">Review Task</div><button className="btn btn-soft right" onClick={onClose}>Close</button></div>
        <div className="mb16"><strong>{task.userName}</strong><div className="small">{fmtDate(task.workDate)} · {task.account} · {task.duration}</div></div>
        <div className="field mb12"><label className="label">Review Note</label><textarea className="textarea" value={note} onChange={e=>setNote(e.target.value)}></textarea></div>
        <div className="row">
          <button className="btn btn-green" onClick={()=>review('reviewed')}>Approve</button>
          <button className="btn btn-yellow" onClick={()=>review('revision')}>Revision</button>
          <button className="btn btn-red" onClick={()=>review('rejected')}>Reject</button>
        </div>
      </div>
    </div>
  );
}

function AccountModal({ account, state, setState, onClose }) {
  const isEdit=!!account;
  const [form, setForm]=useState({number:account?.number||'',project:account?.project||'',anydeskId:account?.anydeskId||'',anydeskPass:account?.anydeskPass||'',accountRate:account?.accountRate||10,maxHours:account?.maxHours||10,accountStatus:account?.accountStatus||'active',adminNotes:account?.adminNotes||'',visibleToUserIds:account?.visibleToUserIds||[]});
  const save=async()=>{
    if(!form.number||!form.anydeskId||!form.anydeskPass) return alert('Required fields missing');
    const id=isEdit?account.id:'id_'+Math.random().toString(36).slice(2,10);
    const checkedUsers=state.users.filter(u=>form.visibleToUserIds.includes(u.id));
    const data={...form,id,visibleToUserNames:checkedUsers.map(u=>u.name),visibleToUserEmails:checkedUsers.map(u=>u.email)};
    await setDoc(doc(db,'accounts',id),data);
    setState(prev=>({...prev,accounts:isEdit?prev.accounts.map(a=>a.id===id?data:a):[...prev.accounts,data]}));
    onClose();
  };
  return(
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="row mb16"><div className="section-title">{isEdit?'Edit Account':'Add Account'}</div><button className="btn btn-soft right" onClick={onClose}>Close</button></div>
        <div className="grid grid-2">
          <div className="field"><label className="label">Account Number</label><input className="input" value={form.number} onChange={e=>setForm({...form,number:e.target.value})} /></div>
          <div className="field"><label className="label">Project</label><input className="input" value={form.project} onChange={e=>setForm({...form,project:e.target.value})} /></div>
          <div className="field"><label className="label">AnyDesk ID</label><input className="input" value={form.anydeskId} onChange={e=>setForm({...form,anydeskId:e.target.value})} /></div>
          <div className="field"><label className="label">AnyDesk Password</label><input className="input" value={form.anydeskPass} onChange={e=>setForm({...form,anydeskPass:e.target.value})} /></div>
          <div className="field"><label className="label">Revenue Rate $/hr</label><input className="input" type="number" value={form.accountRate} onChange={e=>setForm({...form,accountRate:parseFloat(e.target.value)})} /></div>
          <div className="field"><label className="label">Daily Limit (Hours)</label><input className="input" type="number" value={form.maxHours} onChange={e=>setForm({...form,maxHours:parseInt(e.target.value)})} /></div>
          <div className="field"><label className="label">Status</label><select className="select" value={form.accountStatus} onChange={e=>setForm({...form,accountStatus:e.target.value})}><option value="active">Working</option><option value="paused">Stopped</option></select></div>
        </div>
        <div className="field mt16"><label className="label">Assigned To Users</label>
          <div className="check-grid">{state.users.map(u=>(<label key={u.id} className="check-item"><input type="checkbox" checked={form.visibleToUserIds.includes(u.id)} onChange={e=>setForm({...form,visibleToUserIds:e.target.checked?[...form.visibleToUserIds,u.id]:form.visibleToUserIds.filter(id=>id!==u.id)})} /> {u.name}</label>))}</div>
        </div>
        <div className="field mt16"><label className="label">Admin Notes</label><textarea className="textarea" value={form.adminNotes} onChange={e=>setForm({...form,adminNotes:e.target.value})}></textarea></div>
        <div className="row mt16"><button className="btn btn-primary" onClick={save}>Save</button></div>
      </div>
    </div>
  );
}

function ProjectModal({ project, setState, onClose }) {
  const isEdit=!!project;
  const [name, setName]=useState(project?.name||'');
  const [rate, setRate]=useState(project?.userRate||6);
  const save=async()=>{
    if(!name) return alert('Project name is required');
    const id=isEdit?project.id:'id_'+Math.random().toString(36).slice(2,10);
    const data={id,name,userRate:parseFloat(rate)};
    await setDoc(doc(db,'projects',id),data);
    setState(prev=>({...prev,projects:isEdit?prev.projects.map(p=>p.id===id?data:p):[...prev.projects,data]}));
    onClose();
  };
  return(
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="row mb16"><div className="section-title">{isEdit?'Edit Project':'Add Project'}</div><button className="btn btn-soft right" onClick={onClose}>Close</button></div>
        <div className="grid grid-2">
          <div className="field"><label className="label">Project Name</label><input className="input" value={name} onChange={e=>setName(e.target.value)} /></div>
          <div className="field"><label className="label">Payout Rate $/hr</label><input className="input" type="number" value={rate} onChange={e=>setRate(e.target.value)} /></div>
        </div>
        <div className="row mt16"><button className="btn btn-primary" onClick={save}>Save</button></div>
      </div>
    </div>
  );
}

function UserModal({ user, state, setState, onClose }) {
  const isEdit=!!user;
  const [form, setForm]=useState({name:user?.name||'',email:user?.email||'',binanceId:user?.binanceId||''});
  const save=async()=>{
    if(!form.name||!form.email) return alert('Name and email are required');
    const id=isEdit?user.id:'id_'+Math.random().toString(36).slice(2,10);
    const data={...form,id,role:'user'};
    await setDoc(doc(db,'users',id),data);
    setState(prev=>({...prev,users:isEdit?prev.users.map(u=>u.id===id?data:u):[...prev.users,data]}));
    onClose();
  };
  return(
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="row mb16"><div className="section-title">{isEdit?'Edit User':'Add User'}</div><button className="btn btn-soft right" onClick={onClose}>Close</button></div>
        <div className="grid grid-2">
          <div className="field"><label className="label">Name</label><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
          <div className="field"><label className="label">Email</label><input className="input" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
          <div className="field" style={{gridColumn:'1/-1'}}><label className="label">Binance ID</label><input className="input" value={form.binanceId} onChange={e=>setForm({...form,binanceId:e.target.value})} /></div>
        </div>
        <div className="small mt16" style={{color:'#8492a6'}}>⚠️ Password is managed from Firebase Console</div>
        <div className="row mt16"><button className="btn btn-primary" onClick={save}>Save</button></div>
      </div>
    </div>
  );
}

// ── Helpers ──
function parseDuration(str=''){const h=Number((str.match(/(\d+)\s*h/i)||[])[1]||0);const m=Number((str.match(/(\d+)\s*m/i)||[])[1]||0);const s=Number((str.match(/(\d+)\s*s/i)||[])[1]||0);return h*3600+m*60+s;}
function durationToParts(str){const sec=parseDuration(str);return{h:Math.floor(sec/3600),m:Math.floor((sec%3600)/60),s:Math.floor(sec%60)};}
function fmtDuration(sec){sec=Math.max(0,Math.floor(sec||0));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return`${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;}
function fmtDurationFromInput(v){return fmtDuration(parseDuration(v));}
function fmtDate(s){if(!s)return'—';const d=new Date(s);if(isNaN(d.getTime()))return s;return d.toLocaleDateString('en-GB');}
function fmtUTC(s){if(!s)return'—';const d=new Date(s);return`${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')} UTC`;}
function getWeekBounds(dateStr){const d=new Date(dateStr);const day=d.getDay();const diff=(day+6)%7;const start=new Date(d);start.setDate(d.getDate()-diff);const end=new Date(start);end.setDate(start.getDate()+6);return{start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};}
function within(d,from,to){return(!from||d>=from)&&(!to||d<=to);}
function userRateForTask(task,state){const proj=state.projects?.find(p=>p.name===task.projectName);if(proj?.userRate!=null)return Number(proj.userRate);return Number(state.settings?.globalRate||6);}
function visibleAccountsFor(user,state){const uid=String(user.id||'').toLowerCase();const uname=String(user.name||'').trim().toLowerCase();const uemail=String(user.email||'').trim().toLowerCase();return state.accounts.filter(a=>{const ids=(a.visibleToUserIds||[]).map(v=>String(v).toLowerCase());const names=(a.visibleToUserNames||[]).map(v=>String(v).trim().toLowerCase());const emails=(a.visibleToUserEmails||[]).map(v=>String(v).trim().toLowerCase());const hasRules=ids.length>0||names.length>0||emails.length>0;if(!hasRules)return false;return ids.includes(uid)||names.includes(uname)||emails.includes(uemail);});}
async function loginAccount(acc,user,state,setState){const id='id_'+Math.random().toString(36).slice(2,10);const session={id,accountId:acc.id,userId:user.id,userName:user.name,loginAt:new Date().toISOString(),active:true};await setDoc(doc(db,'sessions',id),session);setState(prev=>({...prev,sessions:[...prev.sessions.filter(s=>!(s.userId===user.id&&s.active)),session]}));}
async function logoutAccount(accountId,setState,state){const sess=state.sessions.find(s=>s.accountId===accountId&&s.active);if(!sess)return;await updateDoc(doc(db,'sessions',sess.id),{active:false,logoutAt:new Date().toISOString()});setState(prev=>({...prev,sessions:prev.sessions.map(s=>s.id===sess.id?{...s,active:false}:s)}));}
async function toggleAccountStatus(acc,setState){const newStatus=acc.accountStatus==='paused'?'active':'paused';await updateDoc(doc(db,'accounts',acc.id),{accountStatus:newStatus});setState(prev=>({...prev,accounts:prev.accounts.map(a=>a.id===acc.id?{...a,accountStatus:newStatus}:a)}));}
async function deleteAccount(acc,state,setState){if(!confirm('Delete account?'))return;await deleteDoc(doc(db,'accounts',acc.id));setState(prev=>({...prev,accounts:prev.accounts.filter(a=>a.id!==acc.id),sessions:prev.sessions.filter(s=>s.accountId!==acc.id)}));}
async function deleteProject(p,setState){if(!confirm('Delete project?'))return;await deleteDoc(doc(db,'projects',p.id));setState(prev=>({...prev,projects:prev.projects.filter(x=>x.id!==p.id)}));}

function exportToExcel(filtered,f,state){
  if(!filtered.length)return alert('No data to export');
  if(typeof XLSX==='undefined')return alert('XLSX library not loaded');
  const rows=filtered.map(t=>{const secs=parseDuration(t.duration);const hrs=secs/3600;const acc=state.accounts.find(a=>`Account ${a.number}`===t.account)||{};const usr=state.users.find(u=>u.id===t.userId)||{};const payout=hrs*userRateForTask(t,state);const revenue=hrs*(acc.accountRate||0);return{'Date':fmtDate(t.workDate),'User':t.userName,'Binance ID':usr.binanceId||'—','Account':t.account,'Project':t.projectName||'—','Duration':fmtDuration(secs),'Revenue $':revenue.toFixed(2),'Payout $':payout.toFixed(2),'Profit $':(revenue-payout).toFixed(2),'Status':t.paid?'Paid':'Open'};});
  const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Billing');XLSX.writeFile(wb,`TeamUP_Billing_${f.from||'all'}_${f.to||'all'}.xlsx`);
}

function exportToPDF(filtered,f,state){
  if(!filtered.length)return alert('No data to export');
  const win=window.open('','_blank');
  const totalRevenue=filtered.reduce((s,t)=>{const hrs=parseDuration(t.duration)/3600;const acc=state.accounts.find(a=>`Account ${a.number}`===t.account)||{};return s+(hrs*(acc.accountRate||0));},0);
  const totalPayout=filtered.reduce((s,t)=>{const hrs=parseDuration(t.duration)/3600;return s+(hrs*userRateForTask(t,state));},0);
  const rows=filtered.map(t=>{const secs=parseDuration(t.duration);const hrs=secs/3600;const acc=state.accounts.find(a=>`Account ${a.number}`===t.account)||{};const payout=hrs*userRateForTask(t,state);const revenue=hrs*(acc.accountRate||0);return`<tr><td>${fmtDate(t.workDate)}</td><td>${t.userName}</td><td>${t.account}</td><td>${t.projectName||'—'}</td><td>${fmtDuration(secs)}</td><td>$${revenue.toFixed(2)}</td><td>$${payout.toFixed(2)}</td><td>$${(revenue-payout).toFixed(2)}</td></tr>`;}).join('');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>TeamUP Billing</title><style>body{font-family:Arial,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#f8fafc;padding:10px 8px;text-align:left;border-bottom:2px solid #e4e9f0;font-weight:600}td{padding:10px 8px;border-bottom:1px solid #f1f5f9}.total{margin-top:20px;text-align:right}@media print{button{display:none}}</style></head><body><h1>TeamUP Billing</h1><p>${f.from||'All'} → ${f.to||'All'}</p><table><thead><tr><th>Date</th><th>User</th><th>Account</th><th>Project</th><th>Duration</th><th>Revenue</th><th>Payout</th><th>Profit</th></tr></thead><tbody>${rows}</tbody></table><div class="total">Revenue: <strong>$${totalRevenue.toFixed(2)}</strong> Payout: <strong>$${totalPayout.toFixed(2)}</strong> Profit: <strong>$${(totalRevenue-totalPayout).toFixed(2)}</strong></div><br><button onclick="window.print()">Print</button></body></html>`);
  win.document.close();
}
