import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  CreateUserForm,
  UserStatusToggle,
  AssignRoleForm,
  RemoveRoleButton,
} from "@/components/admin/user-forms";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { listUsers } from "@/server/services";

const ROLE_CODES = [
  "administrateur",
  "agent_accueil",
  "medecin",
  "caissier",
  "directeur",
] as const;

/**
 * User / account lifecycle (Gate 5B, 12 §5.3). Admin-only; hospital-scoped via UserRole;
 * audited. View users in the active hospital, create (temporary demo password), activate/
 * deactivate, assign/remove coarse roles. Server-side RBAC is the real control.
 */
export default async function UsersAdminPage() {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "user.manage")) redirect("/");

  const users = await listUsers(actor, hospital);
  const t = await getTranslations("userAdmin");
  const tRoles = await getTranslations("roles");
  const roles = ROLE_CODES.map((code) => ({ code, name: tRoles(code) }));

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/administration">
              <ArrowLeft className="size-4" aria-hidden />
              {t("backToAdmin")}
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("users")}</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noUsers")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr>
                  <th className="py-2 pr-4 font-medium">{t("user")}</th>
                  <th className="py-2 pr-4 font-medium">{t("roles")}</th>
                  <th className="py-2 pr-4 font-medium">{t("status")}</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b align-top last:border-0">
                    <td className="py-3 pr-4">
                      <span className="font-medium">{u.displayName}</span>
                      <span className="text-muted-foreground block text-xs">{u.email}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {u.userRoles.map((ur) => (
                          <RemoveRoleButton
                            key={ur.id}
                            userId={u.id}
                            roleCode={ur.role.code}
                            roleName={tRoles(ur.role.code)}
                          />
                        ))}
                        <AssignRoleForm userId={u.id} roles={roles} />
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={u.status === "active" ? "secondary" : "outline"}>
                        {u.status === "active" ? t("active") : t("disabled")}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">
                      <UserStatusToggle userId={u.id} active={u.status === "active"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <CreateUserForm roles={roles} />
        </CardContent>
      </Card>
    </>
  );
}
