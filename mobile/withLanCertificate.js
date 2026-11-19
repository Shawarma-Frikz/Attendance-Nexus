const fs = require("fs");
const path = require("path");
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

module.exports = function withLanCertificate(config) {
  const apiBase = process.env.EXPO_PUBLIC_API_BASE;
  if (!apiBase) return config;
  const parsed = new URL(apiBase);
  if (parsed.protocol !== "https:") throw new Error("Student app backend must use HTTPS.");
  const projectRoot = (config._internal && config._internal.projectRoot) || process.cwd();
  const rootCA = path.join(projectRoot, "certs", "rootCA.pem");
  if (!fs.existsSync(rootCA)) throw new Error("Missing mobile/certs/rootCA.pem. Run backend/setup-local-https.ps1.");
  const host = parsed.hostname;
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    app.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    app.$["android:usesCleartextTraffic"] = "false";
    return mod;
  });
  return withDangerousMod(config, ["android", async (mod) => {
    const res = path.join(mod.modRequest.platformProjectRoot, "app", "src", "main", "res");
    const raw = path.join(res, "raw");
    const xmlDir = path.join(res, "xml");
    fs.mkdirSync(raw, { recursive: true });
    fs.mkdirSync(xmlDir, { recursive: true });
    fs.copyFileSync(rootCA, path.join(raw, "nexus_local_root.pem"));
    const xml = '<?xml version="1.0" encoding="utf-8"?>\n' +
      '<network-security-config>\n' +
      '  <domain-config cleartextTrafficPermitted="false">\n' +
      '    <domain includeSubdomains="false">' + host + '</domain>\n' +
      '    <trust-anchors>\n' +
      '      <certificates src="@raw/nexus_local_root"/>\n' +
      '    </trust-anchors>\n' +
      '  </domain-config>\n' +
      '</network-security-config>\n';
    fs.writeFileSync(path.join(xmlDir, "network_security_config.xml"), xml, "utf8");
    return mod;
  }]);
};
