// app/(app)/scan/page.tsx
"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { QrScanner } from "../../../components/QrScanner";

export default function ScanPage() {
  const [manualCode, setManualCode] = useState("");
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null);
  const [cameraFailed, setCameraFailed] = useState(false);
  const router = useRouter();

  const handleScan = useCallback(
    async (code: string) => {
      const res = await fetch(`/api/items/lookup-by-code?code=${encodeURIComponent(code)}`);
      const body = await res.json();
      if (body.item) {
        router.push(`/items/${body.item.id}`);
      } else {
        setNotFoundCode(code);
      }
    },
    [router]
  );

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-stone-800">Scan a code</h1>

      {!cameraFailed && (
        <QrScanner onScan={handleScan} onCameraError={() => setCameraFailed(true)} />
      )}

      {cameraFailed && (
        <p className="text-sm text-stone-600">
          Couldn&apos;t access the camera. Enter the code manually below.
        </p>
      )}

      {notFoundCode && (
        <div className="rounded-lg bg-orange-50 p-3 text-center">
          <p className="text-sm text-stone-600">No item found for code “{notFoundCode}”.</p>
          <button
            onClick={() => router.push(`/items/new?code=${encodeURIComponent(notFoundCode)}`)}
            className="mt-2 rounded-lg bg-orange-400 px-4 py-2 text-white"
          >
            Create new item with this code
          </button>
        </div>
      )}

      <details className="text-sm text-stone-500" open={cameraFailed}>
        <summary>Camera not working? Enter the code manually.</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleScan(manualCode);
          }}
          className="mt-2 flex gap-2"
        >
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="flex-1 rounded-lg border border-orange-200 p-2"
            placeholder="e.g. bb_x7f2a9"
          />
          <button type="submit" className="rounded-lg bg-stone-800 px-3 py-2 text-white">
            Look up
          </button>
        </form>
      </details>
    </main>
  );
}
