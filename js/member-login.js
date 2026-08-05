import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const memberLoginForm = document.getElementById("memberLoginForm");

  // Animate the login box on page load
  const loginBox = document.querySelector(".login-box");
  if (loginBox) {
    anime({
      targets: loginBox,
      translateY: [-50, 0],
      opacity: [0, 1],
      duration: 800,
      easing: "easeOutExpo",
    });
  }

  if (memberLoginForm) {
    memberLoginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const leaderName = document.getElementById("leaderName").value;
      const supportName = document.getElementById("supportName").value;
      const errorElement = document.getElementById("error");
      errorElement.textContent = ""; // Clear previous errors

      // Query Firestore to validate the names
      const membersRef = collection(db, "members");
      const q = query(
        membersRef,
        where("leaderName", "==", leaderName),
        where("supportName", "==", supportName),
      );

      try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          // No matching member found
          errorElement.textContent =
            "Invalid Leader or Support Name. Please try again.";
        } else {
          // Match found, proceed to member page
          sessionStorage.setItem("smot_leaderName", leaderName);
          sessionStorage.setItem("smot_supportName", supportName);
          window.location.href = "member.html";
        }
      } catch (error) {
        console.error("Error validating member:", error);
        errorElement.textContent =
          "An error occurred during login. Please try again later.";
      }
    });
  }
});
