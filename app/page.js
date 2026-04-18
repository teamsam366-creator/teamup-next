'use client';

import { useEffect, useMemo, useState } from 'react';
import { db, auth } from './firebase';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';

const ADMIN_UIDS = new Set([
  'evTQJpWDdxYkhAdiZausCnbnZb62',
  'dy5JRtY4A3dYmG1tol3OkPQDSDT2',
  'YMN7sIbVbJZXKIwOH903Yd2ndTU2',
]);

export default function Home() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return <LoadingScreen />;
  }

  return <TeamUpApp />;
}

function TeamUpApp() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [state, setState] = useState({
    users: [],
    accounts: [],
    tasks: [],
    sessions: [],
    settings: { globalRate: 6 },
    paymentRecords: [],
    projects: [],
    routeTab: 'accounts',
    adminTab: 'payments',
    billingFilter: null,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user) {
        await loadData(setState);
      }
    });
    return () => unsub();
  }, []);

  if (!authReady) return <LoadingScreen />;

  if (!firebaseUser) {
    return <LoginView error={loginError} setLoginError={setLoginError} />;
  }

  const user = currentUser(firebaseUser, state);

  if (!user) return <LoadingScreen />;

  if (user.role === 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Header user={user} />
        <main className="mx-auto max-w-7xl px-4 py-6">
          <AdminView user={user} state={state} setState={setState} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header user={user} />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold">User View</h1>
          <p className="mt-2 text-sm text-slate-500">
            The app is running again. Admin Payments is restored first.
          </p>
        </div>
      </main>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="rounded-2xl border bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
        جاري الاتصال بقاعدة البيانات...
      </div>
    </div>
  );
}

