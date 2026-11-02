fn main() {
    println!("cargo:rerun-if-changed=icons");
    // Naming the app's own commands makes each one a permission, so a window can only call the
    // ones its capability lists (see capabilities/default.json).
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "write_diagram_file",
            "hold_api_key",
            "save_api_key",
            "discard_api_key",
            "delete_api_key",
            "stored_api_keys",
            "provider_request",
            "cancel_provider_request",
        ]),
    ))
    .expect("failed to run tauri-build");
}
