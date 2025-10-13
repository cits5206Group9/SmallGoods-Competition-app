(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  // Root UI elements
  const compNameEl = $('#comp-name');
  const compDateEl = $('#comp-date');
  const breaktimeEventsEl = $('#breaktime-events');
  const breaktimeFlightsEl = $('#breaktime-flights');
  const allowAthleteInputEl = $('#allow-athlete-input');
  const allowCoachAssignmentEl = $('#allow-coach-assignment');
  const enableAttemptOrderingEl = $('#enable-attempt-ordering');

  const eventsContainer = $('#events-container');
  const addEventBtn = $('#add-event-btn');

  const jsonPreview = $('#json-preview');
  const statusMsg = $('#status-msg');

  const saveLocalBtn = $('#save-local-btn');
  const loadLocalBtn = $('#load-local-btn');
  const downloadJsonBtn = $('#download-json-btn');
  const clearAllBtn = $('#clear-all-btn');

  // Templates
  const tplEvent = $('#tpl-event');
  const tplMovement = $('#tpl-movement');
  const tplMetric = $('#tpl-metric');
  const tplGroup = $('#tpl-group');

  // In-memory model state
  let model = createEmptyModel();

  function createEmptyModel() {
    return {
      name: '',
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
    jsonPreview.textContent = JSON.stringify(normalized, null, 2);
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
    // Each line: label,color,value
    if (!text) return [];
    return text.split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const [label, color, valueRaw] = line.split(',').map(s => (s || '').trim());
        const value = (valueRaw || '').toLowerCase();
        // parse boolean if possible, else keep as string
        let parsedValue = value;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        return { label, color, value: parsedValue };
      });
  }

  function serializeFromDOM() {
    const comp = {
      name: compNameEl.value.trim(),
      comp_date: compDateEl.value,
      breaktime_between_events: Number(breaktimeEventsEl.value) || 600,
      breaktime_between_flights: Number(breaktimeFlightsEl.value) || 180,
      features: {
        allowAthleteInput: !!allowAthleteInputEl.checked,
        allowCoachAssignment: !!allowCoachAssignmentEl.checked,
        enableAttemptOrdering: !!enableAttemptOrderingEl.checked
      },
      // SG-DSL-like structure
      events: []
    };

    $$('.event-card', eventsContainer).forEach(eventCard => {
      const event = {
        name: $('.event-name', eventCard)?.value.trim() || '',
        sport_type: $('.event-sport-type', eventCard)?.value || '',
        gender: $('.event-gender', eventCard)?.value || '',
        order: {
          rule: $('.event-attempt-ordering', eventCard)?.value || '',
          custom_order: toNumberList($('.event-custom-order', eventCard)?.value || ''),
          notes: $('.event-order-notes', eventCard)?.value.trim() || ''
        },
        movements: [],
        groups: []
      };

      // Movements / Lifts
      $$('.movement-card', eventCard).forEach(mCard => {
        const metrics = $$('.metric-row', mCard).map(row => ({
          name: $('.metric-name', row)?.value.trim() || '',
          units: $('.metric-units', row)?.value.trim() || ''
        })).filter(m => m.name);

        const movement = {
          name: $('.movement-name', mCard)?.value.trim() || '',
          reps: toNumberList($('.movement-reps', mCard)?.value || ''),
          scoring: {
            name: $('.scoring-name', mCard)?.value.trim() || '',
            type: $('.scoring-type', mCard)?.value || 'max',
            metric: $('.scoring-metric', mCard)?.value.trim() || ''
          },
          timer: {
            attempt_seconds: Number($('.attempt-time', mCard)?.value || 0) || null
          },
          metrics
        };
        if (movement.name) {
          event.movements.push(movement);
        }
      });

      // Groups / Flights
      $$('.group-card', eventCard).forEach(gCard => {
        const group = {
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
    const frag = document.importNode(tplEvent.content, true);
    const card = $('.event-card', frag);

    // Wire event-level buttons
    $('.remove-event', card).addEventListener('click', () => {
      card.remove();
      renderPreview();
      setStatus('Event removed');
    });
    $('.add-movement', card).addEventListener('click', () => {
      addMovementCard(card);
      renderPreview();
    });
    $('.add-group', card).addEventListener('click', () => {
      addGroupCard(card);
      renderPreview();
    });

    // Input listeners to update preview
    $$('input, select, textarea', card).forEach(el => {
      el.addEventListener('input', renderPreview);
    });

    eventsContainer.appendChild(card);
  }

  function addMovementCard(eventCard) {
    const frag = document.importNode(tplMovement.content, true);
    const card = $('.movement-card', frag);

    // Wire buttons
    $('.remove-movement', card).addEventListener('click', () => {
      card.remove();
      renderPreview();
      setStatus('Movement removed');
    });
    $('.add-metric', card).addEventListener('click', () => {
      addMetricRow(card);
      renderPreview();
    });

    $('.scoring-type', card).addEventListener('change', (e) => {
      const allowed = ['max', 'sum', 'min'];
      if (!allowed.includes(e.target.value)) {
        e.target.value = 'max';
      }
      renderPreview();
    });

    // Input listeners
    $$('input, select, textarea', card).forEach(el => {
      el.addEventListener('input', renderPreview);
    });

    $('.movements-container', eventCard).appendChild(card);
  }

  function addMetricRow(movementCard) {
    const frag = document.importNode(tplMetric.content, true);
    const row = $('.metric-row', frag);
    $('.remove-metric', row).addEventListener('click', () => {
      row.remove();
      renderPreview();
      setStatus('Metric removed');
    });
    $$('input', row).forEach(el => el.addEventListener('input', renderPreview));
    $('.metrics-container', movementCard).appendChild(row);
  }

  function addGroupCard(eventCard) {
    const frag = document.importNode(tplGroup.content, true);
    const card = $('.group-card', frag);

    // Wire buttons
    $('.remove-group', card).addEventListener('click', () => {
      card.remove();
      renderPreview();
      setStatus('Group removed');
    });

    $$('input, select, textarea', card).forEach(el => {
      el.addEventListener('input', renderPreview);
    });

    $('.groups-container', eventCard).appendChild(card);
  }

  function setStatus(msg) {
    statusMsg.textContent = msg;
    if (msg) {
      setTimeout(() => { statusMsg.textContent = ''; }, 2000);
    }
  }

  function saveToLocal() {
    const data = serializeFromDOM();
    localStorage.setItem('sg_competition_model', JSON.stringify(data));
    setStatus('Saved locally');
  }

  function loadFromLocal() {
    const raw = localStorage.getItem('sg_competition_model');
    if (!raw) {
      setStatus('No saved data');
      return;
    }
    const data = JSON.parse(raw);
    loadIntoDOM(data);
    setStatus('Loaded from browser');
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

  function clearAll() {
    // Reset DOM
    compNameEl.value = '';
    compDateEl.value = '';
    breaktimeEventsEl.value = 600;
    breaktimeFlightsEl.value = 180;
    allowAthleteInputEl.checked = true;
    allowCoachAssignmentEl.checked = true;
    enableAttemptOrderingEl.checked = true;
    eventsContainer.innerHTML = '';
    model = createEmptyModel();
    renderPreview();
    setStatus('Cleared');
  }

  function loadIntoDOM(data) {
    clearAll();

    compNameEl.value = data.name || '';
    compDateEl.value = data.comp_date || '';
    breaktimeEventsEl.value = data.breaktime_between_events || 600;
    breaktimeFlightsEl.value = data.breaktime_between_flights || 180;
    allowAthleteInputEl.checked = !!(data.features?.allowAthleteInput);
    allowCoachAssignmentEl.checked = !!(data.features?.allowCoachAssignment);
    enableAttemptOrderingEl.checked = !!(data.features?.enableAttemptOrdering);

    (data.events || []).forEach(evt => {
      addEventCard();
      const lastEvent = eventsContainer.lastElementChild;

      $('.event-name', lastEvent).value = evt.name || '';
      $('.event-sport-type', lastEvent).value = evt.sport_type || '';
      $('.event-gender', lastEvent).value = evt.gender || '';
      $('.event-attempt-ordering', lastEvent).value = evt.order?.rule || '';
      $('.event-custom-order', lastEvent).value = (evt.order?.custom_order || []).join(',');
      $('.event-order-notes', lastEvent).value = evt.order?.notes || '';

      (evt.movements || []).forEach(mov => {
        addMovementCard(lastEvent);
        const lastMovement = $$('.movement-card', lastEvent).slice(-1)[0];

        $('.movement-name', lastMovement).value = mov.name || '';
        $('.movement-reps', lastMovement).value = (mov.reps || []).join(',');
        $('.scoring-name', lastMovement).value = mov.scoring?.name || '';
        $('.scoring-type', lastMovement).value = mov.scoring?.type || 'max';
        $('.scoring-metric', lastMovement).value = mov.scoring?.metric || '';
        $('.attempt-time', lastMovement).value = mov.timer?.attempt_seconds || '';

        (mov.metrics || []).forEach(metric => {
          addMetricRow(lastMovement);
          const lastMetric = $$('.metric-row', lastMovement).slice(-1)[0];
          $('.metric-name', lastMetric).value = metric.name || '';
          $('.metric-units', lastMetric).value = metric.units || '';
        });
      });

      (evt.groups || []).forEach(grp => {
        addGroupCard(lastEvent);
        const lastGroup = $$('.group-card', lastEvent).slice(-1)[0];
        $('.group-name', lastGroup).value = grp.name || '';
        $('.group-reps', lastGroup).value = (grp.reps_override || []).join(',');
        $('.group-order', lastGroup).value = grp.order || '';
        $('.ref-n', lastGroup).value = grp.referee?.n || '';
        const refLines = (grp.referee?.options || [])
          .map(o => [o.label || '', o.color || '', String(o.value)].join(','))
          .join('\n');
        $('.ref-options', lastGroup).value = refLines;
        $('.ref-notes', lastGroup).value = grp.referee?.notes || '';
      });
    });

    renderPreview();
  }

  // Event wiring
  addEventBtn.addEventListener('click', () => {
    addEventCard();
    renderPreview();
    setStatus('Event added');
  });

  // Top-level inputs update preview
  [compNameEl, compDateEl, allowAthleteInputEl, allowCoachAssignmentEl, enableAttemptOrderingEl]
    .forEach(el => el.addEventListener('input', renderPreview));

  saveLocalBtn.addEventListener('click', saveToLocal);
  loadLocalBtn.addEventListener('click', loadFromLocal);
  downloadJsonBtn.addEventListener('click', downloadJSON);
  clearAllBtn.addEventListener('click', clearAll);
  $('#save-db-btn').addEventListener('click', saveToDatabase);
  
  async function saveToDatabase() {
    try {
        const model = serializeFromDOM();
        console.log('=== Saving Competition Model ===');
        console.log('Total events in model:', model.events.length);
        console.log('Events:', model.events.map(e => ({ name: e.name, sport_type: e.sport_type })));
        
        const response = await fetch('/admin/competition-model/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(model)
        });

        const result = await response.json();
        
        if (result.status === 'success') {
            setStatus(`Saved to database! ID: ${result.competition_id}, Events: ${result.events_created + result.events_updated}`);
            console.log('Save result:', result);
            // Save to local storage as backup
            localStorage.setItem('competition_model', JSON.stringify(model));
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Save error:', error);
        setStatus(`Error: ${error.message}`);
    }
}

  // Initialize preview on first load
  renderPreview();

  // Optional: expose for debugging
  window._sg_model = () => serializeFromDOM();
})();