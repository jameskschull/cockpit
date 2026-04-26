use std::path::Path;

use chrono::{DateTime, NaiveDate, Utc};
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("not found")]
    NotFound,
    #[error("invalid input: {0}")]
    Invalid(String),
}

impl serde::Serialize for DbError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type DbResult<T> = Result<T, DbError>;

pub const RANK_STEP: i64 = 1_000;
pub const REBALANCE_THRESHOLD: i64 = 2;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub notes: Option<String>,
    pub deadline: Option<String>,
    pub scheduled_date: Option<String>,
    pub completed_at: Option<String>,
    pub priority_rank: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct NewTaskInput {
    pub title: String,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub deadline: Option<String>,
    #[serde(default)]
    pub scheduled_date: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdateTaskInput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default, deserialize_with = "double_option")]
    pub notes: DoubleOption<String>,
    #[serde(default, deserialize_with = "double_option")]
    pub deadline: DoubleOption<String>,
    #[serde(default, deserialize_with = "double_option")]
    pub scheduled_date: DoubleOption<String>,
}

/// Distinguishes "field not present" from "field set to null".
#[derive(Debug, Default)]
pub enum DoubleOption<T> {
    #[default]
    Missing,
    Set(Option<T>),
}

fn double_option<'de, T, D>(de: D) -> Result<DoubleOption<T>, D::Error>
where
    T: Deserialize<'de>,
    D: serde::Deserializer<'de>,
{
    Option::<T>::deserialize(de).map(DoubleOption::Set)
}

pub fn open(path: &Path) -> DbResult<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            notes TEXT,
            deadline TEXT,
            scheduled_date TEXT,
            completed_at TEXT,
            priority_rank INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_rank ON tasks(priority_rank);
        CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed_at);
        CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON tasks(scheduled_date);
        CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_rank_incomplete
            ON tasks(priority_rank) WHERE completed_at IS NULL;
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        ",
    )?;
    Ok(conn)
}

fn row_to_task(row: &Row<'_>) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get("id")?,
        title: row.get("title")?,
        notes: row.get("notes")?,
        deadline: row.get("deadline")?,
        scheduled_date: row.get("scheduled_date")?,
        completed_at: row.get("completed_at")?,
        priority_rank: row.get("priority_rank")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn list_incomplete(conn: &Connection) -> DbResult<Vec<Task>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, notes, deadline, scheduled_date, completed_at,
                priority_rank, created_at, updated_at
         FROM tasks
         WHERE completed_at IS NULL
         ORDER BY priority_rank ASC",
    )?;
    let tasks = stmt
        .query_map([], row_to_task)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(tasks)
}

pub fn list_completed(conn: &Connection) -> DbResult<Vec<Task>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, notes, deadline, scheduled_date, completed_at,
                priority_rank, created_at, updated_at
         FROM tasks
         WHERE completed_at IS NOT NULL
         ORDER BY completed_at DESC",
    )?;
    let tasks = stmt
        .query_map([], row_to_task)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(tasks)
}

pub fn get_task(conn: &Connection, id: &str) -> DbResult<Task> {
    let task = conn
        .query_row(
            "SELECT id, title, notes, deadline, scheduled_date, completed_at,
                    priority_rank, created_at, updated_at
             FROM tasks WHERE id = ?1",
            params![id],
            row_to_task,
        )
        .optional()?;
    task.ok_or(DbError::NotFound)
}

pub fn validate_date(value: &str, field: &str) -> DbResult<()> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map(|_| ())
        .map_err(|_| DbError::Invalid(format!("{field} must be YYYY-MM-DD")))
}

pub fn create_task(conn: &mut Connection, input: NewTaskInput) -> DbResult<Task> {
    let title = input.title.trim().to_string();
    if title.is_empty() {
        return Err(DbError::Invalid("title is required".into()));
    }
    if let Some(d) = &input.deadline {
        validate_date(d, "deadline")?;
    }
    if let Some(d) = &input.scheduled_date {
        validate_date(d, "scheduled_date")?;
    }

    let tx = conn.transaction()?;
    let max_rank: Option<i64> = tx.query_row(
        "SELECT MAX(priority_rank) FROM tasks WHERE completed_at IS NULL",
        [],
        |r| r.get(0),
    )?;
    let rank = max_rank.unwrap_or(0) + RANK_STEP;
    let now: DateTime<Utc> = Utc::now();
    let now_iso = now.to_rfc3339();
    let id = Uuid::new_v4().to_string();
    let notes = input.notes.and_then(|n| {
        let t = n.trim();
        if t.is_empty() { None } else { Some(t.to_string()) }
    });

    tx.execute(
        "INSERT INTO tasks (id, title, notes, deadline, scheduled_date, completed_at,
                            priority_rank, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7, ?7)",
        params![
            id,
            title,
            notes,
            input.deadline,
            input.scheduled_date,
            rank,
            now_iso,
        ],
    )?;
    tx.commit()?;
    get_task(conn, &id)
}

