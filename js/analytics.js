// Use shared state from common.js where applicable
// Only declare unique local state here
let allTasks = {};
let selectedSprint = localStorage.getItem('tt_sprint') || 'All';
let selectedChartSprint = 'All'; // Chart always defaults to 'All' on load as requested

function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return (s[(v - 20) % 10] || s[v] || s[0]);
}

function initAnalytics() {
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.innerText = "Connecting to Trace...";

    setupHeader('analytics-view');
    selectedProjId = localStorage.getItem('tt_project');

    if (!selectedProjId) {
        window.location.href = "../index.html";
        return;
    }

    // Force reveal after 2 seconds no matter what
    setTimeout(hideLoader, 2000);

    // 1. Load project data
    if (loadingText) loadingText.innerText = "Fetching Project Data...";
    database.ref(`projects/${selectedProjId}`).once('value').then(snap => {
        const project = snap.val();
        if (project) {
            document.getElementById('project-title').innerText = `${project.name} Analytics`;
            applyProjectTheme(project);
            if (loadingText) loadingText.innerText = "Fetching Team...";
        } else {
            window.location.href = "../index.html";
        }
    }).catch(err => {
        console.error("Project Fetch Error:", err);
        hideLoader();
    });

    // 2. Real-time listener for members
    database.ref(`projects/${selectedProjId}/members`).on('value', snap => {
        currentMembers = snap.val() || {};
        checkAndRefresh();
        if (loadingText) loadingText.innerText = "Analyzing Main Tasks...";
        hideLoader();
    });

    // 3. Real-time listener for tasks
    database.ref(`projects/${selectedProjId}/tasks`).on('value', snap => {
        allTasks = snap.val() || {};
        checkAndRefresh();
        hideLoader();
    });

    // 4. Real-time listener for sprints
    database.ref(`projects/${selectedProjId}/sprints`).on('value', snap => {
        currentSprints = snap.val() || {};
        checkAndRefresh();
        hideLoader();
    });
}

function checkAndRefresh() {
    // If we have members, we can at least show the chart (even if empty)
    if (Object.keys(currentMembers).length >= 0) {
        populateSprintSelector();
        populateChartSprintSelector(); // Refresh both selectors
    }
}

