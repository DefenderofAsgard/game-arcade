// Directions clockwise: 0=N, 1=E, 2=S, 3=W
const DIRS = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

const BASE_PORTS = {
  empty: [],
  straight: [0, 2],
  corner: [0, 1],
  battery: [0],
  bulb: [0],
};

function actualPorts(piece) {
  return BASE_PORTS[piece.type].map((p) => (p + piece.rotation) % 4);
}

function randInt(n) {
  return Math.floor(Math.random() * n);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function key(x, y) {
  return x + "," + y;
}

function dirBetween(a, b) {
  if (b.x === a.x && b.y === a.y - 1) return 0;
  if (b.x === a.x + 1 && b.y === a.y) return 1;
  if (b.x === a.x && b.y === a.y + 1) return 2;
  if (b.x === a.x - 1 && b.y === a.y) return 3;
  throw new Error("cells not adjacent");
}

function carvePath(W, H, start, end) {
  const visited = Array.from({ length: H }, () => Array(W).fill(false));
  const parent = {};
  const stack = [start];
  visited[start.y][start.x] = true;

  while (stack.length) {
    const cur = stack[stack.length - 1];
    if (cur.x === end.x && cur.y === end.y) {
      const path = [cur];
      let node = cur;
      while (!(node.x === start.x && node.y === start.y)) {
        node = parent[key(node.x, node.y)];
        path.unshift(node);
      }
      return path;
    }
    const dirsShuffled = shuffle([0, 1, 2, 3]);
    let moved = false;
    for (const d of dirsShuffled) {
      const nx = cur.x + DIRS[d].dx;
      const ny = cur.y + DIRS[d].dy;
      if (nx >= 0 && nx < W && ny >= 0 && ny < H && !visited[ny][nx]) {
        visited[ny][nx] = true;
        const node = { x: nx, y: ny };
        parent[key(nx, ny)] = cur;
        stack.push(node);
        moved = true;
        break;
      }
    }
    if (!moved) stack.pop();
  }
  return null;
}

function onPath(path, x, y) {
  return path.some((p) => p.x === x && p.y === y);
}

function generateLevel(level) {
  const size = Math.min(4 + Math.floor((level - 1) / 2), 6);
  const W = size;
  const H = size;

  const battery = { x: 0, y: randInt(H) };
  const bulb = { x: W - 1, y: randInt(H) };

  const path = carvePath(W, H, battery, bulb);

  const grid = [];
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < W; x++) {
      row.push({ type: "empty", rotation: 0, locked: false });
    }
    grid.push(row);
  }

  for (let i = 0; i < path.length; i++) {
    const { x, y } = path[i];
    if (i === 0) {
      const d = dirBetween(path[0], path[1]);
      grid[y][x] = { type: "battery", rotation: d, locked: true };
    } else if (i === path.length - 1) {
      const d = dirBetween(path[i], path[i - 1]);
      grid[y][x] = { type: "bulb", rotation: d, locked: true };
    } else {
      const dIn = dirBetween(path[i], path[i - 1]);
      const dOut = dirBetween(path[i], path[i + 1]);
      if ((dIn + 2) % 4 === dOut) {
        // straight: only 2 distinct states (vertical/horizontal), so the
        // perpendicular rotation is always wrong and forces a click to solve
        grid[y][x] = { type: "straight", rotation: (dIn + 1) % 4, locked: false };
      } else {
        const r = (dIn + 1) % 4 === dOut ? dIn : dOut;
        const wrongOptions = [0, 1, 2, 3].filter((v) => v !== r);
        grid[y][x] = { type: "corner", rotation: wrongOptions[randInt(wrongOptions.length)], locked: false };
      }
    }
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y][x].type === "empty" && !onPath(path, x, y)) {
        if (Math.random() < 0.7) {
          const t = Math.random() < 0.5 ? "straight" : "corner";
          grid[y][x] = { type: t, rotation: randInt(4), locked: false };
        }
      }
    }
  }

  return { grid, W, H, battery, bulb };
}

