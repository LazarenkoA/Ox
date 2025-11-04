
let workers = [];
let testRunning = false;
let testStartTime = null;
let timerInterval = null;
let back_api = "http://localhost:8091/api/v1"

// Initialize the application
function init() {
    const ws = openWSConn([]);

    getWorkers(() => {
        renderWorkers(ws);
        populateWorkerSelects();
        setupEventListeners();
    });
}

// Render worker cards
function renderWorkers(ws) {
    const workersGrid = document.getElementById('workersGrid');
    workersGrid.innerHTML = '';

    workers.forEach(worker => {
        const card = createWorkerCard(worker, ws);
        workersGrid.appendChild(card);

        updateWorkerStatus(worker)
        updateButton(worker)
        updateLastHeartbeat(worker)
    });
}

// Create a worker card element
function createWorkerCard(worker, ws) {
    const card = document.createElement('div');
    card.className = `worker-card status-${worker.status}`;
    card.dataset.workerId = worker.id;

    const isRunning = worker?.status === 'running';
    const parallelValueClass = worker?.parallel_tests > 500 ? 'parallel-value warning' : 'parallel-value';

    card.innerHTML = `
        <div class="worker-header">
            <div class="worker-info">
                <h3>Worker ${worker.id}</h3>
                <div class="worker-ip">${worker.addr}</div>
            </div>
            <div id="worker-state-${worker.id}" class="worker-status-badge status-${worker.status}">
                <span class="status-dot status-${worker.status}"></span>
                ${worker.status}
            </div>
        </div>
        <div class="worker-details">
            <div class="detail-row">
                <span class="detail-label">Last Heartbeat:</span>
                <span class="detail-value" id="last_heartbeat-${worker.id}"></span>
            </div>
        </div>
        
        <!-- Parallel Tests Control -->
        <div class="parallel-tests-control">
            <div class="parallel-tests-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="4" y1="6" x2="20" y2="6"></line>
                    <line x1="4" y1="12" x2="20" y2="12"></line>
                    <line x1="4" y1="18" x2="20" y2="18"></line>
                </svg>
                Parallel Tests
            </div>
            ${isRunning ? `
<!--                <div class="parallel-locked-message">-->
<!--                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">-->
<!--                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>-->
<!--                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>-->
<!--                    </svg>-->
<!--                    Stop worker to adjust settings-->
<!--                </div>-->
            ` : ''}
            <div class="parallel-tests-adjuster">
                <button class="parallel-btn" data-action="decrement" data-worker-id="${worker.id}" ${isRunning  ? 'disabled' : ''} title="Decrease parallel tests">−</button>
                <div id="parallel_tests-${worker.id}" class="${parallelValueClass}" title="Number of concurrent virtual users">${worker.parallel_tests}</div>
                <button class="parallel-btn" data-action="increment" data-worker-id="${worker.id}" ${isRunning ? 'disabled' : ''} title="Increase parallel tests">+</button>
            </div>
            ${worker.parallel_tests > 500 ? `
                <div class="high-load-warning">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    High load warning
                </div>
            ` : ''}
        </div>
        
        <div class="worker-controls">
            <button id="button-start-${worker.id}" class="btn btn-success btn-small start-worker" data-worker-id="${worker.id}" } disabled>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Start
            </button>
            <button id="button-stop-${worker.id}" class="btn btn-danger btn-small stop-worker" data-worker-id="${worker.id}" } disabled>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="6" y="6" width="12" height="12"></rect>
                </svg>
                Stop
            </button>
            <button id="button-config-${worker.id}" class="btn btn-secondary btn-small configure-worker" data-worker-id="${worker.id}" } disabled>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M12 1v6m0 6v6m-6-6h6m6 0h6"></path>
                </svg>
                Config
            </button>
        </div>
    `;

    // подписываемся на сообщение в ws по текущему воркеру
    if (ws !== undefined) {
        ws((m) => {
            if (m?.id === worker.id) {
                updateWorkerStatus(m)
                updateButton(m)
                updateLastHeartbeat(m)
            }
        })
    }

    return card;
}

