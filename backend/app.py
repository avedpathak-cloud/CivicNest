import base64
import csv
import io
import json
import mimetypes
import os
import random
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, urlparse

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from xml.sax.saxutils import escape as xml_escape
from backend.db import DatabaseManager, jdump, jload
from backend.seed import hash_pin, seed_advanced_modules, seed_if_empty

UPLOAD_DIR = ROOT_DIR / "data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

SLA_RULES = {
    "emergency": (0.25, 4.0),
    "high": (1.0, 24.0),
    "normal": (24.0, 72.0),
    "low": (48.0, 240.0),
}

STANDARD_TIERS = [(1, 0), (25, 5), (50, 8), (100, 12), (200, 15)]

TDS_RATES = {
    "NONE": 0.0,
    "SEC_194C_1": 1.0,
    "SEC_194C_2": 2.0,
    "SEC_194J": 10.0,
    "SEC_194I": 10.0,
}

db = DatabaseManager()
seed_if_empty(db)
seed_advanced_modules(db)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def utc_now_sql() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def to_iso(val: Any) -> Optional[str]:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%dT%H:%M:%SZ")
    s = str(val)
    if " " in s and "T" not in s:
        return s.replace(" ", "T") + "Z"
    return s


def serialize_user(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "parentSecretaryId": row.get("parent_secretary_id"),
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
        "roleTitle": row["role_title"],
        "flatId": row.get("flat_id"),
        "flatNumber": row.get("flat_number"),
        "tower": row.get("tower"),
        "vendorId": row.get("vendor_id"),
        "phone": row["phone"],
        "verified": bool(row["verified"]),
        "isActive": bool(row.get("is_active", 1)),
        "permissions": {
            "canCreatePosts": bool(row.get("can_create_posts", 1)),
            "canModeratePosts": bool(row.get("can_moderate_posts", 0)) or row["role"] == "secretary",
            "canManageTickets": bool(row.get("can_manage_tickets", 0)) or row["role"] == "secretary",
            "canManageBilling": bool(row.get("can_manage_billing", 0)) or row["role"] == "secretary",
            "canVote": bool(row.get("can_vote", 1)),
        },
        "consentMarketing": bool(row["consent_marketing"]),
        "consentDirectory": bool(row["consent_directory"]),
        "preferredLang": row.get("preferred_lang") or "en",
    }


def is_secretary(user: Dict[str, Any]) -> bool:
    return user["role"] == "secretary"


def is_ticket_manager(user: Dict[str, Any]) -> bool:
    return user["role"] == "secretary" or bool(user["permissions"]["canManageTickets"]) or user["role"] in (
        "facility_manager", "treasurer"
    )


def is_finance_manager(user: Dict[str, Any]) -> bool:
    return user["role"] == "secretary" or bool(user["permissions"]["canManageBilling"]) or user["role"] == "treasurer"


def is_post_moderator(user: Dict[str, Any]) -> bool:
    return user["role"] == "secretary" or bool(user["permissions"]["canModeratePosts"])


def append_audit(actor: Dict[str, Any], action: str, entity_type: str, entity_id: str, details: str) -> None:
    aid = f"aud_{int(time.time() * 1000)}_{random.randint(100, 999)}"
    db.execute(
        """INSERT INTO audit_logs (id, created_at, actor_name, actor_role, action, entity_type, entity_id, details)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
        (aid, utc_now_sql(), actor["name"], actor["role"], action, entity_type, entity_id, details),
    )


def serialize_flat(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "tower": row["tower"],
        "wing": row["wing"],
        "flatNumber": row["flat_number"],
        "floor": int(row["floor"]),
        "areaSqFt": int(row["area_sqft"]),
        "ownershipStatus": row["ownership_status"],
        "ownerName": row["owner_name"],
        "occupantName": row["occupant_name"],
        "occupantPhone": row["occupant_phone"],
        "parkingSlots": jload(row["parking_slots_json"], []),
        "billingStatus": row["billing_status"],
        "familyMembers": jload(row["family_members_json"], []),
        "vehicles": jload(row["vehicles_json"], []),
        "moveRequests": jload(row["move_requests_json"], []),
    }


def serialize_ticket(row: Dict[str, Any], include_internal: bool) -> Dict[str, Any]:
    obj: Dict[str, Any] = {
        "id": row["id"],
        "ticketNumber": row["ticket_number"],
        "flatId": row["flat_id"],
        "flatNumber": row["flat_number"],
        "tower": row["tower"],
        "raisedByUserId": row["raised_by_user_id"],
        "raisedByName": row["raised_by_name"],
        "category": row["category"],
        "priority": row["priority"],
        "title": row["title"],
        "description": row["description"],
        "location": row["location"],
        "preferredContactTime": row["preferred_contact_time"],
        "status": row["status"],
        "assigneeName": row.get("assignee_name"),
        "assigneeVendorId": row.get("assignee_vendor_id"),
        "slaResponseHours": float(row["sla_response_hours"]),
        "slaResolutionHours": float(row["sla_resolution_hours"]),
        "slaDueAt": to_iso(row["sla_due_at"]),
        "slaBreached": bool(row["sla_breached"]),
        "createdAt": to_iso(row["created_at"]),
        "acknowledgedAt": to_iso(row.get("acknowledged_at")),
        "resolvedAt": to_iso(row.get("resolved_at")),
        "closedAt": to_iso(row.get("closed_at")),
        "costEstimate": row.get("cost_estimate"),
        "costApproved": bool(row.get("cost_approved", 0)),
        "costApproverName": row.get("cost_approver_name"),
        "completionNotes": row.get("completion_notes"),
        "residentRating": row.get("resident_rating"),
        "residentFeedback": row.get("resident_feedback"),
        "comments": jload(row["comments_json"], []),
        "history": jload(row["history_json"], []),
    }
    if include_internal:
        obj["internalNotes"] = jload(row["internal_notes_json"], [])
    return obj


def serialize_post(row: Dict[str, Any], viewer: Dict[str, Any]) -> Dict[str, Any]:
    likes = jload(row["likes_json"], [])
    saves = jload(row["saves_json"], [])
    comments = jload(row["comments_json"], [])
    reports = jload(row["reports_json"], [])
    return {
        "id": row["id"],
        "authorUserId": row["author_user_id"],
        "authorName": row["author_name"],
        "authorRoleTitle": row["author_role_title"],
        "flatNumber": row.get("flat_number"),
        "tower": row.get("tower"),
        "category": row["category"],
        "caption": row["caption"],
        "imageUrl": row.get("image_url"),
        "isPinned": bool(row["is_pinned"]),
        "isHidden": bool(row["is_hidden"]),
        "moderationNote": row.get("moderation_note"),
        "likes": likes,
        "likeCount": len(likes),
        "likedByMe": any(l.get("userId") == viewer["id"] for l in likes),
        "savedByMe": viewer["id"] in saves,
        "comments": comments,
        "reportCount": len(reports) if is_post_moderator(viewer) else 0,
        "reports": reports if is_post_moderator(viewer) else [],
        "createdAt": to_iso(row["created_at"]),
    }


def compute_campaign_pricing(base_price: int, confirmed_count: int, tiers: List[Dict[str, Any]]):
    matched = tiers[0] if tiers else {"minFlats": 1, "discountPct": 0, "unitPrice": base_price}
    for t in tiers:
        if confirmed_count >= t["minFlats"] and t["discountPct"] >= matched["discountPct"]:
            matched = t
    return matched["discountPct"], matched["unitPrice"]


def post_journal_entry(
    actor_name: str,
    entry_date: str,
    narration: str,
    source_type: str,
    source_id: Optional[str],
    lines: List[Dict[str, Any]],
    reverses_id: Optional[str] = None,
) -> str:
    debit_sum = sum(int(l.get("debit") or 0) for l in lines)
    credit_sum = sum(int(l.get("credit") or 0) for l in lines)
    if debit_sum <= 0 or debit_sum != credit_sum:
        raise ValueError(f"Unbalanced journal entry: Dr {debit_sum} != Cr {credit_sum}")
    je_id = f"je_{int(time.time() * 1000)}_{random.randint(10, 99)}"
    db.execute(
        """INSERT INTO journal_entries (id, entry_date, narration, source_type, source_id, period_label,
           is_reversal, reverses_id, lines_json, created_by, created_at)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (
            je_id,
            entry_date,
            narration,
            source_type,
            source_id,
            "FY 2026-27",
            1 if reverses_id else 0,
            reverses_id,
            jdump(lines),
            actor_name,
            utc_now_sql(),
        ),
    )
    return je_id


