// ==========================================
// AquaMinds - SPA Logic (Auth, Logs, Realtime, Chat)
// ==========================================

const SUPABASE_URL = "https://zszzknnvaqreqxwtffzz.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzenprbm52YXFyZXF4d3RmZnp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjE4ODIsImV4cCI6MjA4ODEzNzg4Mn0.2XRIO1HX9sqrU_PUZ6JxDtOtYaiJ9JwS_OqbFPe3ZWE";

let supabaseClient;
if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

let combinedChart = null; 
let lastReadingTime = null; 
let subscriptions = {}; 
let offlineCheckInterval = null;
let currentUser = null;

// Chat Variables
let selectedChatUserId = null;
let selectedChatUserName = null;
let allChatMessages = [];
let chatSubscription = null;

const el = {
    loader: document.getElementById('global-loader'),
    authView: document.getElementById('auth-view'),
    appView: document.getElementById('app-view'),
    sections: document.querySelectorAll('.view-section'),
    connectionStatus: document.getElementById('connection-status')
};

document.addEventListener('DOMContentLoaded', async () => {
    initTheme(); setupSidebar(); setupAuthForm(); setupNavigation();
    await checkAuth();
    setTimeout(() => { el.loader.style.opacity = '0'; setTimeout(() => el.loader.style.display = 'none', 500); }, 600);
});

function setupNavigation() {
    document.querySelectorAll('#nav-menu a[data-target]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(link.getAttribute('data-target'), link.parentElement);
            if (window.innerWidth <= 768) { document.getElementById('sidebar').classList.remove('active'); document.getElementById('overlay').classList.remove('active'); }
        });
    });
}

function switchView(targetId, activeNavLi = null) {
    el.sections.forEach(sec => { sec.classList.remove('active', 'fade-in'); });
    const targetSection = document.getElementById(targetId);
    if(targetSection) { targetSection.classList.add('active'); void targetSection.offsetWidth; targetSection.classList.add('fade-in'); }

    if (activeNavLi) { document.querySelectorAll('#nav-menu li').forEach(li => li.classList.remove('active')); activeNavLi.classList.add('active'); }
    if (targetId === 'view-analytics' && combinedChart) combinedChart.resize(); 
    if (targetId === 'view-users') { fetchUsersList(); fetchActivityLogs(); }
    if (targetId === 'view-chat') initAdminChat();
}

async function checkAuth() {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) { currentUser = data.session.user; showDashboard(); loadUserProfile(); } 
    else { showAuth(); }
}

function showAuth() { el.authView.style.display = 'flex'; el.appView.style.display = 'none'; stopDataServices(); }

function showDashboard() {
    el.authView.style.display = 'none'; el.appView.style.display = 'flex';
    initAnalyticsCharts(); subscribeRealtime(); fetchLatest();
    if(!offlineCheckInterval) offlineCheckInterval = setInterval(checkLocalOfflineStatus, 3000); 
}

function setupAuthForm() {
    const form = document.getElementById('auth-form'); if(!form) return;
    const email = document.getElementById('email'), pass = document.getElementById('password'), nameInput = document.getElementById('full-name'), msg = document.getElementById('auth-message'), btn = document.getElementById('submit-btn');
    let isSignUp = false;

    document.getElementById('toggle-auth').addEventListener('click', function() {
        isSignUp = !isSignUp;
        document.getElementById('name-field-container').style.display = isSignUp ? 'block' : 'none';
        document.getElementById('auth-title').textContent = isSignUp ? "Create Account" : "Welcome Back";
        btn.textContent = isSignUp ? "Sign Up" : "Login";
        this.innerHTML = isSignUp ? 'Already have an account? <span>Login</span>' : 'Don\'t have an account? <span>Sign Up</span>';
        msg.textContent = "";
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault(); btn.textContent = "Processing..."; btn.disabled = true; msg.textContent = "";
        let res = isSignUp 
            ? await supabaseClient.auth.signUp({ email: email.value, password: pass.value, options: { data: { full_name: nameInput.value } } })
            : await supabaseClient.auth.signInWithPassword({ email: email.value, password: pass.value });

        if (res.error) { msg.textContent = res.error.message; msg.style.color = "var(--danger)"; } 
        else if (isSignUp) { msg.textContent = "Account created! You can now login."; msg.style.color = "var(--success)"; setTimeout(() => document.getElementById('toggle-auth').click(), 2000); } 
        else { currentUser = res.data.user; showDashboard(); loadUserProfile(); }
        btn.textContent = isSignUp ? "Sign Up" : "Login"; btn.disabled = false;
    });

    document.getElementById('logout-btn')?.addEventListener('click', async (e) => { e.preventDefault(); await supabaseClient.auth.signOut(); currentUser = null; showAuth(); });
}

