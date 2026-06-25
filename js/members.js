// Initialize for members view
let selectedSprint = localStorage.getItem('tt_sprint') || 'All';

let identityVerified = false;

function initMembersApp() {
    setupHeader('member-view');
    
    // Check for projId in URL (Invite Flow)
    const urlParams = new URLSearchParams(window.location.search);
    const urlProjId = urlParams.get('projId');
    if (urlProjId) {
        localStorage.setItem('tt_project', urlProjId);
        selectedProjId = urlProjId;
    } else {
        selectedProjId = localStorage.getItem('tt_project');
    }

    if (!selectedProjId) {
        window.location.href = "../index.html";
        return;
    }

    // Load generic project info first for title and colors
    database.ref(`projects/${selectedProjId}`).once('value', snap => {
        const project = snap.val();
        if (project) {
            applyProjectTheme(project);
            const titleEl = document.getElementById('selected-project-title');
            if (titleEl) titleEl.innerText = project.name;
        } else {
            window.location.href = "../index.html";
        }
    });

    // Enforce Authentication & Profile Linking
    auth.onAuthStateChanged(user => {
        if (user) {
            // Hide Welcome UI if active
            const welcomeUI = document.getElementById('global-welcome-interface');
            if (welcomeUI) welcomeUI.classList.add('hidden', 'opacity-0', 'pointer-events-none');

            // Daily Check
            const today = new Date().toDateString();
            const lastAuth = localStorage.getItem('tt_last_auth_date');
            
            if (lastAuth !== today) {
                auth.signOut().then(() => {
                    localStorage.removeItem('tt_last_auth_date');
                    if (typeof showWelcomeInterface === 'function') {
                        showWelcomeInterface();
                    }
                });
                return;
            }

            // Sync Members
            database.ref(`projects/${selectedProjId}/members`).on('value', snap => {
                currentMembers = snap.val() || {};
                
                if (!identityVerified) {
                    checkAndEnforceMemberLink(user.uid);
                } else {
                    renderMembers();
                }
                updateMemberDropdown();
                hideLoader();
            });

            // Sprints & Tasks for Dropdowns
            database.ref(`projects/${selectedProjId}/sprints`).on('value', snap => {
                currentSprints = snap.val() || {};
                if (typeof updateTaskModalSprintDropdown === 'function') {
                    updateTaskModalSprintDropdown();
                }
            });

            database.ref(`projects/${selectedProjId}/tasks`).on('value', snap => {
                currentTasks = snap.val() || {};
                if (typeof updateTaskModalSprintDropdown === 'function') {
                    updateTaskModalSprintDropdown();
                }
            });

        } else {
            // Need Auth
            if (typeof showWelcomeInterface === 'function') {
                showWelcomeInterface();
            } else {
                console.warn("Welcome UI not loaded yet, trying again in 500ms");
                setTimeout(() => {
                    if (typeof showWelcomeInterface === 'function') showWelcomeInterface();
                }, 500);
            }
            hideLoader();
        }
    });
}

function checkAndEnforceMemberLink(uid) {
    const membersList = Object.entries(currentMembers);
    
    const linkedMember = membersList.find(([id, m]) => m.linkedUid === uid);
    
    if (linkedMember) {
        identityVerified = true;
        closeClaimProfileModal();
        renderMembers();
        return;
    }

    const legacyMembers = membersList.filter(([id, m]) => !m.linkedUid);
    showClaimProfileModal(legacyMembers);
}

