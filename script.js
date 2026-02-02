// AquaMinds - script.js (Rule-Based System - No AI)
const SUPABASE_URL = "https://lskiuxhcyrhsijrnznnj.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxza2l1eGhjeXJoc2lqcm56bm5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTk4NTksImV4cCI6MjA4NDczNTg1OX0.R_jSTUfLXlXRNTtohKCYe4LT2iCMCWxYDCJjWmP60WE";

// CONFIGURATION
const OFFLINE_THRESHOLD_MS = 15000; 

if (typeof supabase === 'undefined') {
    console.error("CRITICAL ERROR: Supabase library not found.");
    throw new Error("Supabase not defined");
}

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let tempChart = null; 
let lastDataTime = 0; 
let lastReading = null; 
let currentUser = null;

/* =========================================
   1. AUTHENTICATION & INITIALIZATION
   ========================================= */
async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const path = window.location.pathname;
    const protectedPages = ['overview.html', 'analytics.html', 'notification.html', 'profile.html'];
    const isProtected = protectedPages.some(page => path.includes(page));
    const isLoginPage = path.includes('index.html') || path.endsWith('/') || path.endsWith('AquaMinds%20-%20Copy/');

    if (isProtected && !session) window.location.href = 'index.html';
    else if (isLoginPage && session) window.location.href = 'overview.html';
    
    if (session) {
        currentUser = session.user;
        loadUserProfileDisplay();
    }
}
checkAuth();

async function loadUserProfileDisplay() {
    if (!currentUser) return;
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) {
        const nameDisplay = document.getElementById('user-display-name');
        const headerProfile = document.querySelector('.user-profile span');
        if (nameDisplay) nameDisplay.textContent = data.full_name || 'User';
        if (headerProfile) headerProfile.textContent = data.full_name || 'User';
    }
}

// --- AUTH LISTENERS ---
const authForm = document.getElementById('auth-form');
const toggleAuthBtn = document.getElementById('toggle-auth');
let isSignUpMode = false;

if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const fullName = document.getElementById('full-name')?.value;
        const authMessage = document.getElementById('auth-message');
        const submitBtn = document.getElementById('submit-btn');
        
        authMessage.textContent = "Processing...";
        submitBtn.disabled = true;

        try {
            if (isSignUpMode) {
                const { error } = await supabaseClient.auth.signUp({
                    email, password, options: { data: { full_name: fullName } }
                });
                if (error) throw error;
                authMessage.style.color = "var(--success)";
                authMessage.textContent = "Success! Check email to confirm.";
            } else {
                const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                window.location.href = "overview.html";
            }
        } catch (err) {
            authMessage.style.color = "var(--danger)";
            authMessage.textContent = err.message;
        } finally {
            submitBtn.disabled = false;
        }
    });
}

if (toggleAuthBtn) {
    toggleAuthBtn.addEventListener('click', () => {
        isSignUpMode = !isSignUpMode;
        authForm.reset();
        document.getElementById('auth-title').innerText = isSignUpMode ? "Create Account" : "Welcome Back";
        document.getElementById('name-field-container').style.display = isSignUpMode ? "block" : "none";
        document.getElementById('password-strength-container').style.display = isSignUpMode ? "block" : "none";
        document.getElementById('submit-btn').innerText = isSignUpMode ? "Sign Up" : "Login";
        toggleAuthBtn.innerHTML = isSignUpMode ? `Already have an account? <span>Login</span>` : `Don't have an account? <span>Sign Up</span>`;
    });
}

document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
});

document.getElementById('toggle-password')?.addEventListener('click', function() {
    const input = document.getElementById('password');
    const type = input.type === 'password' ? 'text' : 'password';
    input.type = type;
    this.classList.toggle('fa-eye');
    this.classList.toggle('fa-eye-slash');
});

/* =========================================
   2. UI HELPERS
   ========================================= */
