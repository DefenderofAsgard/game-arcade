const platformConfig = {
  apiKey: "AIzaSyA_Di4dypEz5kyIOW3Y-4SGrZf9GMkB6LI",
  authDomain: "game-arcade-platform.firebaseapp.com",
  projectId: "game-arcade-platform",
  storageBucket: "game-arcade-platform.firebasestorage.app",
  messagingSenderId: "994254905205",
  appId: "1:994254905205:web:7b137d1e64537aa0233d3c",
};

const platformApp =
  firebase.apps.find((a) => a.name === "platform") ||
  firebase.initializeApp(platformConfig, "platform");

const platformAuth = platformApp.auth();
const platformDb = platformApp.firestore();
platformDb.settings({
  experimentalForceLongPolling: true,
  useFetchStreams: false,
});

async function savePlatformProgress(gameId, data) {
  const user = platformAuth.currentUser;
  if (!user) return;
  try {
    const ref = platformDb.collection("users").doc(user.uid);
    const snap = await ref.get();
    const existing = snap.exists ? (snap.data().progress || {})[gameId] || {} : {};
    const merged = { ...existing, ...data, lastPlayed: new Date() };
    if (typeof data.score === "number") {
      merged.bestScore = Math.max(data.score, existing.bestScore || 0);
    }
    merged.gamesPlayed = (existing.gamesPlayed || 0) + 1;
    await ref.set({ progress: { [gameId]: merged } }, { merge: true });
  } catch (err) {
    console.error("[platform] savePlatformProgress failed", err);
  }
}

async function addPlaytime(seconds) {
  const user = platformAuth.currentUser;
  if (!user || !seconds || seconds <= 0) return;
  await platformDb
    .collection("users")
    .doc(user.uid)
    .set(
      { totalPlaytimeSeconds: firebase.firestore.FieldValue.increment(Math.round(seconds)) },
      { merge: true }
    );
}

async function saveJigsawState(state) {
  const user = platformAuth.currentUser;
  if (!user) return;
  await platformDb
    .collection("users")
    .doc(user.uid)
    .set({ progress: { jigsaw: { inProgress: state, lastPlayed: new Date() } } }, { merge: true });
}

async function loadJigsawState() {
  const user = platformAuth.currentUser;
  if (!user) return null;
  const snap = await platformDb.collection("users").doc(user.uid).get();
  return snap.exists ? (snap.data().progress || {}).jigsaw?.inProgress || null : null;
}

async function clearJigsawState(finalStats) {
  const user = platformAuth.currentUser;
  if (!user) return;
  const ref = platformDb.collection("users").doc(user.uid);
  const snap = await ref.get();
  const existing = snap.exists ? (snap.data().progress || {}).jigsaw || {} : {};
  const puzzlesCompleted = (existing.puzzlesCompleted || 0) + 1;
  const finalSeconds = finalStats && typeof finalStats.seconds === "number" ? finalStats.seconds : null;
  const bestTimeSeconds =
    finalSeconds !== null
      ? Math.min(finalSeconds, existing.bestTimeSeconds ?? finalSeconds)
      : existing.bestTimeSeconds ?? null;
  await ref.set(
    {
      progress: {
        jigsaw: {
          inProgress: null,
          puzzlesCompleted,
          bestTimeSeconds,
          lastPlayed: new Date(),
        },
      },
    },
    { merge: true }
  );
}
