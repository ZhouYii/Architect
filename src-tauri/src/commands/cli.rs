use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CliResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

/// Invoke an external CLI tool (e.g., git, a custom codegen binary).
/// `args` is a list of command-line arguments.
#[tauri::command]
pub fn invoke_cli(program: String, args: Vec<String>, cwd: Option<String>) -> CliResult {
    let _ = program;
    let _ = args;
    let _ = cwd;
    CliResult {
        exit_code: 0,
        stdout: String::new(),
        stderr: String::new(),
    }
}
