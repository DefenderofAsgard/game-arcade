function formatDuration(totalSeconds) {
  const s = Math.round(totalSeconds || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function capitalize(word) {
  return word ? word[0].toUpperCase() + word.slice(1) : "—";
}

platformAuth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const accountPhoto = document.getElementById("account-photo");
  if (user.photoURL) {
    accountPhoto.src = user.photoURL;
    accountPhoto.hidden = false;
    accountPhoto.onerror = () => {
      accountPhoto.hidden = true;
    };
  } else {
    accountPhoto.hidden = true;
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

  const cb = progress.circuitBuilder || {};
  document.getElementById("cb-best").textContent = cb.bestScore ?? "—";
  document.getElementById("cb-played").textContent = cb.gamesPlayed ?? 0;

  const om = progress.orbitMechanics || {};
  document.getElementById("om-best").textContent = om.bestScore ?? "—";
  document.getElementById("om-played").textContent = om.gamesPlayed ?? 0;

  const er = progress.elementRush || {};
  document.getElementById("er-best").textContent = er.bestScore ?? "—";
  document.getElementById("er-played").textContent = er.gamesPlayed ?? 0;

  const ttt = progress.ticTacToe || {};
  document.getElementById("ttt-result").textContent = capitalize(ttt.result);
  document.getElementById("ttt-played").textContent = ttt.gamesPlayed ?? 0;

  const ck = progress.checkers || {};
  document.getElementById("ck-result").textContent = capitalize(ck.result);
  document.getElementById("ck-played").textContent = ck.gamesPlayed ?? 0;

  const ch = progress.chess || {};
  document.getElementById("ch-result").textContent = capitalize(ch.result);
  document.getElementById("ch-played").textContent = ch.gamesPlayed ?? 0;
});
