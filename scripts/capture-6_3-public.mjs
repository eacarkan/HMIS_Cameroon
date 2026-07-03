import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

/**
 * Phase 6.3 S3 public-surface evidence capturer.
 *
 * Captures the four public pages (home, showcase, demo-access, login) in FR/EN plus a
 * mobile home, against a RUNNING dev server. No auth: every target is a public route;
 * the active locale is driven by the `locale` cookie (i18n/request.ts LOCALE_COOKIE).
 *
 * Each page is validated BEFORE its PNG is written: it must contain the review-environment
 * wording and MUST NOT contain the remediated-away strings (official Ministry header,
 * the literal "non production", the old showcase title, or the env placeholder token).
 * Any failure aborts with a non-zero exit and NO screenshot is written for that page.
 *
 * Env: BASE_URL (default http://localhost:3000), OUTDIR
 * (default docs/qa-command-output/web-deployment/6_3), CHROME_BIN.
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUTDIR =
  process.env.OUTDIR || "docs/qa-command-output/web-deployment/6_3";
const CHROME =
  process.env.CHROME_BIN ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Strings that must NEVER appear on a public surface after S3 remediation.
// NB: "Ministère de la Santé Publique" is NOT forbidden outright — it legitimately
// appears inside the negating disclaimer ("Ce n'est pas un site officiel du Ministère…").
// The official-header signature is "République du Cameroun", which appears in no
// disclaimer, so it is the precise, unambiguous forbidden marker for the old header.
const GLOBAL_FORBIDDEN = [
  "This page could not be found",
  "RÉPUBLIQUE DU CAMEROUN",
  "Une plateforme réelle",
  "non production",
  "<optional-public-demo-password-or-hint>",
];

const PAGES = [
  {
    file: "01-accueil-fr",
    url: "/accueil",
    locale: "fr",
    includes: [
      "Environnement de revue — données synthétiques",
      "Plateforme intégrée de gestion hospitalière",
      "Ce n'est pas un site officiel", // notGovernment negating disclaimer stays
    ],
  },
  {
    file: "02-accueil-en",
    url: "/accueil",
    locale: "en",
    includes: [
      "Review environment — synthetic data",
      "Integrated Hospital Management Platform",
      "not an official Ministry of Public Health website",
    ],
  },
  {
    file: "03-vitrine-fr",
    url: "/vitrine",
    locale: "fr",
    includes: [
      "Environnement de revue en ligne et vérifié",
      "hors Gate 7",
    ],
  },
  {
    file: "04-acces-demo-fr",
    url: "/acces-demo",
    locale: "fr",
    includes: ["Accès à l'environnement de revue", "solange.abena@hrb-demo.cm"],
  },
  {
    file: "05-connexion-fr",
    url: "/connexion",
    locale: "fr",
    includes: ["SantéGrid — SIGH/DME", "Environnement de revue pour hôpitaux régionaux"],
  },
  {
    file: "06-connexion-en",
    url: "/connexion",
    locale: "en",
    includes: ["SantéGrid — HMIS/EMR", "Review environment for regional hospitals"],
  },
  {
    file: "07-mobile-accueil-fr",
    url: "/accueil",
    locale: "fr",
    vw: 390,
    vh: 844,
    includes: ["Environnement de revue — données synthétiques"],
  },
];

async function connectCdp() {
  const PORT = 9300 + (process.pid % 500);
  const chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--remote-allow-origins=*",
    "--disable-gpu",
    "--hide-scrollbars",
    `--user-data-dir=${process.env.TMPDIR || "/tmp"}/chrome-6_3-${process.pid}`,
    "about:blank",
  ]);
  let wsUrl;
  for (let i = 0; i < 50 && !wsUrl; i++) {
    try {
      const targets = await (
        await fetch(`http://localhost:${PORT}/json/list`)
      ).json();
      wsUrl = targets.find(
        (t) => t.type === "page" && t.webSocketDebuggerUrl,
      )?.webSocketDebuggerUrl;
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
  return {
    send,
    close: () => {
      ws.close();
      chrome.kill();
    },
  };
}

const COOKIE_DOMAIN = new URL(BASE).hostname; // localhost for dev, www.santegrid.com for live

async function gotoAndText(send, url, locale, vw, vh) {
  await send("Network.clearBrowserCookies");
  await send("Network.setCookie", {
    name: "locale",
    value: locale,
    domain: COOKIE_DOMAIN,
    path: "/",
    secure: BASE.startsWith("https"),
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

function validate(label, text, includes) {
  const errors = [];
  for (const f of GLOBAL_FORBIDDEN)
    if (text.toLowerCase().includes(f.toLowerCase()))
      errors.push(`FORBIDDEN "${f}" present`);
  if (text.trim().length < 40) errors.push("empty/near-empty body");
  const hay = text.toLowerCase();
  // Any FR Ministry mention must be the negating "not an official Ministry site"
  // disclaimer — never a bare header claim.
  if (
    hay.includes("ministère de la santé publique") &&
    !hay.includes("n'est pas un site officiel")
  )
    errors.push("Ministry mentioned without the negating disclaimer");
  for (const inc of includes)
    if (!hay.includes(inc.toLowerCase())) errors.push(`missing expected "${inc}"`);
  if (errors.length) throw new Error(`${label}: ${errors.join("; ")}`);
}

async function main() {
  mkdirSync(OUTDIR, { recursive: true });
  const { send, close } = await connectCdp();
  const failures = [];
  try {
    for (const p of PAGES) {
      const text = await gotoAndText(
        send,
        p.url,
        p.locale,
        p.vw ?? 1440,
        p.vh ?? 900,
      );
      try {
        validate(p.file, text, p.includes);
      } catch (e) {
        failures.push(e.message);
        console.log(`✗ ${e.message} — NOT saved`);
        continue;
      }
      const { data } = await send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
      });
      writeFileSync(`${OUTDIR}/${p.file}.png`, Buffer.from(data, "base64"));
      console.log(`✓ ${p.file}.png`);
    }
  } finally {
    close();
  }
  if (failures.length) {
    console.error(`\n✗ ${failures.length} page(s) failed validation:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`\n✓ All ${PAGES.length} public evidence screenshots captured + validated.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
