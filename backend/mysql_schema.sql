-- CivicNest Integrated Society Management Platform
-- MySQL 8.0 / MariaDB Relational Schema

CREATE DATABASE IF NOT EXISTS civicnest_society CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE civicnest_society;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  parent_secretary_id VARCHAR(64) NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  pin_hash VARCHAR(128) NOT NULL,
  role ENUM('secretary','owner','tenant','family','treasurer','facility_manager','security','vendor') NOT NULL,
  role_title VARCHAR(160) NOT NULL,
  flat_id VARCHAR(64) NULL,
  flat_number VARCHAR(32) NULL,
  tower VARCHAR(64) NULL,
  vendor_id VARCHAR(64) NULL,
  phone VARCHAR(40) NOT NULL,
  verified TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  can_create_posts TINYINT(1) NOT NULL DEFAULT 1,
  can_moderate_posts TINYINT(1) NOT NULL DEFAULT 0,
  can_manage_tickets TINYINT(1) NOT NULL DEFAULT 0,
  can_manage_billing TINYINT(1) NOT NULL DEFAULT 0,
  can_vote TINYINT(1) NOT NULL DEFAULT 1,
  consent_marketing TINYINT(1) NOT NULL DEFAULT 1,
  consent_directory TINYINT(1) NOT NULL DEFAULT 1,
  preferred_lang VARCHAR(8) NOT NULL DEFAULT 'en',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_parent (parent_secretary_id),
  INDEX idx_users_flat (flat_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS flats (
  id VARCHAR(64) PRIMARY KEY,
  tower VARCHAR(64) NOT NULL,
  wing VARCHAR(64) NOT NULL,
  flat_number VARCHAR(32) NOT NULL UNIQUE,
  floor INT NOT NULL,
  area_sqft INT NOT NULL,
  ownership_status ENUM('owner_occupied','tenant_occupied','vacant') NOT NULL,
  owner_name VARCHAR(120) NOT NULL,
  occupant_name VARCHAR(120) NOT NULL,
  occupant_phone VARCHAR(40) NOT NULL,
  parking_slots_json JSON NOT NULL,
  billing_status ENUM('active','arrears_hold') NOT NULL DEFAULT 'active',
  family_members_json JSON NOT NULL,
  vehicles_json JSON NOT NULL,
  move_requests_json JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS social_posts (
  id VARCHAR(64) PRIMARY KEY,
  author_user_id VARCHAR(64) NOT NULL,
  author_name VARCHAR(120) NOT NULL,
  author_role_title VARCHAR(160) NOT NULL,
  flat_number VARCHAR(32) NULL,
  tower VARCHAR(64) NULL,
  category VARCHAR(64) NOT NULL,
  caption TEXT NOT NULL,
  image_url VARCHAR(512) NULL,
  is_pinned TINYINT(1) NOT NULL DEFAULT 0,
  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
  moderation_note VARCHAR(255) NULL,
  likes_json JSON NOT NULL,
  saves_json JSON NOT NULL,
  comments_json JSON NOT NULL,
  reports_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_posts_created (created_at DESC),
  INDEX idx_posts_author (author_user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tickets (
  id VARCHAR(64) PRIMARY KEY,
  ticket_number VARCHAR(40) NOT NULL UNIQUE,
  flat_id VARCHAR(64) NOT NULL,
  flat_number VARCHAR(32) NOT NULL,
  tower VARCHAR(64) NOT NULL,
  raised_by_user_id VARCHAR(64) NOT NULL,
  raised_by_name VARCHAR(120) NOT NULL,
  category VARCHAR(40) NOT NULL,
  priority ENUM('emergency','high','normal','low') NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(255) NOT NULL,
  preferred_contact_time VARCHAR(120) NOT NULL,
  status VARCHAR(64) NOT NULL,
  assignee_name VARCHAR(120) NULL,
  assignee_vendor_id VARCHAR(64) NULL,
  sla_response_hours DECIMAL(6,2) NOT NULL,
  sla_resolution_hours DECIMAL(6,2) NOT NULL,
  sla_due_at DATETIME NOT NULL,
  sla_breached TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at DATETIME NULL,
  resolved_at DATETIME NULL,
  closed_at DATETIME NULL,
  cost_estimate INT NULL,
  cost_approved TINYINT(1) NOT NULL DEFAULT 0,
  cost_approver_name VARCHAR(120) NULL,
  completion_notes TEXT NULL,
  resident_rating INT NULL,
  resident_feedback TEXT NULL,
  comments_json JSON NOT NULL,
  internal_notes_json JSON NOT NULL,
  history_json JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(64) PRIMARY KEY,
  invoice_number VARCHAR(64) NOT NULL UNIQUE,
  flat_id VARCHAR(64) NOT NULL,
  flat_number VARCHAR(32) NOT NULL,
  tower VARCHAR(64) NOT NULL,
  period_label VARCHAR(64) NOT NULL,
  billing_cycle ENUM('monthly','quarterly','annual') NOT NULL,
  issued_at DATE NOT NULL,
  due_date DATE NOT NULL,
  line_items_json JSON NOT NULL,
  carry_forward INT NOT NULL DEFAULT 0,
  late_fee INT NOT NULL DEFAULT 0,
  total_amount INT NOT NULL,
  paid_amount INT NOT NULL DEFAULT 0,
  status ENUM('unpaid','partial','paid','disputed') NOT NULL DEFAULT 'unpaid',
  dispute_reason TEXT NULL,
  payment_ref VARCHAR(128) NULL,
  payment_method VARCHAR(64) NULL,
  paid_at DATETIME NULL,
  reconciled TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(64) NOT NULL,
  vendor_name VARCHAR(160) NOT NULL,
  vendor_pan VARCHAR(20) NULL,
  budget_head VARCHAR(120) NOT NULL,
  amount INT NOT NULL,
  gst_amount INT NOT NULL DEFAULT 0,
  tds_section VARCHAR(24) NULL,
  tds_rate_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  tds_amount INT NOT NULL DEFAULT 0,
  net_payable INT NOT NULL DEFAULT 0,
  invoice_ref VARCHAR(80) NOT NULL,
  expense_date DATE NOT NULL,
  status ENUM('pending_approval','approved','paid') NOT NULL,
  approved_by VARCHAR(120) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS service_campaigns (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category_group VARCHAR(80) NOT NULL,
  vendor_id VARCHAR(64) NOT NULL,
  vendor_name VARCHAR(160) NOT NULL,
  base_price INT NOT NULL,
  scope TEXT NOT NULL,
  inclusions_json JSON NOT NULL,
  exclusions_json JSON NOT NULL,
  tax_material_policy TEXT NOT NULL,
  available_dates_json JSON NOT NULL,
  slot_capacity_per_day INT NOT NULL,
  min_confirmed_flats INT NOT NULL,
  tiers_json JSON NOT NULL,
  opt_in_deadline DATE NOT NULL,
  cancellation_policy TEXT NOT NULL,
  fallback_policy TEXT NOT NULL,
  status ENUM('open','threshold_met','locked','completed','cancelled') NOT NULL,
  confirmed_count INT NOT NULL DEFAULT 0,
  active_discount_pct INT NOT NULL DEFAULT 0,
  current_unit_price INT NOT NULL,
  subscriptions_json JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS votes (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  vote_type ENUM('informal_poll','formal_resolution','committee_election') NOT NULL,
  legal_notice TEXT NOT NULL,
  ballot_mode ENUM('secret','attributable') NOT NULL,
  selection_mode ENUM('single','multiple','yes_no') NOT NULL,
  eligible_scope ENUM('all_verified_owners','all_residents') NOT NULL,
  eligible_count INT NOT NULL,
  quorum_pct INT NOT NULL,
  opens_at DATE NOT NULL,
  closes_at DATE NOT NULL,
  status ENUM('open','closed') NOT NULL,
  supporting_doc_title VARCHAR(255) NOT NULL,
  options_json JSON NOT NULL,
  voted_flat_ids_json JSON NOT NULL,
  tallies_json JSON NOT NULL,
  attributable_records_json JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS amenities (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  image_url VARCHAR(512) NOT NULL,
  capacity INT NOT NULL,
  operating_hours VARCHAR(120) NOT NULL,
  fee INT NOT NULL DEFAULT 0,
  deposit INT NOT NULL DEFAULT 0,
  house_rules_json JSON NOT NULL,
  accessibility_info TEXT NOT NULL,
  slots_json JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS amenity_bookings (
  id VARCHAR(64) PRIMARY KEY,
  amenity_id VARCHAR(64) NOT NULL,
  amenity_name VARCHAR(160) NOT NULL,
  flat_id VARCHAR(64) NOT NULL,
  flat_number VARCHAR(32) NOT NULL,
  resident_name VARCHAR(120) NOT NULL,
  booking_date DATE NOT NULL,
  slot VARCHAR(80) NOT NULL,
  guests INT NOT NULL,
  fee_paid INT NOT NULL,
  deposit_held INT NOT NULL,
  status ENUM('confirmed','cancelled','completed') NOT NULL,
  refund_status VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS society_events (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(64) NOT NULL,
  event_date DATE NOT NULL,
  event_time VARCHAR(80) NOT NULL,
  venue VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  capacity INT NOT NULL,
  fee_per_person INT NOT NULL DEFAULT 0,
  committee_approved TINYINT(1) NOT NULL DEFAULT 1,
  registrations_json JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notices (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  category ENUM('official_circular','emergency_alert','wing_notice','vendor_promo') NOT NULL,
  target_audience VARCHAR(160) NOT NULL,
  author_name VARCHAR(120) NOT NULL,
  author_role VARCHAR(120) NOT NULL,
  published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_by_json JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS meetings (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  meeting_type VARCHAR(80) NOT NULL,
  meeting_date DATE NOT NULL,
  venue VARCHAR(160) NOT NULL,
  agenda_json JSON NOT NULL,
  attendees_json JSON NOT NULL,
  minutes_approved TINYINT(1) NOT NULL DEFAULT 1,
  minutes_summary TEXT NOT NULL,
  resolutions_json JSON NOT NULL,
  confidential_draft_note TEXT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS visitors (
  id VARCHAR(64) PRIMARY KEY,
  pass_code VARCHAR(16) NOT NULL,
  flat_id VARCHAR(64) NOT NULL,
  flat_number VARCHAR(32) NOT NULL,
  visitor_name VARCHAR(120) NOT NULL,
  visitor_type ENUM('guest','delivery','domestic_staff','cab') NOT NULL,
  phone VARCHAR(40) NOT NULL,
  vehicle_no VARCHAR(40) NULL,
  expected_date DATE NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pre_approved',
  parking_slot_number VARCHAR(32) NULL,
  checked_in_at DATETIME NULL,
  checked_out_at DATETIME NULL,
  logged_by VARCHAR(120) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(80) NOT NULL,
  version VARCHAR(32) NOT NULL,
  access_level ENUM('all_residents','owners_only','committee') NOT NULL,
  updated_at DATE NOT NULL,
  expiry_date DATE NULL,
  summary TEXT NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assets (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(80) NOT NULL,
  location VARCHAR(160) NOT NULL,
  vendor_name VARCHAR(160) NOT NULL,
  condition_status ENUM('optimal','attention','maintenance_due') NOT NULL,
  last_service_date DATE NOT NULL,
  next_service_date DATE NOT NULL,
  amc_expiry_date DATE NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_name VARCHAR(120) NOT NULL,
  actor_role VARCHAR(64) NOT NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  details TEXT NOT NULL,
  INDEX idx_audit_created (created_at DESC)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  idem_key VARCHAR(128) PRIMARY KEY,
  receipt_ref VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS house_helps (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  help_type VARCHAR(40) NOT NULL,
  id_proof_type VARCHAR(40) NOT NULL,
  id_proof_number VARCHAR(64) NOT NULL,
  id_verified TINYINT(1) NOT NULL DEFAULT 0,
  background_check ENUM('pending','cleared','flagged') NOT NULL DEFAULT 'pending',
  incident_count INT NOT NULL DEFAULT 0,
  badge_code VARCHAR(32) NOT NULL UNIQUE,
  assigned_flats_json JSON NOT NULL,
  reviews_json JSON NOT NULL,
  current_status ENUM('outside','inside') NOT NULL DEFAULT 'outside',
  last_check_in_at DATETIME NULL,
  last_check_out_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS house_help_logs (
  id VARCHAR(64) PRIMARY KEY,
  house_help_id VARCHAR(64) NOT NULL,
  house_help_name VARCHAR(120) NOT NULL,
  flat_number VARCHAR(32) NOT NULL,
  guard_name VARCHAR(120) NOT NULL,
  check_in_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  check_out_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS parking_slots (
  id VARCHAR(64) PRIMARY KEY,
  slot_number VARCHAR(32) NOT NULL UNIQUE,
  slot_type ENUM('covered','open','ev') NOT NULL DEFAULT 'open',
  is_visitor TINYINT(1) NOT NULL DEFAULT 1,
  flat_id VARCHAR(64) NULL,
  flat_number VARCHAR(32) NULL,
  occupied_by_visitor_id VARCHAR(64) NULL,
  visitor_vehicle_no VARCHAR(40) NULL,
  occupied_since DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS parcels (
  id VARCHAR(64) PRIMARY KEY,
  flat_id VARCHAR(64) NOT NULL,
  flat_number VARCHAR(32) NOT NULL,
  courier_name VARCHAR(120) NOT NULL,
  tracking_note VARCHAR(255) NOT NULL,
  shelf_location VARCHAR(64) NOT NULL,
  pickup_otp VARCHAR(12) NOT NULL,
  status ENUM('at_gate','collected') NOT NULL DEFAULT 'at_gate',
  logged_by VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  collected_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sos_alerts (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  user_name VARCHAR(120) NOT NULL,
  flat_number VARCHAR(32) NULL,
  tower VARCHAR(64) NULL,
  alert_type ENUM('medical','fire','lift','security') NOT NULL,
  message TEXT NOT NULL,
  status ENUM('active','acknowledged','resolved') NOT NULL DEFAULT 'active',
  acknowledged_by VARCHAR(120) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS guard_shifts (
  id VARCHAR(64) PRIMARY KEY,
  guard_user_id VARCHAR(64) NOT NULL,
  guard_name VARCHAR(120) NOT NULL,
  device_id VARCHAR(80) NOT NULL,
  clock_in_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  clock_in_gps VARCHAR(80) NOT NULL,
  clock_out_at DATETIME NULL,
  handover_note TEXT NULL,
  status ENUM('on_duty','completed') NOT NULL DEFAULT 'on_duty'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gl_accounts (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(24) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  account_type ENUM('ASSET','LIABILITY','INCOME','EXPENSE','FUND') NOT NULL,
  is_mutual TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS journal_entries (
  id VARCHAR(64) PRIMARY KEY,
  entry_date DATE NOT NULL,
  narration VARCHAR(255) NOT NULL,
  source_type VARCHAR(48) NOT NULL,
  source_id VARCHAR(64) NULL,
  period_label VARCHAR(48) NOT NULL,
  is_reversal TINYINT(1) NOT NULL DEFAULT 0,
  reverses_id VARCHAR(64) NULL,
  lines_json JSON NOT NULL,
  created_by VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