async function loadUserProfile() {
    if(!currentUser) return;
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
    const fullName = data?.full_name || 'Admin';
    document.getElementById('user-display-name').textContent = fullName;
    document.getElementById('profile-welcome-name').textContent = `Welcome, ${fullName}!`;
}

function initTheme() {
    const btn = document.getElementById('theme-toggle'); if(!btn) return;
    btn.addEventListener('click', () => {
        if(document.body.getAttribute('data-theme') === 'dark') { document.body.removeAttribute('data-theme'); localStorage.setItem('theme', 'light'); btn.innerHTML = '<i class="fa-solid fa-moon"></i>'; } 
        else { document.body.setAttribute('data-theme', 'dark'); localStorage.setItem('theme', 'dark'); btn.innerHTML = '<i class="fa-solid fa-sun"></i>'; }
    });
}

function setupSidebar() {
    document.getElementById('menu-toggle')?.addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('sidebar').classList.toggle('active'); document.getElementById('overlay').classList.toggle('active'); });
    document.getElementById('overlay')?.addEventListener('click', () => { document.getElementById('sidebar').classList.remove('active'); document.getElementById('overlay').classList.remove('active'); });
}

function stopDataServices() {
    Object.values(subscriptions).forEach(sub => supabaseClient.removeChannel(sub)); subscriptions = {};
}

function checkLocalOfflineStatus() {
    if (!lastReadingTime) return; 
    if (((new Date().getTime() - new Date(lastReadingTime).getTime()) / 1000) > 15) {
        updateDashboardWidgets(null, true);
        el.connectionStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-danger"></i> Offline';
    }
}

async function fetchLatest() {
    const { data } = await supabaseClient.from('readings').select('*').order('created_at', {ascending:false}).limit(1);
    if(data && data.length > 0) { lastReadingTime = data[0].created_at; updateDashboardWidgets(data[0], false); }
}

function subscribeRealtime() {
    subscriptions.readings = supabaseClient.channel('readings-channel').on('postgres_changes', {event:'INSERT', schema:'public', table:'readings'}, p => { updateDashboardWidgets(p.new, false); }).subscribe();
}

function updateDashboardWidgets(reading, isOffline = false) {
    const setText = (id, val) => { const e = document.getElementById(id); if(e) e.textContent = val; };
    let d = isOffline || !reading ? { tilapia_ph:0, tilapia_temp:0, bio_ph:0, bio_temp:0, tds_value:0, ec_value:0, water_level:0 } : reading;

    setText('ov-tilapia-ph', d.tilapia_ph); setText('ov-tilapia-temp', d.tilapia_temp);
    setText('ov-bio-ph', d.bio_ph); setText('ov-bio-temp', d.bio_temp);
    setText('ov-tds', d.tds_value); setText('ov-ec', d.ec_value); setText('ov-water', d.water_level + "%");

    const dsCard = document.getElementById('dynamic-status-card');
    if (dsCard) dsCard.className = "mockup-status-card " + (isOffline ? 'status-offline' : 'status-optimal');
}

async function initAnalyticsCharts() {
    const ctx = document.getElementById('combinedChart'); if (!ctx) return;
    const { data } = await supabaseClient.from('readings').select('*').order('created_at', { ascending: false }).limit(20);
    const rev = data ? data.reverse() : [];
    combinedChart = new Chart(ctx, {
        type: 'line', data: { labels: rev.map(d => new Date(d.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })), datasets: [ { label: 'T-Temp', data: rev.map(d => d.tilapia_temp), borderColor: '#3B82F6' }, { label: 'B-Temp', data: rev.map(d => d.bio_temp), borderColor: '#10B981' } ] }
    });
}

