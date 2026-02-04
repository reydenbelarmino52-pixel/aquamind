// AquaMinds - script.js (FIXED: Auto-Update & Auth)
const SUPABASE_URL = "https://lskiuxhcyrhsijrnznnj.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxza2l1eGhjeXJoc2lqcm56bm5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTk4NTksImV4cCI6MjA4NDczNTg1OX0.R_jSTUfLXlXRNTtohKCYe4LT2iCMCWxYDCJjWmP60WE";

if (typeof supabase === 'undefined') console.error("Supabase not loaded");
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let combinedChart = null; 
let lastReadingTime = null; // Pang-check para hindi mag-duplicate ang chart

// --- 1. AUTH & INIT ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initTheme();
    setupSidebar();
    
    const path = window.location.pathname;
    
    // Initialize Dashboard Logic
    if(path.includes('analytics.html') || path.includes('overview.html')) {
        initAnalyticsCharts();
        subscribeRealtime();
        fetchLatest();

        // [THE FIX] AUTO-REFRESH BACKUP:
        // Kukunin ang data every 3 seconds kahit fail ang Realtime
        setInterval(fetchLatest, 3000); 
    }
    
    // Auth Page Logic
    if(path.includes('index.html') || path === '/' || path.endsWith('/')) {
        setupAuthForm();
    }
});

// Auth Logic (Updated with Error Handling)
async function checkAuth() {
    const { data, error } = await supabaseClient.auth.getSession();
    
    if (error) {
        console.error("Session Error:", error.message);
        await supabaseClient.auth.signOut();
        window.location.href = 'index.html';
        return;
    }

    const session = data.session;
    const path = window.location.pathname;
    const isAuthPage = path.includes('index.html') || path === '/' || path.endsWith('/');

    if (!session && !isAuthPage) {
        window.location.href = 'index.html';
    } else if (session && isAuthPage) {
        window.location.href = 'overview.html';
    }

    if(session && document.getElementById('user-display-name')) {
        const { data } = await supabaseClient.from('profiles').select('*').eq('id', session.user.id).single();
        const name = data ? (data.full_name || 'User') : 'User';
        document.getElementById('user-display-name').textContent = name;
    }
}

// --- 2. LOGIN & SIGNUP LOGIC ---
function setupAuthForm() {
    const form = document.getElementById('auth-form');
    if(!form) return;
    
    const email = document.getElementById('email');
    const pass = document.getElementById('password');
    const nameContainer = document.getElementById('name-field-container');
    const nameInput = document.getElementById('full-name');
    const msg = document.getElementById('auth-message');
    const btn = document.getElementById('submit-btn');
    const toggleAuth = document.getElementById('toggle-auth');
    const formTitle = document.getElementById('auth-title');

    let isSignUp = false;

    if (toggleAuth) {
        toggleAuth.addEventListener('click', () => {
            isSignUp = !isSignUp;
            if (isSignUp) {
                nameContainer.style.display = 'block';
                formTitle.textContent = "Create Account";
                btn.textContent = "Sign Up";
                toggleAuth.innerHTML = 'Already have an account? <span style="color: var(--water-blue); font-weight: 600;">Login</span>';
                nameInput.required = true;
            } else {
                nameContainer.style.display = 'none';
                formTitle.textContent = "Welcome Back";
                btn.textContent = "Login";
                toggleAuth.innerHTML = 'Don\'t have an account? <span style="color: var(--water-blue); font-weight: 600;">Sign Up</span>';
                nameInput.required = false;
            }
            msg.textContent = "";
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        btn.textContent = "Loading..."; btn.disabled = true; msg.textContent = "";
        let result;

        if (isSignUp) {
            result = await supabaseClient.auth.signUp({
                email: email.value, password: pass.value,
                options: { data: { full_name: nameInput.value } }
            });
            if (!result.error && result.data.user) {
                await supabaseClient.from('profiles').upsert([
                    { id: result.data.user.id, full_name: nameInput.value, updated_at: new Date() }
                ]);
                msg.textContent = "Account created! Check email.";
                msg.style.color = "var(--success)";
                btn.textContent = "Sign Up"; btn.disabled = false;
                return;
            }
        } else {
            result = await supabaseClient.auth.signInWithPassword({ email: email.value, password: pass.value });
        }

        if (result.error) {
            msg.textContent = result.error.message; msg.style.color = "var(--danger)";
            btn.textContent = isSignUp ? "Sign Up" : "Login"; btn.disabled = false;
        } else if (!isSignUp) {
            window.location.href = "overview.html";
        }
    });

    const togglePassBtn = document.getElementById('toggle-password');
    if(togglePassBtn) {
        togglePassBtn.addEventListener('click', () => {
            const type = pass.getAttribute('type') === 'password' ? 'text' : 'password';
            pass.setAttribute('type', type);
            togglePassBtn.classList.toggle('fa-eye'); togglePassBtn.classList.toggle('fa-eye-slash');
        });
    }
}

// --- 3. UI FUNCTIONS ---
function setupSidebar() {
    const menuBtn = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const logoutBtn = document.getElementById('logout-btn');

    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation(); sidebar.classList.toggle('active');
            if(overlay) overlay.classList.toggle('active');
        });
    }
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active'); overlay.classList.remove('active');
        });
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault(); await supabaseClient.auth.signOut(); window.location.href = 'index.html';
        });
    }
}

