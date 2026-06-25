// meeting-overlay.js - Core logic for the global meeting room system
// Integrates Agora RTC for voice and Firestore for real-time analytics.

let agoraClient = null;
let localAudioTrack = null;
let meetingId = null;
let isHost = false;
let currentParticipantId = null;
let secondsSpokenLocally = 0;
let meetingStartTime = null;
let speakingSyncInterval = null;
let timerInterval = null;
let currentMeetingStatus = 'Waiting';
let meetingCreatorId = null; // Independent tracker for host identification
let meetingOverlaySprints = {}; // Local cache for sprints
let tempSelectedMeetingHostId = null; // To hide host in selection
let authMode = 'login'; // 'login' or 'signup'
let pendingMeetingMode = 'join'; // TRACKS INTENDED ACTION AFTER LOGIN

// Agora Config
const AGORA_APP_ID = "4802125ce1ce433daffa151e2450011b"; 
const PROD_URL = "https://tasktrace-todo.web.app"; // EX: "https://your-app.web.app" -> Put your Firebase URL here after hosting!
let channelName = "";

// Auth State Listener
auth.onAuthStateChanged(user => {
    console.log("Auth State Changed:", user ? user.email : "Logged Out");
    if (user) {
        // If logged in, maybe check if we already have a mapped member
        checkAutoIdentity(user.uid);
    }
});

/**
 * Main entry point called from common.js on page load or on manual join.
 * Checks for existing session or initializes a new one.
 */
async function initMeetingOverlay() {
    try {
        const projId = localStorage.getItem('tt_project');
        const membId = localStorage.getItem('tt_member');
        const membName = localStorage.getItem('tt_member_name') || "Member";

        if (!projId) return;

        // Detect specific meeting from URL
        const urlParams = new URLSearchParams(window.location.search);
        const urlMId = urlParams.get('mId');

        if (urlMId) {
            console.log("Specific meeting found in URL:", urlMId);
            meetingId = urlMId;
            // Force identity selection for invites
            localStorage.removeItem('tt_member');
            localStorage.removeItem('tt_member_name');
            localStorage.setItem('tt_is_waiting_for_meeting', 'true');
        }

        // 1. Invite Flow: If we have a specific meeting ID, open identity selection
        if (urlMId) {
            openMeetingOverlay('join');
            return;
        }

        // 2. Strict Auto-rejoin ONLY
        const activeMId = localStorage.getItem('tt_active_meeting_id');
        if (membId && activeMId) {
            currentParticipantId = membId;
            const doc = await db.collection('meetings').doc(activeMId).get();
            
            if (doc.exists && (doc.data().status === 'Waiting' || doc.data().status === 'Active')) {
                console.log("Auto-rejoining active session:", activeMId);
                await joinExistingMeeting(activeMId, membId, membName);

                const overlay = document.getElementById('meeting-overlay');
                if (overlay) {
                    overlay.classList.remove('hidden');
                    minimizeMeeting();
                    await setupAgora();
                    startLocalTimers();
                    refreshIcons();
                }
            } else {
                // Stale session
                localStorage.removeItem('tt_active_meeting_id');
            }
        }
    } catch (error) {
        console.error("Meeting Overlay Init Error:", error);
    }
}

/**
 * Triggered by the buttons in workspace.html.
 * @param {string} mode - 'create' or 'join'
 */
async function openMeetingOverlay(mode = 'join') {
    try {
        const isInvitePage = window.location.pathname.includes('invite.html');
        const projId = localStorage.getItem('tt_project');
        
        // AUTH GUARD FIRST - Ensure login works anywhere
        if (!auth.currentUser) {
            const overlay = document.getElementById('meeting-overlay');
            overlay.classList.remove('hidden', 'pointer-events-none');
            overlay.classList.add('bg-gray-950/95', 'backdrop-blur-2xl');
            document.body.style.overflow = 'hidden';
            showOverlayView('overlay-auth-view');
            return;
        }

        if (!isInvitePage && !projId) {
            showNotification("Please select a project first", true);
            return;
        }

        const overlay = document.getElementById('meeting-overlay');
        overlay.classList.remove('hidden', 'pointer-events-none');
        overlay.classList.add('bg-gray-950/95', 'backdrop-blur-2xl');
        document.body.style.overflow = 'hidden';

        if (meetingId) {
            // Check if meeting still exists/active before maximizing
            const doc = await db.collection('meetings').doc(meetingId).get();
            if (doc.exists && (doc.data().status === 'Waiting' || doc.data().status === 'Active')) {
                maximizeMeeting();
                return;
            } else {
                meetingId = null; // Clear stale ID
            }
        }

        // ENTRY LOGIC
        pendingMeetingMode = mode;

        if (mode === 'create') {
            showMeetingCreateForm();
        } else {
            // IF WE HAVE A SPECIFIC MEETING ID (INVITE), GO TO IDENTITY SELECTION DIRECTLY
            if (meetingId) {
                const doc = await db.collection('meetings').doc(meetingId).get();
                if (doc.exists && (doc.data().status === 'Waiting' || doc.data().status === 'Active')) {
                    const hostId = doc.data().creatorId;
                    selectMeetingToJoin(meetingId, hostId);
                    return;
                }
            }

            // If we're on invite page and just logged in, we don't need the welcome panel
            if (isInvitePage && !projId) {
                // Just keep the overlay open for auth or close it if already logged in
                if (auth.currentUser) closeMeetingOverlay(); 
                return;
            }

            showWelcomePanel();
        }

    } catch (error) {
        console.error("Open Meeting Error:", error);
        showNotification("Failed to launch meeting session", true);
    }
}