function LoginView({ error = '', setLoginError }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState(error);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('teamup_email') || '';
    const savedPass = localStorage.getItem('teamup_pass') || '';
    if (savedEmail) {
      setEmail(savedEmail);
      setRemember(true);
    }
    if (savedPass) setPass(savedPass);
  }, []);

  const doLogin = async () => {
    if (!email || !pass) {
      const msg = 'Please enter email and password';
      setErr(msg);
      setLoginError?.(msg);
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);

      if (remember) {
        localStorage.setItem('teamup_email', email);
        localStorage.setItem('teamup_pass', pass);
      } else {
        localStorage.removeItem('teamup_email');
        localStorage.removeItem('teamup_pass');
      }
    } catch (e) {
      const msg = 'Invalid email or password';
      setErr(msg);
      setLoginError?.(msg);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl border bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-blue-600">Team UP</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to continue</p>
        </div>

        {err ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              type="password"
              className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="password"
              onKeyDown={(e) => e.key === 'Enter' && doLogin()}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Remember me
          </label>

          <button
            onClick={doLogin}
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? '...' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Header({ user }) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <div className="text-2xl font-bold text-blue-600">TeamUP</div>
        <div className="flex items-center gap-3">
          {user ? (
            <span className="rounded-lg border bg-slate-50 px-3 py-1 text-sm text-slate-600">
              {user.name}
            </span>
          ) : null}
          <button
            onClick={() => signOut(auth)}
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}

function AdminView({ state, setState }) {
  const tabs = ['tasks', 'billing', 'accounts', 'users', 'settings', 'payments'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 rounded-2xl border bg-white p-3 shadow-sm">
        {tabs.map((t) => {
          const active = state.adminTab === t;
          return (
            <button
              key={t}
              onClick={() => setState((p) => ({ ...p, adminTab: t }))}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          );
        })}
      </div>

      {state.adminTab === 'payments' ? (
        <AdminPaymentsView state={state} />
      ) : (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold capitalize">{state.adminTab}</h2>
          <p className="mt-2 text-sm text-slate-500">
            This tab is temporarily simplified while restoring the page safely.
          </p>
        </div>
      )}
    </div>
  );
}

function AdminPaymentsView({ state }) {
  const paidTasks = useMemo(() => {
    return state.tasks
      .filter((t) => t.paid && t.status === 'reviewed')
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  }, [state.tasks]);

  const byUser = useMemo(() => {
    const map = {};

    paidTasks.forEach((t) => {
      const secs = parseDuration(t.duration);
      const hrs = secs / 3600;
      const acc =
        state.accounts.find((a) => `Account ${a.number}` === t.account) || {};
      const revenue = hrs * Number(acc.accountRate || 0);
      const payout = hrs * userRateForTask(t, state);
      const profit = revenue - payout;

      if (!map[t.userId]) {
        map[t.userId] = {
          userId: t.userId,
          userName: t.userName,
          tasksCount: 0,
          revenue: 0,
          payout: 0,
          profit: 0,
        };
      }

      map[t.userId].tasksCount += 1;
      map[t.userId].revenue += revenue;
      map[t.userId].payout += payout;
      map[t.userId].profit += profit;
    });

    return Object.values(map).sort((a, b) =>
      a.userName.localeCompare(b.userName)
    );
  }, [paidTasks, state]);

  const batchRows = useMemo(() => {
    const batchesMap = {};

    paidTasks.forEach((t) => {
      const wb = getWeekBounds(t.workDate);
      const secs = parseDuration(t.duration);
      const hrs = secs / 3600;
      const acc =
        state.accounts.find((a) => `Account ${a.number}` === t.account) || {};
      const revenue = hrs * Number(acc.accountRate || 0);
      const payout = hrs * userRateForTask(t, state);
      const profit = revenue - payout;

      if (!batchesMap[wb.start]) {
        batchesMap[wb.start] = {
          start: wb.start,
          end: wb.end,
          tasksCount: 0,
          revenue: 0,
          payout: 0,
          profit: 0,
        };
      }

      batchesMap[wb.start].tasksCount += 1;
      batchesMap[wb.start].revenue += revenue;
      batchesMap[wb.start].payout += payout;
      batchesMap[wb.start].profit += profit;
    });

    return Object.values(batchesMap).sort(
      (a, b) => new Date(b.start) - new Date(a.start)
    );
  }, [paidTasks, state]);

  const totalRevenue = byUser.reduce((sum, row) => sum + row.revenue, 0);
  const totalPayout = byUser.reduce((sum, row) => sum + row.payout, 0);
  const totalProfit = byUser.reduce((sum, row) => sum + row.profit, 0);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-bold">Payments</h2>
          <p className="text-sm text-slate-500">
            User payment summary and weekly payment batches.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <StatCard label="Paid Tasks" value={paidTasks.length} color="slate" />
          <StatCard
            label="Total Revenue"
            value={`$${totalRevenue.toFixed(2)}`}
            color="blue"
          />
          <StatCard
            label="Total Payout"
            value={`$${totalPayout.toFixed(2)}`}
            color="amber"
          />
          <StatCard
            label="Total Profit"
            value={`$${totalProfit.toFixed(2)}`}
            color="green"
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Summary by User</h3>
          <p className="text-sm text-slate-500">
            Totals for all paid tasks grouped by user.
          </p>
        </div>

        {!byUser.length ? (
          <EmptyState text="No paid tasks yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="px-3 py-3 font-medium">User</th>
                  <th className="px-3 py-3 font-medium">Binance ID</th>
                  <th className="px-3 py-3 font-medium">Tasks</th>
                  <th className="px-3 py-3 font-medium">Revenue</th>
                  <th className="px-3 py-3 font-medium">Payout</th>
                  <th className="px-3 py-3 font-medium">Profit</th>
                </tr>
              </thead>
              <tbody>
                {byUser.map((row) => {
                  const user =
                    state.users.find((x) => x.id === row.userId) || {
                      name: row.userName,
                      binanceId: '—',
                    };

                  return (
                    <tr key={row.userId} className="border-b last:border-0">
                      <td className="px-3 py-3 font-medium">{user.name}</td>
                      <td className="px-3 py-3">{user.binanceId || '—'}</td>
                      <td className="px-3 py-3">{row.tasksCount}</td>
                      <td className="px-3 py-3 font-medium text-blue-600">
                        ${row.revenue.toFixed(2)}
                      </td>
                      <td className="px-3 py-3 font-medium text-amber-600">
                        ${row.payout.toFixed(2)}
                      </td>
                      <td className="px-3 py-3 font-medium text-green-600">
                        ${row.profit.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Payment Batches — All Time</h3>
          <p className="text-sm text-slate-500">
            Weekly grouped archive of paid tasks.
          </p>
        </div>

        {!batchRows.length ? (
          <EmptyState text="No payment batches yet" />
        ) : (
          <div className="space-y-3">
            {batchRows.map((batch) => (
              <div
                key={batch.start}
                className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="font-semibold">
                    {fmtDate(batch.start)} → {fmtDate(batch.end)}
                  </div>
                  <div className="text-sm text-slate-500">
                    {batch.tasksCount} paid task
                    {batch.tasksCount !== 1 ? 's' : ''}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 md:min-w-[420px]">
                  <MiniStat label="Revenue" value={batch.revenue} color="blue" />
                  <MiniStat label="Payout" value={batch.payout} color="amber" />
                  <MiniStat label="Profit" value={batch.profit} color="green" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'slate' }) {
  const colorMap = {
    slate: 'text-slate-900',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    green: 'text-green-600',
  };

  return (
    <div className="rounded-xl border p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${colorMap[color]}`}>
        {value}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color = 'blue' }) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-green-50 text-green-700',
  };

  return (
    <div className={`rounded-lg px-3 py-2 ${styles[color]}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold">${Number(value || 0).toFixed(2)}</div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function currentUser(firebaseUser, state) {
  if (!firebaseUser) return null;

  const uid = firebaseUser.uid;
  const email = firebaseUser.email || '';
  const displayName = firebaseUser.displayName || email.split('@')[0];

  if (ADMIN_UIDS.has(uid)) {
    return { id: uid, role: 'admin', name: displayName, email };
  }

  const dbUser = state.users.find((u) => u.id === uid || u.email === email);
  if (dbUser) return dbUser;

  return { id: uid, role: 'user', name: displayName, email };
}

async function loadData(setState) {
  const cols = ['users', 'accounts', 'tasks', 'sessions', 'paymentRecords', 'projects'];

  const results = await Promise.all(cols.map((c) => getDocs(collection(db, c))));
  const [users, accounts, tasks, sessions, paymentRecords, projects] = results.map(
    (s) => s.docs.map((d) => d.data())
  );

  const settings = { globalRate: 6 };

  setState((prev) => ({
    ...prev,
    users,
    accounts,
    tasks,
    sessions,
    paymentRecords,
    projects,
    settings,
  }));

  cols.forEach((colName) => {
    onSnapshot(collection(db, colName), (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      const data = snap.docs.map((d) => d.data());
      setState((prev) => ({ ...prev, [colName]: data }));
    });
  });
}

function parseDuration(str = '') {
  const h = Number((str.match(/(\d+)\s*h/i) || [])[1] || 0);
  const m = Number((str.match(/(\d+)\s*m/i) || [])[1] || 0);
  const s = Number((str.match(/(\d+)\s*s/i) || [])[1] || 0);
  return h * 3600 + m * 60 + s;
}

function userRateForTask(task, state) {
  const project = state.projects.find((p) => p.name === task.projectName);
  if (project?.userRate != null) return Number(project.userRate);
  return Number(state.settings?.globalRate || 6);
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB');
}

function getWeekBounds(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;

  const start = new Date(d);
  start.setDate(d.getDate() - diffToMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}
