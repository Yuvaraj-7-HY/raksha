"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function MedicinesAddRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.toString();
    router.replace(q ? `/patients/add-medication?${q}` : "/patients/add-medication");
  }, [router, searchParams]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F9FAFB" }}>
      <p style={{ fontSize: 14, color: "#6B7280" }}>Redirecting to medication form...</p>
    </div>
  );
}

export default function MedicinesAddPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#F9FAFB" }} />}>
      <MedicinesAddRedirectContent />
    </Suspense>
  );
}
