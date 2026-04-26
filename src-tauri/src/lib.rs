mod db;
mod commands;

use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub db: Mutex<rusqlite::Connection>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("resolving app data dir");
            std::fs::create_dir_all(&data_dir).expect("creating app data dir");
            let db_path = data_dir.join("todo.sqlite");
            eprintln!("[todo-app] SQLite path: {}", db_path.display());

            let conn = db::open(&db_path).expect("opening database");
            app.manage(AppState { db: Mutex::new(conn) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_incomplete,
            commands::list_completed,
            commands::create_task,
            commands::update_task,
            commands::delete_task,
            commands::complete_task,
            commands::uncomplete_task,
            commands::schedule_for_today,
            commands::reorder_task,
            commands::get_settings,
            commands::set_last_view,
            commands::set_show_priorities_banner,
            commands::list_priorities,
            commands::upsert_priority,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri app");
}
