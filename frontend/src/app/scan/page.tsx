"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// No design precedent (roadmap Phase 6 C13: "build from primitives") — a
// door reader is a device, not a signed-in Tessera user (ID-9's own
// rationale: there is no `scanner` role), so this route sits outside both
// (app) and (auth) and is gated by a device-entered scanner key stored in
// localStorage, not a JWT. Plain English throughout: this is an
// operational tool for school staff at a door, not localized product
// copy, matching the admin module's own "no design precedent" precedent
// (nav-items.ts's STATIC_LABELS). Colors still go through the token file
// (tessera.css) like everywhere else in the app — --ok/--danger for the
// pass/fail backdrop, everything else the same neutral tokens admin uses.
const CONFIG_KEY = "tessera.scanner.config";

type ScannerConfig = { key: string; scannerId: string; location: string };

type VerifyResponse = {
  result: "valid" | "revoked" | "unknown" | "signature_invalid" | "not_enrolled";
  student?: { firstName: string; lastName: string; classLabel: string | null; institutionName: string; enrollmentStatus: string | null };
  anomaly?: { flagged: boolean; reason?: string; previousScannerId?: string; secondsAgo?: number };
};

function readConfig(): ScannerConfig | null {
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as ScannerConfig) : null;
  } catch {
    return null;
  }
}

function writeConfig(config: ScannerConfig) {
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    // this device just won't remember its config across reloads
  }
}

const PASS_RESULTS = new Set(["valid"]);
const RESULT_LABEL: Record<VerifyResponse["result"], string> = {
  valid: "VALID",
  revoked: "REVOKED",
  unknown: "UNKNOWN CODE",
  signature_invalid: "TAMPERED CODE",
  not_enrolled: "NOT ENROLLED",
};

export default function ScanPage() {
  const [config, setConfig] = useState<ScannerConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [supported, setSupported] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ response: VerifyResponse } | { error: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    // Reads localStorage/window, unavailable during SSR — has to happen
    // after mount, and there's no external callback to hang it off.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfig(readConfig());
    setConfigLoaded(true);
    setSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  useEffect(() => {
    if (!config || !supported) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });

    async function verify(payload: string) {
      busyRef.current = true;
      try {
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Scanner-Key": config!.key },
          body: JSON.stringify({ payload, scannerId: config!.scannerId, location: config!.location || undefined }),
        });
        if (res.status === 401) {
          setOutcome({ error: "Scanner key rejected — check setup." });
        } else if (!res.ok) {
          // SCAN_PAYLOAD_MALFORMED and the like — a request-shape error,
          // not one of the five `result` values, and not printed to
          // whoever's standing at the door as a raw error code.
          setOutcome({ error: "Could not read that code — try again." });
        } else {
          setOutcome({ response: (await res.json()) as VerifyResponse });
        }
      } catch {
        setOutcome({ error: "Network unreachable — try again." });
      }
      window.setTimeout(() => {
        busyRef.current = false;
        setOutcome(null);
      }, 2500);
    }

    async function tick() {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA && !busyRef.current) {
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) void verify(codes[0].rawValue);
        } catch {
          // a transient decode failure on one frame — just try the next one
        }
      }
      raf = requestAnimationFrame(tick);
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
        raf = requestAnimationFrame(tick);
      })
      .catch((err) => setCameraError(String(err instanceof Error ? err.message : err)));

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [config, supported]);

  if (!configLoaded) return null;

  if (!config) {
    return <ScannerSetup onSaved={setConfig} />;
  }

  if (!supported) {
    return (
      <Screen bg="var(--danger)" fg="var(--danger-fg)">
        <p>This browser has no built-in barcode scanner (BarcodeDetector).</p>
        <p>Use an up-to-date Chrome/Edge on Android, or a device known to support it.</p>
      </Screen>
    );
  }

  if (cameraError) {
    return (
      <Screen bg="var(--danger)" fg="var(--danger-fg)">
        <p>Camera unavailable: {cameraError}</p>
      </Screen>
    );
  }

  if (outcome) {
    if ("error" in outcome) {
      return (
        <Screen bg="var(--danger)" fg="var(--danger-fg)">
          <p style={{ fontSize: 28, fontWeight: 700 }}>ERROR</p>
          <p>{outcome.error}</p>
        </Screen>
      );
    }
    const pass = PASS_RESULTS.has(outcome.response.result);
    return (
      <Screen bg={pass ? "var(--ok)" : "var(--danger)"} fg={pass ? "var(--ok-fg)" : "var(--danger-fg)"}>
        <p style={{ fontSize: 40, fontWeight: 800, letterSpacing: 1 }}>{RESULT_LABEL[outcome.response.result]}</p>
        {outcome.response.student && (
          <>
            <p style={{ fontSize: 26 }}>
              {outcome.response.student.firstName} {outcome.response.student.lastName}
            </p>
            <p style={{ fontSize: 18, opacity: 0.8 }}>{outcome.response.student.classLabel ?? "—"}</p>
          </>
        )}
        {outcome.response.anomaly?.flagged && (
          <p style={{ fontSize: 16, marginTop: 16 }}>
            FLAGGED — also scanned at {outcome.response.anomaly.previousScannerId} {outcome.response.anomaly.secondsAgo}s ago
          </p>
        )}
      </Screen>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--panel)" }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "var(--ink)",
          fontSize: 16,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {config.scannerId}
        {config.location ? ` · ${config.location}` : ""}
      </div>
      <button
        type="button"
        onClick={() => {
          window.localStorage.removeItem(CONFIG_KEY);
          setConfig(null);
        }}
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          background: "var(--glass-solid)",
          color: "var(--ink)",
          border: "none",
          borderRadius: 8,
          padding: "6px 10px",
          fontSize: 12,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        Reconfigure
      </button>
    </div>
  );
}

