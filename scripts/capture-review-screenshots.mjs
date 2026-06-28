import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Review-screenshot capturer (companion to scripts/seed-review-fixture.ts).
 *
 * Captures the Phase 0 walking-skeleton screens against a RUNNING server, using the
 * real internal route IDs emitted by the fixture, and REFUSES to save a broken page:
 * every page is validated for
 *   - Next "404 / This page could not be found"
 *   - the mandatory prototype label
 *   - a per-page expected token (and forbidden tokens, e.g. nav items a role must NOT see)
 *   - non-empty body text
 * Any failure aborts with a non-zero exit and NO screenshot is written for that page.
 *
 * Env: BASE_URL (default http://localhost:3000), IDS_FILE (fixture JSON), OUTDIR
 * (default docs/review-screenshots), CHROME_BIN (default macOS Google Chrome).
 * Fake data only; the server must be pointed at the test database.
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUTDIR = process.env.OUTDIR || "docs/review-screenshots";
const CHROME =
  process.env.CHROME_BIN ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const IDS = JSON.parse(readFileSync(process.env.IDS_FILE, "utf8"));
// SESSIONS_FILE: JSON map { admin, reception, director } -> authjs.session-token value
// (minted by the orchestrator via the running server's credentials endpoint).
const SESSIONS = JSON.parse(readFileSync(process.env.SESSIONS_FILE, "utf8"));
const PROTO = "Prototype de démonstration fonctionnelle";
const FORBIDDEN_404 = ["This page could not be found", "could not be found"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cookiesFor = (user) =>
  user ? [{ name: "authjs.session-token", value: SESSIONS[user] }] : null;

// REVIEW_SET=review (default) — technical review (two patients, demo-accounts hint shown).
// REVIEW_SET=stakeholder — approved one-patient golden path (dashboard 1/1/3 000 FCFA).
// REVIEW_SET=gate4 — Gate 4 UI/workflow screens (config, identity, clinical, tariff, audit).
const SET = ["stakeholder", "gate4", "gate5b"].includes(process.env.REVIEW_SET)
  ? process.env.REVIEW_SET
  : "review";

// --- Technical review set (two patients; shows empty consultation/billing forms). ---
const REVIEW_PAGES = [
  { file: "01-login", url: "/connexion", user: null, includes: ["Connexion", "@hrb-demo.cm"] },
  { file: "02-dashboard", url: "/", user: "admin", includes: ["Tableau de bord"] },
  { file: "03-patient-search", url: "/patients", user: "admin", includes: ["BELLO"] },
  { file: "04-patient-create", url: "/patients/nouveau", user: "admin", includes: ["Nom", "Sexe"] },
  { file: "05-patient-detail-banner", url: `/patients/${IDS.patient1}`, user: "admin", includes: [IDS.patient1Number, "BELLO"] },
  { file: "06-encounter", url: `/encounters/${IDS.encounter1}`, user: "admin", includes: [IDS.encounter1Number] },
  { file: "07-consultation", url: `/encounters/${IDS.encounter2}/consultation/nouvelle`, user: "admin", includes: ["NDIAYE"] },
  { file: "08-billing", url: `/encounters/${IDS.encounter2}/facturation`, user: "admin", includes: ["NDIAYE"] },
  { file: "09-payment-status", url: `/factures/${IDS.invoice1}`, user: "admin", includes: [IDS.invoice1Number, "Payée"] },
  { file: "10-receipt-preview", url: `/recus/${IDS.payment1}`, user: "admin", includes: [IDS.payment1Number, "République du Cameroun"] },
  { file: "11-audit-log", url: "/journal-audit", user: "admin", includes: ["Journal d'audit", "Action refusée"] },
  { file: "12-rbac-denied", url: "/", user: "reception", includes: ["Tableau de bord", "Patients"], excludes: ["Facturation", "Journal d'audit", "Administration"] },
  { file: "13-mobile-dashboard", url: "/", user: "admin", vw: 390, vh: 844, includes: ["Tableau de bord"] },
  { file: "14-rbac-audit-denied", url: "/journal-audit?action=authz.denied", user: "director", includes: ["Action refusée", "payment.record"] },
  { file: "15-receipt-full", url: `/recus/${IDS.payment1}`, user: "admin", full: true, vh: 2200, includes: [IDS.payment1Number, "Montant payé", "Caissier"] },
];

// --- Stakeholder demo set (approved one-patient golden path; demo hint hidden). ---
const STAKE_PAGES = [
  { file: "01-connexion", url: "/connexion", user: null, includes: ["Connexion", "Identifiant"], excludes: ["demo1234", "Comptes de démonstration"] },
  { file: "02-tableau-de-bord", url: "/", user: "admin", includes: ["Tableau de bord", "Encaissements du jour"] },
  { file: "03-recherche-patient", url: "/patients", user: "admin", includes: ["BELLO"] },
  { file: "04-dossier-patient", url: `/patients/${IDS.patient1}`, user: "admin", includes: [IDS.patient1Number, "BELLO"] },
  { file: "05-visite", url: `/encounters/${IDS.encounter1}`, user: "admin", includes: [IDS.encounter1Number] },
  { file: "06-facture-payee", url: `/factures/${IDS.invoice1}`, user: "admin", includes: [IDS.invoice1Number, "Payée"] },
  { file: "07-recu", url: `/recus/${IDS.payment1}`, user: "admin", includes: [IDS.payment1Number, "République du Cameroun"] },
  { file: "08-recu-complet", url: `/recus/${IDS.payment1}`, user: "admin", full: true, vh: 2200, includes: [IDS.payment1Number, "Montant payé", "Caissier"] },
  { file: "09-journal-audit", url: "/journal-audit", user: "admin", includes: ["Journal d'audit"] },
];

// --- Gate 4 set — UI/workflow screens over the Gate 3 services (two patients + Gate 4
//     demo enrichment from the fixture). Role-aware: each page uses the right actor. ---
const GATE4_PAGES = [
  { file: "01-administration-config", url: "/administration", user: "admin", includes: ["Administration", "Départements", "Unités de service"] },
  { file: "02-tarifs", url: "/administration/tarifs", user: "admin", includes: ["Tarifs", "Consultation médecine générale"] },
  { file: "03-patient-identite", url: `/patients/${IDS.patient1}`, user: "reception", includes: ["Identité & contacts", "HRB-2026-0001", "aucune fusion"] },
  { file: "04-consultation-clinique", url: `/encounters/${IDS.encounter1}`, user: "doctor", includes: ["Constantes", "Syndrome fébrile"] },
  { file: "05-facturation-tarifs", url: `/encounters/${IDS.encounter2}/facturation`, user: "cashier", includes: ["Consultation médecine générale"] },
  { file: "06-recu", url: `/recus/${IDS.payment1}`, user: "cashier", includes: [IDS.payment1Number, "République du Cameroun"] },
  { file: "07-journal-audit", url: "/journal-audit", user: "admin", includes: ["Journal d'audit", "Ajout contact patient"] },
];

// --- Gate 5B set — cashier daily report + user/account lifecycle. ---
const GATE5B_PAGES = [
  { file: "01-rapport-caisse", url: "/rapports-caisse", user: "cashier", includes: ["Rapport de caisse", IDS.payment1Number, "Total encaissé"] },
  { file: "02-utilisateurs", url: "/administration/utilisateurs", user: "admin", includes: ["Utilisateurs", "Awa NJOYA", "Créer un utilisateur", "Retour à l'administration"] },
];

const PAGES =
  SET === "stakeholder"
    ? STAKE_PAGES
    : SET === "gate4"
      ? GATE4_PAGES
      : SET === "gate5b"
        ? GATE5B_PAGES
        : REVIEW_PAGES;

// --- Nav placeholder routes: validated only (no screenshot) — must be clean French
//     pages with the prototype label, never a default 404 (item 5). ---
// NB: /administration is a real page since Gate 4 (configuration UI), so it is no longer
// a placeholder. The top-level /consultations and /facturation remain "à venir".
const CHECK_ONLY = [
  { url: "/consultations", user: "admin", includes: ["à venir"] },
  { url: "/facturation", user: "admin", includes: ["à venir"] },
];

async function connectCdp() {
  const PORT = 9300 + (process.pid % 500);
  const chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--remote-allow-origins=*",
    "--disable-gpu",
    "--hide-scrollbars",
    `--user-data-dir=${process.env.TMPDIR || "/tmp"}/chrome-review-${process.pid}`,
    "about:blank",
  ]);
  let wsUrl;
  for (let i = 0; i < 50 && !wsUrl; i++) {
    try {
      const targets = await (await fetch(`http://localhost:${PORT}/json/list`)).json();
      wsUrl = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl)
        ?.webSocketDebuggerUrl;
    } catch {}
    if (!wsUrl) await sleep(200);
  }
  if (!wsUrl) throw new Error("no Chrome page target");
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m.result);
      pending.delete(m.id);
    }
  });
  await new Promise((r) => ws.addEventListener("open", r));
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const mid = ++id;
      pending.set(mid, resolve);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  await send("Network.enable");
  await send("Page.enable");
  return { send, close: () => { ws.close(); chrome.kill(); } };
}

