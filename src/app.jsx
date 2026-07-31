const { useState, useEffect, useRef } = React;

// Stamped by scripts/build.js at build time (string-replaced post-compile —
// see build.js) so a stale cached build is identifiable on the device
// instead of silently running fixed-but-not-yet-deployed code.
const BUILD_INFO = { sha: "__BUILD_SHA__", builtAt: "__BUILD_TIME__" };
function formatBuildStamp() {
  const d = new Date(BUILD_INFO.builtAt);
  const when = isNaN(d.getTime())
    ? BUILD_INFO.builtAt
    : d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
  return "build " + BUILD_INFO.sha + " · " + when;
}

// ── Block State ───────────────────────────────────────────────────────────────
const BLOCK = {
  flags: [
    "ON BLOOD THINNERS (PE precaution, likely false positive) — NO contact or fall-risk activity. No failure/grinding reps: strains bruise and bleed more. Keep working sets RPE \u22648; a 'test' is a controlled top set leaving 2+ in reserve. No restriction on aerobic conditioning.",
    "Hockey SUSPENDED. Weekly TENNIS is the skating-prep substitute (repeated-sprint + lateral movement). Ease in — 60 min hitting, not hard competitive singles.",
    "LEGS A/B: A = heavy 8-10, quad emphasis. B = higher-rep 12-15, posterior emphasis (Leg Press ~140-155, Leg Curl ~75). Keep \u226548h apart.",
    "STAIRMASTER FINISHER on every session. Hard on push/pull days (12-15 min, L4-5 steady). EASY on legs days (8-10 min, L2-3) — don't tax what you just trained. Build duration before level. Change ONE variable at a time.",
    "PROGRESSION VALIDITY: run the lift you want to advance FIRST, while fresh. Reps logged late in a session are fatigue artifacts, not regressions. Confirmed repeatedly: shoulder press 90\u219275 and lateral raise RPE 8 both came from queue position, not loss of strength.",
    "Groin asymmetry (L>R) — daily butterfly + lateral lunge holds. Extra relevant now that tennis is in: adductor strain is the classic first-week-back injury.",
    "Left knee below patella — monitor all squat/hinge. Bilateral leg press only. Bail on Leg Press or Goblet if it bites.",
    "Hamstring / low back — RESOLVED, keep monitoring. Leg Curl 90 collapsed to 6 reps with low-back compensation on 7/22, then hit clean 10s on both 7/26 and 7/29. Keep foam rolling before legs; stop the set if the back starts taking over.",
    "Thumb — watch on Shoulder Press; prior 75 ceiling, now clean at 90.",
    "Elbow — Skull Crusher pull/stretch is normal adaptation; sharp pain is a stop signal.",
    "Core stack on any non-lifting day: dead bug, bird dog, side plank, Pallof press, RKC plank."
  ],
  sessions: {
    legs: {
      label: "Legs",
      color: "#3B6D11",
      bg: "#EAF3DE",
      movements: [
        { name: "Leg Press", current: "185 lb", workSets: 3, reps: 10, target: "BANK 185 at RPE 7 \u2014 test passed 7/29 (185x10x2 @ RPE 8) but that's the rep ceiling. Two clean sessions at RPE 7, then TEST 200. Fresh opener, straight sets, 2-2.5 min rest." },
        { name: "Leg Extension", current: "150 lb", workSets: 2, reps: 10, target: "TEST 165 \u2014 broke the 8-rep wall: 150x10x2 @ RPE 8 (7/26) then @ RPE 7 (7/29). The old plateau was fatigue placement, not a ceiling." },
        { name: "Leg Curl", current: "90 lb", workSets: 2, reps: 10, target: "One more clean 10x10 @ 90, RPE \u22647, then TEST 105. Low-back compensation resolved (clean 7/26 and 7/29). Stop the set if the back takes over." },
        { name: "Goblet Squat", current: "50 lb", workSets: 2, reps: 10, target: "Two clean sessions at 50 (10 @ RPE 7 then 8 on 7/29), then 55. Controlled depth, knee-monitor." },
        { name: "Calf Raise", current: "40 lb", workSets: 3, reps: 15, target: "TEST 45 \u2014 40x20x3 @ RPE 6-7 (7/29) was the easiest pass of the day. Superset with Leg Extension." }
      ]
    },
    push: {
      label: "Push",
      color: "#185FA5",
      bg: "#E6F1FB",
      movements: [
        { name: "Chest Press", current: "120 lb", workSets: 2, reps: 10, target: "TEST 135 \u2014 second clean 10/10 @ RPE 7-8 as fresh opener (7/28). Run this FIRST." },
        { name: "Shoulder Press", current: "90 lb", workSets: 2, reps: 10, target: "HOLD 90 \u2014 needs a FRESH lead to confirm. Hit 90x10x2 when run first (7/5), dropped to 75x8 @ RPE 8 when run second (7/28). Confirm then 105. Thumb watch." },
        { name: "Pec Fly", current: "120 lb", workSets: 2, reps: 10, target: "TEST 135 \u2014 120x10x2 @ RPE 7 (7/28), room to spare. Superset with Lateral Raise." },
        { name: "Rope Pushdown", current: "42.5 lb", workSets: 2, reps: 10, target: "Confirm 2nd clean 10/10 @ 42.5 then 47.5. Skipped 7/28 (machine in use). Superset with Skull Crusher." },
        { name: "Lateral Raise", current: "15 lb", workSets: 2, reps: 12, target: "Back to 15 and run EARLIER \u2014 12x10x4 reached RPE 8 at position #4 (7/28). 15x10x2 already done 7/5." },
        { name: "Skull Crusher", current: "20 lb", workSets: 2, reps: 10, target: "TEST 25 \u2014 20x10x4 @ RPE 6-7 (7/28), elbow quiet. Sharp pain = stop." }
      ]
    },
    pull: {
      label: "Pull",
      color: "#3C3489",
      bg: "#EEEDFE",
      movements: [
        { name: "DB Row", current: "50 lb", workSets: 2, reps: 10, target: "Build 8-10 @ 50 \u2014 45x10 @ RPE 7 as fresh opener (7/25), best DB Row log to date. Keep LEADING the session with this; it's fatigue-sensitive." },
        { name: "Seated Row", current: "135 lb", workSets: 2, reps: 10, target: "Back to 135 \u2014 build clean 10/10 then 150. (7/25 was a deliberate deload to 120x10x2 @ RPE 7 on upper re-entry, not a regression.)" },
        { name: "Lat Pulldown", current: "135 lb", workSets: 2, reps: 10, target: "Confirm 2nd clean 10/10 @ 135 (7/13 clean) then 150." },
        { name: "Cable Curl", current: "42.5 lb", workSets: 2, reps: 10, target: "TEST 47.5 \u2014 two clean sessions at 42.5 (7/4, and 7/25 4x10 @ RPE 6-7). Superset with Reverse Fly." },
        { name: "Hammer Curl", current: "20 lb", workSets: 2, reps: 10, target: "HOLD 20 \u2014 read heavy cold (7/25: 20x8 @ RPE 8, dropped to 15). TEST 25 only on a day this LEADS the session." },
        { name: "Zottman Curl", current: "20 lb", workSets: 2, reps: 10, target: "Chase 10 reps @ 20 (stuck at 6) \u2014 slow eccentric." },
        { name: "Reverse Fly", current: "15 lb", workSets: 2, reps: 12, target: "TEST 20 for 8s \u2014 15x10x3 all @ RPE 6 (7/25) clears the consistency gate." }
      ]
    }
  }
};

// ── Session variants ──────────────────────────────────────────────────────────
// Generic per-session-type variant list. Each variant is a per-movement
// prescription overlay layered onto BLOCK.sessions[type].movements at
// session-start/switch time (see buildSessionMovements). Variant movement
// keys match BLOCK.sessions[type].movements names exactly, so progression
// history (keyed by movement name) and `current` weights are shared across
// variants of the same type — only workSets/reps for today's working sets
// differ. Legs carries two variants (A/B, prescription mechanics from
// TARGETS.md "Legs A/B note for whoever implements the toggle"); Push and
// Pull each carry a single default variant. A type's variant switcher only
// renders when SESSION_VARIANTS[type].length > 1 — adding a second Push or
// Pull variant later is a data addition here, not a structural change.
const SESSION_VARIANTS = {
  legs: [
    {
      id: "A",
      label: "A",
      rest: "Opener 2–2.5 min · accessories 60s",
      movements: {
        "Leg Press": { workSets: 3, reps: 10 },
        "Leg Curl": { workSets: 2, reps: 10 },
        "Leg Extension": { workSets: 2, reps: 10 },
        "Goblet Squat": { workSets: 2, reps: 10 },
        "Calf Raise": { workSets: 3, reps: 15 },
      },
    },
    {
      id: "B",
      label: "B",
      rest: "45–75s throughout",
      movements: {
        "Leg Press": { workSets: 3, reps: 15 },
        "Leg Curl": { workSets: 3, reps: 12 },
        "Leg Extension": { workSets: 2, reps: 15 },
        "Goblet Squat": { workSets: 2, reps: 15 },
        "Calf Raise": { workSets: 3, reps: 20 },
      },
    },
  ],
  push: [
    {
      id: "standard",
      label: "Standard",
      rest: "Opener 2 min · supersets 45–60s",
      movements: {},
    },
  ],
  pull: [
    {
      id: "standard",
      label: "Standard",
      rest: "Opener 2 min · supersets 45–60s",
      movements: {},
    },
  ],
};
function getVariant(type, variantId) {
  const variants = SESSION_VARIANTS[type] || [];
  return variants.find((v) => v.id === variantId) || variants[0];
}