function Screen({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: bg,
        color: fg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        textAlign: "center",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  );
}

function ScannerSetup({ onSaved }: { onSaved: (config: ScannerConfig) => void }) {
  const [key, setKey] = useState("");
  const [scannerId, setScannerId] = useState("");
  const [location, setLocation] = useState("");

  const save = useCallback(() => {
    if (!key || !scannerId) return;
    const config = { key, scannerId, location };
    writeConfig(config);
    onSaved(config);
  }, [key, scannerId, location, onSaved]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        background: "var(--bg-base)",
        color: "var(--ink)",
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Scanner setup</h1>
      <p style={{ fontSize: 13, opacity: 0.7, maxWidth: 320, textAlign: "center" }}>
        One-time setup for this device. Ask the school administrator for the scanner key.
      </p>
      <input
        type="password"
        placeholder="Scanner key"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        style={{ width: 280, padding: 10, borderRadius: 8, border: "1px solid var(--hair)", background: "var(--surface2)", color: "var(--ink)" }}
      />
      <input
        placeholder="Device label (e.g. gate-north)"
        value={scannerId}
        onChange={(e) => setScannerId(e.target.value)}
        style={{ width: 280, padding: 10, borderRadius: 8, border: "1px solid var(--hair)", background: "var(--surface2)", color: "var(--ink)" }}
      />
      <input
        placeholder="Location (optional, e.g. Main entrance)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        style={{ width: 280, padding: 10, borderRadius: 8, border: "1px solid var(--hair)", background: "var(--surface2)", color: "var(--ink)" }}
      />
      <button
        type="button"
        onClick={save}
        disabled={!key || !scannerId}
        className="disabled:opacity-50"
        style={{
          width: 280,
          padding: 12,
          borderRadius: 999,
          border: "none",
          background: "var(--accent)",
          color: "var(--accent-fg)",
          fontWeight: 600,
        }}
      >
        Start scanning
      </button>
    </div>
  );
}
