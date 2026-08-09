use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::Path;

const SESSION_VAULT_VERSION: u32 = 1;
const SESSION_FILE_NAME: &str = "account-session.dpapi";
const MAX_SESSION_VALUE_BYTES: usize = 32 * 1024;
const DEVICE_CLAIM_DOMAIN: &[u8] = b"app.skribly.desktop/device-claim/v1";

#[derive(Debug, Default, Serialize, Deserialize)]
struct SessionVault {
    version: u32,
    values: BTreeMap<String, String>,
}

fn validate_storage_key(key: &str) -> Result<(), String> {
    let valid_characters = key
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'));
    if key.len() < 8
        || key.len() > 180
        || !key.starts_with("sb-")
        || !key.ends_with("-auth-token")
        || !valid_characters
    {
        return Err("The account session storage key is not allowed.".to_string());
    }
    Ok(())
}

fn vault_path(app_data_dir: &Path) -> std::path::PathBuf {
    app_data_dir.join(SESSION_FILE_NAME)
}

#[cfg(target_os = "windows")]
fn protect(bytes: &[u8]) -> Result<Vec<u8>, String> {
    use windows::core::PCWSTR;
    use windows::Win32::Security::Cryptography::{
        CryptProtectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    let length = u32::try_from(bytes.len())
        .map_err(|_| "The account session is too large for Windows protection.".to_string())?;
    let input = CRYPT_INTEGER_BLOB {
        cbData: length,
        pbData: bytes.as_ptr().cast_mut(),
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    unsafe {
        CryptProtectData(
            &input,
            PCWSTR::null(),
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
        .map_err(|error| format!("Windows could not protect the account session: {error}"))?;
        copy_and_free_windows_blob(output)
    }
}

#[cfg(target_os = "windows")]
fn unprotect(bytes: &[u8]) -> Result<Vec<u8>, String> {
    use windows::Win32::Security::Cryptography::{
        CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    let length = u32::try_from(bytes.len())
        .map_err(|_| "The protected account session is too large.".to_string())?;
    let input = CRYPT_INTEGER_BLOB {
        cbData: length,
        pbData: bytes.as_ptr().cast_mut(),
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    unsafe {
        CryptUnprotectData(
            &input,
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
        .map_err(|error| format!("Windows could not unlock the account session: {error}"))?;
        copy_and_free_windows_blob(output)
    }
}

#[cfg(target_os = "windows")]
unsafe fn copy_and_free_windows_blob(
    blob: windows::Win32::Security::Cryptography::CRYPT_INTEGER_BLOB,
) -> Result<Vec<u8>, String> {
    use windows::Win32::Foundation::{LocalFree, HLOCAL};

    if blob.pbData.is_null() || blob.cbData == 0 || blob.cbData as usize > 1024 * 1024 {
        if !blob.pbData.is_null() {
            unsafe {
                let _ = LocalFree(Some(HLOCAL(blob.pbData.cast())));
            }
        }
        return Err("Windows returned an invalid protected account session.".to_string());
    }

    let result = unsafe { std::slice::from_raw_parts(blob.pbData, blob.cbData as usize) }.to_vec();
    let free_result = unsafe { LocalFree(Some(HLOCAL(blob.pbData.cast()))) };
    if !free_result.0.is_null() {
        return Err("Windows could not release protected account memory safely.".to_string());
    }
    Ok(result)
}

#[cfg(not(target_os = "windows"))]
fn protect(_bytes: &[u8]) -> Result<Vec<u8>, String> {
    Err("Protected account sessions are currently available on Windows only.".to_string())
}

#[cfg(not(target_os = "windows"))]
fn unprotect(_bytes: &[u8]) -> Result<Vec<u8>, String> {
    Err("Protected account sessions are currently available on Windows only.".to_string())
}

fn load_vault(app_data_dir: &Path) -> Result<SessionVault, String> {
    let path = vault_path(app_data_dir);
    if !path.exists() {
        return Ok(SessionVault {
            version: SESSION_VAULT_VERSION,
            values: BTreeMap::new(),
        });
    }

    let encrypted = fs::read(&path)
        .map_err(|error| format!("The protected account session could not be read: {error}"))?;
    let cleartext = unprotect(&encrypted)?;
    let vault: SessionVault = serde_json::from_slice(&cleartext).map_err(|_| {
        "The protected account session is damaged and was not overwritten.".to_string()
    })?;
    if vault.version != SESSION_VAULT_VERSION {
        return Err(format!(
            "Protected account session version {} is not supported.",
            vault.version
        ));
    }
    Ok(vault)
}

fn save_vault(app_data_dir: &Path, vault: &SessionVault) -> Result<(), String> {
    fs::create_dir_all(app_data_dir)
        .map_err(|error| format!("The account data directory could not be created: {error}"))?;
    let cleartext = serde_json::to_vec(vault)
        .map_err(|_| "The account session could not be encoded safely.".to_string())?;
    let encrypted = protect(&cleartext)?;
    let path = vault_path(app_data_dir);
    let temporary = path.with_extension("dpapi.tmp");
    let mut file = fs::File::create(&temporary)
        .map_err(|error| format!("The protected account session could not be staged: {error}"))?;
    file.write_all(&encrypted)
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("The protected account session could not be saved: {error}"))?;

    if path.exists() {
        let backup = path.with_extension("dpapi.bak");
        fs::copy(&path, &backup).map_err(|error| {
            format!("The previous protected account session could not be backed up: {error}")
        })?;
        fs::remove_file(&path).map_err(|error| {
            format!("The protected account session could not be replaced: {error}")
        })?;
    }
    fs::rename(&temporary, &path)
        .map_err(|error| format!("The protected account session could not be committed: {error}"))
}

pub fn get_session_value(app_data_dir: &Path, key: &str) -> Result<Option<String>, String> {
    validate_storage_key(key)?;
    Ok(load_vault(app_data_dir)?.values.get(key).cloned())
}

pub fn set_session_value(app_data_dir: &Path, key: &str, value: &str) -> Result<(), String> {
    validate_storage_key(key)?;
    if value.is_empty() || value.len() > MAX_SESSION_VALUE_BYTES {
        return Err(
            "The account session value is empty or exceeds the safe size limit.".to_string(),
        );
    }
    let mut vault = load_vault(app_data_dir)?;
    vault.values.insert(key.to_string(), value.to_string());
    save_vault(app_data_dir, &vault)
}

pub fn remove_session_value(app_data_dir: &Path, key: &str) -> Result<(), String> {
    validate_storage_key(key)?;
    let mut vault = load_vault(app_data_dir)?;
    if vault.values.remove(key).is_some() {
        save_vault(app_data_dir, &vault)?;
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn machine_guid() -> Result<String, String> {
    use winreg::enums::{HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_64KEY};
    use winreg::RegKey;

    let key = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey_with_flags(
            r"SOFTWARE\Microsoft\Cryptography",
            KEY_READ | KEY_WOW64_64KEY,
        )
        .map_err(|error| format!("Windows device identity is unavailable: {error}"))?;
    let guid: String = key
        .get_value("MachineGuid")
        .map_err(|error| format!("Windows device identity could not be read: {error}"))?;
    let normalized = guid.trim().to_ascii_lowercase();
    if normalized.len() < 16 || normalized.len() > 128 {
        return Err("Windows returned an invalid device identity.".to_string());
    }
    Ok(normalized)
}

#[cfg(not(target_os = "windows"))]
fn machine_guid() -> Result<String, String> {
    Err("Account-backed trials are currently available on Windows only.".to_string())
}

pub fn device_claim() -> Result<String, String> {
    let guid = machine_guid()?;
    let mut hasher = Sha256::new();
    hasher.update(DEVICE_CLAIM_DOMAIN);
    hasher.update([0]);
    hasher.update(guid.as_bytes());
    Ok(format!("skd_{}", URL_SAFE_NO_PAD.encode(hasher.finalize())))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn account_storage_accepts_only_supabase_auth_session_keys() {
        assert!(validate_storage_key("sb-project-ref-auth-token").is_ok());
        assert!(validate_storage_key("license").is_err());
        assert!(validate_storage_key("sb-project-ref-auth-token/../../notes").is_err());
    }

    #[test]
    fn session_values_have_a_bounded_size() {
        assert_eq!(MAX_SESSION_VALUE_BYTES, 32 * 1024);
    }
}
