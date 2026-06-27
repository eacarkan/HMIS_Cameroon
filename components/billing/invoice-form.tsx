"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { TARIFFS } from "@/lib/constants";
import { formatFcfa } from "@/lib/money";
import {
  createInvoiceAction,
  type BillingFormState,
} from "@/server/actions/billing-actions";

const initialState: BillingFormState = {};

/** Invoice creation (06 §12): line items from the fake tariff catalogue, live total. */
export function InvoiceForm({ encounterId }: { encounterId: string }) {
  const t = useTranslations("billing");
  const tEnc = useTranslations("encounter");
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(TARIFFS.map((tf) => [tf.code, tf.defaultQty])),
  );
  const [state, formAction, pending] = useActionState(
    createInvoiceAction.bind(null, encounterId),
    initialState,
  );

  const total = TARIFFS.reduce(
    (sum, tf) => sum + tf.amount * (quantities[tf.code] || 0),
    0,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground bg-muted/40 text-left text-xs">
            <tr>
              <th className="px-3 py-2 font-medium">{t("designation")}</th>
              <th className="px-3 py-2 text-right font-medium">
                {t("unitPrice")}
              </th>
              <th className="px-3 py-2 text-center font-medium">
                {t("quantity")}
              </th>
              <th className="px-3 py-2 text-right font-medium">
                {t("lineTotal")}
              </th>
            </tr>
          </thead>
          <tbody>
            {TARIFFS.map((tf) => {
              const qty = quantities[tf.code] || 0;
              return (
                <tr key={tf.code} className="border-t">
                  <td className="px-3 py-2">{tf.label}</td>
                  <td className="tnum px-3 py-2 text-right">
                    {formatFcfa(tf.amount)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="number"
                      name={`qty_${tf.code}`}
                      min={0}
                      value={qty}
                      onChange={(e) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [tf.code]: Math.max(
                            0,
                            Math.floor(Number(e.target.value) || 0),
                          ),
                        }))
                      }
                      className="border-input bg-background h-8 w-16 rounded-md border px-2 text-center text-sm"
                    />
                  </td>
                  <td className="tnum px-3 py-2 text-right">
                    {formatFcfa(tf.amount * qty)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td className="px-3 py-2.5" colSpan={3}>
                {t("total")}
              </td>
              <td className="tnum px-3 py-2.5 text-right">
                {formatFcfa(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {tEnc("createInvoice")}
        </Button>
      </div>
    </form>
  );
}
