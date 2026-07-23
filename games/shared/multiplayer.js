// Shared realtime "play a friend" room helper for board games (tic-tac-toe,
// checkers, chess). Reuses the platform Firebase app's Firestore (see
// ../../platform.js, loaded before this script) instead of a separate
// per-game Firebase project — rooms just live in one extra collection.
//
// Contract for callers:
//   - `state` you pass to createRoom/updateRoomState must be a plain object
//     whose values are either primitives or ARRAYS (e.g. a flat board array).
//     Firestore's set({merge:true}) deep-merges nested map fields, so any
//     object key you omit on a later write will silently keep its old value
//     — arrays don't have that problem because Firestore always replaces
//     arrays wholesale. Always send the full board array, every move.
const BoardGameMultiplayer = (function () {
  const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  const PLAYER_ID_KEY = "arcadePlayerId";

  function getMyId() {
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id) {
      id = "p_" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(PLAYER_ID_KEY, id);
    }
    return id;
  }

  function getMyName() {
    const user = typeof platformAuth !== "undefined" && platformAuth.currentUser;
    return (user && (user.displayName || user.email)) || null;
  }

  function generateRoomCode() {
    let code = "";
    for (let i = 0; i < 5; i++) {
      code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    return code;
  }

  function roomRef(roomId) {
    return platformDb.collection("boardGameRooms").doc(roomId);
  }

  // Creates a new room as "p1" and returns { roomId, playerSlot: "p1" }.
  async function createRoom(gameType, initialState) {
    const myId = getMyId();
    let roomId, ref, snap;
    for (let attempt = 0; attempt < 5; attempt++) {
      roomId = generateRoomCode();
      ref = roomRef(roomId);
      snap = await ref.get();
      if (!snap.exists) break;
    }
    await ref.set({
      game: gameType,
      state: initialState,
      turn: "p1",
      players: { p1: myId, p1Name: getMyName() || null, p2: null, p2Name: null },
      status: "waiting", // "waiting" -> "active" -> "finished"
      winner: null,
      createdAt: new Date(),
    });
    return { roomId, playerSlot: "p1" };
  }

  // Joins an existing room as "p2" (or rejoins as whichever slot you already
  // hold, e.g. after a page refresh). Throws with a user-facing message on
  // bad code / wrong game / full room.
  async function joinRoom(gameType, roomId) {
    const myId = getMyId();
    const id = roomId.trim().toUpperCase();
    const ref = roomRef(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Room not found. Check the code and try again.");
    const data = snap.data();
    if (data.game !== gameType) throw new Error("That code is for a different game.");
    if (data.players.p1 === myId) return { roomId: id, playerSlot: "p1", data };
    if (data.players.p2 === myId) return { roomId: id, playerSlot: "p2", data };
    if (data.players.p2) throw new Error("That room is already full.");
    await ref.set(
      { players: { p2: myId, p2Name: getMyName() || null }, status: "active" },
      { merge: true }
    );
    const fresh = await ref.get();
    return { roomId: id, playerSlot: "p2", data: fresh.data() };
  }

  // Subscribes to live changes on a room. Returns an unsubscribe function.
  function subscribeRoom(roomId, callback) {
    return roomRef(roomId).onSnapshot((snap) => {
      if (snap.exists) callback(snap.data());
    });
  }

  // Merge-writes fields onto a room doc (e.g. { state, turn, status, winner }).
  async function updateRoomState(roomId, updates) {
    await roomRef(roomId).set(updates, { merge: true });
  }

  return { getMyId, getMyName, createRoom, joinRoom, subscribeRoom, updateRoomState };
})();

window.BoardGameMultiplayer = BoardGameMultiplayer;
