
/*
 * XanisxHex Gateway
 * Browser-only UI + Supabase Auth.
 * Tidak mengirim command ke Mona atau Reviactryl.
 */

const CONFIG = {
  supabaseUrl: "https://PROJECT_REF.supabase.co",
  publishableKey: "sb_publishable_REPLACE_ME"
};

const $ = (id) => document.getElementById(id);
const authView = $("authView");
const appView = $("appView");
const loginForm = $("loginForm");
const signupForm = $("signupForm");
const authMessage = $("authMessage");
const pages = ["overview", "analytics", "activity", "integrations", "api"];

let supabaseClient = null;
let signupMode = false;
let currentUser = null;

function showMessage(el, message, error = false) {
  el.textContent = message;
  el.style.color = error ? "#f08b87" : "";
}

function setFormBusy(form, busy) {
  const button = form.querySelector('button[type="submit"]');
  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent.trim();
  }
  button.disabled = busy;
  button.textContent = busy
    ? "Memproses..."
    : button.dataset.originalText;
}

function configurationReady() {
  return (
    CONFIG.supabaseUrl.startsWith("https://") &&
    !CONFIG.supabaseUrl.includes("PROJECT_REF") &&
    CONFIG.publishableKey.startsWith("sb_publishable_") &&
    !CONFIG.publishableKey.includes("REPLACE_ME")
  );
}

function showAuthMode() {
  loginForm.hidden = signupMode;
  signupForm.hidden = !signupMode;

  $("authTitle").textContent = signupMode
    ? "Buat akun baru."
    : "Selamat datang kembali.";

  $("authSubtitle").textContent = signupMode
    ? "Daftar untuk mengakses workspace kamu."
    : "Masuk untuk membuka dashboard kamu.";

  $("switchAuth").textContent = signupMode
    ? "Sudah punya akun? Login"
    : "Belum punya akun? Daftar";
}

function showApp(user) {
  currentUser = user;
  authView.hidden = !!user;
  appView.hidden = !user;

  if (user) {
    const initial = (user.email || "U").charAt(0).toUpperCase();
    $("avatarBtn").textContent = initial;
    $("avatarBtn").title = user.email || "Akun pengguna";
    $("authState").textContent = "Authenticated";
    $("authBadge").textContent = "READY";
    drawAllCharts();
  } else {
    $("authState").textContent = "Signed out";
    $("authBadge").textContent = "LOCKED";
    closeSidebar();
  }
}

async function init() {
  if (!window.supabase || !configurationReady()) {
    showMessage(
      authMessage,
      "Setup belum selesai: isi Project URL dan publishable key Supabase di app.js.",
      true
    );
    loginForm.querySelector('button[type="submit"]').disabled = true;
    return;
  }

  try {
    supabaseClient = window.supabase.createClient(
      CONFIG.supabaseUrl,
      CONFIG.publishableKey
    );

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    showApp(data.session?.user || null);

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      showApp(session?.user || null);
    });
  } catch {
    showMessage(
      authMessage,
      "Tidak bisa memuat sesi. Periksa konfigurasi Supabase dan koneksi internet.",
      true
    );
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) return;

  const email = loginForm.elements.email.value.trim();
  const password = loginForm.elements.password.value;
  setFormBusy(loginForm, true);
  showMessage(authMessage, "");

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    showMessage(authMessage, "Login berhasil.");
  } catch (error) {
    showMessage(
      authMessage,
      error.message || "Login gagal. Periksa email dan password.",
      true
    );
  } finally {
    setFormBusy(loginForm, false);
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) return;

  const email = signupForm.elements.email.value.trim();
  const password = signupForm.elements.password.value;
  setFormBusy(signupForm, true);
  showMessage(authMessage, "");

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (error) throw error;

    if (data.session) {
      showMessage(authMessage, "Akun berhasil dibuat.");
    } else {
      showMessage(
        authMessage,
        "Pendaftaran diterima. Periksa email untuk verifikasi akun."
      );
    }
  } catch (error) {
    showMessage(
      authMessage,
      error.message || "Pendaftaran gagal. Coba lagi nanti.",
      true
    );
  } finally {
    setFormBusy(signupForm, false);
  }
});

$("switchAuth").addEventListener("click", () => {
  signupMode = !signupMode;
  showAuthMode();
  showMessage(authMessage, "");
});

async function logout() {
  if (!supabaseClient) return;

  const button = $("sidebarLogout");
  button.disabled = true;

  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  } catch {
    showMessage(authMessage, "Logout gagal. Coba lagi.", true);
  } finally {
    button.disabled = false;
  }
}

$("sidebarLogout").addEventListener("click", logout);

$("avatarBtn").addEventListener("click", () => {
  if (currentUser?.email) {
    $("avatarBtn").title = currentUser.email;
  }
});

function openSidebar() {
  $("sidebar").classList.add("open");
  $("sidebarOverlay").classList.add("show");
}

function closeSidebar() {
  $("sidebar")?.classList.remove("open");
  $("sidebarOverlay")?.classList.remove("show");
}

$("menuToggle").addEventListener("click", openSidebar);
$("sidebarOverlay").addEventListener("click", closeSidebar);

function navigate(page) {
  if (!pages.includes(page)) page = "overview";

  for (const name of pages) {
    $("page-" + name).hidden = name !== page;
  }

  document.querySelectorAll("[data-page]").forEach((link) => {
    const active = link.dataset.page === page;
    link.classList.toggle("active", active);

    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  $("breadcrumb").textContent =
    page === "api" ? "API reference" :
    page === "activity" ? "Activity logs" :
    page.charAt(0).toUpperCase() + page.slice(1);

  closeSidebar();

  if (page === "analytics" || page === "overview") {
    requestAnimationFrame(drawAllCharts);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-page]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    navigate(link.dataset.page);
  });
});

/* Clearly labelled illustrative data; not fetched from Mona. */
const DEMO_VALUES = [24, 38, 30, 57, 43, 68, 51];

function drawChart(canvas) {
  if (!canvas || canvas.closest("[hidden]")) return;

  const rect = canvas.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const w = rect.width;
  const h = rect.height;
  const pad = { left: 30, right: 8, top: 12, bottom: 12 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  ctx.font = "10px system-ui";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const y = pad.top + ch * i / 4;
    ctx.strokeStyle = "#243329";
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();

    ctx.fillStyle = "#718477";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(String(100 - i * 25), 1, y);
  }

  const points = DEMO_VALUES.map((value, i) => ({
    x: pad.left + cw * i / (DEMO_VALUES.length - 1),
    y: pad.top + ch * (1 - value / 100)
  }));

  const gradient = ctx.createLinearGradient(0, pad.top, 0, h);
  gradient.addColorStop(0, "rgba(105,230,155,0.22)");
  gradient.addColorStop(1, "rgba(105,230,155,0)");

  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.lineTo(points[points.length - 1].x, h - pad.bottom);
  ctx.lineTo(points[0].x, h - pad.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = "#69e69b";
  ctx.lineWidth = 2.2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  points.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#69e69b";
    ctx.fill();
    ctx.strokeStyle = "#0e1511";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function drawAllCharts() {
  drawChart($("activityChart"));
  drawChart($("analyticsChart"));
}

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(drawAllCharts, 120);
});

window.addEventListener("hashchange", () => {
  const page = location.hash.replace("#", "");
  if (pages.includes(page)) navigate(page);
});

showAuthMode();
init();
      
