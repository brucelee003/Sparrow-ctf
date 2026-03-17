/* ========================================
   WebPWN CTF — HACKER THEME JS  |  app.js
   ======================================== */

'use strict';

/* ─── Nav: highlight active link ─── */
(function () {
  const path = location.pathname;
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href && path.includes(href.replace('../', '').replace('../../', ''))) {
      a.classList.add('active');
    }
  });
})();

/* ─── Solved Flags Storage ─── */
const CTF = {
  STORAGE_KEY: 'webpwn_solved',

  getSolved() {
    try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}'); }
    catch { return {}; }
  },

  markSolved(challengeId, flag) {
    const s = this.getSolved();
    if (!s[challengeId]) {
      s[challengeId] = { flag, solvedAt: new Date().toISOString() };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(s));
      this.celebrate();
      if (window.syncToFirebase) window.syncToFirebase();
      return true; // newly solved
    }
    return false;
  },

  isSolved(challengeId) {
    return !!this.getSolved()[challengeId];
  },

  totalSolved() {
    return Object.keys(this.getSolved()).length;
  },

  /* ─── Celebrate: confetti burst ─── */
  celebrate() {
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti-overlay';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const colors = ['#bc13fe', '#d600ff', '#ffffff', '#ff00ff', '#8a55cc', '#00d2ff'];
    const particles = Array.from({ length: 90 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 8 + 4,
      h: Math.random() * 14 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.15,
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 4 + 2,
      alpha: 1,
    }));

    let frame;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let allDone = true;
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rot += p.rotV;
        if (p.y < canvas.height + 20) { allDone = false; p.alpha = Math.max(0, p.alpha - 0.008); }
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (!allDone) { frame = requestAnimationFrame(draw); }
      else { canvas.remove(); }
    }
    draw();
    setTimeout(() => { cancelAnimationFrame(frame); canvas.remove(); }, 5000);
  },

  /* ─── On-Page Submission ─── */
  initSubmission(challengeId, expectedFlag) {
    const area = document.getElementById('submission-area');
    if (!area) return;

    if (this.isSolved(challengeId)) {
      showSolvedBanner('submission-area', challengeId, expectedFlag);
      return;
    }

    area.innerHTML = `
        <div class="submission-box">
            <label class="submission-label">> ENTER FLAG FOR VERIFICATION</label>
            <div class="submission-form">
                <input type="text" class="submission-input" id="flag-input" placeholder="FLAG{...}" autocomplete="off">
                <button class="submission-btn" id="flag-submit">SUBMIT</button>
            </div>
            <div id="submission-msg" style="margin-top:12px; font-family:var(--font-mono); font-size:0.75rem; min-height:1.2em;"></div>
        </div>`;

    const input = document.getElementById('flag-input');
    const btn = document.getElementById('flag-submit');
    const msg = document.getElementById('submission-msg');

    const doSubmit = () => {
      const val = input.value.trim();
      if (val === expectedFlag) {
        this.markSolved(challengeId, val);
        showSolvedBanner('submission-area', challengeId, val);
      } else {
        msg.textContent = '> [ACCESS DENIED] INVALID FLAG SIGNATURE';
        msg.style.color = 'var(--red)';
        input.parentElement.classList.add('shake');
        setTimeout(() => {
          input.parentElement.classList.remove('shake');
          msg.textContent = '';
        }, 2000);
      }
    };

    btn.addEventListener('click', doSubmit);
    input.addEventListener('keypress', e => { if (e.key === 'Enter') doSubmit(); });
  },

  /* ─── Session Management ─── */
  logout() {
    if (confirm("TERMINATE SESSION: This will clear your operator profile but retain challenge progress. Continue?")) {
      localStorage.removeItem('webpwn_user');
      sessionStorage.removeItem('booted'); // Re-trigger boot sequence on login
      window.location.reload();
    }
  },
};

