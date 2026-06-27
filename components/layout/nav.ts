import {
  LayoutDashboard,
  Users,
  Stethoscope,
  ReceiptText,
  Settings2,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

/**
 * Primary navigation (06 §5). Labels are i18n keys under the `nav` namespace in
 * messages/fr.json — never hardcoded here (09 §9). Routes that are not the
 * dashboard render an "à venir" placeholder until their build step lands.
 *
 * Role filtering (which roles see which items) is a Step 4-5 concern; the shape is
 * ready for it but the foundation shows every item.
 */
export type NavItem = {
  href: string;
  /** Key under the `nav` namespace in fr.json. */
  labelKey: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/patients", labelKey: "patients", icon: Users },
  { href: "/consultations", labelKey: "consultations", icon: Stethoscope },
  { href: "/facturation", labelKey: "billing", icon: ReceiptText },
  { href: "/administration", labelKey: "administration", icon: Settings2 },
  { href: "/journal-audit", labelKey: "audit", icon: ScrollText },
];
