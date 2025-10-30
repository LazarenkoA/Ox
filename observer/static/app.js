
let workers = [];
let testRunning = false;
let testStartTime = null;
let timerInterval = null;
let back_api = "http://localhost:8090/api/v1"

// Initialize the application
function init() {
    getWorkers(() => {
        renderWorkers();
        populateWorkerSelects();
        setupEventListeners();
        updateGlobalMetrics();
        updateGlobalStatus();
        updateTotalCapacity();
    });
}

// Render worker cards
function renderWorkers() {
    const workersGrid = document.getElementById('workersGrid');
    workersGrid.innerHTML = '';

    workers.forEach(worker => {
        const card = createWorkerCard(worker);
        workersGrid.appendChild(card);
    });
}

// Create a worker card element
function createWorkerCard(worker) {
    const card = document.createElement('div');
    card.className = `worker-card status-${worker.status}`;
    card.dataset.workerId = worker.id;

    const statusText = worker?.status?.charAt(0).toUpperCase() + worker?.status?.slice(1);
    const isRunning = worker?.status === 'running';
    const parallelValueClass = worker?.parallel_tests > 500 ? 'parallel-value warning' : 'parallel-value';
    const progressPercent = isRunning && worker?.parallel_tests > 0 ? (worker?.active_parallel / worker?.parallel_tests * 100) : 0;

    card.innerHTML = `
        <div class="worker-header">
            <div class="worker-info">
                <h3>Worker ${worker.id}</h3>
                <div class="worker-ip">${worker.addr}</div>
            </div>
            <div class="worker-status-badge status-${worker?.status}">
                <span class="status-dot status-${worker.status}"></span>
                ${statusText}
            </div>
        </div>
        <div class="worker-details">
            <div class="detail-row">
                <span class="detail-label">Last Heartbeat:</span>
                <span class="detail-value">${worker.last_heartbeat}</span>
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
                <div class="parallel-locked-message">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    Stop worker to adjust settings
                </div>
            ` : ''}
            <div class="parallel-tests-adjuster">
                <button class="parallel-btn" data-action="decrement" data-worker-id="${worker.id}" ${isRunning || !worker.online ? 'disabled' : ''} title="Decrease parallel tests">−</button>
                <div class="${parallelValueClass}" title="Number of concurrent virtual users">${worker.parallel_tests}</div>
                <button class="parallel-btn" data-action="increment" data-worker-id="${worker.id}" ${isRunning || !worker.online ? 'disabled' : ''} title="Increase parallel tests">+</button>
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
            ${isRunning ? `
                <div class="parallel-progress">
                    <div class="parallel-progress-label">
                        <span>Active Virtual Users</span>
                        <span class="parallel-progress-fraction">${worker.active_parallel}/${worker.parallel_tests}</span>
                    </div>
                    <div class="parallel-progress-bar">
                        <div class="parallel-progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                </div>
            ` : ''}
        </div>
        
        <div class="worker-metrics">
            <div class="metric">
                <div class="metric-label">Req/s</div>
                <div class="metric-value">${worker?.metrics?.requests_per_sec}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Avg RT</div>
                <div class="metric-value">${worker?.metrics?.avg_response_time}ms</div>
            </div>
            <div class="metric">
                <div class="metric-label">Errors</div>
                <div class="metric-value">${worker?.metrics?.error_rate}%</div>
            </div>
        </div>
        <div class="worker-controls">
            <button class="btn btn-success btn-small start-worker" data-worker-id="${worker.id}" ${worker.status === 'running' || !worker.online ? 'disabled' : ''}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Start
            </button>
            <button class="btn btn-danger btn-small stop-worker" data-worker-id="${worker.id}" ${worker.status !== 'running' ? 'disabled' : ''}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="6" y="6" width="12" height="12"></rect>
                </svg>
                Stop
            </button>
            <button class="btn btn-secondary btn-small configure-worker" data-worker-id="${worker.id}" ${!worker.online ? 'disabled' : ''}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M12 1v6m0 6v6m-6-6h6m6 0h6"></path>
                </svg>
                Config
            </button>
        </div>
    `;

    return card;
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
        if (!worker.online) {
            option.disabled = true;
            option.textContent += ' - Offline';
        }
        workerSelect.appendChild(option);
    });

    // Populate checkboxes
    workersChecklist.innerHTML = '';
    workers.forEach(worker => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'worker-checkbox';
        checkboxDiv.innerHTML = `
            <input type="checkbox" id="worker-${worker.id}" value="${worker.id}" ${!worker.online ? 'disabled' : ''} class="worker-check">
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
    
    // Config tab switching
    // document.querySelectorAll('.config-tab-btn').forEach(btn => {
    //     btn.addEventListener('click', (e) => switchConfigTab(e.target.dataset.configTab));
    // });
    
    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const presetValue = parseInt(e.currentTarget.dataset.preset);
            applyPreset(presetValue);
        });
    });
    
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

