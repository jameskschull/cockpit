use serde::Serialize;
use tauri::State;

use crate::db;
use crate::db::{DbResult, NewTaskInput, Task, UpdateTaskInput};
use crate::AppState;

#[derive(Serialize)]
pub struct Settings {
    pub last_view: String,
}

#[tauri::command]
pub fn list_incomplete(state: State<'_, AppState>) -> DbResult<Vec<Task>> {
    let conn = state.db.lock().unwrap();
    db::list_incomplete(&conn)
}

#[tauri::command]
pub fn list_completed(state: State<'_, AppState>) -> DbResult<Vec<Task>> {
    let conn = state.db.lock().unwrap();
    db::list_completed(&conn)
}

#[tauri::command]
pub fn create_task(state: State<'_, AppState>, input: NewTaskInput) -> DbResult<Task> {
    let mut conn = state.db.lock().unwrap();
    db::create_task(&mut conn, input)
}

#[tauri::command]
pub fn update_task(
    state: State<'_, AppState>,
    id: String,
    input: UpdateTaskInput,
) -> DbResult<Task> {
    let mut conn = state.db.lock().unwrap();
    db::update_task(&mut conn, &id, input)
}

#[tauri::command]
pub fn delete_task(state: State<'_, AppState>, id: String) -> DbResult<()> {
    let conn = state.db.lock().unwrap();
    db::delete_task(&conn, &id)
}

#[tauri::command]
pub fn complete_task(state: State<'_, AppState>, id: String) -> DbResult<Task> {
    let conn = state.db.lock().unwrap();
    db::complete_task(&conn, &id)
}

#[tauri::command]
pub fn uncomplete_task(state: State<'_, AppState>, id: String) -> DbResult<Task> {
    let mut conn = state.db.lock().unwrap();
    db::uncomplete_task(&mut conn, &id)
}

#[tauri::command]
pub fn schedule_for_today(state: State<'_, AppState>, id: String) -> DbResult<Task> {
    let conn = state.db.lock().unwrap();
    db::schedule_for_today(&conn, &id)
}

#[tauri::command]
pub fn reorder_task(
    state: State<'_, AppState>,
    id: String,
    before_id: Option<String>,
    after_id: Option<String>,
) -> DbResult<Vec<Task>> {
    let mut conn = state.db.lock().unwrap();
    db::reorder_task(&mut conn, &id, before_id.as_deref(), after_id.as_deref())
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> DbResult<Settings> {
    let conn = state.db.lock().unwrap();
    let last_view = db::get_setting(&conn, "last_view")?.unwrap_or_else(|| "intake".into());
    Ok(Settings { last_view })
}

#[tauri::command]
pub fn set_last_view(state: State<'_, AppState>, view: String) -> DbResult<()> {
    let conn = state.db.lock().unwrap();
    db::set_setting(&conn, "last_view", &view)
}
