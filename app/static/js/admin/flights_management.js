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
    this.allAttempts = []; // Store all attempts for filtering
    this.currentEditingAttemptId = null; // For editing attempts
    
    // Data structures - no localStorage, just in-memory
    this.competitions = [];
    this.events = [];
    this.athletes = [];
    this.flights = [];
    this.allEvents = [];
    
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
      // Load data from SSR window object
      if (window.flightManagementData) {
        this.competitions = window.flightManagementData.competitions || [];
        this.events = window.flightManagementData.events || [];
        this.athletes = window.flightManagementData.athletes || [];
        this.flights = window.flightManagementData.flights || [];
        
        // Populate allEvents array from loaded data
        this.allEvents = [];
        this.events.forEach(event => {
          const competition = this.competitions.find(c => c.id === event.competition_id);
          this.allEvents.push({
            ...event,
            competition_name: competition ? competition.name : 'Unknown Competition'
          });
        });
        
        console.log('Loaded data from SSR:', {
          competitions: this.competitions.length,
          events: this.events.length,
          athletes: this.athletes.length,
          flights: this.flights.length,
          allEvents: this.allEvents.length
        });
        
        this.renderFlights();
      } else {
        console.log('No SSR data found, loading from API...');
        this.loadAllData();
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
      this.loadAllData();
    }
  }

  async loadAllData() {
    console.log('Loading fresh data from API...');
    try {
      // Refresh the page to get latest data from SSR
      window.location.reload();
    } catch (error) {
      console.error("Error loading initial data:", error);
      this.showNotification("Error loading data", "error");
    }
  }

  async refreshAllData() {
    console.log('Refreshing all data...');
    // Simply reload the page to get fresh SSR data
    window.location.reload();
  }

  renderFlights() {
    // Use the loaded flights data
    this.displayFlights(this.flights);
    
    // Populate dropdowns with current data
    this.populateCompetitionDropdowns();
    this.populateEventDropdowns();
  }

  async loadCompetitionsWithEvents() {
    try {
      // Initialize allEvents array
      this.allEvents = [];
      
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

  // Function to get unallocated athletes for a specific competition
  getUnallocatedAthletes(competitionId = null) {
    // Get all athletes in flights to identify allocated ones
    const allocatedAthleteIds = new Set();
    
    this.flights.forEach(flight => {
      if (flight.athletes && Array.isArray(flight.athletes)) {
        flight.athletes.forEach(athlete => {
          allocatedAthleteIds.add(athlete.id);
        });
      }
    });
    
    // Filter athletes to get unallocated ones
    let unallocatedAthletes = this.athletes.filter(athlete => {
      const isNotAllocated = !allocatedAthleteIds.has(athlete.id);
      
      // If competition filter is specified, also filter by competition
      if (competitionId) {
        return isNotAllocated && athlete.competition_id === competitionId;
      }
      
      return isNotAllocated;
    });
    
    console.log(`Found ${unallocatedAthletes.length} unallocated athletes${competitionId ? ` for competition ${competitionId}` : ''}`);
    return unallocatedAthletes;
  }

  // Function to ensure competition and event information is available
  enrichFlightData(flight) {
    // Create a copy to avoid mutating the original
    const enrichedFlight = { ...flight };
    
    if (!enrichedFlight.competition_name && enrichedFlight.competition_id) {
      const competition = this.competitions.find(c => c.id === enrichedFlight.competition_id);
      if (competition) {
        enrichedFlight.competition_name = competition.name;
      }
    }
    
    if (!enrichedFlight.event_name && enrichedFlight.event_id) {
      // Try this.events first
      let event = this.events.find(e => e.id === enrichedFlight.event_id);
      
      // If not found, try this.allEvents
      if (!event && this.allEvents) {
        event = this.allEvents.find(e => e.id === enrichedFlight.event_id);
      }
      
      // If still not found, try nested events in competitions
      if (!event && this.competitions) {
        for (const comp of this.competitions) {
          if (comp.events) {
            event = comp.events.find(e => e.id === enrichedFlight.event_id);
            if (event) {
              // Add competition info to the event
              event.competition_id = comp.id;
              event.competition_name = comp.name;
              break;
            }
          }
        }
      }
      
      if (event) {
        enrichedFlight.event_name = event.name;
        // Also ensure competition info from event
        if (!enrichedFlight.competition_id && event.competition_id) {
          enrichedFlight.competition_id = event.competition_id;
        }
        if (!enrichedFlight.competition_name && event.competition_name) {
          enrichedFlight.competition_name = event.competition_name;
        }
      }
    }
    
    return enrichedFlight;
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
    
    // Movement filter
    const movementFilter = document.getElementById("movement-filter");
    if (movementFilter) {
      movementFilter.addEventListener("change", () =>
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
    const generateTestAttemptsBtn = document.getElementById("generate-test-attempts");
    const refreshAttemptsBtn = document.getElementById("refresh-attempts");
    const markFirstCompletedBtn = document.getElementById("mark-first-completed");
    const addNewAttemptBtn = document.getElementById("add-new-attempt");
    const athleteNameFilter = document.getElementById("athlete-name-filter");
    const statusFilter = document.getElementById("attempt-status-filter");
    const clearFiltersBtn = document.getElementById("clear-filters");

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
    if (generateTestAttemptsBtn) {
      generateTestAttemptsBtn.addEventListener("click", () =>
        this.generateTestAttempts()
      );
    }
    if (refreshAttemptsBtn) {
      refreshAttemptsBtn.addEventListener("click", () =>
        this.loadFlightAttemptOrder()
      );
    }
    if (markFirstCompletedBtn) {
      markFirstCompletedBtn.addEventListener("click", () =>
        this.markFirstAttemptCompleted()
      );
    }
    if (addNewAttemptBtn) {
      addNewAttemptBtn.addEventListener("click", () =>
        this.showAddAttemptModal()
      );
    }
    if (athleteNameFilter) {
      athleteNameFilter.addEventListener("input", () => this.applyFiltersAndRedisplay());
    }
    if (statusFilter) {
      statusFilter.addEventListener("change", () => this.applyFiltersAndRedisplay());
    }
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener("click", () => this.clearFilters());
    }

    // Attempt modal event listeners
    const saveAttemptBtn = document.getElementById("save-attempt-btn");
    const cancelAttemptBtn = document.getElementById("cancel-attempt-btn");
    
    if (saveAttemptBtn) {
      saveAttemptBtn.addEventListener("click", () => this.saveAttempt());
    }
    if (cancelAttemptBtn) {
      cancelAttemptBtn.addEventListener("click", () => this.closeModals());
    }

    // Click outside modal to close
    window.addEventListener("click", (event) => {
      if (
        event.target === this.flightModal ||
        event.target === this.deleteFlightModal ||
        event.target === document.getElementById("attempt-modal")
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

    // Populate filter dropdowns when showing all flights
    this.populateEventFilter(flights);
    this.populateCompetitionFilter(flights);

    // Apply filters and pagination
    this.applyFlightFilters();
  }

  populateCompetitionFilter(flights) {
    if (!this.competitionFilter) return;

    // Get unique competition names from flights
    const uniqueCompetitions = [
      ...new Set(flights.map((f) => f.competition_name).filter(Boolean)),
    ];
    
    // Save the current value
    const currentValue = this.competitionFilter.value;
    
    // Clear and rebuild options
    this.competitionFilter.innerHTML = '<option value="">All Competitions</option>';

    uniqueCompetitions.forEach((competitionName) => {
      const option = document.createElement("option");
      option.value = competitionName;
      option.textContent = competitionName;
      this.competitionFilter.appendChild(option);
    });
    
    // Restore the current value if it still exists
    if (currentValue && uniqueCompetitions.includes(currentValue)) {
      this.competitionFilter.value = currentValue;
    }
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
    const movementValue = document.getElementById("movement-filter") 
      ? document.getElementById("movement-filter").value 
      : "";

    this.filteredFlights = this.allFlights.filter((flight) => {
      const matchesSearch =
        !searchTerm ||
        flight.name.toLowerCase().includes(searchTerm) ||
        (flight.event_name &&
          flight.event_name.toLowerCase().includes(searchTerm)) ||
        (flight.competition_name &&
          flight.competition_name.toLowerCase().includes(searchTerm)) ||
        (flight.movement_type &&
          flight.movement_type.toLowerCase().includes(searchTerm));

      const matchesCompetition =
        !competitionValue || flight.competition_name === competitionValue;

      const matchesStatus =
        !statusValue ||
        (statusValue === "active" && flight.is_active) ||
        (statusValue === "inactive" && !flight.is_active);

      const matchesEvent = !eventValue || flight.event_name === eventValue;
      
      const matchesMovement = !movementValue || flight.movement_type === movementValue;

      return (
        matchesSearch && matchesCompetition && matchesStatus && matchesEvent && matchesMovement
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
    // Enrich flight data to ensure competition and event info is available
    flight = this.enrichFlightData(flight);
    
    const card = document.createElement("div");
    card.className = `flight-card ${flight.is_active ? "active" : ""}`;
    card.dataset.flightId = flight.id;
    card.dataset.flightOrder = flight.order;
    card.dataset.competitionId = flight.competition_id || '';
    card.dataset.eventId = flight.event_id || '';

    // Build competition and event info display with fallbacks
    let competitionInfo = flight.competition_name || 'No Competition';
    let eventInfo = flight.event_name || 'No Event';
    
    // If we still don't have competition info, try to get it from hierarchical data
    if (!flight.competition_name && flight.competition_id) {
      const competition = this.competitions.find(c => c.id === flight.competition_id);
      if (competition) {
        competitionInfo = competition.name;
      }
    }
    
    // If we still don't have event info, try to get it from flat events data
    if (!flight.event_name && flight.event_id) {
      const event = this.events.find(e => e.id === flight.event_id);
      if (event) {
        eventInfo = event.name;
        // Also update competition info if available from event
        if (!flight.competition_name && event.competition_name) {
          competitionInfo = event.competition_name;
        }
      }
    }
    
    // Create the event info section for display
    const eventInfoSection = `
        <div class="flight-event-info">
            <small><strong>Competition:</strong> ${competitionInfo}</small>
            <small><strong>Event:</strong> ${eventInfo}</small>
            <small><strong>Movement:</strong> ${flight.movement_type || 'No Movement'}</small>
        </div>
    `;

    card.innerHTML = `
            <div class="flight-card-header">
                <div class="flight-name">${flight.name}</div>
                <div class="flight-order">Order: ${flight.order}</div>
            </div>
            ${eventInfoSection}
            <div class="flight-info">
                <p class="athlete-count"><strong>${
                  flight.athlete_count || 0
                }</strong> athletes</p>
                <p>Status: <span class="status-badge ${flight.is_active ? 'active' : 'inactive'}">${flight.is_active ? "Active" : "Inactive"}</span></p>
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
    console.log('Initializing flights sortable...');
    
    // Check if Sortable library is loaded
    if (typeof Sortable === 'undefined') {
      console.error('Sortable library is not loaded. Cannot initialize drag-and-drop.');
      return;
    }
    
    // Destroy existing sortable if it exists
    if (this.flightsSortable) {
      this.flightsSortable.destroy();
      this.flightsSortable = null;
    }

    // Check if flights grid exists
    if (!this.flightsGrid) {
      console.warn('Flights grid not found for sortable initialization');
      return;
    }

    // Create new sortable instance
    this.flightsSortable = new Sortable(this.flightsGrid, {
      animation: 150,
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      dragClass: "sortable-drag",
      onStart: (evt) => {
        console.log('Drag started on flight:', evt.item.dataset.flightId);
        evt.item.classList.add('dragging');
      },
      onEnd: (evt) => {
        console.log('Drag ended on flight:', evt.item.dataset.flightId);
        evt.item.classList.remove('dragging');
        
        // Only update if position actually changed
        if (evt.newIndex !== evt.oldIndex) {
          this.updateFlightOrder();
        }
      },
    });
    
    console.log('Flights sortable initialized successfully');
  }

  async updateFlightOrder() {
    console.log('Updating flight order...');
    const flightCards = this.flightsGrid.querySelectorAll(".flight-card");
    const updates = [];

    flightCards.forEach((card, index) => {
      const flightId = parseInt(card.dataset.flightId);
      const newOrder = index + 1;
      updates.push({ id: flightId, order: newOrder });

      // Update display
      const orderElement = card.querySelector(".flight-order");
      if (orderElement) {
        orderElement.textContent = `Order: ${newOrder}`;
      }
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
      console.log('Flight order updated successfully');
      
    } catch (error) {
      console.error("Error updating flight order:", error);
      this.showNotification("Error updating flight order", "error");
      
      // Refresh page if reorder fails
      setTimeout(() => {
        window.location.reload();
      }, 1000);
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
    if (this.currentEventId && this.allEvents) {
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
      
      // Find flight in local data first
      const flight = this.flights.find(f => f.id === parseInt(flightId));
      
      if (flight) {
        // Populate form with flight data
        document.getElementById("flight_name").value = flight.name || '';
        document.getElementById("flight_order").value = flight.order || 1;
        document.getElementById("flight_is_active").checked = flight.is_active || false;
        document.getElementById("flight_movement_type").value = flight.movement_type || '';

        // Set competition if available
        if (flight.competition_id) {
          document.getElementById("flight_competition_id").value = flight.competition_id;
          this.handleModalCompetitionChange(); // Populate event dropdown
        }
        
        // Set event if available  
        if (flight.event_id) {
          // Wait a bit for the event dropdown to be populated
          setTimeout(() => {
            document.getElementById("flight_event_id").value = flight.event_id;
          }, 100);
        }
      } else {
        // Fallback to API if not found in local data
        const response = await fetch(`/admin/flights/${flightId}`);
        if (!response.ok) throw new Error("Failed to load flight data");
        
        const flightData = await response.json();
        
        document.getElementById("flight_name").value = flightData.name || '';
        document.getElementById("flight_order").value = flightData.order || 1;
        document.getElementById("flight_is_active").checked = flightData.is_active || false;
        document.getElementById("flight_movement_type").value = flightData.movement_type || '';

        // Set competition and event if available
        if (flightData.competition_id) {
          document.getElementById("flight_competition_id").value = flightData.competition_id;
          this.handleModalCompetitionChange();
        }
        
        if (flightData.event_id) {
          setTimeout(() => {
            document.getElementById("flight_event_id").value = flightData.event_id;
          }, 100);
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
      competition_id: parseInt(competitionId),
      movement_type: formData.get("movement_type") || null
    };

    // Only add event_id if it's provided and not empty
    if (eventId && eventId.trim() !== "") {
      flightData.event_id = parseInt(eventId);
    } else {
      flightData.event_id = null;
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
      
      this.showNotification(
        this.currentFlightId ? result.message || "Flight updated successfully" 
                            : result.message || "Flight created successfully", 
        "success"
      );

      // Store currentFlightId before closing modals since closeModals() resets it
      const isUpdate = this.currentFlightId !== null;
      
      // Close modal
      this.closeModals();
      
      // Instead of page reload, update the UI directly like athlete page does
      if (isUpdate) {
        this.updateFlightInGrid(result.flight);
      } else {
        this.addFlightToGrid(result.flight);
      }
      
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

      // Remove the flight from the grid before closing modal
      this.removeFlightFromGrid(this.deleteFlightId);
      
      // Close modal
      this.deleteFlightModal.style.display = "none";
      this.deleteFlightId = null;

    } catch (error) {
      console.error("Error deleting flight:", error);
      this.showNotification(error.message, "error");
    } finally {
      this.hideLoading(this.deleteFlightModal);
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
    
    // Load attempt order for this flight
    await this.loadFlightAttemptOrder();

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
      // Load actual attempts for this flight, not just athletes
      this.loadFlightAttemptOrder();
      
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

      const result = await response.json();
      
      this.showNotification("Athlete added to flight", "success");
      
      // Reload flight athletes to sync with database
      await this.loadFlightAthletes(this.currentFlightId);
      
      // Update the flight card's athlete count directly
      this.updateFlightAthleteCount(this.currentFlightId);
      
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
      
      // Reload flight athletes to sync with database
      await this.loadFlightAthletes(this.currentFlightId);
      
      // Update the flight card's athlete count directly
      this.updateFlightAthleteCount(this.currentFlightId);
      
    } catch (error) {
      console.error("Error removing athlete from flight:", error);
      this.showNotification(
        error.message || "Error removing athlete from flight",
        "error"
      );
    }
  }

  // Function to refresh all data from server
  async refreshAllData() {
    try {
      console.log('Refreshing all data from server...');
      
      // Load flights
      const flightsResponse = await fetch('/admin/flights/all');
      if (flightsResponse.ok) {
        this.flights = await flightsResponse.json();
      }
      
      // Load competitions  
      const competitionsResponse = await fetch('/admin/competitions');
      if (competitionsResponse.ok) {
        this.competitions = await competitionsResponse.json();
      }
      
      // Load events
      const eventsResponse = await fetch('/admin/events');
      if (eventsResponse.ok) {
        this.events = await eventsResponse.json();
      }
      
      // Load athletes
      const athletesResponse = await fetch('/admin/athletes');
      if (athletesResponse.ok) {
        const athletesData = await athletesResponse.json();
        this.athletes = athletesData.athletes || athletesData;
      }
      
      this.renderFlights();
      
      console.log('All data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing all data:', error);
    }
  }

  initializeAthleteOrder(athletes) {
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
                <div class="drag-indicator">⋮⋮</div>
            `;

      container.appendChild(item);
    });

    // Initialize sortable for athlete order
    if (this.attemptsSortable) {
      this.attemptsSortable.destroy();
    }

    this.attemptsSortable = new Sortable(container, {
      animation: 150,
      // Remove handle restriction - make entire item draggable
      // handle: ".drag-handle", 
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      dragClass: "sortable-drag",
      onStart: (evt) => {
        evt.item.classList.add('dragging');
      },
      onEnd: (evt) => {
        evt.item.classList.remove('dragging');
        this.updateAthleteDisplayOrder();
        // Only update server if position actually changed
        if (evt.newIndex !== evt.oldIndex) {
          this.updateAthleteOrder();
        }
      },
    });
  }

  updateAthleteDisplayOrder() {
    const items = document.querySelectorAll(".attempt-item");
    items.forEach((item, index) => {
      item.querySelector(".attempt-number").textContent = index + 1;
    });
  }

  async updateAthleteOrder() {
    if (!this.currentFlightId) {
      console.warn('No current flight ID set for athlete order update');
      return;
    }

    console.log('Updating athlete order for flight:', this.currentFlightId);
    const items = document.querySelectorAll(".attempt-item");
    const updates = [];

    items.forEach((item, index) => {
      const athleteId = parseInt(item.dataset.athleteId);
      const newOrder = index + 1;
      updates.push({ athlete_id: athleteId, order: newOrder });
    });

    try {
      const response = await fetch(`/admin/flights/${this.currentFlightId}/athletes/reorder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ athlete_orders: updates }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update athlete order");
      }

      const result = await response.json();
      this.showNotification(result.message || "Athlete order updated successfully", "success");
      console.log('Athlete order updated successfully');
      
    } catch (error) {
      console.error("Error updating athlete order:", error);
      this.showNotification("Error updating athlete order: " + error.message, "error");
      
      // Reload flight athletes if order update fails
      await this.loadFlightAthletes(this.currentFlightId);
    }
  }

  async sortAttempts(sortType) {
    if (!this.currentFlightId) {
      this.showNotification("No flight selected", "error");
      return;
    }

    // Show loading state on the clicked button
    const buttonMap = {
      'weight': document.getElementById('sort-by-weight'),
      'name': document.getElementById('sort-by-name'),
      'random': document.getElementById('randomize-order')
    };
    
    const clickedButton = buttonMap[sortType];
    if (clickedButton) {
      const originalText = clickedButton.textContent;
      clickedButton.textContent = 'Saving...';
      clickedButton.disabled = true;
    }

    try {
      const response = await fetch(`/admin/flights/${this.currentFlightId}/attempts/sort/${sortType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to sort attempts by ${sortType}`);
      }

      const result = await response.json();
      this.showNotification(result.message || `Attempts sorted by ${sortType} successfully`, "success");
      
      // Reload attempt order
      this.loadFlightAttemptOrder();
      
    } catch (error) {
      console.error('Error sorting attempts:', error);
      this.showNotification(error.message || `Error sorting attempts by ${sortType}`, "error");
    } finally {
      // Restore button state
      if (clickedButton) {
        const buttonText = {
          'weight': 'Sort by Weight',
          'name': 'Sort by Name', 
          'random': 'Randomize Order'
        };
        clickedButton.textContent = buttonText[sortType] || 'Sort';
        clickedButton.disabled = false;
      }
    }
  }

  // Load and display flight attempt order
  async loadFlightAttemptOrder() {
    if (!this.currentFlightId) return;
    
    try {
      const response = await fetch(`/admin/flights/${this.currentFlightId}/attempts/order`);
      if (!response.ok) {
        throw new Error('Failed to load attempt order');
      }
      
      const data = await response.json();
      this.displayAttemptOrder(data.attempts || []);
      
    } catch (error) {
      console.error('Error loading attempt order:', error);
      this.showNotification('Error loading attempt order', 'error');
    }
  }

  // Display attempt order in the UI
  displayAttemptOrder(attempts) {
    const container = document.getElementById("attempt-order-list");
    if (!container) return;
    
    // Store all attempts for filtering
    this.allAttempts = attempts;
    
    // Apply filters
    const filteredAttempts = this.applyAttemptFilters(attempts);
    
    container.innerHTML = "";
    
    if (filteredAttempts.length === 0) {
      container.innerHTML = `
        <div class="no-attempts">
          <p>No attempts found${attempts.length > 0 ? ' for current filters' : ' for this flight'}.</p>
          <p><small>${attempts.length > 0 ? 'Try adjusting your filters or ' : 'Add some athletes to this flight and '}generate test attempts to see them here.</small></p>
        </div>
      `;
      return;
    }
    
    // Separate finished and pending attempts
    const finishedAttempts = [];
    const pendingAttempts = [];
    
    filteredAttempts.forEach(attempt => {
      // Use status field as primary indicator, fall back to legacy fields
      let isFinished = false;
      
      if (attempt.status) {
        isFinished = ['finished', 'success', 'failed'].includes(attempt.status.toLowerCase());
      } else {
        // Fallback for backward compatibility
        isFinished = attempt.completed_at || attempt.final_result;
      }
      
      if (isFinished) {
        finishedAttempts.push(attempt);
      } else {
        pendingAttempts.push(attempt);
      }
    });
    
    // Sort pending attempts by lifting_order
    pendingAttempts.sort((a, b) => {
      const orderA = a.lifting_order || 999999;
      const orderB = b.lifting_order || 999999;
      if (orderA === orderB) {
        return a.id - b.id; // Secondary sort by ID
      }
      return orderA - orderB;
    });
    
    // Sort finished attempts by completion order (completed_at or lifting_order)
    finishedAttempts.sort((a, b) => {
      if (a.completed_at && b.completed_at) {
        return new Date(a.completed_at) - new Date(b.completed_at);
      }
      const orderA = a.lifting_order || 999999;
      const orderB = b.lifting_order || 999999;
      return orderA - orderB;
    });
    
    // Display pending attempts first, then finished attempts
    const orderedAttempts = [...pendingAttempts, ...finishedAttempts];
    
    orderedAttempts.forEach((attempt, index) => {
      const item = document.createElement("div");
      
      // Use the status field from database as primary source
      let statusClass = "waiting";
      let statusText = "Waiting";
      let itemClass = "attempt-item";
      let isFinished = false;
      let isInProgress = false;
      
      // Primary logic: use the status field from database
      if (attempt.status) {
        switch(attempt.status.toLowerCase()) {
          case "waiting":
            statusClass = "waiting";
            statusText = "Waiting";
            itemClass += " attempt-waiting";
            break;
          case "in-progress":
            statusClass = "in-progress";
            statusText = "In Progress";
            itemClass += " attempt-in-progress";
            isInProgress = true;
            break;
          case "finished":
            statusClass = "finished";
            statusText = "Finished";
            itemClass += " attempt-finished";
            isFinished = true;
            break;
          case "success":
            statusClass = "success";
            statusText = "Success";
            itemClass += " attempt-finished";
            isFinished = true;
            break;
          case "failed":
            statusClass = "failed";
            statusText = "Failed";
            itemClass += " attempt-finished";
            isFinished = true;
            break;
          default:
            statusClass = "waiting";
            statusText = attempt.status;
            itemClass += " attempt-waiting";
        }
      } else {
        // Fallback logic for backward compatibility (if status field is missing)
        isFinished = attempt.completed_at || attempt.final_result;
        isInProgress = attempt.started_at && !isFinished;
        
        if (isFinished) {
          itemClass += " attempt-finished";
          if (attempt.final_result) {
            switch(attempt.final_result) {
              case "good_lift":
                statusClass = "success";
                statusText = "Good Lift";
                break;
              case "no_lift":
                statusClass = "failed";
                statusText = "No Lift";
                break;
              default:
                statusClass = "finished";
                statusText = attempt.final_result;
            }
          } else {
            statusClass = "finished";
            statusText = "Finished";
          }
        } else if (isInProgress) {
          statusClass = "in-progress";
          statusText = "In Progress";
          itemClass += " attempt-in-progress";
        } else {
          itemClass += " attempt-waiting";
        }
      }
      
      item.className = itemClass;
      item.dataset.attemptId = attempt.id;
      item.dataset.finished = isFinished ? "true" : "false";
      item.dataset.athleteId = attempt.athlete_id;
      
      item.innerHTML = `
        <div class="attempt-number">${index + 1}</div>
        <div class="attempt-athlete-name">${attempt.athlete_name}</div>
        <div class="attempt-athlete-weight">
          <input type="number" 
                 class="weight-input" 
                 value="${attempt.requested_weight}" 
                 step="0.5"
                 ${isFinished ? 'disabled' : ''}
                 data-attempt-id="${attempt.id}">
          <span class="weight-unit">kg</span>
        </div>
        <div class="attempt-details">Attempt ${attempt.attempt_number}</div>
        <div class="attempt-status ${statusClass}">${statusText}</div>
        <div class="attempt-item-actions">
          <button class="action-btn edit" onclick="flightManager.editAttempt(${attempt.id})" title="Edit Attempt">
            Edit
          </button>
          <button class="action-btn delete" onclick="flightManager.deleteAttempt(${attempt.id})" title="Delete Attempt">
            Delete
          </button>
        </div>
      `;
      container.appendChild(item);
    });
    
    // Add event listeners for weight editing
    this.addWeightEditListeners();
    
    // Initialize sortable only for non-finished attempts
    this.initializeAttemptsSortable();
  }

  // Initialize sortable for attempt reordering
  initializeAttemptsSortable() {
    const container = document.getElementById("attempt-order-list");
    if (!container) return;
    
    // Destroy existing sortable if it exists
    if (this.attemptsSortable) {
      this.attemptsSortable.destroy();
      this.attemptsSortable = null;
    }
    
    this.attemptsSortable = Sortable.create(container, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      filter: '.attempt-finished', // Prevent dragging finished attempts
      preventOnFilter: false,
      onStart: (evt) => {
        // Check if item is finished
        if (evt.item.classList.contains('attempt-finished')) {
          this.showNotification('Cannot reorder finished attempts', 'warning');
          return false;
        }
      },
      onMove: (evt) => {
        // Prevent non-finished attempts from being moved below finished attempts
        const draggedItem = evt.dragged;
        const relatedItem = evt.related;
        
        // If dragging a non-finished item
        if (!draggedItem.classList.contains('attempt-finished')) {
          // And trying to place it after a finished item, prevent it
          if (relatedItem && relatedItem.classList.contains('attempt-finished')) {
            return false; // Prevent the move
          }
        }
        
        return true; // Allow the move
      },
      onEnd: () => {
        this.updateAttemptDisplayOrder();
        this.updateAttemptOrder();
      }
    });
  }

  // Update display order numbers after drag and drop
  updateAttemptDisplayOrder() {
    const container = document.getElementById("attempt-order-list");
    if (!container) return;
    
    const items = container.querySelectorAll(".attempt-item");
    items.forEach((item, index) => {
      const numberElement = item.querySelector(".attempt-number");
      if (numberElement) {
        numberElement.textContent = index + 1;
      }
    });
  }

  // Update attempt order after drag and drop
  async updateAttemptOrder() {
    if (!this.currentFlightId) return;
    
    const container = document.getElementById("attempt-order-list");
    const items = Array.from(container.querySelectorAll(".attempt-item"));
    
    // Only reorder non-finished attempts, preserve finished attempts at the end
    const updates = [];
    let order = 1;
    
    for (const item of items) {
      const isFinished = item.dataset.finished === "true";
      
      if (!isFinished) {
        updates.push({
          id: parseInt(item.dataset.attemptId),
          lifting_order: order
        });
        order++;
      }
    }
    
    // Set finished attempts to have higher lifting_order to keep them at the end
    for (const item of items) {
      const isFinished = item.dataset.finished === "true";
      
      if (isFinished) {
        updates.push({
          id: parseInt(item.dataset.attemptId),
          lifting_order: order
        });
        order++;
      }
    }
    
    try {
      const response = await fetch(`/admin/flights/${this.currentFlightId}/attempts/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ updates })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update attempt order');
      }
      
      const result = await response.json();
      this.showNotification(result.message || 'Attempt order updated successfully', 'success');
      
    } catch (error) {
      console.error('Error updating attempt order:', error);
      this.showNotification('Error updating attempt order', 'error');
      // Reload to restore original order
      this.loadFlightAttemptOrder();
    }
  }

  // Add event listeners for weight editing
  addWeightEditListeners() {
    const weightInputs = document.querySelectorAll('.weight-input');
    weightInputs.forEach(input => {
      input.addEventListener('change', (e) => this.handleWeightChange(e));
      input.addEventListener('blur', (e) => this.handleWeightChange(e));
    });
  }

  // Handle weight change with validation
  async handleWeightChange(event) {
    const input = event.target;
    const attemptId = input.dataset.attemptId;
    const newWeight = parseFloat(input.value);
    const attemptItem = input.closest('.attempt-item');
    const athleteId = attemptItem.dataset.athleteId;
    
    // Allow any numeric value including negative weights and zero
    if (isNaN(newWeight)) {
      this.showNotification('Weight must be a valid number', 'error');
      input.focus();
      return;
    }
    
    // Validate weight progression for this athlete (validation disabled in function)
    if (!this.validateWeightProgression(athleteId, attemptId, newWeight)) {
      input.focus();
      return;
    }
    
    try {
      const response = await fetch(`/admin/attempts/${attemptId}/weight`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ weight: newWeight })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update weight');
      }
      
      const result = await response.json();
      this.showNotification('Weight updated successfully', 'success');
      
      // Update the display
      input.value = newWeight;
      
    } catch (error) {
      console.error('Error updating weight:', error);
      this.showNotification(error.message || 'Error updating weight', 'error');
      // Reload to restore original weight
      this.loadFlightAttemptOrder();
    }
  }

  // Validate weight progression for an athlete (DISABLED - allows any weight values)
  validateWeightProgression(athleteId, currentAttemptId, newWeight) {
    // Validation disabled to allow flexible weight adjustments
    return true;
    
    /* ORIGINAL VALIDATION CODE (DISABLED)
    const athleteAttempts = Array.from(document.querySelectorAll(`.attempt-item[data-athlete-id="${athleteId}"]`));
    
    for (const attemptItem of athleteAttempts) {
      const attemptId = attemptItem.dataset.attemptId;
      if (attemptId === currentAttemptId) continue;
      
      const weightInput = attemptItem.querySelector('.weight-input');
      const otherWeight = parseFloat(weightInput.value);
      const attemptNumber = parseInt(attemptItem.querySelector('.attempt-details').textContent.match(/\d+/)[0]);
      const currentAttemptNumber = parseInt(document.querySelector(`[data-attempt-id="${currentAttemptId}"] .attempt-details`).textContent.match(/\d+/)[0]);
      
      // For the same athlete, later attempts must have weight >= earlier attempts
      if (currentAttemptNumber > attemptNumber && newWeight < otherWeight) {
        this.showNotification(`Attempt ${currentAttemptNumber} weight (${newWeight}kg) cannot be less than attempt ${attemptNumber} weight (${otherWeight}kg) for the same athlete`, 'error');
        return false;
      }
      
      if (currentAttemptNumber < attemptNumber && newWeight > otherWeight) {
        this.showNotification(`Attempt ${currentAttemptNumber} weight (${newWeight}kg) cannot be greater than attempt ${attemptNumber} weight (${otherWeight}kg) for the same athlete`, 'error');
        return false;
      }
    }
    */
    
    return true;
  }

  // Generate test attempts for a flight
  async generateTestAttempts() {
    if (!this.currentFlightId) {
      this.showNotification("No flight selected", "error");
      return;
    }

    const button = document.getElementById("generate-test-attempts");
    if (button) {
      const originalText = button.textContent;
      button.textContent = 'Generating...';
      button.disabled = true;
    }

    try {
      const response = await fetch(`/admin/flights/${this.currentFlightId}/attempts/generate-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate test attempts');
      }

      const result = await response.json();
      this.showNotification(result.message || 'Test attempts generated successfully', "success");
      
      // Reload attempt order to show new attempts
      this.loadFlightAttemptOrder();
      
    } catch (error) {
      console.error('Error generating test attempts:', error);
      this.showNotification(error.message || 'Error generating test attempts', "error");
    } finally {
      // Restore button state
      if (button) {
        button.textContent = 'Generate Test Attempts';
        button.disabled = false;
      }
    }
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
  
  // Update just the athlete count for a specific flight card
  async updateFlightAthleteCount(flightId) {
    try {
      const response = await fetch(`/admin/flights/${flightId}/athletes`);
      if (response.ok) {
        const data = await response.json();
        const athleteCount = data.athletes ? data.athletes.length : 0;
        
        // Find the flight card and update its athlete count
        const card = document.querySelector(`.flight-card[data-flight-id="${flightId}"]`);
        if (card) {
          const athleteCountElement = card.querySelector('.athlete-count');
          if (athleteCountElement) {
            athleteCountElement.innerHTML = `<strong>${athleteCount}</strong> athletes`;
          }
        }
        
        console.log(`Updated athlete count for flight ${flightId}: ${athleteCount}`);
      }
    } catch (error) {
      console.error('Error updating flight athlete count:', error);
    }
  }
  
  // Direct DOM update functions similar to athlete page
  updateFlightInGrid(flight) {
    console.log('updateFlightInGrid called with:', flight);
    
    // Enrich the incoming flight data first
    const enrichedFlight = this.enrichFlightData(flight);
    console.log('Enriched flight data:', enrichedFlight);
    
    // Update the in-memory data structures
    const flightIndex = this.flights.findIndex(f => f.id === enrichedFlight.id);
    if (flightIndex !== -1) {
      // Merge with existing data to preserve any fields not returned by the server
      this.flights[flightIndex] = { ...this.flights[flightIndex], ...enrichedFlight };
      console.log('Updated flight in data array:', enrichedFlight.id);
    } else {
      // If not found, add it (shouldn't happen for update, but just in case)
      this.flights.push(enrichedFlight);
      console.log('Flight not found in array, added new entry:', enrichedFlight.id);
    }
    
    // Also update allFlights if it's populated
    const allFlightIndex = this.allFlights.findIndex(f => f.id === enrichedFlight.id);
    if (allFlightIndex !== -1) {
      this.allFlights[allFlightIndex] = { ...this.allFlights[allFlightIndex], ...enrichedFlight };
    } else if (this.allFlights.length > 0) {
      this.allFlights.push(enrichedFlight);
    }
    
    // Update filteredFlights if it exists
    const filteredFlightIndex = this.filteredFlights.findIndex(f => f.id === enrichedFlight.id);
    if (filteredFlightIndex !== -1) {
      this.filteredFlights[filteredFlightIndex] = { ...this.filteredFlights[filteredFlightIndex], ...enrichedFlight };
    }
    
    // Now update the DOM
    const card = document.querySelector(`.flight-card[data-flight-id="${enrichedFlight.id}"]`);
    if (card) {
      // Update data attributes
      card.dataset.flightOrder = enrichedFlight.order;
      card.dataset.competitionId = enrichedFlight.competition_id || '';
      card.dataset.eventId = enrichedFlight.event_id || '';
      
      // Update flight name
      const nameElement = card.querySelector('.flight-name');
      if (nameElement) {
        nameElement.textContent = enrichedFlight.name;
      }
      
      // Update flight order
      const orderElement = card.querySelector('.flight-order');
      if (orderElement) {
        orderElement.textContent = `Order: ${enrichedFlight.order}`;
      }
      
      // Update competition and event info
      const eventInfoSection = card.querySelector('.flight-event-info');
      if (eventInfoSection) {
        const competitionInfo = enrichedFlight.competition_name || 'No Competition';
        const eventInfo = enrichedFlight.event_name || 'No Event';
        const movementInfo = enrichedFlight.movement_type || 'No Movement';
        eventInfoSection.innerHTML = `
          <small><strong>Competition:</strong> ${competitionInfo}</small>
          <small><strong>Event:</strong> ${eventInfo}</small>
          <small><strong>Movement:</strong> ${movementInfo}</small>
        `;
      }
      
      // Update athlete count
      const athleteCountElement = card.querySelector('.athlete-count');
      if (athleteCountElement) {
        athleteCountElement.innerHTML = `<strong>${enrichedFlight.athlete_count || 0}</strong> athletes`;
      }
      
      // Update status badge
      const statusBadge = card.querySelector('.status-badge');
      if (statusBadge) {
        statusBadge.className = `status-badge ${enrichedFlight.is_active ? 'active' : 'inactive'}`;
        statusBadge.textContent = enrichedFlight.is_active ? 'Active' : 'Inactive';
      }
      
      // Update the card's active class
      card.className = `flight-card ${enrichedFlight.is_active ? 'active' : ''}`;
      
      console.log('Updated flight card in grid:', enrichedFlight.id);
    }
  }
  
  addFlightToGrid(flight) {
    console.log('addFlightToGrid called with:', flight);
    
    // Enrich the incoming flight data first
    const enrichedFlight = this.enrichFlightData(flight);
    console.log('Enriched flight data:', enrichedFlight);
    
    // Add to in-memory data structures
    this.flights.push(enrichedFlight);
    console.log('Added flight to data array:', enrichedFlight.id);
    
    // Add to allFlights if it's populated
    if (this.allFlights.length > 0) {
      this.allFlights.push(enrichedFlight);
    }
    
    // Now update the DOM
    const flightsGrid = this.flightsGrid;
    if (flightsGrid) {
      // Create the new flight card with enriched data
      const newCard = this.createFlightCard(enrichedFlight);
      
      // Add to the grid
      flightsGrid.appendChild(newCard);
      
      // Reinitialize sortable to include the new card
      this.initializeFlightsSortable();
      
      console.log('Added new flight card to grid:', enrichedFlight.id);
    }
  }
  
  removeFlightFromGrid(flightId) {
    // First, remove from in-memory data structures
    this.flights = this.flights.filter(f => f.id !== parseInt(flightId));
    this.allFlights = this.allFlights.filter(f => f.id !== parseInt(flightId));
    this.filteredFlights = this.filteredFlights.filter(f => f.id !== parseInt(flightId));
    console.log('Removed flight from data arrays:', flightId);
    
    // Now remove from DOM
    const card = document.querySelector(`.flight-card[data-flight-id="${flightId}"]`);
    if (card) {
      card.remove();
      console.log('Removed flight card from grid:', flightId);
      
      // Reinitialize sortable after removal
      this.initializeFlightsSortable();
    }
  }
  
  async markFirstAttemptCompleted() {
    if (!this.currentFlightId) return;

    try {
      // Find the first pending attempt (not finished)
      const attempts = this.currentAttempts || [];
      const firstPendingAttempt = attempts.find(attempt => attempt.status !== 'finished');
      
      if (!firstPendingAttempt) {
        this.showNotification('No pending attempts found to mark as completed.', 'warning');
        return;
      }

      const response = await fetch('/admin/update_attempt_status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attempt_id: firstPendingAttempt.id,
          status: 'finished'
        })
      });

      if (response.ok) {
        // Reload the attempt order to show the updated queue
        await this.loadFlightAttemptOrder();
        this.showNotification(`Attempt by ${firstPendingAttempt.athlete_name} marked as completed.`, 'success');
      } else {
        const errorData = await response.json();
        this.showNotification(`Error: ${errorData.error}`, 'error');
      }
    } catch (error) {
      console.error('Error marking attempt as completed:', error);
      this.showNotification('Error marking attempt as completed', 'error');
    }
  }

  // Filter functionality
  applyAttemptFilters(attempts) {
    const athleteFilter = document.getElementById("athlete-name-filter")?.value.toLowerCase() || '';
    const statusFilter = document.getElementById("attempt-status-filter")?.value || '';
    
    return attempts.filter(attempt => {
      // Athlete name filter
      if (athleteFilter && !attempt.athlete_name.toLowerCase().includes(athleteFilter)) {
        return false;
      }
      
      // Status filter
      if (statusFilter) {
        const isFinished = attempt.status === 'finished' || attempt.completed_at || attempt.final_result;
        const isInProgress = attempt.status === 'in-progress' || (attempt.started_at && !isFinished);
        let currentStatus = 'waiting';
        
        if (isFinished) {
          currentStatus = 'finished';
        } else if (isInProgress) {
          currentStatus = 'in-progress';
        }
        
        if (currentStatus !== statusFilter) {
          return false;
        }
      }
      
      return true;
    });
  }

  applyFiltersAndRedisplay() {
    if (this.allAttempts) {
      this.displayAttemptOrder(this.allAttempts);
    }
  }

  clearFilters() {
    document.getElementById("athlete-name-filter").value = '';
    document.getElementById("attempt-status-filter").value = '';
    this.applyFiltersAndRedisplay();
  }

  // Attempt editing functionality
  showAddAttemptModal() {
    if (!this.currentFlightId) {
      this.showNotification('Please select a flight first', 'warning');
      return;
    }
    
    this.currentEditingAttemptId = null;
    this.populateAttemptModal();
    this.showModal('attempt-modal');
  }

  async populateAttemptModal(attemptData = null) {
    const modal = document.getElementById('attempt-modal');
    const title = document.getElementById('attempt-modal-title');
    
    // Set modal title and show athlete name for editing
    if (attemptData) {
      title.textContent = `Edit Attempt - ${attemptData.athlete_name}`;
      
      // Populate form with existing data
      document.getElementById('attempt_number').value = attemptData.attempt_number;
      document.getElementById('attempt_weight').value = attemptData.requested_weight;
      document.getElementById('attempt_status').value = attemptData.status || 'waiting';
      document.getElementById('attempt_lifting_order').value = attemptData.lifting_order || '';
    } else {
      title.textContent = 'Add New Attempt';
      // Reset form for new attempt
      document.getElementById('attempt-form').reset();
    }
  }

  async editAttempt(attemptId) {
    try {
      console.log('Editing attempt with ID:', attemptId);
      const response = await fetch(`/admin/attempts/${attemptId}`);
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const attemptData = await response.json();
        console.log('Attempt data received:', attemptData);
        this.currentEditingAttemptId = attemptId;
        await this.populateAttemptModal(attemptData);
        this.showModal('attempt-modal');
      } else {
        const errorText = await response.text();
        console.error('Error response:', response.status, errorText);
        this.showNotification(`Error loading attempt data: ${response.status}`, 'error');
      }
    } catch (error) {
      console.error('Error loading attempt:', error);
      this.showNotification('Error loading attempt data', 'error');
    }
  }

  async deleteAttempt(attemptId) {
    if (!confirm('Are you sure you want to delete this attempt?')) {
      return;
    }
    
    try {
      const response = await fetch(`/admin/attempts/${attemptId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        await this.loadFlightAttemptOrder();
        this.showNotification('Attempt deleted successfully', 'success');
      } else {
        const errorData = await response.json();
        this.showNotification(`Error: ${errorData.error}`, 'error');
      }
    } catch (error) {
      console.error('Error deleting attempt:', error);
      this.showNotification('Error deleting attempt', 'error');
    }
  }

  async saveAttempt() {
    const form = document.getElementById('attempt-form');
    const formData = new FormData(form);
    
    // For editing, we don't change the athlete, so use the stored athlete_id
    let athleteId;
    if (this.currentEditingAttemptId) {
      // Get athlete_id from the current attempt data
      const currentAttempt = this.allAttempts.find(a => a.id === this.currentEditingAttemptId);
      athleteId = currentAttempt ? currentAttempt.athlete_id : null;
    } else {
      // For new attempts, we would need athlete selection, but this is edit-only now
      this.showNotification('Adding new attempts is not supported in this interface', 'error');
      return;
    }
    
    // Validate required fields
    const attemptNumber = formData.get('attempt_number');
    const requestedWeight = formData.get('requested_weight');
    
    if (!athleteId || !attemptNumber || !requestedWeight) {
      this.showNotification('Please fill in all required fields', 'error');
      return;
    }
    
    const data = {
      athlete_id: parseInt(athleteId),
      attempt_number: parseInt(attemptNumber),
      requested_weight: parseFloat(requestedWeight),
      status: formData.get('status') || 'waiting',
      lifting_order: formData.get('lifting_order') ? parseInt(formData.get('lifting_order')) : null,
      flight_id: this.currentFlightId
    };
    
    try {
      // Only update existing attempts now
      const response = await fetch(`/admin/attempts/${this.currentEditingAttemptId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        this.closeModals();
        await this.loadFlightAttemptOrder();
        this.showNotification('Attempt updated successfully', 'success');
      } else {
        const errorData = await response.json();
        this.showNotification(`Error: ${errorData.error}`, 'error');
      }
    } catch (error) {
      console.error('Error saving attempt:', error);
      this.showNotification('Error saving attempt', 'error');
    }
  }

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'block';
    }
  }

  closeModals() {
    const modals = ['flight-modal', 'delete-flight-modal', 'attempt-modal'];
    modals.forEach(modalId => {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.style.display = 'none';
      }
    });
    
    // Reset editing state
    this.currentEditingAttemptId = null;
  }
  
}

document.addEventListener("DOMContentLoaded", function () {
  window.flightManager = new FlightManager();
});
