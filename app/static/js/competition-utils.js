window.CompetitionUtils = (function() {
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

    function createEmptyModel() {
        return {
            name: '',
            sport_type: '',
            features: {
                allowAthleteInput: true,
                allowCoachAssignment: true,
                enableAttemptOrdering: true
            },
            events: []
        };
    }

    function renderPreview() {
        const normalized = serializeFromDOM();
        $('#json-preview').textContent = JSON.stringify(normalized, null, 2);
    }

    function toList(val) {
        if (!val) return [];
        return val.split(',').map(s => s.trim()).filter(Boolean);
    }

    function toNumberList(val) {
        return toList(val).map(x => {
            const n = Number(x);
            return Number.isFinite(n) ? n : null;
        }).filter(x => x !== null);
    }

    function serializeRefOptions(text) {
        if (!text) return [];
        return text.split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => {
                const [label, color, valueRaw] = line.split(',').map(s => (s || '').trim());
                const value = (valueRaw || '').toLowerCase();
                let parsedValue = value;
                if (value === 'true') parsedValue = true;
                else if (value === 'false') parsedValue = false;
                return { label, color, value: parsedValue };
            });
    }

    function serializeFromDOM() {
        console.log("Serializing competition data from DOM");
        const comp = {
            name: $('#comp-name').value.trim(),
            comp_date: $('#comp-date').value,
            sport_type: $('#sport-type').value,
            features: {
                allowAthleteInput: !!$('#allow-athlete-input').checked,
                allowCoachAssignment: !!$('#allow-coach-assignment').checked,
                enableAttemptOrdering: !!$('#enable-attempt-ordering').checked
            },
            events: []
        };

        // Serialize events
        $$('.event-card').forEach(eventCard => {
            const eventId = eventCard.dataset.eventId;
            console.log(`Processing event card with ID: ${eventId}`);
            
            const event = {
                id: eventId ? parseInt(eventId) : undefined,  // Convert to number if exists
                name: $('.event-name', eventCard)?.value.trim() || '',
                gender: $('.event-gender', eventCard)?.value || '',
                order: {
                    rule: $('.event-attempt-ordering', eventCard)?.value || '',
                    custom_order: toNumberList($('.event-custom-order', eventCard)?.value || ''),
                    notes: $('.event-order-notes', eventCard)?.value.trim() || ''
                },
                movements: [],
                groups: []
            };

            // Serialize movements
            $$('.movement-card', eventCard).forEach(mCard => {
                const movement = {
                    name: $('.movement-name', mCard)?.value.trim() || '',
                    reps: toNumberList($('.movement-reps', mCard)?.value || ''),
                    scoring: {
                        name: $('.scoring-name', mCard)?.value.trim() || '',
                        type: $('.scoring-type', mCard)?.value || 'max',
                        metric: $('.scoring-metric', mCard)?.value.trim() || ''
                    },
                    timer: {
                        attempt_seconds: Number($('.attempt-time', mCard)?.value || 0) || null,
                        break_seconds: Number($('.break-time', mCard)?.value || 0) || null
                    },
                    metrics: []
                };

                // Serialize metrics
                $$('.metric-row', mCard).forEach(row => {
                    const metric = {
                        name: $('.metric-name', row)?.value.trim() || '',
                        units: $('.metric-units', row)?.value.trim() || ''
                    };
                    if (metric.name) {
                        movement.metrics.push(metric);
                    }
                });

                if (movement.name) {
                    event.movements.push(movement);
                }
            });

            // Serialize groups
            $$('.group-card', eventCard).forEach(gCard => {
                const flightId = gCard.dataset.flightId;
                console.log(`Processing group card with flight ID: ${flightId}`);
                
                const group = {
                    id: flightId ? parseInt(flightId) : undefined,  // Convert to number if exists
                    name: $('.group-name', gCard)?.value.trim() || '',
                    reps_override: toNumberList($('.group-reps', gCard)?.value || ''),
                    order: Number($('.group-order', gCard)?.value || 0) || null,
                    referee: {
                        n: Number($('.ref-n', gCard)?.value || 0) || null,
                        options: serializeRefOptions($('.ref-options', gCard)?.value || ''),
                        notes: $('.ref-notes', gCard)?.value.trim() || ''
                    }
                };
                if (group.name) {
                    event.groups.push(group);
                }
            });

            if (event.name) {
                comp.events.push(event);
            }
        });

        return comp;
    }

    function addEventCard() {
        const frag = document.importNode($('#tpl-event').content, true);
        const card = $('.event-card', frag);

        // Wire event-level buttons
        $('.remove-event', card).addEventListener('click', () => {
            card.remove();
            renderPreview();
        });
        
        $('.add-movement', card).addEventListener('click', () => {
            addMovementCard(card);
            renderPreview();
        });
        
        $('.add-group', card).addEventListener('click', () => {
            addGroupCard(card);
            renderPreview();
        });

        // Input listeners
        $$('input, select, textarea', card).forEach(el => {
            el.addEventListener('input', renderPreview);
        });

        $('#events-container').appendChild(card);
    }

    function addMovementCard(eventCard) {
        const frag = document.importNode($('#tpl-movement').content, true);
        const card = $('.movement-card', frag);
        // Copy movement card logic from competition_create.js
        $('.movements-container', eventCard).appendChild(card);
    }

    function addMetricRow(movementCard) {
        const frag = document.importNode($('#tpl-metric').content, true);
        const row = $('.metric-row', frag);
        // Copy metric row logic from competition_create.js
        $('.metrics-container', movementCard).appendChild(row);
    }

    function addGroupCard(eventCard) {
        const frag = document.importNode($('#tpl-group').content, true);
        const card = $('.group-card', frag);
        // Copy group card logic from competition_create.js
        $('.groups-container', eventCard).appendChild(card);
    }

    function setStatus(msg) {
        const statusMsg = $('#status-msg');
        statusMsg.textContent = msg;
        if (msg) {
            setTimeout(() => { statusMsg.textContent = ''; }, 2000);
        }
    }

    function loadIntoDOM(data) {
        // Clear existing content
        $('#events-container').innerHTML = '';
        
        // Load basic fields
        $('#comp-name').value = data.name || '';
        $('#sport-type').value = data.sport_type || '';
        $('#comp-date').value = data.date || '';
        $('#allow-athlete-input').checked = !!(data.features?.allowAthleteInput);
        $('#allow-coach-assignment').checked = !!(data.features?.allowCoachAssignment);
        $('#enable-attempt-ordering').checked = !!(data.features?.enableAttemptOrdering);

        // Load events
        (data.events || []).forEach(evt => {
            addEventCard();
            const lastEvent = $('#events-container').lastElementChild;
            // Copy event loading logic from competition_create.js
        });

        renderPreview();
    }

    function downloadJSON() {
        const data = serializeFromDOM();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeName = (data.name || 'competition_model').replace(/\s+/g, '_').toLowerCase();
        a.href = url;
        a.download = `${safeName}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Return the public API
    return {
        createEmptyModel,
        serializeFromDOM,
        addEventCard,
        addMovementCard,
        addMetricRow,
        addGroupCard,
        setStatus,
        loadIntoDOM,
        downloadJSON,
        renderPreview
    };
})();