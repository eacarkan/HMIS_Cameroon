import {
  LayoutDashboard,
  Users,
  Stethoscope,
  ReceiptText,
  Banknote,
  Settings2,
  ScrollText,
  UserCog,
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
    // Visible to every authenticated user (all roles have dashboard.read).
    href: "/mon-compte",
    labelKey: "myAccount",
    icon: UserCog,
    capability: "dashboard.read",
  },
];