// // Switch config tabs
// function switchConfigTab(tab) {
//     document.querySelectorAll('.config-tab-btn').forEach(btn => btn.classList.remove('active'));
//     document.querySelectorAll('.config-tab-content').forEach(content => content.classList.remove('active'));
//
//     document.querySelector(`[data-config-tab="${tab}"]`).classList.add('active');
//     document.getElementById(`${tab}Tab`).classList.add('active');
// }

// Adjust parallel tests for a worker
function adjustParallelTests(workerId, action) {
    const worker = workers.find(w => w.id === workerId);
    if (!worker || !worker.online || worker.status === 'running') return;
    
    const increment = action === 'increment' ? 1 : -1;
    const newValue = worker.parallel_tests + increment;
    
    if (newValue < 1 || newValue > 1000) {
        showNotification(`Parallel tests must be between 1 and 1000!`, 'error');
        return;
    }
    
    worker.parallel_tests = newValue;
    renderWorkers();
    updateTotalCapacity();
    
    const card = document.querySelector(`[data-worker-id="${workerId}"]`);
    card.style.animation = 'none';
    setTimeout(() => {
        card.style.animation = 'pulse-card 0.3s ease';
    }, 10);
}

// Apply preset to all workers
function applyPreset(value) {
    const onlineWorkers = workers.filter(w => w.online).length;
    
    showModal(
        'Apply Preset',
        `Set ${value} parallel tests for all ${onlineWorkers} online worker(s)?`,
        () => {
            workers.forEach(worker => {
                if (worker.online) {
                    worker.parallel_tests = value;
                }
            });
            renderWorkers();
            updateTotalCapacity();
            showNotification(`Preset applied: ${value} parallel tests per worker`, 'success');
        }
    );
}

// Apply custom value to all workers
function applyToAll() {
    const input = document.getElementById('batchParallelInput');
    const value = parseInt(input.value);
    
    if (isNaN(value) || value < 1 || value > 1000) {
        showNotification('Please enter a value between 1 and 1000!', 'error');
        return;
    }
    
    const onlineWorkers = workers.filter(w => w.online).length;
    
    // showModal(
    //     'Apply to All Workers',
    //     `Set ${value} parallel tests for all ${onlineWorkers} online worker(s)?`,
    //     () => {
    //         workers.forEach(worker => {
    //             if (worker.online) {
    //                 worker.parallel_tests = value;
    //             }
    //         });
    //         renderWorkers();
    //         updateTotalCapacity();
    //         showNotification(`Applied ${value} parallel tests to all online workers`, 'success');
    //     }
    // );

    workers.forEach(worker => {
        if (worker.online) {
            worker.parallel_tests = value;
        }
    });
    renderWorkers();
    //updateTotalCapacity();
    showNotification(`Applied ${value} parallel tests to all online workers`, 'success');
}

// Update total capacity display
// function updateTotalCapacity() {
//     const totalCapacity = workers.reduce((sum, w) => sum + w.parallel_tests, 0);
//     document.getElementById('totalCapacity').textContent = totalCapacity;
// }

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
    startBtn.classList.add('loading');

    setTimeout(() => {
        workers.forEach(worker => {
            if (worker.online && worker.status === 'ready') {
                worker.status = 'running';
                if (worker?.metrics?.requests_per_sec === 0) {
                    worker.metrics.requests_per_sec = Math.floor(Math.random() * 150) + 100;
                    worker.metrics.avg_response_time = Math.floor(Math.random() * 50) + 30;
                    worker.metrics.error_rate = (Math.random() * 1).toFixed(1);
                }
            }
        });

        testRunning = true;
        testStartTime = Date.now();
        startTimer();

        renderWorkers();
        updateGlobalStatus();
        updateGlobalMetrics();
        updateTotalCapacity();

        startBtn.classList.remove('loading');
        stopBtn.disabled = false;

        showNotification('All workers started successfully!', 'success');
    }, 1500);
}

// Stop all workers
function stopAllWorkers() {
    const startBtn = document.getElementById('startAllBtn');
    const stopBtn = document.getElementById('stopAllBtn');

    stopBtn.disabled = true;
    stopBtn.classList.add('loading');

    setTimeout(() => {
        workers.forEach(worker => {
            if (worker.status === 'running') {
                worker.status = 'ready';
            }
        });

        testRunning = false;
        stopTimer();

        renderWorkers();
        updateGlobalStatus();
        updateGlobalMetrics();
        updateTotalCapacity();

        stopBtn.classList.remove('loading');
        startBtn.disabled = false;

        showNotification('All workers stopped!', 'warning');
    }, 1000);
}

