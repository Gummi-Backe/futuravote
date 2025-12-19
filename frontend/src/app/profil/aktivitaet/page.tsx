import { Suspense } from "react";
import { ProfilAktivitaetClient } from "./ProfilAktivitaetClient";

export const dynamic = "force-dynamic";

export default function ProfilAktivitaetPage() {
  return (
    <Suspense fallback={null}>
      <ProfilAktivitaetClient />
    </Suspense>
  );
}

