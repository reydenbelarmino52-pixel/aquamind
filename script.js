// AquaMinds - script.js
const SUPABASE_URL = "https://lskiuxhcyrhsijrnznnj.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxza2l1eGhjeXJoc2lqcm56bm5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTk4NTksImV4cCI6MjA4NDczNTg1OX0.R_jSTUfLXlXRNTtohKCYe4LT2iCMCWxYDCJjWmP60WE";

// Initialize Supabase Client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 0. SECURITY & SESSION CHECK (Prevent Bypass)
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const path = window.location.pathname;
    
    // List of pages that require login
    const protectedPages = ['overview.html', 'analytics.html', 'notification.html', 'profile.html'];
    
    // Check if current page is protected
    const isProtectedPage = protectedPages.some(page => path.includes(page));
    const isLoginPage = path.includes('index.html') || path === '/' || path.endsWith('/');

    if (!session && isProtectedPage) {
        // User is NOT logged in but trying to access a protected page -> Kick to login
        console.warn("Unauthorized access attempt. Redirecting to login.");
        window.location.href = 'index.html';
    } else if (session && isLoginPage) {
        // User IS logged in but trying to access login page -> Send to overview
        window.location.href = 'overview.html';
    }
}
// Run security check immediately
checkSession();

// 1. AUTHENTICATION LOGIC (Login & Signup)
const authForm = document.getElementById('auth-form');
const toggleAuthBtn = document.getElementById('toggle-auth');
const nameField = document.getElementById('name-field-container');
const authTitle = document.getElementById('auth-title');
const submitBtn = document.getElementById('submit-btn');
const authMessage = document.getElementById('auth-message');

// State to track if user is Logging in or Signing up
let isLoginMode = true;

// Toggle between Login and Sign Up
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

// Handle Form Submission (Login or Sign Up)
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
                // LOGIN LOGIC
                const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                // Redirect handled by checkSession, but we can force it here too
                window.location.href = 'overview.html';
            } else {
                // SIGN UP LOGIC
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

// 2. LOGOUT LOGIC
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

// 3. THEME TOGGLE LOGIC (Fix Light/Dark Mode)
const themeToggleBtn = document.getElementById('theme-toggle');
const body = document.body;

function initTheme() {
    // 1. Check if user previously saved a preference
    const savedTheme = localStorage.getItem('theme');
    
    // 2. Apply theme
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
        // Switch between Sun and Moon icons
        icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
}

if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        // Check current state
        const isCurrentlyDark = body.getAttribute('data-theme') === 'dark';
        
        if (isCurrentlyDark) {
            // Switch to Light Mode
            body.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            updateThemeIcon(false);
        } else {
            // Switch to Dark Mode
            body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            updateThemeIcon(true);
        }
    });
}

// Initialize theme on load
initTheme();


// 4. SENSOR DATA STREAMING
async function fetchSensorData() {
    // Only fetch if elements exist (prevents errors on login page)
    if (!document.getElementById('ov-tilapia-temp') && !document.getElementById('tilapia-temp')) return;

    // Check session again before fetching data (Double Security)
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return; 

    const { data, error } = await supabaseClient
        .from('readings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (data && data.length > 0) {
        const reading = data[0];
        
        // Helper to update text safely
        const safeSetText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        // Overview Page Updates
        safeSetText('ov-tilapia-temp', reading.tilapia_temp);
        safeSetText('ov-tilapia-ph', reading.tilapia_ph);
        safeSetText('ov-bio-temp', reading.bio_temp);
        safeSetText('ov-bio-ph', reading.bio_ph);
        safeSetText('ov-tds', reading.tds_value + " ppm");
        safeSetText('ov-ec', reading.ec_value + " µS");
        safeSetText('ov-water', reading.water_level + "%");
        
        // Analytics Page Updates
        safeSetText('tilapia-temp', reading.tilapia_temp + " °C");
        safeSetText('tilapia-ph', reading.tilapia_ph);
        safeSetText('bio-temp', reading.bio_temp + " °C");
        safeSetText('bio-ph', reading.bio_ph);
        safeSetText('water-level', reading.water_level + "%");
        safeSetText('tds-value', reading.tds_value);
    }
}

// 5. HARDWARE CONTROL (Pumps, Servo & Lights)
async function toggleDevice(columnName, state) {
    // Security check
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        alert("You must be logged in to control hardware.");
        return;
    }

    console.log(`Toggling ${columnName} to ${state}`);
    await supabaseClient.from('controls').update({ [columnName]: state }).eq('id', 1);
}

// Listeners for toggle switches
document.getElementById('pump-12v-toggle')?.addEventListener('change', (e) => toggleDevice('pump_12v', e.target.checked));
document.getElementById('pump-5v-toggle')?.addEventListener('change', (e) => toggleDevice('pump_5v', e.target.checked));
document.getElementById('light-toggle')?.addEventListener('change', (e) => toggleDevice('light_status', e.target.checked));

document.getElementById('btn-feed-now')?.addEventListener('click', async () => {
    await toggleDevice('feeder_servo', true);
    alert("Feeding fish...");
    // Auto turn off servo after 3 seconds (simulated pulse)
    setTimeout(() => toggleDevice('feeder_servo', false), 3000);
});

// Start Data Fetching
if (window.location.pathname.includes('overview') || window.location.pathname.includes('analytics') || window.location.pathname.includes('profile')) {
    setInterval(fetchSensorData, 3000);
    fetchSensorData();
}