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
    console.log('[stats]', json);

    if (json.status === 'offline' || json.error || !json.data) {
      setStatsOffline();
      return;
    }

    // /api2/json/nodes retourne un tableau, on prend le premier nœud online
    const node = Array.isArray(json.data)
      ? json.data.find(n => n.status === 'online') || json.data[0]
      : json.data;

    if (!node) { setStatsOffline(); return; }

    const cpuPct = Math.round((node.cpu ?? 0) * 100);
    const ramPct = node.maxmem ? Math.round((node.mem / node.maxmem) * 100) : 0;

    document.getElementById('stat-dot').className = 'stat-dot online';
    document.getElementById('stat-status').textContent = 'En ligne';
    document.getElementById('stat-cpu').textContent = cpuPct + '%';
    document.getElementById('stat-ram').textContent = ramPct + '%';
    document.getElementById('stat-uptime').textContent = formatUptime(node.uptime ?? 0);

    setBarWidth('bar-cpu', cpuPct);
    setBarWidth('bar-ram', ramPct);
  } catch (e) {
    console.error('[stats] erreur:', e);
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
