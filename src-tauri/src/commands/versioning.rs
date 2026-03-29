use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::BufWriter;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize)]
pub struct HashResult {
    pub hash: String,
    pub error: Option<String>,
}

/// Compute a SHA-256 hash of the entire directory tree at `path`.
/// Walks `<path>/tree/` recursively, collects all node.yaml and
/// node.interfaces.ts files, sorts them lexicographically, hashes
/// each file's content, then hashes the concatenation of "path:hash\n"
/// pairs.  Returns "sha256:<hex>".
#[tauri::command]
pub fn compute_tree_hash(path: String) -> HashResult {
    let tree_dir = Path::new(&path).join("tree");

    // Collect (relative_path, content) for every node.yaml / node.interfaces.ts
    let mut entries: Vec<(String, Vec<u8>)> = Vec::new();

    for entry in WalkDir::new(&tree_dir)
        .sort_by_file_name()
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let file_path = entry.path();
        if !file_path.is_file() {
            continue;
        }
        let file_name = file_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        if file_name != "node.yaml" && file_name != "node.interfaces.ts" {
            continue;
        }

        // Relative path from the workspace root (use forward slashes for cross-platform stability)
        let rel = match file_path.strip_prefix(&path) {
            Ok(r) => r.to_string_lossy().replace('\\', "/"),
            Err(_) => file_path.to_string_lossy().replace('\\', "/"),
        };

        let content = match fs::read(file_path) {
            Ok(c) => c,
            Err(e) => {
                return HashResult {
                    hash: String::new(),
                    error: Some(format!("Failed to read {}: {}", rel, e)),
                };
            }
        };
        entries.push((rel, content));
    }

    // Entries are already sorted by WalkDir::sort_by_file_name, but we sort
    // the full relative paths lexicographically to be safe.
    entries.sort_by(|a, b| a.0.cmp(&b.0));

    // Build the composite digest
    let mut outer = Sha256::new();
    for (rel, content) in &entries {
        let mut inner = Sha256::new();
        inner.update(content);
        let file_hash = hex::encode(inner.finalize());
        outer.update(format!("{}:{}\n", rel, file_hash).as_bytes());
    }
    let final_hash = hex::encode(outer.finalize());

    HashResult {
        hash: format!("sha256:{}", final_hash),
        error: None,
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ArchiveResult {
    pub success: bool,
    pub archive_path: Option<String>,
    pub error: Option<String>,
}

/// Create a compressed tar.gz archive of `<workspace_path>/tree/` at
/// `archive_path` (full path including filename).  Parent directories are
/// created automatically.
#[tauri::command]
pub fn create_version_archive(workspace_path: String, archive_path: String) -> ArchiveResult {
    let tree_dir = Path::new(&workspace_path).join("tree");
    let archive = Path::new(&archive_path);

    // Ensure parent directories exist
    if let Some(parent) = archive.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            return ArchiveResult {
                success: false,
                archive_path: None,
                error: Some(format!("Failed to create archive directory: {}", e)),
            };
        }
    }

    // Open the output file
    let out_file = match fs::File::create(archive) {
        Ok(f) => f,
        Err(e) => {
            return ArchiveResult {
                success: false,
                archive_path: None,
                error: Some(format!("Failed to create archive file: {}", e)),
            };
        }
    };

    // Create gzip encoder → tar builder
    let gz = flate2::write::GzEncoder::new(BufWriter::new(out_file), flate2::Compression::default());
    let mut tar = tar::Builder::new(gz);

    // Append the tree/ directory
    if let Err(e) = tar.append_dir_all("tree", &tree_dir) {
        return ArchiveResult {
            success: false,
            archive_path: None,
            error: Some(format!("Failed to archive tree directory: {}", e)),
        };
    }

    if let Err(e) = tar.finish() {
        return ArchiveResult {
            success: false,
            archive_path: None,
            error: Some(format!("Failed to finalise archive: {}", e)),
        };
    }

    ArchiveResult {
        success: true,
        archive_path: Some(archive_path),
        error: None,
    }
}

/// Extract a tar.gz `archive_path` into `<target_path>/tree/`.
/// Clears the existing tree/ directory first.
#[tauri::command]
pub fn restore_from_archive(archive_path: String, target_path: String) -> ArchiveResult {
    let tree_dir = Path::new(&target_path).join("tree");

    // Clear existing tree/ directory
    if tree_dir.exists() {
        if let Err(e) = fs::remove_dir_all(&tree_dir) {
            return ArchiveResult {
                success: false,
                archive_path: None,
                error: Some(format!("Failed to clear tree directory: {}", e)),
            };
        }
    }
    if let Err(e) = fs::create_dir_all(&tree_dir) {
        return ArchiveResult {
            success: false,
            archive_path: None,
            error: Some(format!("Failed to recreate tree directory: {}", e)),
        };
    }

    // Open and decompress the archive
    let in_file = match fs::File::open(&archive_path) {
        Ok(f) => f,
        Err(e) => {
            return ArchiveResult {
                success: false,
                archive_path: None,
                error: Some(format!("Failed to open archive: {}", e)),
            };
        }
    };

    let gz = flate2::read::GzDecoder::new(in_file);
    let mut archive = tar::Archive::new(gz);

    // Extract into target_path (the archive stores entries as "tree/…")
    if let Err(e) = archive.unpack(&target_path) {
        return ArchiveResult {
            success: false,
            archive_path: None,
            error: Some(format!("Failed to extract archive: {}", e)),
        };
    }

    ArchiveResult {
        success: true,
        archive_path: Some(archive_path),
        error: None,
    }
}
