import { db } from "./firebase-config.js";
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  query,
  orderBy,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentEventId = null;
let currentEvent = null;

document.addEventListener("DOMContentLoaded", () => {
  // Redirect if leader/support names are not set
  const leaderName = sessionStorage.getItem("smot_leaderName");
  const supportName = sessionStorage.getItem("smot_supportName");
  if (!leaderName || !supportName) {
    window.location.href = "member-login.html";
    return;
  }
  // Load events
  function loadEvents() {
    const eventsList = document.getElementById("eventsList");
    if (!eventsList) return;

    const q = query(collection(db, "events"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
      eventsList.innerHTML = "";
      snapshot.forEach((doc) => {
        const event = doc.data();
        const div = document.createElement("div");
        div.className = "event-card";
        div.innerHTML = `
                    <h3>${event.name}</h3>
                    <p>Date: ${event.date}</p>
                    <button class="btn submit-report-btn" data-id="${doc.id}">Submit Report</button>
                `;
        eventsList.appendChild(div);
      });

      // Animate event cards
      anime({
        targets: "#eventsList .event-card",
        translateY: [50, 0],
        opacity: [0, 1],
        delay: anime.stagger(100),
      });
    });
  }

  // Show report form for a selected event
  async function showReportForm(eventId) {
    currentEventId = eventId;

    // Get event details
    const eventRef = doc(db, "events", eventId);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) return;
    currentEvent = eventSnap.data();
    const reportSection = document.getElementById("reportSection");
    const eventsSection = document.getElementById("eventsList").parentElement;

    document.getElementById("selectedEventName").textContent =
      currentEvent.name;
    reportSection.classList.remove("hidden");

    // Animate section transition
    anime({
      targets: eventsSection,
      opacity: 0,
      duration: 400,
      complete: () => eventsSection.classList.add("hidden"),
    });
    anime({
      targets: reportSection,
      translateY: [50, 0],
      opacity: [0, 1],
      duration: 600,
      delay: 200,
    });

    // Create input fields for each item
    const reportItems = document.getElementById("reportItems");
    reportItems.innerHTML = currentEvent.items
      .map(
        (item) => `
            <div class="report-item">
                <div class="report-item-input-group">
                    <label>${item.name}</label>
                    <div class="input-wrapper">
                        <input type="number" class="actual-qty" data-name="${item.name}" data-expected="${item.expected}" min="0" required>
                        <span class="validation-icon"></span>
                    </div>
                </div>
                <div class="reason-container hidden">
                    <textarea class="reason-input" placeholder="Reason for discrepancy..." data-name="${item.name}"></textarea>
                </div>
            </div>
        `,
      )
      .join("");

    // Add live validation listeners
    document.querySelectorAll(".actual-qty").forEach((input) => {
      input.addEventListener("input", validateItem);
    });
  }

  // Handle final report submission
  const reportForm = document.getElementById("reportForm");
  if (reportForm) {
    reportForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const leaderName = sessionStorage.getItem("smot_leaderName");
      const supportName = sessionStorage.getItem("smot_supportName");

      const discrepancies = [];
      const matches = [];

      document.querySelectorAll(".report-item").forEach((itemRow) => {
        const input = itemRow.querySelector(".actual-qty");
        const name = input.dataset.name;
        const expected = parseInt(input.dataset.expected);
        const actual = parseInt(input.value) || 0;

        if (actual !== expected) {
          const reasonInput = itemRow.querySelector(".reason-input");
          discrepancies.push({
            name,
            expected,
            actual,
            reason: reasonInput.value,
          });
        } else {
          matches.push({ name, expected, actual });
        }
      });

      // Save to Firebase
      try {
        await addDoc(collection(db, "reports"), {
          eventId: currentEventId,
          leaderName,
          supportName,
          discrepancies,
          matches,
          createdAt: new Date(),
        });

        alert("Report submitted successfully!");
        // Reset view
        document.getElementById("reportSection").classList.add("hidden");
        const eventsSection =
          document.getElementById("eventsList").parentElement;
        eventsSection.classList.remove("hidden");
        anime({
          targets: eventsSection,
          opacity: [0, 1],
          duration: 400,
        });
      } catch (error) {
        console.error("Error saving report:", error);
        alert("There was an error submitting your report. Please try again.");
      }
    });
  }

  // Live validation for each item
  function validateItem(e) {
    const input = e.target;
    const expected = parseInt(input.dataset.expected);
    const actual = parseInt(input.value);
    const itemRow = input.closest(".report-item");
    const icon = itemRow.querySelector(".validation-icon");
    const reasonContainer = itemRow.querySelector(".reason-container");

    if (isNaN(actual)) {
      icon.textContent = "";
      reasonContainer.classList.add("hidden");
    } else if (actual === expected) {
      icon.textContent = "✓";
      icon.className = "validation-icon match";
      reasonContainer.classList.add("hidden");
    } else {
      icon.textContent = "✗";
      icon.className = "validation-icon mismatch";
      reasonContainer.classList.remove("hidden");
    }
  }

  // Initialize
  function initializeMemberPage() {
    loadEvents();

    // Use event delegation for "Submit Report" buttons
    const eventsList = document.getElementById("eventsList");
    if (eventsList) {
      eventsList.addEventListener("click", (e) => {
        if (e.target.classList.contains("submit-report-btn")) {
          showReportForm(e.target.dataset.id);
        }
      });
    }
  }

  initializeMemberPage();
});