function isSolved(state) {
  const { grid, W, H, battery, bulb } = state;
  const visited = Array.from({ length: H }, () => Array(W).fill(false));
  const queue = [battery];
  visited[battery.y][battery.x] = true;

  while (queue.length) {
    const cur = queue.shift();
    if (cur.x === bulb.x && cur.y === bulb.y) return true;
    const piece = grid[cur.y][cur.x];
    const ports = actualPorts(piece);
    for (const d of ports) {
      const nx = cur.x + DIRS[d].dx;
      const ny = cur.y + DIRS[d].dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      if (visited[ny][nx]) continue;
      const nPiece = grid[ny][nx];
      const nPorts = actualPorts(nPiece);
      const opp = (d + 2) % 4;
      if (nPorts.includes(opp)) {
        visited[ny][nx] = true;
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return visited[bulb.y][bulb.x];
}

function pieceSvg(piece) {
  switch (piece.type) {
    case "straight":
      return '<svg viewBox="0 0 100 100"><line x1="50" y1="0" x2="50" y2="100" stroke="#39ff14" stroke-width="12" stroke-linecap="round"/></svg>';
    case "corner":
      return '<svg viewBox="0 0 100 100"><path d="M50 0 L50 50 L100 50" stroke="#39ff14" stroke-width="12" fill="none" stroke-linecap="round"/></svg>';
    case "battery":
      return '<svg viewBox="0 0 100 100"><line x1="50" y1="0" x2="50" y2="50" stroke="#ffb347" stroke-width="12" stroke-linecap="round"/><circle cx="50" cy="50" r="18" fill="#ffb347"/><text x="50" y="57" font-size="20" text-anchor="middle" fill="#3a2200" font-family="Arial">B</text></svg>';
    case "bulb":
      return '<svg viewBox="0 0 100 100"><line x1="50" y1="0" x2="50" y2="50" stroke="#888" stroke-width="12" stroke-linecap="round"/><circle class="bulb-circle" cx="50" cy="50" r="20" fill="#555"/></svg>';
    default:
      return "";
  }
}

let state = null;
let level = 1;
let score = 0;
let sessionStart = Date.now();
let timerHandle = null;
let solvedLock = false;
let newBestThisSession = false;

const BEST_KEY = "circuitBuilderBestScore";
let bestScore = Number(localStorage.getItem(BEST_KEY)) || 0;

const gridEl = document.getElementById("grid");
const levelEl = document.getElementById("level");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const timeEl = document.getElementById("time");
const giveUpBtn = document.getElementById("give-up");
const restartBtn = document.getElementById("restart");
const sessionOverEl = document.getElementById("session-over");
const newBestEl = document.getElementById("new-best");

bestScoreEl.textContent = bestScore;

function render() {
  gridEl.style.gridTemplateColumns = `repeat(${state.W}, 56px)`;
  gridEl.innerHTML = "";
  for (let y = 0; y < state.H; y++) {
    for (let x = 0; x < state.W; x++) {
      const piece = state.grid[y][x];
      const cell = document.createElement("div");
      cell.className = "cb-cell " + piece.type;
      const isWire = piece.type === "straight" || piece.type === "corner";
      if (isWire) {
        cell.classList.add("wire");
        cell.addEventListener("click", () => rotatePiece(x, y));
      }
      cell.innerHTML = pieceSvg(piece);
      const svg = cell.querySelector("svg");
      if (svg) svg.style.transform = `rotate(${piece.rotation * 90}deg)`;
      gridEl.appendChild(cell);
    }
  }
}

function rotatePiece(x, y) {
  if (solvedLock) return;
  const piece = state.grid[y][x];
  if (piece.locked) return;
  piece.rotation = (piece.rotation + 1) % 4;
  render();
  if (isSolved(state)) {
    handleSolved();
  }
}

function handleSolved() {
  solvedLock = true;
  const bulbCell = gridEl.children[state.bulb.y * state.W + state.bulb.x];
  bulbCell.classList.add("lit");
  const circle = bulbCell.querySelector(".bulb-circle");
  if (circle) circle.setAttribute("fill", "#ffe28a");
  score += 100 * level;
  scoreEl.textContent = score;
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(BEST_KEY, String(bestScore));
    bestScoreEl.textContent = bestScore;
    newBestThisSession = true;
  }
  setTimeout(() => {
    level += 1;
    startLevel();
  }, 900);
}

function startLevel() {
  solvedLock = false;
  state = generateLevel(level);
  levelEl.textContent = level;
  render();
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  timeEl.textContent = `${m}:${s.toString().padStart(2, "0")}`;
}

function endSession() {
  clearInterval(timerHandle);
  const elapsedSeconds = (Date.now() - sessionStart) / 1000;
  savePlatformProgress("circuitBuilder", { score, levelsCompleted: level - 1 });
  addPlaytime(elapsedSeconds);
  document.getElementById("final-levels").textContent = level - 1;
  document.getElementById("final-score").textContent = score;
  newBestEl.hidden = !newBestThisSession;
  sessionOverEl.hidden = false;
}

giveUpBtn.addEventListener("click", endSession);

restartBtn.addEventListener("click", () => {
  level = 1;
  score = 0;
  scoreEl.textContent = 0;
  newBestThisSession = false;
  sessionStart = Date.now();
  sessionOverEl.hidden = true;
  timerHandle = setInterval(updateTimer, 1000);
  startLevel();
});

startLevel();
timerHandle = setInterval(updateTimer, 1000);
