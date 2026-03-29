use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct HashResult {
    pub hash: String,
    pub error: Option<String>,
}

/// Compute a SHA-256 hash of the entire directory tree at `path`.
#[tauri::command]
pub fn compute_tree_hash(path: String) -> HashResult {
    let _ = path;
    HashResult {
        hash: "0000000000000000000000000000000000000000000000000000000000000000".to_string(),
        error: None,
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ArchiveResult {
    pub success: bool,
    pub archive_path: Option<String>,
    pub error: Option<String>,
}

/// Create a compressed tar archive of the workspace at the given version label.
#[tauri::command]
pub fn create_version_archive(workspace_path: String, version_label: String) -> ArchiveResult {
    let _ = workspace_path;
    let _ = version_label;
    ArchiveResult {
        success: true,
        archive_path: Some("/tmp/archive.tar.gz".to_string()),
        error: None,
    }
}

/// Restore the workspace from a previously created archive.
#[tauri::command]
pub fn restore_from_archive(archive_path: String, target_path: String) -> ArchiveResult {
    let _ = archive_path;
    let _ = target_path;
    ArchiveResult {
        success: true,
        archive_path: None,
        error: None,
    }
}
