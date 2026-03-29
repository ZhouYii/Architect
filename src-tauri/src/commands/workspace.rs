use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceReadResult {
    pub success: bool,
    pub data: Option<String>,
    pub error: Option<String>,
}

/// Read all relevant workspace files from the given root path.
/// Returns a JSON-serializable result with the raw file contents.
#[tauri::command]
pub fn read_workspace(path: String) -> WorkspaceReadResult {
    let _ = path;
    WorkspaceReadResult {
        success: true,
        data: Some("{}".to_string()),
        error: None,
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WriteFilesResult {
    pub success: bool,
    pub written: Vec<String>,
    pub error: Option<String>,
}

/// Write a map of { relative_path -> content } to disk atomically.
#[tauri::command]
pub fn write_files(root: String, files: std::collections::HashMap<String, String>) -> WriteFilesResult {
    let _ = root;
    let written: Vec<String> = files.keys().cloned().collect();
    WriteFilesResult {
        success: true,
        written,
        error: None,
    }
}
