// AquaMinds - script.js
const SUPABASE_URL = "https://lskiuxhcyrhsijrnznnj.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxza2l1eGhjeXJoc2lqcm56bm5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTk4NTksImV4cCI6MjA4NDczNTg1OX0.R_jSTUfLXlXRNTtohKCYe4LT2iCMCWxYDCJjWmP60WE";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* =========================================
   1. SECURITY & SESSION CHECK
   ========================================= */
async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const path = window.location.pathname;
    const protectedPages = ['overview.html', 'analytics.html', 'notification.html', 'profile.html'];
    
    const isProtected = protectedPages.some(page => path.includes(page));
    const isLoginPage = path.includes('index.html') || path === '/' || path.endsWith('/');

    if (isProtected && !session) {
        window.location.href = 'index.html';
    } else if (isLoginPage && session) {
        window.location.href = 'overview.html';
    }
}
checkAuth();

/* =========================================
   2. MOBILE SIDEBAR TOGGLE
   ========================================= */
const menuBtn = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
const overlay = document.getElementById('overlay');

function toggleMenu() {
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

if (menuBtn) menuBtn.addEventListener('click', toggleMenu);

if (overlay) {
    overlay.addEventListener('click', () => {
        if (sidebar) sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
    });
}

/* =========================================
   3. THEME TOGGLE
   ========================================= */
const themeToggleBtn = document.getElementById('theme-toggle');
const body = document.body;

function loadTheme() {
    const savedTheme = localStorage.getItem('aquaminds-theme');
    if (savedTheme === 'dark') {
        body.setAttribute('data-theme', 'dark');
        updateThemeIcon(true);
    } else {
        body.removeAttribute('data-theme');
        updateThemeIcon(false);
    }
}

function updateThemeIcon(isDark) {
    if (!themeToggleBtn) return;
    const icon = themeToggleBtn.querySelector('i');
    if (icon) {
        icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
}

if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        const isDark = body.getAttribute('data-theme') === 'dark';
        if (isDark) {
            body.removeAttribute('data-theme');
            localStorage.setItem('aquaminds-theme', 'light');
            updateThemeIcon(false);
        } else {
            body.setAttribute('data-theme', 'dark');
            localStorage.setItem('aquaminds-theme', 'dark');
            updateThemeIcon(true);
        }
    });
}
loadTheme();

/* =========================================
   4. AUTHENTICATION LOGIC
   ========================================= */
const authForm = document.getElementById('auth-form');
const toggleAuthBtn = document.getElementById('toggle-auth');
const nameField = document.getElementById('name-field-container');
const authTitle = document.getElementById('auth-title');
const submitBtn = document.getElementById('submit-btn');
const authMessage = document.getElementById('auth-message');

let isLoginMode = true;

if (toggleAuthBtn) {
    toggleAuthBtn.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        authTitle.textContent = isLoginMode ? "Welcome Back" : "Create Account";
        submitBtn.textContent = isLoginMode ? "Login" : "Sign Up";
        nameField.style.display = isLoginMode ? "none" : "block";
        toggleAuthBtn.innerHTML = isLoginMode ? 
            "Don't have an account? <span>Sign Up</span>" : 
            "Already have an account? <span>Login</span>";
        authMessage.textContent = "";
    });
}

if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const fullName = document.getElementById('full-name') ? document.getElementById('full-name').value : '';

        submitBtn.disabled = true;
        authMessage.style.color = "var(--text-secondary)";
        authMessage.textContent = "Processing...";

        try {
            if (isLoginMode) {
                const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                window.location.href = 'overview.html';
            } else {
                const { data, error } = await supabaseClient.auth.signUp({
                    email,
                    password,
                    options: { data: { full_name: fullName } }
                });
                if (error) throw error;
                authMessage.style.color = "var(--success)";
                authMessage.textContent = "Success! Please check your email to confirm.";
            }
        } catch (error) {
            authMessage.style.color = "var(--danger)";
            authMessage.textContent = error.message;
        } finally {
            submitBtn.disabled = false;
        }
    });
}

/* =========================================
   5. LOGOUT LOGIC
   ========================================= */
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Error logging out:', error.message);
            alert('Error logging out. Please try again.');
        }
    });
}

