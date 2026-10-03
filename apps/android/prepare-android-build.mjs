import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const backupDomains = ["root", "file", "database", "sharedpref", "external", "device_root", "device_file", "device_database", "device_sharedpref"];
const exclusions = backupDomains.map(domain => `    <exclude domain="${domain}" path="." />`).join("\n");
export const backupRules = `<?xml version="1.0" encoding="utf-8"?>\n<full-backup-content>\n${exclusions}\n</full-backup-content>\n`;
export const extractionRules = `<?xml version="1.0" encoding="utf-8"?>\n<data-extraction-rules>\n  <cloud-backup>\n${exclusions}\n  </cloud-backup>\n  <device-transfer>\n${exclusions}\n  </device-transfer>\n</data-extraction-rules>\n`;

export function prepareManifest(source) {
  if ((source.match(/<application\b/g) ?? []).length !== 1) throw new Error("Expected exactly one generated Android application.");
  for (const permission of source.matchAll(/<uses-permission\b[^>]*android:name="([^"]+)"[^>]*\/?>/g)) {
    if (permission[1] !== "android.permission.INTERNET") throw new Error("Unexpected Android permission; review before preparing the private APK.");
  }
  return source.replace(/<application\b[^>]*>/, tag => {
    const expected = {
      allowBackup: ["false"],
      fullBackupContent: ["@xml/skribli_backup_rules"],
      dataExtractionRules: ["@xml/skribli_data_extraction_rules"],
      usesCleartextTraffic: ["${usesCleartextTraffic}", "false"],
    };
    for (const [name, values] of Object.entries(expected)) {
      const expression = new RegExp(`\\s+android:${name}="([^"]*)"`, "g");
      const matches = [...tag.matchAll(expression)];
      if (matches.length > 1 || (matches.length === 1 && !values.includes(matches[0][1]))) throw new Error(`Unexpected Android ${name} configuration; review before building.`);
      tag = tag.replace(expression, "");
    }
    return tag.slice(0, -1) + '\n        android:allowBackup="false"\n        android:fullBackupContent="@xml/skribli_backup_rules"\n        android:dataExtractionRules="@xml/skribli_data_extraction_rules"\n        android:usesCleartextTraffic="false">';
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = fileURLToPath(new URL("./src-tauri/gen/android/app/src/main/", import.meta.url));
  const manifest = path.join(app, "AndroidManifest.xml");
  if (!fs.existsSync(manifest)) throw new Error("Run android:init with the SDK/NDK configured before preparing the private APK.");
  const prepared = prepareManifest(fs.readFileSync(manifest, "utf8"));
  fs.mkdirSync(path.join(app, "res/xml"), { recursive: true });
  fs.writeFileSync(path.join(app, "res/xml/skribli_backup_rules.xml"), backupRules);
  fs.writeFileSync(path.join(app, "res/xml/skribli_data_extraction_rules.xml"), extractionRules);
  fs.writeFileSync(manifest, prepared);
  console.log("Private Android manifest prepared: backup/transfer exclusions, cleartext disabled, framework INTERNET permission only.");
}