// ── Movement metadata ──────────────────────────────────────────────────────────
// Muscle group definitions — order within each group is fixed
const MUSCLE_GROUPS = {
  legs: [
    {
      label: "Quad",
      movements: ["Leg Press", "Leg Extension"],
    },
    {
      label: "Hamstring",
      movements: ["Leg Curl", "RDL"],
    },
    {
      label: "Glute",
      movements: ["Glute Bridge", "Goblet Squat"],
    },
    {
      label: "Calf",
      movements: ["Calf Raise"],
    },
  ],
  push: [
    {
      label: "Chest",
      movements: ["Chest Press", "Pec Fly"],
    },
    {
      label: "Shoulder",
      movements: ["Shoulder Press", "Lateral Raise"],
    },
    {
      label: "Tricep",
      movements: ["Rope Pushdown", "Skull Crusher"],
    },
  ],
  pull: [
    {
      label: "Back",
      movements: ["Seated Row", "Lat Pulldown", "DB Row"],
    },
    {
      label: "Bicep",
      movements: ["Hammer Curl", "Zottman Curl", "Cable Curl"],
    },
    {
      label: "Rear Delt",
      movements: ["Reverse Fly"],
    },
  ],
};
const MOVEMENT_GROUP = {};
Object.keys(MUSCLE_GROUPS).forEach((t) =>
  MUSCLE_GROUPS[t].forEach((g) =>
    g.movements.forEach((n) => {
      MOVEMENT_GROUP[n] = g.label;
    }),
  ),
);
function groupLabelFor(name) {
  return MOVEMENT_GROUP[name] || "Other";
}
const ORDER_KEY = "at_group_order_v2";
function loadGroupOrders() {
  try {
    const r = localStorage.getItem(ORDER_KEY);
    if (r) return JSON.parse(r);
  } catch {}
  const defaults = {};
  Object.keys(MUSCLE_GROUPS).forEach((type) => {
    defaults[type] = MUSCLE_GROUPS[type].map((_, i) => i);
  });
  return defaults;
}
function saveGroupOrders(orders) {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(orders));
  } catch {}
}
const DRAFT_KEY = "at_session_draft";
// Cardio finisher — first-class fields. machine is a fixed dropdown;
// duration/level/rpe are numeric, entered consistent with how strength sets
// are logged (rpe, not a closed easy/moderate/hard enum). Older records may
// still carry the retired `effort` string — hasCardioData/formatCardio keep
// reading it so history doesn't crash or silently drop it; new entries
// always write rpe instead.
const EMPTY_CARDIO = { machine: "", duration: "", level: "", rpe: "" };
const CARDIO_MACHINE_OPTIONS = [
  "Stairmaster",
  "Recumbent bike",
  "Spin bike",
  "Elliptical",
  "Treadmill (incline walk)",
  "Rower",
  "Other",
];
function hasCardioData(cardio) {
  return !!(
    cardio &&
    (cardio.machine ||
      cardio.duration ||
      cardio.level ||
      cardio.rpe ||
      cardio.effort)
  );
}
function formatCardio(cardio) {
  if (!hasCardioData(cardio)) return "";
  return [
    cardio.machine,
    cardio.duration ? cardio.duration + " min" : "",
    cardio.level ? "L" + cardio.level : "",
    cardio.rpe ? "RPE " + cardio.rpe : cardio.effort || "",
  ]
    .filter(Boolean)
    .join(" · ");
}
function saveDraft(type, movements, note, sessionDate, variant, cardio) {
  try {
    const draft = {
      type,
      variant: variant || null,
      note,
      cardio: hasCardioData(cardio) ? cardio : null,
      sessionDate,
      date: sessionDate
        ? new Date(sessionDate + "T12:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
      movements: movements.map((m) => ({
        name: m.name,
        _group: m._group,
        _loggedSets: m._loggedSets || [],
        note: m._exerciseNote || "",
      })),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (e) {
    console.error("saveDraft error:", e);
  }
}
function loadDraft() {
  try {
    const r = localStorage.getItem(DRAFT_KEY);
    if (r) return JSON.parse(r);
  } catch {}
  return null;
}
function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
}
function rotateGroupOrder(order) {
  return [...order.slice(1), order[0]];
}
function buildOrderedMovements(type, groupOrder, blockMovements) {
  const groups = MUSCLE_GROUPS[type];
  const result = [];
  groupOrder.forEach((i) => {
    const group = groups[i];
    group.movements.forEach((name) => {
      const m = blockMovements.find((m) => m.name === name);
      if (m)
        result.push({
          ...m,
          _group: group.label,
        });
    });
  });
  blockMovements.forEach((m) => {
    if (!result.find((r) => r.name === m.name))
      result.push({
        ...m,
        _group: "Other",
      });
  });
  return result;
}
// Builds a fresh sessionMovements array for a given type/variant, applying
// the variant's per-movement overrides and re-attaching any previously
// logged sets and exercise note (keyed by movement name) so switching
// variant mid-session, or resuming a draft, keeps logged data instead of
// discarding it.
function buildSessionMovements(type, variantId, carryMap) {
  const variant = getVariant(type, variantId);
  return BLOCK.sessions[type].movements.map((m) => {
    const mov = {
      ...m,
      ...(variant.movements[m.name] || null),
      _group: groupLabelFor(m.name),
    };
    const carry = (carryMap && carryMap[m.name]) || {};
    mov._loggedSets = carry.loggedSets || [];
    mov._exerciseNote = carry.note || "";
    return mov;
  });
}
// Single stable storage key — never changes
const SYNC_KEY = "at_sync_cfg_v1";
const SYNC_DEFAULTS = {
  token: "",
  repo: "treeapx2/training",
  path: "sessions.json",
  branch: "main",
  auto: true,
};
function loadSyncCfg() {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    return raw
      ? {
          ...SYNC_DEFAULTS,
          ...JSON.parse(raw),
        }
      : {
          ...SYNC_DEFAULTS,
        };
  } catch (e) {
    return {
      ...SYNC_DEFAULTS,
    };
  }
}
function saveSyncCfg(cfg) {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(cfg));
    return true;
  } catch (e) {
    return false;
  }
}
function b64encode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function mergeSessions(a, b) {
  const out = [];
  const seenKey = new Set();
  const seenId = new Set();
  [...(a || []), ...(b || [])].forEach((r) => {
    if (!r) return;
    if (r.type && r.date) {
      // Primary key: type+date. Never dedup on id alone — legacy data has id
      // collisions across genuinely different sessions, which would drop data.
      const key = r.type + "|" + r.date;
      if (seenKey.has(key)) return;
      seenKey.add(key);
      out.push(r);
      return;
    }
    // Fallback only for malformed records missing type or date
    if (r.id != null) {
      if (seenId.has(r.id)) return;
      seenId.add(r.id);
      out.push(r);
    }
  });
  out.sort((x, y) => new Date(y.date) - new Date(x.date));
  return out;
}
async function syncPull(cfg) {
  if (!cfg || !cfg.repo || !cfg.path)
    return {
      ok: false,
      err: "not configured",
    };
  const url =
    "https://raw.githubusercontent.com/" +
    cfg.repo +
    "/" +
    cfg.branch +
    "/" +
    cfg.path +
    "?t=" +
    Date.now();
  try {
    const r = await fetch(url, {
      cache: "no-store",
    });
    if (r.status === 404)
      return {
        ok: true,
        sessions: [],
        note: "no remote file yet",
      };
    if (!r.ok)
      return {
        ok: false,
        err: "HTTP " + r.status,
      };
    const j = await r.json();
    return {
      ok: true,
      sessions: Array.isArray(j) ? j : j.sessions || [],
    };
  } catch (e) {
    return {
      ok: false,
      err: String(e.message || e),
    };
  }
}
async function syncPush(cfg, sessions) {
  if (!cfg || !cfg.token)
    return {
      ok: false,
      err: "no token configured",
    };
  const api =
    "https://api.github.com/repos/" + cfg.repo + "/contents/" + cfg.path;
  const H = {
    Authorization: "Bearer " + cfg.token,
    Accept: "application/vnd.github+json",
  };
  const fetchSha = async () => {
    const g = await fetch(api + "?ref=" + cfg.branch, {
      headers: H,
    });
    if (g.ok) {
      const gj = await g.json();
      return { sha: gj.sha || null };
    }
    if (g.status === 401 || g.status === 403) {
      return {
        authError: "auth failed (" + g.status + ") - check token scope/expiry",
      };
    }
    return { sha: null };
  };
  const put = async (sha) => {
    const body = {
      message:
        "sync: " + sessions.length + " sessions @ " + new Date().toISOString(),
      content: b64encode(JSON.stringify(sessions, null, 2)),
      branch: cfg.branch,
    };
    if (sha) body.sha = sha;
    return fetch(api, {
      method: "PUT",
      headers: {
        ...H,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  };
  try {
    const first = await fetchSha();
    if (first.authError) return { ok: false, err: first.authError };
    let res = await put(first.sha);
    if (res.status === 409) {
      // Stale sha — another writer (auto-push racing a manual push, or vice
      // versa) updated the file in between. Refetch and retry exactly once.
      const retry = await fetchSha();
      if (retry.authError) return { ok: false, err: retry.authError };
      res = await put(retry.sha);
    }
    if (!res.ok) {
      const t = await res.text();
      return {
        ok: false,
        err: "HTTP " + res.status + " " + t.slice(0, 160),
      };
    }
    return {
      ok: true,
      count: sessions.length,
    };
  } catch (e) {
    return {
      ok: false,
      err: String(e.message || e),
    };
  }
}
const STORAGE_KEY = "at_workout_stable";
function loadData() {
  // No embedded seed data — sessions.json (via syncPull) merged with this
  // localStorage copy is the only source of history. See App's mount effect.
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) {
      const saved = JSON.parse(r);
      return saved.history || [];
    }
  } catch (e) {
    console.error("loadData error:", e);
  }
  return [];
}
function saveData(history) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        history,
      }),
    );
    return true;
  } catch (e) {
    console.error("saveData error:", e);
    return false;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const sess = (type) =>
  BLOCK.sessions[type] || {
    label: type,
    color: "#888",
    bg: "#eee",
  };
function buildHandoff(history) {
  const lines = [];
  lines.push(
    "HANDOFF SUMMARY — Alex Triester | Current as of " +
      new Date().toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
      }),
  );
  lines.push("\nSPLIT: Legs → Push → Pull");
  lines.push(
    "HOCKEY: SUSPENDED (~3 wks, blood-thinner/PE precaution) — legs unblocked, cardio substituted",
  );
  lines.push(
    "SESSION STRUCTURE: warm-ups + 2 working (3 on emphasis lift). Fresh opener = progression lift, straight sets/full rest; accessories antagonist-supersetted 45-60s to keep HR up. 60-min cap.\n",
  );
  lines.push("CURRENT WORKING WEIGHTS + TARGETS:");
  Object.entries(BLOCK.sessions).forEach(([key, s]) => {
    lines.push(`\n${s.label.toUpperCase()}:`);
    s.movements.forEach((m) =>
      lines.push(`  ${m.name}: ${m.current} — ${m.target}`),
    );
  });
  lines.push("\nACTIVE FLAGS:");
  BLOCK.flags.forEach((f) => lines.push(`  - ${f}`));
  const recent = history.slice(0, 6);
  if (recent.length) {
    lines.push("\nRECENT SESSIONS:");
    recent.forEach((h) => {
      lines.push(`\n${h.date} — ${h.label}`);
      h.movements.forEach((m) => {
        lines.push(`  ${m.name}:`);
        m.sets.forEach((s) => {
          let l = `    S${s.set}: ${s.weight ? s.weight + " lb" : "—"} × ${s.reps || "—"} reps`;
          if (s.rpe) l += `, RPE ${s.rpe}`;
          if (s.note) l += ` — ${s.note}`;
          lines.push(l);
        });
        if (m.note) lines.push(`    note: ${m.note}`);
      });
      if (hasCardioData(h.cardio))
        lines.push(`  Cardio: ${formatCardio(h.cardio)}`);
      if (h.note) lines.push(`  Session note: ${h.note}`);
    });
  }
  return lines.join("\n");
}
function buildCoachSummary(type, setsRef, sessionNote, cardio, notesRef) {
  const session = BLOCK.sessions[type];
  const lines = [];
  lines.push(
    session.label +
      " — " +
      new Date().toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
      }),
  );
  session.movements.forEach((mov) => {
    const sets = setsRef[mov.name] || [];
    const note = (notesRef && notesRef[mov.name]) || "";
    if (!sets.length && !note) return;
    lines.push(mov.name + ":");
    sets.forEach((s) => {
      let l = `  S${s.set}: ${s.weight ? s.weight + " lb" : "—"} × ${s.reps || "—"} reps`;
      if (s.rpe) l += `, RPE ${s.rpe}`;
      if (s.note) l += ` — ${s.note}`;
      lines.push(l);
    });
    if (note) lines.push(`  note: ${note}`);
  });
  if (hasCardioData(cardio)) lines.push("Cardio: " + formatCardio(cardio));
  if (sessionNote) lines.push("Note: " + sessionNote);
  return lines.join("\n");
}

