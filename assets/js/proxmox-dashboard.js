// ── Configuration ────────────────────────────────────────────
// Remplir avec l'URL publique de ton Proxmox (via Cloudflare Tunnel)
const PROXMOX_WEB_URL = 'https://pve.mael-m.fr';

// Chemin vers le proxy PHP (relatif à la page qui charge ce script)
const API_BASE = '../proxmox-api.php';

// ── État global ───────────────────────────────────────────────
let countdownVal = 30;
let countdownTimer = null;

// ── Fetch helpers ─────────────────────────────────────────────
async function fetchVMs() {
    const res = await fetch(`${API_BASE}?action=list`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.data;
}

async function sendVMAction(node, type, vmid, act) {
    const res = await fetch(`${API_BASE}?action=vm-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node, type, vmid, act }),
        signal: AbortSignal.timeout(10000),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
}

// ── UI helpers ────────────────────────────────────────────────
function bar(pct, color) {
    const c = color ?? (pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#22c55e');
    return `<div class="px-bar-track"><div class="px-bar" style="width:${pct}%;background:${c}"></div></div>`;
}

function cpuBar(cpu) {
    if (cpu === null || cpu === undefined) return '<span class="px-muted">—</span>';
    const pct = Math.round(cpu * 100);
    return `${bar(pct)}<span>${pct}%</span>`;
}

function ramBar(mem, maxmem) {
    if (!maxmem) return '<span class="px-muted">—</span>';
    const pct = Math.round((mem / maxmem) * 100);
    return `${bar(pct)}<span>${pct}%</span>`;
}

function vmCard(vm) {
    const running = vm.status === 'running';
    const icon    = vm.type === 'qemu' ? 'fa-desktop' : 'fa-cube';
    const typeTag = vm.type === 'qemu' ? 'VM' : 'CT';
    const ipText  = vm.ip ?? '<span class="px-muted">—</span>';

    const actions = running
        ? `<button class="px-btn px-btn--danger"
                data-node="${vm.node}" data-type="${vm.type}" data-vmid="${vm.vmid}" data-act="stop">
                <i class="fa-solid fa-stop"></i> Stop
           </button>
           <a class="px-btn px-btn--secondary" href="${PROXMOX_WEB_URL}" target="_blank" rel="noopener noreferrer">
               <i class="fa-solid fa-terminal"></i> Console
           </a>`
        : `<button class="px-btn px-btn--success"
                data-node="${vm.node}" data-type="${vm.type}" data-vmid="${vm.vmid}" data-act="start">
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
                    <i class="fa-solid fa-network-wired"></i>
                    <span>${ipText}</span>
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

// ── Render ────────────────────────────────────────────────────
async function render() {
    const grid      = document.getElementById('px-grid');
    const statusBar = document.getElementById('px-status-bar');
    if (!grid) return;

    try {
        statusBar && statusBar.classList.remove('px-error');
        const vms = await fetchVMs();
        grid.innerHTML = vms.length
            ? vms.map(vmCard).join('')
            : '<p class="px-empty">Aucune machine trouvée.</p>';

        const now = new Date().toLocaleTimeString('fr-FR');
        if (statusBar) statusBar.textContent = `${vms.length} machine${vms.length > 1 ? 's' : ''} — actualisé à ${now}`;
    } catch (err) {
        grid.innerHTML = `<p class="px-error-msg"><i class="fa-solid fa-triangle-exclamation"></i> ${err.message}</p>`;
        if (statusBar) {
            statusBar.textContent = 'Erreur de connexion au proxy';
            statusBar.classList.add('px-error');
        }
    }
}

// ── Action handler (délégation d'évènement) ──────────────────
async function handleAction(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;

    const { node, type, vmid, act } = btn.dataset;
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        await sendVMAction(node, type, parseInt(vmid), act);
        // Laisser Proxmox démarrer/arrêter avant de rafraîchir
        await new Promise(r => setTimeout(r, 2000));
        countdownVal = 30;
        await render();
    } catch (err) {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        alert(`Erreur : ${err.message}`);
    }
}

// ── Countdown & auto-refresh ──────────────────────────────────
function startCountdown() {
    const el = document.getElementById('px-countdown');
    countdownTimer = setInterval(async () => {
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
    const grid       = document.getElementById('px-grid');
    const refreshBtn = document.getElementById('px-refresh-btn');
    const openBtn    = document.getElementById('px-open-proxmox');

    if (!grid) return;

    // Lien vers l'interface Proxmox
    if (openBtn) openBtn.href = PROXMOX_WEB_URL;

    // Bouton refresh manuel
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            countdownVal = 30;
            const el = document.getElementById('px-countdown');
            if (el) el.textContent = countdownVal;
            await render();
        });
    }

    // Délégation d'évènement pour Start/Stop
    grid.addEventListener('click', handleAction);

    render();
    startCountdown();
});
