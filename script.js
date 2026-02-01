// AquaMinds - script.js
const SUPABASE_URL = "https://lskiuxhcyrhsijrnznnj.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxza2l1eGhjeXJoc2lqcm56bm5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTk4NTksImV4cCI6MjA4NDczNTg1OX0.R_jSTUfLXlXRNTtohKCYe4LT2iCMCWxYDCJjWmP60WE";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* =========================================
   1. VISUAL EFFECTS (BUBBLES)
   ========================================= */
function createBubbles() {
    const liquidContainers = document.querySelectorAll('.liquid-container');
    
    liquidContainers.forEach(container => {
        const existingBubbles = container.querySelectorAll('.bubble');
        if(existingBubbles.length > 0) return; 

        for (let i = 0; i < 10; i++) {
            const bubble = document.createElement('div');
            bubble.classList.add('bubble');
            const size = Math.random() * 10 + 5 + 'px'; 
            const left = Math.random() * 80 + 10 + '%'; 
            const duration = Math.random() * 3 + 3 + 's'; 
            const delay = Math.random() * 5 + 's';
            bubble.style.width = size;
            bubble.style.height = size;
            bubble.style.left = left;
            bubble.style.animationDuration = duration;
            bubble.style.animationDelay = delay;
            container.appendChild(bubble);
        }
    });
}
document.addEventListener('DOMContentLoaded', createBubbles);

/* =========================================
   2. SECURITY & AUTH
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
   3. MENU & THEME
   ========================================= */
const menuBtn = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');

if (menuBtn) {
    menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        if(overlay) overlay.classList.toggle('active');
    });
}

if (overlay) {
    overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    });
}

const themeToggleBtn = document.getElementById('theme-toggle');
const body = document.body;

function loadTheme() {
    const savedTheme = localStorage.getItem('aquaminds-theme');
    if (savedTheme === 'dark') {
        body.setAttribute('data-theme', 'dark');
        updateThemeIcon(true);
    }
}

