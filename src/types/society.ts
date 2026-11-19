export type UserRole =
  | 'secretary'
  | 'owner'
  | 'tenant'
  | 'family'
  | 'treasurer'
  | 'facility_manager'
  | 'security'
  | 'vendor';

export type LanguageCode = 'en' | 'hi' | 'mr';

export interface UserPermissions {
  canCreatePosts: boolean;
  canModeratePosts: boolean;
  canManageTickets: boolean;
  canManageBilling: boolean;
  canVote: boolean;
}

export interface UserAccount {
  id: string;
  parentSecretaryId: string | null;
  name: string;
  role: UserRole;
  roleTitle: string;
  flatId: string | null;
  flatNumber: string | null;
  tower: string | null;
  vendorId?: string | null;
  phone: string;
  email: string;
  verified: boolean;
  isActive: boolean;
  permissions: UserPermissions;
  consentMarketing: boolean;
  consentDirectory: boolean;
  preferredLang: LanguageCode;
}

export type SocialPostCategory =
  | 'Home & Decor'
  | 'Balcony & Garden'
  | 'Festival Celebration'
  | 'Community Thought'
  | 'Buy / Sell / Giveaway';

export interface SocialLike {
  userId: string;
  userName: string;
  flatNumber: string | null;
}

export interface SocialComment {
  id: string;
  userId: string;
  authorName: string;
  flatNumber: string | null;
  text: string;
  createdAt: string;
}

export interface SocialReport {
  userId: string;
  reporterName: string;
  reason: string;
  createdAt: string;
}

export interface SocialPost {
  id: string;
  authorUserId: string;
  authorName: string;
  authorRoleTitle: string;
  flatNumber: string | null;
  tower: string | null;
  category: string;
  caption: string;
  imageUrl: string | null;
  isPinned: boolean;
  isHidden: boolean;
  moderationNote: string | null;
  likes: SocialLike[];
  likeCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  comments: SocialComment[];
  reportCount: number;
  reports: SocialReport[];
  createdAt: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  phone: string;
  accessLevel: 'full' | 'limited';
}

export interface VehicleRecord {
  id: string;
  registrationNo: string;
  type: '4-wheeler' | '2-wheeler' | 'EV';
  parkingSlot: string;
  stickerId: string;
}

export interface MoveRequest {
  id: string;
  type: 'move_in' | 'move_out';
  requestedDate: string;
  nocStatus: 'pending_review' | 'approved' | 'completed';
  depositAmount: number;
  notes: string;
}

export interface FlatRecord {
  id: string;
  tower: string;
  wing: string;
  flatNumber: string;
  floor: number;
  areaSqFt: number;
  ownershipStatus: 'owner_occupied' | 'tenant_occupied' | 'vacant';
  ownerName: string;
  occupantName: string;
  occupantPhone: string;
  parkingSlots: string[];
  billingStatus: 'active' | 'arrears_hold';
  familyMembers: FamilyMember[];
  vehicles: VehicleRecord[];
  moveRequests: MoveRequest[];
}

export type TicketCategory =
  | 'plumbing'
  | 'electrical'
  | 'lift'
  | 'security'
  | 'housekeeping'
  | 'noise'
  | 'parking'
  | 'billing'
  | 'other';

export type TicketPriority = 'emergency' | 'high' | 'normal' | 'low';

export type TicketStatus =
  | 'Submitted'
  | 'Acknowledged'
  | 'Assigned'
  | 'In Progress'
  | 'Waiting for Resident'
  | 'Waiting for Vendor'
  | 'Waiting for Approval'
  | 'Resolved'
  | 'Closed'
  | 'Reopened'
  | 'Cancelled';

export interface TicketComment {
  id: string;
  authorName: string;
  authorRole: string;
  message: string;
  createdAt: string;
}

export interface InternalNote {
  id: string;
  authorName: string;
  authorRole: string;
  note: string;
  createdAt: string;
}

