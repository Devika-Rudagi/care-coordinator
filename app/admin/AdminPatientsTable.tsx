"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, Badge, criticalityTone } from "../components/ui";

export type PatientRow = {
  id: string;
  name: string;
  criticality: string;
  needs_extra_care: boolean;
  discharge_date: string;
  caregiverNames: string[];
  overdueCount: number;
};

type SortColumn =
  | "name"
  | "criticality"
  | "discharge_date"
  | "overdue"
  | "extra_care"
  | null; // null = default priority sort (overdue desc, then criticality)

const criticalityRank: Record<string, number> = { high: 2, medium: 1, low: 0 };

export default function AdminPatientsTable({
  patients,
}: {
  patients: PatientRow[];
}) {
  const [search, setSearch] = useState("");
  const [caregiverFilter, setCaregiverFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const allCaregivers = useMemo(() => {
    const set = new Set<string>();
    patients.forEach((p) => p.caregiverNames.forEach((n) => set.add(n)));
    return Array.from(set).sort();
  }, [patients]);

  function toggleSort(col: Exclude<SortColumn, null>) {
    if (sortColumn === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    return patients.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (caregiverFilter && !p.caregiverNames.includes(caregiverFilter))
        return false;
      if (dateFrom && p.discharge_date < dateFrom) return false;
      if (dateTo && p.discharge_date > dateTo) return false;
      return true;
    });
  }, [patients, search, caregiverFilter, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    if (sortColumn === null) {
      // Default: most urgent first — overdue count, then criticality
      rows.sort((a, b) => {
        if (a.overdueCount !== b.overdueCount)
          return b.overdueCount - a.overdueCount;
        return (
          (criticalityRank[b.criticality] ?? 1) -
          (criticalityRank[a.criticality] ?? 1)
        );
      });
      return rows;
    }
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      switch (sortColumn) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "criticality":
          return (
            ((criticalityRank[a.criticality] ?? 1) -
              (criticalityRank[b.criticality] ?? 1)) *
            dir
          );
        case "discharge_date":
          return a.discharge_date.localeCompare(b.discharge_date) * dir;
        case "overdue":
          return (a.overdueCount - b.overdueCount) * dir;
        case "extra_care":
          return (
            (Number(a.needs_extra_care) - Number(b.needs_extra_care)) * dir
          );
        default:
          return 0;
      }
    });
    return rows;
  }, [filtered, sortColumn, sortDir]);

  function SortHeader({
    col,
    label,
    align = "left",
  }: {
    col: Exclude<SortColumn, null>;
    label: string;
    align?: "left" | "center";
  }) {
    const active = sortColumn === col;
    return (
      <th
        onClick={() => toggleSort(col)}
        className={`px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide cursor-pointer select-none hover:text-slate-600 ${
          active ? "text-teal-600" : "text-slate-400"
        } ${align === "center" ? "text-center" : "text-left"}`}
      >
        {label} {active ? (sortDir === "asc" ? "▲" : "▼") : ""}
      </th>
    );
  }

  return (
    <div>
      {/* Toolbar: search, caregiver filter, date range */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-100 w-48"
        />
        <select
          value={caregiverFilter}
          onChange={(e) => setCaregiverFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:border-teal-500"
        >
          <option value="">All caregivers</option>
          {allCaregivers.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <span>Discharged</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:border-teal-500"
          />
          <span>–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:border-teal-500"
          />
        </div>
        {(search || caregiverFilter || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setSearch("");
              setCaregiverFilter("");
              setDateFrom("");
              setDateTo("");
            }}
            className="text-xs text-teal-600 hover:underline"
          >
            Clear filters
          </button>
        )}
        <span className="text-xs text-slate-400 ml-auto">
          {sorted.length} of {patients.length} patients
          {sortColumn === null && " — sorted by urgency"}
        </span>
      </div>

      {/* Fixed-height frame — the table scrolls within itself, with a
          sticky header, so the page doesn't grow as patients scale into
          the dozens or hundreds. */}
      <div className="max-h-[480px] overflow-y-auto border border-slate-100 rounded-xl">
        <table className="w-full text-sm table-fixed">
          <thead className="sticky top-0 bg-white z-10 shadow-sm shadow-slate-900/5">
            <tr className="border-b border-slate-100">
              <SortHeader col="name" label="Patient" />
              <SortHeader col="criticality" label="Criticality" />
              <th className="px-4 py-2.5 text-[11px] font-medium text-slate-400 uppercase tracking-wide text-left">
                Caregivers
              </th>
              <SortHeader col="discharge_date" label="Discharged" />
              <SortHeader col="overdue" label="Overdue" align="center" />
              <SortHeader col="extra_care" label="Extra care" align="center" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-slate-400"
                >
                  No patients match these filters.
                </td>
              </tr>
            ) : (
              sorted.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/patient/${p.id}`}
                      className="flex items-center gap-2.5"
                    >
                      <Avatar name={p.name} size="sm" />
                      <span className="font-medium text-slate-900 text-sm truncate">
                        {p.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={criticalityTone[p.criticality] ?? "slate"}>
                      {p.criticality}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-slate-500 text-xs truncate">
                    {p.caregiverNames.length > 0
                      ? p.caregiverNames.join(", ")
                      : "No caregivers yet"}
                  </td>
                  <td className="px-4 py-2 text-slate-500 text-xs">
                    {p.discharge_date}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {p.overdueCount > 0 ? (
                      <Badge tone="rose">{p.overdueCount}</Badge>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {p.needs_extra_care ? (
                      <Badge tone="blue">Yes</Badge>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
