mod commands;

use commands::cli::invoke_cli;
use commands::versioning::{compute_tree_hash, create_version_archive, restore_from_archive};
use commands::workspace::{read_workspace, write_files, read_track, list_tracks};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            read_workspace,
            write_files,
            read_track,
            list_tracks,
            compute_tree_hash,
            create_version_archive,
            restore_from_archive,
            invoke_cli,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
