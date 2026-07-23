const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const CANVAS_SIZE = canvas.width;

const levelEl = document.getElementById("level");
const scoreEl = document.getElementById("score");
const programListEl = document.getElementById("program-list");
const statusMsgEl = document.getElementById("status-msg");
const summaryEl = document.getElementById("summary");
const finalScoreEl = document.getElementById("final-score");
const finalLevelsEl = document.getElementById("final-levels");
const bestScoreEl = document.getElementById("best-score");
const newBestEl = document.getElementById("new-best");

const BEST_KEY = "codeRunnerBestScore";
let bestScore = Number(localStorage.getItem(BEST_KEY)) || 0;
bestScoreEl.textContent = bestScore;

const btnForward = document.getElementById("btn-forward");
const btnLeft = document.getElementById("btn-left");
const btnRight = document.getElementById("btn-right");
const btnRepeat = document.getElementById("btn-repeat");
const btnEndRepeat = document.getElementById("btn-end-repeat");
const btnUndo = document.getElementById("btn-undo");
const btnClear = document.getElementById("btn-clear");
const btnRun = document.getElementById("btn-run");
const btnEndSession = document.getElementById("btn-end-session");

// dir: 0 = up, 1 = right, 2 = down, 3 = left
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

let level = 1;
let score = 0;
let levelsCompleted = 0;
let sessionStart = Date.now();
let sessionEnded = false;

let gridSize = 6;
let walls = new Set();
let start = { x: 0, y: 0, dir: 1 };
let goal = { x: 0, y: 0 };

let program = [];
let openRepeat = null;

let robot = { x: 0, y: 0, dir: 1 };
let isRunning = false;

function cellKey(x, y) {
  return x + "," + y;
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < gridSize && y < gridSize;
}

function bfsSolvable(size, wallSet, from, to) {
  const visited = new Set([cellKey(from.x, from.y)]);
  const queue = [{ x: from.x, y: from.y }];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.x === to.x && cur.y === to.y) return true;
    for (let d = 0; d < 4; d++) {
      const nx = cur.x + DX[d];
      const ny = cur.y + DY[d];
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const key = cellKey(nx, ny);
      if (wallSet.has(key) || visited.has(key)) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return false;
}

function generateLevel() {
  gridSize = Math.min(9, 6 + Math.floor((level - 1) / 2));

  // Every 3rd level: a straight, open corridor that rewards using Repeat.
  const isCorridorLevel = level % 3 === 0;

  let attempts = 0;
  let placedWalls, s, g;

  do {
    attempts++;
    placedWalls = new Set();
    s = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize),
      dir: 1,
    };

    if (isCorridorLevel) {
      const horizontal = Math.random() < 0.5;
      if (horizontal) {
        s.x = 0;
        s.y = Math.floor(Math.random() * gridSize);
        s.dir = 1;
        g = { x: gridSize - 1, y: s.y };
      } else {
        s.x = Math.floor(Math.random() * gridSize);
        s.y = 0;
        s.dir = 2;
        g = { x: s.x, y: gridSize - 1 };
      }
      placedWalls = new Set();
    } else {
      g = {
        x: Math.floor(Math.random() * gridSize),
        y: Math.floor(Math.random() * gridSize),
      };
      const density = Math.min(0.32, 0.16 + level * 0.02);
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (x === s.x && y === s.y) continue;
          if (x === g.x && y === g.y) continue;
          if (Math.random() < density) placedWalls.add(cellKey(x, y));
        }
      }
    }
  } while (
    attempts < 200 &&
    ((s.x === g.x && s.y === g.y) ||
      Math.abs(s.x - g.x) + Math.abs(s.y - g.y) < (isCorridorLevel ? gridSize - 1 : 3) ||
      !bfsSolvable(gridSize, placedWalls, s, g))
  );

  if (!bfsSolvable(gridSize, placedWalls, s, g)) {
    // Fallback: guaranteed-solvable empty maze.
    placedWalls = new Set();
  }

  walls = placedWalls;
  start = s;
  goal = g;
  robot = { x: start.x, y: start.y, dir: start.dir };
}

function cellSize() {
  return CANVAS_SIZE / gridSize;
}

