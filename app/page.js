function AdminPaymentsView({ state }) {
  const paidTasks = state.tasks
    .filter((t) => t.paid && t.status === 'reviewed')
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  const byUser = {};
  paidTasks.forEach((t) => {
    const secs = parseDuration(t.duration);
    const hrs = secs / 3600;

    if (!byUser[t.userId]) {
      byUser[t.userId] = {
        userId: t.userId,
        userName: t.userName,
        tasksCount: 0,
        revenue: 0,
        payout: 0,
        profit: 0,
      };
    }

    const acc =
      state.accounts.find((a) => `Account ${a.number}` === t.account) || {};
    const revenue = hrs * (acc.accountRate || 0);
    const payout = hrs * userRateForTask(t, state);
    const profit = revenue - payout;

    byUser[t.userId].tasksCount += 1;
    byUser[t.userId].revenue += revenue;
    byUser[t.userId].payout += payout;
    byUser[t.userId].profit += profit;
  });

  const usersRows = Object.values(byUser).sort((a, b) =>
    a.userName.localeCompare(b.userName)
  );

  const totalRevenue = usersRows.reduce((sum, row) => sum + row.revenue, 0);
  const totalPayout = usersRows.reduce((sum, row) => sum + row.payout, 0);
  const totalProfit = usersRows.reduce((sum, row) => sum + row.profit, 0);

  const batchesMap = {};
  paidTasks.forEach((t) => {
    const wb = getWeekBounds(t.workDate);

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

    const secs = parseDuration(t.duration);
    const hrs = secs / 3600;
    const acc =
      state.accounts.find((a) => `Account ${a.number}` === t.account) || {};
    const revenue = hrs * (acc.accountRate || 0);
    const payout = hrs * userRateForTask(t, state);
    const profit = revenue - payout;

    batchesMap[wb.start].tasksCount += 1;
    batchesMap[wb.start].revenue += revenue;
    batchesMap[wb.start].payout += payout;
    batchesMap[wb.start].profit += profit;
  });

  const batchRows = Object.values(batchesMap).sort(
    (a, b) => new Date(b.start) - new Date(a.start)
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-bold">Payments</h2>
          <p className="text-sm text-gray-500">
            User payment summary and weekly payment batches.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border p-4">
            <div className="text-sm text-gray-500">Paid Tasks</div>
            <div className="mt-1 text-2xl font-bold">{paidTasks.length}</div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="text-sm text-gray-500">Total Revenue</div>
            <div className="mt-1 text-2xl font-bold text-blue-600">
              ${totalRevenue.toFixed(2)}
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="text-sm text-gray-500">Total Payout</div>
            <div className="mt-1 text-2xl font-bold text-amber-600">
              ${totalPayout.toFixed(2)}
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="text-sm text-gray-500">Total Profit</div>
            <div className="mt-1 text-2xl font-bold text-green-600">
              ${totalProfit.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Summary by User</h3>
          <p className="text-sm text-gray-500">
            Totals for all paid tasks grouped by user.
          </p>
        </div>

        {!usersRows.length ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-gray-500">
            No paid tasks yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="px-3 py-3 font-medium">User</th>
                  <th className="px-3 py-3 font-medium">Binance ID</th>
                  <th className="px-3 py-3 font-medium">Tasks</th>
                  <th className="px-3 py-3 font-medium">Revenue</th>
                  <th className="px-3 py-3 font-medium">Payout</th>
                  <th className="px-3 py-3 font-medium">Profit</th>
                </tr>
              </thead>
              <tbody>
                {usersRows.map((row) => {
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
          <p className="text-sm text-gray-500">
            Weekly grouped archive of paid tasks.
          </p>
        </div>

        {!batchRows.length ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-gray-500">
            No payment batches yet
          </div>
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
                  <div className="text-sm text-gray-500">
                    {batch.tasksCount} paid task
                    {batch.tasksCount !== 1 ? 's' : ''}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 md:min-w-[420px]">
                  <div className="rounded-lg bg-blue-50 px-3 py-2">
                    <div className="text-xs text-gray-500">Revenue</div>
                    <div className="font-semibold text-blue-700">
                      ${batch.revenue.toFixed(2)}
                    </div>
                  </div>

                  <div className="rounded-lg bg-amber-50 px-3 py-2">
                    <div className="text-xs text-gray-500">Payout</div>
                    <div className="font-semibold text-amber-700">
                      ${batch.payout.toFixed(2)}
                    </div>
                  </div>

                  <div className="rounded-lg bg-green-50 px-3 py-2">
                    <div className="text-xs text-gray-500">Profit</div>
                    <div className="font-semibold text-green-700">
                      ${batch.profit.toFixed(2)}
                    </div>
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
