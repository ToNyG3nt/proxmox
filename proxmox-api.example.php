<?php
// ─────────────────────────────────────────────────────────────
// Proxmox API Proxy — copier ce fichier en "proxmox-api.php"
// et remplir les constantes ci-dessous. Ne jamais committer
// proxmox-api.php (il est dans .gitignore).
// ─────────────────────────────────────────────────────────────

define('PVE_HOST',  'https://192.168.x.x:8006');       // IP/host Proxmox (interne)
define('PVE_TOKEN', 'root@pam!mon-token=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');

// Restreindre les appels à ton domaine uniquement
$allowed_origin = 'https://TONDOMAINE.fr';
header('Access-Control-Allow-Origin: ' . $allowed_origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

// ── Helper curl vers l'API Proxmox ──────────────────────────
function pve(string $path, string $method = 'GET'): mixed {
    $ch = curl_init(PVE_HOST . '/api2/json' . $path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_HTTPHEADER     => ['Authorization: PVEAPIToken=' . PVE_TOKEN],
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_TIMEOUT        => 8,
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);
    if ($resp === false) return null;
    $json = json_decode($resp, true);
    return $json['data'] ?? null;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'list';

// ── GET /proxmox-api.php?action=list ─────────────────────────
if ($method === 'GET' && $action === 'list') {
    $nodes = pve('/nodes');
    if (!$nodes) { echo json_encode(['error' => 'Nœud inaccessible']); exit; }

    $vms = [];
    foreach ($nodes as $nodeInfo) {
        $node = $nodeInfo['node'];

        $qemus = pve("/nodes/$node/qemu") ?? [];
        $lxcs  = pve("/nodes/$node/lxc")  ?? [];

        foreach ($qemus as $vm) {
            $ip = null;
            if ($vm['status'] === 'running') {
                $ifaces = pve("/nodes/$node/qemu/{$vm['vmid']}/agent/network-get-interfaces");
                foreach (($ifaces['result'] ?? []) as $iface) {
                    if ($iface['name'] === 'lo') continue;
                    foreach (($iface['ip-addresses'] ?? []) as $addr) {
                        if ($addr['ip-address-type'] === 'ipv4') {
                            $ip = $addr['ip-address'];
                            break 2;
                        }
                    }
                }
            }
            $vms[] = [
                'vmid'   => $vm['vmid'],
                'name'   => $vm['name'] ?? "VM {$vm['vmid']}",
                'status' => $vm['status'],
                'type'   => 'qemu',
                'node'   => $node,
                'ip'     => $ip,
                'cpu'    => $vm['cpu']    ?? 0,
                'mem'    => $vm['mem']    ?? 0,
                'maxmem' => $vm['maxmem'] ?? 0,
            ];
        }

        foreach ($lxcs as $ct) {
            $ip = null;
            if ($ct['status'] === 'running') {
                $nets = pve("/nodes/$node/lxc/{$ct['vmid']}/interfaces");
                foreach ($nets ?? [] as $iface) {
                    if (($iface['name'] ?? '') === 'lo') continue;
                    if (!empty($iface['inet'])) {
                        $ip = explode('/', $iface['inet'])[0];
                        break;
                    }
                }
            }
            $vms[] = [
                'vmid'   => $ct['vmid'],
                'name'   => $ct['name'] ?? "CT {$ct['vmid']}",
                'status' => $ct['status'],
                'type'   => 'lxc',
                'node'   => $node,
                'ip'     => $ip,
                'cpu'    => $ct['cpu']    ?? 0,
                'mem'    => $ct['mem']    ?? 0,
                'maxmem' => $ct['maxmem'] ?? 0,
            ];
        }
    }

    usort($vms, fn($a, $b) => $a['vmid'] - $b['vmid']);
    echo json_encode(['data' => $vms]);

// ── POST /proxmox-api.php?action=vm-action ───────────────────
} elseif ($method === 'POST' && $action === 'vm-action') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $node  = preg_replace('/[^a-zA-Z0-9\-]/', '', $body['node']  ?? '');
    $type  = $body['type']  ?? '';
    $vmid  = (int)($body['vmid'] ?? 0);
    $act   = $body['act']   ?? '';

    $allowed_actions = ['start', 'stop', 'reboot', 'shutdown'];
    $allowed_types   = ['qemu', 'lxc'];

    if (!in_array($act, $allowed_actions, true)
     || !in_array($type, $allowed_types, true)
     || $vmid <= 0 || empty($node)) {
        http_response_code(400);
        echo json_encode(['error' => 'Paramètres invalides']);
        exit;
    }

    $result = pve("/nodes/$node/$type/$vmid/status/$act", 'POST');
    echo json_encode(['ok' => true, 'task' => $result]);

} else {
    http_response_code(400);
    echo json_encode(['error' => 'Action inconnue']);
}
