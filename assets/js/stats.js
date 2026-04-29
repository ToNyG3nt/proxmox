function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}j ${h}h`;
  return `${h}h`;
}

function formatBytes(bytes) {
  return (bytes / 1073741824).toFixed(1) + ' Go';
}

async function fetchProxmoxStats() {
  const container = document.getElementById('proxmox-stats');
  if (!container) return;

  try {
    const res = await fetch('stats.php', { signal: AbortSignal.timeout(6000) });
    const json = await res.json();

    if (json.status === 'offline' || json.error || !json.data) {
      setStatsOffline();
      return;
    }

    const d = json.data;
    const cpuPct = Math.round(d.cpu * 100);
    const ramPct = Math.round((d.memory.used / d.memory.total) * 100);

    document.getElementById('stat-dot').className = 'stat-dot online';
    document.getElementById('stat-status').textContent = 'En ligne';
    document.getElementById('stat-cpu').textContent = cpuPct + '%';
    document.getElementById('stat-ram').textContent = ramPct + '%';
    document.getElementById('stat-uptime').textContent = formatUptime(d.uptime);

    setBarWidth('bar-cpu', cpuPct);
    setBarWidth('bar-ram', ramPct);
  } catch {
    setStatsOffline();
  }
}

function setBarWidth(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.min(pct, 100) + '%';
}

function setStatsOffline() {
  document.getElementById('stat-dot').className = 'stat-dot offline';
  document.getElementById('stat-status').textContent = 'Hors ligne';
  ['stat-cpu', 'stat-ram', 'stat-uptime'].forEach(id => {
    document.getElementById(id).textContent = '—';
  });
}

fetchProxmoxStats();
