"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addPatientContactAction,
  deactivatePatientContactAction,
  addPatientIdentifierAction,
  deactivatePatientIdentifierAction,
  reviewDuplicateCandidateAction,
} from "@/server/actions/patient-identity-actions";
import type { ActionState } from "@/server/actions/config-actions";

/**
 * Patient identity/contact/duplicate panel (Gate 4, 25 §7). Reception manages
 * ADMINISTRATIVE identity/contact via server actions → Gate 3 service (RBAC + scoping +
 * audit). NO merge button, NO MPI/global-dedup wording — the duplicate flow is review-only.
 */
type Contact = { id: string; contactType: string; value: string; label: string | null };
type Identifier = {
  id: string;
  identifierType: string;
  value: string;
  issuingAuthority: string | null;
};
type Duplicate = {
  id: string;
  matchBasis: string;
  status: string;
};

const initial: ActionState = {};

function FormError({ state }: { state: ActionState }) {
  const msg = state.error ?? Object.values(state.errors ?? {})[0];
  return msg ? (
    <p role="alert" className="text-destructive text-sm">
      {msg}
    </p>
  ) : null;
}

export function PatientIdentityPanel({
  patientId,
  contacts,
  identifiers,
  duplicates,
  canManage,
}: {
  patientId: string;
  contacts: Contact[];
  identifiers: Identifier[];
  duplicates: Duplicate[];
  canManage: boolean;
}) {
  const t = useTranslations("patientIdentity");

  const [contactState, contactAction, contactPending] = useActionState(
    addPatientContactAction.bind(null, patientId),
    initial,
  );
  const [idState, idAction, idPending] = useActionState(
    addPatientIdentifierAction.bind(null, patientId),
    initial,
  );

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        {canManage ? (
          <p className="text-muted-foreground text-xs">{t("manageHint")}</p>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        {/* Contacts */}
        <section>
          <h3 className="mb-2 text-sm font-medium">{t("contacts")}</h3>
          {contacts.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noContacts")}</p>
          ) : (
            <ul className="divide-y text-sm">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="text-muted-foreground text-xs">{c.contactType}</span>{" "}
                    <span className="font-medium">{c.value}</span>
                    {c.label ? <span className="text-muted-foreground"> · {c.label}</span> : null}
                  </span>
                  {canManage ? (
                    <form action={deactivatePatientContactAction.bind(null, patientId, c.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        {t("deactivate")}
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canManage ? (
            <form action={contactAction} className="mt-3 flex flex-wrap items-end gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="ct-type">{t("contactType")}</Label>
                <Input id="ct-type" name="contactType" className="w-28" defaultValue="phone" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ct-value">{t("value")}</Label>
                <Input id="ct-value" name="value" className="w-44" required />
              </div>
              <Button type="submit" size="sm" disabled={contactPending}>
                {t("addContact")}
              </Button>
              <FormError state={contactState} />
            </form>
          ) : null}
        </section>

        {/* Identifiers */}
        <section>
          <h3 className="mb-2 text-sm font-medium">{t("identifiers")}</h3>
          {identifiers.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noIdentifiers")}</p>
          ) : (
            <ul className="divide-y text-sm">
              {identifiers.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="text-muted-foreground text-xs">{i.identifierType}</span>{" "}
                    <span className="tnum font-medium">{i.value}</span>
                  </span>
                  {canManage ? (
                    <form action={deactivatePatientIdentifierAction.bind(null, patientId, i.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        {t("deactivate")}
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canManage ? (
            <form action={idAction} className="mt-3 flex flex-wrap items-end gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="id-type">{t("identifierType")}</Label>
                <Input id="id-type" name="identifierType" className="w-40" defaultValue="carte_hospitaliere" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="id-value">{t("value")}</Label>
                <Input id="id-value" name="value" className="w-36" required />
              </div>
              <Button type="submit" size="sm" disabled={idPending}>
                {t("addIdentifier")}
              </Button>
              <FormError state={idState} />
            </form>
          ) : null}
        </section>

        {/* Duplicate review (no merge) */}
        <section className="md:col-span-2">
          <h3 className="mb-2 text-sm font-medium">{t("duplicates")}</h3>
          <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs">
            <AlertTriangle className="size-3.5" aria-hidden />
            {t("duplicateNotice")}
          </p>
          {duplicates.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noDuplicates")}</p>
          ) : (
            <ul className="divide-y text-sm">
              {duplicates.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-muted-foreground text-xs">{d.matchBasis}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant={d.status === "open" ? "destructive" : "outline"}>
                      {d.status === "open" ? t("statusOpen") : t("statusDismissed")}
                    </Badge>
                    {canManage && d.status === "open" ? (
                      <form
                        action={reviewDuplicateCandidateAction.bind(null, patientId, d.id, "dismissed")}
                      >
                        <Button type="submit" variant="ghost" size="sm">
                          {t("dismiss")}
                        </Button>
                      </form>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
