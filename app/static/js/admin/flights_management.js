// Flights Management JavaScript
class FlightManager {
  constructor() {
    this.searchTimeout;
    this.currentEventId = null;
    this.currentFlightId = null;
    this.deleteFlightId = null;
    this.flightsSortable = null;
    this.attemptsSortable = null;
    this.availableAthletesPage = 1;
    this.availableAthletesPagination = null;
    this.allFlights = []; // Store all flights for filtering
    this.filteredFlights = []; // Store filtered flights
    this.currentPage = 1;
    this.flightsPerPage = 12;
    
    // Data structures from localStorage/SSR
    this.competitions = []; // Store all competitions with their events
    this.events = []; // Store all events
    this.athletes = []; // Store all athletes with their allocations
    this.flights = []; // Store all flights
    
    // DOM elements
    this.competitionSelect = document.getElementById("competition-select");
    this.eventSelect = document.getElementById("event-select");
    this.flightsContainer = document.getElementById("flights-container");
    this.flightsList = document.getElementById("flights-list");
    this.flightsGrid = document.getElementById("flights-grid");
    this.emptyState = document.getElementById("empty-state");
    this.addFlightBtn = document.getElementById("add-flight-btn");
    this.flightModal = document.getElementById("flight-modal");
    this.flightForm = document.getElementById("flight-form");
    this.deleteFlightModal = document.getElementById("delete-flight-modal");
    this.flightAthletesSection = document.getElementById(
      "flight-athletes-section"
    );
    this.flightSearch = document.getElementById("flight-search");
    this.competitionFilter = document.getElementById("competition-filter");
    this.statusFilter = document.getElementById("status-filter");
    this.eventFilter = document.getElementById("event-filter");
    
    // Modal form elements
    this.flightCompetitionSelect = document.getElementById("flight_competition_id");
    this.flightEventSelect = document.getElementById("flight_event_id");
    
    this.init();
  }
  init() {
    this.bindEvents();
    this.initializeData();
    // Load all flights by default on page load
    this.showAllFlights();
  }

  initializeData() {
    try {
      // Load data from localStorage (set by SSR)
      this.competitions = JSON.parse(localStorage.getItem('competitions') || '[]');
      this.events = JSON.parse(localStorage.getItem('events') || '[]');
      this.athletes = JSON.parse(localStorage.getItem('athletes') || '[]');
      this.flights = JSON.parse(localStorage.getItem('flights') || '[]');
      
      console.log('Loaded data from localStorage:', {
        competitions: this.competitions.length,
        events: this.events.length,
        athletes: this.athletes.length,
        flights: this.flights.length
      });
      
      this.renderFlights();
    } catch (error) {
      console.error('Error loading data from localStorage:', error);
      // Fallback to API if localStorage fails
      this.loadAllData();
    }
  }

  async loadAllData() {
    console.log('Loading data from API as fallback...');
    try {
      // Load competitions with their events
      await this.loadCompetitionsWithEvents();
      // Load all athletes with their allocations
      await this.loadAllAthletes();
    } catch (error) {
      console.error("Error loading initial data:", error);
      this.showNotification("Error loading data", "error");
    }
  }

  // Data synchronization methods
  updateLocalStorage() {
    try {
      localStorage.setItem('competitions', JSON.stringify(this.competitions));
      localStorage.setItem('events', JSON.stringify(this.events));
      localStorage.setItem('athletes', JSON.stringify(this.athletes));
      localStorage.setItem('flights', JSON.stringify(this.flights));
      console.log('Updated localStorage with current data');
    } catch (error) {
      console.error('Error updating localStorage:', error);
    }
  }

  addFlight(flight) {
    this.flights.push(flight);
    this.updateLocalStorage();
    this.renderFlights();
  }

  updateFlight(updatedFlight) {
    const index = this.flights.findIndex(f => f.id === updatedFlight.id);
    if (index !== -1) {
      this.flights[index] = updatedFlight;
      this.updateLocalStorage();
      this.renderFlights();
    }
  }

  deleteFlight(flightId) {
    this.flights = this.flights.filter(f => f.id !== flightId);
    this.updateLocalStorage();
    this.renderFlights();
  }