pub fn update_task(conn: &mut Connection, id: &str, patch: UpdateTaskInput) -> DbResult<Task> {
    let existing = get_task(conn, id)?;

    let mut title = existing.title.clone();
    if let Some(t) = patch.title {
        let trimmed = t.trim();
        if trimmed.is_empty() {
            return Err(DbError::Invalid("title is required".into()));
        }
        title = trimmed.to_string();
    }

    let notes = match patch.notes {
        DoubleOption::Missing => existing.notes.clone(),
        DoubleOption::Set(None) => None,
        DoubleOption::Set(Some(s)) => {
            let t = s.trim();
            if t.is_empty() { None } else { Some(t.to_string()) }
        }
    };

    let deadline = match patch.deadline {
        DoubleOption::Missing => existing.deadline.clone(),
        DoubleOption::Set(None) => None,
        DoubleOption::Set(Some(s)) => {
            validate_date(&s, "deadline")?;
            Some(s)
        }
    };

    let scheduled_date = match patch.scheduled_date {
        DoubleOption::Missing => existing.scheduled_date.clone(),
        DoubleOption::Set(None) => None,
        DoubleOption::Set(Some(s)) => {
            validate_date(&s, "scheduled_date")?;
            Some(s)
        }
    };

    let now_iso = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE tasks SET title = ?1, notes = ?2, deadline = ?3,
                scheduled_date = ?4, updated_at = ?5
         WHERE id = ?6",
        params![title, notes, deadline, scheduled_date, now_iso, id],
    )?;
    get_task(conn, id)
}

pub fn delete_task(conn: &Connection, id: &str) -> DbResult<()> {
    let n = conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])?;
    if n == 0 {
        return Err(DbError::NotFound);
    }
    Ok(())
}

pub fn complete_task(conn: &Connection, id: &str) -> DbResult<Task> {
    let now_iso = Utc::now().to_rfc3339();
    let n = conn.execute(
        "UPDATE tasks SET completed_at = ?1, updated_at = ?1
         WHERE id = ?2 AND completed_at IS NULL",
        params![now_iso, id],
    )?;
    if n == 0 {
        // Either not found or already completed; return current state.
    }
    get_task(conn, id)
}

pub fn uncomplete_task(conn: &mut Connection, id: &str) -> DbResult<Task> {
    let tx = conn.transaction()?;
    let existing: Option<Task> = tx
        .query_row(
            "SELECT id, title, notes, deadline, scheduled_date, completed_at,
                    priority_rank, created_at, updated_at
             FROM tasks WHERE id = ?1",
            params![id],
            row_to_task,
        )
        .optional()?;
    let existing = existing.ok_or(DbError::NotFound)?;

    let mut rank = existing.priority_rank;

    // If the stored rank collides with a live incomplete task, shift to a free slot at the tail.
    let collision: Option<String> = tx
        .query_row(
            "SELECT id FROM tasks
             WHERE priority_rank = ?1 AND completed_at IS NULL AND id <> ?2",
            params![rank, id],
            |r| r.get(0),
        )
        .optional()?;
    if collision.is_some() {
        let max_rank: Option<i64> = tx.query_row(
            "SELECT MAX(priority_rank) FROM tasks WHERE completed_at IS NULL",
            [],
            |r| r.get(0),
        )?;
        rank = max_rank.unwrap_or(0) + RANK_STEP;
    }

    let now_iso = Utc::now().to_rfc3339();
    tx.execute(
        "UPDATE tasks SET completed_at = NULL, priority_rank = ?1, updated_at = ?2
         WHERE id = ?3",
        params![rank, now_iso, id],
    )?;
    tx.commit()?;
    get_task(conn, id)
}

pub fn schedule_for_today(conn: &Connection, id: &str) -> DbResult<Task> {
    let today = chrono::Local::now().date_naive().format("%Y-%m-%d").to_string();
    let now_iso = Utc::now().to_rfc3339();
    let n = conn.execute(
        "UPDATE tasks SET scheduled_date = ?1, updated_at = ?2 WHERE id = ?3",
        params![today, now_iso, id],
    )?;
    if n == 0 {
        return Err(DbError::NotFound);
    }
    get_task(conn, id)
}