function showClaimProfileModal(legacyMembers) {
    const modal = document.getElementById('claim-profile-modal');
    const container = document.getElementById('claim-profile-container');
    const list = document.getElementById('legacy-members-list');
    
    if (!modal) return;
    
    list.innerHTML = '';
    
    if (legacyMembers.length === 0) {
        list.innerHTML = `<div class="text-center py-4 text-gray-500 text-[10px] font-bold uppercase tracking-widest">No unlinked profiles available. Please create a new one.</div>`;
    } else {
        legacyMembers.forEach(([id, m]) => {
            const btn = document.createElement('button');
            btn.className = "w-full flex items-center justify-between p-4 glass rounded-[20px] border border-white/5 hover:border-indigo-500/30 hover:bg-white/5 transition-all text-left group";
            btn.onclick = () => claimLegacyMember(id, m.name);
            btn.innerHTML = `
                <div class="flex items-center space-x-4">
                    <div class="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white font-bold text-sm uppercase" style="background: linear-gradient(135deg, ${m.colorFrom || '#6366f1'}40, ${m.colorTo || '#a855f7'}40)">
                        ${m.name.substring(0, 2)}
                    </div>
                    <div>
                        <p class="text-sm font-black text-white">${m.name}</p>
                        <p class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">${m.role || 'Member'}</p>
                    </div>
                </div>
                <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors">
                    <i data-lucide="link" class="w-4 h-4"></i>
                </div>
            `;
            list.appendChild(btn);
        });
    }
    
    modal.classList.remove('hidden', 'pointer-events-none');
    setTimeout(() => {
        container.classList.remove('scale-95', 'opacity-0');
        container.classList.add('scale-100', 'opacity-100');
    }, 10);
    
    if (typeof refreshIcons === 'function') refreshIcons();
}

function closeClaimProfileModal() {
    const modal = document.getElementById('claim-profile-modal');
    const container = document.getElementById('claim-profile-container');
    if (!modal) return;
    
    container.classList.remove('scale-100', 'opacity-100');
    container.classList.add('scale-95', 'opacity-0');
    
    setTimeout(() => {
        modal.classList.add('hidden', 'pointer-events-none');
    }, 300);
}

async function claimLegacyMember(memberId, memberName) {
    if (!auth.currentUser) return;
    
    const confirmClaim = confirm(`Link "${memberName}" to your account? This cannot be undone.`);
    if (!confirmClaim) return;
    
    try {
        await database.ref(`projects/${selectedProjId}/members/${memberId}`).update({
            linkedUid: auth.currentUser.uid,
            email: auth.currentUser.email
        });
        showNotification("Profile successfully linked!");
        // The listener will auto trigger identityVerified = true
    } catch (e) {
        showNotification("Failed to claim profile: " + e.message, true);
    }
}

function openNewProfileForm() {
    closeClaimProfileModal();
    window.isSelfLinking = true;
    openGenericModal('member');
}