function initTheme() {
    const btn = document.getElementById('theme-toggle');
    if(!btn) return;
    if(localStorage.getItem('theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
    btn.addEventListener('click', () => {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        if(isDark) {
            document.body.removeAttribute('data-theme'); localStorage.setItem('theme', 'light');
            btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        } else {
            document.body.setAttribute('data-theme', 'dark'); localStorage.setItem('theme', 'dark');
            btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }
    });
}

// --- 4. DASHBOARD UPDATE (With Duplicate Prevention) ---
function updateDashboardWidgets(reading) {
    if (!reading) return;
    
    const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };

    setText('an-tilapia-ph', reading.tilapia_ph);
    setText('an-tilapia-temp', reading.tilapia_temp + "°C");
    setText('an-bio-ph', reading.bio_ph);
    setText('an-bio-temp', reading.bio_temp + "°C");
    setText('an-tds', reading.tds_value);
    setText('an-ec', reading.ec_value);
    setText('water-text', reading.water_level + "%");
    
    setText('ov-tilapia-ph', reading.tilapia_ph);
    setText('ov-tilapia-temp', reading.tilapia_temp + "°C");
    setText('ov-bio-ph', reading.bio_ph);
    setText('ov-bio-temp', reading.bio_temp + "°C");
    setText('ov-tds', reading.tds_value + " ppm");
    setText('ov-ec', reading.ec_value + " µS");
    setText('ov-water', reading.water_level + "%");

    let statusMsg = "Optimal"; let statusColor = "#05CD99"; 
    if(reading.tilapia_temp > 35 || reading.water_level < 40) { statusMsg = "Warning"; statusColor = "#FFB547"; }
    if(reading.water_level < 20) { statusMsg = "Critical"; statusColor = "#EE5D50"; }

    const stText = document.getElementById('an-status-text');
    if(stText) { stText.textContent = statusMsg; stText.style.color = statusColor; }
    
    const miniCard = document.getElementById('mini-status-card');
    if(miniCard) miniCard.style.borderLeftColor = statusColor;
    const ovCard = document.getElementById('overview-status-card');
    if(ovCard) ovCard.style.borderLeft = `5px solid ${statusColor}`;

    const waterFill = document.getElementById('water-fill');
    if(waterFill) {
        let level = Math.max(0, Math.min(100, reading.water_level));
        waterFill.style.height = level + "%";
    }

    // UPDATE CHART (Only if new data comes in)
    if (combinedChart && reading.created_at !== lastReadingTime) {
        const time = new Date(reading.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        addDataToChart(combinedChart, time, reading);
        lastReadingTime = reading.created_at; // Update tracker
    }
}

async function fetchLatest() {
    const { data } = await supabaseClient.from('readings').select('*').order('created_at', {ascending:false}).limit(1);
    if(data && data.length > 0) updateDashboardWidgets(data[0]);
}

function subscribeRealtime() {
    // Tinitignan ang INSERT events para sa mabilis na update
    supabaseClient.channel('live')
        .on('postgres_changes', {event:'INSERT', schema:'public', table:'readings'}, p => {
            console.log("Realtime Update:", p.new);
            updateDashboardWidgets(p.new);
        })
        .subscribe();
}

// --- 5. CHARTS ---
async function initAnalyticsCharts() {
    const ctx = document.getElementById('combinedChart');
    if (!ctx) return;

    const { data } = await supabaseClient.from('readings').select('*').order('created_at', { ascending: false }).limit(20);
    if (!data) return;
    
    const reversed = data.reverse();
    // I-set ang lastReadingTime para sa duplicate check
    if(reversed.length > 0) lastReadingTime = reversed[reversed.length - 1].created_at;

    const labels = reversed.map(d => new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    combinedChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Tilapia Temp', data: reversed.map(d => d.tilapia_temp), borderColor: '#4299E1', backgroundColor: 'rgba(66, 153, 225, 0.1)', fill: true, tension: 0.4 },
                { label: 'Bio Temp', data: reversed.map(d => d.bio_temp), borderColor: '#05CD99', backgroundColor: 'rgba(5, 205, 153, 0.1)', fill: true, tension: 0.4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false } } }
    });
}

function addDataToChart(chart, label, reading) {
    chart.data.labels.push(label);
    chart.data.datasets[0].data.push(reading.tilapia_temp);
    chart.data.datasets[1].data.push(reading.bio_temp);
    if (chart.data.labels.length > 20) {
        chart.data.labels.shift();
        chart.data.datasets.forEach(d => d.data.shift());
    }
    chart.update();
}

// Export logic
document.getElementById('btn-generate-report')?.addEventListener('click', async () => {
    const start = document.getElementById('start-date').value;
    const end = document.getElementById('end-date').value;
    if(!start || !end) return alert("Select dates.");
    
    const { data } = await supabaseClient.from('readings').select('*').gte('created_at', new Date(start).toISOString()).lte('created_at', new Date(end).toISOString());
    if(data) {
        const tbody = document.getElementById('report-body');
        tbody.innerHTML = "";
        data.forEach(r => {
            tbody.innerHTML += `<tr><td>${new Date(r.created_at).toLocaleString()}</td><td>${r.tilapia_temp}</td><td>${r.bio_temp}</td><td>-</td></tr>`;
        });
        document.getElementById('report-preview').style.display = 'block';
    }
});