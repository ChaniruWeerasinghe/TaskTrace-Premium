let selectedSprint = localStorage.getItem('tt_sprint') || 'All';
let isInitialSprintLoad = true; // Flag to handle auto-select on first load

// Initialize for Dashboard view
function initDashboardApp() {
    setupHeader('dashboard-view');
    selectedProjId = localStorage.getItem('tt_project');
    selectedMember = localStorage.getItem('tt_member');

    if (!selectedProjId) {
        window.location.href = "../index.html";
        return;
    }
    if (!selectedMember) {
        window.location.href = "team.html";
        return;
    }

    auth.onAuthStateChanged(user => {
        if (user) {
            const today = new Date().toDateString();
            const lastAuth = localStorage.getItem('tt_last_auth_date');
            
            if (lastAuth !== today) {
                auth.signOut().then(() => {
                    localStorage.removeItem('tt_last_auth_date');
                    window.location.href = "team.html";
                });
                return;
            }
            
            _loadDashboardData();
        } else {
            window.location.href = "team.html";
        }
    });
}

function _loadDashboardData() {
    // Load Project Theme & Metadata immediately
    database.ref(`projects/${selectedProjId}`).once('value', snap => {
        const project = snap.val();
        if (project) {
            applyProjectTheme(project);
            updateDashboardUI(project);
        } else {
            window.location.href = "../index.html";
        }
    });

    // Parallel Real-time Listeners
    // 1. Members Sync
    database.ref(`projects/${selectedProjId}/members`).on('value', snap => {
        currentMembers = snap.val() || {};
        updateMemberDropdown();
        debouncedRender();
    });

    // 2. Sprints Sync
    database.ref(`projects/${selectedProjId}/sprints`).on('value', snap => {
        currentSprints = snap.val() || {};
        
        // Auto-select next active sprint if needed
        if (isInitialSprintLoad && Object.keys(currentSprints).length > 0) {
            handleDefaultSprintSelection();
            isInitialSprintLoad = false;
        }

        updateSprintDropdown();
        if (typeof updateTaskModalSprintDropdown === 'function') {
            updateTaskModalSprintDropdown();
        }
    });

    // 3. Tasks Sync
    database.ref(`projects/${selectedProjId}/tasks`).on('value', snap => {
        currentTasks = snap.val() || {};
        updateSprintDropdown(); // Refresh sprint list if tasks change
        if (typeof updateTaskModalSprintDropdown === 'function') {
            updateTaskModalSprintDropdown();
        }
        debouncedRender();
        updateProgressBar();
        hideLoader(); // Data has arrived
    });

    // Safety timeout to never leave user hanging
    setTimeout(hideLoader, 3000);
}

// Debounce rendering to prevent double-clutter during initial stream
let renderTimeout;
function debouncedRender() {
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => {
        try {
            renderTasks();
        } catch (e) {
            console.error("Critical Render Error:", e);
            hideLoader();
        }
    }, 50);
}

function updateDashboardUI(proj) {
    const members = proj.members || {};
    const memberName = selectedMember === 'Global' ? 'Global Overview' : (members[selectedMember]?.name || selectedMember);

    document.getElementById('dashboard-title').innerText = selectedMember === 'Global' ? 'Global Overview' : `${memberName}'s Feed`;
    document.getElementById('dashboard-subtitle').innerText = proj.name;
}

