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
  type LucideIcon,
} from "lucide-react";

import type { Capability } from "@/lib/rbac";

/**
 * Primary navigation (06 §5). Labels are i18n keys under the `nav` namespace; each
 * item declares the capability needed to see it, so menus visibly differ by role
 * (09 §6, 04). The dashboard is the only route at "/".
 */
export type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  capability: Capability;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    labelKey: "dashboard",
    icon: LayoutDashboard,
    capability: "dashboard.read",
  },
  {
    href: "/patients",
    labelKey: "patients",
    icon: Users,
    capability: "patient.read",
  },
  {
    href: "/consultations",
    labelKey: "consultations",
    icon: Stethoscope,
    capability: "consultation.read",
  },
  {
    // Phase 2F — simple per-service digital queue.
    href: "/file-attente",
    labelKey: "queue",
    icon: Users,
    capability: "queue.read",
  },
  {
    // Phase 2G — ward-level hospitalization board (clinical + admission desk + financial + oversight).
    href: "/hospitalisations",
    labelKey: "hospitalizations",
    icon: BedDouble,
    capability: "admission.read",
  },
  {
    // Phase 2I — lab/radiology worklist (clinical + diagnostics staff + oversight read).
    href: "/laboratoire",
    labelKey: "diagnostics",
    icon: FlaskConical,
    capability: "diagnostic.read",
  },
  {
    href: "/facturation",
    labelKey: "billing",
    icon: ReceiptText,
    capability: "invoice.read",
  },
  {
    href: "/rapports-caisse",
    labelKey: "cashierReport",
    icon: Banknote,
    capability: "cashier.report.read",
  },
  {
    // Phase 2E — operational reports + DHIS2 aggregate CSV export (admin + director).
    href: "/rapports",
    labelKey: "operationalReports",
    icon: Banknote,
    capability: "report.operational.read",
  },
  {
    // Phase 2C — Brouillard de Caisse (cashier opens/closes their shift).
    href: "/caisse/brouillard",
    labelKey: "brouillard",
    icon: Wallet,
    capability: "cashier.shift.manage",
  },
  {
    // Phase 2C — cancellation approval worklist (Hospital Administrator).
    href: "/annulations",
    labelKey: "cancellations",
    icon: Ban,
    capability: "invoice.cancel.approve",
  },
  {
    // Phase 2C — refund vouchers (cashier / admin / director read).
    href: "/remboursements",
    labelKey: "refunds",
    icon: Undo2,
    capability: "refund.read",
  },
  {
    // Phase 2D-5 — pharmacy dispensing worklist (pharmacy).
    href: "/pharmacie/dispensation",
    labelKey: "dispensation",
    icon: Pill,
    capability: "dispense.perform",
  },
  {
    // Phase 2D-3 — pharmacy stock (pharmacy + oversight read).
    href: "/pharmacie/stock",
    labelKey: "pharmacyStock",
    icon: Boxes,
    capability: "stock.read",
  },
  {
    // Phase 2D-7 — stock-adjustment worklist (pharmacy + oversight read; chief decides).
    href: "/pharmacie/ajustements",
    labelKey: "stockAdjustments",
    icon: Boxes,
    capability: "stock.read",
  },
  {
    // Phase 2D-8 — read-only pharmacy report (pharmacy + oversight).
    href: "/pharmacie/rapports",
    labelKey: "pharmacyReport",
    icon: Boxes,
    capability: "stock.read",
  },
  {
    href: "/administration",
    labelKey: "administration",
    icon: Settings2,
    // Visible to roles that may read configuration (admin manages; director read-only).
    capability: "config.read",
  },
  {
    href: "/journal-audit",
    labelKey: "audit",
    icon: ScrollText,
    capability: "audit.read",
  },
  {
    href: "/etat-systeme",
    labelKey: "systemStatus",
    icon: HeartPulse,
    // Oversight roles (admin manages config; director reads it).
    capability: "config.read",
  },
  {
    // Visible to every authenticated user (all roles have dashboard.read).
    href: "/mon-compte",
    labelKey: "myAccount",
    icon: UserCog,
    capability: "dashboard.read",
  },
];
