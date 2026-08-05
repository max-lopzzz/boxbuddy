// components/QrScanner.tsx
"use client";

import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

const SCANNER_ELEMENT_ID = "qr-scanner-region";

export function QrScanner({
  onScan,
  onCameraError,
}: {
  onScan: (code: string) => void;
  onCameraError: () => void;
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;
    let cancelled = false;
    let started = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          onScan(decodedText);
        },
        () => {
          // decode-attempt errors fire continuously while scanning; ignore them
        }
      )
      .then(() => {
        started = true;
        if (cancelled) {
          // Unmounted while start() was still pending — stop it now that it's actually running.
          scanner.stop().catch(() => {});
        }
      })
      .catch(() => {
        onCameraError();
      });

    return () => {
      cancelled = true;
      if (started) {
        scanner.stop().catch(() => {});
      }
    };
  }, [onScan, onCameraError]);

  return <div id={SCANNER_ELEMENT_ID} className="mx-auto w-full max-w-sm" />;
}
