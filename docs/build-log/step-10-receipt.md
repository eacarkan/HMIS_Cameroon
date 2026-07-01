# Step 10 — Receipt preview/print

**Date:** 2026-06-27 · **Planning:** 06 §13, 09 §10, 07 §9

## Implemented
- **Receipt service** (`receipt-service`): `getReceipt` (`invoice.read`),
  `recordReceiptPrint` (`receipt.print` — marks `printedAt`, audits `receipt.print`).
  Fed by billing data; amounts are never recomputed.
- **Printed document** (`components/print/receipt-document`): official layout (06 §13) —
  Cameroon tricolor band, République du Cameroun · Ministère de la Santé Publique ·
  hospital, "Reçu de paiement" + N° reçu, patient/N° patient/N° facture/date, billed
  lines, Total, **Montant payé**, mode de paiement, Caissier, signature/stamp area, and
  the prototype label. Monochrome (black on white).
- **Print view** (`receipt-view`, client): react-to-print (A4) + logs `receipt.print`.
- Receipt page `/recus/[id]`; "Imprimer le reçu" reached from a paid invoice.

## Verified
Full golden path → receipt `HRB-DEMO-R-2026-000001` rendered with all three numbers
(R/P/F), Total/Montant payé **3 000 FCFA**, Espèces; `recordReceiptPrint` set `printedAt`
and produced the **12-entry** audit chain ending in `receipt.print` (matches 07 §11).
build/lint/typecheck ✓. Screenshots 10 (paid invoice), 11 (receipt).