async function showWelcomePanel() {
    showOverlayView('overlay-welcome-view');
    renderWelcomeGrid();
}

async function renderWelcomeGrid() {
    const projId = localStorage.getItem('tt_project');
    const welcomeGrid = document.getElementById('overlay-welcome-grid');
    const newMeetingBtn = document.getElementById('welcome-new-meeting-btn');
    if (!welcomeGrid || !projId) return;

    // Remove old meeting cards keep the "New Meeting" button
    const oldCards = welcomeGrid.querySelectorAll('.meeting-card');
    oldCards.forEach(c => c.remove());

    const meetingsRef = db.collection('meetings');
    const query = await meetingsRef
        .where('projectId', '==', projId)
        .where('status', 'in', ['Waiting', 'Active'])
        .get();

    const meetings = [];
    query.forEach(doc => {
        meetings.push({ id: doc.id, ...doc.data() });
    });

    // Manual sort: Newly created at top
    meetings.sort((a, b) => {
        const timeA = a.createdAt ? (a.createdAt.seconds || 0) : 0;
        const timeB = b.createdAt ? (b.createdAt.seconds || 0) : 0;
        return timeB - timeA;
    });

    meetings.forEach(m => {
        const card = document.createElement('div');
        card.className = "meeting-card glass p-8 rounded-[40px] border border-white/5 flex flex-col justify-between hover:bg-white/5 hover:border-emerald-500/30 transition-all group cursor-pointer active:scale-95 animate-fadeIn min-h-[220px]";
        const isAdmin = typeof isAdminActive === 'function' && isAdminActive();
        card.onclick = () => selectMeetingToJoin(m.id, m.creatorId);
        card.innerHTML = `
            <div class="relative z-10">
                <div class="flex justify-between items-start mb-6">
                    <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                        <i data-lucide="video" class="w-6 h-6"></i>
                    </div>
                    <span class="px-3 py-1 bg-emerald-500 text-gray-950 text-[8px] font-black uppercase tracking-widest rounded-lg">${m.status}</span>
                </div>
                <h3 class="text-xl font-black text-white mb-2 line-clamp-1">${m.title}</h3>
                <p class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">${m.sprintName || 'General Sync'}</p>
            </div>

            ${isAdmin ? `
            <div class="absolute top-4 right-4 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button onclick="event.stopPropagation(); adminForceEndMeeting('${m.id}')" title="Force End" class="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 transition-all flex items-center justify-center">
                    <i data-lucide="circle-stop" class="w-4 h-4"></i>
                </button>
                <button onclick="event.stopPropagation(); adminDeleteMeeting('${m.id}')" title="Delete Permanent" class="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all flex items-center justify-center">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
            ` : ''}

            <div class="pt-6 border-t border-white/5 flex items-center justify-between relative z-10">
                <div class="flex items-center space-x-2">
                    <i data-lucide="users" class="w-3 h-3 text-gray-500"></i>
                    <span class="text-[9px] font-black text-white uppercase">${m.memberCount || 0} Members</span>
                </div>
                <span class="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Join Session</span>
            </div>
        `;
        welcomeGrid.insertBefore(card, newMeetingBtn);
    });
    refreshIcons();
}

function selectMeetingToJoin(mId, hostId) {
    meetingId = mId;
    tempSelectedMeetingHostId = hostId;
    showOverlayView('overlay-login-view');
    renderOverlayLoginGrid();
}

