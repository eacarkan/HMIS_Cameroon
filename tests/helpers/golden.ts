import {
  createInvoice,
  createPatientForActor,
  openEncounter,
  recordConsultation,
  recordPayment,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "./actors";

/** Run the full golden path through the service layer and return the key entities. */
export async function runGoldenPath() {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "BELLO",
    givenName: "Aïssatou",
    sex: "female",
    dateOfBirth: new Date("1990-03-14"),
    phone: "+237 6 99 00 00 01",
    residence: "Bertoua — quartier Nkolbikon",
  });
  const encounter = await openEncounter(
    reception.actor,
    reception.ctx,
    patient.id,
    {
      serviceLabel: "Médecine générale",
      reason: "Fièvre et céphalées depuis 48 heures",
    },
  );

  const doctor = await loginAndSelect(ACCOUNTS.doctor);
  const consultation = await recordConsultation(
    doctor.actor,
    doctor.ctx,
    encounter.id,
    {
      reason: "Fièvre et céphalées depuis 48 heures",
      clinicalNote: "Patiente consciente, état général conservé.",
      vitals:
        "Température 38,2 °C · Tension 120/80 · Pouls 88/min · Poids 64 kg",
      provisionalDiagnosis: "Syndrome fébrile à explorer",
      recommendation: "Repos, hydratation ; bilan de base.",
    },
  );

  const cashier = await loginAndSelect(ACCOUNTS.cashier);
  const invoice = await createInvoice(
    cashier.actor,
    cashier.ctx,
    encounter.id,
    [
      {
        label: "Consultation médecine générale",
        unitAmount: 2000,
        quantity: 1,
      },
      { label: "Frais d'ouverture de dossier", unitAmount: 1000, quantity: 1 },
    ],
  );
  const payment = await recordPayment(cashier.actor, cashier.ctx, invoice.id, {
    amount: invoice.totalAmount,
    method: "cash",
  });

  return {
    reception,
    doctor,
    cashier,
    patient,
    encounter,
    consultation,
    invoice,
    payment,
  };
}