function renderMembers() {
    const grid = document.getElementById('member-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const keys = Object.keys(currentMembers);
    if (keys.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-20 flex flex-col items-center text-center animate-fadeIn">
                        <div class="w-12 h-12 md:w-20 md:h-20 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/10">
                            <i data-lucide="users" class="w-8 h-8 md:w-10 md:h-10 text-gray-600"></i>
                        </div>
                        <h3 class="text-xl font-bold text-gray-400 tracking-tight">Empty Team</h3>
                        <p class="text-gray-600 text-sm mt-3 font-medium leading-relaxed italic">Invite members to this project to start assigning main tasks and managing objectives.</p>
            </div>
        `;
        refreshIcons();
        return;
    }

    keys.forEach(id => {
        const m = currentMembers[id];
        if (!m) return;
        const colorFrom = m.colorFrom || '#a855f7';
        const colorTo = m.colorTo || '#7e22ce';

        const card = document.createElement('div');
        card.className = "glass p-4 md:p-8 rounded-2xl md:rounded-[32px] flex flex-col items-center h-full hover-card transition-all duration-500 cursor-pointer group relative overflow-hidden";
        card.onclick = () => selectMember(id, m.name);
        card.innerHTML = `
            <div class="absolute top-4 right-4 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onclick="event.stopPropagation(); openGenericModal('member', '${id}')" class="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-cyan-400 transition-all">
                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                </button>
                <button onclick="event.stopPropagation(); deleteMember('${id}')" class="p-2 rounded-lg bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-all">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
            <div class="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center mb-3 md:mb-5 group-hover:opacity-100 transition-all relative">
                <div class="absolute inset-0 rounded-xl md:rounded-2xl opacity-10 group-hover:opacity-20 transition-opacity" style="background: linear-gradient(135deg, ${colorFrom}, ${colorTo})"></div>
                <i data-lucide="user" class="w-6 md:w-8 h-6 md:h-8 transition-colors relative z-10" style="color: ${colorFrom}"></i>
            </div>
            <h3 class="text-sm md:text-xl font-bold text-center">${m.name}</h3>
            <p class="text-[7px] md:text-[9px] uppercase font-black tracking-widest text-gray-500 mt-1 text-center">${m.role}</p>
        `;
        grid.appendChild(card);
    });
    refreshIcons();
}

async function selectMember(id, name) {
    localStorage.setItem('tt_member', id);
    localStorage.setItem('tt_member_name', name || 'Global Overview');
    
    const urlParams = new URLSearchParams(window.location.search);
    const urlMId = urlParams.get('mId');

    // Improved Invite Flow: Check if a meeting is active for this project
    try {
        const projId = localStorage.getItem('tt_project');
        
        // If we have a specific meeting ID from URL, prioritize it
        if (urlMId) {
            localStorage.setItem('tt_is_waiting_for_meeting', 'true');
            window.location.href = `workspace.html?projId=${projId}&mId=${urlMId}`;
            return;
        }

        const activeMeetings = await db.collection('meetings')
            .where('projectId', '==', projId)
            .where('status', 'in', ['Waiting', 'Active'])
            .limit(1)
            .get();

        if (!activeMeetings.empty) {
            // Meeting exists! Go to dashboard but signal that we should open the meeting overlay immediately
            localStorage.setItem('tt_is_waiting_for_meeting', 'true');
            window.location.href = "workspace.html";
        } else {
            // No active meeting - just go to dashboard as normal
            window.location.href = "workspace.html";
        }
    } catch (e) {
        console.error("Error checking for active meetings:", e);
        window.location.href = "workspace.html";
    }
}

function deleteMember(id) {
    requestSecurityAuth(() => {
        database.ref(`projects/${selectedProjId}/members/${id}`).remove()
            .then(() => showNotification("Member removed", true))
            .catch(err => showNotification("Error removing member: " + err.message, true));
    });
}


// openGenericModal moved to common.js

// handleMemberSubmit moved to common.js

// Functions moved to common.js:
// currentSubTasks, handleTaskSubmit, setupTagInput, renderTagsInModal, removeTag, toggleDropdown, updateMemberDropdown


// Sprint Analytics Navigation
function goToAnalytics() {
    window.location.href = "analytics.html";
}

// Meeting Room Logic
async function renderMeetingHistory() {
    const list = document.getElementById('meeting-history-list');
    if (!list) return;

    try {
        const projId = localStorage.getItem('tt_project');
        db.collection('meetings')
            .where('projectId', '==', projId)
            .where('status', '==', 'Completed')
            .orderBy('startTime', 'desc')
            .onSnapshot(query => {
                if (query.empty) {
                    list.innerHTML = `
                        <div class="col-span-full py-12 glass rounded-[32px] border border-white/5 flex flex-col items-center justify-center text-center">
                            <p class="text-gray-500 text-xs font-bold uppercase tracking-widest">No meeting records found</p>
                        </div>
                    `;
                    return;
                }

                list.innerHTML = '';
                query.forEach(doc => {
                    const m = doc.data();
                    const dateStr = m.startTime ? m.startTime.toDate().toLocaleDateString() : m.date;
                    const duration = formatHistoryDuration(m.totalDuration || 0);
                    const sprintText = m.sprintName && m.sprintName !== "None" ? m.sprintName : "General Sync";
                    const isAdmin = typeof isAdminActive === 'function' && isAdminActive();

                    const card = document.createElement('div');
                    card.className = "glass p-8 rounded-[32px] border border-white/5 hover:border-indigo-500/20 transition-all group cursor-pointer relative overflow-hidden active:scale-[0.98]";
                    
                    // Clicking the card opens the report via the function in meeting-overlay.js
                    card.onclick = () => {
                        if (window.showMeetingReport) {
                            window.showMeetingReport(doc.id);
                        }
                    };

                    card.innerHTML = `
                        <div class="absolute top-0 right-0 px-4 py-1.5 bg-indigo-500/10 text-indigo-400 text-[8px] font-black uppercase tracking-widest rounded-bl-2xl border-l border-b border-indigo-500/20">
                            ${sprintText}
                        </div>

                        ${isAdmin ? `
                        <button onclick="event.stopPropagation(); adminDeleteHistoryMeeting('${doc.id}')" title="Delete Permanent" class="absolute top-10 right-2 w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all flex items-center justify-center z-20">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                        ` : ''}

                        <div class="flex justify-between items-start mb-6">
                            <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                                <i data-lucide="video" class="w-6 h-6"></i>
                            </div>
                        </div>
                        <h4 class="text-lg font-black text-white mb-2">${m.title}</h4>
                        <div class="flex items-center space-x-4 mb-4">
                            <div class="flex items-center space-x-1.5 text-gray-500">
                                <i data-lucide="calendar" class="w-3 h-3"></i>
                                <span class="text-[9px] font-bold uppercase tracking-widest">${dateStr}</span>
                            </div>
                            <div class="flex items-center space-x-1.5 text-gray-500">
                                <i data-lucide="clock" class="w-3 h-3"></i>
                                <span class="text-[9px] font-bold uppercase tracking-widest">${duration}</span>
                            </div>
                        </div>
                        <div class="pt-4 border-t border-white/5 flex justify-between items-center">
                            <div class="flex items-center space-x-2">
                                <div class="flex -space-x-2">
                                    ${Array(Math.min(3, m.memberCount || 0)).fill(0).map(() => `
                                        <div class="w-6 h-6 rounded-full bg-white/5 border border-gray-900 flex items-center justify-center">
                                            <i data-lucide="user" class="w-3 h-3 text-gray-500"></i>
                                        </div>
                                    `).join('')}
                                </div>
                                <span class="text-[9px] font-black uppercase tracking-widest text-gray-500">${m.memberCount || 0} Joined</span>
                            </div>
                            <span class="text-[8px] font-black uppercase tracking-widest text-indigo-400 font-black">View Report</span>
                        </div>
                    `;
                    list.appendChild(card);
                });
                refreshIcons();
            }, e => {
                console.error("History Stream Error:", e);
            });
    } catch (e) {
        console.error("Error setting up meeting history listener:", e);
    }
}

function formatHistoryDuration(s) {
    if (s < 60) return `${s}s`;
    const mins = Math.floor(s / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}m`;
}

// Update init to include history
const originalInit = initMembersApp;
initMembersApp = function() {
    originalInit();
    renderMeetingHistory();
    renderInvitations();
};

/**
 * ADMIN: Delete Meeting from History
 */
async function adminDeleteHistoryMeeting(mId) {
    if (typeof isAdminActive !== 'function' || !isAdminActive()) return;

    const confirmDelete = confirm("CRITICAL: This will permanently remove this meeting record from history. Continue?");
    if (!confirmDelete) return;

    try {
        await db.collection('meetings').doc(mId).delete();
        if (typeof showNotification === 'function') {
            showNotification("Meeting Purged from History");
        }
        renderMeetingHistory();
    } catch (e) {
        console.error("Admin History Delete Error:", e);
        if (typeof showNotification === 'function') {
            showNotification("Purge failed", true);
        }
    }
}

/**
 * INVITATION SYSTEM
 */
function openInviteModal() {
    openGenericModal('invite');
}

async function handleInviteSubmit(e) {
    if (e) e.preventDefault();
    
    const roleInput = document.getElementById('i-role');
    const role = roleInput.value ? roleInput.value.trim() : 'Member';
    const projId = localStorage.getItem('tt_project');
    const projName = document.getElementById('selected-project-title') ? document.getElementById('selected-project-title').innerText : 'Project';
    
    // Check if current user info is available (as inviter)
    const inviterName = auth.currentUser ? (auth.currentUser.displayName || auth.currentUser.email) : "Project Admin";

    try {
        const inviteRef = db.collection('invitations').doc();
        const inviteData = {
            id: inviteRef.id,
            projectId: projId,
            projectName: projName,
            inviterName: inviterName,
            role: role || 'Member',
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt: firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) // 7 days
        };

        await inviteRef.set(inviteData);
        
        // Show the link
        const inviteUrl = `${window.location.origin}${window.location.pathname.replace('team.html', 'invite.html')}?id=${inviteRef.id}`;
        document.getElementById('i-link').value = inviteUrl;
        document.getElementById('invite-link-container').classList.remove('hidden');
        document.getElementById('invite-submit-btn').classList.add('hidden');
        
        showNotification("Invitation link generated!");
    } catch (err) {
        console.error("Invite Error:", err);
        showNotification("Failed to generate invite: " + err.message, true);
    }
}

function copyInviteLink() {
    const linkInput = document.getElementById('i-link');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(linkInput.value);
    showNotification("Link copied to clipboard!");
}

function copyExistingInvite(id) {
    const inviteUrl = `${window.location.origin}${window.location.pathname.replace('team.html', 'invite.html')}?id=${id}`;
    navigator.clipboard.writeText(inviteUrl);
    showNotification("Invite link copied!");
}

async function renderInvitations() {
    const section = document.getElementById('invitations-section');
    const list = document.getElementById('invitations-list');
    if (!section || !list) return;

    const projId = localStorage.getItem('tt_project');
    
    db.collection('invitations')
        .where('projectId', '==', projId)
        .where('status', '==', 'pending')
        .onSnapshot(snap => {
            if (snap.empty) {
                section.classList.add('hidden');
                return;
            }

            section.classList.remove('hidden');
            list.innerHTML = '';
            
            snap.forEach(doc => {
                const inv = doc.data();
                const card = document.createElement('div');
                card.className = "glass p-6 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-indigo-500/20 transition-all";
                
                const expires = inv.expiresAt ? inv.expiresAt.toDate().toLocaleDateString() : 'N/A';
                
                card.innerHTML = `
                    <div class="absolute top-0 right-0 px-3 py-1 bg-indigo-500/10 text-indigo-400 text-[8px] font-black uppercase tracking-widest rounded-bl-xl border-l border-b border-indigo-500/10">
                        Pending
                    </div>
                    <button onclick="deleteInvitation('${doc.id}')" class="absolute top-10 right-4 p-2 rounded-lg bg-red-500/5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-all">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                    <div class="flex items-center space-x-4 mb-4">
                        <div class="w-10 h-10 rounded-xl bg-indigo-500/5 flex items-center justify-center text-indigo-400">
                            <i data-lucide="mail" class="w-5 h-5 font-light"></i>
                        </div>
                        <div>
                            <p class="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-0.5">Role Requested</p>
                            <h4 class="text-sm font-bold text-white">${inv.role}</h4>
                        </div>
                    </div>
                    <div class="pt-4 border-t border-white/5 flex justify-between items-center">
                        <div class="flex items-center space-x-2">
                            <i data-lucide="calendar" class="w-3 h-3 text-gray-500"></i>
                            <span class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Expires ${expires}</span>
                        </div>
                        <button onclick="copyExistingInvite('${inv.id}')" class="text-[8px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300">Copy Link</button>
                    </div>
                `;
                list.appendChild(card);
            });
            refreshIcons();
        });
}

async function deleteInvitation(id) {
    if (!confirm("Cancel this invitation?")) return;
    try {
        await db.collection('invitations').doc(id).delete();
        showNotification("Invitation cancelled");
    } catch (err) {
        showNotification("Error: " + err.message, true);
    }
}

window.onload = initMembersApp;