def compute_accounting_statements(inv_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    accounts = db.fetch_all("SELECT * FROM gl_accounts ORDER BY code ASC")
    entries = db.fetch_all("SELECT * FROM journal_entries ORDER BY entry_date DESC, created_at DESC")

    totals: Dict[str, Dict[str, int]] = {
        a["id"]: {"debit": 0, "credit": 0} for a in accounts
    }
    for je in entries:
        for line in jload(je["lines_json"], []):
            aid = line.get("accountId")
            if aid in totals:
                totals[aid]["debit"] += int(line.get("debit") or 0)
                totals[aid]["credit"] += int(line.get("credit") or 0)

    trial_balance = []
    mutual_income = 0
    non_mutual_income = 0
    total_expense = 0
    assets_list = []
    liabilities_list = []
    funds_list = []

    for a in accounts:
        dr = totals[a["id"]]["debit"]
        cr = totals[a["id"]]["credit"]
        atype = a["account_type"]
        if atype in ("ASSET", "EXPENSE"):
            net = dr - cr
        else:
            net = cr - dr
        row = {
            "accountId": a["id"],
            "code": a["code"],
            "name": a["name"],
            "accountType": atype,
            "isMutual": bool(a["is_mutual"]),
            "debitTotal": dr,
            "creditTotal": cr,
            "netBalance": net,
        }
        trial_balance.append(row)
        if atype == "INCOME":
            if bool(a["is_mutual"]):
                mutual_income += net
            else:
                non_mutual_income += net
        elif atype == "EXPENSE":
            total_expense += net
        elif atype == "ASSET":
            assets_list.append(row)
        elif atype == "LIABILITY":
            liabilities_list.append(row)
        elif atype == "FUND":
            funds_list.append(row)

    net_surplus = (mutual_income + non_mutual_income) - total_expense

    # Arrears Aging Buckets relative to 2026-11-30 reference/current date
    ref_date = datetime(2026, 11, 30).date()
    buckets = {"0-30": 0, "31-60": 0, "61-90": 0, "90+": 0}
    bucket_counts = {"0-30": 0, "31-60": 0, "61-90": 0, "90+": 0}
    for inv in inv_rows:
        if inv["status"] in ("paid",):
            continue
        due = int(inv["total_amount"]) - int(inv["paid_amount"])
        if due <= 0:
            continue
        try:
            d_obj = datetime.strptime(str(inv["due_date"])[:10], "%Y-%m-%d").date()
            days = max(0, (ref_date - d_obj).days)
        except Exception:
            days = 15
        if days <= 30:
            key = "0-30"
        elif days <= 60:
            key = "31-60"
        elif days <= 90:
            key = "61-90"
        else:
            key = "90+"
        buckets[key] += due
        bucket_counts[key] += 1

    return {
        "trialBalance": trial_balance,
        "incomeStatement": {
            "mutualIncome": mutual_income,
            "nonMutualTaxableIncome": non_mutual_income,
            "totalIncome": mutual_income + non_mutual_income,
            "totalExpense": total_expense,
            "netSurplus": net_surplus,
        },
        "balanceSheet": {
            "assets": assets_list,
            "liabilities": liabilities_list,
            "funds": funds_list,
            "netSurplus": net_surplus,
            "totalAssets": sum(x["netBalance"] for x in assets_list),
            "totalLiabilitiesAndFunds": sum(x["netBalance"] for x in liabilities_list) + sum(x["netBalance"] for x in funds_list) + net_surplus,
        },
        "arrearsAging": [
            {"bucket": k, "amount": buckets[k], "invoiceCount": bucket_counts[k]}
            for k in ("0-30", "31-60", "61-90", "90+")
        ],
    }


def assign_visitor_parking(visitor_id: str, vehicle_no: Optional[str]) -> Optional[str]:
    if not vehicle_no:
        return None
    slot = db.fetch_one(
        "SELECT * FROM parking_slots WHERE is_visitor = 1 AND (occupied_by_visitor_id IS NULL OR occupied_by_visitor_id = '') ORDER BY slot_number ASC LIMIT 1"
    )
    if not slot:
        return None
    db.execute(
        "UPDATE parking_slots SET occupied_by_visitor_id = %s, visitor_vehicle_no = %s, occupied_since = %s WHERE id = %s",
        (visitor_id, vehicle_no.upper(), utc_now_sql(), slot["id"]),
    )
    db.execute("UPDATE visitors SET parking_slot_number = %s WHERE id = %s", (slot["slot_number"], visitor_id))
    return slot["slot_number"]


def release_visitor_parking(visitor_id: str) -> None:
    db.execute(
        "UPDATE parking_slots SET occupied_by_visitor_id = NULL, visitor_vehicle_no = NULL, occupied_since = NULL WHERE occupied_by_visitor_id = %s",
        (visitor_id,),
    )


def build_bootstrap(user: Dict[str, Any]) -> Dict[str, Any]:
    all_users_rows = db.fetch_all("SELECT * FROM users ORDER BY parent_secretary_id IS NOT NULL, created_at ASC")
    available_users = [serialize_user(r) for r in all_users_rows if bool(r.get("is_active", 1)) or is_secretary(user)]

    flats_rows = db.fetch_all("SELECT * FROM flats ORDER BY flat_number ASC")
    all_flats_full = [serialize_flat(r) for r in flats_rows]
    my_flat = next((f for f in all_flats_full if f["id"] == user.get("flatId")), None)
    visible_flats = all_flats_full if is_secretary(user) or is_ticket_manager(user) else ([my_flat] if my_flat else [])

    # Tickets (Secretary & ticket managers see all; vendor sees assigned; resident sees own flat)
    tkt_rows = db.fetch_all("SELECT * FROM tickets ORDER BY created_at DESC")
    visible_tickets = []
    for r in tkt_rows:
        if is_ticket_manager(user) or user["role"] == "security":
            visible_tickets.append(serialize_ticket(r, is_ticket_manager(user)))
        elif user["role"] == "vendor":
            if r.get("assignee_vendor_id") == user.get("vendorId"):
                visible_tickets.append(serialize_ticket(r, False))
        elif r["flat_id"] == user.get("flatId"):
            visible_tickets.append(serialize_ticket(r, False))

    # Social Posts (Pinned first, then newest; hidden posts visible only to Secretary / moderators)
    post_rows = db.fetch_all("SELECT * FROM social_posts ORDER BY is_pinned DESC, created_at DESC")
    visible_posts = []
    for pr in post_rows:
        if bool(pr["is_hidden"]) and not is_post_moderator(user):
            continue
        visible_posts.append(serialize_post(pr, user))

    # Invoices (Security & vendor blocked; residents scoped strictly to their flat)
    inv_rows = db.fetch_all("SELECT * FROM invoices ORDER BY due_date DESC")
    visible_invoices = []
    if user["role"] not in ("security", "vendor"):
        for r in inv_rows:
            if is_finance_manager(user) or r["flat_id"] == user.get("flatId"):
                visible_invoices.append({
                    "id": r["id"],
                    "invoiceNumber": r["invoice_number"],
                    "flatId": r["flat_id"],
                    "flatNumber": r["flat_number"],
                    "tower": r["tower"],
                    "periodLabel": r["period_label"],
                    "billingCycle": r["billing_cycle"],
                    "issuedAt": str(r["issued_at"]),
                    "dueDate": str(r["due_date"]),
                    "lineItems": jload(r["line_items_json"], []),
                    "carryForward": int(r["carry_forward"]),
                    "lateFee": int(r["late_fee"]),
                    "totalAmount": int(r["total_amount"]),
                    "paidAmount": int(r["paid_amount"]),
                    "status": r["status"],
                    "disputeReason": r.get("dispute_reason"),
                    "paymentRef": r.get("payment_ref"),
                    "paymentMethod": r.get("payment_method"),
                    "paidAt": to_iso(r.get("paid_at")),
                    "reconciled": bool(r["reconciled"]),
                })

    exp_rows = db.fetch_all("SELECT * FROM expenses ORDER BY expense_date DESC") if is_finance_manager(user) else []
    visible_expenses = [
        {
            "id": e["id"], "title": e["title"], "category": e["category"], "vendorName": e["vendor_name"],
            "vendorPan": e.get("vendor_pan"), "budgetHead": e["budget_head"], "amount": int(e["amount"]),
            "gstAmount": int(e.get("gst_amount") or 0), "tdsSection": e.get("tds_section") or "NONE",
            "tdsRatePct": float(e.get("tds_rate_pct") or 0), "tdsAmount": int(e.get("tds_amount") or 0),
            "netPayable": int(e.get("net_payable") or e["amount"]), "invoiceRef": e["invoice_ref"],
            "date": str(e["expense_date"]), "status": e["status"], "approvedBy": e.get("approved_by"),
        }
        for e in exp_rows
    ]

    cmp_rows = db.fetch_all("SELECT * FROM service_campaigns")
    visible_campaigns = []
    for c in cmp_rows:
        if user["role"] == "vendor" and c["vendor_id"] != user.get("vendorId"):
            continue
        subs = jload(c["subscriptions_json"], [])
        if not (is_secretary(user) or is_ticket_manager(user) or user["role"] == "vendor"):
            subs = [s for s in subs if s.get("flatId") == user.get("flatId")]
        visible_campaigns.append({
            "id": c["id"], "name": c["name"], "categoryGroup": c["category_group"],
            "vendorId": c["vendor_id"], "vendorName": c["vendor_name"], "basePrice": int(c["base_price"]),
            "scope": c["scope"], "inclusions": jload(c["inclusions_json"], []),
            "exclusions": jload(c["exclusions_json"], []), "taxMaterialPolicy": c["tax_material_policy"],
            "availableDates": jload(c["available_dates_json"], []), "slotCapacityPerDay": int(c["slot_capacity_per_day"]),
            "minConfirmedFlats": int(c["min_confirmed_flats"]), "tiers": jload(c["tiers_json"], []),
            "optInDeadline": str(c["opt_in_deadline"]), "cancellationPolicy": c["cancellation_policy"],
            "fallbackPolicy": c["fallback_policy"], "status": c["status"],
            "confirmedCount": int(c["confirmed_count"]), "activeDiscountPct": int(c["active_discount_pct"]),
            "currentUnitPrice": int(c["current_unit_price"]), "subscriptions": subs,
        })

    vote_rows = db.fetch_all("SELECT * FROM votes")
    visible_votes = []
    for v in vote_rows:
        voted_ids = jload(v["voted_flat_ids_json"], [])
        visible_votes.append({
            "id": v["id"], "title": v["title"], "description": v["description"],
            "voteType": v["vote_type"], "legalNotice": v["legal_notice"], "ballotMode": v["ballot_mode"],
            "selectionMode": v["selection_mode"], "eligibleScope": v["eligible_scope"],
            "eligibleCount": int(v["eligible_count"]), "quorumPct": int(v["quorum_pct"]),
            "opensAt": str(v["opens_at"]), "closesAt": str(v["closes_at"]), "status": v["status"],
            "supportingDocTitle": v["supporting_doc_title"], "options": jload(v["options_json"], []),
            "votedFlatIds": voted_ids if is_secretary(user) else [],
            "tallies": jload(v["tallies_json"], {}),
            "attributableRecords": [] if v["ballot_mode"] == "secret" else jload(v["attributable_records_json"], []),
            "hasUserFlatVoted": bool(user.get("flatId") and user.get("flatId") in voted_ids),
        })

    amn_rows = db.fetch_all("SELECT * FROM amenities")
    amenities = [
        {
            "id": a["id"], "name": a["name"], "imageUrl": a["image_url"], "capacity": int(a["capacity"]),
            "operatingHours": a["operating_hours"], "fee": int(a["fee"]), "deposit": int(a["deposit"]),
            "houseRules": jload(a["house_rules_json"], []), "accessibilityInfo": a["accessibility_info"],
            "slots": jload(a["slots_json"], []),
        }
        for a in amn_rows
    ]

    bkg_rows = db.fetch_all("SELECT * FROM amenity_bookings ORDER BY created_at DESC")
    bookings = []
    for b in bkg_rows:
        mine = b["flat_id"] == user.get("flatId") or is_secretary(user)
        bookings.append({
            "id": b["id"], "amenityId": b["amenity_id"], "amenityName": b["amenity_name"],
            "flatId": b["flat_id"], "flatNumber": b["flat_number"] if mine else "Reserved",
            "residentName": b["resident_name"] if mine else "Society Member",
            "date": str(b["booking_date"]), "slot": b["slot"], "guests": int(b["guests"]),
            "feePaid": int(b["fee_paid"]), "depositHeld": int(b["deposit_held"]),
            "status": b["status"], "refundStatus": b.get("refund_status"), "createdAt": to_iso(b["created_at"]),
        })

    evt_rows = db.fetch_all("SELECT * FROM society_events ORDER BY event_date ASC")
    events = [
        {
            "id": e["id"], "title": e["title"], "category": e["category"], "date": str(e["event_date"]),
            "time": e["event_time"], "venue": e["venue"], "description": e["description"],
            "capacity": int(e["capacity"]), "feePerPerson": int(e["fee_per_person"]),
            "committeeApproved": bool(e["committee_approved"]), "registrations": jload(e["registrations_json"], []),
        }
        for e in evt_rows
    ]

    ntc_rows = db.fetch_all("SELECT * FROM notices ORDER BY published_at DESC")
    notices = []
    for n in ntc_rows:
        if n["category"] == "vendor_promo" and not user["consentMarketing"] and not is_secretary(user):
            continue
        notices.append({
            "id": n["id"], "title": n["title"], "body": n["body"], "category": n["category"],
            "targetAudience": n["target_audience"], "authorName": n["author_name"], "authorRole": n["author_role"],
            "publishedAt": to_iso(n["published_at"]), "acknowledgedBy": jload(n["acknowledged_by_json"], []),
        })

    mtg_rows = db.fetch_all("SELECT * FROM meetings ORDER BY meeting_date DESC")
    meetings = []
    for m in mtg_rows:
        item = {
            "id": m["id"], "title": m["title"], "meetingType": m["meeting_type"],
            "date": str(m["meeting_date"]), "venue": m["venue"], "agenda": jload(m["agenda_json"], []),
            "attendees": jload(m["attendees_json"], []), "minutesApproved": bool(m["minutes_approved"]),
            "minutesSummary": m["minutes_summary"], "resolutions": jload(m["resolutions_json"], []),
        }
        if is_secretary(user):
            item["confidentialDraftNote"] = m.get("confidential_draft_note")
        meetings.append(item)

    vis_rows = db.fetch_all("SELECT * FROM visitors ORDER BY expected_date DESC, id DESC")
    visitors = []
    if user["role"] != "vendor":
        for v in vis_rows:
            if user["role"] == "security" or is_secretary(user) or is_ticket_manager(user) or v["flat_id"] == user.get("flatId"):
                visitors.append({
                    "id": v["id"], "passCode": v["pass_code"], "flatId": v["flat_id"],
                    "flatNumber": v["flat_number"], "visitorName": v["visitor_name"], "visitorType": v["visitor_type"],
                    "phone": v["phone"], "vehicleNo": v.get("vehicle_no"), "expectedDate": str(v["expected_date"]),
                    "status": v["status"], "parkingSlotNumber": v.get("parking_slot_number"),
                    "checkedInAt": to_iso(v.get("checked_in_at")),
                    "checkedOutAt": to_iso(v.get("checked_out_at")), "loggedBy": v["logged_by"],
                })

    doc_rows = db.fetch_all("SELECT * FROM documents ORDER BY updated_at DESC")
    documents = []
    for d in doc_rows:
        if d["access_level"] == "committee" and not is_secretary(user):
            continue
        if d["access_level"] == "owners_only" and user["role"] not in ("owner", "secretary", "treasurer"):
            continue
        documents.append({
            "id": d["id"], "title": d["title"], "category": d["category"], "version": d["version"],
            "accessLevel": d["access_level"], "updatedAt": str(d["updated_at"]),
            "expiryDate": str(d["expiry_date"]) if d.get("expiry_date") else None, "summary": d["summary"],
        })

    ast_rows = db.fetch_all("SELECT * FROM assets")
    assets = [
        {
            "id": a["id"], "name": a["name"], "category": a["category"], "location": a["location"],
            "vendorName": a["vendor_name"], "condition": a["condition_status"],
            "lastServiceDate": str(a["last_service_date"]), "nextServiceDate": str(a["next_service_date"]),
            "amcExpiryDate": str(a["amc_expiry_date"]),
        }
        for a in ast_rows
    ]

    aud_rows = db.fetch_all("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 60") if is_secretary(user) or is_finance_manager(user) else []
    audit_logs = [
        {
            "id": a["id"], "timestamp": to_iso(a["created_at"]), "actorName": a["actor_name"],
            "actorRole": a["actor_role"], "action": a["action"], "entityType": a["entity_type"],
            "entityId": a["entity_id"], "details": a["details"],
        }
        for a in aud_rows
    ]

    # House Help Registry & Gate Attendance Logs
    hh_rows = db.fetch_all("SELECT * FROM house_helps ORDER BY name ASC")
    house_helps = []
    if user["role"] != "vendor":
        for h in hh_rows:
            revs = jload(h["reviews_json"], [])
            avg_rating = round(sum(int(r.get("rating", 5)) for r in revs) / len(revs), 1) if revs else None
            house_helps.append({
                "id": h["id"],
                "name": h["name"],
                "phone": h["phone"],
                "helpType": h["help_type"],
                "idProofType": h["id_proof_type"],
                "idProofNumber": h["id_proof_number"],
                "idVerified": bool(h["id_verified"]),
                "backgroundCheck": h["background_check"],
                "incidentCount": int(h["incident_count"]),
                "badgeCode": h["badge_code"],
                "assignedFlats": jload(h["assigned_flats_json"], []),
                "reviews": revs,
                "avgRating": avg_rating,
                "currentStatus": h["current_status"],
                "lastCheckInAt": to_iso(h.get("last_check_in_at")),
                "lastCheckOutAt": to_iso(h.get("last_check_out_at")),
            })

    hh_log_rows = db.fetch_all("SELECT * FROM house_help_logs ORDER BY check_in_at DESC LIMIT 40") if user["role"] != "vendor" else []
    house_help_logs = [
        {
            "id": l["id"],
            "houseHelpId": l["house_help_id"],
            "houseHelpName": l["house_help_name"],
            "flatNumber": l["flat_number"],
            "guardName": l["guard_name"],
            "checkInAt": to_iso(l["check_in_at"]),
            "checkOutAt": to_iso(l.get("check_out_at")),
        }
        for l in hh_log_rows
    ]

    # Parking Slots
    pk_rows = db.fetch_all("SELECT * FROM parking_slots ORDER BY is_visitor DESC, slot_number ASC") if user["role"] != "vendor" else []
    parking_slots = [
        {
            "id": p["id"],
            "slotNumber": p["slot_number"],
            "slotType": p["slot_type"],
            "isVisitor": bool(p["is_visitor"]),
            "flatId": p.get("flat_id"),
            "flatNumber": p.get("flat_number"),
            "occupiedByVisitorId": p.get("occupied_by_visitor_id"),
            "visitorVehicleNo": p.get("visitor_vehicle_no"),
            "occupiedSince": to_iso(p.get("occupied_since")),
        }
        for p in pk_rows
    ]

    # Parcels & Courier Custody Locker
    prc_rows = db.fetch_all("SELECT * FROM parcels ORDER BY created_at DESC")
    parcels = []
    if user["role"] != "vendor":
        for p in prc_rows:
            if user["role"] == "security" or is_secretary(user) or is_ticket_manager(user) or p["flat_id"] == user.get("flatId"):
                parcels.append({
                    "id": p["id"],
                    "flatId": p["flat_id"],
                    "flatNumber": p["flat_number"],
                    "courierName": p["courier_name"],
                    "trackingNote": p["tracking_note"],
                    "shelfLocation": p["shelf_location"],
                    "pickupOtp": p["pickup_otp"] if (p["flat_id"] == user.get("flatId") or is_secretary(user)) else "****",
                    "status": p["status"],
                    "loggedBy": p["logged_by"],
                    "createdAt": to_iso(p["created_at"]),
                    "collectedAt": to_iso(p.get("collected_at")),
                })

    # Emergency SOS Alerts
    sos_rows = db.fetch_all("SELECT * FROM sos_alerts ORDER BY created_at DESC LIMIT 20")
    sos_alerts = [
        {
            "id": s["id"],
            "userId": s["user_id"],
            "userName": s["user_name"],
            "flatNumber": s.get("flat_number"),
            "tower": s.get("tower"),
            "alertType": s["alert_type"],
            "message": s["message"],
            "status": s["status"],
            "acknowledgedBy": s.get("acknowledged_by"),
            "createdAt": to_iso(s["created_at"]),
            "resolvedAt": to_iso(s.get("resolved_at")),
        }
        for s in sos_rows
        if user["role"] in ("secretary", "security", "facility_manager") or s["user_id"] == user["id"] or s["status"] == "active"
    ]

    # Guard Shifts
    gs_rows = db.fetch_all("SELECT * FROM guard_shifts ORDER BY clock_in_at DESC LIMIT 12") if (user["role"] == "security" or is_secretary(user) or is_ticket_manager(user)) else []
    guard_shifts = [
        {
            "id": g["id"],
            "guardUserId": g["guard_user_id"],
            "guardName": g["guard_name"],
            "deviceId": g["device_id"],
            "clockInAt": to_iso(g["clock_in_at"]),
            "clockInGps": g["clock_in_gps"],
            "clockOutAt": to_iso(g.get("clock_out_at")),
            "handoverNote": g.get("handover_note"),
            "status": g["status"],
        }
        for g in gs_rows
    ]

    # Double-Entry General Ledger & Statutory Financial Statements (Finance Admins / Secretary)
    if is_finance_manager(user):
        gl_rows = db.fetch_all("SELECT * FROM gl_accounts ORDER BY code ASC")
        gl_accounts = [
            {
                "id": a["id"],
                "code": a["code"],
                "name": a["name"],
                "accountType": a["account_type"],
                "isMutual": bool(a["is_mutual"]),
            }
            for a in gl_rows
        ]
        je_rows = db.fetch_all("SELECT * FROM journal_entries ORDER BY entry_date DESC, created_at DESC LIMIT 50")
        journal_entries = [
            {
                "id": j["id"],
                "entryDate": str(j["entry_date"]),
                "narration": j["narration"],
                "sourceType": j["source_type"],
                "sourceId": j.get("source_id"),
                "periodLabel": j["period_label"],
                "isReversal": bool(j["is_reversal"]),
                "reversesId": j.get("reverses_id"),
                "lines": jload(j["lines_json"], []),
                "createdBy": j["created_by"],
                "createdAt": to_iso(j["created_at"]),
            }
            for j in je_rows
        ]
        accounting_statements = compute_accounting_statements(inv_rows)
    else:
        gl_accounts = []
        journal_entries = []
        accounting_statements = None

    # Summary KPIs
    total_billed = sum(int(i["total_amount"]) for i in inv_rows)
    total_collected = sum(int(i["paid_amount"]) for i in inv_rows)
    open_tkt = [t for t in tkt_rows if t["status"] not in ("Resolved", "Closed", "Cancelled")]
    overdue_tkt = [t for t in open_tkt if bool(t["sla_breached"])]
    closed_tkt = [t for t in tkt_rows if t["status"] in ("Resolved", "Closed")]
    within_sla = len([t for t in closed_tkt if not bool(t["sla_breached"])])
    rated = [int(t["resident_rating"]) for t in tkt_rows if t.get("resident_rating") is not None]
    total_opt_ins = sum(int(c["confirmed_count"]) for c in cmp_rows)
    est_savings = sum(int(c["confirmed_count"]) * (int(c["base_price"]) - int(c["current_unit_price"])) for c in cmp_rows)
    all_res = [res for m in meetings for res in m["resolutions"]]
    done_res = len([r for r in all_res if r.get("status") == "completed"])

    return {
        "backendEngine": f"Python 3.11 + {db.backend_kind.upper()}",
        "currentUser": user,
        "availableUsers": available_users,
        "society": {
            "societyName": "Aurelia Crest Co-operative Housing Society",
            "city": "Pune, Maharashtra",
            "totalFlats": 480,
            "occupiedFlats": 446,
            "digitalAdoptionFlats": 368,
            "ticketStats": {
                "open": len(open_tkt),
                "overdue": len(overdue_tkt),
                "slaCompliancePct": round((within_sla / len(closed_tkt)) * 100) if closed_tkt else 92,
                "avgSatisfaction": round(sum(rated) / len(rated), 1) if rated else 4.6,
            },
            "financeStats": {
                "totalBilled": total_billed,
                "totalCollected": total_collected,
                "collectionRatePct": round((total_collected / total_billed) * 100) if total_billed else 0,
                "outstandingTotal": total_billed - total_collected,
            },
            "campaignStats": {
                "activeCampaigns": len([c for c in cmp_rows if c["status"] in ("open", "threshold_met")]),
                "totalOptIns": total_opt_ins,
                "estimatedResidentSavings": est_savings,
            },
            "meetingActionCompletionPct": round((done_res / len(all_res)) * 100) if all_res else 85,
        },
        "myFlat": my_flat,
        "allFlats": visible_flats,
        "socialPosts": visible_posts,
        "tickets": visible_tickets,
        "invoices": visible_invoices,
        "expenses": visible_expenses,
        "campaigns": visible_campaigns,
        "votes": visible_votes,
        "amenities": amenities,
        "bookings": bookings,
        "events": events,
        "notices": notices,
        "meetings": meetings,
        "visitors": visitors,
        "documents": documents,
        "assets": assets,
        "auditLogs": audit_logs,
        "houseHelps": house_helps,
        "houseHelpLogs": house_help_logs,
        "parkingSlots": parking_slots,
        "parcels": parcels,
        "sosAlerts": sos_alerts,
        "guardShifts": guard_shifts,
        "glAccounts": gl_accounts,
        "journalEntries": journal_entries,
        "accountingStatements": accounting_statements,
    }


class SocietyAPIHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format: str, *args: Any) -> None:
        return

    def _send_json(self, status: int, data: Any) -> None:
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _send_bytes(self, status: int, content_type: str, raw: bytes, disposition: Optional[str] = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(raw)))
        if disposition:
            self.send_header("Content-Disposition", disposition)
        self.end_headers()
        self.wfile.write(raw)

    def _read_json_body(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return {}

    def _resolve_user(self) -> Optional[Dict[str, Any]]:
        uid = self.headers.get("x-user-id") or "usr_secretary"
        row = db.fetch_one("SELECT * FROM users WHERE id = %s", (uid,))
        if not row:
            row = db.fetch_one("SELECT * FROM users WHERE id = 'usr_secretary'")
        if not row:
            return None
        return serialize_user(row)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith("/uploads/"):
            fname = os.path.basename(path)
            fpath = UPLOAD_DIR / fname
            if not fpath.is_file():
                self._send_json(404, {"error": "File not found."})
                return
            ctype, _ = mimetypes.guess_type(str(fpath))
            self._send_bytes(200, ctype or "application/octet-stream", fpath.read_bytes())
            return

        user = self._resolve_user()
        if not user or not user["isActive"]:
            self._send_json(403, {"error": "Account is suspended by Society Secretary."})
            return

        if path == "/api/bootstrap":
            self._send_json(200, build_bootstrap(user))
            return

        if path == "/api/profile/export":
            my_flat = db.fetch_one("SELECT * FROM flats WHERE id = %s", (user["flatId"],)) if user.get("flatId") else None
            tkt_rows = db.fetch_all("SELECT * FROM tickets WHERE flat_id = %s", (user.get("flatId"),)) if user.get("flatId") else []
            inv_rows = [] if user["role"] == "security" else (db.fetch_all("SELECT * FROM invoices WHERE flat_id = %s", (user.get("flatId"),)) if user.get("flatId") else [])
            payload = {
                "exportedAt": utc_now_iso(),
                "account": user,
                "flat": serialize_flat(my_flat) if my_flat else None,
                "tickets": [serialize_ticket(t, False) for t in tkt_rows],
                "invoicesCount": len(inv_rows),
            }
            raw = json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")
            self._send_bytes(200, "application/json", raw, f'attachment; filename="civicnest-export-{user.get("flatNumber") or user["id"]}.json"')
            return

        if path == "/api/reports/export":
            if not (is_secretary(user) or is_finance_manager(user)):
                self._send_json(403, {"error": "Secretary or Treasurer access required."})
                return
            qs = parse_qs(parsed.query)
            rtype = qs.get("type", ["finance"])[0]
            if rtype == "tally_xml":
                entries = db.fetch_all("SELECT * FROM journal_entries ORDER BY entry_date ASC")
                vouchers_xml = []
                for je in entries:
                    lines = jload(je["lines_json"], [])
                    ledger_entries = []
                    for l in lines:
                        dr = int(l.get("debit") or 0)
                        cr = int(l.get("credit") or 0)
                        amt = -dr if dr > 0 else cr
                        is_deemed_pos = "Yes" if dr > 0 else "No"
                        ledger_entries.append(
                            f"""        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>{xml_escape(str(l.get("accountName") or "General Ledger"))}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>{is_deemed_pos}</ISDEEMEDPOSITIVE>
          <AMOUNT>{amt}.00</AMOUNT>
        </ALLLEDGERENTRIES.LIST>"""
                        )
                    vouchers_xml.append(
                        f"""      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Journal" ACTION="Create">
          <DATE>{str(je["entry_date"]).replace("-", "")}</DATE>
          <NARRATION>{xml_escape(str(je["narration"]))}</NARRATION>
          <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
          <VOUCHERNUMBER>{xml_escape(str(je["id"]))}</VOUCHERNUMBER>
{chr(10).join(ledger_entries)}
        </VOUCHER>
      </TALLYMESSAGE>"""
                    )
                xml_doc = f"""<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>Aurelia Crest Co-operative Housing Society</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
{chr(10).join(vouchers_xml)}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
"""
                self._send_bytes(200, "application/xml; charset=utf-8", xml_doc.encode("utf-8"), 'attachment; filename="aurelia-crest-tally-vouchers.xml"')
                return

            buf = io.StringIO()
            writer = csv.writer(buf)
            if rtype == "finance":
                writer.writerow(["InvoiceNumber", "Flat", "Tower", "Period", "DueDate", "TotalINR", "PaidINR", "Status", "PaymentRef"])
                for r in db.fetch_all("SELECT * FROM invoices"):
                    writer.writerow([r["invoice_number"], r["flat_number"], r["tower"], r["period_label"], r["due_date"], r["total_amount"], r["paid_amount"], r["status"], r.get("payment_ref") or ""])
            elif rtype == "tickets":
                writer.writerow(["TicketNumber", "Flat", "Category", "Priority", "Status", "SLABreached", "CostEstimate", "Rating"])
                for t in db.fetch_all("SELECT * FROM tickets"):
                    writer.writerow([t["ticket_number"], t["flat_number"], t["category"], t["priority"], t["status"], bool(t["sla_breached"]), t.get("cost_estimate") or 0, t.get("resident_rating") or ""])
            else:
                writer.writerow(["Campaign", "Vendor", "ConfirmedFlats", "BasePriceINR", "DiscountPct", "CurrentPriceINR", "Status"])
                for c in db.fetch_all("SELECT * FROM service_campaigns"):
                    writer.writerow([c["name"], c["vendor_name"], c["confirmed_count"], c["base_price"], c["active_discount_pct"], c["current_unit_price"], c["status"]])
            self._send_bytes(200, "text/csv; charset=utf-8", buf.getvalue().encode("utf-8"), f'attachment; filename="civicnest-{rtype}-report.csv"')
            return

        self._send_json(404, {"error": "API endpoint not found."})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        body = self._read_json_body()

        if path == "/api/auth/login":
            email = str(body.get("email") or "").strip().lower()
            pin = str(body.get("pin") or "").strip()
            row = db.fetch_one("SELECT * FROM users WHERE LOWER(email) = %s", (email,))
            if not row or row["pin_hash"] != hash_pin(pin):
                self._send_json(401, {"error": "Invalid email or PIN."})
                return
            if not bool(row.get("is_active", 1)):
                self._send_json(403, {"error": "This account has been suspended by the Society Secretary."})
                return
            user = serialize_user(row)
            append_audit(user, "USER_LOGIN", "User", user["id"], f"Authenticated via MySQL ({user['role']})")
            self._send_json(200, build_bootstrap(user))
            return

        user = self._resolve_user()
        if not user or not user["isActive"]:
            self._send_json(403, {"error": "Account is suspended by Society Secretary."})
            return

        # Secretary creates sub-accounts under their root Secretary account
        if path == "/api/secretary/accounts":
            if not is_secretary(user):
                self._send_json(403, {"error": "Only the Society Secretary account can create sub-accounts."})
                return
            name = str(body.get("name") or "").strip()
            email = str(body.get("email") or "").strip().lower()
            pin = str(body.get("pin") or "2026").strip()
            role = str(body.get("role") or "owner")
            if role == "secretary":
                self._send_json(400, {"error": "Only one Society Secretary root account is permitted."})
                return
            if not name or not email:
                self._send_json(400, {"error": "Name and email are required."})
                return
            if db.fetch_one("SELECT id FROM users WHERE LOWER(email) = %s", (email,)):
                self._send_json(409, {"error": "An account with this email already exists."})
                return
            flat_id = body.get("flatId") or None
            flat_row = db.fetch_one("SELECT * FROM flats WHERE id = %s", (flat_id,)) if flat_id else None
            perms = body.get("permissions") or {}
            new_id = f"usr_{int(time.time() * 1000)}"
            role_title = f"{role.replace('_', ' ').title()}" + (f" (Flat {flat_row['flat_number']})" if flat_row else " (Assigned by Secretary)")
            db.execute(
                """INSERT INTO users (
                  id, parent_secretary_id, name, email, pin_hash, role, role_title,
                  flat_id, flat_number, tower, vendor_id, phone, verified, is_active,
                  can_create_posts, can_moderate_posts, can_manage_tickets, can_manage_billing,
                  can_vote, consent_marketing, consent_directory, preferred_lang, created_at
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (
                    new_id, "usr_secretary", name, email, hash_pin(pin), role, role_title,
                    flat_row["id"] if flat_row else None,
                    flat_row["flat_number"] if flat_row else None,
                    flat_row["tower"] if flat_row else None,
                    "vnd_coolair" if role == "vendor" else None,
                    str(body.get("phone") or "+91 98000 00000"),
                    1, 1,
                    1 if perms.get("canCreatePosts", True) else 0,
                    1 if perms.get("canModeratePosts", False) else 0,
                    1 if perms.get("canManageTickets", role == "facility_manager") else 0,
                    1 if perms.get("canManageBilling", role == "treasurer") else 0,
                    1 if perms.get("canVote", role == "owner") else 0,
                    1, 1, "en", utc_now_sql(),
                ),
            )
            append_audit(user, "SUBACCOUNT_CREATED", "User", new_id, f"Secretary created {role} account for {name} ({email})")
            self._send_json(201, build_bootstrap(user))
            return

        # Social image upload
        if path == "/api/social/upload":
            if not user["permissions"]["canCreatePosts"] and not is_secretary(user):
                self._send_json(403, {"error": "Post permissions disabled by Secretary."})
                return
            data_url = str(body.get("dataUrl") or "")
            m = re.match(r"^data:image/(png|jpeg|jpg|webp);base64,(.+)$", data_url, re.DOTALL)
            if not m:
                self._send_json(400, {"error": "Invalid image format. Use PNG, JPEG, or WebP."})
                return
            ext = "jpg" if m.group(1) == "jpeg" else m.group(1)
            raw_bytes = base64.b64decode(m.group(2))
            if len(raw_bytes) > 6 * 1024 * 1024:
                self._send_json(400, {"error": "Image exceeds 6 MB limit."})
                return
            fname = f"post_{int(time.time() * 1000)}_{random.randint(100, 999)}.{ext}"
            (UPLOAD_DIR / fname).write_bytes(raw_bytes)
            self._send_json(201, {"url": f"/uploads/{fname}"})
            return

        # Social post creation
        if path == "/api/social/posts":
            if not user["permissions"]["canCreatePosts"] and not is_secretary(user):
                self._send_json(403, {"error": "Post creation disabled for this account by the Secretary."})
                return
            caption = str(body.get("caption") or "").strip()
            category = str(body.get("category") or "Home & Decor").strip()
            image_url = body.get("imageUrl") or None
            if not caption and not image_url:
                self._send_json(400, {"error": "Write a thought or attach a flat/decor photo."})
                return
            pid = f"post_{int(time.time() * 1000)}"
            db.execute(
                """INSERT INTO social_posts (id, author_user_id, author_name, author_role_title, flat_number, tower,
                   category, caption, image_url, is_pinned, is_hidden, moderation_note, likes_json, saves_json,
                   comments_json, reports_json, created_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (
                    pid, user["id"], user["name"], user["roleTitle"], user.get("flatNumber"), user.get("tower"),
                    category, caption, image_url, 0, 0, None, jdump([]), jdump([]), jdump([]), jdump([]), utc_now_sql(),
                ),
            )
            append_audit(user, "SOCIAL_POST_CREATED", "SocialPost", pid, f"{category}: {caption[:60]}")
            self._send_json(201, build_bootstrap(user))
            return

        # Social Post interactions (like, save, comment, report)
        m_post = re.match(r"^/api/social/posts/([^/]+)/(like|save|comment|report)$", path)
        if m_post:
            pid, action = m_post.group(1), m_post.group(2)
            row = db.fetch_one("SELECT * FROM social_posts WHERE id = %s", (pid,))
            if not row:
                self._send_json(404, {"error": "Post not found."})
                return
            if action == "like":
                likes = jload(row["likes_json"], [])
                if any(l.get("userId") == user["id"] for l in likes):
                    likes = [l for l in likes if l.get("userId") != user["id"]]
                else:
                    likes.append({"userId": user["id"], "userName": user["name"], "flatNumber": user.get("flatNumber")})
                db.execute("UPDATE social_posts SET likes_json = %s WHERE id = %s", (jdump(likes), pid))
            elif action == "save":
                saves = jload(row["saves_json"], [])
                if user["id"] in saves:
                    saves = [s for s in saves if s != user["id"]]
                else:
                    saves.append(user["id"])
                db.execute("UPDATE social_posts SET saves_json = %s WHERE id = %s", (jdump(saves), pid))
            elif action == "comment":
                text = str(body.get("text") or "").strip()
                if not text:
                    self._send_json(400, {"error": "Comment cannot be empty."})
                    return
                comments = jload(row["comments_json"], [])
                comments.append({
                    "id": f"pc_{int(time.time() * 1000)}",
                    "userId": user["id"],
                    "authorName": user["name"],
                    "flatNumber": user.get("flatNumber"),
                    "text": text,
                    "createdAt": utc_now_sql(),
                })
                db.execute("UPDATE social_posts SET comments_json = %s WHERE id = %s", (jdump(comments), pid))
            elif action == "report":
                reports = jload(row["reports_json"], [])
                reports.append({
                    "userId": user["id"],
                    "reporterName": user["name"],
                    "reason": str(body.get("reason") or "Flagged for Secretary review"),
                    "createdAt": utc_now_sql(),
                })
                db.execute("UPDATE social_posts SET reports_json = %s WHERE id = %s", (jdump(reports), pid))
                append_audit(user, "SOCIAL_POST_REPORTED", "SocialPost", pid, "Reported post to Society Secretary")
            self._send_json(200, build_bootstrap(user))
            return

        # Create Ticket
        if path == "/api/tickets":
            title = str(body.get("title") or "").strip()
            desc = str(body.get("description") or "").strip()
            if not title or not desc:
                self._send_json(400, {"error": "Title and description are required."})
                return
            priority = str(body.get("priority") or "normal")
            resp_h, res_h = SLA_RULES.get(priority, (24.0, 72.0))
            due_dt = (datetime.now(timezone.utc) + timedelta(hours=res_h)).strftime("%Y-%m-%d %H:%M:%S")
            cnt = db.fetch_one("SELECT COUNT(*) AS c FROM tickets")["c"]
            tid = f"tkt_{int(time.time() * 1000)}"
            tnum = f"TKT-2026-{1045 + int(cnt)}"
            flat_id = user.get("flatId") or "society_common"
            flat_num = user.get("flatNumber") or "Common Area"
            tower = user.get("tower") or "Society Campus"
            history = [{"id": f"th_{int(time.time()*1000)}", "status": "Submitted", "actorName": user["name"], "actorRole": user["roleTitle"], "timestamp": utc_now_iso(), "summary": "Ticket logged in MySQL"}]
            db.execute(
                """INSERT INTO tickets (id, ticket_number, flat_id, flat_number, tower, raised_by_user_id,
                   raised_by_name, category, priority, title, description, location, preferred_contact_time,
                   status, assignee_name, assignee_vendor_id, sla_response_hours, sla_resolution_hours,
                   sla_due_at, sla_breached, created_at, comments_json, internal_notes_json, history_json)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (
                    tid, tnum, flat_id, flat_num, tower, user["id"], user["name"],
                    body.get("category") or "other", priority, title, desc,
                    body.get("location") or f"{tower} · {flat_num}",
                    body.get("preferredContactTime") or "Anytime", "Submitted",
                    "Suresh Nair (Immediate Alert)" if priority == "emergency" else None,
                    None, resp_h, res_h, due_dt, 0, utc_now_sql(), jdump([]), jdump([]), jdump(history),
                ),
            )
            append_audit(user, "TICKET_CREATED", "Ticket", tnum, f"{priority.upper()}: {title}")
            self._send_json(201, build_bootstrap(user))
            return

        # Invoice payment (Idempotent)
        m_pay = re.match(r"^/api/invoices/([^/]+)/pay$", path)
        if m_pay:
            iid = m_pay.group(1)
            if user["role"] in ("security", "vendor"):
                self._send_json(403, {"error": "Financial access denied."})
                return
            inv = db.fetch_one("SELECT * FROM invoices WHERE id = %s", (iid,))
            if not inv:
                self._send_json(404, {"error": "Invoice not found."})
                return
            if not is_finance_manager(user) and inv["flat_id"] != user.get("flatId"):
                self._send_json(403, {"error": "Access denied to another flat's invoice."})
                return
            idem = body.get("idempotencyKey")
            if idem:
                existing_key = db.fetch_one("SELECT receipt_ref FROM idempotency_keys WHERE idem_key = %s", (idem,))
                if existing_key:
                    self._send_json(200, build_bootstrap(user))
                    return
            if inv["status"] == "paid":
                self._send_json(409, {"error": "Invoice already paid."})
                return
            method = str(body.get("paymentMethod") or "UPI")
            ref = f"{method.upper()}-{random.randint(1000000000, 9999999999)}"
            db.execute(
                "UPDATE invoices SET paid_amount = total_amount, status = 'paid', payment_method = %s, payment_ref = %s, paid_at = %s, reconciled = 1 WHERE id = %s",
                (method, ref, utc_now_sql(), iid),
            )
            post_journal_entry(
                user["name"],
                datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                f"Receipt against {inv['invoice_number']} ({method} {ref})",
                "INVOICE_PAYMENT",
                iid,
                [
                    {"accountId": "acc_1100", "accountCode": "1100", "accountName": "Society Bank Account (SBI CHS Current)", "debit": int(inv["total_amount"]), "credit": 0},
                    {"accountId": "acc_1200", "accountCode": "1200", "accountName": "Maintenance Dues Receivable", "debit": 0, "credit": int(inv["total_amount"])},
                ],
            )
            if idem:
                db.execute("INSERT INTO idempotency_keys (idem_key, receipt_ref, created_at) VALUES (%s,%s,%s)", (idem, ref, utc_now_sql()))
            append_audit(user, "INVOICE_PAID", "Invoice", inv["invoice_number"], f"₹{inv['total_amount']} via {method} ({ref})")
            self._send_json(200, build_bootstrap(user))
            return

        m_disp = re.match(r"^/api/invoices/([^/]+)/dispute$", path)
        if m_disp:
            iid = m_disp.group(1)
            inv = db.fetch_one("SELECT * FROM invoices WHERE id = %s", (iid,))
            if not inv or (inv["flat_id"] != user.get("flatId") and not is_finance_manager(user)):
                self._send_json(403, {"error": "Invoice not accessible."})
                return
            reason = str(body.get("reason") or "Line item check requested").strip()
            db.execute("UPDATE invoices SET status = 'disputed', dispute_reason = %s WHERE id = %s", (reason, iid))
            append_audit(user, "INVOICE_DISPUTED", "Invoice", inv["invoice_number"], reason)
            self._send_json(200, build_bootstrap(user))
            return

        if path == "/api/invoices/generate-batch":
            if not is_finance_manager(user):
                self._send_json(403, {"error": "Only Secretary or Treasurer can generate invoices."})
                return
            period = str(body.get("periodLabel") or "December 2026").strip()
            due_date = str(body.get("dueDate") or "2026-12-20")
            rate = float(body.get("ratePerSqFt") or 3.5)
            sinking = int(body.get("sinkingFund") or 750)
            created = 0
            batch_total = 0
            batch_maint = 0
            batch_sinking = 0
            batch_other = 0
            for f in db.fetch_all("SELECT * FROM flats"):
                exists = db.fetch_one("SELECT id FROM invoices WHERE flat_id = %s AND period_label = %s", (f["id"], period))
                if exists:
                    continue
                area_chg = round(int(f["area_sqft"]) * rate)
                park_chg = len(jload(f["parking_slots_json"], [])) * 200
                total = area_chg + sinking + park_chg + 600
                lines = [
                    {"label": f"General Maintenance ({f['area_sqft']} sq.ft @ ₹{rate})", "type": "area", "amount": area_chg},
                    {"label": "Sinking Fund Contribution", "type": "fixed", "amount": sinking},
                    {"label": "Water & STP Charges", "type": "usage", "amount": 600},
                    {"label": f"Covered Parking ({len(jload(f['parking_slots_json'], []))} Slots)", "type": "fixed", "amount": park_chg},
                ]
                db.execute(
                    """INSERT INTO invoices (id, invoice_number, flat_id, flat_number, tower, period_label, billing_cycle,
                       issued_at, due_date, line_items_json, carry_forward, late_fee, total_amount, paid_amount, status, reconciled)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (
                        f"inv_{f['id']}_{int(time.time()*1000)}_{created}",
                        f"INV-2026-{f['flat_number'].replace('-', '')}-{random.randint(100,999)}",
                        f["id"], f["flat_number"], f["tower"], period, "monthly",
                        datetime.now(timezone.utc).strftime("%Y-%m-%d"), due_date, jdump(lines), 0, 0, total, 0, "unpaid", 0,
                    ),
                )
                created += 1
                batch_total += total
                batch_maint += area_chg
                batch_sinking += sinking
                batch_other += park_chg + 600
            if created > 0:
                post_journal_entry(
                    user["name"],
                    datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                    f"{period} Maintenance Billing Batch ({created} Flats)",
                    "INVOICE_BATCH",
                    period,
                    [
                        {"accountId": "acc_1200", "accountCode": "1200", "accountName": "Maintenance Dues Receivable", "debit": batch_total, "credit": 0},
                        {"accountId": "acc_4100", "accountCode": "4100", "accountName": "General Maintenance Income (Mutual)", "debit": 0, "credit": batch_maint},
                        {"accountId": "acc_4200", "accountCode": "4200", "accountName": "Parking & Water Recoveries (Mutual)", "debit": 0, "credit": batch_other},
                        {"accountId": "acc_3100", "accountCode": "3100", "accountName": "Sinking & Structural Reserve Fund", "debit": 0, "credit": batch_sinking},
                    ],
                )
            append_audit(user, "BATCH_INVOICES_GENERATED", "Billing", period, f"Generated {created} invoices")
            self._send_json(200, build_bootstrap(user))
            return

        # Record Vendor Expense with GST + Indian TDS (Sec 194C / 194J / 194I)
        if path == "/api/expenses":
            if not is_finance_manager(user):
                self._send_json(403, {"error": "Only Secretary or Treasurer can record expenses."})
                return
            title = str(body.get("title") or "").strip()
            vendor_name = str(body.get("vendorName") or "").strip()
            amount = int(body.get("amount") or 0)
            if not title or not vendor_name or amount <= 0:
                self._send_json(400, {"error": "Title, vendor name, and positive amount are required."})
                return
            tds_section = str(body.get("tdsSection") or "NONE").upper()
            tds_rate = TDS_RATES.get(tds_section, 0.0)
            tds_amount = round(amount * tds_rate / 100.0)
            gst_amount = int(body.get("gstAmount") or 0)
            net_payable = amount - tds_amount
            category = str(body.get("category") or "repairs")
            eid = f"exp_{int(time.time()*1000)}"
            exp_date = str(body.get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d"))
            db.execute(
                """INSERT INTO expenses (id, title, category, vendor_name, vendor_pan, budget_head, amount, gst_amount,
                   tds_section, tds_rate_pct, tds_amount, net_payable, invoice_ref, expense_date, status, approved_by)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (
                    eid, title, category, vendor_name,
                    str(body.get("vendorPan") or "").upper() or None,
                    str(body.get("budgetHead") or "Repairs & AMC"),
                    amount, gst_amount, tds_section, tds_rate, tds_amount, net_payable,
                    str(body.get("invoiceRef") or f"VND-{random.randint(1000,9999)}"),
                    exp_date, "pending_approval", None,
                ),
            )
            exp_acc = ("acc_5100", "5100", "Common Area Utilities & Electricity") if category == "utilities" else ("acc_5200", "5200", "Statutory Safety, Lift & AMC Repairs")
            lines = [
                {"accountId": exp_acc[0], "accountCode": exp_acc[1], "accountName": exp_acc[2], "debit": amount, "credit": 0},
                {"accountId": "acc_2200", "accountCode": "2200", "accountName": "Vendor Bills Payable", "debit": 0, "credit": net_payable},
            ]
            if tds_amount > 0:
                lines.append({"accountId": "acc_2100", "accountCode": "2100", "accountName": "TDS Payable (Income Tax Sec 194C/J/I)", "debit": 0, "credit": tds_amount})
            post_journal_entry(user["name"], exp_date, f"{title} — {vendor_name} ({tds_section})", "EXPENSE_BILL", eid, lines)
            append_audit(user, "EXPENSE_RECORDED", "Expense", eid, f"{title} ₹{amount} (TDS ₹{tds_amount})")
            self._send_json(201, build_bootstrap(user))
            return

        m_exp = re.match(r"^/api/expenses/([^/]+)/approve$", path)
        if m_exp:
            if not is_finance_manager(user):
                self._send_json(403, {"error": "Only Secretary or Treasurer can approve expenses."})
                return
            eid = m_exp.group(1)
            db.execute("UPDATE expenses SET status = 'approved', approved_by = %s WHERE id = %s", (user["name"], eid))
            append_audit(user, "EXPENSE_APPROVED", "Expense", eid, f"Approved by {user['name']}")
            self._send_json(200, build_bootstrap(user))
            return

        # Post Manual or Reversing Double-Entry Journal Entry
        if path == "/api/ledger/journal":
            if not is_finance_manager(user):
                self._send_json(403, {"error": "Only Secretary or Treasurer can post ledger entries."})
                return
            reverses_id = body.get("reversesId")
            if reverses_id:
                orig = db.fetch_one("SELECT * FROM journal_entries WHERE id = %s", (reverses_id,))
                if not orig:
                    self._send_json(404, {"error": "Original journal entry not found."})
                    return
                rev_lines = [
                    {
                        "accountId": l["accountId"],
                        "accountCode": l["accountCode"],
                        "accountName": l["accountName"],
                        "debit": int(l.get("credit") or 0),
                        "credit": int(l.get("debit") or 0),
                    }
                    for l in jload(orig["lines_json"], [])
                ]
                je_id = post_journal_entry(
                    user["name"],
                    datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                    f"REVERSAL of {orig['id']}: {orig['narration']}",
                    "REVERSAL",
                    orig["id"],
                    rev_lines,
                    reverses_id=orig["id"],
                )
                append_audit(user, "JOURNAL_REVERSED", "JournalEntry", je_id, f"Reversed {reverses_id}")
                self._send_json(201, build_bootstrap(user))
                return

            narration = str(body.get("narration") or "").strip()
            debit_acc_id = body.get("debitAccountId")
            credit_acc_id = body.get("creditAccountId")
            amount = int(body.get("amount") or 0)
            if not narration or not debit_acc_id or not credit_acc_id or amount <= 0 or debit_acc_id == credit_acc_id:
                self._send_json(400, {"error": "Select distinct debit/credit accounts, narration, and positive amount."})
                return
            d_acc = db.fetch_one("SELECT * FROM gl_accounts WHERE id = %s", (debit_acc_id,))
            c_acc = db.fetch_one("SELECT * FROM gl_accounts WHERE id = %s", (credit_acc_id,))
            if not d_acc or not c_acc:
                self._send_json(404, {"error": "GL account not found."})
                return
            je_id = post_journal_entry(
                user["name"],
                str(body.get("entryDate") or datetime.now(timezone.utc).strftime("%Y-%m-%d")),
                narration,
                "MANUAL_JOURNAL",
                None,
                [
                    {"accountId": d_acc["id"], "accountCode": d_acc["code"], "accountName": d_acc["name"], "debit": amount, "credit": 0},
                    {"accountId": c_acc["id"], "accountCode": c_acc["code"], "accountName": c_acc["name"], "debit": 0, "credit": amount},
                ],
            )
            append_audit(user, "JOURNAL_POSTED", "JournalEntry", je_id, f"{narration} (₹{amount})")
            self._send_json(201, build_bootstrap(user))
            return

        # Service Campaigns
        if path == "/api/campaigns":
            if not is_secretary(user) and not is_ticket_manager(user):
                self._send_json(403, {"error": "Secretary or Facility permission required."})
                return
            base = int(body.get("basePrice") or 1200)
            tiers = [{"minFlats": mf, "discountPct": dp, "unitPrice": round(base * (1 - dp / 100))} for mf, dp in STANDARD_TIERS]
            cid = f"cmp_{int(time.time()*1000)}"
            db.execute(
                """INSERT INTO service_campaigns (id, name, category_group, vendor_id, vendor_name, base_price,
                   scope, inclusions_json, exclusions_json, tax_material_policy, available_dates_json,
                   slot_capacity_per_day, min_confirmed_flats, tiers_json, opt_in_deadline, cancellation_policy,
                   fallback_policy, status, confirmed_count, active_discount_pct, current_unit_price, subscriptions_json)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (
                    cid, str(body.get("name") or "New Campaign").strip(), body.get("categoryGroup") or "Home maintenance",
                    "vnd_coolair", str(body.get("vendorName") or "Verified Vendor").strip(), base,
                    str(body.get("scope") or "Standard scope"), jdump(["Verified technician"]), jdump(["Spare hardware"]),
                    "Inclusive of GST", jdump(["2026-12-05", "2026-12-06"]), 30, int(body.get("minConfirmedFlats") or 25),
                    jdump(tiers), str(body.get("optInDeadline") or "2026-11-30"),
                    "Free cancellation 24h prior.", "Refunded if minimum count not reached.",
                    "open", 0, 0, base, jdump([]),
                ),
            )
            append_audit(user, "CAMPAIGN_CREATED", "ServiceCampaign", cid, f"Created {body.get('name')}")
            self._send_json(201, build_bootstrap(user))
            return

        m_opt = re.match(r"^/api/campaigns/([^/]+)/opt-in$", path)
        if m_opt:
            cid = m_opt.group(1)
            if not user.get("flatId"):
                self._send_json(403, {"error": "Verified flat link required."})
                return
            c = db.fetch_one("SELECT * FROM service_campaigns WHERE id = %s", (cid,))
            if not c:
                self._send_json(404, {"error": "Campaign not found."})
                return
            subs = jload(c["subscriptions_json"], [])
            if any(s["flatId"] == user["flatId"] and s["status"] != "cancelled" for s in subs):
                self._send_json(409, {"error": "Your flat already joined this campaign."})
                return
            subs.append({
                "id": f"sub_{int(time.time()*1000)}", "campaignId": cid, "flatId": user["flatId"],
                "flatNumber": user["flatNumber"], "tower": user["tower"], "residentName": user["name"],
                "preferredDate": body.get("preferredDate") or "2026-12-01",
                "preferredSlot": body.get("preferredSlot") or "10:00 AM – 12:00 PM",
                "cadence": body.get("cadence") or "one_time", "status": "active",
                "consentTimestamp": utc_now_iso(), "lockedUnitPrice": None, "rating": None,
            })
            new_count = int(c["confirmed_count"]) + 1
            tiers = jload(c["tiers_json"], [])
            disc, unit_p = compute_campaign_pricing(int(c["base_price"]), new_count, tiers)
            status = "threshold_met" if new_count >= int(c["min_confirmed_flats"]) and c["status"] == "open" else c["status"]
            db.execute(
                "UPDATE service_campaigns SET subscriptions_json = %s, confirmed_count = %s, active_discount_pct = %s, current_unit_price = %s, status = %s WHERE id = %s",
                (jdump(subs), new_count, disc, unit_p, status, cid),
            )
            append_audit(user, "SERVICE_CAMPAIGN_OPT_IN", "ServiceCampaign", cid, f"{user['flatNumber']} joined ({new_count} flats)")
            self._send_json(200, build_bootstrap(user))
            return

        # Votes
        if path == "/api/votes":
            if not is_secretary(user):
                self._send_json(403, {"error": "Only the Society Secretary can publish votes or polls."})
                return
            opts = [{"id": f"opt_{int(time.time()*1000)}_{i}", "label": o.strip()} for i, o in enumerate(body.get("options") or ["Yes", "No"]) if o.strip()]
            tallies = {o["id"]: 0 for o in opts}
            vid = f"vote_{int(time.time()*1000)}"
            scope = body.get("eligibleScope") or "all_residents"
            vtype = body.get("voteType") or "informal_poll"
            db.execute(
                """INSERT INTO votes (id, title, description, vote_type, legal_notice, ballot_mode, selection_mode,
                   eligible_scope, eligible_count, quorum_pct, opens_at, closes_at, status, supporting_doc_title,
                   options_json, voted_flat_ids_json, tallies_json, attributable_records_json)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (
                    vid, str(body.get("title") or "").strip(), str(body.get("description") or "").strip(), vtype,
                    "Formal Resolution — verified flat owners only." if vtype == "formal_resolution" else "Informal Resident Poll.",
                    body.get("ballotMode") or "secret", "single", scope,
                    420 if scope == "all_verified_owners" else 480, int(body.get("quorumPct") or 25),
                    datetime.now(timezone.utc).strftime("%Y-%m-%d"), str(body.get("closesAt") or "2026-12-05"),
                    "open", "Secretary Explanatory Note", jdump(opts), jdump([]), jdump(tallies), jdump([]),
                ),
            )
            append_audit(user, "VOTE_CREATED", "VoteProposal", vid, str(body.get("title")))
            self._send_json(201, build_bootstrap(user))
            return

        m_cast = re.match(r"^/api/votes/([^/]+)/cast$", path)
        if m_cast:
            vid = m_cast.group(1)
            v = db.fetch_one("SELECT * FROM votes WHERE id = %s", (vid,))
            if not v or v["status"] != "open":
                self._send_json(400, {"error": "Vote not open."})
                return
            if not user.get("flatId") or not user["permissions"]["canVote"]:
                self._send_json(403, {"error": "Voting permission restricted by Secretary or flat verification."})
                return
            if v["eligible_scope"] == "all_verified_owners" and user["role"] == "tenant":
                self._send_json(403, {"error": "Formal resolutions are restricted to verified flat owners."})
                return
            voted_ids = jload(v["voted_flat_ids_json"], [])
            if user["flatId"] in voted_ids:
                self._send_json(409, {"error": "Your flat has already voted."})
                return
            opt_ids = body.get("optionIds") or []
            if not opt_ids:
                self._send_json(400, {"error": "Select an option."})
                return
            voted_ids.append(user["flatId"])
            tallies = jload(v["tallies_json"], {})
            for oid in opt_ids:
                if oid in tallies:
                    tallies[oid] += 1
            attrs = jload(v["attributable_records_json"], [])
            if v["ballot_mode"] == "attributable":
                attrs.append({"flatNumber": user["flatNumber"], "voterName": user["name"], "optionIds": opt_ids, "timestamp": utc_now_iso()})
            db.execute(
                "UPDATE votes SET voted_flat_ids_json = %s, tallies_json = %s, attributable_records_json = %s WHERE id = %s",
                (jdump(voted_ids), jdump(tallies), jdump(attrs), vid),
            )
            append_audit(user, "VOTE_CAST", "VoteProposal", vid, f"Flat {user['flatNumber']} voted ({v['ballot_mode']})")
            self._send_json(200, build_bootstrap(user))
            return

        # Amenities Book & Cancel
        if path == "/api/amenities/book":
            if not user.get("flatId"):
                self._send_json(403, {"error": "Verified flat required."})
                return
            aid = body.get("amenityId")
            bdate = body.get("date")
            slot = body.get("slot")
            guests = max(1, int(body.get("guests") or 1))
            amn = db.fetch_one("SELECT * FROM amenities WHERE id = %s", (aid,))
            if not amn:
                self._send_json(404, {"error": "Amenity not found."})
                return
            active = db.fetch_all(
                "SELECT guests FROM amenity_bookings WHERE amenity_id = %s AND booking_date = %s AND slot = %s AND status = 'confirmed'",
                (aid, bdate, slot),
            )
            if aid == "amn_clubhouse" and len(active) > 0:
                self._send_json(409, {"error": "Clubhouse is already booked for this slot."})
                return
            used = sum(int(x["guests"]) for x in active)
            if used + guests > int(amn["capacity"]):
                self._send_json(409, {"error": f"Capacity exceeded ({int(amn['capacity']) - used} spots left)."})
                return
            bid = f"bkg_{int(time.time()*1000)}"
            db.execute(
                """INSERT INTO amenity_bookings (id, amenity_id, amenity_name, flat_id, flat_number, resident_name,
                   booking_date, slot, guests, fee_paid, deposit_held, status, created_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (bid, aid, amn["name"], user["flatId"], user["flatNumber"], user["name"], bdate, slot, guests, amn["fee"], amn["deposit"], "confirmed", utc_now_sql()),
            )
            append_audit(user, "AMENITY_BOOKED", "AmenityBooking", bid, f"{amn['name']} on {bdate}")
            self._send_json(201, build_bootstrap(user))
            return

        m_bkg_c = re.match(r"^/api/amenities/bookings/([^/]+)/cancel$", path)
        if m_bkg_c:
            bid = m_bkg_c.group(1)
            b = db.fetch_one("SELECT * FROM amenity_bookings WHERE id = %s", (bid,))
            if not b or (b["flat_id"] != user.get("flatId") and not is_secretary(user)):
                self._send_json(403, {"error": "Booking not accessible."})
                return
            tot = int(b["fee_paid"]) + int(b["deposit_held"])
            ref_msg = f"₹{tot} refund initiated" if tot > 0 else "No fee charged"
            db.execute("UPDATE amenity_bookings SET status = 'cancelled', refund_status = %s WHERE id = %s", (ref_msg, bid))
            append_audit(user, "AMENITY_CANCELLED", "AmenityBooking", bid, b["amenity_name"])
            self._send_json(200, build_bootstrap(user))
            return

        m_rsvp = re.match(r"^/api/events/([^/]+)/rsvp$", path)
        if m_rsvp:
            eid = m_rsvp.group(1)
            ev = db.fetch_one("SELECT * FROM society_events WHERE id = %s", (eid,))
            if not ev or not user.get("flatNumber"):
                self._send_json(400, {"error": "Event or flat unavailable."})
                return
            regs = jload(ev["registrations_json"], [])
            existing = next((r for r in regs if r["flatNumber"] == user["flatNumber"]), None)
            if existing:
                existing["guests"] = int(body.get("guests") or 1)
                if body.get("volunteerRole") is not None:
                    existing["volunteerRole"] = body.get("volunteerRole")
            else:
                regs.append({
                    "flatNumber": user["flatNumber"], "residentName": user["name"],
                    "guests": int(body.get("guests") or 1), "volunteerRole": body.get("volunteerRole") or None,
                })
            db.execute("UPDATE society_events SET registrations_json = %s WHERE id = %s", (jdump(regs), eid))
            self._send_json(200, build_bootstrap(user))
            return

        # Notices
        if path == "/api/notices":
            if not (is_secretary(user) or is_ticket_manager(user)):
                self._send_json(403, {"error": "Only Secretary or Facility Manager can publish notices."})
                return
            nid = f"ntc_{int(time.time()*1000)}"
            db.execute(
                """INSERT INTO notices (id, title, body, category, target_audience, author_name, author_role, published_at, acknowledged_by_json)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (nid, str(body.get("title") or "").strip(), str(body.get("body") or "").strip(),
                 body.get("category") or "official_circular", body.get("targetAudience") or "All Residents",
                 user["name"], user["roleTitle"], utc_now_sql(), jdump([])),
            )
            append_audit(user, "NOTICE_PUBLISHED", "Notice", nid, str(body.get("title")))
            self._send_json(201, build_bootstrap(user))
            return

        m_ack = re.match(r"^/api/notices/([^/]+)/acknowledge$", path)
        if m_ack:
            nid = m_ack.group(1)
            n = db.fetch_one("SELECT * FROM notices WHERE id = %s", (nid,))
            if n and user.get("flatId"):
                acks = jload(n["acknowledged_by_json"], [])
                if user["flatId"] not in acks:
                    acks.append(user["flatId"])
                    db.execute("UPDATE notices SET acknowledged_by_json = %s WHERE id = %s", (jdump(acks), nid))
            self._send_json(200, build_bootstrap(user))
            return

        # Visitors (Pre-approved / Walk-In / QR Redeem)
        if path == "/api/visitors":
            target_flat = (
                db.fetch_one("SELECT * FROM flats WHERE flat_number = %s", (body.get("flatNumber"),))
                if (user["role"] == "security" or is_secretary(user))
                else db.fetch_one("SELECT * FROM flats WHERE id = %s", (user.get("flatId"),))
            )
            if not target_flat:
                target_flat = db.fetch_one("SELECT * FROM flats LIMIT 1")
            vid = f"vis_{int(time.time()*1000)}"
            code = str(random.randint(100000, 999999))
            is_walkin = bool(body.get("isWalkIn"))
            if is_walkin:
                st = "pending_approval"
            elif user["role"] == "security":
                st = "checked_in"
            else:
                st = "pre_approved"
            veh = (str(body.get("vehicleNo") or "").strip().upper()) or None
            db.execute(
                """INSERT INTO visitors (id, pass_code, flat_id, flat_number, visitor_name, visitor_type, phone,
                   vehicle_no, expected_date, status, checked_in_at, logged_by)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (vid, code, target_flat["id"], target_flat["flat_number"], str(body.get("visitorName") or "").strip(),
                 body.get("visitorType") or "guest", str(body.get("phone") or "Verified"), veh,
                 str(body.get("expectedDate") or datetime.now(timezone.utc).strftime("%Y-%m-%d")), st,
                 utc_now_sql() if st == "checked_in" else None, user["name"]),
            )
            if st == "checked_in" and veh:
                assign_visitor_parking(vid, veh)
            append_audit(user, "VISITOR_PASS_CREATED", "VisitorPass", code, f"{body.get('visitorName')} -> {target_flat['flat_number']} ({st})")
            self._send_json(201, build_bootstrap(user))
            return

        if path == "/api/visitors/redeem":
            if user["role"] != "security" and not is_secretary(user):
                self._send_json(403, {"error": "Gate Security or Secretary required to redeem passes."})
                return
            code = str(body.get("passCode") or "").strip()
            v = db.fetch_one("SELECT * FROM visitors WHERE pass_code = %s", (code,))
            if not v:
                self._send_json(404, {"error": f"No visitor pass found for code #{code}."})
                return
            if v["status"] == "denied":
                self._send_json(403, {"error": "This visitor pass was denied by the resident."})
                return
            if v["status"] == "checked_out":
                self._send_json(409, {"error": "Pass has already been checked out."})
                return
            db.execute("UPDATE visitors SET status = 'checked_in', checked_in_at = %s WHERE id = %s", (utc_now_sql(), v["id"]))
            slot_assigned = assign_visitor_parking(v["id"], v.get("vehicle_no"))
            append_audit(user, "VISITOR_QR_REDEEMED", "VisitorPass", code, f"Checked in {v['visitor_name']} (Parking: {slot_assigned or 'None'})")
            self._send_json(200, build_bootstrap(user))
            return

        # House Help Registry, Attendance, Assignment & Reviews
        if path == "/api/house-help":
            if not (is_secretary(user) or is_ticket_manager(user) or user["role"] == "security"):
                self._send_json(403, {"error": "Management or Security access required to register staff."})
                return
            name = str(body.get("name") or "").strip()
            phone = str(body.get("phone") or "").strip()
            if not name or not phone:
                self._send_json(400, {"error": "Staff name and phone are required."})
                return
            hid = f"hh_{int(time.time()*1000)}"
            badge = f"HH-2026-{random.randint(200, 999)}"
            flats = body.get("assignedFlats") or ([user["flatNumber"]] if user.get("flatNumber") else ["A-402"])
            db.execute(
                """INSERT INTO house_helps (id, name, phone, help_type, id_proof_type, id_proof_number,
                   id_verified, background_check, incident_count, badge_code, assigned_flats_json, reviews_json, current_status)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (
                    hid, name, phone, str(body.get("helpType") or "maid"),
                    str(body.get("idProofType") or "Aadhaar"), str(body.get("idProofNumber") or "Pending"),
                    1 if is_secretary(user) else 0, "cleared" if is_secretary(user) else "pending",
                    0, badge, jdump(flats), jdump([]), "outside",
                ),
            )
            append_audit(user, "HOUSE_HELP_REGISTERED", "HouseHelp", badge, f"Registered {name} ({body.get('helpType') or 'maid'})")
            self._send_json(201, build_bootstrap(user))
            return

        m_hh = re.match(r"^/api/house-help/([^/]+)/(attendance|review|assign)$", path)
        if m_hh:
            hid, act = m_hh.group(1), m_hh.group(2)
            h = db.fetch_one("SELECT * FROM house_helps WHERE id = %s", (hid,))
            if not h:
                self._send_json(404, {"error": "Domestic help profile not found."})
                return
            if act == "attendance":
                if user["role"] != "security" and not is_secretary(user):
                    self._send_json(403, {"error": "Guard or Secretary access required for gate attendance."})
                    return
                direction = body.get("direction") or ("out" if h["current_status"] == "inside" else "in")
                if direction == "in":
                    db.execute("UPDATE house_helps SET current_status = 'inside', last_check_in_at = %s WHERE id = %s", (utc_now_sql(), hid))
                    db.execute(
                        "INSERT INTO house_help_logs (id, house_help_id, house_help_name, flat_number, guard_name, check_in_at) VALUES (%s,%s,%s,%s,%s,%s)",
                        (f"hhl_{int(time.time()*1000)}", hid, h["name"], ", ".join(jload(h["assigned_flats_json"], [])[:2]) or "Campus", user["name"], utc_now_sql()),
                    )
                else:
                    db.execute("UPDATE house_helps SET current_status = 'outside', last_check_out_at = %s WHERE id = %s", (utc_now_sql(), hid))
                    open_log = db.fetch_one("SELECT id FROM house_help_logs WHERE house_help_id = %s AND check_out_at IS NULL ORDER BY check_in_at DESC LIMIT 1", (hid,))
                    if open_log:
                        db.execute("UPDATE house_help_logs SET check_out_at = %s WHERE id = %s", (utc_now_sql(), open_log["id"]))
                append_audit(user, f"HOUSE_HELP_CHECK_{direction.upper()}", "HouseHelp", h["badge_code"], f"{h['name']} marked {direction}")
            elif act == "review":
                rating = max(1, min(5, int(body.get("rating") or 5)))
                comment = str(body.get("comment") or "").strip()
                revs = jload(h["reviews_json"], [])
                revs.append({
                    "id": f"rev_{int(time.time()*1000)}",
                    "rating": rating,
                    "comment": comment or "Verified resident feedback.",
                    "createdAt": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                })
                db.execute("UPDATE house_helps SET reviews_json = %s WHERE id = %s", (jdump(revs), hid))
            elif act == "assign":
                flat_num = str(body.get("flatNumber") or user.get("flatNumber") or "").strip().upper()
                if not flat_num:
                    self._send_json(400, {"error": "Flat number required."})
                    return
                assigned = jload(h["assigned_flats_json"], [])
                if flat_num in assigned:
                    assigned = [f for f in assigned if f != flat_num]
                else:
                    assigned.append(flat_num)
                db.execute("UPDATE house_helps SET assigned_flats_json = %s WHERE id = %s", (jdump(assigned), hid))
            self._send_json(200, build_bootstrap(user))
            return

        # Parcels & Courier Custody Locker
        if path == "/api/parcels":
            if user["role"] != "security" and not is_secretary(user):
                self._send_json(403, {"error": "Guard or Secretary access required to log gate parcels."})
                return
            flat_num = str(body.get("flatNumber") or "A-402").strip().upper()
            f = db.fetch_one("SELECT * FROM flats WHERE flat_number = %s", (flat_num,)) or db.fetch_one("SELECT * FROM flats LIMIT 1")
            pid = f"prc_{int(time.time()*1000)}"
            otp = str(random.randint(1000, 9999))
            db.execute(
                """INSERT INTO parcels (id, flat_id, flat_number, courier_name, tracking_note, shelf_location,
                   pickup_otp, status, logged_by, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (
                    pid, f["id"], f["flat_number"],
                    str(body.get("courierName") or "Courier").strip(),
                    str(body.get("trackingNote") or "Standard package").strip(),
                    str(body.get("shelfLocation") or "Shelf A-2").strip(),
                    otp, "at_gate", user["name"], utc_now_sql(),
                ),
            )
            append_audit(user, "PARCEL_LOGGED", "Parcel", pid, f"{body.get('courierName')} for {f['flat_number']}")
            self._send_json(201, build_bootstrap(user))
            return

        m_prc = re.match(r"^/api/parcels/([^/]+)/collect$", path)
        if m_prc:
            pid = m_prc.group(1)
            p = db.fetch_one("SELECT * FROM parcels WHERE id = %s", (pid,))
            if not p:
                self._send_json(404, {"error": "Parcel not found."})
                return
            otp = str(body.get("pickupOtp") or "").strip()
            if not is_secretary(user) and otp != p["pickup_otp"] and p["flat_id"] != user.get("flatId"):
                self._send_json(400, {"error": "Invalid 4-digit resident pickup OTP."})
                return
            if user["role"] == "security" and otp != p["pickup_otp"]:
                self._send_json(400, {"error": "Enter the resident's 4-digit pickup OTP to release parcel."})
                return
            db.execute("UPDATE parcels SET status = 'collected', collected_at = %s WHERE id = %s", (utc_now_sql(), pid))
            append_audit(user, "PARCEL_COLLECTED", "Parcel", pid, f"Collected for {p['flat_number']}")
            self._send_json(200, build_bootstrap(user))
            return

        # Guard Shift Clock-In / Clock-Out
        if path == "/api/guard/shift":
            if user["role"] != "security" and not is_secretary(user):
                self._send_json(403, {"error": "Security or Secretary access required."})
                return
            action = body.get("action") or "clock_in"
            if action == "clock_out":
                active = db.fetch_one("SELECT * FROM guard_shifts WHERE status = 'on_duty' ORDER BY clock_in_at DESC LIMIT 1")
                if active:
                    db.execute(
                        "UPDATE guard_shifts SET status = 'completed', clock_out_at = %s, handover_note = %s WHERE id = %s",
                        (utc_now_sql(), str(body.get("handoverNote") or "Gate handover complete."), active["id"]),
                    )
                    append_audit(user, "GUARD_CLOCK_OUT", "GuardShift", active["id"], "Completed shift handover")
            else:
                sid = f"shf_{int(time.time()*1000)}"
                db.execute(
                    """INSERT INTO guard_shifts (id, guard_user_id, guard_name, device_id, clock_in_at, clock_in_gps, handover_note, status)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (sid, user["id"], user["name"], str(body.get("deviceId") or "GATE-TAB-01"), utc_now_sql(),
                     str(body.get("gps") or "18.5204° N, 73.8567° E"), str(body.get("handoverNote") or "Duty started"), "on_duty"),
                )
                append_audit(user, "GUARD_CLOCK_IN", "GuardShift", sid, f"Bound to {body.get('deviceId') or 'GATE-TAB-01'}")
            self._send_json(200, build_bootstrap(user))
            return

        # Vehicle Wrong-Parking Obstruction Alert
        if path == "/api/vehicles/alert":
            if user["role"] != "security" and not is_secretary(user) and not is_ticket_manager(user):
                self._send_json(403, {"error": "Security or Management access required."})
                return
            reg = str(body.get("vehicleNo") or "").strip().upper()
            location = str(body.get("location") or "Main Driveway / Fire Lane").strip()
            nid = f"ntc_{int(time.time()*1000)}"
            db.execute(
                """INSERT INTO notices (id, title, body, category, target_audience, author_name, author_role, published_at, acknowledged_by_json)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (nid, f"Parking Obstruction Alert: Vehicle {reg or 'Unknown'}",
                 f"Vehicle {reg or 'reported at gate'} is obstructing {location}. Please relocate immediately to avoid wheel-clamping per society bye-laws.",
                 "emergency_alert", "All Vehicle Owners", user["name"], user["roleTitle"], utc_now_sql(), jdump([])),
            )
            append_audit(user, "VEHICLE_PARKING_ALERT", "Vehicle", reg or "UNKNOWN", f"Obstruction at {location}")
            self._send_json(201, build_bootstrap(user))
            return

        # Emergency SOS Panic Trigger
        if path == "/api/sos":
            sid = f"sos_{int(time.time()*1000)}"
            atype = str(body.get("alertType") or "security")
            msg = str(body.get("message") or f"Immediate {atype} assistance requested!").strip()
            db.execute(
                """INSERT INTO sos_alerts (id, user_id, user_name, flat_number, tower, alert_type, message, status, created_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (sid, user["id"], user["name"], user.get("flatNumber") or "Campus", user.get("tower") or "Gate", atype, msg, "active", utc_now_sql()),
            )
            append_audit(user, "SOS_PANIC_TRIGGERED", "SosAlert", sid, f"{atype.upper()} from {user.get('flatNumber') or user['name']}")
            self._send_json(201, build_bootstrap(user))
            return

        if path == "/api/flats/my/update":
            f = db.fetch_one("SELECT * FROM flats WHERE id = %s", (user.get("flatId"),))
            if not f:
                self._send_json(403, {"error": "No flat linked."})
                return
            kind = body.get("kind")
            pl = body.get("payload") or {}
            if kind == "family":
                fam = jload(f["family_members_json"], [])
                fam.append({"id": f"fam_{int(time.time()*1000)}", "name": pl.get("name"), "relation": pl.get("relation") or "Family", "phone": pl.get("phone") or "", "accessLevel": "limited"})
                db.execute("UPDATE flats SET family_members_json = %s WHERE id = %s", (jdump(fam), f["id"]))
            elif kind == "vehicle":
                vehs = jload(f["vehicles_json"], [])
                vehs.append({"id": f"veh_{int(time.time()*1000)}", "registrationNo": str(pl.get("registrationNo") or "").upper(), "type": pl.get("type") or "4-wheeler", "parkingSlot": jload(f["parking_slots_json"], ["Bay"])[0], "stickerId": f"AC-2026-{random.randint(100,999)}"})
                db.execute("UPDATE flats SET vehicles_json = %s WHERE id = %s", (jdump(vehs), f["id"]))
            elif kind == "move_request":
                movs = jload(f["move_requests_json"], [])
                movs.append({"id": f"mov_{int(time.time()*1000)}", "type": pl.get("type") or "move_out", "requestedDate": pl.get("requestedDate"), "nocStatus": "pending_review", "depositAmount": 15000, "notes": "Online NOC requested."})
                db.execute("UPDATE flats SET move_requests_json = %s WHERE id = %s", (jdump(movs), f["id"]))
            self._send_json(200, build_bootstrap(user))
            return

        m_ast = re.match(r"^/api/assets/([^/]+)/service$", path)
        if m_ast:
            if not is_ticket_manager(user):
                self._send_json(403, {"error": "Facility or Secretary access required."})
                return
            aid = m_ast.group(1)
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            nxt = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")
            db.execute("UPDATE assets SET last_service_date = %s, next_service_date = %s, condition_status = 'optimal' WHERE id = %s", (today, nxt, aid))
            append_audit(user, "ASSET_PM_LOGGED", "SocietyAsset", aid, "Completed preventive inspection")
            self._send_json(200, build_bootstrap(user))
            return

        self._send_json(404, {"error": "Endpoint not found."})

    def do_PATCH(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        body = self._read_json_body()
        user = self._resolve_user()
        if not user or not user["isActive"]:
            self._send_json(403, {"error": "Account suspended."})
            return

        # Secretary manages sub-accounts
        m_acc = re.match(r"^/api/secretary/accounts/([^/]+)$", path)
        if m_acc:
            if not is_secretary(user):
                self._send_json(403, {"error": "Only the Society Secretary can manage user accounts."})
                return
            uid = m_acc.group(1)
            if uid == "usr_secretary":
                self._send_json(400, {"error": "Root Secretary account cannot be downgraded."})
                return
            target = db.fetch_one("SELECT * FROM users WHERE id = %s", (uid,))
            if not target:
                self._send_json(404, {"error": "Account not found."})
                return
            perms = body.get("permissions") or {}
            is_active = 1 if body.get("isActive", bool(target["is_active"])) else 0
            new_role = body.get("role") or target["role"]
            if new_role == "secretary":
                new_role = target["role"]
            db.execute(
                """UPDATE users SET role = %s, is_active = %s, can_create_posts = %s, can_moderate_posts = %s,
                   can_manage_tickets = %s, can_manage_billing = %s, can_vote = %s WHERE id = %s""",
                (
                    new_role, is_active,
                    1 if perms.get("canCreatePosts", bool(target["can_create_posts"])) else 0,
                    1 if perms.get("canModeratePosts", bool(target["can_moderate_posts"])) else 0,
                    1 if perms.get("canManageTickets", bool(target["can_manage_tickets"])) else 0,
                    1 if perms.get("canManageBilling", bool(target["can_manage_billing"])) else 0,
                    1 if perms.get("canVote", bool(target["can_vote"])) else 0,
                    uid,
                ),
            )
            if body.get("newPin"):
                db.execute("UPDATE users SET pin_hash = %s WHERE id = %s", (hash_pin(str(body["newPin"])), uid))
            append_audit(user, "SUBACCOUNT_UPDATED", "User", uid, f"Secretary updated {target['name']} (active={bool(is_active)}, role={new_role})")
            self._send_json(200, build_bootstrap(user))
            return

        # Moderate social post (Secretary or moderator or author deleting)
        m_mod = re.match(r"^/api/social/posts/([^/]+)/moderate$", path)
        if m_mod:
            pid = m_mod.group(1)
            row = db.fetch_one("SELECT * FROM social_posts WHERE id = %s", (pid,))
            if not row:
                self._send_json(404, {"error": "Post not found."})
                return
            action = body.get("action")
            is_author = row["author_user_id"] == user["id"]
            if action == "delete" and (is_author or is_post_moderator(user)):
                db.execute("DELETE FROM social_posts WHERE id = %s", (pid,))
                append_audit(user, "SOCIAL_POST_DELETED", "SocialPost", pid, f"Deleted post by {row['author_name']}")
                self._send_json(200, build_bootstrap(user))
                return
            if not is_post_moderator(user):
                self._send_json(403, {"error": "Secretary moderation authority required."})
                return
            if action == "pin":
                db.execute("UPDATE social_posts SET is_pinned = 1, moderation_note = %s WHERE id = %s", ("Pinned by Secretary", pid))
            elif action == "unpin":
                db.execute("UPDATE social_posts SET is_pinned = 0, moderation_note = NULL WHERE id = %s", (pid,))
            elif action == "hide":
                db.execute("UPDATE social_posts SET is_hidden = 1, moderation_note = %s WHERE id = %s", (body.get("note") or "Hidden by Secretary", pid))
            elif action == "unhide":
                db.execute("UPDATE social_posts SET is_hidden = 0, moderation_note = NULL WHERE id = %s", (pid,))
            append_audit(user, f"SOCIAL_POST_{str(action).upper()}", "SocialPost", pid, f"Moderated post by {row['author_name']}")
            self._send_json(200, build_bootstrap(user))
            return

        if path == "/api/profile/preferences":
            lang = body.get("preferredLang") or user["preferredLang"]
            mkt = 1 if body.get("consentMarketing", user["consentMarketing"]) else 0
            dir_c = 1 if body.get("consentDirectory", user["consentDirectory"]) else 0
            db.execute("UPDATE users SET preferred_lang = %s, consent_marketing = %s, consent_directory = %s WHERE id = %s", (lang, mkt, dir_c, user["id"]))
            self._send_json(200, build_bootstrap(self._resolve_user()))
            return

        # Ticket updates
        m_tkt = re.match(r"^/api/tickets/([^/]+)$", path)
        if m_tkt:
            tid = m_tkt.group(1)
            t = db.fetch_one("SELECT * FROM tickets WHERE id = %s", (tid,))
            if not t:
                self._send_json(404, {"error": "Ticket not found."})
                return
            if not is_ticket_manager(user) and user["role"] not in ("vendor", "security") and t["flat_id"] != user.get("flatId"):
                self._send_json(403, {"error": "Access denied to another flat's ticket."})
                return
            action = body.get("action")
            comments = jload(t["comments_json"], [])
            internal = jload(t["internal_notes_json"], [])
            history = jload(t["history_json"], [])

            if action == "comment" and str(body.get("comment") or "").strip():
                comments.append({"id": f"tc_{int(time.time()*1000)}", "authorName": user["name"], "authorRole": user["roleTitle"], "message": str(body["comment"]).strip(), "createdAt": utc_now_iso()})
                db.execute("UPDATE tickets SET comments_json = %s WHERE id = %s", (jdump(comments), tid))
            elif action == "internal_note" and str(body.get("internalNote") or "").strip():
                if not is_ticket_manager(user):
                    self._send_json(403, {"error": "Staff/Secretary only."})
                    return
                internal.append({"id": f"in_{int(time.time()*1000)}", "authorName": user["name"], "authorRole": user["roleTitle"], "note": str(body["internalNote"]).strip(), "createdAt": utc_now_iso()})
                db.execute("UPDATE tickets SET internal_notes_json = %s WHERE id = %s", (jdump(internal), tid))
            elif action == "approve_cost":
                if not is_finance_manager(user):
                    self._send_json(403, {"error": "Secretary or Treasurer approval required."})
                    return
                history.append({"id": f"th_{int(time.time()*1000)}", "status": "In Progress", "actorName": user["name"], "actorRole": user["roleTitle"], "timestamp": utc_now_iso(), "summary": f"Approved ₹{t.get('cost_estimate') or 0} estimate"})
                db.execute("UPDATE tickets SET cost_approved = 1, cost_approver_name = %s, status = 'In Progress', history_json = %s WHERE id = %s", (user["name"], jdump(history), tid))
                append_audit(user, "TICKET_COST_APPROVED", "Ticket", t["ticket_number"], f"Approved ₹{t.get('cost_estimate') or 0}")
            elif action == "rate":
                rating = int(body.get("rating") or 5)
                fb = body.get("feedback") or None
                history.append({"id": f"th_{int(time.time()*1000)}", "status": "Closed", "actorName": user["name"], "actorRole": user["roleTitle"], "timestamp": utc_now_iso(), "summary": f"Closed with {rating}/5 rating"})
                db.execute("UPDATE tickets SET resident_rating = %s, resident_feedback = %s, status = 'Closed', closed_at = %s, history_json = %s WHERE id = %s", (rating, fb, utc_now_sql(), jdump(history), tid))
                append_audit(user, "TICKET_CLOSED", "Ticket", t["ticket_number"], f"Rating {rating}/5")
            elif action == "reopen":
                history.append({"id": f"th_{int(time.time()*1000)}", "status": "Reopened", "actorName": user["name"], "actorRole": user["roleTitle"], "timestamp": utc_now_iso(), "summary": str(body.get("comment") or "Reopened by resident")})
                db.execute("UPDATE tickets SET status = 'Reopened', closed_at = NULL, history_json = %s WHERE id = %s", (jdump(history), tid))
                append_audit(user, "TICKET_REOPENED", "Ticket", t["ticket_number"], "Reopened")
            elif body.get("status"):
                if not (is_ticket_manager(user) or user["role"] == "vendor"):
                    self._send_json(403, {"error": "Permission required."})
                    return
                st = str(body["status"])
                history.append({"id": f"th_{int(time.time()*1000)}", "status": st, "actorName": user["name"], "actorRole": user["roleTitle"], "timestamp": utc_now_iso(), "summary": str(body.get("completionNotes") or f"Status -> {st}")})
                db.execute(
                    "UPDATE tickets SET status = %s, assignee_name = COALESCE(%s, assignee_name), completion_notes = COALESCE(%s, completion_notes), cost_estimate = COALESCE(%s, cost_estimate), history_json = %s WHERE id = %s",
                    (st, body.get("assigneeName"), body.get("completionNotes"), body.get("costEstimate"), jdump(history), tid),
                )
                append_audit(user, "TICKET_STATUS_UPDATED", "Ticket", t["ticket_number"], f"Status -> {st}")
            self._send_json(200, build_bootstrap(user))
            return

        # Campaign manage
        m_cm = re.match(r"^/api/campaigns/([^/]+)/manage$", path)
        if m_cm:
            cid = m_cm.group(1)
            c = db.fetch_one("SELECT * FROM service_campaigns WHERE id = %s", (cid,))
            if not c:
                self._send_json(404, {"error": "Campaign not found."})
                return
            subs = jload(c["subscriptions_json"], [])
            action = body.get("action")
            if action == "lock_price":
                if not (is_secretary(user) or is_ticket_manager(user)):
                    self._send_json(403, {"error": "Secretary or Facility permission required."})
                    return
                for s in subs:
                    if s["status"] == "active":
                        s["lockedUnitPrice"] = int(c["current_unit_price"])
                db.execute("UPDATE service_campaigns SET status = 'locked', subscriptions_json = %s WHERE id = %s", (jdump(subs), cid))
                append_audit(user, "CAMPAIGN_LOCKED", "ServiceCampaign", cid, f"Locked at ₹{c['current_unit_price']}")
            else:
                sid = body.get("subscriptionId")
                sub = next((s for s in subs if s["id"] == sid), None)
                if sub:
                    if action == "cancel_subscription":
                        sub["status"] = "cancelled"
                        cnt = max(0, int(c["confirmed_count"]) - 1)
                        disc, up = compute_campaign_pricing(int(c["base_price"]), cnt, jload(c["tiers_json"], []))
                        db.execute("UPDATE service_campaigns SET subscriptions_json = %s, confirmed_count = %s, active_discount_pct = %s, current_unit_price = %s WHERE id = %s", (jdump(subs), cnt, disc, up, cid))
                    elif action == "pause_subscription":
                        sub["status"] = "paused"
                        db.execute("UPDATE service_campaigns SET subscriptions_json = %s WHERE id = %s", (jdump(subs), cid))
                    elif action == "resume_subscription":
                        sub["status"] = "active"
                        db.execute("UPDATE service_campaigns SET subscriptions_json = %s WHERE id = %s", (jdump(subs), cid))
                    elif action == "rate_service":
                        sub["rating"] = int(body.get("rating") or 5)
                        sub["status"] = "completed"
                        db.execute("UPDATE service_campaigns SET subscriptions_json = %s WHERE id = %s", (jdump(subs), cid))
            self._send_json(200, build_bootstrap(user))
            return

        # Meeting resolution update
        m_res = re.match(r"^/api/meetings/([^/]+)/resolutions/([^/]+)$", path)
        if m_res:
            if not is_secretary(user):
                self._send_json(403, {"error": "Only Secretary can update meeting resolutions."})
                return
            mid, rid = m_res.group(1), m_res.group(2)
            m = db.fetch_one("SELECT * FROM meetings WHERE id = %s", (mid,))
            if m:
                res_list = jload(m["resolutions_json"], [])
                for r in res_list:
                    if r["id"] == rid:
                        r["status"] = body.get("status") or "completed"
                db.execute("UPDATE meetings SET resolutions_json = %s WHERE id = %s", (jdump(res_list), mid))
            self._send_json(200, build_bootstrap(user))
            return

        # Visitor status (Check-in with auto parking / Check-out releasing parking)
        m_vis = re.match(r"^/api/visitors/([^/]+)/status$", path)
        if m_vis:
            if user["role"] != "security" and not is_secretary(user):
                self._send_json(403, {"error": "Gate or Secretary access required."})
                return
            vid = m_vis.group(1)
            v = db.fetch_one("SELECT * FROM visitors WHERE id = %s", (vid,))
            if not v:
                self._send_json(404, {"error": "Visitor not found."})
                return
            st = body.get("status")
            if st == "checked_in":
                db.execute("UPDATE visitors SET status = 'checked_in', checked_in_at = %s WHERE id = %s", (utc_now_sql(), vid))
                assign_visitor_parking(vid, v.get("vehicle_no"))
            elif st == "checked_out":
                db.execute("UPDATE visitors SET status = 'checked_out', checked_out_at = %s WHERE id = %s", (utc_now_sql(), vid))
                release_visitor_parking(vid)
            self._send_json(200, build_bootstrap(user))
            return

        # Resident or Secretary Approve / Deny Walk-In Visitor
        m_vis_dec = re.match(r"^/api/visitors/([^/]+)/decision$", path)
        if m_vis_dec:
            vid = m_vis_dec.group(1)
            v = db.fetch_one("SELECT * FROM visitors WHERE id = %s", (vid,))
            if not v:
                self._send_json(404, {"error": "Visitor not found."})
                return
            if not is_secretary(user) and v["flat_id"] != user.get("flatId"):
                self._send_json(403, {"error": "Only the host flat resident or Secretary can approve/deny walk-ins."})
                return
            decision = "approved" if body.get("decision") == "approve" else "denied"
            db.execute("UPDATE visitors SET status = %s WHERE id = %s", (decision, vid))
            append_audit(user, f"VISITOR_{decision.upper()}", "VisitorPass", v["pass_code"], f"{v['visitor_name']} ({v['flat_number']})")
            self._send_json(200, build_bootstrap(user))
            return

        # Secretary Verifies / Clears / Flags Domestic Help Background Check
        m_hh_ver = re.match(r"^/api/house-help/([^/]+)/verify$", path)
        if m_hh_ver:
            if not is_secretary(user):
                self._send_json(403, {"error": "Only the Society Secretary can verify domestic help records."})
                return
            hid = m_hh_ver.group(1)
            bg = body.get("backgroundCheck") or "cleared"
            verified = 1 if body.get("idVerified", bg == "cleared") else 0
            db.execute("UPDATE house_helps SET background_check = %s, id_verified = %s WHERE id = %s", (bg, verified, hid))
            append_audit(user, "HOUSE_HELP_VERIFIED", "HouseHelp", hid, f"Background check -> {bg}")
            self._send_json(200, build_bootstrap(user))
            return

        # Guard / Secretary / Facility Manager Acknowledge or Resolve Emergency SOS
        m_sos = re.match(r"^/api/sos/([^/]+)$", path)
        if m_sos:
            if user["role"] not in ("secretary", "security", "facility_manager"):
                self._send_json(403, {"error": "Security or Management access required."})
                return
            sid = m_sos.group(1)
            st = body.get("status") or "acknowledged"
            if st == "resolved":
                db.execute("UPDATE sos_alerts SET status = 'resolved', resolved_at = %s, acknowledged_by = COALESCE(acknowledged_by, %s) WHERE id = %s", (utc_now_sql(), user["name"], sid))
            else:
                db.execute("UPDATE sos_alerts SET status = 'acknowledged', acknowledged_by = %s WHERE id = %s", (user["name"], sid))
            append_audit(user, f"SOS_{st.upper()}", "SosAlert", sid, f"Handled by {user['name']}")
            self._send_json(200, build_bootstrap(user))
            return

        self._send_json(404, {"error": "Endpoint not found."})

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        user = self._resolve_user()
        if not user or not user["isActive"]:
            self._send_json(403, {"error": "Account suspended."})
            return

        # Secretary deletes sub-account
        m_acc = re.match(r"^/api/secretary/accounts/([^/]+)$", path)
        if m_acc:
            if not is_secretary(user):
                self._send_json(403, {"error": "Only the Society Secretary can delete sub-accounts."})
                return
            uid = m_acc.group(1)
            if uid == "usr_secretary":
                self._send_json(400, {"error": "Root Secretary account cannot be deleted."})
                return
            db.execute("DELETE FROM users WHERE id = %s", (uid,))
            append_audit(user, "SUBACCOUNT_DELETED", "User", uid, "Removed sub-account under Secretary oversight")
            self._send_json(200, build_bootstrap(user))
            return

        # Secretary deletes any ticket (or owner deletes own submitted ticket)
        m_tkt = re.match(r"^/api/tickets/([^/]+)$", path)
        if m_tkt:
            tid = m_tkt.group(1)
            t = db.fetch_one("SELECT * FROM tickets WHERE id = %s", (tid,))
            if not t:
                self._send_json(404, {"error": "Ticket not found."})
                return
            if not is_secretary(user) and t["raised_by_user_id"] != user["id"]:
                self._send_json(403, {"error": "Only the Secretary or ticket creator can remove this ticket."})
                return
            db.execute("DELETE FROM tickets WHERE id = %s", (tid,))
            append_audit(user, "TICKET_DELETED", "Ticket", t["ticket_number"], f"Removed ticket '{t['title']}'")
            self._send_json(200, build_bootstrap(user))
            return

        # Delete comment on social post (author or Secretary)
        m_cmt = re.match(r"^/api/social/posts/([^/]+)/comments/([^/]+)$", path)
        if m_cmt:
            pid, cid = m_cmt.group(1), m_cmt.group(2)
            row = db.fetch_one("SELECT * FROM social_posts WHERE id = %s", (pid,))
            if not row:
                self._send_json(404, {"error": "Post not found."})
                return
            comments = jload(row["comments_json"], [])
            target = next((c for c in comments if c["id"] == cid), None)
            if target and (target.get("userId") == user["id"] or is_post_moderator(user)):
                comments = [c for c in comments if c["id"] != cid]
                db.execute("UPDATE social_posts SET comments_json = %s WHERE id = %s", (jdump(comments), pid))
                append_audit(user, "COMMENT_DELETED", "SocialPost", pid, f"Removed comment {cid}")
                self._send_json(200, build_bootstrap(user))
                return
            self._send_json(403, {"error": "Only comment author or Secretary can delete this comment."})
            return

        self._send_json(404, {"error": "Endpoint not found."})


if __name__ == "__main__":
    py_port = int(os.environ.get("PYTHON_BACKEND_PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", py_port), SocietyAPIHandler)
    print(f"[Python Backend] CivicNest API running on http://127.0.0.1:{py_port} using {db.backend_kind.upper()}")
    server.serve_forever()