const themeToggleBtn = document.getElementById('theme-toggle');
if (themeToggleBtn) {
    const body = document.body;
    if (localStorage.getItem('aquaminds-theme') === 'dark') {
        body.setAttribute('data-theme', 'dark');
        themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
    themeToggleBtn.addEventListener('click', () => {
        const isDark = body.getAttribute('data-theme') === 'dark';
        if (isDark) {
            body.removeAttribute('data-theme');
            localStorage.setItem('aquaminds-theme', 'light');
            themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        } else {
            body.setAttribute('data-theme', 'dark');
            localStorage.setItem('aquaminds-theme', 'dark');
            themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }
    });
}

document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay')?.classList.toggle('active');
});
document.getElementById('overlay')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
});

const dateEl = document.getElementById('current-date');
if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/* =========================================
   3. PROFILE PAGE LOGIC
   ========================================= */
if (window.location.pathname.includes('profile.html')) {
    const avatarInput = document.getElementById('avatar-upload');
    const avatarPreview = document.getElementById('avatar-preview');
    const profileForm = document.getElementById('profile-form');
    const profileMsg = document.getElementById('profile-msg');

    async function loadProfilePage() {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;
        document.getElementById('profile-email-input').value = user.email;

        const { data } = await supabaseClient.from('profiles').select('*').eq('id', user.id).single();
        if (data) {
            document.getElementById('profile-name').value = data.full_name || '';
            if (data.avatar_url) avatarPreview.src = data.avatar_url; 
        }
    }
    loadProfilePage();

    avatarInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        avatarPreview.src = URL.createObjectURL(file);
    });

    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        profileMsg.textContent = "Saving changes...";
        profileMsg.style.color = "var(--text-secondary)";
        
        const name = document.getElementById('profile-name').value;
        const file = avatarInput.files[0];
        const { data: { user } } = await supabaseClient.auth.getUser();
        let avatarUrl = avatarPreview.src;

        try {
            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${user.id}-${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(fileName, file);
                if (uploadError) throw uploadError;
                const { data: publicUrlData } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
                avatarUrl = publicUrlData.publicUrl;
            }
            const { error } = await supabaseClient.from('profiles').upsert({
                id: user.id, full_name: name, avatar_url: avatarUrl, updated_at: new Date()
            });
            if (error) throw error;
            profileMsg.textContent = "Profile updated successfully!";
            profileMsg.style.color = "var(--success)";
            loadUserProfileDisplay();
        } catch (error) {
            console.error(error);
            profileMsg.textContent = "Error: " + error.message;
            profileMsg.style.color = "var(--danger)";
        }
    });
}

/* =========================================
   4. ANALYTICS HISTORY LOGIC
   ========================================= */
const btnLoadHistory = document.getElementById('btn-load-history');
const popupOverlay = document.getElementById('no-data-popup');
const closePopupBtn = document.getElementById('close-popup-btn');

if (closePopupBtn) {
    closePopupBtn.addEventListener('click', () => {
        popupOverlay.classList.remove('active');
    });
}
if (popupOverlay) {
    popupOverlay.addEventListener('click', (e) => {
        if (e.target === popupOverlay) popupOverlay.classList.remove('active');
    });
}

if (btnLoadHistory) {
    btnLoadHistory.addEventListener('click', async () => {
        const dateVal = document.getElementById('history-picker').value;
        const popupDateSpan = document.getElementById('popup-date');
        
        if (!dateVal) {
            alert("Please select a date first.");
            return;
        }

        btnLoadHistory.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
        
        const startDate = new Date(dateVal);
        const endDate = new Date(dateVal);
        endDate.setHours(23, 59, 59, 999);

        const { data, error } = await supabaseClient
            .from('readings')
            .select('created_at, tilapia_temp, bio_temp')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .order('created_at', { ascending: true });

        btnLoadHistory.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> View History';

        if (error) {
            console.error(error);
            alert("Error loading data.");
            return;
        }
        if (data.length === 0) {
            if (popupOverlay) {
                if (popupDateSpan) popupDateSpan.textContent = dateVal;
                popupOverlay.classList.add('active'); 
            } else {
                alert("No data found for this date.");
            }
            return;
        }
        document.querySelector('.chart-panel h3').textContent = `History: ${dateVal}`;
        updateChartWithHistory(data);
    });
}