function updateLastHeartbeat(worker) {
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');

    const lastHeartbeat = document.getElementById(`last_heartbeat-${worker.id}`);
    if (lastHeartbeat) {
        lastHeartbeat.textContent = `${pad(now.getDate())}-${pad(now.getMonth())}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`
    }
}

function updateButton(worker) {
    const buttonConfig = document.getElementById(`button-config-${worker.id}`);
    const buttonStop = document.getElementById(`button-stop-${worker.id}`);
    const buttonStart = document.getElementById(`button-start-${worker.id}`);

    if (buttonConfig) {
        buttonConfig.disabled =  worker.status !== "ready" &&  worker.status !== "error"
    }
    if (buttonStop) {
        buttonStop.disabled =   worker.status !== "running"
    }
    if (buttonStart) {
        buttonStart.disabled =  worker.status !== "ready" &&  worker.status !== "error"
    }

    // глобальные кнопки
    const allStart = document.getElementById(`startAllBtn`);
    const allStop = document.getElementById(`stopAllBtn`);
    if(allStart) {
        allStart.disabled = !workers.some(w => w.status === "ready" || w.status === "error")
    }
    if(allStop) {
        allStop.disabled = !workers.some(w => w.status === "running")
    }
}

function updateWorkerStatus(worker) {
    const workerElem = document.getElementById(`worker-state-${worker.id}`);
    if (workerElem) {
        workerElem.textContent = worker.status;
        workerElem.className = `worker-status-badge status-${worker.status}`

        const span = document.createElement('span');
        span.className = `status-dot status-${worker.status}`;
        workerElem.prepend(span);

        document.querySelectorAll(`div[class^="worker-card"][data-worker-id="${worker.id}"]`).forEach(e => {
            e.setAttribute('class', '');
            e.classList.add(`worker-card`);
            e.classList.add(`status-${worker.status}`);
        })


        workers.forEach(w => {
            if (w.id === worker.id) {
                w.status = worker.status
            }
        } )
    }
}

// Populate worker selects and checkboxes
function populateWorkerSelects() {
    const workerSelect = document.getElementById('workerSelect');
    const workersChecklist = document.getElementById('workersChecklist');

    // Populate select dropdown
    workerSelect.innerHTML = '<option value="">Choose a worker...</option>';
    workers.forEach(worker => {
        const option = document.createElement('option');
        option.value = worker.id;
        option.textContent = `Worker ${worker.id} (${worker.addr})`;
        workerSelect.appendChild(option);
    });

    // Populate checkboxes
    workersChecklist.innerHTML = '';
    workers.forEach(worker => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'worker-checkbox';
        checkboxDiv.innerHTML = `
            <input type="checkbox" id="worker-${worker.id}" value="${worker.id}" ${worker.status === "ready" ?  '':'disabled'} class="worker-check">
            <label for="worker-${worker.id}">Worker ${worker.id} (${worker.addr})</label>
        `;
        workersChecklist.appendChild(checkboxDiv);
    });
}

// Setup event listeners
function setupEventListeners() {
    // Master control buttons
    document.getElementById('startAllBtn').addEventListener('click', startAllWorkers);
    document.getElementById('stopAllBtn').addEventListener('click', stopAllWorkers);

    // Script section toggle
    document.getElementById('scriptSectionHeader').addEventListener('click', toggleScriptSection);
    
    // Parallel config section toggle
    document.getElementById('parallelConfigHeader').addEventListener('click', toggleParallelConfigSection);

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });

    // // Preset buttons
    // document.querySelectorAll('.preset-btn').forEach(btn => {
    //     btn.addEventListener('click', (e) => {
    //         const presetValue = parseInt(e.currentTarget.dataset.preset);
    //     });
    // });
    //
    // Apply to all button
    document.getElementById('applyToAllBtn').addEventListener('click', applyToAll);
    
    // Parallel test adjustment buttons (using event delegation)
    document.getElementById('workersGrid').addEventListener('click', (e) => {
        const parallelBtn = e.target.closest('.parallel-btn');
        if (parallelBtn && !parallelBtn.disabled) {
            const workerId = parseInt(parallelBtn.dataset.workerId);
            const action = parallelBtn.dataset.action;
            adjustParallelTests(workerId, action);
        }
    });

    // Deploy buttons
    document.getElementById('deployIndividualBtn').addEventListener('click', deployIndividualScript);
    document.getElementById('deployBatchBtn').addEventListener('click', deployBatchScript);

    // Select all checkbox
    document.getElementById('selectAllWorkers').addEventListener('change', (e) => {
        document.querySelectorAll('.worker-check').forEach(checkbox => {
            if (!checkbox.disabled) {
                checkbox.checked = e.target.checked;
            }
        });
    });

    // Modal controls
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalCancel').addEventListener('click', closeModal);

    // Worker control buttons (using event delegation)
    document.getElementById('workersGrid').addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const workerId = parseInt(button.dataset.workerId);
        if (button.classList.contains('start-worker')) {
            startWorker(workerId);
        } else if (button.classList.contains('stop-worker')) {
            stopWorker(workerId);
        } else if (button.classList.contains('configure-worker')) {
            configureWorker(workerId);
        }
    });
}