async function gotoAndText(send, url, session, vw, vh) {
  await send("Network.clearBrowserCookies");
  for (const c of session ?? [])
    await send("Network.setCookie", {
      name: c.name,
      value: c.value,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
    });
  if (session)
    await send("Network.setCookie", {
      name: "active_hospital",
      value: "hosp-hrb-demo",
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
    });
  await send("Emulation.setDeviceMetricsOverride", {
    width: vw,
    height: vh,
    deviceScaleFactor: 2,
    mobile: vw < 700,
  });
  await send("Page.navigate", { url: `${BASE}${url}` });
  await sleep(1800);
  const r = await send("Runtime.evaluate", {
    expression: "document.body.innerText",
    returnByValue: true,
  });
  return r?.result?.value ?? "";
}

function validate(label, text, { includes = [], excludes = [], requireProto = true }) {
  const errors = [];
  for (const f of FORBIDDEN_404)
    if (text.includes(f)) errors.push(`shows 404 ("${f}")`);
  if (requireProto && !text.includes(PROTO)) errors.push("missing prototype label");
  if (text.trim().length < 40) errors.push("empty/near-empty body");
  // Case-insensitive: innerText reflects RENDERED text, so CSS text-transform
  // (e.g. the receipt's uppercased official header) changes the casing.
  const hay = text.toLowerCase();
  for (const inc of includes)
    if (!hay.includes(inc.toLowerCase())) errors.push(`missing expected "${inc}"`);
  for (const exc of excludes)
    if (hay.includes(exc.toLowerCase())) errors.push(`unexpected "${exc}" present`);
  if (errors.length) throw new Error(`${label}: ${errors.join("; ")}`);
}

