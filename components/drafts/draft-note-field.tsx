"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  draftKey,
  isDraftAutosaveAllowed,
  shouldPersistDraft,
  type DraftKind,
  type DraftSyncState,
} from "@/lib/draft-autosave";

/** Minimal promise-wrapped IndexedDB key/value store. All calls are defensive — any failure (or no
 *  IndexedDB, e.g. SSR / jsdom) resolves to a no-op so the form is never broken by draft protection. */
const DB_NAME = "hmis-drafts";
const STORE = "notes";

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        try {
          const db = open.result;
          const tx = db.transaction(STORE, mode);
          const req = fn(tx.objectStore(STORE));
          req.onsuccess = () => resolve((req.result as T) ?? null);
          req.onerror = () => resolve(null);
          tx.oncomplete = () => db.close();
        } catch {
          resolve(null);
        }
      };
    } catch {
      resolve(null);
    }
  });
}

const idbGet = (key: string) => withStore<string>("readonly", (s) => s.get(key));
const idbSet = (key: string, value: string) => withStore("readwrite", (s) => s.put(value, key));
const idbDel = (key: string) => withStore("readwrite", (s) => s.delete(key));

/**
 * A long-note textarea with local draft autosave (Phase 2J — IndexedDB, draft protection only). The
 * textarea keeps the given `name`/`id` so it submits exactly like a plain field. Drafts are NEVER
 * auto-restored into the field (no surprise overwrite); a recovered draft is offered via a button.
 * Refuses to autosave anything that is not an allow-listed long-note kind (`isDraftAutosaveAllowed`).
 */
export function DraftNoteField({
  kind,
  scopeId,
  id,
  name,
  rows = 3,
  placeholder,
  label,
}: {
  kind: DraftKind;
  scopeId: string;
  id: string;
  name: string;
  rows?: number;
  placeholder?: string;
  label: string;
}) {
  const t = useTranslations("draft");
  const ref = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<DraftSyncState>("idle");
  const [recovered, setRecovered] = useState<string | null>(null);

  const allowed = isDraftAutosaveAllowed(kind);
  const key = draftKey({ kind, scopeId });

  // On mount, surface any previously-saved draft (without auto-filling the field).
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    idbGet(key).then((value) => {
      if (active && value && value.trim()) setRecovered(value);
    });
    return () => {
      active = false;
    };
  }, [allowed, key]);

  function onChange() {
    if (!allowed) return;
    const value = ref.current?.value ?? "";
    if (timer.current) clearTimeout(timer.current);
    setState("saving");
    timer.current = setTimeout(async () => {
      if (shouldPersistDraft(value)) {
        const ok = await idbSet(key, value);
        setState(ok === null ? "error" : "saved");
      } else {
        await idbDel(key);
        setState("idle");
      }
    }, 800);
  }

  function restore() {
    if (ref.current && recovered != null) ref.current.value = recovered;
    setRecovered(null);
  }
  async function discard() {
    await idbDel(key);
    setRecovered(null);
    setState("idle");
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {allowed ? (
          <span className="text-muted-foreground text-xs" role="status">
            {state === "saving" ? t("saving") : state === "saved" ? t("savedLocal") : state === "error" ? t("error") : ""}
          </span>
        ) : null}
      </div>
      <textarea
        ref={ref}
        id={id}
        name={name}
        rows={rows}
        placeholder={placeholder}
        onChange={onChange}
        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-xs"
      />
      {recovered ? (
        <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs">
          <span className="text-muted-foreground">{t("recovered")}</span>
          <Button type="button" size="sm" variant="outline" onClick={restore}>
            {t("restore")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={discard}>
            {t("discard")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
