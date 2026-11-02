mod files;
mod keys;
mod proxy;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(proxy::Http::default())
        .manage(proxy::PendingApiKeys::default())
        .manage(proxy::InFlight::default())
        .invoke_handler(tauri::generate_handler![
            files::write_diagram_file,
            keys::hold_api_key,
            keys::save_api_key,
            keys::discard_api_key,
            keys::delete_api_key,
            keys::stored_api_keys,
            proxy::provider_request,
            proxy::cancel_provider_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