// Toggle script section
function toggleScriptSection() {
    const content = document.getElementById('scriptContent');
    const toggleBtn = document.getElementById('toggleScriptSection');
    content.classList.toggle('collapsed');
    toggleBtn.classList.toggle('collapsed');
}

// Toggle parallel config section
function toggleParallelConfigSection() {
    const content = document.getElementById('parallelConfigContent');
    const toggleBtn = document.getElementById('toggleParallelConfig');
    content.classList.toggle('collapsed');
    toggleBtn.classList.toggle('collapsed');
}

// Adjust parallel tests for a worker
function adjustParallelTests(workerId, action) {
    const worker = workers.find(w => w.id === workerId);
    if (!worker || worker.status !== 'ready') return;
    
    const increment = action === 'increment' ? 1 : -1;
    const newValue = worker.parallel_tests + increment;
    
    if (newValue < 1 || newValue > 1000) {
        showNotification(`Parallel tests must be between 1 and 1000!`, 'error');
        return;
    }
    
    worker.parallel_tests = newValue;
    const elem = document.getElementById(`parallel_tests-${worker.id}`);
    if (elem) elem.textContent = newValue

    const card = document.querySelector(`[data-worker-id="${workerId}"]`);
    card.style.animation = 'none';
    setTimeout(() => {
        card.style.animation = 'pulse-card 0.3s ease';
    }, 10);
}

// Apply custom value to all workers
function applyToAll() {
    const input = document.getElementById('batchParallelInput');
    const value = parseInt(input.value);
    
    if (isNaN(value) || value < 1 || value > 1000) {
        showNotification('Please enter a value between 1 and 1000!', 'error');
        return;
    }

    workers.forEach(worker => {
        if (worker.status === "ready") {
            worker.parallel_tests = value;
        }
    });
    renderWorkers();
    showNotification(`Applied ${value} parallel tests to all online workers`, 'success');
}

