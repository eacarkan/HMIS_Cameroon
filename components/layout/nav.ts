import {
  LayoutDashboard,
  Users,
  Stethoscope,
  ReceiptText,
  Banknote,
  Wallet,
  Ban,
  Undo2,
  Boxes,
  Settings2,
  ScrollText,
  Pill,
  UserCog,
  HeartPulse,
  BedDouble,
  FlaskConical,
  Globe2,
  ClipboardCheck,
  Cable,
  Share2,
  FileInput,
  Smartphone,
  ShieldCheck,
  BarChart3,
  UserSearch,
  type LucideIcon,
} from "lucide-react";

import type { Capability } from "@/lib/rbac";

/**
 * Primary navigation (06 §5). Labels are i18n keys under the `nav` namespace; each
 * item declares the capability needed to see it, so menus visibly differ by role
 * (09 §6, 04). Items are grouped into ordered SECTIONS (Phase 5B) so a role with many
 * modules sees an organised menu rather than one long flat list — grouping reduces
 * visual clutter WITHOUT hiding any capability-permitted item. The dashboard is at "/".
 */
export type NavSection = "main" | "clinical" | "pharmacy" | "billing" | "reports" | "admin" | "account";

/** Section render order + the i18n label key for each (`nav.<labelKey>`). */
export const NAV_SECTIONS: { key: NavSection; labelKey: string }[] = [
  { key: "main", labelKey: "sectionMain" },
  { key: "clinical", labelKey: "sectionClinical" },
  { key: "pharmacy", labelKey: "sectionPharmacy" },
  { key: "billing", labelKey: "sectionBilling" },
  { key: "reports", labelKey: "sectionReports" },
  { key: "admin", labelKey: "sectionAdmin" },
  { key: "account", labelKey: "sectionAccount" },
];

export type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  capability: Capability;
  section: NavSection;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "dashboard", icon: LayoutDashboard, capability: "dashboard.read", section: "main" },
  { href: "/patients", labelKey: "patients", icon: Users, capability: "patient.read", section: "main" },

  // Clinique
  { href: "/consultations", labelKey: "consultations", icon: Stethoscope, capability: "consultation.read", section: "clinical" },
  // Phase 2F — simple per-service digital queue.
  { href: "/file-attente", labelKey: "queue", icon: Users, capability: "queue.read", section: "clinical" },
  // Phase 2G — ward-level hospitalization board.
  { href: "/hospitalisations", labelKey: "hospitalizations", icon: BedDouble, capability: "admission.read", section: "clinical" },
  // Phase 2I — lab/radiology worklist.
  { href: "/laboratoire", labelKey: "diagnostics", icon: FlaskConical, capability: "diagnostic.read", section: "clinical" },
  // Phase 4C — external lab/radiology result import (staging + review; never auto-clinical).
  { href: "/laboratoire/import", labelKey: "externalResultImport", icon: FileInput, capability: "external_result.review", section: "clinical" },

  // Pharmacie
  // Phase 2D-5 — pharmacy dispensing worklist.
  { href: "/pharmacie/dispensation", labelKey: "dispensation", icon: Pill, capability: "dispense.perform", section: "pharmacy" },
  // Phase 2D-3 — pharmacy stock.
  { href: "/pharmacie/stock", labelKey: "pharmacyStock", icon: Boxes, capability: "stock.read", section: "pharmacy" },
  // Phase 2D-7 — stock-adjustment worklist.
  { href: "/pharmacie/ajustements", labelKey: "stockAdjustments", icon: Boxes, capability: "stock.read", section: "pharmacy" },
  // Phase 2D-8 — read-only pharmacy report.
  { href: "/pharmacie/rapports", labelKey: "pharmacyReport", icon: Boxes, capability: "stock.read", section: "pharmacy" },

  // Facturation
  { href: "/facturation", labelKey: "billing", icon: ReceiptText, capability: "invoice.read", section: "billing" },
  { href: "/rapports-caisse", labelKey: "cashierReport", icon: Banknote, capability: "cashier.report.read", section: "billing" },
  // Phase 2C — Brouillard de Caisse.
  { href: "/caisse/brouillard", labelKey: "brouillard", icon: Wallet, capability: "cashier.shift.manage", section: "billing" },
  // Phase 2C — cancellation approval worklist.
  { href: "/annulations", labelKey: "cancellations", icon: Ban, capability: "invoice.cancel.approve", section: "billing" },
  // Phase 2C — refund vouchers.
  { href: "/remboursements", labelKey: "refunds", icon: Undo2, capability: "refund.read", section: "billing" },
  // Phase 4D — payment provider abstraction + reconciliation (mock only).
  { href: "/facturation/paiements-externes", labelKey: "externalPayments", icon: Smartphone, capability: "external_payment.view", section: "billing" },
  // Phase 4E — insurance / mutuelle workflow foundation (manual only).
  { href: "/facturation/assurance", labelKey: "insurance", icon: ShieldCheck, capability: "claim.manage", section: "billing" },

  // Rapports & supervision
  // Phase 2E — operational reports + DHIS2 aggregate CSV export.
  { href: "/rapports", labelKey: "operationalReports", icon: Banknote, capability: "report.operational.read", section: "reports" },
  // Phase 4F — advanced reporting / analytics foundation (aggregate-only).
  { href: "/administration/analytics", labelKey: "analytics", icon: BarChart3, capability: "analytics.report.view", section: "reports" },
  // Phase 3D — central aggregate oversight (aggregate-only).
  { href: "/central", labelKey: "central", icon: Globe2, capability: "central.aggregate.view", section: "reports" },

  // Administration & intégrations
  { href: "/administration", labelKey: "administration", icon: Settings2, capability: "config.read", section: "admin" },
  // Phase 4A — integration framework & external-system registry (mock/sandbox-first).
  { href: "/administration/integration", labelKey: "integration", icon: Cable, capability: "integration.job.view", section: "admin" },
  // Phase 4B — DHIS2 configurable export / API-readiness (aggregate-only; mock API).
  { href: "/administration/dhis2", labelKey: "dhis2", icon: Share2, capability: "dhis2.mapping.manage", section: "admin" },
  // Phase 4G — local patient-match review (warning-only, manual, no auto-merge).
  { href: "/patients/match-review", labelKey: "matchReview", icon: UserSearch, capability: "patient_match.review", section: "admin" },
  // Phase 3E — UAT evidence + Gate 7 readiness (evidence only).
  { href: "/uat", labelKey: "uat", icon: ClipboardCheck, capability: "uat.view", section: "admin" },
  { href: "/journal-audit", labelKey: "audit", icon: ScrollText, capability: "audit.read", section: "admin" },
  // Oversight roles (admin manages config; director reads it).
  { href: "/etat-systeme", labelKey: "systemStatus", icon: HeartPulse, capability: "config.read", section: "admin" },

  // Compte
  { href: "/mon-compte", labelKey: "myAccount", icon: UserCog, capability: "dashboard.read", section: "account" },
];