// Start individual worker
function startWorker(workerId) {
    const worker = workers.find(w => w.id === workerId);
    if (!worker || !worker.online) return;

    const button = document.querySelector(`.start-worker[data-worker-id="${workerId}"]`);
    button.disabled = true;
    button.classList.add('loading');

    setTimeout(() => {
        worker.status = 'running';
        worker.metrics.requests_per_sec = Math.floor(Math.random() * 150) + 100;
        worker.metrics.avg_response_time = Math.floor(Math.random() * 50) + 30;
        worker.metrics.error_rate = (Math.random() * 1).toFixed(1);
        // Simulate active parallel tests (80-100% of configured)
        worker.active_parallel = Math.floor(worker.parallel_tests * (0.8 + Math.random() * 0.2));

        if (!testRunning) {
            testRunning = true;
            testStartTime = Date.now();
            startTimer();
        }

        renderWorkers();
        updateGlobalStatus();
        updateGlobalMetrics();
        updateTotalCapacity();

        showNotification(`Worker ${workerId} started!`, 'success');
    }, 800);
}

// Stop individual worker
function stopWorker(workerId) {
    const worker = workers.find(w => w.id === workerId);
    if (!worker) return;

    const button = document.querySelector(`.stop-worker[data-worker-id="${workerId}"]`);
    button.disabled = true;
    button.classList.add('loading');

    setTimeout(() => {
        worker.status = 'ready';

        // Check if any workers are still running
        const anyRunning = workers.some(w => w.status === 'running');
        if (!anyRunning) {
            testRunning = false;
            stopTimer();
        }

        renderWorkers();
        updateGlobalStatus();
        updateGlobalMetrics();
        updateTotalCapacity();

        showNotification(`Worker ${workerId} stopped!`, 'warning');
    }, 800);
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

    showNotification(`Ready to configure Worker ${workerId}`, 'info');
}

// Deploy script to individual worker
function deployIndividualScript() {
    const workerSelect = document.getElementById('workerSelect');
    const script = document.getElementById('individualScript').value;
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
    const scriptName = `Script_${Date.now()}`;

    showModal(
        'Deploy Script',
        `Deploy script to Worker ${workerId} (${worker.addr})?`,
        () => {
            worker.script_name = scriptName;
            renderWorkers();
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

    const scriptName = `Batch_Script_${Date.now()}`;
    const workerIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));

    showModal(
        'Deploy Script',
        `Deploy script to ${workerIds.length} worker(s)?`,
        () => {
            workerIds.forEach(id => {
                const worker = workers.find(w => w.id === id);
                if (worker) {
                    worker.script_name = scriptName;
                }
            });
            renderWorkers();
            showNotification(`Script deployed to ${workerIds.length} worker(s)!`, 'success');
        }
    );
}

// Update global status
function updateGlobalStatus() {
    const globalStatus = document.getElementById('globalStatus');
    const runningCount = workers.filter(w => w.status === 'running').length;

    if (testRunning && runningCount > 0) {
        globalStatus.innerHTML = `
            <span class="status-dot status-running"></span>
            <span class="status-text">Test Running (${runningCount} active)</span>
        `;
    } else {
        globalStatus.innerHTML = `
            <span class="status-dot status-ready"></span>
            <span class="status-text">System Ready</span>
        `;
    }

    // Update master buttons
    const hasReadyWorkers = workers.some(w => w.online && w.status === 'ready');
    const hasRunningWorkers = workers.some(w => w.status === 'running');

    document.getElementById('startAllBtn').disabled = !hasReadyWorkers || testRunning;
    document.getElementById('stopAllBtn').disabled = !hasRunningWorkers;
}

// Update global metrics
function updateGlobalMetrics() {
    const runningWorkers = workers.filter(w => w.status === 'running');

    const totalRequests = runningWorkers.reduce((sum, w) => sum + w.metrics.requests_per_sec, 0);
    const avgResponseTime = runningWorkers.length > 0
        ? Math.round(runningWorkers.reduce((sum, w) => sum + w?.metrics?.avg_response_time, 0) / runningWorkers.length)
        : 0;
    const avgErrorRate = runningWorkers.length > 0
        ? (runningWorkers.reduce((sum, w) => sum + parseFloat(w?.metrics?.error_rate), 0) / runningWorkers.length).toFixed(1)
        : 0;

    document.getElementById('totalRequests').textContent = totalRequests;
    document.getElementById('avgResponseTime').textContent = `${avgResponseTime} ms`;
    document.getElementById('errorRate').textContent = `${avgErrorRate}%`;
}

// Timer functions
function startTimer() {
    if (timerInterval) return;

    timerInterval = setInterval(() => {
        if (!testStartTime) return;

        const elapsed = Date.now() - testStartTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);

        const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        document.getElementById('testDuration').textContent = timeString;
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        document.getElementById('testDuration').textContent = '00:00:00';
        testStartTime = null;
    }
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

function request(method) {

}

function getWorkers(f) {
    fetch(`${back_api}/workers`).
        then(resp => resp.json()).
        then(w => { workers.push(...w); f() })
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);