function updateChartWithHistory(data) {
    if (!tempChart) return;
    const labels = data.map(d => new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    tempChart.data.labels = labels;
    tempChart.data.datasets[0].data = data.map(d => d.tilapia_temp);
    tempChart.data.datasets[1].data = data.map(d => d.bio_temp);
    tempChart.update();
}

/* =========================================
   5. SYSTEM CORE (RULE-BASED LOGIC RESTORED)
   ========================================= */
function updateSystemStatusUI(isOnline, reading) {
    const sbEl = document.querySelector('.status-indicator');
    if (sbEl) {
        const color = isOnline ? 'var(--success)' : 'var(--danger)';
        const text = isOnline ? 'System Online' : 'System Offline';
        sbEl.innerHTML = `<span class="status-online" style="background-color: ${color}; box-shadow: 0 0 10px ${color};"></span> ${text}`;
    }

    const card = document.getElementById('overview-status-card');
    if (!card) return;
    const title = document.getElementById('status-card-title');
    const list = document.getElementById('status-list');

    if (!isOnline) {
        card.className = "status-card danger"; 
        title.innerText = "Status: System Offline";
        list.innerHTML = `<li><div class="status-icon-circle" style="color:#C53030"><i class="fa-solid fa-power-off"></i></div><span>Connection Lost</span></li>`;
        return; 
    }
    if (isOnline && !reading) {
        card.className = "status-card warning";
        title.innerText = "Status: Calibrating...";
        return;
    }

    const tempOk = reading.tilapia_temp >= 20 && reading.tilapia_temp <= 33;
    const phOk = reading.tilapia_ph >= 6.0 && reading.tilapia_ph <= 8.5;
    const waterOk = reading.water_level >= 40;

    if (tempOk && phOk && waterOk) {
        card.className = "status-card optimal"; 
        title.innerText = "Status: All Systems Optimal";
        list.innerHTML = `
            <li><div class="status-icon-circle"><i class="fa-solid fa-fish"></i></div><span>Optimal Growth</span></li>
            <li><div class="status-icon-circle"><i class="fa-solid fa-filter"></i></div><span>Biofilter Active</span></li>
        `;
    } else {
        card.className = "status-card warning"; 
        title.innerText = "Status: Attention Needed";
        list.innerHTML = ""; 
        if (!tempOk) list.innerHTML += `<li><div class="status-icon-circle" style="color:#D69E2E"><i class="fa-solid fa-temperature-high"></i></div><span>Check Temperature</span></li>`;
        if (!phOk) list.innerHTML += `<li><div class="status-icon-circle" style="color:#D69E2E"><i class="fa-solid fa-flask"></i></div><span>pH Imbalance</span></li>`;
        if (!waterOk) list.innerHTML += `<li><div class="status-icon-circle" style="color:#D69E2E"><i class="fa-solid fa-water"></i></div><span>Water Level Low</span></li>`;
    }
}

setInterval(() => {
    if (lastDataTime === 0) return;
    const now = Date.now();
    const isOnline = (now - lastDataTime) < OFFLINE_THRESHOLD_MS;
    updateSystemStatusUI(isOnline, lastReading);
}, 1000);

function updateDashboardWidgets(reading) {
    if (!reading) return;
    lastReading = reading;
    lastDataTime = Date.now();
    updateSystemStatusUI(true, reading);

    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('ov-tilapia-temp', reading.tilapia_temp);
    setText('ov-tilapia-ph', reading.tilapia_ph);
    setText('ov-bio-temp', reading.bio_temp);
    setText('ov-bio-ph', reading.bio_ph);
    setText('ov-tds', reading.tds_value + " ppm");
    setText('ov-ec', reading.ec_value + " µS");
    setText('ov-water', reading.water_level + "%");
    setText('tilapia-temp', reading.tilapia_temp + " °C");
    setText('tilapia-ph', reading.tilapia_ph);
    setText('bio-temp', reading.bio_temp + " °C");
    setText('bio-ph', reading.bio_ph);
    setText('water-level', reading.water_level + "%");
    setText('tds-value', reading.tds_value);

    const liquid = document.querySelector('.liquid-container');
    if (liquid) liquid.style.top = (100 - reading.water_level - 20) + '%';
}

// --- RESTORED RULE-BASED RECOMMENDATIONS (NO AI) ---
function generateAIRecommendations(reading) {
    const list = document.getElementById('rec-list');
    const card = document.getElementById('recommendation-card');
    if (!list || !card) return;

    list.innerHTML = "";
    let issues = [];

    // Simple If-Else Logic
    if (reading.tilapia_temp < 20) issues.push({ msg: "Water temp low. Check heater.", type: "warning" });
    if (reading.tilapia_temp > 33) issues.push({ msg: "Water temp high! Cool down tank.", type: "danger" });
    if (reading.tilapia_ph < 6.0) issues.push({ msg: "pH Acidic. Add buffer.", type: "warning" });
    if (reading.tilapia_ph > 8.5) issues.push({ msg: "pH Alkaline. Lower pH.", type: "warning" });
    if (reading.water_level < 40) issues.push({ msg: "Low water level! Refill needed.", type: "danger" });

    // Update UI based on logic
    if (issues.length === 0) {
        card.className = "recommendation-card optimal";
        list.innerHTML = `<li><i class="fa-solid fa-check-circle" style="color: var(--success);"></i> <span>System optimal. No actions needed.</span></li>`;
    } else {
        const isDanger = issues.some(i => i.type === "danger");
        card.className = isDanger ? "recommendation-card danger" : "recommendation-card warning";
        issues.forEach(i => {
            const color = i.type === "danger" ? "var(--danger)" : "var(--warning)";
            const icon = i.type === "danger" ? "fa-circle-exclamation" : "fa-triangle-exclamation";
            list.innerHTML += `<li style="margin-bottom:8px;"><i class="fa-solid ${icon}" style="color:${color}"></i> <span>${i.msg}</span></li>`;
        });
    }
}

async function initChart() {
    const ctx = document.getElementById('tempChart');
    if (!ctx) return;
    const headerTitle = document.querySelector('.chart-panel h3');
    if (headerTitle) headerTitle.textContent = "Biofilter & Tilapia History (Live)";

    const { data, error } = await supabaseClient.from('readings').select('created_at, tilapia_temp, bio_temp').order('created_at', { ascending: true }).limit(20);
    if (error) return console.error(error);

    const labels = data.map(d => new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    tempChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Tilapia Temp (°C)', data: data.map(d => d.tilapia_temp), borderColor: '#4299E1', backgroundColor: 'rgba(66, 153, 225, 0.2)', tension: 0.4, fill: true, pointRadius: 3 },
                { label: 'Biofilter Temp (°C)', data: data.map(d => d.bio_temp), borderColor: '#48BB78', backgroundColor: 'rgba(72, 187, 120, 0.2)', tension: 0.4, fill: true, pointRadius: 3 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } } }
    });
}