// ── Progress helpers ──────────────────────────────────────────────────────────
function parseSessionDate(dateStr) {
  return new Date(dateStr);
}
function rpeColor(rpe) {
  const r = parseFloat(rpe);
  if (!r) return "#ccc";
  if (r <= 7) return "#3B6D11";
  if (r === 8) return "#D97706";
  return "#DC2626";
}
function getMovementHistory(history, movName) {
  const pts = [];
  [...history].forEach((session) => {
    const mov = session.movements.find((m) => m.name === movName);
    if (!mov) return;
    const workingSets = mov.sets.filter(
      (s) => s.weight && parseFloat(s.weight) > 0,
    );
    if (!workingSets.length) return;
    const maxW = Math.max(...workingSets.map((s) => parseFloat(s.weight)));
    // get the RPE of the set with max weight (last one if multiple)
    const maxSets = workingSets.filter((s) => parseFloat(s.weight) === maxW);
    const topRPE = maxSets[maxSets.length - 1]?.rpe || "";
    pts.push({
      date: session.date,
      weight: maxW,
      rpe: topRPE,
      id: session.id,
      ts: parseSessionDate(session.date).getTime(),
    });
  });
  pts.sort((a, b) => a.ts - b.ts);
  return pts;
}
function getAllMovements(history) {
  const names = new Set();
  history.forEach((s) => s.movements.forEach((m) => names.add(m.name)));
  return Array.from(names).sort();
}

// PR logic: rep ceiling is 10. Chase 10 reps → then lower RPE → then test next weight.
// Also track best RPE at max weight × 10 reps to know when to progress.
function getMovementPR(history, movName) {
  let maxWeight = 0;
  let bestRepsAtMax = 0;
  let bestRPEAtMax10 = null; // lowest RPE seen at max weight × 10 reps
  let prDate = "";
  [...history].forEach((session) => {
    const mov = session.movements.find((m) => m.name === movName);
    if (!mov) return;
    mov.sets.forEach((s) => {
      const w = parseFloat(s.weight);
      const r = parseInt(s.reps);
      const rpe = parseFloat(s.rpe);
      if (!w || !r) return;
      if (w > maxWeight) {
        maxWeight = w;
        bestRepsAtMax = r;
        prDate = session.date;
        bestRPEAtMax10 = r >= 10 && rpe ? rpe : null;
      } else if (w === maxWeight) {
        if (r > bestRepsAtMax) bestRepsAtMax = r;
        if (r >= 10 && rpe) {
          if (bestRPEAtMax10 === null || rpe < bestRPEAtMax10)
            bestRPEAtMax10 = rpe;
        }
        if (r >= bestRepsAtMax) prDate = session.date;
      }
    });
  });
  if (maxWeight === 0) return null;

  // Count sessions with 10 reps at max weight AND RPE ≤ 8
  let consistentSessions = 0;
  [...history].forEach((session) => {
    const mov = session.movements.find((m) => m.name === movName);
    if (!mov) return;
    const qualifies = mov.sets.some((s) => {
      const w = parseFloat(s.weight);
      const r = parseInt(s.reps);
      const rpe = parseFloat(s.rpe);
      return w === maxWeight && r >= 10 && rpe && rpe <= 8;
    });
    if (qualifies) consistentSessions++;
  });
  let status, statusColor;
  if (bestRepsAtMax < 10) {
    status = `chase 10 (best: ${bestRepsAtMax})`;
    statusColor = "#185FA5";
  } else if (consistentSessions >= 2) {
    status = `ready to test next weight (${consistentSessions} sessions)`;
    statusColor = "#3B6D11";
  } else if (bestRPEAtMax10 !== null && bestRPEAtMax10 <= 8) {
    status = `hold — need 2 consistent sessions (${consistentSessions}/2)`;
    statusColor = "#D97706";
  } else {
    status = `hold — lower RPE first (best: ${bestRPEAtMax10 || "?"})`;
    statusColor = "#888";
  }
  return {
    weight: maxWeight,
    reps: bestRepsAtMax,
    date: prDate,
    status,
    statusColor,
    consistentSessions,
  };
}

