<?php
// Configuration - NE PAS PARTAGER CES INFOS / ajouter stats.php au .gitignore
$cfClientId     = "2b96ea4f1b42d18ae26e919bf1e2fa31.access";
$cfClientSecret = "13a2d4e16bdc8aac1fdcb5650ba05d0779818985de9256cdf62a0bb5beb33ca9";
$pveToken       = "PVEAPIToken=root@pam!portfolio-stats=92e22939-89f4-43dc-8bb4-58098b733265";

$url = "https://pve.mael-m.fr/api2/json/nodes";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 5);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "CF-Access-Client-Id: $cfClientId",
    "CF-Access-Client-Secret: $cfClientSecret",
    "Authorization: $pveToken"
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

header('Content-Type: application/json');

if ($curlError) {
    echo json_encode(["status" => "offline", "error" => $curlError]);
} elseif ($httpCode === 200) {
    echo $response;
} else {
    echo json_encode(["status" => "offline", "error" => "HTTP $httpCode"]);
}