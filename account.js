function formatDuration(totalSeconds) {
  const s = Math.round(totalSeconds || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

platformAuth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const accountPhoto = document.getElementById("account-photo");
  const accountInitial = document.getElementById("account-initial");
  accountInitial.textContent = (user.displayName || user.email || "?").charAt(0).toUpperCase();
  if (user.photoURL) {
    accountPhoto.src = user.photoURL;
    accountPhoto.hidden = false;
    accountInitial.hidden = true;
    accountPhoto.onerror = () => {
      accountPhoto.hidden = true;
      accountInitial.hidden = false;
    };
  } else {
    accountPhoto.hidden = true;
    accountInitial.hidden = false;
  }
  document.getElementById("account-name").textContent = user.displayName;

  const snap = await platformDb.collection("users").doc(user.uid).get();
  const data = snap.exists ? snap.data() : {};
  const progress = data.progress || {};

  document.getElementById("lifetime-playtime").textContent = formatDuration(data.totalPlaytimeSeconds);

  const sd = progress.stickDuel || {};
  document.getElementById("sd-best").textContent = sd.bestScore ?? "—";
  document.getElementById("sd-played").textContent = sd.gamesPlayed ?? 0;

  const cc = progress.copChase || {};
  document.getElementById("cc-best").textContent = cc.bestScore ?? "—";
  document.getElementById("cc-played").textContent = cc.gamesPlayed ?? 0;

  const jg = progress.jigsaw || {};
  document.getElementById("jg-completed").textContent = jg.puzzlesCompleted ?? 0;
  document.getElementById("jg-best").textContent =
    typeof jg.bestTimeSeconds === "number" ? formatDuration(jg.bestTimeSeconds) : "—";
});
