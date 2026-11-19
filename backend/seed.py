import hashlib
import json
from datetime import datetime, timezone
from backend.db import DatabaseManager, jdump


def hash_pin(pin: str) -> str:
    return hashlib.sha256(f"civicnest_salt::{pin}".encode("utf-8")).hexdigest()


def seed_if_empty(db: DatabaseManager) -> None:
    existing = db.fetch_one("SELECT COUNT(*) AS cnt FROM users")
    if existing and existing["cnt"] > 0:
        return

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    default_pin = hash_pin("2026")

    # Hierarchical Access Control:
    # ONLY ONE root Secretary account (parent_secretary_id IS NULL).
    # All other accounts are created under the Secretary account (parent_secretary_id = 'usr_secretary').
    users = [
        (
            "usr_secretary", None, "Meera Iyer", "secretary@aureliacrest.in", default_pin,
            "secretary", "Society Secretary (Root Admin · A-1101)", "flat_a1101", "A-1101", "Tower A",
            None, "+91 98220 77891", 1, 1, 1, 1, 1, 1, 1, 1, 1, "en", now
        ),
        (
            "usr_owner_a402", "usr_secretary", "Ananya Deshmukh", "ananya@aureliacrest.in", default_pin,
            "owner", "Owner / Member (Flat A-402)", "flat_a402", "A-402", "Tower A",
            None, "+91 98230 44120", 1, 1, 1, 0, 0, 0, 1, 1, 1, "en", now
        ),
        (
            "usr_tenant_b704", "usr_secretary", "Rohan Kulkarni", "rohan@aureliacrest.in", default_pin,
            "tenant", "Tenant / Occupant (Flat B-704)", "flat_b704", "B-704", "Tower B",
            None, "+91 97654 11209", 1, 1, 1, 0, 0, 0, 0, 0, 1, "en", now
        ),
        (
            "usr_treasurer_c201", "usr_secretary", "Vikram Joshi", "treasurer@aureliacrest.in", default_pin,
            "treasurer", "Treasurer (Assigned by Secretary · C-201)", "flat_c201", "C-201", "Tower C",
            None, "+91 98901 33412", 1, 1, 1, 0, 0, 1, 1, 0, 1, "en", now
        ),
        (
            "usr_facility_mgr", "usr_secretary", "Suresh Nair", "facility@aureliacrest.in", default_pin,
            "facility_manager", "Facility Manager (Assigned by Secretary)", None, None, None,
            None, "+91 99224 55100", 1, 1, 1, 0, 1, 0, 0, 0, 1, "en", now
        ),
        (
            "usr_security_gate", "usr_secretary", "Ramesh Patil", "gate@aureliacrest.in", default_pin,
            "security", "Main Gate Security (Assigned by Secretary)", None, None, None,
            None, "+91 98500 66211", 1, 1, 0, 0, 0, 0, 0, 0, 0, "mr", now
        ),
        (
            "usr_vendor_coolair", "usr_secretary", "CoolAir HVAC Services", "dispatch@coolairhvac.in", default_pin,
            "vendor", "Vendor Partner (Assigned by Secretary)", None, None, None,
            "vnd_coolair", "+91 98229 88400", 1, 1, 0, 0, 0, 0, 0, 0, 1, "en", now
        ),
    ]
    for u in users:
        db.execute(
            """INSERT INTO users (
              id, parent_secretary_id, name, email, pin_hash, role, role_title,
              flat_id, flat_number, tower, vendor_id, phone, verified, is_active,
              can_create_posts, can_moderate_posts, can_manage_tickets, can_manage_billing,
              can_vote, consent_marketing, consent_directory, preferred_lang, created_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            u,
        )

    flats = [
        ("flat_a402", "Tower A", "East Wing", "A-402", 4, 1450, "owner_occupied", "Ananya Deshmukh", "Ananya Deshmukh", "+91 98230 44120",
         jdump(["P1-A42", "P1-A43"]), "active",
         jdump([
             {"id": "fam_1", "name": "Siddharth Deshmukh", "relation": "Spouse", "phone": "+91 98230 44121", "accessLevel": "full"},
             {"id": "fam_2", "name": "Kavita Deshmukh", "relation": "Mother", "phone": "+91 98230 44122", "accessLevel": "limited"},
         ]),
         jdump([
             {"id": "veh_1", "registrationNo": "MH-12-TR-4821", "type": "EV", "parkingSlot": "P1-A42", "stickerId": "AC-2026-402"},
         ]),
         jdump([])),
        ("flat_b704", "Tower B", "North Wing", "B-704", 7, 1220, "tenant_occupied", "Prakash Gokhale", "Rohan Kulkarni", "+91 97654 11209",
         jdump(["P2-B19"]), "active",
         jdump([{"id": "fam_3", "name": "Neha Kulkarni", "relation": "Spouse", "phone": "+91 97654 11210", "accessLevel": "full"}]),
         jdump([{"id": "veh_3", "registrationNo": "MH-14-DF-3318", "type": "4-wheeler", "parkingSlot": "P2-B19", "stickerId": "AC-2026-704"}]),
         jdump([{"id": "mov_1", "type": "move_in", "requestedDate": "2026-08-01", "nocStatus": "completed", "depositAmount": 15000, "notes": "Police verification complete."}])),
        ("flat_a1101", "Tower A", "East Wing", "A-1101", 11, 1850, "owner_occupied", "Meera Iyer", "Meera Iyer", "+91 98220 77891",
         jdump(["P1-A04", "P1-A05"]), "active", jdump([]), jdump([]), jdump([])),
        ("flat_c201", "Tower C", "South Wing", "C-201", 2, 1450, "owner_occupied", "Vikram Joshi", "Vikram Joshi", "+91 98901 33412",
         jdump(["P1-C11"]), "active", jdump([]), jdump([]), jdump([])),
        ("flat_c503", "Tower C", "South Wing", "C-503", 5, 1220, "owner_occupied", "Harishchandra Mehta", "Harishchandra Mehta", "+91 98221 90441",
         jdump(["P2-C41"]), "arrears_hold", jdump([]), jdump([]), jdump([])),
    ]
    for f in flats:
        db.execute(
            """INSERT INTO flats (id, tower, wing, flat_number, floor, area_sqft, ownership_status,
               owner_name, occupant_name, occupant_phone, parking_slots_json, billing_status,
               family_members_json, vehicles_json, move_requests_json)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            f,
        )

    # FB / Instagram-style Society Social Posts
    posts = [
        (
            "post_1", "usr_owner_a402", "Ananya Deshmukh", "Owner · Flat A-402", "A-402", "Tower A",
            "Home & Decor",
            "Finally finished setting up our living room corner with handloom cushions from Pune and a sunlit fiddle-leaf fig! Sharing flat decor inspiration for anyone renovating in Tower A.",
            "/src/assets/images/social_decor_living_1795111778277.jpg",
            1, 0, "Featured by Society Secretary",
            jdump([
                {"userId": "usr_secretary", "userName": "Meera Iyer", "flatNumber": "A-1101"},
                {"userId": "usr_tenant_b704", "userName": "Rohan Kulkarni", "flatNumber": "B-704"},
            ]),
            jdump(["usr_tenant_b704"]),
            jdump([
                {"id": "pc_1", "userId": "usr_tenant_b704", "authorName": "Rohan Kulkarni", "flatNumber": "B-704", "text": "Love the teak console and sheer curtains! Where did you get the planters?", "createdAt": "2026-11-19 08:30:00"},
                {"id": "pc_2", "userId": "usr_owner_a402", "authorName": "Ananya Deshmukh", "flatNumber": "A-402", "text": "Thank you Rohan! Terracotta pots are from the Kothrud pottery market.", "createdAt": "2026-11-19 09:05:00"},
            ]),
            jdump([]),
            "2026-11-19 08:10:00",
        ),
        (
            "post_2", "usr_tenant_b704", "Rohan Kulkarni", "Tenant · Flat B-704", "B-704", "Tower B",
            "Balcony & Garden",
            "Evening golden hour on the B-704 balcony! Added warm string lights and bougainvillea planters along the railing. Best place for filter coffee after work.",
            "/src/assets/images/social_balcony_garden_1795111778035.jpg",
            0, 0, None,
            jdump([
                {"userId": "usr_owner_a402", "userName": "Ananya Deshmukh", "flatNumber": "A-402"},
                {"userId": "usr_secretary", "userName": "Meera Iyer", "flatNumber": "A-1101"},
                {"userId": "usr_treasurer_c201", "userName": "Vikram Joshi", "flatNumber": "C-201"},
            ]),
            jdump(["usr_owner_a402"]),
            jdump([
                {"id": "pc_3", "userId": "usr_secretary", "authorName": "Meera Iyer", "flatNumber": "A-1101", "text": "Looks serene! Reminder to keep drip trays under planters to protect lower balconies.", "createdAt": "2026-11-18 19:45:00"},
            ]),
            jdump([]),
            "2026-11-18 19:15:00",
        ),
        (
            "post_3", "usr_secretary", "Meera Iyer", "Society Secretary · A-1101", "A-1101", "Tower A",
            "Community Thought",
            "Welcome to our new Society Community Wall! Share your flat interiors, balcony gardens, festival decorations, and neighbourly thoughts right here on the main page. Let us keep the feed warm and helpful.",
            "/src/assets/images/society_campus_hero_1795110531649.jpg",
            1, 0, "Pinned Welcome Post",
            jdump([{"userId": "usr_owner_a402", "userName": "Ananya Deshmukh", "flatNumber": "A-402"}]),
            jdump([]),
            jdump([]),
            jdump([]),
            "2026-11-18 09:00:00",
        ),
    ]
    for p in posts:
        db.execute(
            """INSERT INTO social_posts (id, author_user_id, author_name, author_role_title, flat_number, tower,
               category, caption, image_url, is_pinned, is_hidden, moderation_note, likes_json, saves_json,
               comments_json, reports_json, created_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            p,
        )

    # Seed Tickets
    tickets = [
        (
            "tkt_1", "TKT-2026-1042", "flat_a402", "A-402", "Tower A", "usr_owner_a402", "Ananya Deshmukh",
            "plumbing", "high", "Dampness near master bathroom shaft wall",
            "Observed persistent seepage along the common duct wall behind the master bathroom vanity.",
            "Tower A · Flat A-402 · Common Duct", "Weekdays 6:00 PM – 8:00 PM", "Waiting for Approval",
            "Suresh Nair (Facility Manager)", "vnd_aqua", 1, 24, "2026-11-20 11:30:00", 0,
            "2026-11-18 10:15:00", "2026-11-18 10:42:00", None, None, 4800, 0, None, None, None, None,
            jdump([{"id": "tc_1", "authorName": "Suresh Nair", "authorRole": "Facility Manager", "message": "Vertical joint seal requires epoxy grouting from A-502 duct.", "createdAt": "2026-11-18T14:20:00Z"}]),
            jdump([{"id": "in_1", "authorName": "Suresh Nair", "authorRole": "Facility Manager", "note": "Common shaft issue — falls under society common maintenance budget head.", "createdAt": "2026-11-18T14:25:00Z"}]),
            jdump([
                {"id": "th_1", "status": "Submitted", "actorName": "Ananya Deshmukh", "actorRole": "Owner", "timestamp": "2026-11-18T10:15:00Z", "summary": "Ticket created"},
                {"id": "th_2", "status": "Waiting for Approval", "actorName": "Suresh Nair", "actorRole": "Facility Manager", "timestamp": "2026-11-18T14:25:00Z", "summary": "Submitted ₹4,800 estimate for Secretary/Treasurer approval"},
            ]),
        ),
        (
            "tkt_2", "TKT-2026-1039", "flat_b704", "B-704", "Tower B", "usr_tenant_b704", "Rohan Kulkarni",
            "electrical", "normal", "Tower B 7th floor lobby motion sensor flickering",
            "Corridor LED near Lift 2 stays dim and flickers after 9 PM.",
            "Tower B · 7th Floor Lift Lobby", "Anytime", "Resolved",
            "CoolAir HVAC Services", "vnd_coolair", 24, 72, "2026-11-19 18:00:00", 0,
            "2026-11-16 09:00:00", "2026-11-16 11:15:00", "2026-11-17 17:10:00", None, 950, 1, "Meera Iyer",
            "Replaced faulty 18W LED driver and recalibrated PIR motion sensor.", None, None,
            jdump([{"id": "tc_3", "authorName": "CoolAir HVAC Services", "authorRole": "Vendor Partner", "message": "Driver replaced and tested.", "createdAt": "2026-11-17T17:10:00Z"}]),
            jdump([]),
            jdump([
                {"id": "th_5", "status": "Submitted", "actorName": "Rohan Kulkarni", "actorRole": "Tenant", "timestamp": "2026-11-16T09:00:00Z", "summary": "Ticket logged"},
                {"id": "th_7", "status": "Resolved", "actorName": "CoolAir HVAC Services", "actorRole": "Vendor", "timestamp": "2026-11-17T17:10:00Z", "summary": "Replacement verified"},
            ]),
        ),
        (
            "tkt_3", "TKT-2026-1031", "flat_c503", "C-503", "Tower C", "usr_secretary", "Harishchandra Mehta",
            "lift", "emergency", "Tower C Passenger Lift 1 leveling sensor jitter at Floor 5",
            "Lift stops 2 inches below floor sill when descending to 5th floor.",
            "Tower C · Passenger Lift 1", "Immediate", "In Progress",
            "Suresh Nair (Facility Manager)", "vnd_otis", 0.25, 4, "2026-11-18 18:00:00", 1,
            "2026-11-18 12:00:00", "2026-11-18 12:08:00", None, None, 0, 1, "Meera Iyer", None, None, None,
            jdump([{"id": "tc_4", "authorName": "Suresh Nair", "authorRole": "Facility Manager", "message": "OEM technician on-site calibrating floor magnets.", "createdAt": "2026-11-18T13:00:00Z"}]),
            jdump([{"id": "in_3", "authorName": "Meera Iyer", "authorRole": "Secretary", "note": "Escalated to OEM supervisor due to 4-hour SLA breach.", "createdAt": "2026-11-18T18:10:00Z"}]),
            jdump([{"id": "th_8", "status": "Submitted", "actorName": "Harishchandra Mehta", "actorRole": "Owner", "timestamp": "2026-11-18T12:00:00Z", "summary": "Emergency safety ticket raised"}]),
        ),
    ]
    for tk in tickets:
        db.execute(
            """INSERT INTO tickets (id, ticket_number, flat_id, flat_number, tower, raised_by_user_id,
               raised_by_name, category, priority, title, description, location, preferred_contact_time,
               status, assignee_name, assignee_vendor_id, sla_response_hours, sla_resolution_hours,
               sla_due_at, sla_breached, created_at, acknowledged_at, resolved_at, closed_at,
               cost_estimate, cost_approved, cost_approver_name, completion_notes, resident_rating,
               resident_feedback, comments_json, internal_notes_json, history_json)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            tk,
        )

    # Seed Invoices
    invoices = [
        ("inv_a402_nov", "INV-2026-11-A402", "flat_a402", "A-402", "Tower A", "November 2026", "monthly",
         "2026-11-01", "2026-11-25",
         jdump([
             {"label": "General Maintenance (1,450 sq.ft @ ₹3.50)", "type": "area", "amount": 5075},
             {"label": "Sinking Fund Contribution", "type": "fixed", "amount": 750},
             {"label": "Water & STP Charges", "type": "usage", "amount": 650},
             {"label": "Covered Parking (2 Slots)", "type": "fixed", "amount": 400},
         ]), 0, 0, 6875, 0, "unpaid", None, None, None, None, 0),
        ("inv_a402_oct", "INV-2026-10-A402", "flat_a402", "A-402", "Tower A", "October 2026", "monthly",
         "2026-10-01", "2026-10-20",
         jdump([
             {"label": "General Maintenance (1,450 sq.ft @ ₹3.50)", "type": "area", "amount": 5075},
             {"label": "Sinking Fund Contribution", "type": "fixed", "amount": 750},
             {"label": "Water & STP Charges", "type": "usage", "amount": 620},
             {"label": "Covered Parking (2 Slots)", "type": "fixed", "amount": 400},
         ]), 0, 0, 6845, 6845, "paid", None, "UPI-62948104291", "UPI", "2026-10-14 11:20:00", 1),
        ("inv_b704_nov", "INV-2026-11-B704", "flat_b704", "B-704", "Tower B", "November 2026", "monthly",
         "2026-11-01", "2026-11-25",
         jdump([
             {"label": "General Maintenance (1,220 sq.ft @ ₹3.50)", "type": "area", "amount": 4270},
             {"label": "Sinking Fund Contribution", "type": "fixed", "amount": 750},
             {"label": "Water & STP Charges", "type": "usage", "amount": 580},
             {"label": "Covered Parking (1 Slot)", "type": "fixed", "amount": 200},
         ]), 0, 0, 5800, 5800, "paid", None, "NB-8837100294", "NetBanking", "2026-11-09 09:40:00", 1),
        ("inv_c503_nov", "INV-2026-11-C503", "flat_c503", "C-503", "Tower C", "November 2026", "monthly",
         "2026-11-01", "2026-11-15",
         jdump([
             {"label": "General Maintenance (1,220 sq.ft @ ₹3.50)", "type": "area", "amount": 4270},
             {"label": "Sinking Fund Contribution", "type": "fixed", "amount": 750},
             {"label": "Water & STP Charges", "type": "usage", "amount": 610},
             {"label": "Covered Parking (1 Slot)", "type": "fixed", "amount": 200},
         ]), 5830, 250, 11910, 0, "unpaid", None, None, None, None, 0),
    ]
    for inv in invoices:
        db.execute(
            """INSERT INTO invoices (id, invoice_number, flat_id, flat_number, tower, period_label, billing_cycle,
               issued_at, due_date, line_items_json, carry_forward, late_fee, total_amount, paid_amount,
               status, dispute_reason, payment_ref, payment_method, paid_at, reconciled)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            inv,
        )

    expenses = [
        ("exp_1", "Annual Fire Hydrant & Sprinkler Pressure Audit", "amc", "SafeGuard Fire Systems Pvt Ltd",
         "Statutory Safety & Fire", 34500, "SG-2026-884", "2026-11-12", "pending_approval", None),
        ("exp_2", "Common Area Electricity Bill — October 2026", "utilities", "MSEDCL",
         "Common Utilities", 142800, "MSEDCL-OCT26", "2026-11-06", "paid", "Vikram Joshi"),
    ]
    for ex in expenses:
        db.execute(
            """INSERT INTO expenses (id, title, category, vendor_name, budget_head, amount, invoice_ref,
               expense_date, status, approved_by) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            ex,
        )

    def make_tiers(base: int):
        return [
            {"minFlats": mf, "discountPct": dp, "unitPrice": round(base * (1 - dp / 100))}
            for mf, dp in [(1, 0), (25, 5), (50, 8), (100, 12), (200, 15)]
        ]

    campaigns = [
        ("cmp_ac_service", "Pre-Summer Split & Window AC Jet Servicing", "Climate and appliances", "vnd_coolair",
         "CoolAir HVAC Services", 1000,
         "Foam-jet indoor coil wash, outdoor condenser high-pressure rinse, drain line flush, and cooling delta test.",
         jdump(["Indoor & outdoor unit jet wash", "Drain tray clearing", "30-day leakage warranty"]),
         jdump(["Refrigerant gas top-up", "PCB replacement"]),
         "Prices inclusive of 18% GST and standard consumables.",
         jdump(["2026-11-28", "2026-11-29", "2026-12-05"]), 28, 25, jdump(make_tiers(1000)),
         "2026-11-25", "Free cancellation up to 24 hours before appointment.",
         "If confirmed flats fall below 25, campaign extends 7 days or refunds in full.",
         "threshold_met", 68, 8, 920,
         jdump([{"id": "sub_1", "campaignId": "cmp_ac_service", "flatId": "flat_b704", "flatNumber": "B-704", "tower": "Tower B", "residentName": "Rohan Kulkarni", "preferredDate": "2026-11-28", "preferredSlot": "10:00 AM – 12:00 PM", "cadence": "annual", "status": "active", "consentTimestamp": "2026-11-14T15:30:00Z", "lockedUnitPrice": None, "rating": None}])),
        ("cmp_car_wash", "Daily Eco-Mist Exterior & Weekly Interior Car Care", "Vehicle care", "vnd_sparkle",
         "SparkleDrive Mobility Care", 850,
         "Waterless microfiber exterior wipe 6 days/week + weekly vacuum & dashboard dressing.",
         jdump(["6-day exterior wipe", "Weekly interior vacuum", "Tyre dressing"]),
         jdump(["Engine bay wash"]),
         "Monthly opt-in per 4-wheeler; GST included.",
         jdump(["2026-12-01 (Monthly Start)"]), 250, 25, jdump(make_tiers(850)),
         "2026-11-28", "Pause or cancel anytime before the 27th of the month.",
         "12% bulk tier unlocked (100+ flats).",
         "threshold_met", 114, 12, 748,
         jdump([{"id": "sub_2", "campaignId": "cmp_car_wash", "flatId": "flat_a402", "flatNumber": "A-402", "tower": "Tower A", "residentName": "Ananya Deshmukh", "preferredDate": "2026-12-01 (Monthly Start)", "preferredSlot": "06:30 AM – 08:30 AM", "cadence": "monthly", "status": "active", "consentTimestamp": "2026-11-12T09:10:00Z", "lockedUnitPrice": None, "rating": 5}])),
        ("cmp_pest_control", "Odourless Gel + Herbal General Pest Control (Quarterly)", "Cleaning and pest control", "vnd_ecoshield",
         "EcoShield Pest Solutions", 1600,
         "Kitchen cabinet gel baiting, balcony & bathroom drain spray treatment.",
         jdump(["All rooms & balconies", "Child & pet-safe gel", "1 free follow-up visit"]),
         jdump(["Termite drill treatment"]),
         "All-inclusive up to 1,600 sq.ft.",
         jdump(["2026-11-29", "2026-11-30"]), 20, 25, jdump(make_tiers(1600)),
         "2026-11-26", "100% refund if 25-flat threshold is not met.",
         "Needs 4 more flats to unlock 5% Tier-1 group discount (₹1,520).",
         "open", 21, 0, 1600, jdump([])),
    ]
    for c in campaigns:
        db.execute(
            """INSERT INTO service_campaigns (id, name, category_group, vendor_id, vendor_name, base_price,
               scope, inclusions_json, exclusions_json, tax_material_policy, available_dates_json,
               slot_capacity_per_day, min_confirmed_flats, tiers_json, opt_in_deadline, cancellation_policy,
               fallback_policy, status, confirmed_count, active_discount_pct, current_unit_price, subscriptions_json)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            c,
        )

    votes = [
        ("vote_ev_chargers", "Approve Phase-2 Shared 7.4kW EV Charging Bays in P1 Visitor Zone",
         "Proposal to install 6 metered OCPP 7.4kW EV charging pedestals in Basement P1 with RFID flat-linked billing.",
         "formal_resolution", "Formal Society Resolution (Verified Flat Owners Only · 1 Vote per Flat). Quorum: 30%.",
         "secret", "yes_no", "all_verified_owners", 420, 30, "2026-11-10", "2026-11-28", "open",
         "Phase-2 EV Charging Technical & Cost Proposal (PDF)",
         jdump([{"id": "opt_yes", "label": "Approve Proposal (₹3.60L Reserve)"}, {"id": "opt_no", "label": "Reject / Defer to AGM"}, {"id": "opt_abstain", "label": "Abstain"}]),
         jdump(["flat_a1101", "flat_c201"]), jdump({"opt_yes": 138, "opt_no": 24, "opt_abstain": 11}), jdump([])),
        ("vote_winter_carnival", "Community Poll: Preferred Weekend for Annual Winter Sports & Food Fair",
         "Informal community poll open to all verified residents.",
         "informal_poll", "Informal Resident Poll — non-binding community preference survey.",
         "attributable", "single", "all_residents", 480, 20, "2026-11-12", "2026-11-24", "open",
         "Cultural Committee Draft Event Schedule",
         jdump([{"id": "opt_dec12", "label": "12–13 Dec 2026"}, {"id": "opt_dec19", "label": "19–20 Dec 2026"}, {"id": "opt_jan09", "label": "9–10 Jan 2027"}]),
         jdump(["flat_a1101"]), jdump({"opt_dec12": 84, "opt_dec19": 112, "opt_jan09": 29}),
         jdump([{"flatNumber": "A-1101", "voterName": "Meera Iyer", "optionIds": ["opt_dec19"], "timestamp": "2026-11-13T10:15:00Z"}])),
    ]
    for v in votes:
        db.execute(
            """INSERT INTO votes (id, title, description, vote_type, legal_notice, ballot_mode, selection_mode,
               eligible_scope, eligible_count, quorum_pct, opens_at, closes_at, status, supporting_doc_title,
               options_json, voted_flat_ids_json, tallies_json, attributable_records_json)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            v,
        )

    amenities = [
        ("amn_clubhouse", "Crest Pavilion Banquet & Lounge", "/src/assets/images/amenity_clubhouse_1795110532673.jpg",
         80, "08:00 AM – 10:30 PM", 3500, 5000,
         jdump(["No external DJ amplifiers after 10:00 PM", "Refundable deposit settled within 48 hours"]),
         "Step-free ramp from Central Courtyard + accessible restroom.",
         jdump(["09:00 AM – 01:00 PM", "02:00 PM – 06:00 PM", "06:30 PM – 10:30 PM"])),
        ("amn_badminton", "Maple Indoor-Outdoor Badminton Court", "/src/assets/images/amenity_sports_court_1795110533431.jpg",
         4, "06:00 AM – 10:00 PM", 0, 0,
         jdump(["Non-marking gum-sole shoes mandatory", "Max 1 active slot per flat per day"]),
         "Ground-level entry beside Tower B.",
         jdump(["06:00 AM – 07:00 AM", "07:00 AM – 08:00 AM", "06:00 PM – 07:00 PM", "07:00 PM – 08:00 PM"])),
        ("amn_gym", "Timberline Fitness & Yoga Studio", "/src/assets/images/amenity_fitness_studio_1795110533264.jpg",
         15, "05:30 AM – 10:00 PM", 0, 0,
         jdump(["Carry a personal towel", "Re-rack dumbbells after use"]),
         "Elevator access from Clubhouse Lobby.",
         jdump(["06:00 AM – 07:30 AM", "07:30 AM – 09:00 AM", "05:30 PM – 07:00 PM", "07:00 PM – 08:30 PM"])),
    ]
    for a in amenities:
        db.execute(
            """INSERT INTO amenities (id, name, image_url, capacity, operating_hours, fee, deposit,
               house_rules_json, accessibility_info, slots_json) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            a,
        )

    db.execute(
        """INSERT INTO amenity_bookings (id, amenity_id, amenity_name, flat_id, flat_number, resident_name,
           booking_date, slot, guests, fee_paid, deposit_held, status, refund_status, created_at)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        ("bkg_1", "amn_badminton", "Maple Indoor-Outdoor Badminton Court", "flat_a402", "A-402",
         "Ananya Deshmukh", "2026-11-21", "07:00 PM – 08:00 PM", 2, 0, 0, "confirmed", None, now),
    )

    events = [
        ("evt_1", "Fire Evacuation Drill & First-Aid Workshop", "workshop", "2026-11-23", "10:00 AM – 11:30 AM",
         "Central Courtyard Assembly Point", "Annual safety briefing with live fire extinguisher handling.", 200, 0, 1,
         jdump([{"flatNumber": "A-402", "residentName": "Ananya Deshmukh", "guests": 2, "volunteerRole": "Floor Warden"}])),
        ("evt_2", "Aurelia Winter Farmers & Artisans Market", "community", "2026-11-30", "04:30 PM – 08:30 PM",
         "Clubhouse Lawn", "Resident-led organic stalls, acoustic music, and children's clay workshop.", 350, 0, 1,
         jdump([{"flatNumber": "B-704", "residentName": "Rohan Kulkarni", "guests": 3}])),
    ]
    for ev in events:
        db.execute(
            """INSERT INTO society_events (id, title, category, event_date, event_time, venue, description,
               capacity, fee_per_person, committee_approved, registrations_json)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            ev,
        )

    notices = [
        ("ntc_1", "Tower A & B Overhead Water Tank Chlorination & Cleaning Schedule",
         "Semi-annual tank cleaning is scheduled on Saturday, 22 Nov between 11:00 AM and 3:30 PM.",
         "official_circular", "Tower A & B Residents", "Meera Iyer", "Society Secretary", "2026-11-18 09:00:00",
         jdump(["flat_a1101", "flat_b704"])),
        ("ntc_2", "Tower C Passenger Lift 1 Temporarily Offline for Sensor Calibration",
         "Passenger Lift 1 in Tower C is under OEM maintenance. Service Lift 2 remains active.",
         "emergency_alert", "Tower C Residents", "Suresh Nair", "Facility Manager", "2026-11-18 12:15:00",
         jdump(["flat_c201"])),
    ]
    for n in notices:
        db.execute(
            """INSERT INTO notices (id, title, body, category, target_audience, author_name, author_role,
               published_at, acknowledged_by_json) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            n,
        )

    db.execute(
        """INSERT INTO meetings (id, title, meeting_type, meeting_date, venue, agenda_json, attendees_json,
           minutes_approved, minutes_summary, resolutions_json, confidential_draft_note)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        ("mtg_1", "Managing Committee Monthly Review — November 2026", "Committee Meeting", "2026-11-10",
         "Clubhouse Boardroom",
         jdump(["Review October collections & arrears", "Approve Phase-2 EV Charging vote"]),
         jdump(["Meera Iyer (Secretary)", "Vikram Joshi (Treasurer)", "Suresh Nair (Facility Manager)"]),
         1,
         "Committee approved floating the secret-ballot formal resolution for 6 shared EV chargers.",
         jdump([
             {"id": "res_1", "title": "Publish Phase-2 EV Charging Formal Vote", "owner": "Meera Iyer", "dueDate": "2026-11-12", "status": "completed"},
             {"id": "res_2", "title": "Audit Tower C Lift OEM AMC response clause", "owner": "Suresh Nair", "dueDate": "2026-11-22", "status": "in_progress"},
         ]),
         "Confidential Secretary Note: Legal counsel reviewing arrears notice for Flat C-503."),
    )

    visitors = [
        ("vis_1", "482910", "flat_a402", "A-402", "Dr. Arvind Phadke", "guest", "+91 98220 11234", "MH-12-PQ-7712",
         "2026-11-19", "pre_approved", None, None, "Ananya Deshmukh"),
        ("vis_2", "910344", "flat_b704", "B-704", "BlueDart Parcel (Courier)", "delivery", "+91 90112 44890", None,
         "2026-11-19", "checked_in", now, None, "Ramesh Patil"),
    ]
    for vis in visitors:
        db.execute(
            """INSERT INTO visitors (id, pass_code, flat_id, flat_number, visitor_name, visitor_type, phone,
               vehicle_no, expected_date, status, checked_in_at, checked_out_at, logged_by)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            vis,
        )

    docs = [
        ("doc_1", "Model Bye-Laws & House Rules (Adopted 2025)", "By-Laws", "v2.4", "all_residents", "2026-04-01", None,
         "Governing rules covering flat transfers, pet guidelines, renovation hours, and parking."),
        ("doc_2", "Approved Annual Budget FY 2026–27", "Finance & Budget", "v1.0", "owners_only", "2026-06-15", None,
         "Line-item society maintenance budget approved at AGM."),
        ("doc_3", "Comprehensive Building & Liability Insurance", "Insurance", "FY26-27", "all_residents", "2026-05-10", "2026-12-15",
         "Covers structural fire, earthquake, and lift liability."),
    ]
    for d in docs:
        db.execute(
            """INSERT INTO documents (id, title, category, version, access_level, updated_at, expiry_date, summary)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
            d,
        )

    assets = [
        ("ast_1", "Tower A & B Passenger Lifts (4 Units)", "Lift", "Towers A & B Cores", "Otis Elevator India",
         "optimal", "2026-11-04", "2026-12-04", "2027-03-31"),
        ("ast_2", "Tower C Passenger Lift 1", "Lift", "Tower C Core", "Otis Elevator India",
         "attention", "2026-10-20", "2026-11-20", "2027-03-31"),
        ("ast_3", "250 kVA DG Backup Set #1", "Generator", "Utility Block", "Kirloskar Care",
         "maintenance_due", "2026-08-15", "2026-11-22", "2026-12-31"),
    ]
    for ast in assets:
        db.execute(
            """INSERT INTO assets (id, name, category, location, vendor_name, condition_status,
               last_service_date, next_service_date, amc_expiry_date) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            ast,
        )

    db.execute(
        """INSERT INTO audit_logs (id, created_at, actor_name, actor_role, action, entity_type, entity_id, details)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
        ("aud_1", now, "Meera Iyer", "secretary", "SECRETARY_ROOT_INITIALIZED", "System", "usr_secretary",
         "Initialized Secretary root account and sub-accounts in MySQL."),
    )
    seed_advanced_modules(db)


def seed_advanced_modules(db: DatabaseManager) -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    # 1. House Help Registry & Attendance Logs
    hh_cnt = db.fetch_one("SELECT COUNT(*) AS cnt FROM house_helps")
    if not hh_cnt or hh_cnt["cnt"] == 0:
        helps = [
            (
                "hh_1", "Sunita Kamble", "+91 98234 51092", "maid", "Aadhaar", "XXXX-XXXX-4921",
                1, "cleared", 0, "HH-2026-101",
                jdump(["A-402", "A-1101", "C-201"]),
                jdump([
                    {"id": "rev_1", "rating": 5, "comment": "Very punctual and thorough with housekeeping.", "createdAt": "2026-11-12"},
                    {"id": "rev_2", "rating": 5, "comment": "Trustworthy and polite.", "createdAt": "2026-11-16"},
                ]),
                "inside", "2026-11-19 07:45:00", None,
            ),
            (
                "hh_2", "Rajesh Verma", "+91 97640 88213", "cook", "Police Verification", "PV-PUNE-8824",
                1, "cleared", 0, "HH-2026-102",
                jdump(["A-402", "B-704"]),
                jdump([
                    {"id": "rev_3", "rating": 4, "comment": "Great North & Maharashtrian meals.", "createdAt": "2026-11-15"},
                ]),
                "outside", "2026-11-18 18:15:00", "2026-11-18 20:30:00",
            ),
            (
                "hh_3", "Mahesh Shinde", "+91 98902 11904", "car_cleaner", "PAN / DL", "MH12-2019-4410",
                0, "pending", 0, "HH-2026-103",
                jdump(["B-704", "C-503"]),
                jdump([]),
                "outside", None, None,
            ),
        ]
        for h in helps:
            db.execute(
                """INSERT INTO house_helps (id, name, phone, help_type, id_proof_type, id_proof_number,
                   id_verified, background_check, incident_count, badge_code, assigned_flats_json,
                   reviews_json, current_status, last_check_in_at, last_check_out_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                h,
            )
        db.execute(
            """INSERT INTO house_help_logs (id, house_help_id, house_help_name, flat_number, guard_name, check_in_at, check_out_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s)""",
            ("hhl_1", "hh_1", "Sunita Kamble", "A-402", "Ramesh Patil", "2026-11-19 07:45:00", None),
        )
        db.execute(
            """INSERT INTO house_help_logs (id, house_help_id, house_help_name, flat_number, guard_name, check_in_at, check_out_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s)""",
            ("hhl_2", "hh_2", "Rajesh Verma", "B-704", "Ramesh Patil", "2026-11-18 18:15:00", "2026-11-18 20:30:00"),
        )

    # 2. Visitor & Resident Parking Slots Pool
    pk_cnt = db.fetch_one("SELECT COUNT(*) AS cnt FROM parking_slots")
    if not pk_cnt or pk_cnt["cnt"] == 0:
        slots = [
            ("pk_v1", "V-01", "open", 1, None, None, None, None, None),
            ("pk_v2", "V-02", "open", 1, None, None, None, None, None),
            ("pk_v3", "V-03", "ev", 1, None, None, None, None, None),
            ("pk_v4", "V-04", "open", 1, None, None, None, None, None),
            ("pk_v5", "V-05", "covered", 1, None, None, None, None, None),
            ("pk_r1", "P1-A42", "ev", 0, "flat_a402", "A-402", None, "MH-12-TR-4821", None),
            ("pk_r2", "P2-B19", "covered", 0, "flat_b704", "B-704", None, "MH-14-DF-3318", None),
        ]
        for s in slots:
            db.execute(
                """INSERT INTO parking_slots (id, slot_number, slot_type, is_visitor, flat_id, flat_number,
                   occupied_by_visitor_id, visitor_vehicle_no, occupied_since)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                s,
            )

    # 3. Parcel & Courier Gate Custody Locker
    pr_cnt = db.fetch_one("SELECT COUNT(*) AS cnt FROM parcels")
    if not pr_cnt or pr_cnt["cnt"] == 0:
        parcels = [
            ("prc_1", "flat_a402", "A-402", "Amazon Prime", "2 Medium Cartons (Fragile)", "Shelf B-2", "4912", "at_gate", "Ramesh Patil", "2026-11-19 09:20:00", None),
            ("prc_2", "flat_b704", "B-704", "Delhivery Express", "1 Document Envelope", "Shelf A-1", "7384", "collected", "Ramesh Patil", "2026-11-18 16:00:00", "2026-11-18 18:10:00"),
        ]
        for p in parcels:
            db.execute(
                """INSERT INTO parcels (id, flat_id, flat_number, courier_name, tracking_note, shelf_location,
                   pickup_otp, status, logged_by, created_at, collected_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                p,
            )

    # 4. Guard Shift & Device Binding
    gs_cnt = db.fetch_one("SELECT COUNT(*) AS cnt FROM guard_shifts")
    if not gs_cnt or gs_cnt["cnt"] == 0:
        db.execute(
            """INSERT INTO guard_shifts (id, guard_user_id, guard_name, device_id, clock_in_at, clock_in_gps, clock_out_at, handover_note, status)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            ("shf_1", "usr_security_gate", "Ramesh Patil", "GATE-TAB-01", "2026-11-19 07:00:00", "18.5204° N, 73.8567° E", None, "Morning shift active at Main Boom Barrier.", "on_duty"),
        )

    # 5. Chart of Accounts (Indian CHS Mutual vs Non-Mutual Split)
    gl_cnt = db.fetch_one("SELECT COUNT(*) AS cnt FROM gl_accounts")
    if not gl_cnt or gl_cnt["cnt"] == 0:
        accounts = [
            ("acc_1100", "1100", "Society Bank Account (SBI CHS Current)", "ASSET", 1),
            ("acc_1200", "1200", "Maintenance Dues Receivable", "ASSET", 1),
            ("acc_2100", "2100", "TDS Payable (Income Tax Sec 194C/J/I)", "LIABILITY", 0),
            ("acc_2200", "2200", "Vendor Bills Payable", "LIABILITY", 0),
            ("acc_3100", "3100", "Sinking & Structural Reserve Fund", "FUND", 1),
            ("acc_4100", "4100", "General Maintenance Income (Mutual)", "INCOME", 1),
            ("acc_4200", "4200", "Parking & Water Recoveries (Mutual)", "INCOME", 1),
            ("acc_4300", "4300", "Amenity & Non-Member Misc Income (Taxable)", "INCOME", 0),
            ("acc_5100", "5100", "Common Area Utilities & Electricity", "EXPENSE", 1),
            ("acc_5200", "5200", "Statutory Safety, Lift & AMC Repairs", "EXPENSE", 1),
        ]
        for a in accounts:
            db.execute(
                "INSERT INTO gl_accounts (id, code, name, account_type, is_mutual) VALUES (%s,%s,%s,%s,%s)",
                a,
            )

    # Update seeded expenses with TDS defaults if zeroed
    db.execute(
        "UPDATE expenses SET vendor_pan = 'AABCS8821K', gst_amount = 5263, tds_section = 'SEC_194C_2', tds_rate_pct = 2.0, tds_amount = 690, net_payable = 33810 WHERE id = 'exp_1' AND (tds_section IS NULL OR tds_section = '')"
    )
    db.execute(
        "UPDATE expenses SET vendor_pan = 'AAACM1042P', gst_amount = 0, tds_section = 'NONE', tds_rate_pct = 0.0, tds_amount = 0, net_payable = 142800 WHERE id = 'exp_2' AND (tds_section IS NULL OR tds_section = '')"
    )

    # 6. Double-Entry Journal Entries (Balanced Debits = Credits)
    je_cnt = db.fetch_one("SELECT COUNT(*) AS cnt FROM journal_entries")
    if not je_cnt or je_cnt["cnt"] == 0:
        entries = [
            (
                "je_1", "2026-11-01", "November 2026 Maintenance Billing Batch (4 Flats)", "INVOICE_BATCH",
                "November 2026", "FY 2026-27", 0, None,
                jdump([
                    {"accountId": "acc_1200", "accountCode": "1200", "accountName": "Maintenance Dues Receivable", "debit": 24585, "credit": 0},
                    {"accountId": "acc_4100", "accountCode": "4100", "accountName": "General Maintenance Income (Mutual)", "debit": 0, "credit": 17885},
                    {"accountId": "acc_4200", "accountCode": "4200", "accountName": "Parking & Water Recoveries (Mutual)", "debit": 0, "credit": 3700},
                    {"accountId": "acc_3100", "accountCode": "3100", "accountName": "Sinking & Structural Reserve Fund", "debit": 0, "credit": 3000},
                ]),
                "Vikram Joshi", now,
            ),
            (
                "je_2", "2026-11-09", "Receipt against INV-2026-11-B704 (NetBanking NB-8837100294)", "INVOICE_PAYMENT",
                "inv_b704_nov", "FY 2026-27", 0, None,
                jdump([
                    {"accountId": "acc_1100", "accountCode": "1100", "accountName": "Society Bank Account (SBI CHS Current)", "debit": 5800, "credit": 0},
                    {"accountId": "acc_1200", "accountCode": "1200", "accountName": "Maintenance Dues Receivable", "debit": 0, "credit": 5800},
                ]),
                "Vikram Joshi", now,
            ),
            (
                "je_3", "2026-11-06", "Common Area Electricity Bill MSEDCL (Paid)", "EXPENSE_BILL",
                "exp_2", "FY 2026-27", 0, None,
                jdump([
                    {"accountId": "acc_5100", "accountCode": "5100", "accountName": "Common Area Utilities & Electricity", "debit": 142800, "credit": 0},
                    {"accountId": "acc_1100", "accountCode": "1100", "accountName": "Society Bank Account (SBI CHS Current)", "debit": 0, "credit": 142800},
                ]),
                "Vikram Joshi", now,
            ),
            (
                "je_4", "2026-11-12", "Fire Hydrant Audit Bill SG-2026-884 (TDS Sec 194C @ 2%)", "EXPENSE_BILL",
                "exp_1", "FY 2026-27", 0, None,
                jdump([
                    {"accountId": "acc_5200", "accountCode": "5200", "accountName": "Statutory Safety, Lift & AMC Repairs", "debit": 34500, "credit": 0},
                    {"accountId": "acc_2100", "accountCode": "2100", "accountName": "TDS Payable (Income Tax Sec 194C/J/I)", "debit": 0, "credit": 690},
                    {"accountId": "acc_2200", "accountCode": "2200", "accountName": "Vendor Bills Payable", "debit": 0, "credit": 33810},
                ]),
                "Vikram Joshi", now,
            ),
            (
                "je_5", "2026-11-14", "Clubhouse Banquet Booking Fee (Non-Member / Misc Taxable)", "AMENITY_FEE",
                "amn_clubhouse", "FY 2026-27", 0, None,
                jdump([
                    {"accountId": "acc_1100", "accountCode": "1100", "accountName": "Society Bank Account (SBI CHS Current)", "debit": 3500, "credit": 0},
                    {"accountId": "acc_4300", "accountCode": "4300", "accountName": "Amenity & Non-Member Misc Income (Taxable)", "debit": 0, "credit": 3500},
                ]),
                "Meera Iyer", now,
            ),
        ]
        for je in entries:
            db.execute(
                """INSERT INTO journal_entries (id, entry_date, narration, source_type, source_id, period_label,
                   is_reversal, reverses_id, lines_json, created_by, created_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                je,
            )