function showOverlayView(id) {
    const views = ['overlay-auth-view', 'overlay-welcome-view', 'overlay-login-view', 'overlay-create-view', 'meeting-maximized', 'overlay-report-view'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
}

// --- AUTH HANDLERS ---
function toggleAuthMode() {
    authMode = authMode === 'login' ? 'signup' : 'login';
    document.getElementById('auth-title').innerText = authMode === 'login' ? 'Secure Access' : 'Create Account';
    document.getElementById('auth-subtitle').innerText = authMode === 'login' ? 'Authentication required for voice tasks' : 'Join the elite TaskTrace network';
    document.getElementById('auth-submit-btn').innerText = authMode === 'login' ? 'Log In' : 'Register Now';
    document.getElementById('auth-toggle-btn').innerText = authMode === 'login' ? 'Need an account? Sign Up' : 'Already have an account? Log In';
    refreshIcons();
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const btn = document.getElementById('auth-submit-btn');
    const originalText = btn.innerText;

    btn.disabled = true;
    btn.innerText = "Processing...";

    try {
        const todayStr = new Date().toDateString();
        if (authMode === 'login') {
            localStorage.setItem('tt_last_auth_date', todayStr);
            await auth.signInWithEmailAndPassword(email, password);
            showNotification("Access Granted. Welcome back!");
        } else {
            localStorage.setItem('tt_last_auth_date', todayStr);
            await auth.createUserWithEmailAndPassword(email, password);
            showNotification("Account Created! Select your profile.");
        }
        // State listener will trigger checkAutoIdentity
        const p = window.location.pathname;
        if (p.includes('invite.html') || p.includes('team.html') || p.includes('index.html') || p.endsWith('/')) {
            closeMeetingOverlay();
        }
    } catch (err) {
        console.error("Auth Error:", err);
        showNotification(err.message, true);
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

/**
 * Log Out
 */
async function handleLogout() {
    try {
        await auth.signOut();
        // Clear local member state
        localStorage.removeItem('tt_member');
        localStorage.removeItem('tt_member_name');
        localStorage.removeItem('tt_active_meeting_id');
        
        showNotification("Signed out successfully");
        
        // If overlay is open, we might want to show auth screen or close it
        const overlay = document.getElementById('meeting-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            showOverlayView('overlay-auth-view');
        }
    } catch (error) {
        console.error("Logout Error:", error);
        showNotification("Failed to sign out", true);
    }
}

async function checkAutoIdentity(uid) {
    const projId = localStorage.getItem('tt_project');
    if (!projId) return;

    database.ref(`projects/${projId}/members`).once('value', snap => {
        const members = snap.val() || {};
        const myMemberId = Object.keys(members).find(id => members[id].linkedUid === uid);

        if (myMemberId) {
            console.log("Auto-identified as member:", myMemberId);
            currentParticipantId = myMemberId;
            localStorage.setItem('tt_member', myMemberId);
            localStorage.setItem('tt_member_name', members[myMemberId].name);
            
            // If we were on the auth screen, move forward
            const authView = document.getElementById('overlay-auth-view');
            if (authView && !authView.classList.contains('hidden')) {
                if (pendingMeetingMode === 'create') {
                    showMeetingCreateForm();
                } else {
                    showWelcomePanel();
                }
            }
        } else {
            // Logged in but no member linked yet -> Show welcome or login grid
            const authView = document.getElementById('overlay-auth-view');
            if (authView && !authView.classList.contains('hidden')) {
                if (pendingMeetingMode === 'create') {
                    showMeetingCreateForm();
                } else {
                    showWelcomePanel();
                }
            }
        }
    });
}


/**
 * Identify Yourself (Login As)
 */
function renderOverlayLoginGrid() {
    const projId = localStorage.getItem('tt_project');
    const grid = document.getElementById('overlay-login-grid');
    if (!grid || !projId) return;

    grid.innerHTML = '<div class="col-span-full py-10 text-center text-gray-500 animate-pulse uppercase tracking-widest text-[10px] font-black">Loading Team...</div>';

    database.ref(`projects/${projId}/members`).once('value', snap => {
        const members = snap.val() || {};
        grid.innerHTML = '';

        Object.keys(members).forEach(id => {
            const m = members[id];
            
            // Host Protection
            if (id === tempSelectedMeetingHostId) return;

            // Check if member is already linked to someone else
            const isOwnedByMe = auth.currentUser && m.linkedUid === auth.currentUser.uid;
            const isOwnedByOther = m.linkedUid && (!auth.currentUser || m.linkedUid !== auth.currentUser.uid);

            const card = document.createElement('div');
            card.className = `glass p-8 rounded-[32px] border flex flex-col items-center text-center transition-all group active:scale-95 animate-fadeIn relative overflow-hidden ${isOwnedByOther ? 'opacity-40 cursor-not-allowed grayscale' : 'cursor-pointer hover:bg-white/5 hover:border-indigo-500/30 border-white/5'}`;
            
            if (!isOwnedByOther) {
                card.onclick = () => selectMemberForMeeting(id, m.name);
            }

            card.innerHTML = `
                ${isOwnedByMe ? '<div class="absolute top-4 right-4 text-emerald-400"><i data-lucide="check-circle-2" class="w-4 h-4"></i></div>' : ''}
                <div class="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative">
                    <i data-lucide="user" class="w-8 h-8 ${isOwnedByMe ? 'text-emerald-400' : 'text-gray-500'} group-hover:text-indigo-400 transition-colors"></i>
                </div>
                <h3 class="text-sm font-black text-white group-hover:text-indigo-400 transition-colors">${m.name}</h3>
                <p class="text-[8px] font-bold text-gray-600 uppercase tracking-widest mt-1">${isOwnedByOther ? 'Profile Claimed' : m.role}</p>
            `;
            grid.appendChild(card);
        });
        refreshIcons();
    });
}

async function selectMemberForMeeting(id, name) {
    currentParticipantId = id;
    localStorage.setItem('tt_member', id);
    localStorage.setItem('tt_member_name', name);

    // LINK UID TO MEMBER
    if (auth.currentUser) {
        const projId = localStorage.getItem('tt_project');
        await database.ref(`projects/${projId}/members/${id}`).update({
            linkedUid: auth.currentUser.uid
        });
    }

    // Check for active meeting
    const projId = localStorage.getItem('tt_project');
    const meetingsRef = db.collection('meetings');
    const activeQuery = await meetingsRef
        .where('projectId', '==', projId)
        .where('status', 'in', ['Waiting', 'Active'])
        .limit(1)
        .get();

    // If we already have a specific meetingId (from Welcome Panel), use it!
    const targetMeetingId = meetingId || (activeQuery.empty ? null : activeQuery.docs[0].id);

    if (!targetMeetingId) {
        showMeetingCreateForm();
    } else {
        showOverlayView('meeting-maximized');
        await joinExistingMeeting(targetMeetingId, id, name);
        
        // Ensure currentMeetingStatus is updated before setupAgora
        currentMeetingStatus = await getMeetingStatus();
        
        try {
            await setupAgora();
        } catch (agoraError) {
            console.error("Agora Join Failed:", agoraError);
            showNotification("Voice connection failed.", true);
        }

        startLocalTimers();
        // Clear wait flag if we successfully selected a member
        localStorage.removeItem('tt_is_waiting_for_meeting');
        refreshIcons();
    }
}

/**
 * Creation Form Logic
 */
function showMeetingCreateForm() {
    showOverlayView('overlay-create-view');

    const titleInput = document.getElementById('m-title');
    const dateInput = document.getElementById('m-date');
    const timeInput = document.getElementById('m-time');
    const sprintSelect = document.getElementById('m-sprint');

    // Default values
    const now = new Date();
    titleInput.value = `${localStorage.getItem('tt_project_name')} Sync`;
    dateInput.value = now.toISOString().split('T')[0];
    timeInput.value = now.toTimeString().slice(0, 5);

    // FIX: Show picker when clicking ANYWHERE in the field
    [dateInput, timeInput].forEach(input => {
        input.addEventListener('click', () => {
            if (typeof input.showPicker === 'function') {
                input.showPicker();
            }
        });
    });

    // Populate Sprints
    sprintSelect.innerHTML = '<option value="None" class="bg-gray-900">General Sync (No Sprint)</option>';

    // Fetch sprints if not already loaded
    if (Object.keys(meetingOverlaySprints).length === 0) {
        const projId = localStorage.getItem('tt_project');
        database.ref(`projects/${projId}/sprints`).once('value', snap => {
            meetingOverlaySprints = snap.val() || {};
            // Re-render options
            renderSprintOptions(sprintSelect);
        });
    } else {
        renderSprintOptions(sprintSelect);
    }
}

function renderSprintOptions(selectEl) {
    selectEl.innerHTML = '<option value="None" class="bg-gray-900">General Sync (No Sprint)</option>';
    Object.keys(meetingOverlaySprints).forEach(sid => {
        const s = meetingOverlaySprints[sid];
        const opt = document.createElement('option');
        opt.value = sid;
        opt.className = "bg-gray-900";
        // FIX: Display sprint name correctly (often sid is the number or name itself)
        const displayName = s.name || (isNaN(parseInt(sid)) ? sid : `Sprint ${sid}`);
        opt.innerText = displayName;
        selectEl.appendChild(opt);
    });
}

async function saveMeetingAndJoin() {
    const title = document.getElementById('m-title').value.trim();
    const date = document.getElementById('m-date').value;
    const time = document.getElementById('m-time').value;
    const sprintId = document.getElementById('m-sprint').value;

    if (!title || !date || !time) {
        showNotification("Please fill all fields", true);
        return;
    }

    const projId = localStorage.getItem('tt_project');
    const projName = localStorage.getItem('tt_project_name') || "Project";
    const membId = localStorage.getItem('tt_member');
    const membName = localStorage.getItem('tt_member_name');

    if (!membId) {
        showNotification("Please select your member identity first", true);
        showWelcomePanel();
        return;
    }

    let sprintName = "None";
    if (sprintId !== "None" && meetingOverlaySprints[sprintId]) {
        sprintName = meetingOverlaySprints[sprintId].name || "Unnamed Sprint";
    }

    isHost = true;
    const newMeeting = {
        title: title,
        date: date,
        time: time,
        startTime: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'Waiting',
        projectId: projId,
        creatorId: membId,
        sprintId: sprintId,
        sprintName: sprintName,
        memberCount: 1
    };

    try {
        const docRef = await db.collection('meetings').add(newMeeting);
        meetingId = docRef.id;
        localStorage.setItem('tt_active_meeting_id', meetingId);

        await setupParticipantRecord(membId, membName);

        showOverlayView('meeting-maximized');
        updateOverlayUI(newMeeting.title, newMeeting.date, 'Waiting', newMeeting.creatorId);

        try {
            await setupAgora();
        } catch (agoraError) {
            console.error("Agora Setup Failed:", agoraError);
            showNotification("Voice connection failed. Check your Agora App ID.", true);
        }

        startLocalTimers();
        listenToParticipants(); // CRITICAL: Start listening immediately so host sees themselves
        listenForMeetingEvents();
        refreshIcons();

        showNotification("Meeting Initialized!");
    } catch (error) {
        console.error("Save Meeting Error:", error);
        showNotification("Failed to create meeting", true);
    }
}

async function startNewMeeting(projId, projName, membId, membName) {
    // This function is now superseded by saveMeetingAndJoin
    // but kept for compatibility if called elsewhere.
}

async function joinExistingMeeting(id, membId, membName) {
    meetingId = id;
    localStorage.setItem('tt_active_meeting_id', meetingId);

    const doc = await db.collection('meetings').doc(meetingId).get();
    const data = doc.data();

    // Allow joining if Waiting or Active
    if (data.status === 'Completed') {
        localStorage.removeItem('tt_active_meeting_id');
        return;
    }

    isHost = (data.creatorId === membId);

    // Check if participant already exists and is online
    const pDoc = await db.collection('meetings').doc(meetingId).collection('participants').doc(membId).get();
    if (!pDoc.exists || !pDoc.data().isOnline) {
        await db.collection('meetings').doc(meetingId).update({
            memberCount: firebase.firestore.FieldValue.increment(1)
        });
        await setupParticipantRecord(membId, membName);
    }

    updateOverlayUI(data.title, data.date, data.status, data.creatorId);
    meetingStartTime = data.startTime ? data.startTime.toDate() : new Date();

    listenToParticipants();
    listenForMeetingEvents();
}

async function setupParticipantRecord(membId, membName) {
    await db.collection('meetings').doc(meetingId).collection('participants').doc(membId).set({
        name: membName,
        role: isHost ? 'Host' : 'Member',
        secondsSpoken: 0,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
        isOnline: true
    }, { merge: true });
}

function updateOverlayUI(title, date, status, docCreatorId = null) {
    if (docCreatorId) meetingCreatorId = docCreatorId;

    // Critical: Identify as host if current member matches creator
    const currentMId = currentParticipantId || localStorage.getItem('tt_member');
    if (meetingCreatorId && currentMId) {
        isHost = (meetingCreatorId === currentMId);
    }

    const titleEl = document.getElementById('overlay-meeting-title');
    const dateEl = document.getElementById('overlay-meeting-date');
    if (titleEl) titleEl.innerText = title;
    if (dateEl) dateEl.innerText = date;

    const lobbyControls = document.getElementById('lobby-controls');
    const lobbyTag = document.getElementById('lobby-status-tag');
    const btnStart = document.getElementById('overlay-btn-start');
    const btnLeave = document.getElementById('overlay-btn-leave');
    const btnEnd = document.getElementById('overlay-btn-end');

    if (status === 'Waiting') {
        if (lobbyControls) lobbyControls.classList.remove('hidden');
        if (lobbyTag) lobbyTag.classList.remove('hidden');
        if (btnLeave) btnLeave.classList.remove('hidden');
        if (btnEnd) btnEnd.classList.add('hidden');

        if (isHost) {
            if (btnStart) btnStart.classList.remove('hidden');
        } else {
            if (btnStart) btnStart.classList.add('hidden');
        }
    } else {
        // Active status
        if (lobbyControls) lobbyControls.classList.add('hidden');
        if (lobbyTag) lobbyTag.classList.add('hidden');

        if (isHost) {
            if (btnEnd) btnEnd.classList.remove('hidden');
            if (btnLeave) btnLeave.classList.add('hidden');
        } else {
            if (btnEnd) btnEnd.classList.add('hidden');
            if (btnLeave) btnLeave.classList.remove('hidden');
        }
    }
}

/**
 * Start Meeting Session (Host only)
 */
async function startMeetingSession() {
    if (!isHost || !meetingId) return;

    try {
        await db.collection('meetings').doc(meetingId).update({
            status: 'Active',
            startedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showNotification("Meeting started! Recording participation.");
    } catch (error) {
        console.error("Start Meeting Error:", error);
        showNotification("Failed to start session", true);
    }
}

/**
 * Share Meeting Link
 * Automatically detects if running locally or in production.
 */
function shareMeetingLink() {
    const projId = localStorage.getItem('tt_project');
    const projName = localStorage.getItem('tt_project_name') || "Project";

    if (!projId) {
        showNotification("No project selected to share", true);
        return;
    }

    // Smart URL Detection
    let baseUrl;
    if (PROD_URL && PROD_URL.startsWith('http')) {
        // Use the manually set production URL if available
        baseUrl = PROD_URL.endsWith('/') ? PROD_URL.slice(0, -1) : PROD_URL;
    } else {
        // Fallback: Detect automatically from browser location
        // Removes '/pages/team.html' etc to get the root directory
        baseUrl = window.location.origin + window.location.pathname.split('/pages/')[0];
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    }

    // Use team.html for invite links so they land directly on member selection
    // Include the specific meetingId so they join YOUR meeting
    const joinUrl = `${baseUrl}/pages/team.html?projId=${projId}&mId=${meetingId}`;
    const message = `Join my voice meeting for *${projName}* on TaskTrace!\n\nStep 1: Select your profile\nStep 2: You'll be automatically joined to the voice session.\n\nClick here to join: ${joinUrl}`;

    // Copy to clipboard
    navigator.clipboard.writeText(joinUrl).then(() => {
        showNotification("Link copied to clipboard!");

        // Professional System Notification (using confirm as placeholder for professional UI)
        const openWA = confirm("Invite link copied to clipboard!\n\nWould you like to open WhatsApp to share it with your team?");
        if (openWA) {
            window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
        }
    }).catch(err => {
        console.error("Clipboard Error:", err);
        // Fallback: just open WhatsApp if clipboard fails
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    });
}

/**
 * Agora RTC Setup
 */
async function setupAgora() {
    if (agoraClient) return; // Already setup

    if (!AGORA_APP_ID || AGORA_APP_ID.length < 10) {
        throw new Error("Invalid Agora App ID. Please set it in meeting-overlay.js");
    }

    agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

    // Join Channel - Unique per meeting
    const agoraChannel = `meeting_${meetingId}`;
    await agoraClient.join(AGORA_APP_ID, agoraChannel, null, currentParticipantId);

    // Create & Publish Audio Track
    try {
        localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        await agoraClient.publish([localAudioTrack]);
        // Disable by default (Muted)
        await localAudioTrack.setEnabled(false);
    } catch (micError) {
        console.warn("Microphone access delayed or denied:", micError);
        showNotification("Microphone required for voice. Please enable in settings.", true);
    }

    // Event Listeners for remote users
    agoraClient.on("user-published", async (user, mediaType) => {
        handleUserPublished(user, mediaType);
    });

    agoraClient.remoteUsers.forEach(user => {
        if (user.hasAudio) handleUserPublished(user, "audio");
    });

    // Volume Indicator Setup
    AgoraRTC.setParameter("AUDIO_VOLUME_INDICATION_INTERVAL", 500);
    agoraClient.enableAudioVolumeIndicator();

    agoraClient.on("volume-indicator", volumes => {
        volumes.forEach(volume => {
            const isMe = volume.uid === currentParticipantId || volume.uid === agoraClient.uid;

            if (currentMeetingStatus === 'Active') {
                const card = document.getElementById(`participant-${volume.uid}`);
                const wave = document.getElementById(`wave-${volume.uid}`);
                
                if (card && wave) {
                    if (volume.level > 10) {
                        card.classList.add('is-speaking');
                        wave.classList.add('active');
                        if (isMe) secondsSpokenLocally += 0.5;
                    } else {
                        card.classList.remove('is-speaking');
                        wave.classList.remove('active');
                    }
                }
            }
        });
    });
}

async function handleUserPublished(user, mediaType) {
    if (mediaType === "audio") {
        await agoraClient.subscribe(user, mediaType);
        console.log("Subscribed to remote audio for user:", user.uid);
        try {
            user.audioTrack.play();
        } catch (playError) {
            console.warn("Audio playback blocked. Interactive required.");
            showNotification("Audio blocked. Tap anywhere to enable sound.", true);
            
            const enableAudio = () => {
                user.audioTrack.play()
                    .then(() => {
                        document.removeEventListener('click', enableAudio);
                        document.removeEventListener('touchstart', enableAudio);
                    })
                    .catch(e => console.error("Interaction still blocked:", e));
            };
            document.addEventListener('click', enableAudio);
            document.addEventListener('touchstart', enableAudio);
        }
    }
}

async function getMeetingStatus() {
    if (!meetingId) return 'Waiting';
    const doc = await db.collection('meetings').doc(meetingId).get();
    return doc.exists ? doc.data().status : 'Waiting';
}

function startLocalTimers() {
    // Sync speaking time to Firestore every 5 seconds
    speakingSyncInterval = setInterval(syncSpeakingTime, 5000);

    // Update meeting duration timer
    timerInterval = setInterval(() => {
        if (!meetingStartTime) return;

        if (currentMeetingStatus === 'Active') {
            const diff = Math.floor((new Date() - meetingStartTime) / 1000);
            const formatted = formatSeconds(diff);
            document.getElementById('overlay-meeting-timer').innerText = formatted;
            document.getElementById('minimized-timer').innerText = formatted.substring(3);
        } else {
            document.getElementById('overlay-meeting-timer').innerText = "00:00:00";
            document.getElementById('minimized-timer').innerText = "Lobby";
        }
    }, 1000);
}

async function syncSpeakingTime() {
    const status = await getMeetingStatus();
    if (status !== 'Active') return; // Don't sync spoken time in lobby

    if (secondsSpokenLocally > 0 && meetingId) {
        try {
            await db.collection('meetings').doc(meetingId)
                .collection('participants').doc(currentParticipantId)
                .update({
                    secondsSpoken: firebase.firestore.FieldValue.increment(secondsSpokenLocally)
                });
            secondsSpokenLocally = 0;
        } catch (e) {
            console.error("Sync Error:", e);
        }
    }
}

function listenToParticipants() {
    db.collection('meetings').doc(meetingId).collection('participants')
        .onSnapshot(snapshot => {
            const grid = document.getElementById('overlay-participants-grid');
            let count = 0;

            snapshot.forEach(doc => {
                const p = doc.data();
                if (!p.isOnline && !isHost && currentMeetingStatus !== 'Completed') return;

                count++;
                let pEl = document.getElementById(`participant-${doc.id}`);
                if (!pEl) {
                    pEl = document.createElement('div');
                    pEl.id = `participant-${doc.id}`;
                    pEl.className = 'participant-card glass p-8 rounded-[40px] border border-white/5 flex flex-col items-center text-center space-y-6 animate-fadeIn transition-all duration-500';
                    grid.appendChild(pEl);
                }

                const statusText = currentMeetingStatus === 'Waiting' ? 'Waiting in lobby' : formatDetailedTime(p.secondsSpoken) + ' contributed';

                pEl.innerHTML = `
                    <div class="relative">
                        <div class="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center border border-white/5 shadow-inner transition-transform group-hover:scale-105">
                            <i data-lucide="user" class="w-10 h-10 text-gray-500"></i>
                        </div>
                        ${(p.role === 'Host' || doc.id === meetingCreatorId) ? '<div class="absolute -top-3 -right-3 bg-amber-500 text-gray-900 text-[9px] font-black px-3 py-1.5 rounded-xl shadow-xl uppercase tracking-widest border-2 border-gray-950">Host</div>' : ''}
                        ${p.isOnline ? '<div class="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-4 border-gray-950 shadow-lg"></div>' : ''}
                    </div>

                    <div id="wave-${doc.id}" class="speaking-wave">
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                    </div>

                    <div class="space-y-1">
                        <p class="text-xs font-black uppercase tracking-[0.2em] text-white brightness-125">${p.name}</p>
                        <p class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">${statusText}</p>
                    </div>
                `;
            });
            document.getElementById('overlay-participant-count').innerText = count;
            refreshIcons();
        });
}

function listenForMeetingEvents() {
    db.collection('meetings').doc(meetingId).onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            currentMeetingStatus = data.status;
            updateOverlayUI(data.title, data.date, data.status, data.creatorId);

            if (data.status === 'Completed') {
                showFinalReport();
            } else if (data.status === 'Active' && data.startedAt) {
                meetingStartTime = data.startedAt.toDate();
            }
        }
    });
}

/**
 * Overlay View Controls
 */
function minimizeMeeting() {
    const overlay = document.getElementById('meeting-overlay');
    const maximized = document.getElementById('meeting-maximized');
    const minimized = document.getElementById('meeting-minimized');

    if (overlay) {
        overlay.classList.remove('bg-gray-950/95', 'backdrop-blur-2xl');
        overlay.classList.add('pointer-events-none');
    }

    if (maximized) maximized.classList.add('hidden');
    if (minimized) {
        minimized.classList.remove('hidden');
        minimized.classList.add('pointer-events-auto');
    }
    document.body.style.overflow = '';
}

function maximizeMeeting() {
    const overlay = document.getElementById('meeting-overlay');
    const maximized = document.getElementById('meeting-maximized');
    const minimized = document.getElementById('meeting-minimized');
    const report = document.getElementById('overlay-report-view');

    // Only maximize if not in report view
    if (report && !report.classList.contains('hidden')) return;

    if (overlay) {
        overlay.classList.add('bg-gray-950/95', 'backdrop-blur-2xl');
        overlay.classList.remove('pointer-events-none');
    }

    if (maximized) maximized.classList.remove('hidden');
    if (minimized) minimized.classList.add('hidden');

    document.body.style.overflow = 'hidden';
}

async function toggleOverlayMic() {
    if (!localAudioTrack) return;

    const isEnabled = localAudioTrack.enabled;
    await localAudioTrack.setEnabled(!isEnabled);

    const icon = document.getElementById('overlay-icon-mic');
    const minIcon = document.getElementById('minimized-icon-mic');
    const globalIcon = document.getElementById('overlay-global-mic-icon');
    const minIndicator = document.getElementById('minimized-mic-indicator');
    const text = document.getElementById('overlay-mic-status-text');

    if (!isEnabled) {
        // Unmuted
        icon.setAttribute('data-lucide', 'mic');
        minIcon.setAttribute('data-lucide', 'mic');
        globalIcon.classList.add('text-emerald-500');
        minIndicator.classList.add('hidden');
        text.innerText = "Speaking";
        text.classList.remove('text-gray-500');
        text.classList.add('text-emerald-500');
    } else {
        // Muted
        icon.setAttribute('data-lucide', 'mic-off');
        minIcon.setAttribute('data-lucide', 'mic-off');
        globalIcon.classList.remove('text-emerald-500');
        minIndicator.classList.remove('hidden');
        text.innerText = "Muted";
        text.classList.add('text-gray-500');
        text.classList.remove('text-emerald-500');
    }
    refreshIcons();
}

/**
 * Robust Retry for Agora (useful for mobile)
 */
async function retryAgoraConnection() {
    if (agoraClient) {
        await cleanupMeetingSession();
    }
    try {
        await setupAgora();
        showNotification("Voice connection restored!");
    } catch (e) {
        showNotification("Retry failed. Please check mic permissions.", true);
    }
}

async function handleOverlayLeave() {
    const confirmed = confirm("Are you sure you want to leave the session?");
    if (!confirmed) return;

    await syncSpeakingTime();

    const membId = localStorage.getItem('tt_member');
    await db.collection('meetings').doc(meetingId).collection('participants').doc(membId).update({
        isOnline: false,
        leftAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await cleanupMeetingSession();
    closeMeetingOverlay();
}

async function confirmEndOverlayMeeting() {
    if (!isHost) return;

    const confirmed = confirm("HOST ACTION: End this meeting for all participants?");
    if (!confirmed) return;

    await syncSpeakingTime();

    const duration = Math.floor((new Date() - meetingStartTime) / 1000);

    await db.collection('meetings').doc(meetingId).update({
        status: 'Completed',
        endTime: firebase.firestore.FieldValue.serverTimestamp(),
        totalDuration: duration
    });
    
    // showMeetingReport will be triggered automatically via listenForMeetingEvents

    // Host offline status will be handled by showFinalReport through the listener
}

async function cleanupMeetingSession() {
    if (localAudioTrack) {
        localAudioTrack.stop();
        localAudioTrack.close();
    }
    if (agoraClient) {
        await agoraClient.leave();
    }
    clearInterval(speakingSyncInterval);
    clearInterval(timerInterval);

    agoraClient = null;
    localAudioTrack = null;
    meetingId = null;
    meetingCreatorId = null;
    isHost = false;
    currentMeetingStatus = 'Waiting';
    localStorage.removeItem('tt_active_meeting_id');
    localStorage.removeItem('tt_is_waiting_for_meeting');
}

async function showMeetingReport(mId) {
    if (!mId) return;

    const maximized = document.getElementById('meeting-maximized');
    const report = document.getElementById('overlay-report-view');
    const minimized = document.getElementById('meeting-minimized');
    const welcome = document.getElementById('overlay-welcome-panel');

    // If we are currently in this meeting, cleanup
    if (mId === meetingId) {
        await cleanupMeetingSession();
    }

    if (maximized) maximized.classList.add('hidden');
    if (minimized) minimized.classList.add('hidden');
    if (welcome) welcome.classList.add('hidden');
    if (report) report.classList.remove('hidden');

    // Ensure overlay itself is visible
    const overlay = document.getElementById('meeting-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('bg-gray-950/95', 'backdrop-blur-2xl');
        overlay.classList.remove('pointer-events-none');
    }

    try {
        const doc = await db.collection('meetings').doc(mId).get();
        if (!doc.exists) return;
        const data = doc.data();

        document.getElementById('overlay-report-duration').innerText = formatSeconds(data.totalDuration || 0);
        document.getElementById('overlay-report-member-count').innerText = data.memberCount || 0;

        const participants = await db.collection('meetings').doc(mId).collection('participants')
            .orderBy('secondsSpoken', 'desc').get();

        const list = document.getElementById('overlay-report-members-list');
        list.innerHTML = '';

        participants.forEach(pDoc => {
            const p = pDoc.data();
            const row = document.createElement('div');
            row.className = 'px-10 py-8 border-b border-white/5 flex items-center justify-between hover:bg-white/[0.02] transition-colors group';
            row.innerHTML = `
                <div class="flex items-center space-x-6">
                    <div class="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500 border border-white/5 group-hover:border-indigo-500/30 transition-colors">
                        <i data-lucide="user" class="w-7 h-7"></i>
                    </div>
                    <div>
                        <p class="text-base font-black text-white brightness-110 mb-1">${p.name}</p>
                        <p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] group-hover:text-indigo-400 transition-colors">${p.role}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-2xl font-black text-indigo-400 mb-1">${formatDetailedTime(p.secondsSpoken || 0)}</p>
                    <p class="text-[9px] font-bold text-gray-600 uppercase tracking-widest leading-none">Speaking Contribution</p>
                </div>
            `;
            list.appendChild(row);
        });
        refreshIcons();
    } catch (e) {
        console.error("Report Load Error:", e);
    }
}

// Legacy alias for listener
async function showFinalReport() {
    if (meetingId) {
        showMeetingReport(meetingId);
    }
}

window.showMeetingReport = showMeetingReport;

function dismissOverlayReport() {
    closeMeetingOverlay();
    // Reset views for the next session
    document.getElementById('overlay-report-view').classList.add('hidden');
    document.getElementById('meeting-maximized').classList.remove('hidden');
    
    // Clear any remaining state
    meetingId = null;
}

function closeMeetingOverlay() {
    const overlay = document.getElementById('meeting-overlay');
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
}

// Helper: Format seconds to HH:MM:SS
function formatSeconds(s) {
    const totalSecs = Math.floor(s);
    const hrs = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
    const mins = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
}

// Helper: Format seconds to Xm Ys
function formatDetailedTime(s) {
    const totalSecs = Math.round(s);
    if (totalSecs < 60) return `${totalSecs}s`;
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}m ${secs}s`;
}

// Global Shortcuts
window.addEventListener('keydown', (e) => {
    // Windows Key + M (Meta + M)
    if (e.metaKey && e.key.toLowerCase() === 'm') {
        const overlay = document.getElementById('meeting-overlay');
        const loginView = document.getElementById('overlay-login-view');
        const createView = document.getElementById('overlay-create-view');

        // Only toggle mic if overlay is visible AND we are in an actual meeting view
        if (!overlay.classList.contains('hidden') && loginView.classList.contains('hidden') && createView.classList.contains('hidden')) {
            e.preventDefault();
            toggleOverlayMic();
        }
    }
});

/**
 * ADMIN: Force End Meeting
 */
async function adminForceEndMeeting(mId) {
    if (!isAdminActive()) return;
    
    const confirmEnd = confirm("ADMIN: Are you sure you want to FORCE END this session?");
    if (!confirmEnd) return;

    try {
        await db.collection('meetings').doc(mId).update({
            status: 'Completed',
            endedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showNotification("Meeting Force-Ended by Admin");
        renderWelcomeGrid();
    } catch (e) {
        console.error("Admin End Error:", e);
        showNotification("Action failed", true);
    }
}

/**
 * ADMIN: Delete Meeting Permanent
 */
async function adminDeleteMeeting(mId) {
    if (!isAdminActive()) return;

    const confirmDelete = confirm("CRITICAL: This will permanently remove the meeting record. Continue?");
    if (!confirmDelete) return;

    try {
        await db.collection('meetings').doc(mId).delete();
        showNotification("Meeting Purged from History");
        renderWelcomeGrid();
    } catch (e) {
        console.error("Admin Delete Error:", e);
        showNotification("Purge failed", true);
    }
}

// Auto-init on script load
initMeetingOverlay();