// ==========================================
// USER MANAGEMENT & ACTIVITY LOGS
// ==========================================

async function fetchUsersList() {
    const tbody = document.getElementById('users-body'); 
    if (!tbody) return;
    
    // Loading State
    tbody.innerHTML = `<tr><td colspan="3" class="text-center" style="padding: 20px;">Fetching users...</td></tr>`;

    // Fetch data WITHOUT ordering by 'created_at' since it does not exist
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*'); 
        
    // ERROR HANDLING
    if (error) {
        console.error("Supabase Fetch Error:", error);
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger" style="color: red; padding: 20px;">Error: ${error.message}</td></tr>`;
        return;
    }

    // NO DATA HANDLING
    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center" style="padding: 20px;">Walang nakitang users sa database.</td></tr>`;
        return;
    }

    // SUCCESSFUL FETCH
    tbody.innerHTML = '';
    data.forEach(u => {
        let btn = '';
        let accessStatus = '';
        
        if (u.role === 'admin') {
            btn = `<span class="badge" style="background: rgba(16, 185, 129, 0.1); color: var(--success);">Admin</span>`;
            accessStatus = "All Access";
        } else {
            const btnClass = u.can_control ? 'action-btn secondary btn-sm' : 'action-btn btn-sm';
            const btnIcon = u.can_control ? '<i class="fa-solid fa-lock"></i> Revoke' : '<i class="fa-solid fa-unlock"></i> Grant';
            btn = `<button onclick="toggleUserAccess('${u.id}', ${u.can_control}, '${u.full_name}')" class="${btnClass}">${btnIcon}</button>`;
            
            accessStatus = u.can_control 
                ? `<span style="color: var(--success); font-weight: 600; font-size: 0.85rem;"><i class="fa-solid fa-check-circle"></i> Granted</span>` 
                : `<span style="color: var(--text-secondary); font-weight: 600; font-size: 0.85rem;"><i class="fa-solid fa-circle-xmark"></i> None</span>`;
        }

        tbody.innerHTML += `
            <tr>
                <td>${u.full_name || 'No Name'}</td>
                <td>${accessStatus}</td>
                <td>${btn}</td>
            </tr>
        `;
    });
}

// Toggle manual pump access control
async function toggleUserAccess(userId, currentStatus, userName) {
    const newStatus = !currentStatus; 
    
    // Update Supabase
    const { error } = await supabaseClient
        .from('profiles')
        .update({ can_control: newStatus })
        .eq('id', userId);
        
    if (error) {
        alert('Error updating user access: ' + error.message);
        return;
    }
    
    // Log action to Activity Logs
    if (currentUser) {
        const adminName = document.getElementById('user-display-name').textContent;
        const actionText = newStatus ? `Granted pump control access to ${userName}` : `Revoked pump control access from ${userName}`;
        
        // Use a safe insert that ignores created_at if it causes issues, but Supabase handles timestamp defaults automatically.
        await supabaseClient.from('activity_logs').insert({
            user_id: currentUser.id,
            user_name: adminName,
            action: actionText
        });
    }
    
    // Refresh tables
    fetchUsersList();
    fetchActivityLogs();
}

async function fetchActivityLogs() {
    const tbody = document.getElementById('activity-logs-body'); 
    if (!tbody) return;
    
    tbody.innerHTML = `<tr><td colspan="3" class="text-center" style="padding: 20px;">Fetching logs...</td></tr>`;

    // Fetch activity logs with error catching
    const { data, error } = await supabaseClient
        .from('activity_logs')
        .select('*')
        .order('id', { ascending: false }) // Ginamit ang 'id' in case wala ring 'created_at' dito
        .limit(50);

    if (error) {
        console.error("Activity Logs Error:", error);
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger" style="color: red; padding: 20px;">Error: ${error.message}</td></tr>`;
        return;
    }
    
    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center" style="padding: 20px;">No recent activity logs.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(log => {
        // Fallback for date formatting if created_at is null/missing
        const dateStr = log.created_at ? new Date(log.created_at).toLocaleTimeString() : 'Recent';
        return `<tr><td>${dateStr}</td><td>${log.user_name || 'System'}</td><td>${log.action}</td></tr>`;
    }).join('');
}