/* ─── Firebase Database Integration ─── */
const firebaseConfig = {
    apiKey: "AIzaSyBLZD7lk9JNJbP6IAFtHB3E4mIXC5qp2gw",
    authDomain: "sparrow-s-ctf-eb492.firebaseapp.com",
    projectId: "sparrow-s-ctf-eb492",
    databaseURL: "https://sparrow-s-ctf-eb492-default-rtdb.firebaseio.com",
    storageBucket: "sparrow-s-ctf-eb492.firebasestorage.app",
    messagingSenderId: "315018567239",
    appId: "1:315018567239:web:5fbe7f782c025f040a1b62"
};

let db = null, fbDoc = null, fbGetDoc = null, fbSetDoc = null;
let isFbInitializing = false;
let fbInitPromise = null;

function sanitizeKey(key) {
    return key.replace(/[.#$\[\]/]/g, '_');
}

async function initFirebase() {
    if (fbInitPromise) return fbInitPromise;
    
    fbInitPromise = (async () => {
        isFbInitializing = true;
        try {
            console.log("Firebase: Initializing Firestore...");
            const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js");
            const { getFirestore, doc, getDoc, setDoc } = await import("https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js");

            const app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            fbDoc = doc;
            fbGetDoc = getDoc;
            fbSetDoc = setDoc;

            console.log("Firebase: Firestore initialized.");
            await syncFromFirebase();
            return true;
        } catch (e) {
            console.error("Firebase init failed:", e);
            return false;
        } finally {
            isFbInitializing = false;
        }
    })();
    
    return fbInitPromise;
}

async function syncFromFirebase() {
    const user = JSON.parse(localStorage.getItem('webpwn_user'));
    if (!user || !user.name || !db || !fbGetDoc || !fbDoc) return;
    try {
        const key = sanitizeKey(user.name);
        const docSnap = await fbGetDoc(fbDoc(db, 'users', key));
        
        if (docSnap.exists()) {
            console.log("Firebase: Firestore data found, syncing to local...");
            const data = docSnap.data();
            if (data.solved) localStorage.setItem(CTF.STORAGE_KEY, JSON.stringify(data.solved));
            if (data.profile) localStorage.setItem('webpwn_user', JSON.stringify(data.profile));
            if (data.operators) localStorage.setItem('webpwn_operators', JSON.stringify(data.operators));
            if (data.xss_comments) localStorage.setItem('xss_comments', JSON.stringify(data.xss_comments));
            
            if (window.renderScoreboard) window.renderScoreboard();
            else window.updateCTFUI();
        } else {
            console.log("Firebase: No Firestore record for this user.");
        }
    } catch (e) {
        console.error("Firebase Firestore sync error:", e);
    }
}

window.syncToFirebase = async function() {
    if (!db) {
        console.log("Firebase: Waiting for initialization before sync...");
        const success = await initFirebase();
        if (!success) return;
    }
    
    if (!fbSetDoc || !fbDoc) return;
    const user = JSON.parse(localStorage.getItem('webpwn_user'));
    if (!user || !user.name) return;
    
    const key = sanitizeKey(user.name);
    console.log(`Firebase: Syncing to Firestore for [${user.name}]...`);
    
    const payload = {};
    const solved = localStorage.getItem(CTF.STORAGE_KEY);
    if (solved) payload.solved = JSON.parse(solved);
    payload.profile = user;
    
    const ops = localStorage.getItem('webpwn_operators');
    if (ops) payload.operators = JSON.parse(ops);
    
    const xss = localStorage.getItem('xss_comments');
    if (xss) payload.xss_comments = JSON.parse(xss);

    try {
        await fbSetDoc(fbDoc(db, 'users', key), payload);
        console.log("Firebase: Firestore sync complete.");
    } catch (e) {
        console.error("Firebase: Firestore sync failed", e);
    }
};

window.updateCTFUI = function() {
    const scoreEl = document.getElementById('nav-solved-count');
    if (scoreEl) scoreEl.textContent = CTF.totalSolved() + '/24';
    const hudScoreEl = document.getElementById('hud-solve-count');
    const hudBarEl = document.getElementById('hud-solve-bar');
    if (hudScoreEl) hudScoreEl.textContent = CTF.totalSolved() + ' / 24';
    if (hudBarEl) hudBarEl.style.width = (CTF.totalSolved() / 24 * 100) + '%';
    const heroCount = document.getElementById('hero-solved-count');
    const heroBar = document.getElementById('hero-solved-bar');
    if (heroCount) heroCount.textContent = CTF.totalSolved();
    if (heroBar) heroBar.style.width = (CTF.totalSolved() / 24 * 100) + '%';
    const solved = CTF.getSolved();
    document.querySelectorAll('[data-challenge-id]').forEach(el => {
        const id = el.dataset.challengeId;
        if (solved[id]) {
            el.classList.add('solved');
            const badge = el.querySelector('.solve-status');
            if (badge) badge.innerHTML = '<span class="badge badge-solved">✓ Solved</span>';
        }
    });
};

initFirebase();

/* ─── Utility Functions ─── */
function showSolvedBanner(containerId, challengeId, flag) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div class="solved-banner animate-in">
      <span class="solved-banner-icon">🎉</span>
      <div>
        <strong>Challenge Solved!</strong>
        <div style="margin-top:4px;font-size:0.82rem;color:var(--text-muted)">
          Flag accepted and recorded.
        </div>
      </div>
    </div>
    <div class="flag-reveal animate-in" style="animation-delay:0.1s">
      <span>🚩</span> ${flag}
    </div>`;
}

function restoreFlag(challengeId, containerId, flag) {
  if (CTF.isSolved(challengeId)) showSolvedBanner(containerId, challengeId, flag);
}

window.CTF = CTF;
window.showSolvedBanner = showSolvedBanner;
window.restoreFlag = restoreFlag;

/* ────────────────────────────────────────────────
   ADVANCED HACKER EFFECTS & IDENTITY
   ──────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {

  // 1. Matrix Rain - DEACTIVATED for cleaner aesthetic
  /*
  (function initMatrix() {
    // ... matrix logic ...
  })();
  */

  // 2. Custom White Crosshair Cursor
  (function initCursor() {
    const cur = document.createElement('div');
    cur.id = 'hk-cursor';
    cur.innerHTML = `<div class="hk-cur-h"></div><div class="hk-cur-v"></div><div class="hk-cur-dot"></div>`;
    document.body.appendChild(cur);

    const trail = document.createElement('div');
    trail.id = 'hk-cursor-trail';
    document.body.appendChild(trail);

    let mx = -100, my = -100;
    let tx = -100, ty = -100;

    document.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      cur.style.transform = `translate(${mx}px, ${my}px)`;
    });

    function animateCursor() {
      tx += (mx - tx) * 0.8;
      ty += (my - ty) * 0.8;
      trail.style.transform = `translate(${tx}px, ${ty}px)`;
      requestAnimationFrame(animateCursor);
    }
    animateCursor();

    document.addEventListener('click', e => {
      const ripple = document.createElement('div');
      ripple.className = 'hk-ripple';
      ripple.style.left = e.clientX + 'px';
      ripple.style.top = e.clientY + 'px';
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });

    // Make interactive elements affect custom cursor
    function bindInteractive() {
      document.querySelectorAll('a, button, .btn, input, textarea, .challenge-card-link').forEach(el => {
        if (el.dataset.bound) return;
        el.dataset.bound = "1";
        el.addEventListener('mouseenter', () => cur.classList.add('on-link'));
        el.addEventListener('mouseleave', () => cur.classList.remove('on-link'));
      });
    }
    bindInteractive();
    setInterval(bindInteractive, 2000);
  })();

  // 3. Boot Sequence
  (function initBoot() {
    if (sessionStorage.getItem('booted')) return;
    sessionStorage.setItem('booted', '1');

    const overlay = document.createElement('div');
    overlay.id = 'boot-overlay';
    overlay.innerHTML = `<div id="boot-terminal"><div id="boot-lines"></div><span id="boot-cursor" class="blink">█</span></div>`;
    document.body.appendChild(overlay);

    const user = JSON.parse(localStorage.getItem('webpwn_user') || '{}');
    const alias = user.name || 'HACKER';

    const lines = [
      '> WEBPWN.CTF v2.1 — INITIALIZING...',
      '> [OK] Kernel modules loaded',
      '> [OK] Network stack initialized',
      '> [!!] INTRUSION DETECTION DISABLED',
      '> [OK] Anonymization layer active',
      '> ─────────────────────────────────────────',
      `> ACCESS GRANTED. WELCOME, ${alias.toUpperCase()}.`,
      '> ─────────────────────────────────────────',
    ];

    let i = 0;
    const container = document.getElementById('boot-lines');
    function printLine() {
      if (i >= lines.length) {
        setTimeout(() => {
          overlay.style.opacity = '0';
          overlay.style.transition = 'opacity 0.6s ease';
          setTimeout(() => overlay.remove(), 700);
        }, 800);
        return;
      }
      const line = document.createElement('div');
      line.className = 'boot-line';
      if (lines[i].includes('[!!]')) line.style.color = '#ff0055';
      else if (lines[i].includes('[OK]')) line.style.color = '#bc13fe';
      else if (lines[i].includes('WELCOME')) { line.style.color = '#ffffff'; line.style.fontWeight = '700'; line.style.textShadow = '0 0 10px rgba(188,19,254,0.8)'; }
      else line.style.color = '#8a55cc';
      container.appendChild(line);

      let j = 0;
      const text = lines[i];
      const iv = setInterval(() => {
        line.textContent += text[j++];
        if (j >= text.length) { clearInterval(iv); i++; setTimeout(printLine, 60); }
      }, 15);
    }
    setTimeout(printLine, 400);
  })();


  // 6. Hacker Identity Modal & Profile HUD
  (function initIdentity() {
    const updateProfileHUD = () => {
      const user = JSON.parse(localStorage.getItem('webpwn_user'));
      if (!user) return;

      // Ensure Profile HUD exists in Nav
      let navProfile = document.querySelector('.nav-profile');
      if (!navProfile) {
        const navInner = document.querySelector('.nav-inner');
        if (navInner) {
          navProfile = document.createElement('div');
          navProfile.className = 'nav-profile';
          navProfile.innerHTML = `
            <div class="nav-profile-label">OPERATOR</div>
            <div class="nav-profile-name" id="hud-user-name">${user.name}</div>
          `;
          navInner.appendChild(navProfile);

          // Create Dropdown Panel
          const hudPanel = document.createElement('div');
          hudPanel.id = 'profile-hud';
          hudPanel.innerHTML = `
            <div class="hud-stat-group">
                <div class="hud-stat-label">> CONNECTED_ALIAS</div>
                <div class="hud-stat-val">${user.name.toUpperCase()}</div>
            </div>
            <div class="hud-stat-group">
                <div class="hud-stat-label">> MISSION_PROGRESS</div>
                <div class="hud-stat-val" id="hud-solve-count">${CTF.totalSolved()} / 24</div>
                <div class="stat-bar" style="height: 4px; margin-top:8px;">
                    <div id="hud-solve-bar" class="stat-bar-fill" style="width: ${(CTF.totalSolved() / 24) * 100}%"></div>
                </div>
            </div>
            <button class="logout-btn" onclick="CTF.logout()">TERMINATE_SESSION</button>
          `;
          document.body.appendChild(hudPanel);

          navProfile.addEventListener('click', (e) => {
            e.stopPropagation();
            hudPanel.classList.toggle('active');
          });

          document.addEventListener('click', () => hudPanel.classList.remove('active'));
          hudPanel.addEventListener('click', (e) => e.stopPropagation());
        }
      }
    };

    const checkIdentity = () => {
      if (localStorage.getItem('webpwn_user')) {
        updateProfileHUD();
        return;
      }

      const modal = document.createElement('div');
      modal.id = 'identity-modal';
      modal.innerHTML = `
        <div id="identity-box" class="animate-in">
          <div class="id-title">Identity Initialization</div>
          <div class="id-fields">
            <div class="id-input-group">
              <label class="id-label">> OPERATOR ALIAS</label>
              <input type="text" id="id-name" class="id-input" placeholder="e.g. ZeroCool" autocomplete="off">
            </div>
            <div class="id-input-group">
              <label class="id-label">> CONTACT FREQUENCY</label>
              <input type="text" id="id-number" class="id-input" placeholder="+1..." autocomplete="off">
            </div>
            <button id="id-save" class="id-btn">ESTABLISH CONNECTION</button>
          </div>
        </div>`;
      document.body.appendChild(modal);

      document.getElementById('id-save').addEventListener('click', () => {
        const name = document.getElementById('id-name').value.trim();
        const num = document.getElementById('id-number').value.trim();
        if (name && num) {
          const userData = { name, num, joined: new Date().toISOString() };
          localStorage.setItem('webpwn_user', JSON.stringify(userData));

          // Persistence: Add to operators log
          const ops = JSON.parse(localStorage.getItem('webpwn_operators') || '[]');
          const exists = ops.findIndex(o => o.name.toLowerCase() === name.toLowerCase());
          if (exists > -1) {
            ops[exists] = userData; // Update existing
          } else {
            ops.push(userData);
          }
          localStorage.setItem('webpwn_operators', JSON.stringify(ops));

          if (window.syncToFirebase) window.syncToFirebase();

          modal.style.opacity = '0';
          modal.style.transition = 'opacity 0.5s ease';
          setTimeout(() => {
            modal.remove();
            updateProfileHUD();
            // Force redirect to mission root (index.html)
            const isSubPage = window.location.pathname.includes('/advanced/') ||
              window.location.pathname.includes('/intermediate/') ||
              window.location.pathname.includes('/beginner/') ||
              window.location.pathname.includes('/scoreboard/') ||
              window.location.pathname.includes('/admin/');

            if (isSubPage) {
              // Find how many levels deep we are to get back to root
              const depth = (window.location.pathname.match(/\//g) || []).length;
              // Simple static site root resolution
              if (window.location.pathname.endsWith('index.html')) {
                window.location.href = window.location.pathname.includes('/advanced/') || window.location.pathname.includes('/intermediate/') || window.location.pathname.includes('/beginner/') ? '../../index.html' : '../index.html';
              } else {
                // Fallback to absolute project root if possible, or just a known relative skip
                window.location.href = '/';
              }
            } else if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
              window.location.href = 'index.html';
            }
          }, 500);
        } else {
          const btn = document.getElementById('id-save');
          btn.textContent = 'DATA REQUIRED';
          btn.style.borderColor = '#ff0040';
          setTimeout(() => {
            btn.textContent = 'ESTABLISH CONNECTION';
            btn.style.borderColor = 'var(--cyan)';
          }, 1500);
        }
      });
    };

    checkIdentity();
  })();

  // 7. General Maintenance
  if (!window.renderScoreboard) {
      window.updateCTFUI();
  }

  // Headings scramble (h1 and h2)
  document.querySelectorAll('h1.hero-title, h2').forEach(h => {
    const original = h.innerHTML; // Use innerHTML to preserve <span> tags
    const text = h.textContent;
    const chars = 'ABCDEFGHIKLMNOPQRSTVXYZ0123456789'; // Using characters with more uniform widths
    let count = 0;

    // For h1, we want a slower, more deliberate "typing" feel
    const speed = h.tagName === 'H1' ? 25 : 30;
    const increment = h.tagName === 'H1' ? 0.25 : 0.3;

    const iv = setInterval(() => {
      // Create a plain text scramble
      const scrambled = text.split('').map((c, i) => {
        if (i < count) return text[i];
        if (text[i] === ' ' || text[i] === '\n') return text[i];
        return chars[Math.floor(Math.random() * chars.length)];
      }).join('');

      // If it's the hero title, we need to carefully re-inject the <span> for "NETWORK."
      if (h.classList.contains('hero-title') && count >= text.indexOf('NETWORK')) {
        h.innerHTML = scrambled.replace('NETWORK.', '<span>NETWORK.</span>').replace(/\n/g, '<br>');
      } else {
        h.textContent = scrambled;
      }

      count += increment;
      if (count >= text.length) {
        h.innerHTML = original;
        clearInterval(iv);
      }
    }, speed);
  });
});