function renderTasks() {
    const grid = document.getElementById('task-grid');
    if (!grid) return;

    let ids = Object.keys(currentTasks || {}).reverse();

    // 1. Filter by Member (Global vs Individual)
    let filteredIds = selectedMember === 'Global'
        ? ids.filter(id => currentTasks[id])
        : ids.filter(id => {
            const t = currentTasks[id];
            if (!t) return false;
            const taskAssignedTo = String(t.assignedTo || '').trim().toLowerCase();
            const currentMemId = String(selectedMember || '').trim().toLowerCase();
            const currentMemName = String(currentMembers[selectedMember]?.name || '').trim().toLowerCase();
            return taskAssignedTo === currentMemId || (currentMemName && taskAssignedTo === currentMemName);
        });

    // 2. Filter by Sprint
    if (selectedSprint !== 'All') {
        filteredIds = filteredIds.filter(id => currentTasks[id].sprintName === selectedSprint);
    }

    // Handle Empty State
    if (filteredIds.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-24 flex flex-col items-center text-center animate-fadeIn">
                <div class="w-20 h-20 rounded-3xl bg-accent-purple/5 flex items-center justify-center mb-6 border border-accent-purple/10">
                    <i data-lucide="clipboard-list" class="w-8 h-8 text-accent-purple/30"></i>
                </div>
                <h3 class="text-lg font-bold text-gray-400">All Clear!</h3>
                <p class="text-gray-600 text-sm mt-2">No tasks assigned yet.</p>
            </div>
        `;
        refreshIcons();
        return;
    }

    // Smart Rendering: Remove elements no longer in filtered list
    const currentNodes = Array.from(grid.children);
    currentNodes.forEach(node => {
        const id = node.getAttribute('data-id');
        if (id && !filteredIds.includes(id)) {
            grid.removeChild(node);
        }
    });

    // Smart Rendering: Update existing or append new
    filteredIds.forEach((id, index) => {
        const t = currentTasks[id];
        if (!t) return;

        const status = statusMap[t.status] || statusMap['NotStarted'];
        let urgencyHTML = generateUrgencyHTML(t);

        let existingCard = grid.querySelector(`[data-id="${id}"]`);

        const cardContent = `
            <div class="flex items-start justify-between space-x-3 md:space-x-4 mb-2 md:mb-4">
                <h4 class="text-base md:text-xl font-black tracking-tight leading-tight line-clamp-2 transition-colors group-hover:text-white">${t.title}</h4>
                <div class="custom-dropdown flex-shrink-0" id="dropdown-${id}">
                    <div class="dropdown-trigger !px-2.5 md:!px-4 !py-1.5 md:!py-2 ${status.class} shadow-lg" onclick="toggleDropdown(event, '${id}')">
                        <span class="text-[9px] md:text-xs font-black uppercase tracking-widest">${status.label}</span>
                        <i data-lucide="chevron-down" class="w-3 md:w-3.5 h-3 md:h-3.5 opacity-60 transition-transform duration-300"></i>
                    </div>
                    <div class="dropdown-menu">
                        ${Object.keys(statusMap).map(s => `
                            <div class="dropdown-item ${s === t.status ? 'selected' : ''}" onclick="selectStatus('${id}', '${s}')">
                                <div class="flex items-center">
                                    <span class="status-dot ${statusMap[s].class}"></span>
                                    <span class="text-[10px] md:text-xs font-bold">${statusMap[s].label}</span>
                                </div>
                                ${s === t.status ? '<i data-lucide="check" class="w-3 md:w-3.5 h-3 md:h-3.5"></i>' : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="flex flex-wrap gap-1.5 md:gap-2 content-start flex-grow cursor-pointer" onclick="openSubtaskOverlay('${id}')" title="Click to view subtasks">
                ${(t.subTasks || []).map(st => {
                    let title = typeof st === 'object' ? (st.title || 'Task') : st;
                    let stStatus = 'NotStarted';
                    
                    if (typeof st === 'object') {
                        if (st.status) stStatus = st.status;
                        else if (st.completed === true) stStatus = 'Done';
                    }

                    const isDone = stStatus === 'Done';
                    const completeClass = isDone ? 'opacity-40' : '';
                    const stConfig = statusMap[stStatus] || statusMap['NotStarted'];

                    return `
                    <div class="px-2.5 py-1.5 rounded-lg bg-white/5 border border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)] transition-colors text-[9px] md:text-[10px] font-bold text-gray-400 flex items-center space-x-1.5 ${completeClass}">
                        <div class="w-1.5 h-1.5 rounded-full ${stConfig.class}"></div>
                        <span class="${isDone ? 'line-through' : ''}">${title}</span>
                    </div>
                    `;
                }).join('')}
            </div>
            <div class="flex items-center justify-between pt-4 md:pt-6 border-t border-white/5 mt-auto flex-shrink-0 relative">
                <div class="flex items-center space-x-2 md:space-x-3">
                    <div class="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-900 flex items-center justify-center border border-white/10 flex-shrink-0 shadow-sm">
                        <i data-lucide="user" class="w-3.5 md:w-4 h-3.5 md:h-4 text-slate-400"></i>
                    </div>
                    <span class="text-[10px] md:text-xs font-bold text-gray-400 tracking-tight truncate max-w-[80px] md:max-w-none">${currentMembers[t.assignedTo]?.name || t.assignedTo}</span>
                </div>
                
                <div class="flex items-center md:group-hover:opacity-0 transition-opacity duration-300">
                    ${urgencyHTML}
                </div>
 
                <div class="absolute right-0 flex items-center space-x-1.5 md:space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto bg-black/80 backdrop-blur-sm lg:bg-transparent p-1 rounded-lg">
                     <button onclick="openGenericModal('task', '${id}')" class="p-1.5 md:p-2 rounded-lg hover:bg-white/10 text-gray-500 hover:text-cyan-400 transition-all font-black"><i data-lucide="edit-3" class="w-3.5 md:w-4 h-3.5 md:h-4"></i></button>
                     <button onclick="deleteTask('${id}')" class="p-1.5 md:p-2 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-500 transition-all font-black"><i data-lucide="trash-2" class="w-3.5 md:w-4 h-3.5 md:h-4"></i></button>
                </div>
            </div>`;

        if (existingCard) {
            // Update only if changed (simple approach: check status or title)
            const oldStatus = existingCard.getAttribute('data-status');
            if (oldStatus !== t.status || existingCard.innerHTML.length !== cardContent.length) {
                existingCard.innerHTML = cardContent;
                existingCard.setAttribute('data-status', t.status);
                // Ensure correct ordering
                if (grid.children[index] !== existingCard) {
                    grid.insertBefore(existingCard, grid.children[index]);
                }
            }
        } else {
            const card = document.createElement('div');
            card.className = "glass p-5 md:p-8 rounded-2xl md:rounded-[32px] flex flex-col h-full space-y-4 md:space-y-5 hover:bg-white/[0.03] transition-all duration-500 group animate-fadeIn relative border border-white/5";
            card.setAttribute('data-id', id);
            card.setAttribute('data-status', t.status);
            card.innerHTML = cardContent;
            grid.insertBefore(card, grid.children[index] || null);
        }
    });
    refreshIcons();
}

function generateUrgencyHTML(t) {
    if (t.status === 'Done') {
        return `
            <div class="flex items-center space-x-3 text-xs sm:text-sm font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all duration-300 scale-105" style="color: #5F9301; background: rgba(95, 147, 1, 0.15);">
                <img src="../images/Complete.png" class="w-6 h-6 object-contain">
                <span>Completed</span>
            </div>
        `;
    } else if (t.endDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadline = new Date(t.endDate);
        deadline.setHours(0, 0, 0, 0);

        const diffTime = deadline.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let urgencyClass = 'text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg';
        let urgencyLabel = `Due ${new Date(t.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

        let sprintDisplay = '';
        if (t.sprintName) {
            const s = parseInt(t.sprintName);
            if (!isNaN(s)) {
                const j = s % 10, k = s % 100;
                let suffix = "th";
                if (j == 1 && k != 11) suffix = "st";
                else if (j == 2 && k != 12) suffix = "nd";
                else if (j == 3 && k != 13) suffix = "rd";
                sprintDisplay = `${s}${suffix} Sprint • `;
            } else {
                sprintDisplay = `${t.sprintName} • `;
            }
        }

        if (diffDays < 0) {
            urgencyClass = 'text-rose-500 bg-rose-500/10 px-3 py-1 rounded-lg animate-pulse';
            urgencyLabel = 'Overdue';
        } else if (diffDays === 0) {
            urgencyClass = 'text-rose-500 bg-rose-500/10 px-3 py-1 rounded-lg animate-pulse';
            urgencyLabel = 'Due Today';
        } else if (diffDays <= 3) {
            urgencyClass = 'text-amber-400 bg-amber-500/10 px-3 py-1 rounded-lg';
            urgencyLabel = `${diffDays}d left`;
        }

        return `
            <div class="flex items-center space-x-2 text-[10px] sm:text-xs font-black uppercase tracking-widest ${urgencyClass} transition-all duration-300">
                <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
                <span>${sprintDisplay}${urgencyLabel}</span>
            </div>
        `;
    }
    return '';
}

function updateProgressBar() {
    const tasks = Object.values(currentTasks).filter(t => t !== null && t !== undefined);

    // Apply combined filters to progress bar
    let filtered = tasks;
    if (selectedMember !== 'Global') {
        filtered = filtered.filter(t => t.assignedTo === selectedMember);
    }
    if (selectedSprint !== 'All') {
        filtered = filtered.filter(t => t.sprintName === selectedSprint);
    }

    const total = filtered.length;
    const done = filtered.filter(t => t.status === 'Done').length;
    const pc = total === 0 ? 0 : Math.round((done / total) * 100);

    const globalFill = document.getElementById('global-progress-fill');
    const innerFill = document.getElementById('inner-progress-fill');

    if (globalFill) globalFill.style.width = `${pc}% `;
    if (innerFill) innerFill.style.width = `${pc}% `;

    const percentText = document.getElementById('progress-percent-text');
    if (percentText) percentText.innerText = `${pc}% `;

    const doneCount = document.getElementById('done-count');
    if (doneCount) doneCount.innerText = done;
}

// --- Status logic ---
function updateTaskStatus(id, next) {
    const task = currentTasks[id];
    if (!task) return;
    if (selectedMember !== 'Global' && task.assignedTo !== selectedMember) {
        showNotification(`Denied: Only ${currentMembers[task.assignedTo]?.name || task.assignedTo} can update`, true);
        renderTasks();
        return;
    }

    // Immediate UI Feedback for smoothness
    const trigger = document.querySelector(`#dropdown-${id} .dropdown-trigger`);

    // Subtask Completion Check
    if (next === 'Done') {
        const subtasks = task.subTasks || [];
        const hasPending = subtasks.some(st => {
            if (typeof st === 'string') return true;
            if (st.status && st.status !== 'Done') return true;
            if (st.completed === false) return true; // Legacy
            return false;
        });
        
        if (hasPending) {
            // Show warning modal instead of completing immediately
            window.pendingTaskIdForCompletion = id;
            const warningModal = document.getElementById('subtask-warning-modal');
            if (warningModal) {
                warningModal.classList.remove('hidden');
                
                // Revert dropdown UI visually since we aborted the actual status change
                if (trigger) {
                    Object.values(statusMap).forEach(s => trigger.classList.remove(s.class));
                    trigger.classList.add(statusMap[task.status].class);
                    const labelText = trigger.querySelector('span');
                    if (labelText) labelText.innerText = statusMap[task.status].label;
                }
                
                // Setup warning buttons
                document.getElementById('warning-complete-btn').onclick = () => {
                    forceCompleteTaskAndSubtasks();
                };
            }
            return;
        }
    }

    if (trigger) {
        // Clear all old status classes
        Object.values(statusMap).forEach(s => trigger.classList.remove(s.class));
        // Add new status class
        trigger.classList.add(statusMap[next].class);
        // Change label text
        const labelText = trigger.querySelector('span');
        if (labelText) labelText.innerText = statusMap[next].label;
        // Add pop animation
        trigger.classList.add('status-pop');
        setTimeout(() => trigger.classList.remove('status-pop'), 400);
    }

    database.ref(`projects/${selectedProjId}/tasks/${id}`).update({
        status: next,
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
        completedAt: next === 'Done' ? firebase.database.ServerValue.TIMESTAMP : null
    })
        .then(() => showNotification(`Status updated to ${statusMap[next].label}`))
        .catch(err => {
            showNotification("Error updating task status: " + err.message, true);
            renderTasks(); // Revert on error
        });
}

function forceCompleteTaskAndSubtasks() {
    const id = window.pendingTaskIdForCompletion;
    if (!id) return;
    
    const task = currentTasks[id];
    if (!task) return;
    
    const updatedSubtasks = (task.subTasks || []).map(st => {
        let isAlreadyDone = false;
        if (typeof st === 'object') {
            isAlreadyDone = (st.status === 'Done' || st.completed === true);
            if (isAlreadyDone) return st; // Keep the original completedAt!
            return { ...st, status: 'Done', completedAt: firebase.database.ServerValue.TIMESTAMP }; 
        }
        // If it was a string tag, make it an object and mark it done
        return { title: st, status: 'Done', completedAt: firebase.database.ServerValue.TIMESTAMP };
    });
    
    database.ref(`projects/${selectedProjId}/tasks/${id}`).update({
        status: 'Done',
        subTasks: updatedSubtasks,
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
        completedAt: firebase.database.ServerValue.TIMESTAMP
    })
    .then(() => {
        closeSubtaskWarning();
        showNotification("All subtasks marked done & Main Task completed!");
        window.pendingTaskIdForCompletion = null;
    })
    .catch(err => {
        showNotification("Error completing task: " + err.message, true);
    });
}

/**
 * Marks a sprint as completed.
 */
function completeSprint(sName) {
    if (!sName || sName === 'All') return;

    const confirmed = confirm(`Are you sure you want to mark Sprint ${sName} as COMPLETED? \n\nThis will shift the default view to the next active sprint on refresh.`);
    if (!confirmed) return;

    database.ref(`projects/${selectedProjId}/sprints/${sName}`).update({
        status: 'Completed',
        completedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        showNotification(`Sprint ${sName} archived successfully!`, false);
        // After completion, auto-select the next one
        isInitialSprintLoad = true; // Reset flag to trigger re-selection
    }).catch(err => {
        showNotification("Error: " + err.message, true);
    });
}

/**
 * Handles the logic for auto-selecting the "Next" active sprint.
 */
function handleDefaultSprintSelection() {
    // 1. Check if we need to auto-select
    const stored = localStorage.getItem('tt_sprint');
    const currentStatus = currentSprints[selectedSprint]?.status;

    // Only auto-switch if: 1. Nothing is selected 2. The selected sprint is Completed
    // We do NOT switch if they have explicitly selected 'All'
    if (!stored || currentStatus === 'Completed') {
        const sprintNames = Object.keys(currentSprints).sort((a, b) => {
            const na = parseInt(a), nb = parseInt(b);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return String(a).localeCompare(String(b));
        });

        const nextActive = sprintNames.find(s => currentSprints[s].status !== 'Completed');
        if (nextActive && nextActive !== selectedSprint) {
            console.log("Auto-switching to active sprint:", nextActive);
            selectedSprint = nextActive;
            localStorage.setItem('tt_sprint', nextActive);
        }
    }
}

// Functions moved to common.js:
// currentSubTasks, handleTaskSubmit, setupTagInput, renderTagsInModal, removeTag, toggleDropdown, updateMemberDropdown, selectStatus

function deleteTask(id) {
    const t = currentTasks[id];
    if (!t) return;

    // 1. Sub-task Volume Check (More than 10 sub-tasks)
    const subTaskCount = (t.subTasks || []).length;
    if (subTaskCount > 10 && !isAdminActive()) {
        showNotification(`Complex tasks can't be deleted (${subTaskCount} sub-tasks)`, true);
        return;
    }

    // 2. Task Age Check (Older than 4 days)
    const now = Date.now();
    const createdAt = t.createdAt;

    if (!isAdminActive()) {
        if (createdAt) {
            const ageInMs = now - Number(createdAt);
            const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
            if (ageInDays > 4) {
                showNotification("Established tasks can't be deleted (Older than 4 days)", true);
                return;
            }
        } else {
            // No creation timestamp - treat as established
            showNotification("Established tasks can't be deleted", true);
            return;
        }
    }

    requestSecurityAuth(() => {
        database.ref(`projects/${selectedProjId}/tasks/${id}`).remove()
            .then(() => showNotification("Main Task aborted", true));
    });
}

function selectStatus(id, next) {
    updateTaskStatus(id, next);
    const el = document.getElementById(`dropdown-${id}`);
    if (el) el.classList.remove('active');
}

// --- Sprint Selection Logic ---
function toggleSprintDropdown(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('sprint-selector-dropdown');
    dropdown.classList.toggle('active');
}

function updateSprintDropdown() {
    const menu = document.getElementById('sprint-menu');
    const text = document.getElementById('selected-sprint-text');
    const extraActions = document.getElementById('dashboard-extra-actions');
    if (!menu) return;

    // Get unique sprint names from BOTH Tasks and Defined Sprints
    const sprints = new Set();

    // Add explicitly defined sprints
    Object.keys(currentSprints || {}).forEach(k => sprints.add(k));

    // Add sprints mentioned in tasks
    Object.values(currentTasks || {}).forEach(t => {
        if (t.sprintName) sprints.add(t.sprintName);
    });

    const sprintList = Array.from(sprints).sort((a, b) => {
        const na = parseInt(a), nb = parseInt(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return String(a).localeCompare(String(b));
    });

    // Update Action Button (Complete Sprint) - Rich UI button that pops up
    if (extraActions) {
        const isSelectedSprintActive = selectedSprint !== 'All' && currentSprints[selectedSprint] && currentSprints[selectedSprint].status !== 'Completed';
        const isNumeric = !isNaN(parseInt(selectedSprint));

        if (isSelectedSprintActive && isNumeric) {
            extraActions.innerHTML = `
                <button onclick="completeSprint('${selectedSprint}')"
                    class="group flex items-center space-x-2 md:space-x-3 px-4 md:px-6 py-2.5 md:py-3 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-full border border-emerald-500/20 transition-all duration-300 animate-fadeIn">
                    <i data-lucide="check-circle" class="w-3.5 md:w-4 h-3.5 md:h-4 text-emerald-400"></i>
                    <span class="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400">Complete Sprint ${selectedSprint}</span>
                </button>
            `;
        } else {
            extraActions.innerHTML = '';
        }
    }

    let html = `
            <div class="dropdown-item group/item ${selectedSprint === 'All' ? 'selected' : ''}" onclick="selectSprint('All')">
                <div class="flex items-center">
                    <div class="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center mr-3 group-hover/item:bg-accent-purple/20 transition-colors">
                        <i data-lucide="layers" class="w-3.5 h-3.5 text-gray-500 group-hover/item:text-accent-purple"></i>
                    </div>
                    <span class="text-[11px] font-bold uppercase tracking-wider">All</span>
                </div>
            ${selectedSprint === 'All' ? '<i data-lucide="check" class="w-4 h-4 text-accent-purple"></i>' : ''}
        </div>
            <div class="h-[1px] bg-white/5 my-2 mx-2"></div>
        `;

    sprintList.forEach(s => {
        const isNumeric = !isNaN(parseInt(s));
        const displayLabel = isNumeric ? `Sprint ${s} ` : s;
        const isCompleted = currentSprints[s]?.status === 'Completed';

        html += `
            <div class="dropdown-item group/item ${selectedSprint === s ? 'selected' : ''} ${isCompleted ? 'opacity-60' : ''}" onclick="selectSprint('${s}')">
                <div class="flex items-center flex-grow">
                    <div class="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center mr-3 group-hover/item:bg-cyan-500/20 transition-colors">
                        <i data-lucide="${isCompleted ? 'archive' : 'zap'}" class="w-3.5 h-3.5 ${isCompleted ? 'text-gray-600' : 'text-cyan-400/50'} group-hover/item:text-cyan-400"></i>
                    </div>
                     <div class="flex flex-col">
                        <span class="text-[11px] font-bold uppercase tracking-wider ${isCompleted ? 'line-through text-gray-500' : ''}">${displayLabel}</span>
                        ${isCompleted ? '<span class="text-[7px] text-emerald-500/50 font-black uppercase tracking-widest mt-0.5">Archived</span>' : ''}
                    </div>
                </div>
                ${selectedSprint === s ? '<i data-lucide="check" class="w-4 h-4 text-cyan-400"></i>' : ''}
            </div>
            `;
    });

    menu.innerHTML = html;

    // Update trigger text with Sprint X format if numeric
    if (selectedSprint === 'All') {
        text.innerText = 'Select Sprint';
    } else {
        const isNumeric = !isNaN(parseInt(selectedSprint));
        text.innerText = isNumeric ? `Sprint ${selectedSprint} ` : selectedSprint;
    }

    refreshIcons();
}

function selectSprint(sprint) {
    selectedSprint = sprint;
    localStorage.setItem('tt_sprint', sprint);
    const dropdown = document.getElementById('sprint-selector-dropdown');
    if (dropdown) dropdown.classList.remove('active');

    updateSprintDropdown();
    debouncedRender();
    updateProgressBar();
}

// Initialized check moved to common.js if needed, or keeping it here for dashboard specific logic
// updateTaskModalSprintDropdown removed as it is now in common.js

// Close dropdowns on outside click
document.addEventListener('click', () => {
    const sprintDropdown = document.getElementById('sprint-selector-dropdown');
    if (sprintDropdown) sprintDropdown.classList.remove('active');
});

window.openSubtaskOverlay = function(taskId) {
    const task = currentTasks[taskId];
    if (!task) return;
    
    const overlay = document.getElementById('subtask-overlay');
    if (!overlay) return;
    
    // Set Title
    document.getElementById('subtask-overlay-title').innerText = task.title;
    
    // Set Description (Optional)
    const descContainer = document.getElementById('subtask-overlay-desc-container');
    const descText = document.getElementById('subtask-overlay-desc');
    if (task.description && task.description.trim() !== '') {
        descText.innerText = task.description;
        descContainer.classList.remove('hidden');
    } else {
        descContainer.classList.add('hidden');
    }

    // Set Meta
    const idBadge = document.getElementById('subtask-overlay-id');
    idBadge.innerText = `#${taskId.substring(taskId.length - 6).toUpperCase()}`;
    idBadge.classList.remove('hidden');
    idBadge.title = taskId;

    const sprintBadge = document.getElementById('subtask-overlay-sprint');
    if (task.sprintName) {
        const isNumeric = !isNaN(parseInt(task.sprintName));
        sprintBadge.innerText = isNumeric ? `Sprint ${task.sprintName}` : task.sprintName;
        sprintBadge.classList.remove('hidden');
    } else {
        sprintBadge.classList.add('hidden');
    }

    const deadlineBadge = document.getElementById('subtask-overlay-deadline');
    if (task.endDate) {
        deadlineBadge.innerText = `Due ${new Date(task.endDate).toLocaleDateString()}`;
        deadlineBadge.classList.remove('hidden');
    } else {
        deadlineBadge.classList.add('hidden');
    }

    // Set Assignee
    const assigneeName = currentMembers[task.assignedTo]?.name || task.assignedTo;
    document.getElementById('subtask-overlay-assignee').innerText = assigneeName;
    
    // Build Status Dropdown
    const statusDropdown = document.getElementById('overlay-status-dropdown');
    const status = statusMap[task.status] || statusMap['NotStarted'];
    const isDone = task.status === 'Done';
    
    // Based on UI screenshot, top right has a bright green pill when done.
    statusDropdown.innerHTML = `
        <div class="px-5 py-2 sm:px-6 sm:py-2.5 rounded-full flex items-center justify-center space-x-2 ${isDone ? 'bg-[#00b067] border-[#00b067]' : status.class} shadow-lg cursor-default border border-white/5 text-white font-extrabold uppercase tracking-widest text-[10px] sm:text-[11px]">
            <span>${status.label}</span>
        </div>
    `;

    // Render Subtasks
    renderOverlaySubtasks(taskId);
    
    // Show Modal
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // prevent bg scroll
};

window.closeSubtaskOverlay = function() {
    const overlay = document.getElementById('subtask-overlay');
    if (overlay) overlay.classList.add('hidden');
    document.body.style.overflow = 'auto'; // restore bg scroll
}

function renderOverlaySubtasks(taskId) {
    const task = currentTasks[taskId];
    if (!task) return;
    
    const tbody = document.getElementById('subtask-overlay-table-body');
    const progressText = document.getElementById('subtask-overlay-progress-text');
    
    // Clear existing
    tbody.innerHTML = '';
    
    const subtasks = task.subTasks || [];
    
    if (subtasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-gray-500 italic font-medium">No subtasks found for this task.</td></tr>`;
    } else {
        subtasks.forEach((st, idx) => {
            // Backward compatibility logic
            let stTitle = st;
            let stStatus = 'NotStarted';
            if (typeof st === 'object') {
                stTitle = st.title || 'Task';
                if (st.status) {
                    stStatus = st.status;
                } else if (st.completed === true) {
                    stStatus = 'Done';
                }
            }

            const isDone = stStatus === 'Done';
            const trClass = isDone ? 'bg-white/[0.02]' : 'hover:bg-white/[0.02] transition-colors';
            const statusConfig = statusMap[stStatus] || statusMap['NotStarted'];
            
            // Build the dropdown options dynamically based on statusMap
            const dropdownOptionsHtml = Object.keys(statusMap).map(k => {
                const dotColorClass = statusMap[k].color.replace('text-', 'bg-');
                return `
                <div class="dropdown-item ${statusMap[k].hoverClass} p-3 rounded-xl flex items-center justify-start cursor-pointer transition-all" onclick="selectSubtaskStatus('${taskId}', ${idx}, '${k}')">
                    <div class="w-2.5 h-2.5 rounded-full ${dotColorClass} opacity-70 flex-shrink-0"></div>
                    <span class="text-[10px] sm:text-[11px] font-bold tracking-widest uppercase text-left ml-4">${statusMap[k].label}</span>
                </div>
            `}).join('');

            // Status Dropdown Trigger HTML (using status-level classes for the pill color)
            const statusBadgeHtml = `
                <div class="custom-dropdown relative text-left inline-block" id="subtask-dropdown-${taskId}-${idx}">
                    <div class="dropdown-trigger px-4 py-2.5 rounded-xl flex items-center justify-center space-x-2 ${statusConfig.class} shadow-lg cursor-pointer border border-white/5 font-extrabold uppercase tracking-widest text-[9px] w-[140px] hover:brightness-110 transition-all" onclick="toggleSubtaskDropdown(event, '${taskId}', ${idx})">
                        <span>${statusConfig.label}</span>
                    </div>
                    <div class="dropdown-menu subtask-dropdown-menu absolute mt-2 w-52 bg-[#0a0f18] border border-white/10 rounded-2xl p-2 shadow-2xl z-[150] right-0 transition-all duration-200">
                        ${dropdownOptionsHtml}
                    </div>
                </div>
            `;
                
            const tr = document.createElement('tr');
            tr.className = trClass;
            tr.innerHTML = `
                <td class="py-4 text-center text-gray-600 font-bold text-[11px] border-b border-white/5">${idx + 1}</td>
                <td class="p-4 border-l border-white/5 border-b border-white/5">
                    <span class="${isDone ? 'text-gray-500' : 'text-gray-200'} font-bold tracking-wide">${stTitle}</span>
                </td>
                <td class="p-4 text-left border-l border-white/5 border-b border-white/5">
                    <div class="flex justify-start px-4">${statusBadgeHtml}</div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    refreshIcons();
    
    // Update Progress Text
    const total = subtasks.length;
    let doneCount = 0;
    subtasks.forEach(st => {
        if (typeof st === 'object') {
            if (st.status === 'Done' || st.completed === true) doneCount++;
        }
    });
    
    progressText.innerText = `${doneCount}/${total} DONE`;
}

window.toggleSubtaskDropdown = function(e, taskId, idx) {
    e.stopPropagation();
    const dropdownId = `subtask-dropdown-${taskId}-${idx}`;
    const el = document.getElementById(dropdownId);
    if (!el) return;

    // Close other open subtask dropdowns
    document.querySelectorAll('[id^="subtask-dropdown-"]').forEach(other => {
        if (other.id !== dropdownId) other.classList.remove('active');
    });

    const isOpening = !el.classList.contains('active');
    
    if (isOpening) {
        // Smart Positioning Logic
        const trigger = el.querySelector('.dropdown-trigger');
        const menu = el.querySelector('.dropdown-menu');
        const triggerRect = trigger.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const spaceBelow = windowHeight - triggerRect.bottom;
        const menuHeight = 260; // Approximate height of 5 items

        if (spaceBelow < menuHeight) {
            menu.style.bottom = 'calc(100% + 12px)';
            menu.style.top = 'auto';
            menu.style.marginTop = '0';
            menu.style.transformOrigin = 'bottom right';
        } else {
            menu.style.top = 'calc(100% + 12px)';
            menu.style.bottom = 'auto';
            menu.style.marginTop = '0';
            menu.style.transformOrigin = 'top right';
        }
    }

    el.classList.toggle('active');
};

// Global click listener to close subtask dropdowns when clicking outside
document.addEventListener('click', function(e) {
    const isInsideSubtaskDropdown = e.target.closest('[id^="subtask-dropdown-"]');
    if (!isInsideSubtaskDropdown) {
        document.querySelectorAll('[id^="subtask-dropdown-"]').forEach(el => {
            el.classList.remove('active');
        });
    }
});

window.selectSubtaskStatus = function(taskId, subtaskIdx, newStatus) {
    const task = currentTasks[taskId];
    if (!task) return;
    
    // Authorization check
    if (selectedMember !== 'Global' && task.assignedTo !== selectedMember) {
        showNotification(`Denied: Only ${currentMembers[task.assignedTo]?.name || task.assignedTo} can update`, true);
        return;
    }

    let subtasks = task.subTasks || [];
    
    // Ensure object format
    subtasks = subtasks.map(st => {
        if (typeof st === 'string') return { title: st, status: 'NotStarted' };
        
        // Handle legacy completed boolean
        if (st.status === undefined && st.completed !== undefined) {
            return { ...st, status: st.completed ? 'Done' : 'NotStarted' };
        }
        return st;
    });
    
    // Update the specific subtask
    if (subtasks[subtaskIdx]) {
        subtasks[subtaskIdx].status = newStatus;
        if (newStatus === 'Done') {
            subtasks[subtaskIdx].completedAt = firebase.database.ServerValue.TIMESTAMP;
        } else {
            subtasks[subtaskIdx].completedAt = null;
        }
    }
    
    // Optimistic UI update in the overlay
    task.subTasks = subtasks;
    renderOverlaySubtasks(taskId);
    
    // Persist to Firebase
    database.ref(`projects/${selectedProjId}/tasks/${taskId}/subTasks`).set(subtasks)
        .then(() => {
            // Render main dashboard to reflect new subtask tag states
            renderTasks();
            
            // Check if all are done now and auto-complete main task
            const allDone = subtasks.every(st => st.status === 'Done');
            if (allDone && task.status !== 'Done') {
                updateTaskStatus(taskId, 'Done');
                closeSubtaskOverlay();
                showNotification("All subtasks completed! Task accomplished.", false);
            }
        })
        .catch(err => {
            showNotification("Error updating subtask status: " + err.message, true);
        });
}

window.onload = initDashboardApp;