// ── Chart ─────────────────────────────────────────────────────────────────────
function MovementChart({ data, color, compact = false }) {
  if (data.length < 2)
    return (
      /*#__PURE__*/ <div
        style={{
          height: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          color: "#bbb",
        }}
      >
        need 2+ sessions to chart
      </div>
    );
  const LABEL_H = compact ? 44 : 60;
  const DOT_AREA_H = compact ? 100 : 180;
  const H = DOT_AREA_H + LABEL_H;
  const W = 320;
  const PAD_L = 10;
  const PAD_R = 10;
  const PAD_TOP = 24; // room above highest dot for weight label
  const PAD_BOT = 8;
  const chartH = DOT_AREA_H - PAD_TOP - PAD_BOT;
  const weights = data.map((d) => d.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;
  const n = data.length;
  const xs = data.map((_, i) => PAD_L + (i / (n - 1)) * (W - PAD_L - PAD_R));
  const ys = data.map(
    (d) => PAD_TOP + chartH - ((d.weight - minW) / range) * chartH,
  );

  // format short date: "Mar 7" → "3/7"
  const shortDate = (str) => {
    const d = new Date(str);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  return (
    /*#__PURE__*/ <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{
        width: "100%",
        height: H,
        display: "block",
      }}
    >
      {[0, 0.5, 1].map((t, i) => {
        const y = PAD_TOP + chartH - t * chartH;
        const wVal = Math.round(minW + t * range);
        return (
          /*#__PURE__*/ <g key={i}>
            <line
              x1={PAD_L}
              y1={y}
              x2={W - PAD_R}
              y2={y}
              stroke="#e5e5e3"
              strokeWidth="0.5"
            />
            <text
              x={PAD_L}
              y={y - 3}
              fontSize="9"
              fill="#bbb"
              textAnchor="start"
            >
              {wVal} lb
            </text>
          </g>
        );
      })}
      <polyline
        points={xs.map((x, i) => `${x},${ys[i]}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {data.map((d, i) => {
        const x = xs[i];
        const y = ys[i];
        const isFirst = i === 0;
        const isLast = i === n - 1;
        const dotR = isLast ? 5 : 3.5;
        const dotColor = rpeColor(d.rpe);
        const anchor = isFirst ? "start" : isLast ? "end" : "middle";
        const wLabel = `${d.weight}`;
        const dateLabel = shortDate(d.date);
        const rpeLabel = d.rpe ? `${d.rpe}` : "";
        return (
          /*#__PURE__*/ <g key={d.id}>
            <text
              x={x}
              y={y - dotR - 4}
              fontSize="10"
              fill="#555"
              textAnchor={anchor}
              fontWeight={isLast ? "700" : "400"}
            >
              {wLabel}
            </text>
            <circle
              cx={x}
              cy={y}
              r={dotR}
              fill={dotColor}
              stroke={dotColor}
              strokeWidth="1.5"
            />
            <text
              x={x}
              y={DOT_AREA_H + 13}
              fontSize="9"
              fill="#aaa"
              textAnchor={anchor}
            >
              {dateLabel}
            </text>
            {rpeLabel ? (
              /*#__PURE__*/ <text
                x={x}
                y={DOT_AREA_H + 25}
                fontSize="9"
                fill={dotColor}
                textAnchor={anchor}
                fontWeight="600"
              >
                {rpeLabel}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

// ── Components ────────────────────────────────────────────────────────────────
const S = {
  card: {
    background: "#fff",
    border: "0.5px solid #e5e5e3",
    borderRadius: 14,
    padding: "14px",
    marginBottom: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: "#999",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    margin: "16px 0 8px",
  },
  divider: {
    height: "0.5px",
    background: "#e5e5e3",
  },
};
function Badge({ label, color, bg }) {
  return (
    /*#__PURE__*/ <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 20,
        background: bg,
        color,
        letterSpacing: "0.02em",
      }}
    >
      {label}
    </span>
  );
}

// Extract numeric working weight from block current string e.g. "105 lb" -> "105"
function parseCurrentWeight(current) {
  const m = current && current.match(/(\d+\.?\d*)/);
  return m ? m[1] : "";
}

// Machine increment — 15 lb for plate-loaded machines, 5 lb for cables/DBs
function machineInc(name) {
  const fiveIncMovements = [
    "DB Row",
    "Lateral Raise",
    "Reverse Fly",
    "Hammer Curl",
    "Zottman Curl",
    "Cable Curl",
    "Goblet Squat",
    "Glute Bridge",
    "Calf Raise",
    "RDL",
    "Skull Crusher",
    "Incline DB Curl",
    "Face Pull",
    "DB Skull Crusher",
    "OHE",
    "Rope Pushdown",
    "Cable Pushdown",
  ];
  return fiveIncMovements.includes(name) ? 5 : 15;
}

// Generate planned sets — ramp by fixed increments, not percentages
function buildPlannedSets(mov, sessionType) {
  const base = buildPlannedSetsBase(mov, sessionType);
  if (!base.length) return base;
  let out = base;
  const want = parseInt(mov.workSets, 10);
  if (want && want > 0) {
    const w = base.filter((x) => x.type === "W");
    const nonW = base.filter((x) => x.type !== "W");
    const ws = w.slice(0, want);
    while (ws.length < want && w.length)
      ws.push({
        ...w[w.length - 1],
      });
    out = [...nonW, ...ws];
  }
  if (mov.reps)
    out = out.map((x) =>
      x.type === "W"
        ? {
            ...x,
            reps: String(mov.reps),
          }
        : x,
    );
  return out;
}
function buildPlannedSetsBase(mov, sessionType) {
  const working = parseFloat(parseCurrentWeight(mov.current));
  if (!working) return [];
  const name = mov.name;
  const inc = machineInc(name);
  const isAccessory = [
    "Lateral Raise",
    "Reverse Fly",
    "Hammer Curl",
    "Zottman Curl",
    "Cable Curl",
    "Goblet Squat",
    "Glute Bridge",
    "Calf Raise",
    "RDL",
    "OHE",
    "Skull Crusher",
    "Incline DB Curl",
    "Face Pull",
    "DB Skull Crusher",
  ].includes(name);

  // DB Row: 4-set ramp, 5 lb increments
  if (name === "DB Row") {
    const w1 = Math.max(working - 3 * inc, inc);
    const w2 = Math.max(working - 2 * inc, inc);
    return [
      {
        weight: String(w1),
        reps: "10",
        rpe: "",
        note: "",
        type: "WU",
      },
      {
        weight: String(w2),
        reps: "10",
        rpe: "",
        note: "",
        type: "B1",
      },
      {
        weight: String(w2),
        reps: "10",
        rpe: "",
        note: "",
        type: "B2",
      },
      {
        weight: String(working),
        reps: "10",
        rpe: "",
        note: "",
        type: "W",
      },
    ];
  }

  // Accessories: 3 straight sets
  if (isAccessory) {
    return [
      {
        weight: String(working),
        reps: "10",
        rpe: "",
        note: "",
        type: "W",
      },
      {
        weight: String(working),
        reps: "10",
        rpe: "",
        note: "",
        type: "W",
      },
      {
        weight: String(working),
        reps: "10",
        rpe: "",
        note: "",
        type: "W",
      },
    ];
  }

  // Machine compounds — ramp by fixed increments
  const wu = Math.max(working - 2 * inc, inc); // working − 2 increments
  const b = Math.max(working - 1 * inc, inc); // working − 1 increment

  if (sessionType === "push") {
    // Push: 3 WU + 2 working (WU, WU at b, WU at b)
    return [
      {
        weight: String(wu),
        reps: "10",
        rpe: "",
        note: "",
        type: "WU",
      },
      {
        weight: String(b),
        reps: "10",
        rpe: "",
        note: "",
        type: "WU",
      },
      {
        weight: String(b),
        reps: "10",
        rpe: "",
        note: "",
        type: "WU",
      },
      {
        weight: String(working),
        reps: "10",
        rpe: "",
        note: "",
        type: "W",
      },
      {
        weight: String(working),
        reps: "10",
        rpe: "",
        note: "",
        type: "W",
      },
    ];
  }

  // Legs / Pull: 1 WU + 2 build + 2 working
  return [
    {
      weight: String(wu),
      reps: "10",
      rpe: "",
      note: "",
      type: "WU",
    },
    {
      weight: String(b),
      reps: "10",
      rpe: "",
      note: "",
      type: "B",
    },
    {
      weight: String(b),
      reps: "10",
      rpe: "",
      note: "",
      type: "B",
    },
    {
      weight: String(working),
      reps: "10",
      rpe: "",
      note: "",
      type: "W",
    },
    {
      weight: String(working),
      reps: "10",
      rpe: "",
      note: "",
      type: "W",
    },
  ];
}
const SET_TYPE_COLOR = {
  WU: "#bbb",
  B: "#185FA5",
  B1: "#185FA5",
  B2: "#185FA5",
  W: "#111",
};
const SET_TYPE_LABEL = {
  WU: "WU",
  B: "B",
  B1: "B",
  B2: "B",
  W: "W",
};

// Compact inline input — 16px prevents iOS zoom, minimal padding
const ci = (extra = {}) => ({
  padding: "5px 6px",
  border: "0.5px solid #ddd",
  borderRadius: 6,
  fontSize: 16,
  background: "#fff",
  color: "#111",
  outline: "none",
  minWidth: 0,
  textAlign: "center",
  boxSizing: "border-box",
  ...extra,
});
function SetLogger({
  mov,
  sets,
  onLog,
  onUpdate,
  onDelete,
  history,
  sessionColor,
}) {
  const pr = history ? getMovementPR(history, mov.name) : null;
  const chartData = history ? getMovementHistory(history, mov.name) : [];
  return (
    /*#__PURE__*/ <div
      style={{
        background: "#f9f9f8",
        borderTop: "0.5px solid #e5e5e3",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "0.5px solid #e5e5e3",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: chartData.length >= 2 ? 6 : 0,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "#999",
            }}
          >
            {mov.target}
          </span>
          {pr && (
            /*#__PURE__*/ <span
              style={{
                fontSize: 10,
                color: pr.statusColor,
                fontWeight: 600,
              }}
            >
              {pr.reps < 10 ? `best ${pr.weight}lb×${pr.reps}` : pr.status}
            </span>
          )}
        </div>
        {chartData.length >= 2 && (
          /*#__PURE__*/ <MovementChart
            data={chartData}
            color={sessionColor}
            compact={true}
          />
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "28px 1fr 1fr 1fr 44px",
          gap: 4,
          padding: "4px 10px 2px",
          alignItems: "center",
        }}
      >
        {["", "lb", "reps", "RPE", ""].map((h, i) => (
          /*#__PURE__*/ <div
            key={i}
            style={{
              fontSize: 10,
              color: "#bbb",
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            {h}
          </div>
        ))}
      </div>
      <div
        style={{
          padding: "2px 10px 8px",
        }}
      >
        {sets.map((s, i) => {
          const isLogged = !!s.logged;
          const tc = SET_TYPE_COLOR[s.type] || "#111";
          const tl = SET_TYPE_LABEL[s.type] || "S";
          const rc = rpeColor(s.rpe);
          return (
            /*#__PURE__*/ <div
              key={i}
              style={{
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr 1fr 1fr 44px",
                  gap: 4,
                  alignItems: "center",
                  opacity: isLogged ? 0.75 : 1,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: isLogged ? rc : tc,
                    textAlign: "center",
                  }}
                >
                  {tl}
                  {i + 1}
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  value={s.weight}
                  onChange={(e) => onUpdate(i, "weight", e.target.value)}
                  disabled={isLogged}
                  style={{
                    ...ci(),
                    background: isLogged ? "#f5f5f3" : "#fff",
                  }}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={s.reps}
                  onChange={(e) => onUpdate(i, "reps", e.target.value)}
                  disabled={isLogged}
                  style={{
                    ...ci(),
                    background: isLogged ? "#f5f5f3" : "#fff",
                  }}
                />
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="—"
                  value={s.rpe}
                  onChange={(e) => onUpdate(i, "rpe", e.target.value)}
                  disabled={isLogged}
                  min={1}
                  max={10}
                  step={0.5}
                  style={{
                    ...ci(),
                    background: isLogged ? "#f5f5f3" : "#fff",
                    color: isLogged ? rc : "#111",
                    fontWeight: isLogged ? 700 : 400,
                  }}
                />
                {isLogged ? (
                  /*#__PURE__*/ <button
                    onClick={() => onDelete(i)}
                    style={{
                      fontSize: 11,
                      color: "#ccc",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      textAlign: "center",
                    }}
                  >
                    ✕
                  </button>
                ) : (
                  /*#__PURE__*/ <button
                    onClick={() => onLog(i)}
                    style={{
                      padding: "5px 0",
                      background: "#111",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    log
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <button
          onClick={() => onUpdate("_add", "_add", "_add")}
          style={{
            width: "100%",
            padding: "6px 0",
            marginTop: 4,
            background: "none",
            border: "0.5px dashed #ddd",
            borderRadius: 6,
            fontSize: 12,
            color: "#aaa",
            cursor: "pointer",
          }}
        >
          + add set
        </button>
      </div>
    </div>
  );
}
function MovementRow({ mov, sessionColor, history, sessionType, onChange }) {
  const [open, setOpen] = useState(false);
  // One note per exercise (not per set) — see CHANGES.md Phase 4.
  const [exerciseNote, setExerciseNote] = useState(mov._exerciseNote || "");
  useEffect(() => {
    mov._exerciseNote = exerciseNote;
    if (onChange) onChange();
  }, [exerciseNote]);
  // Initialize with planned sets — all editable, none logged yet
  const [plannedSets, setPlannedSets] = useState(() => {
    const planned = buildPlannedSets(mov, sessionType);
    const prior = mov._loggedSets || [];
    if (prior.length === 0)
      return planned.map((s) => ({
        ...s,
        logged: false,
      }));
    // Restore logged state from prior sets (draft resume)
    return planned.map((s, i) => {
      const match = prior[i];
      if (!match)
        return {
          ...s,
          logged: false,
        };
      return {
        ...s,
        weight: match.weight || s.weight,
        reps: match.reps || s.reps,
        rpe: match.rpe || s.rpe,
        note: match.note || s.note || "",
        logged: true,
      };
    });
  });

  // Sync logged sets back to parent setsRef via effect on close
  // Parent reads plannedSets.filter(logged) via ref
  const loggedSets = plannedSets.filter((s) => s.logged);
  const done = loggedSets.length > 0;

  // Expose logged sets to parent via the sets array reference
  useEffect(() => {
    // parent passes sets[] by ref — update it
    mov._loggedSets = loggedSets.map((s, i) => ({
      set: i + 1,
      weight: s.weight,
      reps: s.reps,
      rpe: s.rpe,
      note: s.note || "",
    }));
    // Notify parent so it re-renders (warning calc + draft autosave depend on this)
    if (onChange) onChange();
  }, [plannedSets]);
  const handleLog = (idx) => {
    setPlannedSets((prev) =>
      prev.map((s, i) =>
        i === idx
          ? {
              ...s,
              logged: true,
            }
          : s,
      ),
    );
  };
  const handleUpdate = (idx, field, val) => {
    if (idx === "_add") {
      // append a new working set pre-filled with last working weight
      setPlannedSets((prev) => {
        const working = prev.filter((s) => s.type === "W");
        const lastWeight = working.length
          ? working[working.length - 1].weight
          : parseCurrentWeight(mov.current);
        return [
          ...prev,
          {
            weight: String(lastWeight),
            reps: "10",
            rpe: "",
            note: "",
            type: "W",
            logged: false,
          },
        ];
      });
      return;
    }
    setPlannedSets((prev) =>
      prev.map((s, i) =>
        i === idx
          ? {
              ...s,
              [field]: val,
            }
          : s,
      ),
    );
  };
  const handleDelete = (idx) => {
    setPlannedSets((prev) =>
      prev.map((s, i) =>
        i === idx
          ? {
              ...s,
              logged: false,
              rpe: "",
            }
          : s,
      ),
    );
  };
  return (
    /*#__PURE__*/ <div
      style={{
        border: "0.5px solid #e5e5e3",
        borderRadius: 10,
        marginBottom: 8,
        overflow: "hidden",
      }}
    >
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          padding: "11px 12px",
          cursor: "pointer",
          background: "#fff",
          userSelect: "none",
        }}
      >
        <div
          style={{
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#111",
            }}
          >
            {mov.name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#999",
              marginTop: 2,
            }}
          >
            {mov.current}
          </div>
          {done && (
            /*#__PURE__*/ <div
              style={{
                fontSize: 11,
                color: "#666",
                marginTop: 3,
              }}
            >
              {loggedSets.length}/{plannedSets.length} sets logged
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              border: done ? "none" : "1.5px solid #ddd",
              background: done ? sessionColor : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              color: "#fff",
              fontWeight: 700,
            }}
          >
            {done
              ? loggedSets.length === plannedSets.length
                ? "✓"
                : loggedSets.length
              : ""}
          </div>
          <span
            style={{
              fontSize: 11,
              color: "#bbb",
              transform: open ? "rotate(180deg)" : "none",
              display: "inline-block",
              transition: "transform .15s",
            }}
          >
            ▼
          </span>
        </div>
      </div>
      {open && (
        /*#__PURE__*/ <>
          <SetLogger
            mov={mov}
            sets={plannedSets}
            onLog={handleLog}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            history={history}
            sessionColor={sessionColor}
            sessionType={sessionType}
          />
          <div
            style={{
              padding: "0 10px 10px",
              background: "#f9f9f8",
            }}
          >
            <textarea
              value={exerciseNote}
              onChange={(e) => setExerciseNote(e.target.value)}
              placeholder="note for this exercise..."
              style={{
                width: "100%",
                padding: "6px 8px",
                border: "0.5px solid #ddd",
                borderRadius: 8,
                fontSize: 13,
                color: "#111",
                background: "#fff",
                resize: "none",
                height: 44,
                outline: "none",
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── Screens ───────────────────────────────────────────────────────────────────
function SessionScreen({ history, setHistory }) {
  const [active, setActive] = useState(null);
  const [sessionNote, setSessionNote] = useState("");
  const [sessionDate, setSessionDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [lastFinished, setLastFinished] = useState(null);
  const [autoPushStatus, setAutoPushStatus] = useState(null);
  const [variant, setVariant] = useState(null);
  const [cardio, setCardio] = useState(EMPTY_CARDIO);
  const [copied, setCopied] = useState(false);
  const [groupOrders, setGroupOrders] = useState(null);
  const [sessionMovements, setSessionMovements] = useState([]);
  const [draft, setDraft] = useState(null);
  const [draftChecked, setDraftChecked] = useState(false);
  const [tick, setTick] = useState(0);
  const bumpTick = () => setTick((t) => t + 1);
  useEffect(() => {
    const go = loadGroupOrders();
    const dr = loadDraft();
    setGroupOrders(go);
    if (dr) setDraft(dr);
    setDraftChecked(true);
  }, []);

  // Auto-save draft whenever session movements change OR any set is logged (tick)
  useEffect(() => {
    if (!active) return;
    saveDraft(
      active,
      sessionMovements,
      sessionNote,
      sessionDate,
      variant,
      cardio,
    );
  }, [
    sessionMovements,
    sessionNote,
    active,
    tick,
    sessionDate,
    variant,
    cardio,
  ]);
  const startSession = (type) => {
    BLOCK.sessions[type].movements.forEach((m) => {
      delete m._loggedSets;
    });
    const initialVariant = SESSION_VARIANTS[type][0].id;
    setSessionMovements(buildSessionMovements(type, initialVariant, null));
    setActive(type);
    setVariant(initialVariant);
    setLastFinished(null);
    setAutoPushStatus(null);
    setSessionNote("");
    setCardio(EMPTY_CARDIO);
    setSessionDate(new Date().toISOString().split("T")[0]);
  };
  const resumeDraft = () => {
    if (!draft) return;
    // Rebuild sessionMovements from draft, re-attach block movement data.
    // Order follows draft.movements (preserves any manual reorder from before
    // the app closed), not BLOCK's default order.
    const blockMovs = BLOCK.sessions[draft.type].movements;
    blockMovs.forEach((m) => {
      delete m._loggedSets;
    });
    const draftVariantId = draft.variant || SESSION_VARIANTS[draft.type][0].id;
    const v = getVariant(draft.type, draftVariantId);
    const restored = draft.movements.map((dm) => {
      const blockMov = blockMovs.find((m) => m.name === dm.name) || {
        name: dm.name,
        current: "",
        target: "",
      };
      blockMov._loggedSets = dm._loggedSets || [];
      blockMov._exerciseNote = dm.note || "";
      return {
        ...blockMov,
        ...(v.movements[dm.name] || null),
        _group: dm._group,
      };
    });
    setSessionMovements(restored);
    setActive(draft.type);
    setVariant(draftVariantId);
    setSessionNote(draft.note || "");
    setCardio(draft.cardio || EMPTY_CARDIO);
    if (draft.sessionDate) setSessionDate(draft.sessionDate);
    setDraft(null);
  };
  const discardDraft = () => {
    setDraft(null);
    clearDraft();
  };
  // Accidental-switch protection: freely switchable while no set has been
  // logged; once any set carries logged data, require an explicit confirm.
  // Switching changes today's targets (workSets/reps overlay) but keeps
  // logged sets — see buildSessionMovements' loggedMap re-attachment.
  const switchVariant = (variantId) => {
    if (variantId === variant) return;
    const hasLogged = sessionMovements.some(
      (m) => (m._loggedSets || []).length > 0,
    );
    if (hasLogged) {
      const ok = window.confirm(
        "Switching variants changes today's targets. Logged sets are kept, not discarded. Continue?",
      );
      if (!ok) return;
    }
    const carryMap = {};
    sessionMovements.forEach((m) => {
      carryMap[m.name] = {
        loggedSets: m._loggedSets || [],
        note: m._exerciseNote || "",
      };
    });
    setSessionMovements(buildSessionMovements(active, variantId, carryMap));
    setVariant(variantId);
  };
  const moveMovementUp = (idx) => {
    if (idx <= 0) return;
    setSessionMovements((prev) => {
      const a = [...prev];
      [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]];
      return a;
    });
    bumpTick();
  };
  const moveMovementDown = (idx) => {
    setSessionMovements((prev) => {
      if (idx >= prev.length - 1) return prev;
      const a = [...prev];
      [a[idx + 1], a[idx]] = [a[idx], a[idx + 1]];
      return a;
    });
    bumpTick();
  };

  // Move entire group up/down — find group boundary and swap group blocks
  const reorderGroups = (newGo) => {
    const loggedMap = {};
    sessionMovements.forEach((m) => {
      loggedMap[m.name] = m._loggedSets || [];
    });
    const newOrders = {
      ...groupOrders,
      [active]: newGo,
    };
    setGroupOrders(newOrders);
    saveGroupOrders(newOrders);
    const rebuilt = buildOrderedMovements(
      active,
      newGo,
      BLOCK.sessions[active].movements,
    );
    rebuilt.forEach((m) => {
      m._loggedSets = loggedMap[m.name] || [];
    });
    setSessionMovements(rebuilt);
  };
  const moveGroupUp = (groupLabel) => {
    const go = groupOrders[active];
    const groups = MUSCLE_GROUPS[active];
    const idx = go.findIndex((i) => groups[i].label === groupLabel);
    if (idx <= 0) return;
    const newGo = [...go];
    [newGo[idx - 1], newGo[idx]] = [newGo[idx], newGo[idx - 1]];
    reorderGroups(newGo);
  };
  const moveGroupDown = (groupLabel) => {
    const go = groupOrders[active];
    const groups = MUSCLE_GROUPS[active];
    const idx = go.findIndex((i) => groups[i].label === groupLabel);
    if (idx >= go.length - 1) return;
    const newGo = [...go];
    [newGo[idx], newGo[idx + 1]] = [newGo[idx + 1], newGo[idx]];
    reorderGroups(newGo);
  };
  const saveCurrentOrder = () => {
    if (!active || !groupOrders) return;
    // Rotate group order for next session
    const newGo = rotateGroupOrder(groupOrders[active]);
    const newOrders = {
      ...groupOrders,
      [active]: newGo,
    };
    setGroupOrders(newOrders);
    saveGroupOrders(newOrders);
  };
  const finish = () => {
    const s = BLOCK.sessions[active];
    const movements = sessionMovements
      .map((m) => ({
        name: m.name,
        sets: m._loggedSets || [],
        note: m._exerciseNote || "",
        order: sessionMovements.indexOf(m),
      }))
      .filter((m) => m.sets.length > 0 || m.note);
    const formattedDate = new Date(
      sessionDate + "T12:00:00",
    ).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const hasVariants = SESSION_VARIANTS[active].length > 1;
    const entry = {
      id: Date.now(),
      type: active,
      label: hasVariants
        ? s.label + " " + getVariant(active, variant).label
        : s.label,
      date: formattedDate,
      note: sessionNote,
      variant: hasVariants ? variant : undefined,
      cardio: hasCardioData(cardio) ? cardio : undefined,
      movements,
    };
    const updated = [entry, ...history];
    setHistory(updated);
    const saved = saveData(updated);
    (() => {
      const cfg = loadSyncCfg();
      if (cfg.auto && cfg.token) {
        setAutoPushStatus({ state: "pending" });
        syncPush(cfg, updated).then((r) => {
          try {
            localStorage.setItem(
              "at_sync_last",
              JSON.stringify({
                at: new Date().toISOString(),
                ok: r.ok,
                err: r.err || "",
              }),
            );
          } catch (e) {}
          setAutoPushStatus(
            r.ok ? { state: "ok" } : { state: "error", err: r.err || "" },
          );
        });
      }
    })();
    // Save this session order as the new default for this type
    saveCurrentOrder();
    const setsForSummary = {};
    const notesForSummary = {};
    movements.forEach((m) => {
      setsForSummary[m.name] = m.sets;
      notesForSummary[m.name] = m.note;
    });
    const summary = buildCoachSummary(
      active,
      setsForSummary,
      sessionNote,
      cardio,
      notesForSummary,
    );
    setLastFinished({
      entry,
      summary,
      saved,
    });
    setDraft(null);
    clearDraft();
    setActive(null);
  };
  const copyToCoach = (text) => {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  if (!active) {
    if (!draftChecked)
      return (
        /*#__PURE__*/ <div
          style={{
            padding: 24,
            textAlign: "center",
            fontSize: 13,
            color: "#aaa",
          }}
        >
          Loading...
        </div>
      );
    if (draft) {
      const s = BLOCK.sessions[draft.type] || {
        color: "#888",
        bg: "#eee",
        label: draft.type,
      };
      const draftHasVariants =
        (SESSION_VARIANTS[draft.type] || []).length > 1;
      const draftLabel =
        draftHasVariants && draft.variant
          ? s.label + " " + getVariant(draft.type, draft.variant).label
          : s.label;
      const loggedCount = draft.movements.reduce(
        (a, m) => a + (m._loggedSets?.length || 0),
        0,
      );
      return (
        /*#__PURE__*/ <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#111",
              marginBottom: 4,
            }}
          >
            Resume session?
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#999",
              marginBottom: 16,
            }}
          >
            You have an unfinished session from {draft.date}.
          </div>
          <div
            style={{
              ...S.card,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#111",
                }}
              >
                {draftLabel} · {draft.date}
              </div>
              <Badge label={draftLabel} color={s.color} bg={s.bg} />
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#999",
              }}
            >
              {draft.movements.length} movements · {loggedCount} sets logged
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
            }}
          >
            <button
              onClick={discardDraft}
              style={{
                flex: 1,
                padding: 10,
                border: "0.5px solid #ddd",
                borderRadius: 10,
                background: "#fff",
                fontSize: 13,
                color: "#999",
                cursor: "pointer",
              }}
            >
              discard
            </button>
            <button
              onClick={resumeDraft}
              style={{
                flex: 2,
                padding: 10,
                border: "none",
                borderRadius: 10,
                background: "#111",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              resume session
            </button>
          </div>
        </div>
      );
    }
    if (lastFinished) {
      const s = BLOCK.sessions[lastFinished.entry.type];
      return (
        /*#__PURE__*/ <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#111",
              }}
            >
              Session saved ✓
            </div>
            <Badge label={lastFinished.entry.label} color={s.color} bg={s.bg} />
          </div>
          {!lastFinished.saved && (
            /*#__PURE__*/ <div
              style={{
                background: "#FAECE7",
                borderRadius: 10,
                padding: "10px 12px",
                marginBottom: 12,
                fontSize: 12,
                color: "#993C1D",
              }}
            >
              ⚠️ Storage save failed — copy summary below before closing
            </div>
          )}
          {autoPushStatus?.state === "error" && (
            /*#__PURE__*/ <div
              style={{
                background: "#FAECE7",
                borderRadius: 10,
                padding: "10px 12px",
                marginBottom: 12,
                fontSize: 12,
                color: "#993C1D",
              }}
            >
              ⚠️ Auto-sync to GitHub failed — {autoPushStatus.err || "unknown error"}
              . Push manually from the Sync panel.
            </div>
          )}
          <div
            style={{
              ...S.card,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#999",
                marginBottom: 8,
              }}
            >
              Copy to Coach
            </div>
            <pre
              style={{
                fontSize: 11,
                color: "#444",
                background: "#f5f5f3",
                borderRadius: 8,
                padding: 10,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: 240,
                overflowY: "auto",
                marginBottom: 10,
              }}
            >
              {lastFinished.summary}
            </pre>
            <button
              onClick={() => copyToCoach(lastFinished.summary)}
              style={{
                width: "100%",
                padding: 10,
                background: copied ? "#3B6D11" : "#111",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "background .2s",
              }}
            >
              {copied
                ? "✓ copied — paste into coach chat"
                : "copy session summary"}
            </button>
          </div>
          <button
            onClick={() => setLastFinished(null)}
            style={{
              width: "100%",
              padding: 10,
              border: "0.5px solid #ddd",
              borderRadius: 10,
              background: "#fff",
              fontSize: 13,
              color: "#666",
              cursor: "pointer",
            }}
          >
            done
          </button>
        </div>
      );
    }
    const lastByType = {};
    [...history]
      .sort((a, b) => parseSessionDate(b.date) - parseSessionDate(a.date))
      .forEach((h) => {
        if (!lastByType[h.type]) lastByType[h.type] = h;
      });
    return (
      /*#__PURE__*/ <div>
        <div style={S.label}>Start session</div>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {["legs", "push", "pull"].map((t) => (
            /*#__PURE__*/ <button
              key={t}
              onClick={() => startSession(t)}
              style={{
                flex: 1,
                padding: "12px 0",
                border: "0.5px solid #ddd",
                borderRadius: 10,
                background: "#fff",
                fontSize: 13,
                fontWeight: 600,
                color: BLOCK.sessions[t].color,
                cursor: "pointer",
              }}
            >
              {BLOCK.sessions[t].label}
            </button>
          ))}
        </div>
        <div style={S.label}>Last session per type</div>
        {["legs", "push", "pull"].map((t) => {
          const entry = lastByType[t];
          const s = BLOCK.sessions[t];
          if (!entry)
            return (
              /*#__PURE__*/ <div
                key={t}
                style={{
                  ...S.card,
                  opacity: 0.5,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: "#999",
                    }}
                  >
                    {s.label}
                  </span>
                  <Badge label="no sessions" color={s.color} bg={s.bg} />
                </div>
              </div>
            );
          return (
            /*#__PURE__*/ <div key={t} style={S.card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111",
                  }}
                >
                  {entry.label} · {entry.date}
                </div>
                <Badge label={entry.label} color={s.color} bg={s.bg} />
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#999",
                }}
              >
                {entry.movements.length} movements · {entry.movements.reduce((a, m) => a + m.sets.length, 0)} sets
              </div>
            </div>
          );
        })}
        <SyncPanel history={history} setHistory={setHistory} />
      </div>
    );
  }
  const session = BLOCK.sessions[active];
  const sessionVariants = SESSION_VARIANTS[active];
  const hasVariants = sessionVariants.length > 1;
  const totalSets = sessionMovements.reduce(
    (a, m) => a + (m._loggedSets || []).length,
    0,
  );
  const doneMov = sessionMovements.filter(
    (m) => (m._loggedSets || []).length > 0,
  ).length;
  return (
    /*#__PURE__*/ <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "#111",
          }}
        >
          {hasVariants
            ? session.label + " " + getVariant(active, variant).label
            : session.label}
        </div>
        <input
          type="date"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "4px 8px",
            borderRadius: 20,
            background: session.bg,
            color: session.color,
            border: "none",
            outline: "none",
          }}
        />
      </div>
      {hasVariants && (
        /*#__PURE__*/ <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 10,
          }}
        >
          {sessionVariants.map((v) => (
            /*#__PURE__*/ <button
              key={v.id}
              onClick={() => switchVariant(v.id)}
              style={{
                flex: 1,
                padding: "8px 0",
                border:
                  variant === v.id
                    ? "0.5px solid #111"
                    : "0.5px solid #ddd",
                borderRadius: 10,
                background: variant === v.id ? "#111" : "#fff",
                color: variant === v.id ? "#fff" : session.color,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
      <div
        style={{
          fontSize: 11,
          color: "#888",
          marginBottom: 14,
          marginTop: hasVariants ? -8 : 0,
        }}
      >
        rest {getVariant(active, variant).rest}
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 14,
        }}
      >
        {[
          ["movements", doneMov],
          ["total sets", totalSets],
        ].map(([l, v]) => (
          /*#__PURE__*/ <div
            key={l}
            style={{
              flex: 1,
              background: "#f5f5f3",
              borderRadius: 10,
              padding: 10,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 500,
                color: "#111",
              }}
            >
              {v}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#999",
                marginTop: 2,
              }}
            >
              {l}
            </div>
          </div>
        ))}
      </div>
      {sessionMovements.map((mov, idx) => (
        /*#__PURE__*/ <div
          key={mov.name + ":" + variant}
          style={{
            marginTop: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              margin: "0 0 4px",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: session.color,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                background: session.bg,
                padding: "2px 6px",
                borderRadius: 6,
              }}
            >
              {mov._group || "Other"}
            </span>
            <div
              style={{
                flex: 1,
                height: "0.5px",
                background: "#e5e5e3",
              }}
            />
            <span
              style={{
                fontSize: 10,
                color: "#bbb",
                marginRight: 4,
                fontWeight: 600,
              }}
            >
              #{idx + 1}
            </span>
            <button
              onClick={() => moveMovementUp(idx)}
              disabled={idx === 0}
              style={{
                background: "none",
                border: "none",
                cursor: idx === 0 ? "default" : "pointer",
                fontSize: 12,
                color: idx === 0 ? "#e5e5e3" : "#bbb",
                padding: "2px 4px",
                lineHeight: 1,
              }}
            >
              ▲
            </button>
            <button
              onClick={() => moveMovementDown(idx)}
              disabled={idx === sessionMovements.length - 1}
              style={{
                background: "none",
                border: "none",
                cursor:
                  idx === sessionMovements.length - 1 ? "default" : "pointer",
                fontSize: 12,
                color: idx === sessionMovements.length - 1 ? "#e5e5e3" : "#bbb",
                padding: "2px 4px",
                lineHeight: 1,
              }}
            >
              ▼
            </button>
          </div>
          <MovementRow
            mov={mov}
            sessionColor={session.color}
            history={history}
            sessionType={active}
            onChange={bumpTick}
          />
        </div>
      ))}
      <div style={S.label}>Session note</div>
      <textarea
        value={sessionNote}
        onChange={(e) => setSessionNote(e.target.value)}
        placeholder="Overall notes, flags, how you felt..."
        style={{
          width: "100%",
          padding: "9px 10px",
          border: "0.5px solid #ddd",
          borderRadius: 10,
          fontSize: 16,
          color: "#111",
          background: "#fff",
          resize: "none",
          height: 72,
          outline: "none",
        }}
      />
      <div
        style={{
          ...S.label,
          marginTop: 12,
        }}
      >
        Cardio finisher
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#999",
          marginBottom: 4,
        }}
      >
        Machine
      </div>
      <select
        value={cardio.machine}
        onChange={(e) =>
          setCardio((c) => ({
            ...c,
            machine: e.target.value,
          }))
        }
        style={{
          width: "100%",
          padding: "9px 10px",
          border: "0.5px solid #ddd",
          borderRadius: 10,
          fontSize: 16,
          color: "#111",
          background: "#fff",
          outline: "none",
          marginBottom: 8,
        }}
      >
        <option value=""></option>
        {CARDIO_MACHINE_OPTIONS.map((m) => (
          /*#__PURE__*/ <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 14,
        }}
      >
        {[
          ["duration", "min"],
          ["level", "level"],
          ["rpe", "rpe"],
        ].map(([field, fieldLabel]) => (
          /*#__PURE__*/ <div
            key={field}
            style={{
              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#999",
                marginBottom: 4,
              }}
            >
              {fieldLabel}
            </div>
            <input
              type="number"
              inputMode="numeric"
              value={cardio[field]}
              onChange={(e) =>
                setCardio((c) => ({
                  ...c,
                  [field]: e.target.value,
                }))
              }
              style={{
                width: "100%",
                padding: "9px 10px",
                border: "0.5px solid #ddd",
                borderRadius: 10,
                fontSize: 16,
                color: "#111",
                background: "#fff",
                outline: "none",
                minWidth: 0,
              }}
            />
          </div>
        ))}
      </div>
      {(() => {
        const unlogged = sessionMovements.map((m) => {
          const planned = m._plannedSets || [];
          const unloggedCount = planned.filter ? 0 : 0; // placeholder — check via DOM not reliable
          return null;
        });
        // Count movements with planned but unlogged sets by checking MovementRow state
        // We do this by checking sessionMovements for any that have _loggedSets < planned set count
        const unloggedMovements = sessionMovements.filter((m) => {
          const logged = (m._loggedSets || []).length;
          return logged === 0; // no sets logged at all
        });
        return unloggedMovements.length > 0 ? (
          /*#__PURE__*/ <div
            style={{
              background: "#FEF3C7",
              border: "0.5px solid #D97706",
              borderRadius: 10,
              padding: "10px 12px",
              marginTop: 10,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#92400E",
                marginBottom: 4,
              }}
            >
              ⚠️ Unlogged movements
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#92400E",
              }}
            >
              {unloggedMovements.map((m) => m.name).join(", ")} — no sets
              logged. Tap log on each set before finishing.
            </div>
          </div>
        ) : null;
      })()}
      {(() => {
        const unlogged = sessionMovements.filter(
          (m) => (m._loggedSets || []).length === 0,
        );
        return unlogged.length > 0 ? (
          /*#__PURE__*/ <div
            style={{
              background: "#FEF3C7",
              border: "0.5px solid #D97706",
              borderRadius: 10,
              padding: "10px 12px",
              marginTop: 10,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#92400E",
                marginBottom: 3,
              }}
            >
              ⚠️ No sets logged
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#92400E",
              }}
            >
              {unlogged.map((m) => m.name).join(", ")} — tap log on each set
              before finishing.
            </div>
          </div>
        ) : null;
      })()}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 10,
        }}
      >
        <button
          onClick={() => setActive(null)}
          style={{
            flex: 1,
            padding: 10,
            border: "0.5px solid #ddd",
            borderRadius: 10,
            background: "#fff",
            fontSize: 13,
            color: "#666",
            cursor: "pointer",
          }}
        >
          cancel
        </button>
        <button
          onClick={finish}
          style={{
            flex: 2,
            padding: 10,
            border: "none",
            borderRadius: 10,
            background: "#111",
            color: "#fff",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          finish session
        </button>
      </div>
    </div>
  );
}
function BlockScreen({ history }) {
  const [openMovement, setOpenMovement] = useState(null);
  const toggleMovement = (name) => {
    setOpenMovement((prev) => (prev === name ? null : name));
  };
  return (
    /*#__PURE__*/ <div>
      {["legs", "push", "pull"].map((key) => {
        const s = BLOCK.sessions[key];
        return (
          /*#__PURE__*/ <div key={key} style={S.card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#111",
                }}
              >
                {s.label}
              </span>
              <Badge
                label={`${s.movements.length} movements`}
                color={s.color}
                bg={s.bg}
              />
            </div>
            {s.movements.map((m, i) => {
              const pr = getMovementPR(history, m.name);
              const chartData = getMovementHistory(history, m.name);
              const isOpen = openMovement === m.name;
              return (
                /*#__PURE__*/ <div key={m.name}>
                  {i > 0 && /*#__PURE__*/ <div style={S.divider} />}
                  <div
                    onClick={() => toggleMovement(m.name)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      padding: "9px 0",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: "#111",
                        }}
                      >
                        {m.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#999",
                          marginTop: 2,
                        }}
                      >
                        {m.target}
                      </div>
                      {pr && (
                        /*#__PURE__*/ <div
                          style={{
                            fontSize: 10,
                            color: pr.statusColor,
                            marginTop: 3,
                            fontWeight: 500,
                          }}
                        >
                          {pr.status}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        textAlign: "right",
                        marginLeft: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#111",
                          }}
                        >
                          {m.current}
                        </div>
                        {pr && (
                          /*#__PURE__*/ <div
                            style={{
                              fontSize: 11,
                              color: "#888",
                              marginTop: 1,
                            }}
                          >
                            best: {pr.weight} lb × {pr.reps}
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#ccc",
                          transform: isOpen ? "rotate(180deg)" : "none",
                          display: "inline-block",
                          transition: "transform .15s",
                        }}
                      >
                        ▼
                      </span>
                    </div>
                  </div>
                  {isOpen && (
                    /*#__PURE__*/ <div
                      style={{
                        paddingBottom: 8,
                      }}
                    >
                      <MovementChart data={chartData} color={s.color} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      <div style={S.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#111",
            }}
          >
            Active flags
          </span>
          <Badge label={`${BLOCK.flags.length}`} color="#993C1D" bg="#FAECE7" />
        </div>
        {BLOCK.flags.map((f, i) => (
          /*#__PURE__*/ <div key={i}>
            {i > 0 && /*#__PURE__*/ <div style={S.divider} />}
            <div
              style={{
                display: "flex",
                gap: 10,
                padding: "7px 0",
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#D85A30",
                  marginTop: 5,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  color: "#666",
                  lineHeight: 1.5,
                }}
              >
                {f}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Group sessions into Mon–Sun weeks
function groupByWeek(history) {
  const weeks = {};
  [...history].forEach((session) => {
    const d = parseSessionDate(session.date);
    const day = d.getDay(); // 0=Sun
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((day + 6) % 7));
    mon.setHours(0, 0, 0, 0);
    const key = mon.toISOString().split("T")[0];
    if (!weeks[key])
      weeks[key] = {
        monDate: mon,
        sessions: [],
      };
    weeks[key].sessions.push(session);
  });
  // sort weeks newest first
  return Object.entries(weeks)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, val]) => ({
      key,
      ...val,
    }));
}

// Detect new PRs within a session: highest weight × reps for a movement
// vs all sessions before it
function getSessionPRs(session, history) {
  const sessionTs = parseSessionDate(session.date).getTime();
  const prior = history.filter(
    (h) => parseSessionDate(h.date).getTime() < sessionTs,
  );
  const prs = [];
  session.movements.forEach((mov) => {
    mov.sets.forEach((s) => {
      const w = parseFloat(s.weight);
      const r = parseInt(s.reps);
      if (!w || !r) return;
      // best prior weight for this movement
      let priorMax = 0;
      prior.forEach((h) => {
        const m = h.movements.find((m) => m.name === mov.name);
        if (!m) return;
        m.sets.forEach((ps) => {
          const pw = parseFloat(ps.weight);
          if (pw > priorMax) priorMax = pw;
        });
      });
      if (w > priorMax && priorMax > 0) {
        // only add once per movement per session
        if (!prs.find((p) => p.name === mov.name && p.weight === w)) {
          prs.push({
            name: mov.name,
            weight: w,
            reps: r,
          });
        }
      }
    });
  });
  return prs;
}
function WeekCard({ week, history, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const [openSession, setOpenSession] = useState(null);
  const totalSets = week.sessions.reduce(
    (a, s) => a + s.movements.reduce((b, m) => b + m.sets.length, 0),
    0,
  );
  const allPRs = week.sessions.flatMap((s) =>
    getSessionPRs(s, history).map((pr) => ({
      ...pr,
      session: s.label,
      date: s.date,
    })),
  );
  const monStr = week.monDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const sunDate = new Date(week.monDate);
  sunDate.setDate(week.monDate.getDate() + 6);
  const sunStr = sunDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const typeColors = {
    legs: "#3B6D11",
    push: "#185FA5",
    pull: "#3C3489",
  };
  const typeBgs = {
    legs: "#EAF3DE",
    push: "#E6F1FB",
    pull: "#EEEDFE",
  };
  return (
    /*#__PURE__*/ <div
      style={{
        border: "0.5px solid #e5e5e3",
        borderRadius: 14,
        marginBottom: 10,
        overflow: "hidden",
      }}
    >
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          padding: "12px 14px",
          background: "#f9f9f8",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#111",
            }}
          >
            {monStr} — {sunStr}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "#999",
              }}
            >
              {week.sessions.length} sessions · {totalSets} sets
            </span>
            <span
              style={{
                fontSize: 11,
                color: "#bbb",
                transform: open ? "rotate(180deg)" : "none",
                display: "inline-block",
                transition: "transform .15s",
              }}
            >
              ▼
            </span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            marginTop: 8,
            flexWrap: "wrap",
          }}
        >
          {week.sessions.map((s) => (
            /*#__PURE__*/ <Badge
              key={s.id}
              label={`${s.label} ${s.date.split(",")[0]}`}
              color={typeColors[s.type] || "#888"}
              bg={typeBgs[s.type] || "#eee"}
            />
          ))}
        </div>
        {allPRs.length > 0 && (
          /*#__PURE__*/ <div
            style={{
              marginTop: 8,
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {allPRs.map((pr, i) => (
              /*#__PURE__*/ <div
                key={i}
                style={{
                  background: "#FEF3C7",
                  borderRadius: 6,
                  padding: "2px 8px",
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#92400E",
                }}
              >
                🏆 {pr.name} {pr.weight} lb × {pr.reps}
              </div>
            ))}
          </div>
        )}
      </div>
      {open && (
        /*#__PURE__*/ <div
          style={{
            padding: "10px 14px 14px",
          }}
        >
          {week.sessions.map((session) => {
            const sessColor = typeColors[session.type] || "#888";
            const sessBg = typeBgs[session.type] || "#eee";
            const sessionPRs = getSessionPRs(session, history);
            const isOpen = openSession === session.id;
            const totalSessionSets = session.movements.reduce(
              (a, m) => a + m.sets.length,
              0,
            );
            const allNotes = session.movements.flatMap((m) =>
              m.sets
                .filter((s) => s.note)
                .map((s) => ({
                  mov: m.name,
                  note: s.note,
                })),
            );
            return (
              /*#__PURE__*/ <div
                key={session.id}
                style={{
                  border: "0.5px solid #e5e5e3",
                  borderRadius: 10,
                  marginBottom: 8,
                  overflow: "hidden",
                }}
              >
                <div
                  onClick={() => setOpenSession(isOpen ? null : session.id)}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    userSelect: "none",
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#111",
                      }}
                    >
                      {session.label} · {session.date}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: "#999",
                        }}
                      >
                        {totalSessionSets} sets
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#bbb",
                          transform: isOpen ? "rotate(180deg)" : "none",
                          display: "inline-block",
                          transition: "transform .15s",
                        }}
                      >
                        ▼
                      </span>
                    </div>
                  </div>
                  {sessionPRs.length > 0 && (
                    /*#__PURE__*/ <div
                      style={{
                        display: "flex",
                        gap: 6,
                        marginTop: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      {sessionPRs.map((pr, i) => (
                        /*#__PURE__*/ <div
                          key={i}
                          style={{
                            background: "#FEF3C7",
                            borderRadius: 6,
                            padding: "2px 8px",
                            fontSize: 10,
                            fontWeight: 600,
                            color: "#92400E",
                          }}
                        >
                          🏆 {pr.name} {pr.weight} lb
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {isOpen && (
                  /*#__PURE__*/ <div
                    style={{
                      padding: "10px 12px",
                      background: "#f9f9f8",
                      borderTop: "0.5px solid #e5e5e3",
                    }}
                  >
                    {session.movements.map((mov) => (
                      /*#__PURE__*/ <div
                        key={mov.name}
                        style={{
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#333",
                            marginBottom: 4,
                          }}
                        >
                          {mov.name}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 4,
                          }}
                        >
                          {mov.sets.map((s, i) => {
                            const rpe = parseFloat(s.rpe);
                            const dotC = rpeColor(s.rpe);
                            return (
                              /*#__PURE__*/ <div
                                key={i}
                                style={{
                                  background: "#fff",
                                  border: `1px solid ${dotC}`,
                                  borderRadius: 6,
                                  padding: "3px 7px",
                                  fontSize: 11,
                                }}
                              >
                                <span
                                  style={{
                                    color: "#111",
                                  }}
                                >
                                  {s.weight}×{s.reps}
                                </span>
                                {s.rpe && (
                                  /*#__PURE__*/ <span
                                    style={{
                                      color: dotC,
                                      fontWeight: 600,
                                      marginLeft: 3,
                                    }}
                                  >
                                    {s.rpe}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {mov.sets
                          .filter((s) => s.note)
                          .map((s, i) => (
                            /*#__PURE__*/ <div
                              key={i}
                              style={{
                                fontSize: 11,
                                color: "#999",
                                fontStyle: "italic",
                                marginTop: 3,
                              }}
                            >
                              S{s.set}: {s.note}
                            </div>
                          ))}
                        {mov.note && (
                          /*#__PURE__*/ <div
                            style={{
                              fontSize: 11,
                              color: "#999",
                              fontStyle: "italic",
                              marginTop: 3,
                            }}
                          >
                            {mov.note}
                          </div>
                        )}
                      </div>
                    ))}
                    {session.note && (
                      /*#__PURE__*/ <div
                        style={{
                          borderTop: "0.5px solid #e5e5e3",
                          paddingTop: 8,
                          marginTop: 4,
                          fontSize: 12,
                          color: "#666",
                          fontStyle: "italic",
                        }}
                      >
                        {session.note}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
function ProgressScreen({ history }) {
  const [showHandoff, setShowHandoff] = useState(false);
  const [copied, setCopied] = useState(false);
  const weeks = groupByWeek(history);
  const handoffText = buildHandoff(history);
  const copyHandoff = () => {
    navigator.clipboard
      .writeText(handoffText)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        const ta = document.createElement("textarea");
        ta.value = handoffText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  };
  const sessionsByType = {
    legs: 0,
    push: 0,
    pull: 0,
  };
  history.forEach((h) => {
    if (sessionsByType[h.type] !== undefined) sessionsByType[h.type]++;
  });
  const totalSets = history.reduce(
    (a, s) => a + s.movements.reduce((b, m) => b + m.sets.length, 0),
    0,
  );
  return (
    /*#__PURE__*/ <div>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        {[
          ["sessions", history.length],
          ["sets", totalSets],
          ["legs", sessionsByType.legs],
          ["push", sessionsByType.push],
          ["pull", sessionsByType.pull],
        ].map(([l, v]) => (
          /*#__PURE__*/ <div
            key={l}
            style={{
              flex: "1 1 60px",
              background: "#f5f5f3",
              borderRadius: 10,
              padding: "10px 8px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 500,
                color: "#111",
              }}
            >
              {v}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#999",
                marginTop: 2,
              }}
            >
              {l}
            </div>
          </div>
        ))}
      </div>
      <div style={S.label}>Weekly breakdown</div>
      {weeks.map((week, i) => (
        /*#__PURE__*/ <WeekCard
          key={week.key}
          week={week}
          history={history}
          defaultOpen={i === 0}
        />
      ))}
      <div
        style={{
          ...S.card,
          marginTop: 4,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#111",
            }}
          >
            Coach handoff
          </div>
          <button
            onClick={() => setShowHandoff((o) => !o)}
            style={{
              fontSize: 11,
              color: "#999",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            {showHandoff ? "hide" : "preview"}
          </button>
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#999",
            marginBottom: 10,
          }}
        >
          Copy into a new Claude chat to resume coaching.
        </div>
        {showHandoff && (
          /*#__PURE__*/ <pre
            style={{
              fontSize: 10,
              color: "#555",
              background: "#f5f5f3",
              borderRadius: 8,
              padding: 10,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: 200,
              overflowY: "auto",
              marginBottom: 10,
            }}
          >
            {handoffText}
          </pre>
        )}
        <button
          onClick={copyHandoff}
          style={{
            width: "100%",
            padding: 10,
            background: copied ? "#3B6D11" : "#111",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            transition: "background .2s",
          }}
        >
          {copied ? "✓ copied to clipboard" : "copy handoff summary"}
        </button>
      </div>
    </div>
  );
}
function SyncPanel({ history, setHistory }) {
  const [cfg, setCfg] = useState(() => loadSyncCfg());
  // Expanded by default until a token is configured — collapsed-by-default
  // meant most people never found this panel at all.
  const [show, setShow] = useState(() => !loadSyncCfg().token);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const upd = (k, v) => {
    const next = {
      ...cfg,
      [k]: v,
    };
    setCfg(next);
    saveSyncCfg(next);
  };
  const doPush = async () => {
    setBusy(true);
    setStatus("pushing...");
    const r = await syncPush(cfg, history);
    setStatus(r.ok ? "✓ pushed " + r.count + " sessions" : "✗ " + r.err);
    setBusy(false);
  };
  const doPull = async () => {
    setBusy(true);
    setStatus("pulling...");
    const r = await syncPull(cfg);
    if (!r.ok) {
      setStatus("✗ " + r.err);
      setBusy(false);
      return;
    }
    const merged = mergeSessions(history, r.sessions);
    const added = merged.length - history.length;
    setHistory(merged);
    saveData(merged);
    setStatus("✓ pulled " + r.sessions.length + ", merged +" + added);
    setBusy(false);
  };
  const doReplaceFromRemote = async () => {
    if (
      !window.confirm(
        "Replace local history with sessions.json from GitHub? This overwrites everything on this device, including anything not yet pushed, and can't be undone.",
      )
    )
      return;
    setBusy(true);
    setStatus("replacing from remote...");
    const r = await syncPull(cfg);
    if (!r.ok) {
      setStatus("✗ " + r.err);
      setBusy(false);
      return;
    }
    setHistory(r.sessions);
    saveData(r.sessions);
    setStatus("✓ replaced local with " + r.sessions.length + " remote sessions");
    setBusy(false);
  };
  const inp = {
    width: "100%",
    padding: "8px 10px",
    border: "0.5px solid #ddd",
    borderRadius: 8,
    fontSize: 16,
    color: "#111",
    background: "#fff",
    outline: "none",
    marginBottom: 6,
  };
  const btn = (extra) => ({
    flex: 1,
    padding: "10px 12px",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
    cursor: busy ? "default" : "pointer",
    opacity: busy ? 0.6 : 1,
    ...extra,
  });
  return (
    /*#__PURE__*/ <div
      style={{
        border: "0.5px solid #e5e5e3",
        borderRadius: 12,
        padding: 12,
        marginTop: 12,
        background: "#fafafa",
      }}
    >
      <div
        onClick={() => setShow((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#666",
          }}
        >
          Sync · GitHub
        </span>
        <span
          style={{
            fontSize: 12,
            color: "#999",
          }}
        >
          {show ? "▲" : "▼"}
        </span>
      </div>
      {show && (
        /*#__PURE__*/ <div
          style={{
            marginTop: 10,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#888",
              marginBottom: 8,
              lineHeight: 1.4,
            }}
          >
            Fine-grained PAT, Contents: read+write, this repo only. Stored on
            this device only - never committed.
          </div>
          <input
            type="password"
            value={cfg.token}
            placeholder="github_pat_..."
            onChange={(e) => upd("token", e.target.value.trim())}
            style={inp}
          />
          <input
            value={cfg.repo}
            placeholder="owner/repo"
            onChange={(e) => upd("repo", e.target.value.trim())}
            style={inp}
          />
          <input
            value={cfg.path}
            placeholder="sessions.json"
            onChange={(e) => upd("path", e.target.value.trim())}
            style={inp}
          />
          <input
            value={cfg.branch}
            placeholder="main"
            onChange={(e) => upd("branch", e.target.value.trim())}
            style={inp}
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#555",
              margin: "4px 0 10px",
            }}
          >
            <input
              type="checkbox"
              checked={!!cfg.auto}
              onChange={(e) => upd("auto", e.target.checked)}
            />
            Auto-push when a session is finished
          </label>
          <div
            style={{
              display: "flex",
              gap: 8,
            }}
          >
            <button
              onClick={doPush}
              disabled={busy}
              style={btn({
                background: "#111",
              })}
            >
              push now
            </button>
            <button
              onClick={doPull}
              disabled={busy}
              style={btn({
                background: "#555",
              })}
            >
              pull + merge
            </button>
          </div>
          <button
            onClick={doReplaceFromRemote}
            disabled={busy}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "0.5px solid #E8B4A6",
              borderRadius: 8,
              background: "#fff",
              fontSize: 12,
              fontWeight: 600,
              color: "#B91C1C",
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.6 : 1,
              marginTop: 8,
            }}
          >
            replace local from remote
          </button>
          <div
            style={{
              fontSize: 10,
              color: "#aaa",
              marginTop: 4,
              lineHeight: 1.4,
            }}
          >
            Destructive — overwrites this device's history with
            sessions.json. mergeSessions is additive-only, so a local delete
            can't otherwise be undone by pulling; use this when you deleted a
            session by mistake and the repo still has it.
          </div>
          {status && (
            /*#__PURE__*/ <div
              style={{
                fontSize: 12,
                marginTop: 8,
                color: status.indexOf("✗") === 0 ? "#B91C1C" : "#3B6D11",
                wordBreak: "break-word",
              }}
            >
              {status}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function HistoryScreen({ history, setHistory }) {
  const [open, setOpen] = useState({});
  const toggle = (id) =>
    setOpen((o) => ({
      ...o,
      [id]: !o[id],
    }));
  const del = (target) => {
    // Match the exact record (id collisions exist in legacy data, so id alone is unsafe)
    let removed = false;
    const updated = history.filter((h) => {
      if (removed) return true;
      const same =
        h === target ||
        (h.id === target.id &&
          h.type === target.type &&
          h.date === target.date);
      if (same) {
        removed = true;
        return false;
      }
      return true;
    });
    setHistory(updated);
    saveData(updated);
  };
  if (!history.length)
    return (
      /*#__PURE__*/ <div
        style={{
          textAlign: "center",
          padding: "40px 16px",
          color: "#aaa",
          fontSize: 13,
        }}
      >
        No sessions logged yet.
      </div>
    );
  return (
    /*#__PURE__*/ <div>
      <div
        style={{
          fontSize: 12,
          color: "#999",
          marginBottom: 12,
        }}
      >
        {history.length} session{history.length !== 1 ? "s" : ""} logged
      </div>
      {history.map((entry) => {
        const s = sess(entry.type);
        const totalSets = entry.movements.reduce(
          (a, m) => a + m.sets.length,
          0,
        );
        const isOpen = open[entry.id];
        return (
          /*#__PURE__*/ <div
            key={entry.id}
            style={{
              border: "0.5px solid #e5e5e3",
              borderRadius: 10,
              marginBottom: 8,
              overflow: "hidden",
            }}
          >
            <div
              onClick={() => toggle(entry.id)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "11px 12px",
                background: "#f9f9f8",
                cursor: "pointer",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#111",
                  }}
                >
                  {entry.label} · {entry.date}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#999",
                    marginTop: 2,
                  }}
                >
                  {entry.movements.length} movements · {totalSets} sets
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Badge label={entry.label} color={s.color} bg={s.bg} />
                <span
                  style={{
                    fontSize: 11,
                    color: "#bbb",
                    transform: isOpen ? "rotate(180deg)" : "none",
                    display: "inline-block",
                    transition: "transform .15s",
                  }}
                >
                  ▼
                </span>
              </div>
            </div>
            {isOpen && (
              /*#__PURE__*/ <div
                style={{
                  padding: "12px",
                  background: "#fff",
                }}
              >
                {entry.movements.map((m) => (
                  /*#__PURE__*/ <div
                    key={m.name}
                    style={{
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#333",
                        marginBottom: 4,
                      }}
                    >
                      {m.name}
                    </div>
                    {m.sets.map((s, i) => (
                      /*#__PURE__*/ <div
                        key={i}
                        style={{
                          fontSize: 12,
                          color: "#777",
                          padding: "2px 0",
                        }}
                      >
                        S{s.set}: {s.weight ? s.weight + " lb" : "—"} × {s.reps || "—"} reps{s.rpe ? ` · RPE ${s.rpe}` : ""}
                        {s.note ? (
                          /*#__PURE__*/ <span
                            style={{ fontStyle: "italic", color: "#aaa" }}
                          >
                            {" · "}
                            {s.note}
                          </span>
                        ) : (
                          ""
                        )}
                      </div>
                    ))}
                    {m.note && (
                      /*#__PURE__*/ <div
                        style={{
                          fontSize: 12,
                          color: "#aaa",
                          fontStyle: "italic",
                          padding: "2px 0",
                        }}
                      >
                        {m.note}
                      </div>
                    )}
                  </div>
                ))}
                {hasCardioData(entry.cardio) && (
                  /*#__PURE__*/ <div
                    style={{
                      fontSize: 12,
                      color: "#3B6D11",
                      borderTop: "0.5px solid #eee",
                      paddingTop: 8,
                      marginTop: 4,
                    }}
                  >
                    🏃 {formatCardio(entry.cardio)}
                  </div>
                )}
                {entry.note && (
                  /*#__PURE__*/ <div
                    style={{
                      fontSize: 12,
                      color: "#999",
                      borderTop: "0.5px solid #eee",
                      paddingTop: 8,
                      marginTop: 4,
                      fontStyle: "italic",
                    }}
                  >
                    {entry.note}
                  </div>
                )}
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        "Delete this session? This can't be undone.",
                      )
                    )
                      del(entry);
                  }}
                  style={{
                    marginTop: 10,
                    padding: "5px 12px",
                    border: "0.5px solid #D85A30",
                    borderRadius: 8,
                    background: "none",
                    color: "#D85A30",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  delete session
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
const TABS = ["session", "block", "progress", "history"];
function App() {
  const [tab, setTab] = useState("session");
  const [history, setHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const saved = loadData();
    const cfg = loadSyncCfg();
    const hasRemote = !!(cfg.repo && cfg.path);
    // No local history yet and a remote is configured: sessions.json is the
    // only source of truth in that case, so hold the loading state until the
    // pull resolves instead of flashing an empty history first.
    const waitingOnRemote = saved.length === 0 && hasRemote;
    if (!waitingOnRemote) {
      setHistory(saved);
      setLoaded(true);
    }
    if (hasRemote) {
      syncPull(cfg).then((r) => {
        let resolved = saved;
        if (r.ok && r.sessions && r.sessions.length) {
          const merged = mergeSessions(saved, r.sessions);
          if (merged.length !== saved.length) {
            resolved = merged;
            saveData(merged);
          }
        }
        if (waitingOnRemote) {
          setHistory(resolved);
          setLoaded(true);
        } else if (resolved !== saved) {
          setHistory(resolved);
        }
      });
    }
  }, []);
  if (!loaded)
    return (
      /*#__PURE__*/ <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: 200,
          fontSize: 13,
          color: "#aaa",
        }}
      >
        Loading...
      </div>
    );
  return (
    /*#__PURE__*/ <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "12px 12px 40px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 3,
          marginBottom: 16,
          background: "#f0ede8",
          borderRadius: 10,
          padding: 4,
        }}
      >
        {TABS.map((t) => (
          /*#__PURE__*/ <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "8px 0",
              border: "none",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: tab === t ? 600 : 400,
              background: tab === t ? "#fff" : "transparent",
              color: tab === t ? "#111" : "#888",
              cursor: "pointer",
              boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              transition: "all .15s",
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === "session" && (
        /*#__PURE__*/ <SessionScreen
          history={history}
          setHistory={setHistory}
        />
      )}
      {tab === "block" && /*#__PURE__*/ <BlockScreen history={history} />}
      {tab === "progress" && (
        /*#__PURE__*/ <ProgressScreen history={history} />
      )}
      {tab === "history" && (
        /*#__PURE__*/ <HistoryScreen
          history={history}
          setHistory={setHistory}
        />
      )}
      <div
        style={{
          textAlign: "center",
          fontSize: 10,
          color: "#ccc",
          marginTop: 24,
        }}
      >
        {formatBuildStamp()}
      </div>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(
  /*#__PURE__*/ <App />,
);
