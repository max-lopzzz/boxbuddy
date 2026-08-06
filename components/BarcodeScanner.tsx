// components/BarcodeScanner.tsx
"use client";

import { useEffect, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

const SCANNER_ELEMENT_ID = "barcode-scanner-region";

export function BarcodeScanner({
  onScan,
  onCameraError,
  formatsToSupport,
}: {
  onScan: (code: string) => void;
  onCameraError: () => void;
  formatsToSupport?: Html5QrcodeSupportedFormats[];
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode(
      SCANNER_ELEMENT_ID,
      formatsToSupport ? { formatsToSupport, verbose: false } : undefined
    );
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
  }, [onScan, onCameraError, formatsToSupport]);

  return <div id={SCANNER_ELEMENT_ID} className="mx-auto w-full max-w-sm" />;
}
