import assert from "node:assert/strict";
import { test } from "node:test";
import { backupDomains, backupRules, extractionRules, prepareManifest } from "./prepare-android-build.mjs";

const source = '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.INTERNET" /><application android:label="@string/app_name" android:usesCleartextTraffic="${usesCleartextTraffic}"><activity android:name=".MainActivity" /></application></manifest>';
test("private manifest preparation is idempotent and preserves the app/activity", () => {
  const prepared = prepareManifest(source);
  assert.equal(prepareManifest(prepared), prepared);
  assert.match(prepared, /android:allowBackup="false"/);
  assert.match(prepared, /android:usesCleartextTraffic="false"/);
  assert.match(prepared, /android:dataExtractionRules="@xml\/skribli_data_extraction_rules"/);
  assert.match(prepared, /android:name="\.MainActivity"/);
});
test("unknown OS permissions and changed manifest contracts fail closed", () => {
  assert.throws(() => prepareManifest(source.replace("android.permission.INTERNET", "android.permission.READ_CONTACTS")), /Unexpected Android permission/);
  assert.throws(() => prepareManifest(source.replace('${usesCleartextTraffic}', 'true')), /Unexpected Android usesCleartextTraffic/);
  assert.throws(() => prepareManifest(source.replace('<application ', '<application android:allowBackup="true" ')), /Unexpected Android allowBackup/);
  assert.throws(() => prepareManifest(source + '<application />'), /exactly one/);
});
test("legacy, cloud and device-transfer rules exclude every supported storage domain", () => {
  assert.equal(backupDomains.length, 9);
  for (const domain of backupDomains) {
    assert.equal(backupRules.split(`domain="${domain}"`).length - 1, 1);
    assert.equal(extractionRules.split(`domain="${domain}"`).length - 1, 2);
  }
  assert.match(extractionRules, /<cloud-backup>/);
  assert.match(extractionRules, /<device-transfer>/);
});
