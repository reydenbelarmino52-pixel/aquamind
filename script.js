// AquaMinds - script.js
const SUPABASE_URL = "https://lskiuxhcyrhsijrnznnj.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxza2l1eGhjeXJoc2lqcm56bm5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTk4NTksImV4cCI6MjA4NDczNTg1OX0.R_jSTUfLXlXRNTtohKCYe4LT2iCMCWxYDCJjWmP60WE";

// FIX: Use 'supabaseClient' to avoid conflict with the global 'supabase' library
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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

// 3. SENSOR DATA STREAMING
async function fetchSensorData() {
    // Only fetch if elements exist (prevents errors on login page)
    if (!document.getElementById('ov-tilapia-temp') && !document.getElementById('tilapia-temp')) return;

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

// 4. HARDWARE CONTROL (Pumps, Servo & Lights)
async function toggleDevice(columnName, state) {
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