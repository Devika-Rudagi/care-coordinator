import type { SupabaseClient } from "@supabase/supabase-js";

type Cadence =
  | { kind: "as_needed" }
  | {
      kind: "scheduled";
      times: string[]; // "HH:MM", 24hr, UTC
      intervalDays: number; // 1 = daily, 2 = every other day, 7 = weekly
      durationDays: number | null; // null = ongoing/no stated end
    };

/**
 * Generates evenly-spaced clock times across a day for a "every N hours"
 * cadence (e.g. Q6H), anchored at 08:00 so schedules read naturally
 * (08:00, 14:00, 20:00, 02:00 for Q6H) rather than starting at midnight.
 */
function timesForHourlyInterval(hours: number): string[] {
  const times: string[] = [];
  const count = Math.max(1, Math.round(24 / hours));
  let h = 8;
  for (let i = 0; i < count; i++) {
    const wrapped = ((h % 24) + 24) % 24;
    times.push(`${String(wrapped).padStart(2, "0")}:00`);
    h += hours;
  }
  return times.sort();
}

/**
 * Pulls a stated course length out of free text, e.g. "× 5 days",
 * "x 5 days", or "for 5 days". Returns null if no duration is stated
 * (treated as an ongoing/ indefinite medication).
 */
function parseDurationDays(freq: string): number | null {
  const match = freq.match(/(?:×|x|for)\s*(\d+)\s*days?/i);
  return match ? parseInt(match[1], 10) : null;
}

function parseCadence(frequency: string, timesOfDay: string[] | null): Cadence {
  const freq = (frequency || "").toLowerCase();
  const durationDays = parseDurationDays(freq);

  // PRN / as-needed takes priority even if a max frequency like "Q6H" is
  // also stated (e.g. "Q6H PRN severe pain") — clinically this means "up
  // to every 6 hours if needed," not a fixed schedule to generate tasks for.
  if (freq.includes("as needed") || freq.includes("prn")) {
    return { kind: "as_needed" };
  }

  // Clinical shorthand: Q#H (every N hours)
  const qHourMatch = freq.match(/q(\d{1,2})h/i);
  if (qHourMatch) {
    const hours = parseInt(qHourMatch[1], 10);
    return {
      kind: "scheduled",
      times: timesOfDay?.length ? timesOfDay : timesForHourlyInterval(hours),
      intervalDays: 1,
      durationDays,
    };
  }

  // Clinical shorthand: BID / TID / QID / QD
  if (/\bbid\b/.test(freq)) {
    return {
      kind: "scheduled",
      times: timesOfDay?.length ? timesOfDay : ["08:00", "20:00"],
      intervalDays: 1,
      durationDays,
    };
  }
  if (/\btid\b/.test(freq)) {
    return {
      kind: "scheduled",
      times: timesOfDay?.length ? timesOfDay : ["08:00", "14:00", "20:00"],
      intervalDays: 1,
      durationDays,
    };
  }
  if (/\bqid\b/.test(freq)) {
    return {
      kind: "scheduled",
      times: timesOfDay?.length
        ? timesOfDay
        : ["08:00", "12:00", "16:00", "20:00"],
      intervalDays: 1,
      durationDays,
    };
  }
  if (/\bqd\b|\bqday\b/.test(freq)) {
    return {
      kind: "scheduled",
      times: timesOfDay?.length ? timesOfDay : ["09:00"],
      intervalDays: 1,
      durationDays,
    };
  }

  if (freq.includes("every other day") || freq.includes("alternate")) {
    return {
      kind: "scheduled",
      times: timesOfDay?.length ? timesOfDay : ["09:00"],
      intervalDays: 2,
      durationDays,
    };
  }

  if (freq.includes("week")) {
    return {
      kind: "scheduled",
      times: timesOfDay?.length ? timesOfDay : ["09:00"],
      intervalDays: 7,
      durationDays,
    };
  }

  // Plain-English fallback: "twice daily", "three times", etc.
  let timesPerDay = 1;
  if (freq.includes("twice") || freq.includes("two times")) timesPerDay = 2;
  else if (freq.includes("three times")) timesPerDay = 3;
  else if (freq.includes("four times")) timesPerDay = 4;

  const defaults: Record<number, string[]> = {
    1: ["09:00"],
    2: ["08:00", "20:00"],
    3: ["08:00", "14:00", "20:00"],
    4: ["08:00", "12:00", "16:00", "20:00"],
  };

  return {
    kind: "scheduled",
    times: timesOfDay?.length === timesPerDay ? timesOfDay : defaults[timesPerDay],
    intervalDays: 1,
    durationDays,
  };
}

function daysSince(dateStr: string, reference: Date) {
  const start = new Date(dateStr);
  return Math.floor((reference.getTime() - start.getTime()) / 86400000);
}

export async function ensureDailyInstances(
  patientId: string,
  supabase: SupabaseClient,
) {
  const { data: templates } = await supabase
    .from("task_templates")
    .select("*")
    .eq("patient_id", patientId)
    .eq("type", "medication");

  if (!templates) return;

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  for (const template of templates) {
    const cadence = parseCadence(template.frequency, template.times_of_day);
    if (cadence.kind === "as_needed") continue;

    const elapsedDays = daysSince(template.created_at, today);

    // Course finished — e.g. "x 5 days" and today is day 6 or later.
    // Stop generating new instances rather than continuing indefinitely.
    if (cadence.durationDays !== null && elapsedDays >= cadence.durationDays) {
      continue;
    }

    // Interval cadence (every-other-day / weekly) — skip days that don't
    // land on the interval.
    if (elapsedDays % cadence.intervalDays !== 0) continue;

    const { data: todaysInstances } = await supabase
      .from("task_instances")
      .select("scheduled_for")
      .eq("template_id", template.id)
      .gte("scheduled_for", `${todayStr}T00:00:00Z`)
      .lt("scheduled_for", `${todayStr}T23:59:59Z`);

    const existingTimes = new Set(
      (todaysInstances || []).map((t) => {
        const d = new Date(t.scheduled_for);
        return `${String(d.getUTCHours()).padStart(2, "0")}:${String(
          d.getUTCMinutes(),
        ).padStart(2, "0")}`;
      }),
    );

    for (const time of cadence.times) {
      if (existingTimes.has(time)) continue;
      await supabase.from("task_instances").insert({
        template_id: template.id,
        patient_id: patientId,
        scheduled_for: `${todayStr}T${time}:00Z`,
        status: "pending",
      });
    }
  }
}