function updateThemeIcon(isDark) {
    if (!themeToggleBtn) return;
    themeToggleBtn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
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
   4. DATA FETCHING & SYSTEM STATUS
   ========================================= */

// Updates the small "Online/Offline" pill in the sidebar
function setSystemStatus(isOnline) {
    const statusContainer = document.querySelector('.status-indicator');
    if (!statusContainer) return;

    const color = isOnline ? 'var(--success)' : 'var(--danger)';
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

        // FAIL SAFE: If error or no data, Mark Offline
        if (error || !data || data.length === 0) {
            setSystemStatus(false);
            // Also update Overview Card to Offline
            updateOverviewStatus(null, false);
            return;
        }

        const reading = data[0];
        
        // ACCURACY CHECK: Compare Timestamp (60s threshold)
        const readingTime = new Date(reading.created_at).getTime();
        const now = Date.now();
        const diffInSeconds = (now - readingTime) / 1000;

        const isOnline = diffInSeconds < 60 && diffInSeconds > -60;
        setSystemStatus(isOnline);
        
        // Update basic numbers
        updateDashboardWidgets(reading);
        
        // Update Overview Status Card (The big colored card)
        if (document.getElementById('overview-status-card')) {
            updateOverviewStatus(reading, isOnline);
        }

        // Run AI Analysis (Only if on Analytics Page)
        if (document.getElementById('rec-list')) {
            generateAIRecommendations(reading, isOnline);
        }

    } catch (err) {
        console.error("Fetch error:", err);
        setSystemStatus(false);
        updateOverviewStatus(null, false);
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
    
    // Analytics Page Elements
    safeSetText('tilapia-temp', reading.tilapia_temp + " °C");
    safeSetText('tilapia-ph', reading.tilapia_ph);
    safeSetText('bio-temp', reading.bio_temp + " °C");
    safeSetText('bio-ph', reading.bio_ph);
    safeSetText('water-level', reading.water_level + "%");
    safeSetText('tds-value', reading.tds_value);
    
    // Dynamic Water Height
    const liquid = document.querySelector('.liquid-container');
    if (liquid) {
        const percentage = reading.water_level;
        const topValue = 100 - percentage; 
        liquid.style.top = (topValue - 30) + '%'; 
    }
}

/* =========================================
   5. OVERVIEW STATUS CARD LOGIC
   ========================================= */
function updateOverviewStatus(reading, isOnline) {
    const card = document.getElementById('overview-status-card');
    const title = document.getElementById('status-card-title');
    const list = document.getElementById('status-list');

    if (!card || !title || !list) return;

    // SCENARIO 1: OFFLINE
    if (!isOnline || !reading) {
        card.className = "status-card danger";
        title.innerText = "Status: System Offline";
        list.innerHTML = `
            <li><div class="status-icon-circle" style="color:#C53030"><i class="fa-solid fa-power-off"></i></div><span>Connection Lost</span></li>
            <li><div class="status-icon-circle" style="color:#C53030"><i class="fa-solid fa-wifi"></i></div><span>Check ESP32</span></li>
        `;
        return;
    }

    // SCENARIO 2: ANALYZE DATA FOR WARNINGS
    let issues = [];

    // Temp Check
    if (reading.tilapia_temp < 20) issues.push({icon: "fa-temperature-arrow-down", text: "Water Temp Low", type: "warning"});
    else if (reading.tilapia_temp > 33) issues.push({icon: "fa-temperature-arrow-up", text: "Water Temp High!", type: "danger"});

    // pH Check
    if (reading.tilapia_ph < 6.0) issues.push({icon: "fa-flask", text: "pH Acidic", type: "warning"});
    else if (reading.tilapia_ph > 8.5) issues.push({icon: "fa-flask", text: "pH Alkaline", type: "warning"});

    // Water Level Check
    if (reading.water_level < 30) issues.push({icon: "fa-water", text: "Water Critical!", type: "danger"});
    else if (reading.water_level < 60) issues.push({icon: "fa-water", text: "Water Low", type: "warning"});

    // SCENARIO 3: DETERMINE CARD STATE
    if (issues.length === 0) {
        // All Good
        card.className = "status-card optimal";
        title.innerText = "Status: All Systems Optimal";
        list.innerHTML = `
            <li><div class="status-icon-circle" style="color:#2F855A"><i class="fa-solid fa-fish"></i></div><span>Optimal Growth</span></li>
            <li><div class="status-icon-circle" style="color:#2F855A"><i class="fa-solid fa-filter"></i></div><span>Biofilter Active</span></li>
            <li><div class="status-icon-circle" style="color:#2F855A"><i class="fa-solid fa-check"></i></div><span>Levels Stable</span></li>
        `;
    } else {
        // Has Issues
        const isCritical = issues.some(i => i.type === "danger");
        card.className = isCritical ? "status-card danger" : "status-card warning";
        title.innerText = isCritical ? "Status: Critical Attention Needed" : "Status: Warnings Detected";
        
        // Rebuild list with specific issues
        list.innerHTML = "";
        issues.forEach(issue => {
            const color = isCritical ? "#C53030" : "#D69E2E";
            list.innerHTML += `
                <li>
                    <div class="status-icon-circle" style="color:${color}"><i class="fa-solid ${issue.icon}"></i></div>
                    <span>${issue.text}</span>
                </li>
            `;
        });
    }
}

/* =========================================
   6. ANALYTICS RECOMMENDATION ENGINE
   ========================================= */
function generateAIRecommendations(reading, isOnline) {
    const list = document.getElementById('rec-list');
    const card = document.getElementById('recommendation-card');
    if (!list || !card) return;

    list.innerHTML = ""; 

    if (!isOnline) {
        card.className = "recommendation-card danger";
        list.innerHTML = `<li><i class="fa-solid fa-triangle-exclamation" style="color: #F56565;"></i> <span>System is Offline. Check power or ESP32 connection.</span></li>`;
        return;
    }

    let issues = [];
    if (reading.tilapia_temp < 20) issues.push({ msg: "Water temp is low. Check heater.", type: "warning" });
    else if (reading.tilapia_temp > 32) issues.push({ msg: "Water temp is high. Add shade or cool water.", type: "danger" });

    if (reading.tilapia_ph < 6.0) issues.push({ msg: "pH is acidic. Add crushed eggshells or buffer.", type: "warning" });
    else if (reading.tilapia_ph > 8.5) issues.push({ msg: "pH is alkaline. Add lemon juice or pH down.", type: "warning" });

    if (reading.water_level < 30) issues.push({ msg: "Critical water level! Refill immediately.", type: "danger" });
    else if (reading.water_level < 60) issues.push({ msg: "Water level is low. Prepare for refill.", type: "warning" });

    if (issues.length === 0) {
        card.className = "recommendation-card optimal";
        list.innerHTML = `<li><i class="fa-solid fa-check-circle" style="color: #48BB78;"></i> <span>System is optimal. Fish are happy!</span></li>`;
    } else {
        const hasDanger = issues.some(i => i.type === "danger");
        card.className = hasDanger ? "recommendation-card danger" : "recommendation-card warning";

        issues.forEach(issue => {
            const color = issue.type === "danger" ? "#F56565" : "#ECC94B";
            const icon = issue.type === "danger" ? "fa-circle-exclamation" : "fa-triangle-exclamation";
            list.innerHTML += `
                <li style="margin-bottom: 10px;">
                    <i class="fa-solid ${icon}" style="color: ${color};"></i> 
                    <span>${issue.msg}</span>
                </li>`;
        });
    }
}

/* =========================================
   7. CONTROLS LOGIC
   ========================================= */
async function toggleDevice(columnName, state) {
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
   8. INIT LOOP
   ========================================= */
const currentPath = window.location.pathname;
if (['overview', 'analytics', 'profile', 'notification'].some(p => currentPath.includes(p))) {
    // Initial check to offline
    setSystemStatus(false);
    updateOverviewStatus(null, false);
    
    // Start Loop
    fetchSensorData();
    setInterval(fetchSensorData, 3000);
}