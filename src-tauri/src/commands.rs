use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{BufRead, BufReader, Write as IoWrite};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::Emitter;

#[derive(Serialize, Deserialize, Clone)]
pub struct FileEntry {
    pub path: String,
    pub content: String,
}

/// Read all files under a workspace path, returning (relative_path, content) pairs.
#[tauri::command]
pub async fn read_workspace(path: String) -> Result<Vec<FileEntry>, String> {
    let base = PathBuf::from(&path);
    if !base.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let mut files = Vec::new();
    for entry in walkdir::WalkDir::new(&base)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let rel = entry
            .path()
            .strip_prefix(&base)
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .replace('\\', "/");

        // Skip layout files and binary archives
        if rel.ends_with("node.layout.json") || rel.ends_with(".tar.gz") {
            continue;
        }

        match std::fs::read_to_string(entry.path()) {
            Ok(content) => files.push(FileEntry {
                path: rel,
                content,
            }),
            Err(_) => continue, // skip binary files
        }
    }

    Ok(files)
}

/// Write files to disk. Compares before writing — only writes changed files.
/// Returns count of files actually written.
#[tauri::command]
pub async fn write_files(base: String, files: Vec<FileEntry>) -> Result<u32, String> {
    let base_path = Path::new(&base);
    let mut count = 0u32;

    for entry in &files {
        let full = base_path.join(&entry.path);

        // Compare before writing
        if full.exists() {
            if let Ok(existing) = std::fs::read_to_string(&full) {
                if existing == entry.content {
                    continue;
                }
            }
        }

        // Create parent directories
        if let Some(parent) = full.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        std::fs::write(&full, &entry.content).map_err(|e| e.to_string())?;
        count += 1;
    }

    Ok(count)
}

/// Compute a deterministic SHA-256 hash of structural files only (node.yaml + node.interfaces.ts).
/// Per PRD §8.2: notes, layout, and mermaid are excluded.
#[tauri::command]
pub async fn compute_tree_hash(tree_path: String) -> Result<String, String> {
    let base = PathBuf::from(&tree_path);
    if !base.exists() {
        return Ok(String::from("sha256:empty"));
    }

    let mut entries: Vec<_> = walkdir::WalkDir::new(&base)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| {
            let name = e.file_name().to_string_lossy();
            name == "node.yaml" || name == "node.interfaces.ts"
        })
        .collect();

    // Sort by relative path for determinism
    entries.sort_by_key(|e| e.path().to_path_buf());

    let mut hasher = Sha256::new();
    for entry in entries {
        let rel = entry
            .path()
            .strip_prefix(&base)
            .unwrap_or(entry.path())
            .to_string_lossy();
        hasher.update(rel.as_bytes());
        if let Ok(content) = std::fs::read(entry.path()) {
            hasher.update(&content);
        }
    }

    Ok(format!("sha256:{:x}", hasher.finalize()))
}

