const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

// ── حذف تلقائي للتاسكات المدفوعة الأقدم من 30 يوم — بيشتغل كل يوم الساعة 3 صباحاً
exports.autoDeleteOldTasks = onSchedule('every day 03:00', async () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const snap = await db.collection('tasks')
    .where('paid', '==', true)
    .where('submittedAt', '<', cutoff.toISOString())
    .get();

  if (snap.empty) {
    console.log('No old tasks to delete.');
    return;
  }

  // حذف على دفعات (Firestore max 500 per batch)
  const BATCH_SIZE = 500;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  console.log(`Deleted ${docs.length} old paid tasks.`);
});

// ── addTask — callable function للمستخدمين لإضافة تاسك
exports.addTask = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login required');

  const email = request.auth?.token?.email || '';
  const usersSnap = await db.collection('users').get();
  const user = usersSnap.docs.map(d => d.data()).find(u => u.id === uid || u.email === email);
  if (!user) throw new HttpsError('not-found', 'User not found');

  const { workDate, platform, duration, payType, projectName, account, notes } = request.data;
  const id = 'task_' + Math.random().toString(36).slice(2, 12);

  const settingsSnap = await db.collection('settings').doc('main').get();
  const settings = settingsSnap.exists ? settingsSnap.data() : { globalRate: 6 };

  const projectsSnap = await db.collection('projects').get();
  const project = projectsSnap.docs.map(d => d.data()).find(p => p.name === projectName);
  const payoutRate = project?.payoutRate ?? user.payoutRate ?? settings.globalRate ?? 6;

  const task = {
    id,
    userId: user.id,
    userName: user.name,
    workDate,
    platform,
    duration,
    payType: payType || 'task',
    projectName: projectName || '',
    account: account || '',
    notes: notes || '',
    payoutRate,
    status: 'pending',
    paid: false,
    reviewNote: '',
    submittedAt: new Date().toISOString(),
  };

  await db.collection('tasks').doc(id).set(task);
  return { success: true, taskId: id };
});