/// Reorder the given task so that it sits between `before_id` and `after_id` in the global
/// incomplete-task order. Either neighbor may be null (moving to the top/bottom of the
/// filtered view). Picks a rank in the tight global gap adjacent to the named neighbor,
/// rebalancing only when the gap is too small to bisect.
pub fn reorder_task(
    conn: &mut Connection,
    id: &str,
    before_id: Option<&str>,
    after_id: Option<&str>,
) -> DbResult<Vec<Task>> {
    let tx = conn.transaction()?;

    let exists: Option<i64> = tx
        .query_row(
            "SELECT priority_rank FROM tasks WHERE id = ?1 AND completed_at IS NULL",
            params![id],
            |r| r.get(0),
        )
        .optional()?;
    if exists.is_none() {
        return Err(DbError::NotFound);
    }

    let new_rank = match pick_rank(&tx, id, before_id, after_id)? {
        Some(r) => r,
        None => {
            rebalance(&tx)?;
            pick_rank(&tx, id, before_id, after_id)?
                .ok_or_else(|| DbError::Invalid("unable to allocate rank after rebalance".into()))?
        }
    };

    let now_iso = Utc::now().to_rfc3339();
    tx.execute(
        "UPDATE tasks SET priority_rank = ?1, updated_at = ?2 WHERE id = ?3",
        params![new_rank, now_iso, id],
    )?;

    tx.commit()?;
    list_incomplete(conn)
}

fn rank_of(tx: &rusqlite::Transaction<'_>, task_id: &str) -> DbResult<Option<i64>> {
    Ok(tx
        .query_row(
            "SELECT priority_rank FROM tasks WHERE id = ?1 AND completed_at IS NULL",
            params![task_id],
            |r| r.get::<_, i64>(0),
        )
        .optional()?)
}

/// Compute a free rank for the moved task. Returns None if the tight gap is too small
/// (caller should rebalance and retry).
fn pick_rank(
    tx: &rusqlite::Transaction<'_>,
    moved_id: &str,
    before_id: Option<&str>,
    after_id: Option<&str>,
) -> DbResult<Option<i64>> {
    let before_rank = match before_id {
        Some(b) => rank_of(tx, b)?,
        None => None,
    };
    let after_rank = match after_id {
        Some(a) => rank_of(tx, a)?,
        None => None,
    };

    // Prefer anchoring on `before_id` — the tight gap sits between `before_rank` and the
    // next live rank above it (excluding the moved task).
    if let Some(b) = before_rank {
        let next_above: Option<i64> = tx.query_row(
            "SELECT MIN(priority_rank) FROM tasks
             WHERE completed_at IS NULL AND id <> ?1 AND priority_rank > ?2",
            params![moved_id, b],
            |r| r.get(0),
        )?;
        return Ok(match next_above {
            Some(h) => {
                if h - b >= REBALANCE_THRESHOLD {
                    Some(b + (h - b) / 2)
                } else {
                    None
                }
            }
            None => Some(b + RANK_STEP),
        });
    }

    if let Some(a) = after_rank {
        let prev_below: Option<i64> = tx.query_row(
            "SELECT MAX(priority_rank) FROM tasks
             WHERE completed_at IS NULL AND id <> ?1 AND priority_rank < ?2",
            params![moved_id, a],
            |r| r.get(0),
        )?;
        return Ok(match prev_below {
            Some(l) => {
                if a - l >= REBALANCE_THRESHOLD {
                    Some(l + (a - l) / 2)
                } else {
                    None
                }
            }
            None => Some(a - RANK_STEP),
        });
    }

    // No neighbors — leave rank as-is.
    let cur: i64 = tx.query_row(
        "SELECT priority_rank FROM tasks WHERE id = ?1",
        params![moved_id],
        |r| r.get(0),
    )?;
    Ok(Some(cur))
}

fn rebalance(tx: &rusqlite::Transaction<'_>) -> DbResult<()> {
    let mut stmt = tx.prepare(
        "SELECT id FROM tasks WHERE completed_at IS NULL ORDER BY priority_rank ASC",
    )?;
    let ids: Vec<String> = stmt
        .query_map([], |r| r.get::<_, String>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    drop(stmt);

    let max_rank: i64 = tx.query_row(
        "SELECT COALESCE(MAX(priority_rank), 0) FROM tasks WHERE completed_at IS NULL",
        [],
        |r| r.get(0),
    )?;
    let n = ids.len() as i64;
    // Shift every incomplete rank above max(existing, final_max) so neither the bump nor
    // the per-row finalization can collide with a rank that hasn't been rewritten yet.
    let bump: i64 = max_rank + (n + 2) * RANK_STEP;

    tx.execute(
        "UPDATE tasks SET priority_rank = priority_rank + ?1
         WHERE completed_at IS NULL",
        params![bump],
    )?;
    let now_iso = Utc::now().to_rfc3339();
    for (i, task_id) in ids.iter().enumerate() {
        let rank = (i as i64 + 1) * RANK_STEP;
        tx.execute(
            "UPDATE tasks SET priority_rank = ?1, updated_at = ?2 WHERE id = ?3",
            params![rank, now_iso, task_id],
        )?;
    }
    Ok(())
}

pub fn get_setting(conn: &Connection, key: &str) -> DbResult<Option<String>> {
    let v: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |r| r.get(0),
        )
        .optional()?;
    Ok(v)
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> DbResult<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}