  renderFlights() {
    // Use the local flights data instead of making API calls
    this.displayFlights(this.flights);
    
    // Populate dropdowns with current data
    this.populateCompetitionDropdowns();
    this.populateEventDropdowns();
  }

  async loadCompetitionsWithEvents() {
    try {
      // Load competitions
      const competitionsResponse = await fetch("/admin/competitions");
      if (!competitionsResponse.ok) throw new Error("Failed to load competitions");
      this.competitions = await competitionsResponse.json();
    console.log("Loaded competitions:", this.competitions);
      // Load events for each competition
      for (let competition of this.competitions) {
        try {
          const eventsResponse = await fetch(`/admin/competitions/${competition.id}/events`);
          if (eventsResponse.ok) {
            competition.events = await eventsResponse.json();
            this.allEvents.push(...competition.events.map(event => ({
              ...event,
              competition_id: competition.id,
              competition_name: competition.name
            })));
          } else {
            competition.events = [];
          }
        } catch (error) {
          console.warn(`Failed to load events for competition ${competition.id}:`, error);
          competition.events = [];
        }
      }

      // Populate dropdowns
      this.populateCompetitionDropdowns();
      this.populateEventDropdowns();

    } catch (error) {
      console.error("Error loading competitions with events:", error);
      this.showNotification("Error loading competitions and events", "error");
    }
  }

  async loadAllAthletes() {
    try {
      // For now, we'll load athletes when needed for specific competitions
      // This method can be expanded to load all athletes upfront if needed
      this.allAthletes = [];
    } catch (error) {
      console.error("Error loading athletes:", error);
      this.showNotification("Error loading athletes", "error");
    }
  }

  populateCompetitionDropdowns() {
    // Populate main competition select
    this.competitionSelect.innerHTML = '<option value="">Select Competition</option>';
    this.competitions.forEach((competition) => {
      const option = document.createElement("option");
      option.value = competition.id;
      option.textContent = competition.name;
      this.competitionSelect.appendChild(option);
    });

    // Populate modal competition select
    if (this.flightCompetitionSelect) {
      this.flightCompetitionSelect.innerHTML = '<option value="">Select Competition</option>';
      this.competitions.forEach((competition) => {
        const option = document.createElement("option");
        option.value = competition.id;
        option.textContent = competition.name;
        this.flightCompetitionSelect.appendChild(option);
      });
    }
  }

  populateEventDropdowns() {
    // Populate main event select (all events)
    this.eventSelect.innerHTML = '<option value="">Select Event</option>';
    this.events.forEach((event) => {
      const option = document.createElement("option");
      option.value = event.id;
      option.textContent = `${event.name} (${event.competition_name})`;
      this.eventSelect.appendChild(option);
    });
  }

