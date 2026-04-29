// ── Configuration ─────────────────────────────────────────────
const PROXMOX_WEB_URL = 'https://pve.mael-m.fr';
const API_VMS         = '../proxmox-api.php';
const API_STATS       = '../stats.php';

// ── État global ───────────────────────────────────────────────
let countdownVal = 30;

// ── Onglets ───────────────────────────────────────────────────
function initTabs() {
    const tabs     = document.querySelectorAll('.px-tab');
    const contents = document.querySelectorAll('.px-tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('actif'));
            contents.forEach(c => c.classList.remove('actif'));
            tab.classList.add('actif');
            document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add('actif');
        });
    });
}

// ── Stats du nœud Proxmox (via stats.php existant) ───────────
async function fetchNodeStats() {
    try {
        const res  = await fetch(API_STATS, { signal: AbortSignal.timeout(6000) });
        const json = await res.json();
        if (json.status === 'offline' || json.error || !json.data) {
            setNodeOffline(); return;
        }
        const node   = Array.isArray(json.data)
            ? json.data.find(n => n.status === 'online') || json.data[0]
            : json.data;
        if (!node) { setNodeOffline(); return; }

        const cpuPct = Math.round((node.cpu ?? 0) * 100);
        const ramPct = node.maxmem ? Math.round((node.mem / node.maxmem) * 100) : 0;

        document.getElementById('px-node-dot').className   = 'stat-dot online';
        document.getElementById('px-node-label').textContent = node.node ?? 'pve';
        document.getElementById('px-node-cpu').textContent   = cpuPct + '%';
        document.getElementById('px-node-ram').textContent   = ramPct + '%';
        document.getElementById('px-node-uptime').textContent = formatUptime(node.uptime ?? 0);
    } catch {
        setNodeOffline();
    }
}

function setNodeOffline() {
    document.getElementById('px-node-dot').className       = 'stat-dot offline';
    document.getElementById('px-node-label').textContent   = 'Hors ligne';
    ['px-node-cpu', 'px-node-ram', 'px-node-uptime'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '—';
    });
}

function formatUptime(s) {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    if (d > 0) return `${d}j ${h}h`;
    return `${h}h`;
}

// ── VM helpers ────────────────────────────────────────────────
async function fetchVMs() {
    const res  = await fetch(`${API_VMS}?action=list`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.data;
}

async function sendVMAction(node, type, vmid, act) {
    const res  = await fetch(`${API_VMS}?action=vm-action`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ node, type, vmid, act }),
        signal:  AbortSignal.timeout(10000),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
}

// ── Rendu des barres ──────────────────────────────────────────
function bar(pct) {
    const color = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#22c55e';
    return `<div class="px-bar-track"><div class="px-bar" style="width:${pct}%;background:${color}"></div></div>`;
}

function cpuBar(cpu) {
    if (cpu == null) return '<span class="px-muted">—</span>';
    const pct = Math.round(cpu * 100);
    return `${bar(pct)}<span>${pct}%</span>`;
}

function ramBar(mem, maxmem) {
    if (!maxmem) return '<span class="px-muted">—</span>';
    const pct = Math.round((mem / maxmem) * 100);
    return `${bar(pct)}<span>${pct}%</span>`;
}

