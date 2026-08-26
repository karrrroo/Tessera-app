"use client";

import { useEffect, useState } from "react";
import { adminApi, type AcademicYear } from "@/lib/api/admin";

// No screen in this phase needs to manage multiple academic years at once —
// this always resolves to the most recently-started one. A year switcher,
// if ever needed, belongs to whichever later phase first needs to look at
// a prior year's data.
export function useCurrentAcademicYear() {
  const [year, setYear] = useState<AcademicYear | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    adminApi.listAcademicYears().then((years) => {
      if (cancelled) return;
      const sorted = [...years].sort((a, b) => b.startsOn.localeCompare(a.startsOn));
      setYear(sorted[0] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return year; // undefined = loading, null = none exist yet
}
