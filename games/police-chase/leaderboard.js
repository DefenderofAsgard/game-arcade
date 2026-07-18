const LEADERBOARD_DOC = db.collection("leaderboard").doc("copChaseTopScores");
const leaderboardListEl = document.getElementById("leaderboard-list");

let topScores = [];

function renderLeaderboard() {
  leaderboardListEl.innerHTML = "";
  if (topScores.length === 0) {
    leaderboardListEl.innerHTML = "<li>No scores yet — be the first!</li>";
    return;
  }
  for (const entry of topScores) {
    const li = document.createElement("li");
    li.textContent = `${entry.name} — ${entry.score}`;
    leaderboardListEl.appendChild(li);
  }
}

async function loadLeaderboard() {
  try {
    const snap = await LEADERBOARD_DOC.get();
    topScores = snap.exists ? snap.data().entries || [] : [];
  } catch (err) {
    topScores = [];
  }
  renderLeaderboard();
}

function qualifiesForTopThree(score) {
  if (topScores.length < 3) return true;
  return score > topScores[topScores.length - 1].score;
}

async function submitScore(name, score) {
  topScores.push({ name, score });
  topScores.sort((a, b) => b.score - a.score);
  topScores = topScores.slice(0, 3);
  renderLeaderboard();
  await LEADERBOARD_DOC.set({ entries: topScores });
}

window.Leaderboard = { loadLeaderboard, qualifiesForTopThree, submitScore };

loadLeaderboard();
