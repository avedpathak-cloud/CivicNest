import json
import os
import sqlite3
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import pymysql
    import pymysql.cursors
    HAS_PYMYSQL = True
except ImportError:
    HAS_PYMYSQL = False

ROOT_DIR = Path(__file__).resolve().parent.parent
SCHEMA_FILE = Path(__file__).resolve().parent / "mysql_schema.sql"
DATA_DIR = ROOT_DIR / "data"
SQLITE_FALLBACK_PATH = DATA_DIR / "society_fallback.db"


def _ensure_mariadb_running() -> None:
    try:
        subprocess.run(["service", "mariadb", "start"], capture_output=True, timeout=5, check=False)
    except Exception:
        pass


class DatabaseManager:
    def __init__(self) -> None:
        self.host = os.environ.get("MYSQL_HOST", "127.0.0.1")
        self.port = int(os.environ.get("MYSQL_PORT", "3306"))
        self.user = os.environ.get("MYSQL_USER", "civicnest")
        self.password = os.environ.get("MYSQL_PASSWORD", "civicnest_local")
        self.database = os.environ.get("MYSQL_DATABASE", "civicnest_society")
        self.backend_kind = "mysql"
        self._init_connection()

    def _connect_mysql(self, with_db: bool = True):
        return pymysql.connect(
            host=self.host,
            port=self.port,
            user=self.user,
            password=self.password,
            database=self.database if with_db else None,
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=False,
        )

    def _init_connection(self) -> None:
        if HAS_PYMYSQL:
            try:
                conn = self._connect_mysql(with_db=True)
                conn.close()
                self.backend_kind = "mysql"
                self._ensure_mysql_schema()
                return
            except Exception:
                _ensure_mariadb_running()
                try:
                    conn = self._connect_mysql(with_db=True)
                    conn.close()
                    self.backend_kind = "mysql"
                    self._ensure_mysql_schema()
                    return
                except Exception as exc:
                    print(f"[DB] MySQL connection unavailable ({exc}); activating SQLite fallback.")

        self.backend_kind = "sqlite"
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._ensure_sqlite_schema()

    def _ensure_mysql_schema(self) -> None:
        sql_text = SCHEMA_FILE.read_text(encoding="utf-8")
        statements = [s.strip() for s in sql_text.split(";") if s.strip()]
        conn = self._connect_mysql(with_db=True)
        try:
            with conn.cursor() as cur:
                for stmt in statements:
                    upper = stmt.upper()
                    if upper.startswith("CREATE DATABASE") or upper.startswith("USE "):
                        continue
                    cur.execute(stmt)
                # Non-destructive column migrations for pre-existing tables
                migrations = [
                    ("expenses", "vendor_pan", "ALTER TABLE expenses ADD COLUMN vendor_pan VARCHAR(20) NULL"),
                    ("expenses", "gst_amount", "ALTER TABLE expenses ADD COLUMN gst_amount INT NOT NULL DEFAULT 0"),
                    ("expenses", "tds_section", "ALTER TABLE expenses ADD COLUMN tds_section VARCHAR(24) NULL"),
                    ("expenses", "tds_rate_pct", "ALTER TABLE expenses ADD COLUMN tds_rate_pct DECIMAL(5,2) NOT NULL DEFAULT 0"),
                    ("expenses", "tds_amount", "ALTER TABLE expenses ADD COLUMN tds_amount INT NOT NULL DEFAULT 0"),
                    ("expenses", "net_payable", "ALTER TABLE expenses ADD COLUMN net_payable INT NOT NULL DEFAULT 0"),
                    ("visitors", "parking_slot_number", "ALTER TABLE visitors ADD COLUMN parking_slot_number VARCHAR(32) NULL"),
                ]
                for tbl, col, alter_sql in migrations:
                    cur.execute(
                        "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = %s",
                        (self.database, tbl, col),
                    )
                    res = cur.fetchone()
                    if res and res["cnt"] == 0:
                        cur.execute(alter_sql)
                # Ensure visitors.status accepts extended statuses
                cur.execute(
                    "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'visitors' AND COLUMN_NAME = 'status'",
                    (self.database,),
                )
                vis_col = cur.fetchone()
                if vis_col and str(vis_col.get("DATA_TYPE", "")).lower() == "enum":
                    cur.execute("ALTER TABLE visitors MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'pre_approved'")
            conn.commit()
        finally:
            conn.close()

    def _ensure_sqlite_schema(self) -> None:
        conn = sqlite3.connect(SQLITE_FALLBACK_PATH)
        try:
            cur = conn.cursor()
            cur.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                  id TEXT PRIMARY KEY, parent_secretary_id TEXT, name TEXT NOT NULL,
                  email TEXT NOT NULL UNIQUE, pin_hash TEXT NOT NULL, role TEXT NOT NULL,
                  role_title TEXT NOT NULL, flat_id TEXT, flat_number TEXT, tower TEXT,
                  vendor_id TEXT, phone TEXT NOT NULL, verified INTEGER DEFAULT 1,
                  is_active INTEGER DEFAULT 1, can_create_posts INTEGER DEFAULT 1,
                  can_moderate_posts INTEGER DEFAULT 0, can_manage_tickets INTEGER DEFAULT 0,
                  can_manage_billing INTEGER DEFAULT 0, can_vote INTEGER DEFAULT 1,
                  consent_marketing INTEGER DEFAULT 1, consent_directory INTEGER DEFAULT 1,
                  preferred_lang TEXT DEFAULT 'en', created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS flats (
                  id TEXT PRIMARY KEY, tower TEXT, wing TEXT, flat_number TEXT UNIQUE,
                  floor INTEGER, area_sqft INTEGER, ownership_status TEXT, owner_name TEXT,
                  occupant_name TEXT, occupant_phone TEXT, parking_slots_json TEXT,
                  billing_status TEXT, family_members_json TEXT, vehicles_json TEXT, move_requests_json TEXT
                );
                CREATE TABLE IF NOT EXISTS social_posts (
                  id TEXT PRIMARY KEY, author_user_id TEXT, author_name TEXT, author_role_title TEXT,
                  flat_number TEXT, tower TEXT, category TEXT, caption TEXT, image_url TEXT,
                  is_pinned INTEGER DEFAULT 0, is_hidden INTEGER DEFAULT 0, moderation_note TEXT,
                  likes_json TEXT, saves_json TEXT, comments_json TEXT, reports_json TEXT, created_at TEXT
                );
                CREATE TABLE IF NOT EXISTS tickets (
                  id TEXT PRIMARY KEY, ticket_number TEXT UNIQUE, flat_id TEXT, flat_number TEXT,
                  tower TEXT, raised_by_user_id TEXT, raised_by_name TEXT, category TEXT,
                  priority TEXT, title TEXT, description TEXT, location TEXT,
                  preferred_contact_time TEXT, status TEXT, assignee_name TEXT, assignee_vendor_id TEXT,
                  sla_response_hours REAL, sla_resolution_hours REAL, sla_due_at TEXT,
                  sla_breached INTEGER DEFAULT 0, created_at TEXT, acknowledged_at TEXT,
                  resolved_at TEXT, closed_at TEXT, cost_estimate INTEGER, cost_approved INTEGER DEFAULT 0,
                  cost_approver_name TEXT, completion_notes TEXT, resident_rating INTEGER,
                  resident_feedback TEXT, comments_json TEXT, internal_notes_json TEXT, history_json TEXT
                );
                CREATE TABLE IF NOT EXISTS invoices (
                  id TEXT PRIMARY KEY, invoice_number TEXT UNIQUE, flat_id TEXT, flat_number TEXT,
                  tower TEXT, period_label TEXT, billing_cycle TEXT, issued_at TEXT, due_date TEXT,
                  line_items_json TEXT, carry_forward INTEGER, late_fee INTEGER, total_amount INTEGER,
                  paid_amount INTEGER, status TEXT, dispute_reason TEXT, payment_ref TEXT,
                  payment_method TEXT, paid_at TEXT, reconciled INTEGER DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS expenses (
                  id TEXT PRIMARY KEY, title TEXT, category TEXT, vendor_name TEXT, vendor_pan TEXT,
                  budget_head TEXT, amount INTEGER, gst_amount INTEGER DEFAULT 0,
                  tds_section TEXT, tds_rate_pct REAL DEFAULT 0, tds_amount INTEGER DEFAULT 0,
                  net_payable INTEGER DEFAULT 0, invoice_ref TEXT, expense_date TEXT, status TEXT, approved_by TEXT
                );
                CREATE TABLE IF NOT EXISTS service_campaigns (
                  id TEXT PRIMARY KEY, name TEXT, category_group TEXT, vendor_id TEXT, vendor_name TEXT,
                  base_price INTEGER, scope TEXT, inclusions_json TEXT, exclusions_json TEXT,
                  tax_material_policy TEXT, available_dates_json TEXT, slot_capacity_per_day INTEGER,
                  min_confirmed_flats INTEGER, tiers_json TEXT, opt_in_deadline TEXT,
                  cancellation_policy TEXT, fallback_policy TEXT, status TEXT, confirmed_count INTEGER,
                  active_discount_pct INTEGER, current_unit_price INTEGER, subscriptions_json TEXT
                );
                CREATE TABLE IF NOT EXISTS votes (
                  id TEXT PRIMARY KEY, title TEXT, description TEXT, vote_type TEXT, legal_notice TEXT,
                  ballot_mode TEXT, selection_mode TEXT, eligible_scope TEXT, eligible_count INTEGER,
                  quorum_pct INTEGER, opens_at TEXT, closes_at TEXT, status TEXT, supporting_doc_title TEXT,
                  options_json TEXT, voted_flat_ids_json TEXT, tallies_json TEXT, attributable_records_json TEXT
                );
                CREATE TABLE IF NOT EXISTS amenities (
                  id TEXT PRIMARY KEY, name TEXT, image_url TEXT, capacity INTEGER, operating_hours TEXT,
                  fee INTEGER, deposit INTEGER, house_rules_json TEXT, accessibility_info TEXT, slots_json TEXT
                );
                CREATE TABLE IF NOT EXISTS amenity_bookings (
                  id TEXT PRIMARY KEY, amenity_id TEXT, amenity_name TEXT, flat_id TEXT, flat_number TEXT,
                  resident_name TEXT, booking_date TEXT, slot TEXT, guests INTEGER, fee_paid INTEGER,
                  deposit_held INTEGER, status TEXT, refund_status TEXT, created_at TEXT
                );
                CREATE TABLE IF NOT EXISTS society_events (
                  id TEXT PRIMARY KEY, title TEXT, category TEXT, event_date TEXT, event_time TEXT,
                  venue TEXT, description TEXT, capacity INTEGER, fee_per_person INTEGER,
                  committee_approved INTEGER, registrations_json TEXT
                );
                CREATE TABLE IF NOT EXISTS notices (
                  id TEXT PRIMARY KEY, title TEXT, body TEXT, category TEXT, target_audience TEXT,
                  author_name TEXT, author_role TEXT, published_at TEXT, acknowledged_by_json TEXT
                );
                CREATE TABLE IF NOT EXISTS meetings (
                  id TEXT PRIMARY KEY, title TEXT, meeting_type TEXT, meeting_date TEXT, venue TEXT,
                  agenda_json TEXT, attendees_json TEXT, minutes_approved INTEGER, minutes_summary TEXT,
                  resolutions_json TEXT, confidential_draft_note TEXT
                );
                CREATE TABLE IF NOT EXISTS visitors (
                  id TEXT PRIMARY KEY, pass_code TEXT, flat_id TEXT, flat_number TEXT, visitor_name TEXT,
                  visitor_type TEXT, phone TEXT, vehicle_no TEXT, expected_date TEXT, status TEXT,
                  parking_slot_number TEXT, checked_in_at TEXT, checked_out_at TEXT, logged_by TEXT
                );
                CREATE TABLE IF NOT EXISTS documents (
                  id TEXT PRIMARY KEY, title TEXT, category TEXT, version TEXT, access_level TEXT,
                  updated_at TEXT, expiry_date TEXT, summary TEXT
                );
                CREATE TABLE IF NOT EXISTS assets (
                  id TEXT PRIMARY KEY, name TEXT, category TEXT, location TEXT, vendor_name TEXT,
                  condition_status TEXT, last_service_date TEXT, next_service_date TEXT, amc_expiry_date TEXT
                );
                CREATE TABLE IF NOT EXISTS audit_logs (
                  id TEXT PRIMARY KEY, created_at TEXT, actor_name TEXT, actor_role TEXT,
                  action TEXT, entity_type TEXT, entity_id TEXT, details TEXT
                );
                CREATE TABLE IF NOT EXISTS idempotency_keys (
                  idem_key TEXT PRIMARY KEY, receipt_ref TEXT, created_at TEXT
                );
                CREATE TABLE IF NOT EXISTS house_helps (
                  id TEXT PRIMARY KEY, name TEXT, phone TEXT, help_type TEXT, id_proof_type TEXT,
                  id_proof_number TEXT, id_verified INTEGER DEFAULT 0, background_check TEXT DEFAULT 'pending',
                  incident_count INTEGER DEFAULT 0, badge_code TEXT UNIQUE, assigned_flats_json TEXT,
                  reviews_json TEXT, current_status TEXT DEFAULT 'outside', last_check_in_at TEXT, last_check_out_at TEXT
                );
                CREATE TABLE IF NOT EXISTS house_help_logs (
                  id TEXT PRIMARY KEY, house_help_id TEXT, house_help_name TEXT, flat_number TEXT,
                  guard_name TEXT, check_in_at TEXT, check_out_at TEXT
                );
                CREATE TABLE IF NOT EXISTS parking_slots (
                  id TEXT PRIMARY KEY, slot_number TEXT UNIQUE, slot_type TEXT DEFAULT 'open',
                  is_visitor INTEGER DEFAULT 1, flat_id TEXT, flat_number TEXT,
                  occupied_by_visitor_id TEXT, visitor_vehicle_no TEXT, occupied_since TEXT
                );
                CREATE TABLE IF NOT EXISTS parcels (
                  id TEXT PRIMARY KEY, flat_id TEXT, flat_number TEXT, courier_name TEXT,
                  tracking_note TEXT, shelf_location TEXT, pickup_otp TEXT, status TEXT DEFAULT 'at_gate',
                  logged_by TEXT, created_at TEXT, collected_at TEXT
                );
                CREATE TABLE IF NOT EXISTS sos_alerts (
                  id TEXT PRIMARY KEY, user_id TEXT, user_name TEXT, flat_number TEXT, tower TEXT,
                  alert_type TEXT, message TEXT, status TEXT DEFAULT 'active',
                  acknowledged_by TEXT, created_at TEXT, resolved_at TEXT
                );
                CREATE TABLE IF NOT EXISTS guard_shifts (
                  id TEXT PRIMARY KEY, guard_user_id TEXT, guard_name TEXT, device_id TEXT,
                  clock_in_at TEXT, clock_in_gps TEXT, clock_out_at TEXT, handover_note TEXT, status TEXT DEFAULT 'on_duty'
                );
                CREATE TABLE IF NOT EXISTS gl_accounts (
                  id TEXT PRIMARY KEY, code TEXT UNIQUE, name TEXT, account_type TEXT, is_mutual INTEGER DEFAULT 1
                );
                CREATE TABLE IF NOT EXISTS journal_entries (
                  id TEXT PRIMARY KEY, entry_date TEXT, narration TEXT, source_type TEXT,
                  source_id TEXT, period_label TEXT, is_reversal INTEGER DEFAULT 0,
                  reverses_id TEXT, lines_json TEXT, created_by TEXT, created_at TEXT
                );
                """
            )
            # Safe SQLite column checks
            sqlite_migrations = [
                ("expenses", "vendor_pan", "ALTER TABLE expenses ADD COLUMN vendor_pan TEXT"),
                ("expenses", "gst_amount", "ALTER TABLE expenses ADD COLUMN gst_amount INTEGER DEFAULT 0"),
                ("expenses", "tds_section", "ALTER TABLE expenses ADD COLUMN tds_section TEXT"),
                ("expenses", "tds_rate_pct", "ALTER TABLE expenses ADD COLUMN tds_rate_pct REAL DEFAULT 0"),
                ("expenses", "tds_amount", "ALTER TABLE expenses ADD COLUMN tds_amount INTEGER DEFAULT 0"),
                ("expenses", "net_payable", "ALTER TABLE expenses ADD COLUMN net_payable INTEGER DEFAULT 0"),
                ("visitors", "parking_slot_number", "ALTER TABLE visitors ADD COLUMN parking_slot_number TEXT"),
            ]
            for tbl, col, sql in sqlite_migrations:
                cols = [r[1] for r in cur.execute(f"PRAGMA table_info({tbl})").fetchall()]
                if col not in cols:
                    cur.execute(sql)
            conn.commit()
        finally:
            conn.close()

    def _adapt_sql(self, sql: str) -> str:
        if self.backend_kind == "sqlite":
            return sql.replace("%s", "?")
        return sql

    def fetch_all(self, sql: str, params: Tuple[Any, ...] = ()) -> List[Dict[str, Any]]:
        query = self._adapt_sql(sql)
        if self.backend_kind == "mysql":
            conn = self._connect_mysql(with_db=True)
            try:
                with conn.cursor() as cur:
                    cur.execute(query, params)
                    return list(cur.fetchall())
            finally:
                conn.close()
        conn = sqlite3.connect(SQLITE_FALLBACK_PATH)
        conn.row_factory = sqlite3.Row
        try:
            rows = conn.execute(query, params).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def fetch_one(self, sql: str, params: Tuple[Any, ...] = ()) -> Optional[Dict[str, Any]]:
        rows = self.fetch_all(sql, params)
        return rows[0] if rows else None

    def execute(self, sql: str, params: Tuple[Any, ...] = ()) -> None:
        query = self._adapt_sql(sql)
        if self.backend_kind == "mysql":
            conn = self._connect_mysql(with_db=True)
            try:
                with conn.cursor() as cur:
                    cur.execute(query, params)
                conn.commit()
            finally:
                conn.close()
            return
        conn = sqlite3.connect(SQLITE_FALLBACK_PATH)
        try:
            conn.execute(query, params)
            conn.commit()
        finally:
            conn.close()


def jdump(val: Any) -> str:
    return json.dumps(val, ensure_ascii=False)


def jload(val: Any, default: Any) -> Any:
    if val is None:
        return default
    if isinstance(val, (list, dict)):
        return val
    try:
        return json.loads(val)
    except Exception:
        return default