function updateChartRealtime(reading) {
    if (!tempChart) return;
    const isLive = document.querySelector('.chart-panel h3').textContent.includes('Live');
    if (!isLive) return;
    const timeLabel = new Date(reading.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    tempChart.data.labels.push(timeLabel);
    tempChart.data.datasets[0].data.push(reading.tilapia_temp);
    tempChart.data.datasets[1].data.push(reading.bio_temp);
    if (tempChart.data.labels.length > 20) {
        tempChart.data.labels.shift();
        tempChart.data.datasets[0].data.shift();
        tempChart.data.datasets[1].data.shift();
    }
    tempChart.update();
}

async function loadLogs() {
    const tbody = document.getElementById('logs-body');
    if (!tbody) return;
    const { data, error } = await supabaseClient.from('readings').select('*').order('created_at', { ascending: false }).limit(50);
    if (error) return console.error(error);
    tbody.innerHTML = "";
    data.forEach(row => {
        const time = new Date(row.created_at).toLocaleString();
        let status = "Normal", color = "var(--success)";
        if (row.tilapia_temp > 32 || row.water_level < 40) { status = "Critical"; color = "var(--danger)"; }
        else if (row.tilapia_temp < 20) { status = "Warning"; color = "var(--warning)"; }
        tbody.innerHTML += `<tr><td>${time}</td><td>Sensor Node</td><td>${row.tilapia_temp}°C</td><td><span style="color:${color}; font-weight:600">${status}</span></td></tr>`;
    });
}

async function toggleDevice(col, state) {
    await supabaseClient.from('controls').update({ [col]: state }).eq('id', 1);
}
document.getElementById('pump-12v-toggle')?.addEventListener('change', (e) => toggleDevice('pump_12v', e.target.checked));
document.getElementById('pump-5v-toggle')?.addEventListener('change', (e) => toggleDevice('pump_5v', e.target.checked));
document.getElementById('light-toggle')?.addEventListener('change', (e) => toggleDevice('light_status', e.target.checked));
document.getElementById('btn-feed-now')?.addEventListener('click', async () => {
    alert("Feeding command sent!");
    await toggleDevice('feeder_servo', true);
    setTimeout(() => toggleDevice('feeder_servo', false), 2000);
});

// INITIALIZATION
const currentPage = window.location.pathname;
const isDashboard = ['overview', 'analytics', 'notification', 'profile'].some(p => currentPage.includes(p));

if (isDashboard) {
    updateSystemStatusUI(false, null);
    
    // FETCH LATEST DATA
    supabaseClient.from('readings').select('*').order('created_at', { ascending: false }).limit(1).then(({ data }) => {
        if (data && data.length > 0) {
            const reading = data[0];
            const now = Date.now();
            const readingTime = new Date(reading.created_at).getTime();
            lastReading = reading;
            lastDataTime = readingTime;
            
            if ((now - readingTime) > OFFLINE_THRESHOLD_MS) {
                updateSystemStatusUI(false, reading);
                const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
                setText('ov-tilapia-temp', reading.tilapia_temp);
                setText('ov-tilapia-ph', reading.tilapia_ph);
                setText('ov-bio-temp', reading.bio_temp);
                setText('ov-bio-ph', reading.bio_ph);
                setText('ov-water', reading.water_level + "%");
                setText('tilapia-temp', reading.tilapia_temp + " °C");
                setText('tilapia-ph', reading.tilapia_ph);
                setText('bio-temp', reading.bio_temp + " °C");
                setText('bio-ph', reading.bio_ph);
                setText('water-level', reading.water_level + "%");
                setText('tds-value', reading.tds_value);
            } else {
                updateDashboardWidgets(reading);
                generateAIRecommendations(reading); // Call the Rule-Based function
            }
        }
    });

    if (currentPage.includes('analytics')) initChart();
    if (currentPage.includes('notification')) loadLogs();

    // REALTIME SUBSCRIPTION
    supabaseClient.channel('aquaminds-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'readings' }, payload => {
            updateDashboardWidgets(payload.new);
            generateAIRecommendations(payload.new); 
            if (currentPage.includes('analytics')) updateChartRealtime(payload.new);
            if (currentPage.includes('notification')) loadLogs();
        })
        .subscribe();
}