export interface TicketHistoryEntry {
  id: string;
  status: TicketStatus;
  actorName: string;
  actorRole: string;
  timestamp: string;
  summary: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  flatId: string;
  flatNumber: string;
  tower: string;
  raisedByUserId: string;
  raisedByName: string;
  category: TicketCategory;
  priority: TicketPriority;
  title: string;
  description: string;
  location: string;
  preferredContactTime: string;
  status: TicketStatus;
  assigneeName: string | null;
  assigneeVendorId: string | null;
  slaResponseHours: number;
  slaResolutionHours: number;
  slaDueAt: string;
  slaBreached: boolean;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  costEstimate: number | null;
  costApproved: boolean;
  costApproverName: string | null;
  completionNotes: string | null;
  residentRating: number | null;
  residentFeedback: string | null;
  comments: TicketComment[];
  internalNotes?: InternalNote[];
  history: TicketHistoryEntry[];
}

export interface InvoiceLineItem {
  label: string;
  type: 'fixed' | 'area' | 'usage' | 'one_time';
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  flatId: string;
  flatNumber: string;
  tower: string;
  periodLabel: string;
  billingCycle: 'monthly' | 'quarterly' | 'annual';
  issuedAt: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  carryForward: number;
  lateFee: number;
  totalAmount: number;
  paidAmount: number;
  status: 'unpaid' | 'partial' | 'paid' | 'disputed';
  disputeReason?: string;
  paymentRef?: string;
  paymentMethod?: string;
  paidAt?: string;
  reconciled: boolean;
}

export interface ExpenseRecord {
  id: string;
  title: string;
  category: 'utilities' | 'housekeeping' | 'security' | 'repairs' | 'amc' | 'events';
  vendorName: string;
  vendorPan?: string | null;
  budgetHead: string;
  amount: number;
  gstAmount?: number;
  tdsSection?: string;
  tdsRatePct?: number;
  tdsAmount?: number;
  netPayable?: number;
  invoiceRef: string;
  date: string;
  status: 'pending_approval' | 'approved' | 'paid';
  approvedBy: string | null;
}

export interface DiscountTier {
  minFlats: number;
  discountPct: number;
  unitPrice: number;
}

export interface ServiceSubscription {
  id: string;
  campaignId: string;
  flatId: string;
  flatNumber: string;
  tower: string;
  residentName: string;
  preferredDate: string;
  preferredSlot: string;
  cadence: 'one_time' | 'monthly' | 'quarterly' | 'annual';
  status: 'active' | 'paused' | 'cancelled' | 'completed' | 'disputed';
  consentTimestamp: string;
  lockedUnitPrice: number | null;
  rating: number | null;
  feedback?: string;
  disputeNote?: string;
}

export interface ServiceCampaign {
  id: string;
  name: string;
  categoryGroup:
    | 'Climate and appliances'
    | 'Vehicle care'
    | 'Home maintenance'
    | 'Cleaning and pest control'
    | 'Water and safety'
    | 'Convenience';
  vendorId: string;
  vendorName: string;
  basePrice: number;
  scope: string;
  inclusions: string[];
  exclusions: string[];
  taxMaterialPolicy: string;
  availableDates: string[];
  slotCapacityPerDay: number;
  minConfirmedFlats: number;
  tiers: DiscountTier[];
  optInDeadline: string;
  cancellationPolicy: string;
  fallbackPolicy: string;
  status: 'open' | 'threshold_met' | 'locked' | 'completed' | 'cancelled';
  confirmedCount: number;
  activeDiscountPct: number;
  currentUnitPrice: number;
  subscriptions: ServiceSubscription[];
}

export interface VoteOption {
  id: string;
  label: string;
}

export interface VoteProposal {
  id: string;
  title: string;
  description: string;
  voteType: 'informal_poll' | 'formal_resolution' | 'committee_election';
  legalNotice: string;
  ballotMode: 'secret' | 'attributable';
  selectionMode: 'single' | 'multiple' | 'yes_no';
  eligibleScope: 'all_verified_owners' | 'all_residents';
  eligibleCount: number;
  quorumPct: number;
  opensAt: string;
  closesAt: string;
  status: 'open' | 'closed';
  supportingDocTitle: string;
  options: VoteOption[];
  votedFlatIds: string[];
  tallies: Record<string, number>;
  attributableRecords: {
    flatNumber: string;
    voterName: string;
    optionIds: string[];
    timestamp: string;
  }[];
  hasUserFlatVoted?: boolean;
}

