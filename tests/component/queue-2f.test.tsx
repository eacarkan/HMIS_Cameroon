import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AddToQueueForm } from "@/components/queue/add-to-queue-form";
import { QueueBoard, type QueueTicketRow } from "@/components/queue/queue-board";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/queue-actions", () => ({
  addToQueueAction: vi.fn(),
  advanceQueueAction: vi.fn(),
  toggleQueueUrgentAction: vi.fn(),
}));

const row: QueueTicketRow = {
  id: "tk-1",
  ticketNumber: 1,
  status: "waiting",
  isUrgent: false,
  patient: { familyName: "MENGUE", givenName: "Test", patientNumber: "HRB-DEMO-P-2026-000001" },
};

describe("Phase 2F — add-to-queue form", () => {
  it("shows the patient-number field + urgent checkbox for triage", () => {
    renderWithIntl(<AddToQueueForm serviceUnitId="svc-1" canUrgent={true} />);
    expect(screen.getByLabelText("Numéro patient")).toBeRequired();
    expect(screen.getByText("Urgent (priorité)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajouter à la file" })).toBeInTheDocument();
  });

  it("hides the urgent checkbox when the actor lacks the override", () => {
    renderWithIntl(<AddToQueueForm serviceUnitId="svc-1" canUrgent={false} />);
    expect(screen.queryByText("Urgent (priorité)")).not.toBeInTheDocument();
  });
});

describe("Phase 2F — queue board", () => {
  it("renders a waiting ticket with call + cancel actions for a manager", () => {
    renderWithIntl(<QueueBoard tickets={[row]} canManage={true} canUrgent={true} />);
    expect(screen.getByText("001")).toBeInTheDocument();
    expect(screen.getByText(/MENGUE/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Appeler" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marquer urgent" })).toBeInTheDocument();
  });

  it("shows the empty state with no tickets", () => {
    renderWithIntl(<QueueBoard tickets={[]} canManage={true} canUrgent={true} />);
    expect(screen.getByText(/Aucun patient en file/)).toBeInTheDocument();
  });

  it("a read-only viewer sees no action buttons", () => {
    renderWithIntl(<QueueBoard tickets={[row]} canManage={false} canUrgent={false} />);
    expect(screen.queryByRole("button", { name: "Appeler" })).not.toBeInTheDocument();
  });
});
