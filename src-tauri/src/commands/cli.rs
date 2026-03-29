use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct CliResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

/// Invoke an external CLI tool (e.g., npx dependency-cruiser, git).
/// `program` is the executable name, `args` is the argument list,
/// and `cwd` optionally sets the working directory.
#[tauri::command]
pub fn invoke_cli(program: String, args: Vec<String>, cwd: Option<String>) -> CliResult {
    let mut cmd = Command::new(&program);
    cmd.args(&args);

    if let Some(dir) = &cwd {
        cmd.current_dir(dir);
    }

    match cmd.output() {
        Ok(output) => CliResult {
            exit_code: output.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        },
        Err(e) => CliResult {
            exit_code: -1,
            stdout: String::new(),
            stderr: format!("Failed to spawn '{}': {}", program, e),
        },
    }
}