/// Create a .tar.gz archive of the tree directory.
#[tauri::command]
pub async fn create_version_archive(
    tree_path: String,
    archive_path: String,
) -> Result<(), String> {
    let tree = Path::new(&tree_path);
    if !tree.exists() {
        return Err("Tree path does not exist".to_string());
    }

    // Ensure archive parent directory exists
    if let Some(parent) = Path::new(&archive_path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let file = std::fs::File::create(&archive_path).map_err(|e| e.to_string())?;
    let enc = flate2::write::GzEncoder::new(file, flate2::Compression::default());
    let mut ar = tar::Builder::new(enc);
    ar.append_dir_all(".", tree).map_err(|e| e.to_string())?;
    ar.finish().map_err(|e| e.to_string())?;

    Ok(())
}

/// Extract a .tar.gz archive into a target directory (clears it first).
#[tauri::command]
pub async fn restore_from_archive(
    archive_path: String,
    tree_path: String,
) -> Result<(), String> {
    let archive = Path::new(&archive_path);
    if !archive.exists() {
        return Err(format!("Archive not found: {}", archive_path));
    }

    let target = Path::new(&tree_path);
    if target.exists() {
        std::fs::remove_dir_all(target).map_err(|e| e.to_string())?;
    }
    std::fs::create_dir_all(target).map_err(|e| e.to_string())?;

    let file = std::fs::File::open(archive).map_err(|e| e.to_string())?;
    let dec = flate2::read::GzDecoder::new(file);
    let mut ar = tar::Archive::new(dec);
    ar.unpack(target).map_err(|e| e.to_string())?;

    Ok(())
}

/// Compare current tree hash against a reference hash.
#[tauri::command]
pub async fn detect_changes(tree_path: String, reference_hash: String) -> Result<bool, String> {
    let current = compute_tree_hash(tree_path).await?;
    Ok(current != reference_hash)
}

/// Spawn a CLI subprocess, stream stdout via Tauri events.
/// Returns the exit code.
#[tauri::command]
pub async fn invoke_cli(
    app: tauri::AppHandle,
    command: String,
    args: Vec<String>,
    stdin_data: Option<String>,
    event_id: String,
) -> Result<i32, String> {
    let mut child = Command::new(&command)
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn '{}': {}", command, e))?;

    // Write stdin if provided
    if let Some(input) = stdin_data {
        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(input.as_bytes())
                .map_err(|e| e.to_string())?;
        }
    }

    // Read stdout line by line and emit events
    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        let event_name = format!("{}-stdout", event_id);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = app.emit(&event_name, &line);
            }
        }
    }

    // Read stderr
    if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        let event_name = format!("{}-stderr", event_id);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = app.emit(&event_name, &line);
            }
        }
    }

    let status = child.wait().map_err(|e| e.to_string())?;
    let _ = app.emit(&format!("{}-done", event_id), status.code().unwrap_or(-1));

    Ok(status.code().unwrap_or(-1))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicU32, Ordering};

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    fn temp_dir() -> PathBuf {
        let n = COUNTER.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!(
            "architect_test_{}_{}", std::process::id(), n
        ));
        let _ = fs::remove_dir_all(&dir); // clean any leftover
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn cleanup(dir: &Path) {
        let _ = fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn test_write_and_read_workspace() {
        let dir = temp_dir();
        let files = vec![
            FileEntry { path: "node.yaml".into(), content: "id: root\nlabel: Test\n".into() },
            FileEntry { path: "sub/node.yaml".into(), content: "id: sub\nlabel: Sub\n".into() },
        ];

        let written = write_files(dir.to_string_lossy().to_string(), files).await.unwrap();
        assert_eq!(written, 2);

        let read = read_workspace(dir.to_string_lossy().to_string()).await.unwrap();
        assert_eq!(read.len(), 2);

        let root = read.iter().find(|f| f.path == "node.yaml").unwrap();
        assert!(root.content.contains("id: root"));

        let sub = read.iter().find(|f| f.path == "sub/node.yaml").unwrap();
        assert!(sub.content.contains("id: sub"));

        cleanup(&dir);
    }

    #[tokio::test]
    async fn test_write_files_skips_unchanged() {
        let dir = temp_dir();
        let files = vec![
            FileEntry { path: "a.txt".into(), content: "hello".into() },
        ];

        let first = write_files(dir.to_string_lossy().to_string(), files.clone()).await.unwrap();
        assert_eq!(first, 1);

        // Same content — should skip
        let second = write_files(dir.to_string_lossy().to_string(), files).await.unwrap();
        assert_eq!(second, 0);

        // Changed content — should write
        let changed = vec![
            FileEntry { path: "a.txt".into(), content: "world".into() },
        ];
        let third = write_files(dir.to_string_lossy().to_string(), changed).await.unwrap();
        assert_eq!(third, 1);

        cleanup(&dir);
    }

    #[tokio::test]
    async fn test_compute_tree_hash_deterministic() {
        let dir = temp_dir();
        let files = vec![
            FileEntry { path: "node.yaml".into(), content: "id: root".into() },
            FileEntry { path: "sub/node.yaml".into(), content: "id: sub".into() },
            FileEntry { path: "node.interfaces.ts".into(), content: "export type A = {}".into() },
        ];
        write_files(dir.to_string_lossy().to_string(), files).await.unwrap();

        let hash1 = compute_tree_hash(dir.to_string_lossy().to_string()).await.unwrap();
        let hash2 = compute_tree_hash(dir.to_string_lossy().to_string()).await.unwrap();
        assert_eq!(hash1, hash2);
        assert!(hash1.starts_with("sha256:"));
        assert_ne!(hash1, "sha256:empty");

        cleanup(&dir);
    }

    #[tokio::test]
    async fn test_compute_tree_hash_changes_on_modification() {
        let dir = temp_dir();
        write_files(dir.to_string_lossy().to_string(), vec![
            FileEntry { path: "node.yaml".into(), content: "v1".into() },
        ]).await.unwrap();
        let hash1 = compute_tree_hash(dir.to_string_lossy().to_string()).await.unwrap();

        fs::write(dir.join("node.yaml"), "v2").unwrap();
        let hash2 = compute_tree_hash(dir.to_string_lossy().to_string()).await.unwrap();
        assert_ne!(hash1, hash2);

        cleanup(&dir);
    }

    #[tokio::test]
    async fn test_compute_tree_hash_ignores_non_structural_files() {
        let dir = temp_dir();
        write_files(dir.to_string_lossy().to_string(), vec![
            FileEntry { path: "node.yaml".into(), content: "id: root".into() },
            FileEntry { path: "node.notes.md".into(), content: "some notes".into() },
            FileEntry { path: "node.layout.json".into(), content: "{}".into() },
        ]).await.unwrap();

        let hash1 = compute_tree_hash(dir.to_string_lossy().to_string()).await.unwrap();

        // Modify non-structural files — hash should NOT change
        fs::write(dir.join("node.notes.md"), "updated notes").unwrap();
        fs::write(dir.join("node.layout.json"), "{\"x\":1}").unwrap();
        let hash2 = compute_tree_hash(dir.to_string_lossy().to_string()).await.unwrap();
        assert_eq!(hash1, hash2);

        // Modify structural file — hash SHOULD change
        fs::write(dir.join("node.yaml"), "id: modified").unwrap();
        let hash3 = compute_tree_hash(dir.to_string_lossy().to_string()).await.unwrap();
        assert_ne!(hash1, hash3);

        cleanup(&dir);
    }

    #[tokio::test]
    async fn test_archive_and_restore() {
        let dir = temp_dir();
        let tree = dir.join("t");
        let restored = dir.join("r");
        let archive = dir.join("v.tar.gz");

        // Write a single flat file (avoid nested paths that cause Windows tar issues)
        write_files(tree.to_string_lossy().to_string(), vec![
            FileEntry { path: "node.yaml".into(), content: "id: root".into() },
        ]).await.unwrap();

        create_version_archive(
            tree.to_string_lossy().to_string(),
            archive.to_string_lossy().to_string(),
        ).await.unwrap();
        assert!(archive.exists());

        restore_from_archive(
            archive.to_string_lossy().to_string(),
            restored.to_string_lossy().to_string(),
        ).await.unwrap();

        let content = fs::read_to_string(restored.join("node.yaml")).unwrap();
        assert_eq!(content, "id: root");

        cleanup(&dir);
    }

    #[tokio::test]
    async fn test_detect_changes() {
        let dir = temp_dir();
        write_files(dir.to_string_lossy().to_string(), vec![
            FileEntry { path: "node.yaml".into(), content: "original".into() },
        ]).await.unwrap();

        let hash = compute_tree_hash(dir.to_string_lossy().to_string()).await.unwrap();

        // No changes
        let changed = detect_changes(dir.to_string_lossy().to_string(), hash.clone()).await.unwrap();
        assert!(!changed);

        // Make a structural change
        fs::write(dir.join("node.yaml"), "modified").unwrap();
        let changed = detect_changes(dir.to_string_lossy().to_string(), hash).await.unwrap();
        assert!(changed);

        cleanup(&dir);
    }
}