export interface Amenity {
  id: string;
  name: string;
  imageUrl: string;
  capacity: number;
  operatingHours: string;
  fee: number;
  deposit: number;
  houseRules: string[];
  accessibilityInfo: string;
  slots: string[];
}

export interface AmenityBooking {
  id: string;
  amenityId: string;
  amenityName: string;
  flatId: string;
  flatNumber: string;
  residentName: string;
  date: string;
  slot: string;
  guests: number;
  feePaid: number;
  depositHeld: number;
  status: 'confirmed' | 'cancelled' | 'completed';
  refundStatus?: string;
  createdAt: string;
}

export interface SocietyEvent {
  id: string;
  title: string;
  category: 'festival' | 'workshop' | 'sports' | 'agm' | 'community';
  date: string;
  time: string;
  venue: string;
  description: string;
  capacity: number;
  feePerPerson: number;
  committeeApproved: boolean;
  registrations: {
    flatNumber: string;
    residentName: string;
    guests: number;
    volunteerRole?: string;
  }[];
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  category: 'official_circular' | 'emergency_alert' | 'wing_notice' | 'vendor_promo';
  targetAudience: string;
  authorName: string;
  authorRole: string;
  publishedAt: string;
  acknowledgedBy: string[];
}

export interface MeetingResolution {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  status: 'open' | 'in_progress' | 'completed';
}

export interface Meeting {
  id: string;
  title: string;
  meetingType: 'Committee Meeting' | 'AGM' | 'Special General Meeting';
  date: string;
  venue: string;
  agenda: string[];
  attendees: string[];
  minutesApproved: boolean;
  minutesSummary: string;
  resolutions: MeetingResolution[];
  confidentialDraftNote?: string;
}

export interface VisitorPass {
  id: string;
  passCode: string;
  flatId: string;
  flatNumber: string;
  visitorName: string;
  visitorType: 'guest' | 'delivery' | 'domestic_staff' | 'cab';
  phone: string;
  vehicleNo?: string;
  expectedDate: string;
  status: 'pending_approval' | 'pre_approved' | 'approved' | 'denied' | 'checked_in' | 'checked_out';
  parkingSlotNumber?: string | null;
  checkedInAt?: string;
  checkedOutAt?: string;
  loggedBy: string;
}