  handleModalCompetitionChange() {
    const competitionId = parseInt(this.flightCompetitionSelect.value);
    
    // Reset event dropdown
    this.flightEventSelect.innerHTML = '<option value="">Select Event (Optional)</option>';
    
    if (!competitionId) return;

    // Find the selected competition and populate its events
    const selectedCompetition = this.competitions.find(c => c.id === competitionId);
    if (selectedCompetition && selectedCompetition.events) {
      selectedCompetition.events.forEach((event) => {
        const option = document.createElement("option");
        option.value = event.id;
        option.textContent = event.name;
        this.flightEventSelect.appendChild(option);
      });
    }
  }
  bindEvents() {
    // Competition and event selection
    this.competitionSelect.addEventListener("change", () =>
      this.handleCompetitionChange()
    );
    this.eventSelect.addEventListener("change", () => this.handleEventChange());

    // Add flight button
    this.addFlightBtn.addEventListener("click", () =>
      this.showAddFlightModal()
    );

    // Search and filters
    if (this.flightSearch) {
      this.flightSearch.addEventListener(
        "input",
        this.debounce(() => this.applyFlightFilters(), 300)
      );
    }
    if (this.competitionFilter) {
      this.competitionFilter.addEventListener("change", () =>
        this.applyFlightFilters()
      );
    }
    if (this.statusFilter) {
      this.statusFilter.addEventListener("change", () =>
        this.applyFlightFilters()
      );
    }
    if (this.eventFilter) {
      this.eventFilter.addEventListener("change", () =>
        this.applyFlightFilters()
      );
    }

    // Modal form elements
    if (this.flightCompetitionSelect) {
      this.flightCompetitionSelect.addEventListener("change", () =>
        this.handleModalCompetitionChange()
      );
    }

    // Modal close buttons
    document.querySelectorAll(".close").forEach((closeBtn) => {
      closeBtn.addEventListener("click", () => this.closeModals());
    });

    // Cancel buttons
    const cancelFlightBtn = document.getElementById("cancel-flight-btn");
    const cancelDeleteFlightBtn = document.getElementById(
      "cancel-delete-flight-btn"
    );

    if (cancelFlightBtn) {
      cancelFlightBtn.addEventListener("click", () => this.closeModals());
    }
    if (cancelDeleteFlightBtn) {
      cancelDeleteFlightBtn.addEventListener("click", () => this.closeModals());
    }

    // Form submission
    if (this.flightForm) {
      this.flightForm.addEventListener("submit", (e) =>
        this.handleFlightFormSubmit(e)
      );
    }

    // Available athletes search
    const availableSearch = document.getElementById("available-search");
    if (availableSearch) {
      availableSearch.addEventListener("input", (e) =>
        this.handleAvailableAthletesSearch(e)
      );
    }

    // Delete confirmation
    const confirmDeleteBtn = document.getElementById(
      "confirm-delete-flight-btn"
    );
    if (confirmDeleteBtn) {
      confirmDeleteBtn.addEventListener("click", () =>
        this.confirmDeleteFlight()
      );
    }

    // Attempt order controls
    const sortByWeightBtn = document.getElementById("sort-by-weight");
    const sortByNameBtn = document.getElementById("sort-by-name");
    const randomizeOrderBtn = document.getElementById("randomize-order");

    if (sortByWeightBtn) {
      sortByWeightBtn.addEventListener("click", () =>
        this.sortAttempts("weight")
      );
    }
    if (sortByNameBtn) {
      sortByNameBtn.addEventListener("click", () => this.sortAttempts("name"));
    }
    if (randomizeOrderBtn) {
      randomizeOrderBtn.addEventListener("click", () =>
        this.sortAttempts("random")
      );
    }

    // Click outside modal to close
    window.addEventListener("click", (event) => {
      if (
        event.target === this.flightModal ||
        event.target === this.deleteFlightModal
      ) {
        this.closeModals();
      }
    });
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  async handleCompetitionChange() {
    const competitionId = this.competitionSelect.value;

    // Reset event select
    this.eventSelect.innerHTML = '<option value="">Select Event</option>';
    this.eventSelect.disabled = !competitionId;

    // Hide flights
    this.showEmptyState();

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
        this.eventSelect.appendChild(option);
      });