// ── Carte VM ──────────────────────────────────────────────────
function vmCard(vm) {
    const running = vm.status === 'running';
    const icon    = vm.type === 'qemu' ? 'fa-desktop' : 'fa-cube';
    const typeTag = vm.type === 'qemu' ? 'VM' : 'CT';
    const ipText  = vm.ip
        ? `<span>${vm.ip}</span>`
        : '<span class="px-muted">—</span>';

    const actions = running
        ? `<button class="px-btn px-btn--danger"
               data-node="${vm.node}" data-type="${vm.type}"
               data-vmid="${vm.vmid}" data-act="stop">
               <i class="fa-solid fa-stop"></i> Stop
           </button>
           <a class="px-btn px-btn--secondary"
              href="${PROXMOX_WEB_URL}" target="_blank" rel="noopener noreferrer">
               <i class="fa-solid fa-terminal"></i> Console
           </a>`
        : `<button class="px-btn px-btn--success"
               data-node="${vm.node}" data-type="${vm.type}"
               data-vmid="${vm.vmid}" data-act="start">
               <i class="fa-solid fa-play"></i> Start
           </button>`;

    return `
        <div class="px-card ${running ? 'px-card--running' : ''}">
            <div class="px-card-header">
                <div class="px-card-title">
                    <i class="fa-solid ${icon}"></i>
                    <span>${vm.name}</span>
                    <span class="px-badge">${typeTag} ${vm.vmid}</span>
                </div>
                <div class="px-status">
                    <span class="stat-dot ${running ? 'online' : 'offline'}"></span>
                    ${running ? 'Running' : 'Stopped'}
                </div>
            </div>
            <div class="px-card-meta">
                <div class="px-meta-row">
                    <i class="fa-solid fa-network-wired"></i>${ipText}
                </div>
                <div class="px-meta-row">
                    <i class="fa-solid fa-microchip"></i>
                    ${running ? cpuBar(vm.cpu) : '<span class="px-muted">—</span>'}
                </div>
                <div class="px-meta-row">
                    <i class="fa-solid fa-memory"></i>
                    ${running ? ramBar(vm.mem, vm.maxmem) : '<span class="px-muted">—</span>'}
                </div>
            </div>
            <div class="px-card-actions">${actions}</div>
        </div>`;
}

// ── Rendu principal ───────────────────────────────────────────
async function render() {
    const grid      = document.getElementById('px-grid');
    const statusBar = document.getElementById('px-status-bar');
    if (!grid) return;

    statusBar?.classList.remove('px-error');

    try {
        const [vms] = await Promise.all([fetchVMs(), fetchNodeStats()]);

        grid.innerHTML = vms.length
            ? vms.map(vmCard).join('')
            : '<p class="px-empty">Aucune machine trouvée.</p>';

        const now = new Date().toLocaleTimeString('fr-FR');
        if (statusBar)
            statusBar.textContent = `${vms.length} machine${vms.length > 1 ? 's' : ''} — actualisé à ${now}`;
    } catch (err) {
        grid.innerHTML = `
            <p class="px-error-msg">
                <i class="fa-solid fa-triangle-exclamation"></i>
                Impossible de contacter le proxy — ${err.message}
            </p>`;
        if (statusBar) {
            statusBar.textContent = 'Erreur de connexion';
            statusBar.classList.add('px-error');
        }
    }
}

// ── Boutons Start / Stop ──────────────────────────────────────
async function handleAction(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;

    const { node, type, vmid, act } = btn.dataset;
    const originalHTML = btn.innerHTML;
    btn.disabled  = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        await sendVMAction(node, type, parseInt(vmid, 10), act);
        await new Promise(r => setTimeout(r, 2000));
        countdownVal = 30;
        await render();
    } catch (err) {
        btn.disabled  = false;
        btn.innerHTML = originalHTML;
        alert(`Erreur : ${err.message}`);
    }
}

// ── Countdown auto-refresh ────────────────────────────────────
function startCountdown() {
    const el = document.getElementById('px-countdown');
    setInterval(async () => {
        countdownVal--;
        if (el) el.textContent = countdownVal;
        if (countdownVal <= 0) {
            countdownVal = 30;
            await render();
        }
    }, 1000);
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initTabs();

    const grid       = document.getElementById('px-grid');
    const refreshBtn = document.getElementById('px-refresh-btn');
    const openBtn    = document.getElementById('px-open-proxmox');

    if (!grid) return;

    if (openBtn) openBtn.href = PROXMOX_WEB_URL;

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            countdownVal = 30;
            const el = document.getElementById('px-countdown');
            if (el) el.textContent = countdownVal;
            await render();
        });
    }

    grid.addEventListener('click', handleAction);

    render();
    startCountdown();
});
