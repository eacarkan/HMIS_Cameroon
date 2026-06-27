# components/print

The printing module (09 §10). Owns the layout of official, monochrome-friendly
documents — first the payment receipt — fed by billing data via `lib/money`. It
**does not** recompute amounts; the invoice is the single source of truth (09 §10).

Every printed document carries the official header (République du Cameroun ·
Ministère de la Santé Publique · hospital) and the prototype label.

_Empty in the foundation (Steps 1-2); the receipt lands at Step 10._
