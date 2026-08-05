import { db, auth } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  getDoc,
  deleteDoc,
  where,
  doc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  // Check if user is logged in
  auth.onAuthStateChanged((user) => {
    if (!user) {
      // If no user, redirect to login page.
      window.location.href = "login.html";
    } else {
      // If user is logged in, initialize the admin page.
      initializeAdminPage();
    }
  });

  function initializeAdminPage() {
    // Initialize event listeners and load data now that we know the user is authenticated.
    setupEventListeners();
    loadEvents();
    loadReports();
    loadMembers();
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
                    <div class="event-items">
                        ${event.items.map((item) => `<span>${item.name}: ${item.expected}</span>`).join("")}
                    </div>
                    <button class="btn btn-secondary edit-event-btn" data-id="${doc.id}">
                        Edit
                    </button>
                    <button class="btn btn-danger delete-event-btn" data-id="${doc.id}">
                        Delete
                    </button>
                `;
        eventsList.appendChild(div);
      });

      // Animate the event cards
      anime({
        targets: ".events-container .event-card",
        translateY: [50, 0],
        opacity: [0, 1],
        delay: anime.stagger(100), // 100ms delay between each card
      });
    });
  }

  // Populate form for editing an event
  async function startEditEvent(eventId) {
    try {
      const eventRef = doc(db, "events", eventId);
      const eventSnap = await getDoc(eventRef);

      if (eventSnap.exists()) {
        const event = eventSnap.data();
        const eventForm = document.getElementById("eventForm");

        document.getElementById("eventName").value = event.name;
        document.getElementById("eventDate").value = event.date;

        const itemsList = document.getElementById("itemsList");
        itemsList.innerHTML = event.items
          .map(
            (item) => `
          <div class="item-row">
            <input type="text" class="item-name" placeholder="Item name" required value="${item.name}">
            <input type="number" class="item-qty" placeholder="Quantity" min="0" required value="${item.expected}">
          </div>
        `,
          )
          .join("");

        eventForm.dataset.editingId = eventId;
        eventForm.scrollIntoView({ behavior: "smooth" });
        eventForm.querySelector('button[type="submit"]').textContent =
          "Save Changes";

        // Animate the form to draw attention
        anime({
          targets: "#eventForm",
          scale: [0.98, 1],
          duration: 400,
        });
      }
    } catch (error) {
      console.error("Error preparing event for edit: ", error);
    }
  }

  // Load reports
  function loadReports() {
    const reportsList = document.getElementById("reportsList");
    if (!reportsList) return;

    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));

    onSnapshot(q, async (snapshot) => {
      // Optimization: Fetch all events once to avoid N+1 queries.
      const eventsSnapshot = await getDocs(collection(db, "events"));
      const eventMap = new Map();
      eventsSnapshot.forEach((doc) => eventMap.set(doc.id, doc.data().name));

      reportsList.innerHTML = "";
      for (const doc of snapshot.docs) {
        const report = doc.data();
        const eventName = eventMap.get(report.eventId) || "Unknown Event";

        const div = document.createElement("div");
        div.className = "report-card";
        const submittedBy = report.leaderName
          ? `by ${report.leaderName} (Leader) & ${report.supportName} (Support)`
          : "";
        div.innerHTML = `
                    <h4>Event: ${eventName}</h4>
                    <p>Submitted ${submittedBy}</p>
                    <p>Submitted: ${new Date(report.createdAt.toDate()).toLocaleString()}</p>
                    ${report.discrepancies
                      .map(
                        (d) => `
                        <div class="discrepancy-item mismatch">
                            <span class="cross-icon">✗</span>
                            <span>${d.name}: Expected ${d.expected}, Got ${d.actual}</span>
                            <p>Reason: ${d.reason}</p>
                        </div>
                    `,
                      )
                      .join("")}
                    ${report.matches
                      .map(
                        (m) => `
                        <div class="discrepancy-item match">
                            <span class="check-icon">✓</span>
                            <span>${m.name}: ${m.expected} (matched)</span>
                        </div>
                    `,
                      )
                      .join("")}
                `;
        reportsList.appendChild(div);
      }

      // Animate the report cards
      anime({
        targets: ".reports-container .report-card",
        translateY: [50, 0],
        opacity: [0, 1],
        delay: anime.stagger(100),
      });
    });
  }

  // Load members
  function loadMembers() {
    const membersList = document.getElementById("membersList");
    if (!membersList) return;

    const q = query(collection(db, "members"), orderBy("leaderName"));

    onSnapshot(q, (snapshot) => {
      membersList.innerHTML = "";
      snapshot.forEach((doc) => {
        const member = doc.data();
        const div = document.createElement("div");
        div.className = "member-card";
        div.innerHTML = `
          <p><strong>Leader:</strong> ${member.leaderName}</p>
          <p><strong>Support:</strong> ${member.supportName}</p>
          <button class="btn btn-danger btn-small delete-member-btn" data-id="${doc.id}">
              Delete
          </button>
        `;
        membersList.appendChild(div);
      });
    });
  }

  // Delete member
  async function deleteMember(memberId) {
    if (!confirm("Are you sure you want to delete this member pair?")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "members", memberId));
    } catch (error) {
      console.error("Error deleting member:", error);
    }
  }

  // Delete event and associated reports
  async function deleteEvent(eventId) {
    try {
      // Delete the event document
      await deleteDoc(doc(db, "events", eventId));

      // Query and delete associated reports
      const reportsQuery = query(
        collection(db, "reports"),
        where("eventId", "==", eventId),
      );
      const reportSnapshots = await getDocs(reportsQuery);
      // Use Promise.all to delete associated reports in parallel for better performance.
      const deletePromises = reportSnapshots.docs.map((reportDoc) =>
        deleteDoc(reportDoc.ref),
      );
      await Promise.all(deletePromises);
    } catch (error) {
      console.error("Error deleting event and reports:", error);
    }
  }

  function setupEventListeners() {
    // Initialize modern date picker
    const eventDateInput = document.getElementById("eventDate");
    if (eventDateInput) {
      flatpickr(eventDateInput, {
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "F j, Y",
      });
    }
    // Add item row
    const addItemBtn = document.getElementById("addItemBtn");
    if (addItemBtn) {
      addItemBtn.addEventListener("click", () => {
        const itemsList = document.getElementById("itemsList");
        const div = document.createElement("div");
        div.className = "item-row";
        div.innerHTML = `
                  <input type="text" class="item-name" placeholder="Item name" required>
                  <input type="number" class="item-qty" placeholder="Quantity" min="0" required>
              `;
        itemsList.appendChild(div);
      });
    }

    // Create/Update event
    const eventForm = document.getElementById("eventForm");
    if (eventForm) {
      eventForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("eventName").value;
        const date = document.getElementById("eventDate").value;

        const itemRows = document.querySelectorAll(".item-row");
        const items = [];

        itemRows.forEach((row) => {
          const itemName = row.querySelector(".item-name").value;
          const itemQty = row.querySelector(".item-qty").value;
          if (itemName && itemQty) {
            items.push({ name: itemName, expected: parseInt(itemQty) });
          }
        });

        try {
          const editingId = eventForm.dataset.editingId;
          if (editingId) {
            // Update existing event
            const eventRef = doc(db, "events", editingId);
            await updateDoc(eventRef, { name, date, items });
            delete eventForm.dataset.editingId; // Clear editing state
            document.querySelector("#eventForm h2").textContent =
              "Create New Event";
            eventForm.querySelector('button[type="submit"]').textContent =
              "Create Event";
          } else {
            // Create new event
            await addDoc(collection(db, "events"), {
              name,
              date,
              items,
              createdAt: new Date(),
            });
          }
          document.getElementById("eventForm").reset();
          document.getElementById("itemsList").innerHTML = `
                      <div class="item-row">
                          <input type="text" class="item-name" placeholder="Item name" required>
                          <input type="number" class="item-qty" placeholder="Quantity" min="0" required>
                      </div>
                  `;
        } catch (error) {
          console.error("Error creating event:", error);
        }
      });
    }

    // Add member
    const memberForm = document.getElementById("memberForm");
    if (memberForm) {
      memberForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const leaderName = document.getElementById("leaderNameInput").value;
        const supportName = document.getElementById("supportNameInput").value;

        if (leaderName && supportName) {
          try {
            await addDoc(collection(db, "members"), {
              leaderName,
              supportName,
            });
            memberForm.reset();
          } catch (error) {
            console.error("Error adding member:", error);
            alert("Failed to add member.");
          }
        }
      });
    }

    // Logout
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        try {
          await signOut(auth);
          window.location.href = "login.html";
        } catch (error) {
          console.error("Logout Error:", error);
        }
      });
    }

    // Event delegation for delete buttons
    const eventsList = document.getElementById("eventsList");
    if (eventsList) {
      eventsList.addEventListener("click", async (e) => {
        if (e.target.classList.contains("delete-event-btn")) {
          const eventId = e.target.dataset.id;
          if (
            confirm(
              "Are you sure you want to delete this event? This will also delete all associated reports.",
            )
          ) {
            await deleteEvent(eventId);
          }
        }
      });

      // Event delegation for edit buttons
      eventsList.addEventListener("click", (e) => {
        if (e.target.classList.contains("edit-event-btn")) {
          const eventId = e.target.dataset.id;
          startEditEvent(eventId);
        }
      });
    }

    // Event delegation for deleting members
    const membersList = document.getElementById("membersList");
    if (membersList) {
      membersList.addEventListener("click", (e) => {
        if (e.target.classList.contains("delete-member-btn")) {
          deleteMember(e.target.dataset.id);
        }
      });
    }
  }
});
