# Todo

Single-user desktop to-do app built with Tauri + React + SQLite.

## Quick start

```bash
# From the todo-app directory
export PATH="$HOME/.cargo/bin:$PATH"   # ensure Rust is on PATH
npm install
npm run tauri:dev
```

## Build a release bundle

```bash
npm run tauri:build
```

The SQLite database lives in the OS app-data directory and its path is printed to stderr on first run.

## Keyboard shortcuts

| Key                | Action                       |
| ------------------ | ---------------------------- |
| `Cmd/Ctrl+N`       | Focus the new-task input     |
| `1` / `2` / `3` / `4` | Switch view              |
| `↑` / `↓`          | Move selection               |
| `Cmd/Alt+↑/↓`      | Reorder selected task        |
| `Enter`            | Edit selected task           |
| `Space`            | Toggle complete              |
| `T`                | Schedule selected for today  |
| `Delete`           | Delete selected (confirms)   |
