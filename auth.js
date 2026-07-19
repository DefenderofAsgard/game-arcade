const provider = new firebase.auth.GoogleAuthProvider();

const signInBtn = document.getElementById("sign-in-btn");
const signOutBtn = document.getElementById("sign-out-btn");
const userInfo = document.getElementById("user-info");
const userName = document.getElementById("user-name");
const userPhoto = document.getElementById("user-photo");
const userInitial = document.getElementById("user-initial");

function setAvatar(imgEl, initialEl, user) {
  initialEl.textContent = (user.displayName || user.email || "?").charAt(0).toUpperCase();
  if (user.photoURL) {
    imgEl.src = user.photoURL;
    imgEl.hidden = false;
    initialEl.hidden = true;
    imgEl.onerror = () => {
      imgEl.hidden = true;
      initialEl.hidden = false;
    };
  } else {
    imgEl.hidden = true;
    initialEl.hidden = false;
  }
}

signInBtn.addEventListener("click", () => {
  platformAuth.signInWithPopup(provider).catch((err) => {
    console.error("Sign-in failed:", err);
  });
});

signOutBtn.addEventListener("click", () => {
  platformAuth.signOut();
});

platformAuth.onAuthStateChanged((user) => {
  if (user) {
    signInBtn.hidden = true;
    userInfo.hidden = false;
    userName.textContent = user.displayName;
    setAvatar(userPhoto, userInitial, user);

    platformDb.collection("users").doc(user.uid).set(
      {
        name: user.displayName,
        email: user.email,
        lastSignIn: new Date(),
      },
      { merge: true }
    );
  } else {
    signInBtn.hidden = false;
    userInfo.hidden = true;
  }
});