function drawMaze() {
  const cs = cellSize();
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  ctx.strokeStyle = "#3a3a3a";
  for (let i = 0; i <= gridSize; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cs, 0);
    ctx.lineTo(i * cs, CANVAS_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cs);
    ctx.lineTo(CANVAS_SIZE, i * cs);
    ctx.stroke();
  }

  ctx.fillStyle = "#111";
  walls.forEach((key) => {
    const [x, y] = key.split(",").map(Number);
    ctx.fillRect(x * cs + 1, y * cs + 1, cs - 2, cs - 2);
  });

  ctx.fillStyle = "#2b8a5e";
  ctx.fillRect(goal.x * cs + 4, goal.y * cs + 4, cs - 8, cs - 8);
  ctx.fillStyle = "#f0f0f0";
  ctx.font = `${cs * 0.5}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("★", goal.x * cs + cs / 2, goal.y * cs + cs / 2 + 1);

  drawRobot();
}

function drawRobot() {
  const cs = cellSize();
  const cx = robot.x * cs + cs / 2;
  const cy = robot.y * cs + cs / 2;
  const r = cs * 0.35;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((robot.dir * Math.PI) / 2);
  ctx.fillStyle = "#8ecbff";
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.8, r * 0.8);
  ctx.lineTo(-r * 0.8, r * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function renderProgram() {
  programListEl.innerHTML = "";
  program.forEach((item, idx) => {
    const li = document.createElement("li");
    if (item.type === "repeat") {
      li.className = "repeat-item";
      const bodyText = item.body
        .map((b) => instructionLabel(b.type))
        .join(", ") || "(empty)";
      const label = document.createElement("span");
      label.textContent = `Repeat x`;
      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.max = "10";
      input.value = item.count;
      input.style.width = "40px";
      input.disabled = isRunning;
      input.addEventListener("change", () => {
        let v = parseInt(input.value, 10);
        if (isNaN(v)) v = 2;
        v = Math.max(1, Math.min(10, v));
        item.count = v;
        input.value = v;
      });
      const tail = document.createElement("span");
      tail.textContent = `: [ ${bodyText} ]${openRepeat === item ? "  ◀ editing" : ""}`;
      li.appendChild(label);
      li.appendChild(input);
      li.appendChild(tail);
    } else {
      li.textContent = instructionLabel(item.type);
    }
    programListEl.appendChild(li);
  });
}

function instructionLabel(type) {
  if (type === "forward") return "Forward";
  if (type === "left") return "Turn Left";
  if (type === "right") return "Turn Right";
  return type;
}

function currentTarget() {
  return openRepeat ? openRepeat.body : program;
}

function addInstruction(type) {
  if (isRunning) return;
  currentTarget().push({ type });
  renderProgram();
}

function addRepeat() {
  if (isRunning || openRepeat) return;
  const block = { type: "repeat", count: 2, body: [] };
  program.push(block);
  openRepeat = block;
  updateBuilderButtons();
  renderProgram();
}

function endRepeat() {
  if (isRunning) return;
  openRepeat = null;
  updateBuilderButtons();
  renderProgram();
}

function undoLast() {
  if (isRunning) return;
  const target = currentTarget();
  if (target.length > 0) {
    target.pop();
  }
  renderProgram();
}

function clearProgram() {
  if (isRunning) return;
  program = [];
  openRepeat = null;
  updateBuilderButtons();
  renderProgram();
}

function updateBuilderButtons() {
  btnRepeat.disabled = isRunning || !!openRepeat;
  btnEndRepeat.disabled = isRunning || !openRepeat;
  btnForward.disabled = isRunning;
  btnLeft.disabled = isRunning;
  btnRight.disabled = isRunning;
  btnUndo.disabled = isRunning;
  btnClear.disabled = isRunning;
  btnRun.disabled = isRunning || program.length === 0;
  btnEndSession.disabled = isRunning;
}

function expandProgram() {
  const flat = [];
  program.forEach((item) => {
    if (item.type === "repeat") {
      for (let i = 0; i < item.count; i++) {
        item.body.forEach((b) => flat.push(b.type));
      }
    } else {
      flat.push(item.type);
    }
  });
  return flat;
}

function runProgram() {
  if (isRunning || program.length === 0) return;
  if (openRepeat) endRepeat();

  const steps = expandProgram();
  isRunning = true;
  updateBuilderButtons();
  statusMsgEl.textContent = "Running…";
  statusMsgEl.style.color = "#ffe28a";

  robot = { x: start.x, y: start.y, dir: start.dir };
  drawMaze();

  let i = 0;
  function step() {
    if (i >= steps.length) {
      finishRun(false);
      return;
    }
    const instr = steps[i];
    if (instr === "left") {
      robot.dir = (robot.dir + 3) % 4;
    } else if (instr === "right") {
      robot.dir = (robot.dir + 1) % 4;
    } else if (instr === "forward") {
      const nx = robot.x + DX[robot.dir];
      const ny = robot.y + DY[robot.dir];
      if (!inBounds(nx, ny) || walls.has(cellKey(nx, ny))) {
        drawMaze();
        finishRun("crash");
        return;
      }
      robot.x = nx;
      robot.y = ny;
    }
    drawMaze();

    if (robot.x === goal.x && robot.y === goal.y) {
      finishRun("win");
      return;
    }

    i++;
    setTimeout(step, 350);
  }

  setTimeout(step, 350);
}

function finishRun(result) {
  if (result === "crash") {
    statusMsgEl.textContent = "Crashed! Try again.";
    statusMsgEl.style.color = "#ff8080";
    setTimeout(() => {
      robot = { x: start.x, y: start.y, dir: start.dir };
      drawMaze();
      isRunning = false;
      updateBuilderButtons();
      statusMsgEl.textContent = "";
    }, 800);
  } else if (result === "win") {
    const topLevelLength = program.length;
    const basePoints = 100 + (level - 1) * 10;
    const points = Math.max(20, basePoints - topLevelLength * 8);
    score += points;
    levelsCompleted += 1;
    scoreEl.textContent = score;
    statusMsgEl.textContent = `Level complete! +${points} pts`;
    statusMsgEl.style.color = "#2b8a5e";

    setTimeout(() => {
      level += 1;
      levelEl.textContent = level;
      program = [];
      openRepeat = null;
      generateLevel();
      drawMaze();
      renderProgram();
      isRunning = false;
      updateBuilderButtons();
      statusMsgEl.textContent = "";
    }, 1100);
  } else {
    statusMsgEl.textContent = "Program ended — didn't reach the goal.";
    statusMsgEl.style.color = "#ffe28a";
    setTimeout(() => {
      robot = { x: start.x, y: start.y, dir: start.dir };
      drawMaze();
      isRunning = false;
      updateBuilderButtons();
      statusMsgEl.textContent = "";
    }, 800);
  }
}

function endSession() {
  if (sessionEnded || isRunning) return;
  sessionEnded = true;
  const elapsedSeconds = (Date.now() - sessionStart) / 1000;
  savePlatformProgress("codeRunner", { score, levelsCompleted });
  addPlaytime(elapsedSeconds);

  finalScoreEl.textContent = score;
  finalLevelsEl.textContent = levelsCompleted;
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(BEST_KEY, String(bestScore));
    bestScoreEl.textContent = bestScore;
    newBestEl.hidden = false;
  } else {
    newBestEl.hidden = true;
  }
  summaryEl.hidden = false;

  [
    btnForward,
    btnLeft,
    btnRight,
    btnRepeat,
    btnEndRepeat,
    btnUndo,
    btnClear,
    btnRun,
    btnEndSession,
  ].forEach((b) => (b.disabled = true));
}

btnForward.addEventListener("click", () => addInstruction("forward"));
btnLeft.addEventListener("click", () => addInstruction("left"));
btnRight.addEventListener("click", () => addInstruction("right"));
btnRepeat.addEventListener("click", addRepeat);
btnEndRepeat.addEventListener("click", endRepeat);
btnUndo.addEventListener("click", undoLast);
btnClear.addEventListener("click", clearProgram);
btnRun.addEventListener("click", runProgram);
btnEndSession.addEventListener("click", endSession);
document.getElementById("btn-new-session").addEventListener("click", () => window.location.reload());

generateLevel();
drawMaze();
renderProgram();
updateBuilderButtons();
