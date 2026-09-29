fn main() {
    println!("cargo:rerun-if-env-changed=SKRIBLY_TRIAL_ENFORCED");
    println!("cargo:rerun-if-env-changed=SKRIBLY_LICENSE_PUBLIC_KEY");

    if matches!(
        std::env::var("SKRIBLY_TRIAL_ENFORCED").as_deref(),
        Ok("1" | "true" | "TRUE")
    ) {
        let encoded = std::env::var("SKRIBLY_LICENSE_PUBLIC_KEY")
            .expect("Trial-enforced builds require SKRIBLY_LICENSE_PUBLIC_KEY");
        let decoded = base64::Engine::decode(
            &base64::engine::general_purpose::URL_SAFE_NO_PAD,
            encoded.trim(),
        )
        .expect("SKRIBLY_LICENSE_PUBLIC_KEY must be unpadded base64url");
        assert_eq!(
            decoded.len(),
            32,
            "SKRIBLY_LICENSE_PUBLIC_KEY must contain a 32-byte Ed25519 public key"
        );
    }

    tauri_build::build()
}
