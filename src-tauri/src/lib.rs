mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::read_workspace,
            commands::write_files,
            commands::compute_tree_hash,
            commands::create_version_archive,
            commands::restore_from_archive,
            commands::detect_changes,
            commands::invoke_cli,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
