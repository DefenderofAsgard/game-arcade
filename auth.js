const provider = new firebase.auth.GoogleAuthProvider();

const signInBtn = document.getElementById("sign-in-btn");
const signOutBtn = document.getElementById("sign-out-btn");
const userInfo = document.getElementById("user-info");
const userName = document.getElementById("user-name");
const userPhoto = document.getElementById("user-photo");

signInBtn.addEventListener("click", () => {
  auth.signInWithPopup(provider).catch((err) => {
    console.error("Sign-in failed:", err);
  });
});

signOutBtn.addEventListener("click", () => {
  auth.signOut();
});

auth.onAuthStateChanged((user) => {
  if (user) {
    signInBtn.hidden = true;
    userInfo.hidden = false;
    userName.textContent = user.displayName;
    userPhoto.src = user.photoURL;

    db.collection("users").doc(user.uid).set(
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