function populateSprintSelector() {
    const menu = document.getElementById('sprint-menu');
    const text = document.getElementById('selected-sprint-text');
    if (!menu) return;

    const sprintSet = new Set();

    // Add explicitly defined sprints
    Object.keys(currentSprints || {}).forEach(k => sprintSet.add(k));

    // Add sprints mentioned in tasks
    Object.values(allTasks).forEach(t => {
        if (t.sprintName) sprintSet.add(t.sprintName);
    });

    const sprintList = Array.from(sprintSet).sort((a, b) => {
        const na = parseInt(a), nb = parseInt(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return String(a).localeCompare(String(b));
    });

    if (sprintList.length === 0) {
        menu.innerHTML = '<p class="text-[10px] font-black uppercase text-gray-500 text-center py-4">No Sprints</p>';
        text.innerText = 'No Sprints';
        renderEmptyState();
        return;
    }

    let menuHTML = `
        <div class="dropdown-item group/item ${selectedSprint === 'All' ? 'selected' : ''}" onclick="selectSprint('All')">
            <div class="flex items-center">
                <div class="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center mr-3 group-hover/item:bg-accent-purple/20 transition-colors">
                    <i data-lucide="layers" class="w-3.5 h-3.5 text-gray-500 group-hover/item:text-accent-purple"></i>
                </div>
                <span class="text-[10px] font-bold uppercase tracking-wider">All Main Tasks</span>
            </div>
            ${selectedSprint === 'All' ? '<i data-lucide="check" class="w-3.5 h-3.5 text-accent-purple"></i>' : ''}
        </div>
        <div class="h-[1px] bg-white/5 my-2 mx-2"></div>
    `;

    menuHTML += sprintList.map(s => {
        const num = parseInt(s);
        const label = !isNaN(num) ? `${num}${getOrdinal(num)} Sprint` : s;
        return `
            <div class="dropdown-item group/item ${s === selectedSprint ? 'selected' : ''}" onclick="selectSprint('${s}')">
                <div class="flex items-center">
                    <div class="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center mr-3 group-hover/item:bg-cyan-500/20 transition-colors">
                        <i data-lucide="zap" class="w-3.5 h-3.5 text-gray-500 group-hover/item:text-cyan-400"></i>
                    </div>
                    <span class="text-[10px] font-bold uppercase tracking-wider">${label}</span>
                </div>
                ${s === selectedSprint ? '<i data-lucide="check" class="w-3.5 h-3.5 text-cyan-400"></i>' : ''}
            </div>
        `;
    }).join('');

    menu.innerHTML = menuHTML;

    if (selectedSprint === 'All') {
        text.innerText = 'All Main Tasks';
    } else {
        const activeNum = parseInt(selectedSprint);
        text.innerText = !isNaN(activeNum) ? `${activeNum}${getOrdinal(activeNum)} Sprint` : selectedSprint;
    }

    refreshIcons();
    updateAnalytics();
}

function toggleSprintDropdown(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('sprint-selector-dropdown');
    if (dropdown) dropdown.classList.toggle('active');
}

function selectSprint(sprint) {
    selectedSprint = sprint;
    localStorage.setItem('tt_sprint', sprint);
    const dropdown = document.getElementById('sprint-selector-dropdown');
    if (dropdown) dropdown.classList.remove('active');

    populateSprintSelector();
}

// --- Independent Chart Sprint Logic ---
function toggleChartSprintDropdown(e) {
    e.stopPropagation();
    document.getElementById('chart-sprint-selector-dropdown').classList.toggle('active');
}

function selectChartSprint(sprint) {
    selectedChartSprint = sprint;
    const dropdown = document.getElementById('chart-sprint-selector-dropdown');
    if (dropdown) dropdown.classList.remove('active');
    populateChartSprintSelector();
    updateAnalytics(); // Re-render with new filter
}

function populateChartSprintSelector() {
    const menu = document.getElementById('chart-sprint-menu');
    const text = document.getElementById('chart-selected-sprint-text');
    if (!menu) return;

    const sprintSet = new Set();
    Object.keys(currentSprints || {}).forEach(k => sprintSet.add(k));
    Object.values(allTasks).forEach(t => { if (t.sprintName) sprintSet.add(t.sprintName); });

    const sprintList = Array.from(sprintSet).sort((a, b) => {
        const na = parseInt(a), nb = parseInt(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return String(a).localeCompare(String(b));
    });

    let menuHTML = `
        <div class="dropdown-item group/item ${selectedChartSprint === 'All' ? 'selected' : ''}" onclick="selectChartSprint('All')">
            <span class="text-[10px] font-black uppercase tracking-wider">All Sprints</span>
            ${selectedChartSprint === 'All' ? '<i data-lucide="check" class="w-3.5 h-3.5 text-accent-purple"></i>' : ''}
        </div>
    `;

    sprintList.forEach(s => {
        const isSelected = selectedChartSprint === s;
        const displayLabel = isNaN(parseInt(s)) ? s : `Sprint ${s}`;
        menuHTML += `
            <div class="dropdown-item group/item ${isSelected ? 'selected' : ''}" onclick="selectChartSprint('${s}')">
                <span class="text-[10px] font-black uppercase tracking-wider">${displayLabel}</span>
                ${isSelected ? '<i data-lucide="check" class="w-3.5 h-3.5 text-accent-purple"></i>' : ''}
            </div>
        `;
    });

    menu.innerHTML = menuHTML;
    text.innerText = selectedChartSprint === 'All' ? 'All Sprints' : 
                   (isNaN(parseInt(selectedChartSprint)) ? selectedChartSprint : `Sprint ${selectedChartSprint}`);
    
    refreshIcons();
}

function updateAnalytics() {
    if (!selectedSprint) return;

    // 1. Stats Filter (Main Dropdown)
    const sprintTasks = selectedSprint === 'All'
        ? Object.values(allTasks)
        : Object.values(allTasks).filter(t => t.sprintName === selectedSprint);
    
    // 2. Chart Filter (Independent Dropdown)
    const chartTasks = selectedChartSprint === 'All'
        ? Object.values(allTasks)
        : Object.values(allTasks).filter(t => t.sprintName === selectedChartSprint);
    
    // Mission Count (for Stats)
    const totalMissions = sprintTasks.length;
    const doneMissions = sprintTasks.filter(t => t.status === 'Done').length;
    
    // Subtask Count (for Stats)
    let totalSubtasks = 0;
    let doneSubtasks = 0;
    
    sprintTasks.forEach(t => {
        const subtasks = t.subTasks || [];
        if (subtasks.length > 0) {
            totalSubtasks += subtasks.length;
            doneSubtasks += subtasks.filter(st => {
                const isDone = st && (st.status === 'Done' || st.completed === true);
                return isDone;
            }).length;
        }
    });

    const velocity = totalMissions > 0 ? Math.round((doneMissions / totalMissions) * 100) : 0;

    // High Level Stats update
    animateValue('stat-total', parseInt(document.getElementById('stat-total').innerText) || 0, totalMissions, 1000);
    animateValue('stat-done', parseInt(document.getElementById('stat-done').innerText) || 0, doneMissions, 1000);
    document.getElementById('stat-velocity').innerText = `${velocity}%`;

    // Render Displays
    renderPerformanceChart(chartTasks); // Use independent chart tasks!
    renderStatusDistribution(sprintTasks); // Use stats tasks!
}

let performanceChart = null;

function renderPerformanceChart(tasks) {
    const ctx = document.getElementById('performanceChart').getContext('2d');

    if (tasks.length === 0) {
        if (performanceChart) performanceChart.destroy();
        return;
    }

    // --- DATA PROCESSING FOR PERFORMANCE ---
    // 1. Determine Date Range
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all completion/update dates to find the range of activity
    const activityDates = [];
    tasks.forEach(t => {
        if (t.completedAt) activityDates.push(new Date(t.completedAt));
        else if (t.updatedAt) activityDates.push(new Date(t.updatedAt));
        if (t.createdAt) activityDates.push(new Date(t.createdAt));
        if (t.endDate) activityDates.push(new Date(t.endDate));

        // CRITICAL FIX: Also check subtask completion dates for the chart's range!
        const subtasks = t.subTasks || [];
        subtasks.forEach(st => {
            if (st.completedAt) activityDates.push(new Date(st.completedAt));
        });
    });

    let sprintStart, sprintEnd;

    if (activityDates.length > 0) {
        sprintStart = new Date(Math.min(...activityDates.map(d => d.getTime())));
        sprintEnd = new Date(Math.max(...activityDates.map(d => d.getTime())));
    } else {
        sprintStart = new Date();
        sprintStart.setDate(sprintStart.getDate() - 7);
        sprintEnd = new Date();
    }

    sprintStart.setHours(0, 0, 0, 0);
    sprintEnd.setHours(0, 0, 0, 0);

    // Ensure we show at least a few days of context around today
    const chartStart = new Date(sprintStart);
    if (chartStart > today) chartStart.setDate(today.getDate() - 2);
    
    const chartEnd = new Date(sprintEnd);
    if (chartEnd < today) chartEnd.setDate(today.getDate() + 2);

    const dailyLabels = [];
    const chartData_Velocity = [];

    let curr = new Date(chartStart);
    // Limit to last 30 days to avoid clutter if the project is old
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (curr < thirtyDaysAgo) curr = thirtyDaysAgo;

    while (curr <= chartEnd || curr <= today) {
        const dateStr = curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dailyLabels.push(dateStr);

        let actionsDoneToday = 0;

        tasks.forEach(t => {
            // Main task completion
            if (t.status === 'Done') {
                const doneTimestamp = t.completedAt; // STRICT: ONLY count if it has an actual completion date!
                if (doneTimestamp) {
                    const doneDate = new Date(doneTimestamp);
                    if (doneDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) === dateStr) {
                        actionsDoneToday++;
                    }
                }
            }
            
            // Subtask completion
            const subtasks = t.subTasks || [];
            subtasks.forEach(st => {
                const stIsDone = st.status === 'Done' || st.completed === true;
                if (stIsDone) {
                    // STRICTOR FIX: Use ONLY actual completion times. 
                    // Fall back ONLY to t.completedAt if the subtask has no stamp but the task is done.
                    // DO NOT use updatedAt or createdAt for completion charts (those move with Setiap edit!)
                    const stDoneTimestamp = st.completedAt || (t.status === 'Done' ? t.completedAt : null);
                    if (stDoneTimestamp) {
                        const stDoneDate = new Date(stDoneTimestamp);
                        if (stDoneDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) === dateStr) {
                            actionsDoneToday++;
                        }
                    }
                }
            });
        });

        chartData_Velocity.push(actionsDoneToday);
        curr.setDate(curr.getDate() + 1);
        if (dailyLabels.length > 40) break; // Hard limit
    }

    // --- CHART RENDERING ---
    if (performanceChart) performanceChart.destroy();

    const velocityGradient = ctx.createLinearGradient(0, 0, 0, 400);
    velocityGradient.addColorStop(0, 'rgba(34, 211, 238, 0.5)'); // Cyan-400
    velocityGradient.addColorStop(1, 'rgba(34, 211, 238, 0)');

    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dailyLabels,
            datasets: [
                {
                    label: 'Actions Completed (Tasks/Subtasks)',
                    data: chartData_Velocity,
                    borderColor: '#22d3ee',
                    backgroundColor: velocityGradient,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 6,
                    pointBackgroundColor: '#22d3ee',
                    pointBorderColor: 'rgba(255,255,255,0.2)',
                    pointBorderWidth: 2,
                    borderWidth: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    padding: 12,
                    cornerRadius: 12,
                    titleFont: { size: 12, family: 'Inter', weight: '900' },
                    bodyFont: { size: 12, family: 'Inter' },
                    callbacks: {
                        label: (context) => ` ${context.raw} Actions Done`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: 'rgba(156, 163, 175, 0.5)', font: { size: 10, weight: 'bold', family: 'Inter' } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.03)', drawBorder: false },
                    ticks: {
                        color: 'rgba(156, 163, 175, 0.5)',
                        font: { size: 10, weight: 'black', family: 'Inter' },
                        stepSize: 1,
                        precision: 0
                    }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeOutQuart'
            }
        }
    });
}