async function main() {
  mkdirSync(OUTDIR, { recursive: true });
  const neededUsers = new Set(
    [...PAGES, ...CHECK_ONLY].map((p) => p.user).filter(Boolean),
  );
  for (const u of neededUsers)
    if (!SESSIONS[u]) throw new Error(`missing session token for ${u}`);

  const { send, close } = await connectCdp();
  const failures = [];
  try {
    for (const c of CHECK_ONLY) {
      const text = await gotoAndText(send, c.url, cookiesFor(c.user), 1440, 900);
      try {
        validate(`check ${c.url}`, text, { includes: c.includes });
        console.log(`✓ nav ${c.url} — clean placeholder`);
      } catch (e) {
        failures.push(e.message);
        console.log(`✗ ${e.message}`);
      }
    }
    for (const p of PAGES) {
      const text = await gotoAndText(
        send,
        p.url,
        cookiesFor(p.user),
        p.vw ?? 1440,
        p.vh ?? 900,
      );
      try {
        validate(p.file, text, { includes: p.includes, excludes: p.excludes });
      } catch (e) {
        failures.push(e.message);
        console.log(`✗ ${e.message} — NOT saved`);
        continue;
      }
      // Full pages (whole receipt) use a tall viewport (set via p.vh) so the entire
      // document renders without the app shell's internal scroll clipping it.
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(`${OUTDIR}/${p.file}.png`, Buffer.from(data, "base64"));
      console.log(`✓ ${p.file}.png${p.full ? " (full receipt)" : ""}`);
    }
  } finally {
    close();
  }

  if (failures.length) {
    console.error(`\n✗ ${failures.length} page(s) failed validation:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`\n✓ All ${PAGES.length} screenshots captured and validated (no 404).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