// Switch tabs
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}Tab`).classList.add('active');
}

// Start all workers
function startAllWorkers() {
    const startBtn = document.getElementById('startAllBtn');
    const stopBtn = document.getElementById('stopAllBtn');

    startBtn.disabled = true;

    workers.forEach(worker => {
        if (worker.status === 'ready' || worker.status === 'error') {
            startWorker(worker.id)
        }
    });
    showNotification('All workers started successfully!', 'success');
}

// Stop all workers
function stopAllWorkers() {
   //const startBtn = document.getElementById('startAllBtn');
    const stopBtn = document.getElementById('stopAllBtn');

    stopBtn.disabled = true;

    workers.forEach(worker => {
        if (worker.status === 'running') {
            stopWorker(worker.id)
        }
    });
    showNotification('All workers stopped!', 'warning');
}

// Start individual worker
function startWorker(workerId) {
    const worker = workers.find(w => w.id === workerId);
    if (!worker) return;

    const buttonStart = document.getElementById(`button-start-${worker.id}`);
    buttonStart.disabled = true

    fetch(`${back_api}/workers/${workerId}/start?testCount=${worker.parallel_tests}`).then(r => buttonStart.disabled = false )
}

// Stop individual worker
function stopWorker(workerId) {
    const worker = workers.find(w => w.id === workerId);
    if (!worker) return;

    fetch(`${back_api}/workers/${workerId}/stop`).then(r => {} )
}

// Configure worker
function configureWorker(workerId) {
    const worker = workers.find(w => w.id === workerId);
    if (!worker) return;

    // Switch to individual tab and select the worker
    switchTab('individual');
    document.getElementById('workerSelect').value = workerId;

    // Scroll to script section
    document.getElementById('scriptSectionHeader').scrollIntoView({ behavior: 'smooth' });

    // Expand script section if collapsed
    const content = document.getElementById('scriptContent');
    if (content.classList.contains('collapsed')) {
        toggleScriptSection();
    }

    const scriptElem = document.getElementById('individualScript');
    if(scriptElem) scriptElem.textContent = worker.script;

    showNotification(`Ready to configure Worker ${workerId}`, 'info');
}

// Deploy script to individual worker
function deployIndividualScript() {
    const workerSelect = document.getElementById('workerSelect');
    const script = document.getElementById('individualScript')?.value;
    const workerId = parseInt(workerSelect.value);

    if (!workerId) {
        showNotification('Please select a worker first!', 'error');
        return;
    }

    if (!script.trim()) {
        showNotification('Please enter a script!', 'error');
        return;
    }

    const worker = workers.find(w => w.id === workerId);

    showModal('Deploy Script',
        `Deploy script to Worker ${workerId} (${worker.addr})?`,
        () => {
            worker.script = script;
            setScript(worker.id, script);
            showNotification(`Script deployed to Worker ${workerId}!`, 'success');
        }
    );
}

// Deploy script to multiple workers
function deployBatchScript() {
    const script = document.getElementById('batchScript').value;
    const selectedCheckboxes = document.querySelectorAll('.worker-check:checked');

    if (selectedCheckboxes.length === 0) {
        showNotification('Please select at least one worker!', 'error');
        return;
    }

    if (!script.trim()) {
        showNotification('Please enter a script!', 'error');
        return;
    }

    const workerIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));

    showModal('Deploy Script',`Deploy script to ${workerIds.length} worker(s)?`, () => {
        workers.forEach(w => {
            if(workerIds.some(id => w.id === id)) {
                w.script = script;
                setScript(w.id, script)
            }
        })
    });

    showNotification(`Script deployed to ${workerIds.length} worker(s)!`, 'success');
}

// Modal functions
function showModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').textContent = message;

    const confirmBtn = document.getElementById('modalConfirm');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', () => {
        onConfirm();
        closeModal();
    });

    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('confirmModal').classList.remove('active');
}

// Notification function
function showNotification(message, type) {
    console.log(`[${type.toUpperCase()}] ${message}`);
}

function getWorkers(f) {
    fetch(`${back_api}/workers`).
        then(resp => resp.json()).
        then(w => { workers.push(...w); f() })
}

function openWSConn(listeners) {
    const ws = new WebSocket(`${back_api}/ws`);

    ws.onopen = () => {
        console.log("✅ WS connected");

        // запускаем keepalive
        let heartbeatRef = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "ping" }));
                return
            }

            if (ws.readyState === WebSocket.CLOSED) {
                console.log("🔌 write to closed WS");
                clearInterval(heartbeatRef); // очистим старый
                setTimeout(() => openWSConn(listeners), 100)
            }
        }, 5_000); // каждые 5 сек
    };

    ws.onmessage = (event) => {
        try {
            listeners.forEach((h) => h(JSON.parse(event.data))); // уведомляем подписчиков
        } catch (e) {
            console.error("Invalid WS message");
        }
    };

    ws.onerror = (err) => {
        setTimeout(() => openWSConn(listeners), 5_000)
        console.error("❌ WS error", err);
    };

    return (f) => {
        listeners.push(f)
    }
}

function setScript(workerId, script) {
    fetch(`${back_api}/workers/${workerId}/set_script`, {
        method: 'POST',
        body: script
    }).then(w => {})
}


// Initialize on page load
document.addEventListener('DOMContentLoaded', init);