function renderStatusDistribution(tasks) {
    const distribution = document.getElementById('status-distribution');

    // Group by member
    const memberStats = {};
    Object.keys(currentMembers).forEach(mId => {
        memberStats[mId] = { mId: mId, total: 0, done: 0, name: currentMembers[mId].name };
    });

    tasks.forEach(t => {
        if (memberStats[t.assignedTo]) {
            memberStats[t.assignedTo].total++;
            if (t.status === 'Done') memberStats[t.assignedTo].done++;
        }
    });

    // Render bars for each member who has tasks
    const activeMembers = Object.values(memberStats).filter(s => s.total > 0);

    if (activeMembers.length === 0) {
        distribution.innerHTML = '<p class="text-[10px] font-black uppercase text-gray-700 tracking-widest text-center py-10">No tasks assigned yet</p>';
        return;
    }

    distribution.innerHTML = activeMembers.map(stats => {
        // Calculate Mission Progress
        const missionPct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
        
        // Calculate Subtask Progress
        let memberTotalSt = 0;
        let memberDoneSt = 0;
        
        tasks.filter(t => t.assignedTo === stats.mId).forEach(t => {
            const sts = t.subTasks || [];
            memberTotalSt += sts.length;
            memberDoneSt += sts.filter(st => st.status === 'Done' || st.completed === true).length;
        });

        const stPct = memberTotalSt > 0 ? Math.round((memberDoneSt / memberTotalSt) * 100) : 0;

        return `
            <div class="pb-6 border-b border-white/5 last:border-0 group/member flex flex-col gap-3">
                <div class="flex justify-between items-center">
                    <span class="text-white text-base font-black uppercase tracking-tighter opacity-90 group-hover/member:opacity-100 transition-opacity">${stats.name}</span>
                </div>
                
                <div class="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wider">
                    <!-- Missions -->
                    <div class="flex items-center justify-between bg-white/[0.03] px-4 py-2.5 rounded-xl border border-white/5 flex-grow">
                        <span class="text-gray-500">Main Tasks</span>
                        <span class="${missionPct === 100 ? 'text-emerald-500' : 'text-accent-purple'} font-black text-xs ml-2">${stats.done}/${stats.total}</span>
                    </div>

                    <!-- Subtasks -->
                    <div class="flex items-center justify-between bg-white/[0.03] px-4 py-2.5 rounded-xl border border-white/5 flex-grow">
                        <span class="text-gray-500">Subtasks</span>
                        <span class="${stPct === 100 && memberTotalSt > 0 ? 'text-emerald-500' : 'text-blue-500'} font-black text-xs ml-2">${memberDoneSt}/${memberTotalSt}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}



function renderEmptyState() {
    document.getElementById('chart-container').innerHTML = '<div class="w-full text-center py-20 text-gray-700 font-black uppercase tracking-widest text-sm">Waiting for task data...</div>';
    document.getElementById('status-distribution').innerHTML = '';
}

function backToTeam() {
    window.location.href = "team.html";
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;

    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Handle click outside to close dropdown
document.addEventListener('click', () => {
    const dropdown = document.getElementById('sprint-selector-dropdown');
    if (dropdown) dropdown.classList.remove('active');
});

window.onload = initAnalytics;
