use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceReadResult {
    pub success: bool,
    pub data: Option<String>,
    pub error: Option<String>,
}

/// Read all relevant workspace files from the given root path.
/// Walks `.architect/tree/` directory, reads every node.yaml found,
/// and returns a JSON object keyed by relative path (e.g. "tree/root/node.yaml").
/// Also reads workspace.yaml and workspace.state.yaml if present.
#[tauri::command]
pub fn read_workspace(path: String) -> WorkspaceReadResult {
    let base = Path::new(&path);
    let architect_dir = base.join(".architect");

    if !architect_dir.exists() {
        return WorkspaceReadResult {
            success: false,
            data: None,
            error: Some(format!(
                ".architect directory not found at {}",
                architect_dir.display()
            )),
        };
    }

    let mut file_map: HashMap<String, String> = HashMap::new();

    // Read workspace.yaml and workspace.state.yaml
    for filename in &["workspace.yaml", "workspace.state.yaml"] {
        let fpath = architect_dir.join(filename);
        if fpath.exists() {
            match fs::read_to_string(&fpath) {
                Ok(content) => {
                    file_map.insert(filename.to_string(), content);
                }
                Err(e) => {
                    return WorkspaceReadResult {
                        success: false,
                        data: None,
                        error: Some(format!("Failed to read {}: {}", filename, e)),
                    };
                }
            }
        }
    }

    // Walk the tree directory for node.yaml files (and .ts / .md companions)
    let tree_dir = architect_dir.join("tree");
    if tree_dir.exists() {
        for entry in WalkDir::new(&tree_dir)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if entry.file_type().is_file() {
                let abs = entry.path();
                // Compute relative key from .architect root
                let rel = abs
                    .strip_prefix(&architect_dir)
                    .unwrap_or(abs)
                    .to_string_lossy()
                    .replace('\\', "/");

                match fs::read_to_string(abs) {
                    Ok(content) => {
                        file_map.insert(rel, content);
                    }
                    Err(e) => {
                        return WorkspaceReadResult {
                            success: false,
                            data: None,
                            error: Some(format!("Failed to read {}: {}", rel, e)),
                        };
                    }
                }
            }
        }
    }

    match serde_json::to_string(&file_map) {
        Ok(json) => WorkspaceReadResult {
            success: true,
            data: Some(json),
            error: None,
        },
        Err(e) => WorkspaceReadResult {
            success: false,
            data: None,
            error: Some(format!("JSON serialization failed: {}", e)),
        },
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WriteFilesResult {
    pub success: bool,
    pub written: Vec<String>,
    pub error: Option<String>,
}

/// Write a map of { relative_path -> content } to disk under `base/.architect/`.
/// Creates parent directories as needed. Only writes if content differs from disk.
/// Returns the list of paths actually written.
#[tauri::command]
pub fn write_files(
    base: String,
    files: HashMap<String, String>,
) -> WriteFilesResult {
    let architect_dir = Path::new(&base).join(".architect");
    let mut written: Vec<String> = Vec::new();

    for (rel_path, content) in &files {
        // Normalise path separators so frontend can pass forward slashes on Windows
        let normalised = rel_path.replace('/', std::path::MAIN_SEPARATOR_STR);
        let abs_path = architect_dir.join(&normalised);

        // Create parent directories if they don't exist
        if let Some(parent) = abs_path.parent() {
            if let Err(e) = fs::create_dir_all(parent) {
                return WriteFilesResult {
                    success: false,
                    written,
                    error: Some(format!(
                        "Failed to create directories for {}: {}",
                        rel_path, e
                    )),
                };
            }
        }

        // Only write if content has changed
        let should_write = match fs::read_to_string(&abs_path) {
            Ok(existing) => existing != *content,
            Err(_) => true, // file doesn't exist or can't be read → write it
        };

        if should_write {
            if let Err(e) = fs::write(&abs_path, content.as_bytes()) {
                return WriteFilesResult {
                    success: false,
                    written,
                    error: Some(format!("Failed to write {}: {}", rel_path, e)),
                };
            }
            written.push(rel_path.clone());
        }
    }

    WriteFilesResult {
        success: true,
        written,
        error: None,
    }
}