// ==========================================
// IMPROVED PRIVATE ADMIN CHAT
// ==========================================

async function initAdminChat() {
    const chatCon = document.getElementById('chat-messages');
    const inp = document.getElementById('admin-chat-input');
    const btn = document.getElementById('admin-send-chat');
    if (!chatCon || !btn) return;

    // Remove old listeners
    btn.onclick = null; 

    // Fetch chats
    const { data } = await supabaseClient.from('support_chats').select('*').order('id', { ascending: true });
    allChatMessages = data || [];
    renderChatUserList();

    // Clean old subscriptions
    if (chatSubscription) {
        supabaseClient.removeChannel(chatSubscription);
    }

    chatSubscription = supabaseClient.channel('chat-channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_chats' }, payload => { 
            const exists = allChatMessages.some(m => m.id === payload.new.id);
            if (!exists) {
                allChatMessages.push(payload.new);
                renderChatUserList();
                if (selectedChatUserId === payload.new.user_id) {
                    appendChatBubble(payload.new);
                    chatCon.scrollTop = chatCon.scrollHeight;
                }
            }
        }).subscribe();

    btn.onclick = async () => {
        const val = inp.value.trim();
        if (!val || !selectedChatUserId) return;
        
        btn.disabled = true; 
        await supabaseClient.from('support_chats').insert({ 
            user_id: selectedChatUserId, 
            user_name: 'Admin Support', 
            message: val, 
            is_admin_reply: true 
        });
        inp.value = '';
        btn.disabled = false;
    };
}

function renderChatUserList() {
    const list = document.getElementById('chat-user-list');
    if (!list) return;
    list.innerHTML = '';
    const usersData = {};
    
    allChatMessages.forEach(msg => {
        if (!usersData[msg.user_id]) usersData[msg.user_id] = { id: msg.user_id, name: '', lastMsg: '', time: msg.created_at || msg.id };
        if (!msg.is_admin_reply) usersData[msg.user_id].name = msg.user_name;
        usersData[msg.user_id].lastMsg = msg.message;
        usersData[msg.user_id].time = msg.created_at || msg.id;
    });

    Object.values(usersData).sort((a,b) => {
        // Fallback sorting logic if time/created_at is missing
        if (!a.time || !b.time) return 0;
        return new Date(b.time) - new Date(a.time);
    }).forEach(u => {
        const div = document.createElement('div');
        div.className = `chat-user-item ${selectedChatUserId === u.id ? 'active' : ''}`;
        div.innerHTML = `<div class="chat-user-name">${u.name || 'User'}</div><div class="chat-user-preview">${u.lastMsg}</div>`;
        div.onclick = () => selectChatUser(u.id, u.name);
        list.appendChild(div);
    });
}

function selectChatUser(userId, userName) {
    selectedChatUserId = userId; selectedChatUserName = userName || 'User';
    document.getElementById('chat-active-user').innerHTML = `<h4>Chatting with: ${selectedChatUserName}</h4>`;
    document.getElementById('chat-input-area').style.display = 'flex';
    renderMessagesForSelectedUser();
}

function renderMessagesForSelectedUser() {
    const chatCon = document.getElementById('chat-messages'); chatCon.innerHTML = '';
    allChatMessages.filter(m => m.user_id === selectedChatUserId).forEach(m => appendChatBubble(m));
    chatCon.scrollTop = chatCon.scrollHeight;
}

function appendChatBubble(msg) {
    const chatCon = document.getElementById('chat-messages');
    const isMe = msg.is_admin_reply; 
    const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    
    const div = document.createElement('div');
    div.className = isMe ? 'admin-msg-container' : 'user-msg-container';
    
    div.innerHTML = `
        <span style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px; padding: 0 5px;">
            ${isMe ? 'You' : msg.user_name}
        </span>
        <div class="chat-bubble ${isMe ? 'admin-bubble' : 'user-bubble'}">
            ${msg.message}
        </div>
        <span style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px; padding: 0 5px;">
            ${timeStr}
        </span>
    `;
    chatCon.appendChild(div);
}