export interface HouseHelpReview {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface HouseHelpRecord {
  id: string;
  name: string;
  phone: string;
  helpType: 'maid' | 'cook' | 'driver' | 'nanny' | 'gardener' | 'car_cleaner';
  idProofType: string;
  idProofNumber: string;
  idVerified: boolean;
  backgroundCheck: 'pending' | 'cleared' | 'flagged';
  incidentCount: number;
  badgeCode: string;
  assignedFlats: string[];
  reviews: HouseHelpReview[];
  avgRating: number | null;
  currentStatus: 'outside' | 'inside';
  lastCheckInAt?: string | null;
  lastCheckOutAt?: string | null;
}

export interface HouseHelpLog {
  id: string;
  houseHelpId: string;
  houseHelpName: string;
  flatNumber: string;
  guardName: string;
  checkInAt: string;
  checkOutAt?: string | null;
}

export interface ParkingSlot {
  id: string;
  slotNumber: string;
  slotType: 'covered' | 'open' | 'ev';
  isVisitor: boolean;
  flatId?: string | null;
  flatNumber?: string | null;
  occupiedByVisitorId?: string | null;
  visitorVehicleNo?: string | null;
  occupiedSince?: string | null;
}

export interface ParcelRecord {
  id: string;
  flatId: string;
  flatNumber: string;
  courierName: string;
  trackingNote: string;
  shelfLocation: string;
  pickupOtp: string;
  status: 'at_gate' | 'collected';
  loggedBy: string;
  createdAt: string;
  collectedAt?: string | null;
}

export interface SosAlert {
  id: string;
  userId: string;
  userName: string;
  flatNumber?: string | null;
  tower?: string | null;
  alertType: 'medical' | 'fire' | 'lift' | 'security';
  message: string;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedBy?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface GuardShift {
  id: string;
  guardUserId: string;
  guardName: string;
  deviceId: string;
  clockInAt: string;
  clockInGps: string;
  clockOutAt?: string | null;
  handoverNote?: string | null;
  status: 'on_duty' | 'completed';
}

export interface GlAccount {
  id: string;
  code: string;
  name: string;
  accountType: 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE' | 'FUND';
  isMutual: boolean;
}

export interface JournalLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  entryDate: string;
  narration: string;
  sourceType: string;
  sourceId?: string | null;
  periodLabel: string;
  isReversal: boolean;
  reversesId?: string | null;
  lines: JournalLine[];
  createdBy: string;
  createdAt: string;
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  accountType: 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE' | 'FUND';
  isMutual: boolean;
  debitTotal: number;
  creditTotal: number;
  netBalance: number;
}

export interface AccountingStatements {
  trialBalance: TrialBalanceRow[];
  incomeStatement: {
    mutualIncome: number;
    nonMutualTaxableIncome: number;
    totalIncome: number;
    totalExpense: number;
    netSurplus: number;
  };
  balanceSheet: {
    assets: TrialBalanceRow[];
    liabilities: TrialBalanceRow[];
    funds: TrialBalanceRow[];
    netSurplus: number;
    totalAssets: number;
    totalLiabilitiesAndFunds: number;
  };
  arrearsAging: {
    bucket: string;
    amount: number;
    invoiceCount: number;
  }[];
}

export interface SocietyDocument {
  id: string;
  title: string;
  category: 'By-Laws' | 'Finance & Budget' | 'Insurance' | 'Compliance' | 'Minutes' | 'SOP';
  version: string;
  accessLevel: 'all_residents' | 'owners_only' | 'committee';
  updatedAt: string;
  expiryDate?: string;
  summary: string;
}

export interface SocietyAsset {
  id: string;
  name: string;
  category: 'Lift' | 'Pump' | 'Generator' | 'Fire System' | 'STP / WTP' | 'CCTV & Gate';
  location: string;
  vendorName: string;
  condition: 'optimal' | 'attention' | 'maintenance_due';
  lastServiceDate: string;
  nextServiceDate: string;
  amcExpiryDate: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
}

export interface SocietySummary {
  societyName: string;
  city: string;
  totalFlats: number;
  occupiedFlats: number;
  digitalAdoptionFlats: number;
  ticketStats: {
    open: number;
    overdue: number;
    slaCompliancePct: number;
    avgSatisfaction: number;
  };
  financeStats: {
    totalBilled: number;
    totalCollected: number;
    collectionRatePct: number;
    outstandingTotal: number;
  };
  campaignStats: {
    activeCampaigns: number;
    totalOptIns: number;
    estimatedResidentSavings: number;
  };
  meetingActionCompletionPct: number;
}

export interface BootstrapPayload {
  backendEngine?: string;
  currentUser: UserAccount;
  availableUsers: UserAccount[];
  society: SocietySummary;
  myFlat: FlatRecord | null;
  allFlats: FlatRecord[];
  socialPosts: SocialPost[];
  tickets: Ticket[];
  invoices: Invoice[];
  expenses: ExpenseRecord[];
  campaigns: ServiceCampaign[];
  votes: VoteProposal[];
  amenities: Amenity[];
  bookings: AmenityBooking[];
  events: SocietyEvent[];
  notices: Notice[];
  meetings: Meeting[];
  visitors: VisitorPass[];
  documents: SocietyDocument[];
  assets: SocietyAsset[];
  auditLogs: AuditLogEntry[];
  houseHelps: HouseHelpRecord[];
  houseHelpLogs: HouseHelpLog[];
  parkingSlots: ParkingSlot[];
  parcels: ParcelRecord[];
  sosAlerts: SosAlert[];
  guardShifts: GuardShift[];
  glAccounts: GlAccount[];
  journalEntries: JournalEntry[];
  accountingStatements: AccountingStatements | null;
}
