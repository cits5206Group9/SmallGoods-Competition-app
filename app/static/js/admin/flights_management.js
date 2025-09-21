// Flights Management JavaScript
document.addEventListener("DOMContentLoaded", function () {
  // DOM Elements
  const competitionSelect = document.getElementById("competition-select");
  const eventSelect = document.getElementById("event-select");
  const flightsContainer = document.getElementById("flights-container");
  const flightsList = document.getElementById("flights-list");
  const flightsGrid = document.getElementById("flights-grid");
  const emptyState = document.getElementById("empty-state");
  const addFlightBtn = document.getElementById("add-flight-btn");
  const flightModal = document.getElementById("flight-modal");
  const flightForm = document.getElementById("flight-form");
  const deleteFlightModal = document.getElementById("delete-flight-modal");
  const flightAthletesSection = document.getElementById(
    "flight-athletes-section"
  );

  let currentEventId = null;
  let currentFlightId = null;
  let deleteFlightId = null;
  let flightsSortable = null;
  let attemptsSortable = null;
  let availableAthletesPage = 1;
  let availableAthletesPagination = null;

  // Initialize
  init();

  function init() {
    bindEvents();
    loadCompetitions();
  }

  function bindEvents() {
    // Competition and event selection
    competitionSelect.addEventListener("change", handleCompetitionChange);
    eventSelect.addEventListener("change", handleEventChange);

    // Show all flights button
    document
      .getElementById("show-all-flights")
      .addEventListener("click", showAllFlights);

    // Add flight button
    addFlightBtn.addEventListener("click", showAddFlightModal);

    // Modal close buttons
    document.querySelectorAll(".close").forEach((closeBtn) => {
      closeBtn.addEventListener("click", closeModals);
    });

    // Cancel buttons
    document
      .getElementById("cancel-flight-btn")
      .addEventListener("click", closeModals);
    document
      .getElementById("cancel-delete-flight-btn")
      .addEventListener("click", closeModals);

    // Form submission
    flightForm.addEventListener("submit", handleFlightFormSubmit);

    // Delete confirmation
    document
      .getElementById("confirm-delete-flight-btn")
      .addEventListener("click", confirmDeleteFlight);

    // Attempt order controls
    document
      .getElementById("sort-by-weight")
      .addEventListener("click", () => sortAttempts("weight"));
    document
      .getElementById("sort-by-name")
      .addEventListener("click", () => sortAttempts("name"));
    document
      .getElementById("randomize-order")
      .addEventListener("click", () => sortAttempts("random"));

    // Click outside modal to close
    window.addEventListener("click", function (event) {
      if (event.target === flightModal || event.target === deleteFlightModal) {
        closeModals();
      }
    });
  }

  async function loadCompetitions() {
    try {
      const response = await fetch("/admin/competitions");
      if (!response.ok) throw new Error("Failed to load competitions");

      const competitions = await response.json();

      competitionSelect.innerHTML =
        '<option value="">Select Competition</option>';
      competitions.forEach((competition) => {
        const option = document.createElement("option");
        option.value = competition.id;
        option.textContent = competition.name;
        competitionSelect.appendChild(option);
      });
    } catch (error) {
      console.error("Error loading competitions:", error);
      showNotification("Error loading competitions", "error");
    }
  }

  async function handleCompetitionChange() {
    const competitionId = competitionSelect.value;

    // Reset event select
    eventSelect.innerHTML = '<option value="">Select Event</option>';
    eventSelect.disabled = !competitionId;

    // Hide flights
    showEmptyState();

    if (!competitionId) return;

    try {
      const response = await fetch(
        `/admin/competitions/${competitionId}/events`
      );
      if (!response.ok) throw new Error("Failed to load events");

      const events = await response.json();

      events.forEach((event) => {
        const option = document.createElement("option");
        option.value = event.id;
        option.textContent = event.name;
        eventSelect.appendChild(option);
      });

      eventSelect.disabled = false;
    } catch (error) {
      console.error("Error loading events:", error);
      showNotification("Error loading events", "error");
    }
  }

  async function handleEventChange() {
    const eventId = eventSelect.value;
    currentEventId = eventId;

    if (!eventId) {
      showEmptyState();
      return;
    }

    await loadFlights(eventId);
  }

  async function loadFlights(eventId) {
    try {
      if (!eventId) {
        showEmptyState("Please select an event to view flights");
        return;
      }

      showLoading(flightsContainer);

      const response = await fetch(`/admin/events/${eventId}/flights`);
      if (!response.ok) throw new Error("Failed to load flights");

      const flights = await response.json();

      if (flights.length === 0) {
        showEmptyState("No flights found for this event");
      } else {
        displayFlights(flights);
      }
    } catch (error) {
      console.error("Error loading flights:", error);
      showNotification("Error loading flights", "error");
      showEmptyState();
    } finally {
      hideLoading(flightsContainer);
    }
  }

  async function showAllFlights() {
    try {
      showLoading(flightsContainer);

      const response = await fetch("/admin/flights/all");
      if (!response.ok) throw new Error("Failed to load all flights");

      const flights = await response.json();

      if (flights.length === 0) {
        showEmptyState("No flights found");
      } else {
        displayFlights(flights);
        // Clear event selection since we're showing all flights
        currentEventId = null;
        eventSelect.value = "";
        competitionSelect.value = "";
      }
    } catch (error) {
      console.error("Error loading all flights:", error);
      showNotification("Error loading all flights", "error");
      showEmptyState();
    } finally {
      hideLoading(flightsContainer);
    }
  }

  function displayFlights(flights) {
    emptyState.style.display = "none";
    flightsList.style.display = "block";
    flightAthletesSection.style.display = "none";

    // Sort flights by order
    flights.sort((a, b) => a.order - b.order);

    flightsGrid.innerHTML = "";

    flights.forEach((flight) => {
      const flightCard = createFlightCard(flight);
      flightsGrid.appendChild(flightCard);
    });

    // Initialize sortable
    initializeFlightsSortable();
  }

  function createFlightCard(flight) {
    const card = document.createElement("div");
    card.className = `flight-card ${flight.is_active ? "active" : ""}`;
    card.dataset.flightId = flight.id;
    card.dataset.flightOrder = flight.order;

    card.innerHTML = `
            <div class="flight-card-header">
                <div class="flight-name">${flight.name}</div>
                <div class="flight-order">Order: ${flight.order}</div>
            </div>
            <div class="flight-info">
                <p class="athlete-count"><strong>${
                  flight.athlete_count || 0
                }</strong> athletes</p>
                <p>Status: ${flight.is_active ? "Active" : "Inactive"}</p>
            </div>
            <div class="flight-actions">
                <button class="btn btn-sm btn-secondary edit-flight" data-flight-id="${
                  flight.id
                }">
                    <span class="icon-edit"></span> Edit
                </button>
                <button class="btn btn-sm btn-primary manage-athletes" data-flight-id="${
                  flight.id
                }">
                    Athletes
                </button>
                <button class="btn btn-sm btn-danger delete-flight" data-flight-id="${
                  flight.id
                }">
                    <span class="icon-delete"></span> Delete
                </button>
            </div>
        `;

    // Bind events
    card
      .querySelector(".edit-flight")
      .addEventListener("click", handleEditFlight);
    card
      .querySelector(".manage-athletes")
      .addEventListener("click", handleManageAthletes);
    card
      .querySelector(".delete-flight")
      .addEventListener("click", handleDeleteFlight);

    return card;
  }

  function initializeFlightsSortable() {
    if (flightsSortable) {
      flightsSortable.destroy();
    }

    flightsSortable = new Sortable(flightsGrid, {
      animation: 150,
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      onEnd: function (evt) {
        updateFlightOrder();
      },
    });
  }

  async function updateFlightOrder() {
    const flightCards = flightsGrid.querySelectorAll(".flight-card");
    const updates = [];

    flightCards.forEach((card, index) => {
      const flightId = card.dataset.flightId;
      const newOrder = index + 1;
      updates.push({ id: flightId, order: newOrder });

      // Update display
      card.querySelector(".flight-order").textContent = `Order: ${newOrder}`;
      card.dataset.flightOrder = newOrder;
    });

    try {
      const response = await fetch("/admin/flights/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ updates: updates }),
      });

      if (!response.ok) throw new Error("Failed to update flight order");

      showNotification("Flight order updated successfully", "success");
    } catch (error) {
      console.error("Error updating flight order:", error);
      showNotification("Error updating flight order", "error");
      // Reload flights to reset order
      loadFlights(currentEventId);
    }
  }

  async function showAddFlightModal() {
    currentFlightId = null;
    document.getElementById("flight-modal-title").textContent =
      "Add New Flight";
    document.getElementById("save-flight-btn").textContent = "Save Flight";
    flightForm.reset();

    // Populate event dropdown
    await populateEventDropdown();

    // Set default order
    const flightCards = flightsGrid.querySelectorAll(".flight-card");
    document.getElementById("flight_order").value = flightCards.length + 1;

    // Pre-select current event if available
    if (currentEventId) {
      document.getElementById("flight_event_id").value = currentEventId;
    }

    flightModal.style.display = "block";
    document.getElementById("flight_name").focus();
  }

  async function populateEventDropdown() {
    try {
      const eventSelect = document.getElementById("flight_event_id");
      eventSelect.innerHTML = '<option value="">Select Event</option>';

      // Get all competitions first
      const competitionsResponse = await fetch("/admin/competitions");
      if (!competitionsResponse.ok)
        throw new Error("Failed to load competitions");
      const competitions = await competitionsResponse.json();

      // Get events for each competition
      for (const competition of competitions) {
        const eventsResponse = await fetch(
          `/admin/competitions/${competition.id}/events`
        );
        if (eventsResponse.ok) {
          const events = await eventsResponse.json();

          if (events.length > 0) {
            const optgroup = document.createElement("optgroup");
            optgroup.label = competition.name;

            events.forEach((event) => {
              const option = document.createElement("option");
              option.value = event.id;
              option.textContent = event.name;
              optgroup.appendChild(option);
            });

            eventSelect.appendChild(optgroup);
          }
        }
      }
    } catch (error) {
      console.error("Error loading events:", error);
      showNotification("Error loading events", "error");
    }
  }

  async function handleEditFlight(event) {
    const flightId = event.target.closest("button").dataset.flightId;
    currentFlightId = flightId;

    document.getElementById("flight-modal-title").textContent = "Edit Flight";
    document.getElementById("save-flight-btn").textContent = "Update Flight";

    // Populate event dropdown first
    await populateEventDropdown();

    // Load flight data
    loadFlightData(flightId);

    flightModal.style.display = "block";
  }

  async function loadFlightData(flightId) {
    try {
      showLoading(flightForm);
      const response = await fetch(`/admin/flights/${flightId}`);

      if (!response.ok) throw new Error("Failed to load flight data");

      const flight = await response.json();

      document.getElementById("flight_name").value = flight.name;
      document.getElementById("flight_order").value = flight.order;
      document.getElementById("flight_is_active").checked = flight.is_active;
      document.getElementById("flight_event_id").value = flight.event_id;
    } catch (error) {
      console.error("Error loading flight data:", error);
      showNotification("Error loading flight data", "error");
    } finally {
      hideLoading(flightForm);
    }
  }

  async function handleFlightFormSubmit(event) {
    event.preventDefault();

    const formData = new FormData(flightForm);
    const eventId = formData.get("event_id") || currentEventId;

    const flightData = {
      name: formData.get("flight_name"),
      order: parseInt(formData.get("flight_order")),
      is_active: formData.has("is_active"),
    };

    // Only add event_id if it's provided and not empty
    if (eventId && eventId.trim() !== "") {
      flightData.event_id = parseInt(eventId);
    }

    try {
      showLoading(flightForm);

      const url = currentFlightId
        ? `/admin/flights/${currentFlightId}`
        : "/admin/flights";

      const method = currentFlightId ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(flightData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save flight");
      }

      const result = await response.json();
      showNotification(result.message, "success");
      closeModals();

      // Reload flights - only if we have a current event selected
      if (currentEventId) {
        await loadFlights(currentEventId);
      } else {
        // If no event selected, we could reload all flights or show a different view
        showNotification(
          "Flight created successfully. Select an event to view flights.",
          "info"
        );
      }
    } catch (error) {
      console.error("Error saving flight:", error);
      showNotification(error.message, "error");
    } finally {
      hideLoading(flightForm);
    }
  }

  function handleDeleteFlight(event) {
    deleteFlightId = event.target.closest("button").dataset.flightId;
    const card = event.target.closest(".flight-card");
    const flightName = card.querySelector(".flight-name").textContent;

    document.getElementById("delete-flight-name").textContent = flightName;
    deleteFlightModal.style.display = "block";
  }

  async function confirmDeleteFlight() {
    if (!deleteFlightId) return;

    try {
      showLoading(deleteFlightModal);

      const response = await fetch(`/admin/flights/${deleteFlightId}`, {
        method: "DELETE",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete flight");
      }

      const result = await response.json();
      showNotification(result.message, "success");
      closeModals();

      // Reload flights
      await loadFlights(currentEventId);
    } catch (error) {
      console.error("Error deleting flight:", error);
      showNotification(error.message, "error");
    } finally {
      hideLoading(deleteFlightModal);
      deleteFlightId = null;
    }
  }

  async function handleManageAthletes(event) {
    const flightId = event.target.closest("button").dataset.flightId;
    currentFlightId = flightId;

    const card = event.target.closest(".flight-card");
    const flightName = card.querySelector(".flight-name").textContent;
    const flightOrder = card.dataset.flightOrder;

    document.getElementById("current-flight-name").textContent = flightName;
    document.getElementById(
      "current-flight-order"
    ).textContent = `Order: ${flightOrder}`;

    // Load flight athletes
    await loadFlightAthletes(flightId);

    // Show athletes section
    flightsList.style.display = "none";
    flightAthletesSection.style.display = "block";
  }

  async function loadFlightAthletes(flightId) {
    try {
      showLoading(flightAthletesSection);

      // Load available athletes with pagination
      const searchTerm = document.getElementById("available-search").value;
      const availableResponse = await fetch(
        `/admin/events/${currentEventId}/available-athletes?page=${availableAthletesPage}&search=${encodeURIComponent(
          searchTerm
        )}`
      );
      if (!availableResponse.ok)
        throw new Error("Failed to load available athletes");
      const availableData = await availableResponse.json();
      const availableAthletes = availableData.athletes || availableData; // Handle both old and new format
      availableAthletesPagination = availableData.pagination || null;

      // Load flight athletes
      const flightResponse = await fetch(`/admin/flights/${flightId}/athletes`);
      if (!flightResponse.ok) throw new Error("Failed to load flight athletes");
      const flightAthletes = await flightResponse.json();

      displayAvailableAthletes(availableAthletes);
      displayAvailableAthletesPagination();
      displayFlightAthletes(flightAthletes);
      initializeAttemptOrder(flightAthletes);
    } catch (error) {
      console.error("Error loading flight athletes:", error);
      showNotification("Error loading athletes", "error");
    } finally {
      hideLoading(flightAthletesSection);
    }
  }

  function displayAvailableAthletes(athletes) {
    const container = document.getElementById("available-athletes-list");
    container.innerHTML = "";

    athletes.forEach((athlete) => {
      const item = createAthleteItem(athlete, "available");
      container.appendChild(item);
    });
  }

  function displayAvailableAthletesPagination() {
    const container = document.getElementById("available-athletes-pagination");

    if (
      !availableAthletesPagination ||
      availableAthletesPagination.pages <= 1
    ) {
      container.style.display = "none";
      return;
    }

    container.style.display = "block";
    container.innerHTML = "";

    // Previous button
    if (availableAthletesPagination.has_prev) {
      const prevBtn = document.createElement("button");
      prevBtn.className = "btn btn-sm btn-secondary";
      prevBtn.textContent = "Previous";
      prevBtn.onclick = () => {
        availableAthletesPage = availableAthletesPagination.page - 1;
        loadFlightAthletes(currentFlightId);
      };
      container.appendChild(prevBtn);
    }

    // Page info
    const pageInfo = document.createElement("span");
    pageInfo.className = "pagination-info";
    pageInfo.textContent = `Page ${availableAthletesPagination.page} of ${availableAthletesPagination.pages}`;
    pageInfo.style.margin = "0 1rem";
    container.appendChild(pageInfo);

    // Next button
    if (availableAthletesPagination.has_next) {
      const nextBtn = document.createElement("button");
      nextBtn.className = "btn btn-sm btn-secondary";
      nextBtn.textContent = "Next";
      nextBtn.onclick = () => {
        availableAthletesPage = availableAthletesPagination.page + 1;
        loadFlightAthletes(currentFlightId);
      };
      container.appendChild(nextBtn);
    }
  }

  function displayFlightAthletes(athletes) {
    const container = document.getElementById("flight-athletes-list");
    container.innerHTML = "";

    athletes.forEach((athlete) => {
      const item = createAthleteItem(athlete, "flight");
      container.appendChild(item);
    });
  }

  function createAthleteItem(athlete, type) {
    const item = document.createElement("div");
    item.className = "athlete-item";
    item.dataset.athleteId = athlete.id;

    item.innerHTML = `
            <div class="athlete-info">
                <div class="athlete-name">${athlete.first_name} ${
      athlete.last_name
    }</div>
                <div class="athlete-details">
                    ${athlete.team || "No Team"} • ${
      athlete.bodyweight || "No Weight"
    }kg • ${athlete.gender || "Unknown"}
                </div>
            </div>
            <div class="athlete-actions">
                ${
                  type === "available"
                    ? `<button class="btn btn-sm btn-success add-to-flight" data-athlete-id="${athlete.id}">Add</button>`
                    : `<button class="btn btn-sm btn-danger remove-from-flight" data-athlete-id="${athlete.id}">Remove</button>`
                }
            </div>
        `;

    // Bind events
    const actionBtn = item.querySelector(".btn");
    if (type === "available") {
      actionBtn.addEventListener("click", () => addAthleteToFlight(athlete.id));
    } else {
      actionBtn.addEventListener("click", () =>
        removeAthleteFromFlight(athlete.id)
      );
    }

    return item;
  }

  async function addAthleteToFlight(athleteId) {
    try {
      const response = await fetch(
        `/admin/flights/${currentFlightId}/athletes/${athleteId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add athlete to flight");
      }

      showNotification("Athlete added to flight", "success");
      await loadFlightAthletes(currentFlightId);
    } catch (error) {
      console.error("Error adding athlete to flight:", error);
      showNotification(
        error.message || "Error adding athlete to flight",
        "error"
      );
    }
  }

  async function removeAthleteFromFlight(athleteId) {
    try {
      const response = await fetch(
        `/admin/flights/${currentFlightId}/athletes/${athleteId}`,
        {
          method: "DELETE",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Failed to remove athlete from flight"
        );
      }

      showNotification("Athlete removed from flight", "success");
      await loadFlightAthletes(currentFlightId);
    } catch (error) {
      console.error("Error removing athlete from flight:", error);
      showNotification(
        error.message || "Error removing athlete from flight",
        "error"
      );
    }
  }

  function initializeAttemptOrder(athletes) {
    const container = document.getElementById("attempt-order-list");
    container.innerHTML = "";

    athletes.forEach((athlete, index) => {
      const item = document.createElement("div");
      item.className = "attempt-item";
      item.dataset.athleteId = athlete.id;

      item.innerHTML = `
                <div class="attempt-number">${index + 1}</div>
                <div class="attempt-athlete">
                    <div class="attempt-athlete-name">${athlete.first_name} ${
        athlete.last_name
      }</div>
                    <div class="attempt-athlete-weight">${
                      athlete.bodyweight || "No Weight"
                    }kg • ${athlete.team || "No Team"}</div>
                </div>
                <div class="drag-handle">⋮⋮</div>
            `;

      container.appendChild(item);
    });

    // Initialize sortable for attempt order
    if (attemptsSortable) {
      attemptsSortable.destroy();
    }

    attemptsSortable = new Sortable(container, {
      animation: 150,
      handle: ".drag-handle",
      ghostClass: "sortable-ghost",
      onEnd: function (evt) {
        updateAttemptOrder();
      },
    });
  }

  function updateAttemptOrder() {
    const items = document.querySelectorAll(".attempt-item");
    items.forEach((item, index) => {
      item.querySelector(".attempt-number").textContent = index + 1;
    });
  }

  async function sortAttempts(sortType) {
    const container = document.getElementById("attempt-order-list");
    const items = Array.from(container.querySelectorAll(".attempt-item"));

    switch (sortType) {
      case "weight":
        items.sort((a, b) => {
          const weightA =
            parseFloat(
              a.querySelector(".attempt-athlete-weight").textContent
            ) || 0;
          const weightB =
            parseFloat(
              b.querySelector(".attempt-athlete-weight").textContent
            ) || 0;
          return weightA - weightB;
        });
        break;
      case "name":
        items.sort((a, b) => {
          const nameA = a.querySelector(".attempt-athlete-name").textContent;
          const nameB = b.querySelector(".attempt-athlete-name").textContent;
          return nameA.localeCompare(nameB);
        });
        break;
      case "random":
        for (let i = items.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [items[i], items[j]] = [items[j], items[i]];
        }
        break;
    }

    // Clear container and re-add sorted items
    container.innerHTML = "";
    items.forEach((item, index) => {
      item.querySelector(".attempt-number").textContent = index + 1;
      container.appendChild(item);
    });
  }

  function showEmptyState(message = "No Competition or Event Selected") {
    emptyState.querySelector("h3").textContent = message;
    emptyState.style.display = "block";
    flightsList.style.display = "none";
    flightAthletesSection.style.display = "none";
  }

  function closeModals() {
    flightModal.style.display = "none";
    deleteFlightModal.style.display = "none";
    currentFlightId = null;
    deleteFlightId = null;

    // If in athletes management, go back to flights list
    if (flightAthletesSection.style.display !== "none") {
      flightAthletesSection.style.display = "none";
      flightsList.style.display = "block";
    }
  }

  function showLoading(element) {
    element.classList.add("loading");
  }

  function hideLoading(element) {
    element.classList.remove("loading");
  }

  function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    Object.assign(notification.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      padding: "1rem 1.5rem",
      backgroundColor:
        type === "success"
          ? "#28a745"
          : type === "error"
          ? "#dc3545"
          : "#17a2b8",
      color: "white",
      borderRadius: "4px",
      zIndex: "9999",
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
      transition: "all 0.3s ease",
    });

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = "0";
      notification.style.transform = "translateX(100%)";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // Search functionality for available athletes
  let searchTimeout;
  document
    .getElementById("available-search")
    .addEventListener("input", function () {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        availableAthletesPage = 1; // Reset to first page on search
        if (currentFlightId) {
          loadFlightAthletes(currentFlightId);
        }
      }, 300); // Debounce search for 300ms
    });
});
