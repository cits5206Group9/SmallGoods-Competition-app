(function() {
    // Reuse utility functions from competition_create.js
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

    // Import functions from competition_create.js
    const {
        createEmptyModel,
        serializeFromDOM,
        addEventCard,
        addMovementCard,
        addMetricRow,
        addGroupCard,
        setStatus,
        loadIntoDOM,
        downloadJSON
    } = window.CompetitionUtils;

    // Elements
    const competitionSelect = $('#competition-select');
    const editorContainer = $('#editor-container');
    let currentCompetitionId = null;

    // Load competition data when selected
    competitionSelect.addEventListener('change', async () => {
        const competitionId = competitionSelect.value;
        currentCompetitionId = competitionId;
        
        if (!competitionId) {
            editorContainer.style.display = 'none';
            return;
        }

        try {
            const response = await fetch(`/admin/competition-model/get/${competitionId}`);
            if (!response.ok) throw new Error('Failed to fetch competition data');
            
            const data = await response.json();
            loadCompetitionData(data);
            editorContainer.style.display = 'block';
        } catch (error) {
            console.error('Error loading competition:', error);
            alert('Failed to load competition data');
        }
    });

    function loadCompetitionData(data) {
        // Load the configuration from the database
        const config = data.config || {};
        console.log('Loading config:', config); // Debug log
        
        // Clear existing content first
        $('#events-container').innerHTML = '';
        
        // Load basic fields
        $('#comp-name').value = data.name || '';
        $('#sport-type').value = data.sport_type || '';
        $('#allow-athlete-input').checked = !!(config.features?.allowAthleteInput);
        $('#allow-coach-assignment').checked = !!(config.features?.allowCoachAssignment);
        $('#enable-attempt-ordering').checked = !!(config.features?.enableAttemptOrdering);

        // Load events
        (config.events || []).forEach(evt => {
            addEventCard();
            const lastEvent = $('.event-card:last-child');
            if (!lastEvent) return;

            // Fill in event details
            $('.event-name', lastEvent).value = evt.name || '';
            $('.event-gender', lastEvent).value = evt.gender || '';
            $('.event-attempt-ordering', lastEvent).value = evt.order?.rule || '';
            $('.event-custom-order', lastEvent).value = (evt.order?.custom_order || []).join(',');
            $('.event-order-notes', lastEvent).value = evt.order?.notes || '';

            // Add movements
            (evt.movements || []).forEach(mov => {
                const movContainer = $('.movements-container', lastEvent);
                if (!movContainer) return;

                addMovementCard(lastEvent);
                const lastMovement = $('.movement-card:last-child', movContainer);
                if (!lastMovement) return;

                // Fill in movement details
                $('.movement-name', lastMovement).value = mov.name || '';
                $('.movement-reps', lastMovement).value = (mov.reps || []).join(',');
                $('.scoring-name', lastMovement).value = mov.scoring?.name || '';
                $('.scoring-type', lastMovement).value = mov.scoring?.type || 'max';
                $('.scoring-metric', lastMovement).value = mov.scoring?.metric || '';
                $('.attempt-time', lastMovement).value = mov.timer?.attempt_seconds || '';
                $('.break-time', lastMovement).value = mov.timer?.break_seconds || '';

                // Add metrics
                (mov.metrics || []).forEach(metric => {
                    const metricsContainer = $('.metrics-container', lastMovement);
                    if (!metricsContainer) return;

                    addMetricRow(lastMovement);
                    const lastMetric = $('.metric-row:last-child', metricsContainer);
                    if (!lastMetric) return;

                    $('.metric-name', lastMetric).value = metric.name || '';
                    $('.metric-units', lastMetric).value = metric.units || '';
                });
            });

            // Add groups
            (evt.groups || []).forEach(grp => {
                const groupContainer = $('.groups-container', lastEvent);
                if (!groupContainer) return;

                addGroupCard(lastEvent);
                const lastGroup = $('.group-card:last-child', groupContainer);
                if (!lastGroup) return;

                // Fill in group details
                $('.group-name', lastGroup).value = grp.name || '';
                $('.group-reps', lastGroup).value = (grp.reps_override || []).join(',');
                $('.group-order', lastGroup).value = grp.order || '';
                $('.ref-n', lastGroup).value = grp.referee?.n || '';

                // Handle referee options
                const refLines = (grp.referee?.options || [])
                    .map(o => [o.label || '', o.color || '', String(o.value)].join(','))
                    .join('\n');
                $('.ref-options', lastGroup).value = refLines;
                $('.ref-notes', lastGroup).value = grp.referee?.notes || '';
            });
        });

        // Setup event listeners
        setupEventListeners();
        
        // Update JSON preview
        CompetitionUtils.renderPreview();
    }

    function setupEventListeners() {
        // Add Event button
        $('#add-event-btn').addEventListener('click', () => {
            addEventCard();
            CompetitionUtils.renderPreview();  // Use the shared renderPreview
        });

        // Save changes button
        $('#save-db-btn').addEventListener('click', saveChanges);

        // Download JSON button
        $('#download-json-btn').addEventListener('click', downloadJSON);

        // Reset changes button
        $('#clear-all-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all changes?')) {
                loadCompetitionData({ id: currentCompetitionId });
            }
        });
    }

    function saveChanges() {
        if (!currentCompetitionId) {
            setStatus('No competition selected');
            return;
        }

        try {
            // Get the complete model including events, movements, and groups
            const model = CompetitionUtils.serializeFromDOM();
            
            // Add the competition ID
            model.id = currentCompetitionId;

            console.log('Saving model:', model); // Debug log

            fetch('/admin/competition-model/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(model)
            })
            .then(response => response.json())
            .then(result => {
                if (result.status === 'success') {
                    setStatus('Changes saved successfully');
                } else {
                    throw new Error(result.message);
                }
            })
            .catch(error => {
                console.error('Save error:', error);
                setStatus(`Error: ${error.message}`);
            });
        } catch (error) {
            console.error('Save error:', error);
            setStatus(`Error: ${error.message}`);
        }
    }

    // Initialize the page
    function init() {
        // Hide editor initially
        editorContainer.style.display = 'none';
        
        // Setup initial event listeners
        setupEventListeners();
    }

    init();
})();