/* =========================================
   6. SENSOR DATA & SYSTEM STATUS (FIXED)
   ========================================= */

// Helper to update the UI status
function setSystemStatus(isOnline) {
    const statusContainer = document.querySelector('.status-indicator');
    if (!statusContainer) return;

    const color = isOnline ? '#00ff88' : '#ff4500'; // Green vs Red
    const text = isOnline ? 'System Online' : 'System Offline';
    const shadow = isOnline ? `0 0 10px ${color}` : 'none';

    statusContainer.innerHTML = `
        <span class="status-online" style="background-color: ${color}; box-shadow: ${shadow};"></span> ${text}
    `;
}

async function fetchSensorData() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return; 

    try {
        const { data, error } = await supabaseClient
            .from('readings')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);

        // CASE 1: Error or No Data -> OFFLINE
        if (error || !data || data.length === 0) {
            setSystemStatus(false);
            return;
        }

        const reading = data[0];
        
        // CASE 2: Calculate Time Difference
        // NOTE: 'created_at' from Supabase is UTC. Date.now() is UTC-based.
        const readingTime = new Date(reading.created_at).getTime();
        const now = Date.now();
        const diffInSeconds = (now - readingTime) / 1000;

        // Threshold: 60 seconds (Adjust if your ESP32 sends data slower)
        // If diff is negative (clock drift), we assume online if small, offline if huge
        const isOnline = diffInSeconds < 60 && diffInSeconds > -60;

        setSystemStatus(isOnline);
        
        // Only update widgets if online (or show stale data with a visual cue if you prefer)
        updateDashboardWidgets(reading);

    } catch (err) {
        console.error("Fetch error:", err);
        setSystemStatus(false); // Fail-safe to offline
    }
}

function updateDashboardWidgets(reading) {
    const safeSetText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    safeSetText('ov-tilapia-temp', reading.tilapia_temp);
    safeSetText('ov-tilapia-ph', reading.tilapia_ph);
    safeSetText('ov-bio-temp', reading.bio_temp);
    safeSetText('ov-bio-ph', reading.bio_ph);
    safeSetText('ov-tds', reading.tds_value + " ppm");
    safeSetText('ov-ec', reading.ec_value + " µS");
    safeSetText('ov-water', reading.water_level + "%");
    
    safeSetText('tilapia-temp', reading.tilapia_temp + " °C");
    safeSetText('tilapia-ph', reading.tilapia_ph);
    safeSetText('bio-temp', reading.bio_temp + " °C");
    safeSetText('bio-ph', reading.bio_ph);
    safeSetText('water-level', reading.water_level + "%");
    safeSetText('tds-value', reading.tds_value);
    
    const waterCard = document.getElementById('water-card');
    if (waterCard) {
        waterCard.className = 'water-card';
        if (reading.water_level < 30) waterCard.classList.add('critical');
        else if (reading.water_level < 60) waterCard.classList.add('warning');
        else waterCard.classList.add('good');
    }
}

/* =========================================
   7. HARDWARE CONTROLS
   ========================================= */
async function toggleDevice(columnName, state) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        alert("Session expired. Please login again.");
        return;
    }
    await supabaseClient.from('controls').update({ [columnName]: state }).eq('id', 1);
}

document.getElementById('pump-12v-toggle')?.addEventListener('change', (e) => toggleDevice('pump_12v', e.target.checked));
document.getElementById('pump-5v-toggle')?.addEventListener('change', (e) => toggleDevice('pump_5v', e.target.checked));
document.getElementById('light-toggle')?.addEventListener('change', (e) => toggleDevice('light_status', e.target.checked));

document.getElementById('btn-feed-now')?.addEventListener('click', async () => {
    await toggleDevice('feeder_servo', true);
    alert("Feeding fish...");
    setTimeout(() => toggleDevice('feeder_servo', false), 3000);
});

/* =========================================
   8. INITIALIZATION
   ========================================= */
const currentPath = window.location.pathname;
if (
    currentPath.includes('overview') || 
    currentPath.includes('analytics') || 
    currentPath.includes('profile') || 
    currentPath.includes('notification')
) {
    // 1. Immediately set status to "Checking..." or Offline on load
    setSystemStatus(false); 
    
    // 2. Fetch real data
    fetchSensorData(); 
    setInterval(fetchSensorData, 3000);
}