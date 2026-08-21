use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

const LICENSE_STORAGE_VERSION: u32 = 2;
const TRIAL_DAYS: u64 = 7;
const SECONDS_PER_DAY: u64 = 24 * 60 * 60;
const CLOCK_ROLLBACK_TOLERANCE_SECONDS: u64 = 5 * 60;
const PRODUCT_ID: &str = "skribly-personal-windows";

static LICENSE_PATH: OnceLock<PathBuf> = OnceLock::new();

fn bind_license_path(
    slot: &OnceLock<PathBuf>,
    requested_path: PathBuf,
) -> Result<&PathBuf, String> {
    if slot.get().is_none() {
        // Another initializer may win between get() and set(); validate the winner below.
        let _ = slot.set(requested_path.clone());
    }

    let active_path = slot
        .get()
        .ok_or_else(|| "Licence storage could not be initialized.".to_string())?;
    if active_path != &requested_path {
        return Err(format!(
            "Licence storage was already initialized at a different path (active: {}, requested: {}).",
            active_path.display(),
            requested_path.display()
        ));
    }
    Ok(active_path)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LicenseMode {
    Beta,
    AccountRequired,
    Trial,
    Licensed,
    Expired,
    ClockError,
    EntitlementError,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LicenseStatus {
    pub mode: LicenseMode,
    pub enforcement_enabled: bool,
    pub can_write: bool,
    pub trial_days_total: u64,
    pub trial_days_remaining: u64,
    pub trial_expires_at: Option<u64>,
    pub device_id: String,
    pub licensed_email: Option<String>,
    pub updates_until: Option<u64>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LicenseRecord {
    version: u32,
    device_id: String,
    trial_started_at: u64,
    trial_expires_at: u64,
    last_seen_at: u64,
    activation_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LicenseGrant {
    product_id: String,
    license_id: String,
    #[serde(default)]
    account_id: String,
    email: String,
    device_id: String,
    issued_at: u64,
    #[serde(default)]
    entitlement_type: EntitlementType,
    #[serde(default)]
    expires_at: Option<u64>,
    #[serde(default)]
    offline_until: Option<u64>,
    #[serde(default)]
    updates_until: u64,
    #[serde(default)]
    perpetual: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum EntitlementType {
    Trial,
    Licensed,
    #[default]
    Legacy,
}

pub fn enforcement_enabled() -> bool {
    matches!(
        option_env!("SKRIBLY_TRIAL_ENFORCED"),
        Some("1") | Some("true") | Some("TRUE")
    )
}

fn beta_status(device_id: String) -> LicenseStatus {
    LicenseStatus {
        mode: LicenseMode::Beta,
        enforcement_enabled: false,
        can_write: true,
        trial_days_total: TRIAL_DAYS,
        trial_days_remaining: TRIAL_DAYS,
        trial_expires_at: None,
        device_id,
        licensed_email: None,
        updates_until: None,
        message: "The current Windows beta is free while licence activation is validated."
            .to_string(),
    }
}

fn now_epoch_seconds() -> Result<u64, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .map_err(|_| "The system clock is earlier than the Unix epoch.".to_string())
}

fn stable_device_id() -> Result<String, String> {
    crate::core::account::device_claim()
}

fn load_record(path: &Path, now: u64) -> Result<LicenseRecord, String> {
    if !path.exists() {
        return Ok(LicenseRecord {
            version: LICENSE_STORAGE_VERSION,
            device_id: stable_device_id()?,
            trial_started_at: 0,
            trial_expires_at: 0,
            last_seen_at: now,
            activation_token: None,
        });
    }

    let bytes = fs::read(path).map_err(|error| format!("Failed to read licence state: {error}"))?;
    let record: LicenseRecord = serde_json::from_slice(&bytes)
        .map_err(|error| format!("Local licence state is damaged: {error}"))?;
    if record.version == 1 {
        return Ok(LicenseRecord {
            version: LICENSE_STORAGE_VERSION,
            device_id: stable_device_id()?,
            trial_started_at: 0,
            trial_expires_at: 0,
            last_seen_at: record.last_seen_at.min(now),
            activation_token: None,
        });
    }
    if record.version != LICENSE_STORAGE_VERSION {
        return Err(format!(
            "Unsupported local licence state version {}",
            record.version
        ));
    }
    Ok(record)
}

fn save_record(path: &Path, record: &LicenseRecord) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Licence state path has no parent directory.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Failed to create the licence data directory: {error}"))?;

    let payload = serde_json::to_vec_pretty(record)
        .map_err(|error| format!("Failed to encode licence state: {error}"))?;
    let temporary = path.with_extension("json.tmp");
    let mut file = fs::File::create(&temporary)
        .map_err(|error| format!("Failed to open temporary licence state: {error}"))?;
    file.write_all(&payload)
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("Failed to safely write licence state: {error}"))?;

    if path.exists() {
        let backup = path.with_extension("json.bak");
        let _ = fs::copy(path, backup);
        fs::remove_file(path)
            .map_err(|error| format!("Failed to replace licence state: {error}"))?;
    }
    fs::rename(&temporary, path)
        .map_err(|error| format!("Failed to commit licence state: {error}"))?;
    Ok(())
}

fn public_key() -> Result<VerifyingKey, String> {
    let encoded = option_env!("SKRIBLY_LICENSE_PUBLIC_KEY")
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Licence activation is not enabled in this build.".to_string())?;
    let bytes = URL_SAFE_NO_PAD
        .decode(encoded.trim())
        .map_err(|_| "The embedded licence public key is invalid.".to_string())?;
    let key_bytes: [u8; 32] = bytes
        .try_into()
        .map_err(|_| "The embedded licence public key must contain 32 bytes.".to_string())?;
    VerifyingKey::from_bytes(&key_bytes)
        .map_err(|_| "The embedded licence public key is invalid.".to_string())
}

fn verify_activation_token(token: &str, device_id: &str, now: u64) -> Result<LicenseGrant, String> {
    verify_activation_token_with_key(token, device_id, now, &public_key()?)
}

fn verify_activation_token_with_key(
    token: &str,
    device_id: &str,
    now: u64,
    key: &VerifyingKey,
) -> Result<LicenseGrant, String> {
    if token.len() > 16 * 1024 {
        return Err("The entitlement token exceeds the safe size limit.".to_string());
    }
    let (encoded_payload, encoded_signature) = token
        .trim()
        .split_once('.')
        .ok_or_else(|| "Licence key format is invalid.".to_string())?;
    let payload_bytes = URL_SAFE_NO_PAD
        .decode(encoded_payload)
        .map_err(|_| "Licence payload is invalid.".to_string())?;
    let signature_bytes = URL_SAFE_NO_PAD
        .decode(encoded_signature)
        .map_err(|_| "Licence signature is invalid.".to_string())?;
    let signature = Signature::from_slice(&signature_bytes)
        .map_err(|_| "Licence signature length is invalid.".to_string())?;
    key.verify(&payload_bytes, &signature)
        .map_err(|_| "Licence signature could not be verified.".to_string())?;

    let grant: LicenseGrant = serde_json::from_slice(&payload_bytes)
        .map_err(|_| "Licence payload could not be read.".to_string())?;
    if grant.product_id != PRODUCT_ID {
        return Err("This licence belongs to a different product.".to_string());
    }
    if grant.device_id != device_id {
        return Err("This licence was issued for a different device.".to_string());
    }
    if grant.issued_at > now.saturating_add(CLOCK_ROLLBACK_TOLERANCE_SECONDS) {
        return Err("Entitlement issue time is later than the current system clock.".to_string());
    }
    if grant.email.trim().is_empty() || grant.email.len() > 320 {
        return Err("The entitlement account email is invalid.".to_string());
    }

    match grant.entitlement_type {
        EntitlementType::Trial => {
            let expires_at = grant
                .expires_at
                .ok_or_else(|| "The trial entitlement has no expiry.".to_string())?;
            let offline_until = grant
                .offline_until
                .ok_or_else(|| "The trial entitlement has no offline limit.".to_string())?;
            if grant.account_id.trim().is_empty()
                || expires_at == 0
                || offline_until > expires_at
                || (expires_at > now
                    && offline_until.saturating_add(CLOCK_ROLLBACK_TOLERANCE_SECONDS)
                        < grant.issued_at)
            {
                return Err("The trial entitlement lifecycle is invalid.".to_string());
            }
        }
        EntitlementType::Licensed | EntitlementType::Legacy => {
            if !grant.perpetual {
                return Err("The personal licence entitlement is not perpetual.".to_string());
            }
        }
    }
    Ok(grant)
}

fn trial_days_remaining(expires_at: u64, now: u64) -> u64 {
    if now >= expires_at {
        return 0;
    }
    let remaining = expires_at.saturating_sub(now);
    (remaining + SECONDS_PER_DAY - 1) / SECONDS_PER_DAY
}

fn status_for_record(record: &LicenseRecord, enforced: bool, now: u64) -> LicenseStatus {
    if !enforced {
        return beta_status(record.device_id.clone());
    }

    if now.saturating_add(CLOCK_ROLLBACK_TOLERANCE_SECONDS) < record.last_seen_at {
        return LicenseStatus {
            mode: LicenseMode::ClockError,
            enforcement_enabled: true,
            can_write: false,
            trial_days_total: TRIAL_DAYS,
            trial_days_remaining: 0,
            trial_expires_at: Some(record.trial_expires_at),
            device_id: record.device_id.clone(),
            licensed_email: None,
            updates_until: None,
            message: "Skribli detected that the system clock moved backwards. Correct the clock and restart the app."
                .to_string(),
        };
    }

    let Some(token) = record.activation_token.as_deref() else {
        return LicenseStatus {
            mode: LicenseMode::AccountRequired,
            enforcement_enabled: true,
            can_write: false,
            trial_days_total: TRIAL_DAYS,
            trial_days_remaining: 0,
            trial_expires_at: None,
            device_id: record.device_id.clone(),
            licensed_email: None,
            updates_until: None,
            message: "Sign in to verify this device and start or continue its Skribli trial."
                .to_string(),
        };
    };

    let grant = match verify_activation_token(token, &record.device_id, now) {
        Ok(grant) => grant,
        Err(message) => {
            return LicenseStatus {
                mode: LicenseMode::EntitlementError,
                enforcement_enabled: true,
                can_write: false,
                trial_days_total: TRIAL_DAYS,
                trial_days_remaining: 0,
                trial_expires_at: None,
                device_id: record.device_id.clone(),
                licensed_email: None,
                updates_until: None,
                message: format!("The saved account entitlement is invalid: {message}"),
            }
        }
    };

    match grant.entitlement_type {
        EntitlementType::Trial => {
            let expires_at = grant.expires_at.unwrap_or_default();
            let offline_until = grant.offline_until.unwrap_or_default();
            let remaining = trial_days_remaining(expires_at, now);
            if remaining == 0 {
                LicenseStatus {
                    mode: LicenseMode::Expired,
                    enforcement_enabled: true,
                    can_write: false,
                    trial_days_total: TRIAL_DAYS,
                    trial_days_remaining: 0,
                    trial_expires_at: Some(expires_at),
                    device_id: record.device_id.clone(),
                    licensed_email: Some(grant.email),
                    updates_until: None,
                    message: "Your seven-day trial has ended. Existing Skribs remain available to read and export."
                        .to_string(),
                }
            } else if now > offline_until {
                LicenseStatus {
                    mode: LicenseMode::AccountRequired,
                    enforcement_enabled: true,
                    can_write: false,
                    trial_days_total: TRIAL_DAYS,
                    trial_days_remaining: remaining,
                    trial_expires_at: Some(expires_at),
                    device_id: record.device_id.clone(),
                    licensed_email: Some(grant.email),
                    updates_until: None,
                    message: "Reconnect and sign in to refresh this device's trial status. Existing Skribs remain readable and exportable."
                        .to_string(),
                }
            } else {
                LicenseStatus {
                    mode: LicenseMode::Trial,
                    enforcement_enabled: true,
                    can_write: true,
                    trial_days_total: TRIAL_DAYS,
                    trial_days_remaining: remaining,
                    trial_expires_at: Some(expires_at),
                    device_id: record.device_id.clone(),
                    licensed_email: Some(grant.email),
                    updates_until: None,
                    message: format!(
                        "Full trial active. {remaining} day{} remaining.",
                        if remaining == 1 { "" } else { "s" }
                    ),
                }
            }
        }
        EntitlementType::Licensed | EntitlementType::Legacy => LicenseStatus {
            mode: LicenseMode::Licensed,
            enforcement_enabled: true,
            can_write: true,
            trial_days_total: TRIAL_DAYS,
            trial_days_remaining: 0,
            trial_expires_at: None,
            device_id: record.device_id.clone(),
            licensed_email: Some(grant.email),
            updates_until: Some(grant.updates_until),
            message: "Personal licence active.".to_string(),
        },
    }
}

pub fn current_status(path: &Path) -> Result<LicenseStatus, String> {
    let now = now_epoch_seconds()?;
    let enforced = enforcement_enabled();
    let mut record = load_record(path, now)?;

    if !enforced {
        record.last_seen_at = now;
    } else if now >= record.last_seen_at {
        record.last_seen_at = now;
    }

    let status = status_for_record(&record, enforced, now);
    save_record(path, &record)?;
    Ok(status)
}

pub fn require_write_access(path: &Path) -> Result<LicenseStatus, String> {
    let status = current_status(path)?;
    if status.can_write {
        Ok(status)
    } else {
        Err(status.message.clone())
    }
}

pub fn activate(path: &Path, token: &str) -> Result<LicenseStatus, String> {
    let now = now_epoch_seconds()?;
    let mut record = load_record(path, now)?;
    verify_activation_token(token, &record.device_id, now)?;
    record.activation_token = Some(token.trim().to_string());
    record.last_seen_at = now;
    save_record(path, &record)?;
    current_status(path)
}

pub fn deactivate(path: &Path) -> Result<LicenseStatus, String> {
    let now = now_epoch_seconds()?;
    let mut record = load_record(path, now)?;
    record.activation_token = None;
    record.last_seen_at = now;
    save_record(path, &record)?;
    current_status(path)
}

pub fn initialize_from_skrib_path(skrib_path: &Path) -> Result<LicenseStatus, String> {
    let path = skrib_path.with_file_name("license.json");
    current_status(bind_license_path(&LICENSE_PATH, path)?)
}

pub fn current_global_status() -> Result<LicenseStatus, String> {
    if !enforcement_enabled() {
        return Ok(beta_status("SKR-BETA".to_string()));
    }
    match LICENSE_PATH.get() {
        Some(path) => current_status(path),
        None => Err("Licence storage has not been initialized.".to_string()),
    }
}

pub fn require_global_write_access() -> Result<LicenseStatus, String> {
    if !enforcement_enabled() {
        return Ok(beta_status("SKR-BETA".to_string()));
    }
    match LICENSE_PATH.get() {
        Some(path) => require_write_access(path),
        None => Err("Licence storage has not been initialized.".to_string()),
    }
}

pub fn activate_global(token: &str) -> Result<LicenseStatus, String> {
    let path = LICENSE_PATH
        .get()
        .ok_or_else(|| "Licence storage has not been initialized.".to_string())?;
    activate(path, token)
}

pub fn deactivate_global() -> Result<LicenseStatus, String> {
    let path = LICENSE_PATH
        .get()
        .ok_or_else(|| "Licence storage has not been initialized.".to_string())?;
    deactivate(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    fn record(now: u64) -> LicenseRecord {
        LicenseRecord {
            version: LICENSE_STORAGE_VERSION,
            device_id: "SKR-TEST".to_string(),
            trial_started_at: now,
            trial_expires_at: now + TRIAL_DAYS * SECONDS_PER_DAY,
            last_seen_at: now,
            activation_token: None,
        }
    }

    fn signed_trial_token(
        device_id: &str,
        issued_at: u64,
        expires_at: u64,
        offline_until: u64,
    ) -> (String, VerifyingKey) {
        let signing_key = SigningKey::from_bytes(&[7u8; 32]);
        let grant = LicenseGrant {
            product_id: PRODUCT_ID.to_string(),
            license_id: "trial-test-token".to_string(),
            account_id: "account-test".to_string(),
            email: "founder@example.com".to_string(),
            device_id: device_id.to_string(),
            issued_at,
            entitlement_type: EntitlementType::Trial,
            expires_at: Some(expires_at),
            offline_until: Some(offline_until),
            updates_until: 0,
            perpetual: false,
        };
        let payload = serde_json::to_vec(&grant).expect("trial grant should encode");
        let signature = signing_key.sign(&payload);
        let token = format!(
            "{}.{}",
            URL_SAFE_NO_PAD.encode(payload),
            URL_SAFE_NO_PAD.encode(signature.to_bytes())
        );
        (token, signing_key.verifying_key())
    }

    #[test]
    fn beta_build_never_blocks_writes() {
        let status = status_for_record(&record(1_000), false, 10_000_000);
        assert_eq!(status.mode, LicenseMode::Beta);
        assert!(status.can_write);
    }

    #[test]
    fn enforced_trial_counts_partial_days_up() {
        let mut value = record(1_000);
        value.activation_token = None;
        let status = status_for_record(&value, true, 1_000);
        assert_eq!(status.mode, LicenseMode::AccountRequired);
        assert!(!status.can_write);
    }

    #[test]
    fn expired_trial_is_read_only() {
        let mut value = record(1_000);
        value.activation_token = None;
        let status = status_for_record(&value, true, 3_000);
        assert_eq!(status.mode, LicenseMode::AccountRequired);
        assert!(!status.can_write);
    }

    #[test]
    fn backwards_clock_is_rejected() {
        let mut value = record(1_000);
        value.last_seen_at = 10_000;
        let status = status_for_record(&value, true, 1_000);
        assert_eq!(status.mode, LicenseMode::ClockError);
        assert!(!status.can_write);
    }

    #[test]
    fn server_signed_trial_is_bound_to_the_expected_device() {
        let (token, key) = signed_trial_token("skd_test", 1_000, 10_000, 5_000);
        let grant = verify_activation_token_with_key(&token, "skd_test", 1_000, &key)
            .expect("valid server trial should verify");
        assert_eq!(grant.entitlement_type, EntitlementType::Trial);
        assert!(verify_activation_token_with_key(&token, "skd_other", 1_000, &key).is_err());
    }

    #[test]
    fn expired_server_trial_remains_a_valid_read_only_entitlement() {
        let (token, key) = signed_trial_token("skd_test", 20_000, 10_000, 10_000);
        let grant = verify_activation_token_with_key(&token, "skd_test", 20_000, &key)
            .expect("an authentic expired grant must remain readable");
        assert_eq!(grant.expires_at, Some(10_000));
    }

    #[test]
    fn trial_offline_window_cannot_extend_past_trial_expiry() {
        let (token, key) = signed_trial_token("skd_test", 1_000, 10_000, 10_001);
        assert!(verify_activation_token_with_key(&token, "skd_test", 1_000, &key).is_err());
    }

    #[test]
    fn licence_storage_path_is_idempotent_but_cannot_be_rebound() {
        let slot = OnceLock::new();
        let durable = PathBuf::from("durable").join("license.json");
        let temporary = PathBuf::from("temporary").join("license.json");

        assert_eq!(
            bind_license_path(&slot, durable.clone()).expect("first path should bind"),
            &durable
        );
        assert_eq!(
            bind_license_path(&slot, durable.clone()).expect("same path should be idempotent"),
            &durable
        );

        let error = bind_license_path(&slot, temporary)
            .expect_err("a second storage location must fail closed");
        assert!(error.contains("already initialized at a different path"));
    }
}