      this.eventSelect.disabled = false;
    } catch (error) {
      console.error("Error loading events:", error);
      this.showNotification("Error loading events", "error");
    }
  }
  async handleEventChange() {
    const eventId = this.eventSelect.value;
    this.currentEventId = eventId;

    if (!eventId) {
      this.showEmptyState();
      return;
    }

    this.loadFlights(eventId);
  }
  loadFlights(eventId) {
    try {
      if (!eventId) {
        this.showEmptyState("Please select an event to view flights");
        return;
      }

      this.showLoading(this.flightsContainer);

      // Filter local flights data by event
      const flights = this.flights.filter(flight => flight.event_id == eventId);

      if (flights.length === 0) {
        this.showEmptyState("No flights found for this event");
      } else {
        this.displayFlights(flights);
      }
    } catch (error) {
      console.error("Error loading flights:", error);
      this.showNotification("Error loading flights", "error");
      this.showEmptyState();
    } finally {
      this.hideLoading(this.flightsContainer);
    }
  }

  showAllFlights() {
    try {
      this.showLoading(this.flightsContainer);
      
      // Use local flights data instead of API call
      const flights = this.flights;

      if (flights.length === 0) {
        this.showEmptyState("No flights found");
      } else {
        this.displayFlights(flights);
        // Clear event selection since we're showing all flights
        this.currentEventId = null;
        this.eventSelect.value = "";
        this.competitionSelect.value = "";
      }
    } catch (error) {
      console.error("Error loading all flights:", error);
      this.showNotification("Error loading all flights", "error");
      this.showEmptyState();
    } finally {
      this.hideLoading(this.flightsContainer);
    }
  }

  displayFlights(flights) {
    this.emptyState.style.display = "none";
    this.flightsList.style.display = "block";
    this.flightAthletesSection.style.display = "none";

    // Store all flights for filtering
    this.allFlights = flights;

    // Populate event filter when showing all flights
    if (flights.length > 0 && flights[0].event_name) {
      this.populateEventFilter(flights);
    }

    // Apply filters and pagination
    this.applyFlightFilters();
  }

  populateEventFilter(flights) {
    if (!this.eventFilter) return;

    const uniqueEvents = [
      ...new Set(flights.map((f) => f.event_name).filter(Boolean)),
    ];
    this.eventFilter.innerHTML = '<option value="">All Events</option>';

    uniqueEvents.forEach((eventName) => {
      const option = document.createElement("option");
      option.value = eventName;
      option.textContent = eventName;
      this.eventFilter.appendChild(option);
    });
  }

  applyFlightFilters() {
    if (!this.allFlights.length) return;

    const searchTerm = this.flightSearch
      ? this.flightSearch.value.toLowerCase()
      : "";
    const competitionValue = this.competitionFilter
      ? this.competitionFilter.value
      : "";
    const statusValue = this.statusFilter ? this.statusFilter.value : "";
    const eventValue = this.eventFilter ? this.eventFilter.value : "";

    this.filteredFlights = this.allFlights.filter((flight) => {
      const matchesSearch =
        !searchTerm ||
        flight.name.toLowerCase().includes(searchTerm) ||
        (flight.event_name &&
          flight.event_name.toLowerCase().includes(searchTerm)) ||
        (flight.competition_name &&
          flight.competition_name.toLowerCase().includes(searchTerm));

      const matchesCompetition =
        !competitionValue || flight.competition_name === competitionValue;

      const matchesStatus =
        !statusValue ||
        (statusValue === "active" && flight.is_active) ||
        (statusValue === "inactive" && !flight.is_active);

      const matchesEvent = !eventValue || flight.event_name === eventValue;

      return (
        matchesSearch && matchesCompetition && matchesStatus && matchesEvent
      );
    });

    // Reset to first page when filters change
    this.currentPage = 1;
    this.renderFlightCards();
  }

  renderFlightCards() {
    // Sort flights by order
    this.filteredFlights.sort((a, b) => a.order - b.order);

    const startIndex = (this.currentPage - 1) * this.flightsPerPage;
    const endIndex = startIndex + this.flightsPerPage;
    const pageFlights = this.filteredFlights.slice(startIndex, endIndex);

    this.flightsGrid.innerHTML = "";

    pageFlights.forEach((flight) => {
      const flightCard = this.createFlightCard(flight);
      this.flightsGrid.appendChild(flightCard);
    });

    // Update pagination
    this.updateFlightPagination();

    // Initialize sortable
    this.initializeFlightsSortable();
  }

  updateFlightPagination() {
    const paginationContainer = document.getElementById("flights-pagination");
    const paginationInfo = document.getElementById("flights-pagination-info");
    const paginationControls = document.getElementById(
      "flights-pagination-controls"
    );

    if (!paginationContainer || !paginationInfo || !paginationControls) return;

    const totalFlights = this.filteredFlights.length;
    const totalPages = Math.ceil(totalFlights / this.flightsPerPage);

    if (totalFlights === 0) {
      paginationContainer.style.display = "none";
      return;
    }

    paginationContainer.style.display = totalPages > 1 ? "flex" : "none";

    const startIndex = (this.currentPage - 1) * this.flightsPerPage + 1;
    const endIndex = Math.min(
      this.currentPage * this.flightsPerPage,
      totalFlights
    );

    paginationInfo.textContent = `Showing ${startIndex} to ${endIndex} of ${totalFlights} flights`;

    // Generate pagination controls
    paginationControls.innerHTML = "";

    if (totalPages > 1) {
      // Previous button
      if (this.currentPage > 1) {
        const prevBtn = document.createElement("button");
        prevBtn.className = "page-link";
        prevBtn.textContent = "Previous";
        prevBtn.addEventListener("click", () => {
          this.currentPage--;
          this.renderFlightCards();
        });
        paginationControls.appendChild(prevBtn);
      }

      // Page numbers
      for (let i = 1; i <= totalPages; i++) {
        if (
          i === 1 ||
          i === totalPages ||
          (i >= this.currentPage - 2 && i <= this.currentPage + 2)
        ) {
          const pageBtn = document.createElement("button");
          pageBtn.className = `page-link ${
            i === this.currentPage ? "active" : ""
          }`;
          pageBtn.textContent = i;
          pageBtn.addEventListener("click", () => {
            this.currentPage = i;
            this.renderFlightCards();
          });
          paginationControls.appendChild(pageBtn);
        } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
          const ellipsis = document.createElement("span");
          ellipsis.className = "page-ellipsis";
          ellipsis.textContent = "...";
          paginationControls.appendChild(ellipsis);
        }
      }

      // Next button
      if (this.currentPage < totalPages) {
        const nextBtn = document.createElement("button");
        nextBtn.className = "page-link";
        nextBtn.textContent = "Next";
        nextBtn.addEventListener("click", () => {
          this.currentPage++;
          this.renderFlightCards();
        });
        paginationControls.appendChild(nextBtn);
      }
    }
  }

  createFlightCard(flight) {
    const card = document.createElement("div");
    card.className = `flight-card ${flight.is_active ? "active" : ""}`;
    card.dataset.flightId = flight.id;
    card.dataset.flightOrder = flight.order;

    // Add event info if available (when showing all flights)
    const eventInfo = flight.event_name
      ? `
        <div class="flight-event-info">
            <small>${flight.competition_name} - ${flight.event_name}</small>
        </div>
    `
      : "";

    card.innerHTML = `
            <div class="flight-card-header">
                <div class="flight-name">${flight.name}</div>
                <div class="flight-order">Order: ${flight.order}</div>
            </div>
            ${eventInfo}
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
      .addEventListener("click", (e) => this.handleEditFlight(e));
    card
      .querySelector(".manage-athletes")
      .addEventListener("click", (e) => this.handleManageAthletes(e));
    card
      .querySelector(".delete-flight")
      .addEventListener("click", (e) => this.handleDeleteFlight(e));

    return card;
  }

  initializeFlightsSortable() {
    if (this.flightsSortable) {
      this.flightsSortable.destroy();
    }

    this.flightsSortable = new Sortable(this.flightsGrid, {
      animation: 150,
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      onEnd: function (evt) {
        this.updateFlightOrder();
      },
    });
  }

  async updateFlightOrder() {
    const flightCards = this.flightsGrid.querySelectorAll(".flight-card");
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

      this.showNotification("Flight order updated successfully", "success");
    } catch (error) {
      console.error("Error updating flight order:", error);
      this.showNotification("Error updating flight order", "error");
      // Reload flights to reset order
      this.loadFlights(this.currentEventId);
    }
  }

  async showAddFlightModal() {
    this.currentFlightId = null;
    document.getElementById("flight-modal-title").textContent = "Add New Flight";
    document.getElementById("save-flight-btn").textContent = "Save Flight";
    this.flightForm.reset();

    // Ensure dropdowns are populated
    this.populateCompetitionDropdowns();

    // Set default order
    const flightCards = this.flightsGrid.querySelectorAll(".flight-card");
    document.getElementById("flight_order").value = flightCards.length + 1;

    // Pre-select current competition and event if available
    if (this.currentEventId) {
      // Find the event and its competition
      const currentEvent = this.allEvents.find(e => e.id === this.currentEventId);
      if (currentEvent) {
        document.getElementById("flight_competition_id").value = currentEvent.competition_id;
        this.handleModalCompetitionChange(); // This will populate the event dropdown
        document.getElementById("flight_event_id").value = this.currentEventId;
      }
    }

    // Set default active state
    document.getElementById("flight_is_active").checked = true;

    this.flightModal.style.display = "block";
    document.getElementById("flight_name").focus();
  }

  async handleEditFlight(event) {
    const flightId = event.target.closest("button").dataset.flightId;
    this.currentFlightId = flightId;

    document.getElementById("flight-modal-title").textContent = "Edit Flight";
    document.getElementById("save-flight-btn").textContent = "Update Flight";

    // Ensure dropdowns are populated
    this.populateCompetitionDropdowns();

    // Load flight data
    this.loadFlightData(flightId);

    this.flightModal.style.display = "block";
  }

  async loadFlightData(flightId) {
    try {
      this.showLoading(this.flightForm);
      const response = await fetch(`/admin/flights/${flightId}`);

      if (!response.ok) throw new Error("Failed to load flight data");

      const flight = await response.json();

      document.getElementById("flight_name").value = flight.name;
      document.getElementById("flight_order").value = flight.order;
      document.getElementById("flight_is_active").checked = flight.is_active;

      // Set competition and event if available
      if (flight.event_id) {
        const event = this.allEvents.find(e => e.id === flight.event_id);
        if (event) {
          document.getElementById("flight_competition_id").value = event.competition_id;
          this.handleModalCompetitionChange(); // Populate event dropdown
          document.getElementById("flight_event_id").value = flight.event_id;
        }
      }
    } catch (error) {
      console.error("Error loading flight data:", error);
      this.showNotification("Error loading flight data", "error");
    } finally {
      this.hideLoading(this.flightForm);
    }
  }

  async handleFlightFormSubmit(event) {
    event.preventDefault();

    const formData = new FormData(this.flightForm);
    const competitionId = formData.get("competition_id");
    const eventId = formData.get("event_id") || this.currentEventId;

    // Validate required fields
    if (!formData.get("flight_name").trim()) {
      this.showNotification("Flight name is required", "error");
      return;
    }

    if (!competitionId) {
      this.showNotification("Please select a competition", "error");
      return;
    }

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
      this.showLoading(this.flightForm);

      const url = this.currentFlightId
        ? `/admin/flights/${this.currentFlightId}`
        : "/admin/flights";

      const method = this.currentFlightId ? "PUT" : "POST";

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
      this.showNotification(result.message, "success");

      // Update local data structure
      if (this.currentFlightId) {
        // Update existing flight
        this.updateFlight(result.flight);
      } else {
        // Add new flight
        this.addFlight(result.flight);
      }

      // Store current state before closing modal
      const wasUpdating = this.currentFlightId !== null;
      this.closeModals();
    } catch (error) {
      console.error("Error saving flight:", error);
      this.showNotification(error.message, "error");
    } finally {
      this.hideLoading(this.flightForm);
    }
  }

  handleDeleteFlight(event) {
    this.deleteFlightId = event.target.closest("button").dataset.flightId;
    const card = event.target.closest(".flight-card");
    const flightName = card.querySelector(".flight-name").textContent;

    document.getElementById("delete-flight-name").textContent = flightName;
    this.deleteFlightModal.style.display = "block";
  }

  async confirmDeleteFlight() {
    if (!this.deleteFlightId) return;

    try {
      this.showLoading(this.deleteFlightModal);

      const response = await fetch(`/admin/flights/${this.deleteFlightId}`, {
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
      this.showNotification(result.message, "success");
      this.closeModals();

      // Update local data structure
      this.deleteFlight(parseInt(this.deleteFlightId));
    } catch (error) {
      console.error("Error deleting flight:", error);
      this.showNotification(error.message, "error");
    } finally {
      this.hideLoading(this.deleteFlightModal);
      this.deleteFlightId = null;
    }
  }

  async handleManageAthletes(event) {
    const flightId = event.target.closest("button").dataset.flightId;
    this.currentFlightId = flightId;

    const card = event.target.closest(".flight-card");
    const flightName = card.querySelector(".flight-name").textContent;
    const flightOrder = card.dataset.flightOrder;

    document.getElementById("current-flight-name").textContent = flightName;
    document.getElementById(
      "current-flight-order"
    ).textContent = `Order: ${flightOrder}`;

    // Load flight athletes
    await this.loadFlightAthletes(flightId);

    // Show athletes section
    this.flightsList.style.display = "none";
    this.flightAthletesSection.style.display = "block";
  }

  async loadFlightAthletes(flightId) {
    try {
      this.showLoading(this.flightAthletesSection);

      // Load flight athletes data
      const flightResponse = await fetch(`/admin/flights/${flightId}/athletes`);
      if (!flightResponse.ok) throw new Error("Failed to load flight athletes");
      const flightData = await flightResponse.json();

      // Load available athletes for this specific flight
      const searchTerm = document.getElementById("available-search")?.value || "";
      const availableResponse = await fetch(
        `/admin/flights/${flightId}/available-athletes?page=${
          this.availableAthletesPage
        }&search=${encodeURIComponent(searchTerm)}`
      );
      
      let availableAthletes = [];
      let availablePagination = null;
      
      if (availableResponse.ok) {
        const availableData = await availableResponse.json();
        availableAthletes = availableData.athletes || [];
        availablePagination = availableData.pagination || null;
      } else {
        console.warn("Failed to load available athletes, showing empty list");
      }

      this.availableAthletesPagination = availablePagination;

      // Update flight info display
      if (flightData.flight) {
        document.getElementById("current-flight-name").textContent = flightData.flight.name;
        document.getElementById("current-flight-order").textContent = `Order: ${
          flightData.flight.order || "Unknown"
        }`;

        // Show event and competition info if available
        const flightInfo = document.getElementById("current-flight-info");
        if (flightInfo) {
          if (flightData.flight.event_name) {
            flightInfo.textContent = `${flightData.flight.competition_name || 'Unknown Competition'} - ${flightData.flight.event_name}`;
            flightInfo.style.display = "block";
            flightInfo.style.color = "#6c757d";
          } else {
            flightInfo.textContent = "No event assigned to this flight";
            flightInfo.style.display = "block";
            flightInfo.style.color = "#dc3545"; // Red color for warning
          }
        }
      }

      this.displayAvailableAthletes(availableAthletes);
      this.displayAvailableAthletesPagination();
      this.displayFlightAthletes(flightData.athletes || []);
      this.initializeAttemptOrder(flightData.athletes || []);
      
    } catch (error) {
      console.error("Error loading flight athletes:", error);
      this.showNotification(`Error loading athletes: ${error.message}`, "error");
    } finally {
      this.hideLoading(this.flightAthletesSection);
    }
  }

  displayAvailableAthletes(athletes) {
    const container = document.getElementById("available-athletes-list");
    container.innerHTML = "";

    athletes.forEach((athlete) => {
      const item = this.createAthleteItem(athlete, "available");
      container.appendChild(item);
    });
  }

  displayAvailableAthletesPagination() {
    const container = document.getElementById("available-athletes-pagination");

    if (
      !this.availableAthletesPagination ||
      this.availableAthletesPagination.pages <= 1
    ) {
      container.style.display = "none";
      return;
    }

    container.style.display = "block";
    container.innerHTML = "";

    // Previous button
    if (this.availableAthletesPagination.has_prev) {
      const prevBtn = document.createElement("button");
      prevBtn.className = "btn btn-sm btn-secondary";
      prevBtn.textContent = "Previous";
      prevBtn.onclick = () => {
        this.availableAthletesPage = this.availableAthletesPagination.page - 1;
        this.loadFlightAthletes(this.currentFlightId);
      };
      container.appendChild(prevBtn);
    }

    // Page info
    const pageInfo = document.createElement("span");
    pageInfo.className = "pagination-info";
    pageInfo.textContent = `Page ${this.availableAthletesPagination.page} of ${this.availableAthletesPagination.pages}`;
    pageInfo.style.margin = "0 1rem";
    container.appendChild(pageInfo);

    // Next button
    if (this.availableAthletesPagination.has_next) {
      const nextBtn = document.createElement("button");
      nextBtn.className = "btn btn-sm btn-secondary";
      nextBtn.textContent = "Next";
      nextBtn.onclick = () => {
        this.availableAthletesPage = this.availableAthletesPagination.page + 1;
        this.loadFlightAthletes(this.currentFlightId);
      };
      container.appendChild(nextBtn);
    }
  }

  displayFlightAthletes(athletes) {
    const container = document.getElementById("flight-athletes-list");
    container.innerHTML = "";

    athletes.forEach((athlete) => {
      const item = this.createAthleteItem(athlete, "flight");
      container.appendChild(item);
    });
  }

  createAthleteItem(athlete, type) {
    const item = document.createElement("div");
    item.className = "athlete-item";
    item.dataset.athleteId = athlete.id;

    const competitionInfo = athlete.competition_name
      ? `<div class="athlete-competition">${athlete.competition_name}</div>`
      : "";

    const emailInfo = athlete.email
      ? `<div class="athlete-email">${athlete.email}</div>`
      : "";

    item.innerHTML = `
            <div class="athlete-info">
                <div class="athlete-name">${athlete.first_name} ${
      athlete.last_name
    }</div>
                ${emailInfo}
                <div class="athlete-details">
                    ${athlete.team || "No Team"} • ${
      athlete.bodyweight || "No Weight"
    }kg • ${athlete.gender || "Unknown"}${
      athlete.age ? ` • Age ${athlete.age}` : ""
    }
                </div>
                ${competitionInfo}
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
      actionBtn.addEventListener("click", () => this.addAthleteToFlight(athlete.id));
    } else {
      actionBtn.addEventListener("click", () =>
        this.removeAthleteFromFlight(athlete.id)
      );
    }

    return item;
  }

  handleAvailableAthletesSearch() {
    // Reset to first page when searching
    this.availableAthletesPage = 1;
    // Reload athletes with new search term
    if (this.currentFlightId) {
      this.loadFlightAthletes(this.currentFlightId);
    }
  }

  async addAthleteToFlight(athleteId) {
    try {
      const response = await fetch(
        `/admin/flights/${this.currentFlightId}/athletes/${athleteId}`,
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

      this.showNotification("Athlete added to flight", "success");
      await this.loadFlightAthletes(this.currentFlightId);
    } catch (error) {
      console.error("Error adding athlete to flight:", error);
      this.showNotification(
        error.message || "Error adding athlete to flight",
        "error"
      );
    }
  }

  async removeAthleteFromFlight(athleteId) {
    try {
      const response = await fetch(
        `/admin/flights/${this.currentFlightId}/athletes/${athleteId}`,
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

      this.showNotification("Athlete removed from flight", "success");
      await this.loadFlightAthletes(this.currentFlightId);
    } catch (error) {
      console.error("Error removing athlete from flight:", error);
      this.showNotification(
        error.message || "Error removing athlete from flight",
        "error"
      );
    }
  }

  initializeAttemptOrder(athletes) {
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
    if (this.attemptsSortable) {
      this.attemptsSortable.destroy();
    }

    this.attemptsSortable = new Sortable(container, {
      animation: 150,
      handle: ".drag-handle",
      ghostClass: "sortable-ghost",
      onEnd: function (evt) {
        this.updateAttemptOrder();
      },
    });
  }

  updateAttemptOrder() {
    const items = document.querySelectorAll(".attempt-item");
    items.forEach((item, index) => {
      item.querySelector(".attempt-number").textContent = index + 1;
    });
  }

  async sortAttempts(sortType) {
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

  showEmptyState(message = "No Competition or Event Selected") {
    this.emptyState.querySelector("h3").textContent = message;
    this.emptyState.style.display = "block";
    this.flightsList.style.display = "none";
    this.flightAthletesSection.style.display = "none";
  }

  closeModals() {
    this.flightModal.style.display = "none";
    this.deleteFlightModal.style.display = "none";
    this.currentFlightId = null;
    this.deleteFlightId = null;

    // If in athletes management, go back to flights list
    if (this.flightAthletesSection.style.display !== "none") {
      this.flightAthletesSection.style.display = "none";
      this.flightsList.style.display = "block";
    }
  }

  showLoading(element) {
    element.classList.add("loading");
  }

  hideLoading(element) {
    element.classList.remove("loading");
  }

  showNotification(message, type = "info") {
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
  initSearchDebounce() {
    document
      .getElementById("available-search")
      .addEventListener("input", function () {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          this.availableAthletesPage = 1; // Reset to first page on search
          if (this.currentFlightId) {
            this.loadFlightAthletes(this.currentFlightId);
          }
        }, 300); // Debounce search for 300ms
      });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  new FlightManager();
  // Search functionality for available athletes
});
