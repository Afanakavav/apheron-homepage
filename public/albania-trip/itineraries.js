// Albania Summer Trip 2026 — itinerary comparison data (single source of truth).
// Consumed by itinerary-view.js (the "Itineraries" tab inside the trip app).

export const PLACE_ICON = {
  airport: "✈️", city: "🏛️", sea: "🏖️", nature: "🌿", mountain: "🏔️", border: "🛂"
};

// Pulled from the questionnaire results — the yardstick for judging each route.
export const PREFS = [
  { icon: "⚖️", label: "~50/50 relax & adventure" },
  { icon: "🥾", label: "Easy 1–2h walks, not hard hikes" },
  { icon: "🏖️", label: "Clear scenic beaches, by car" },
  { icon: "🍽️", label: "Traditional, good-value food" },
  { icon: "🚗", label: "≤ 3h driving per day" },
  { icon: "🛏️", label: "Few moves, 3+ nights per base" },
  { icon: "🌡️", label: "Heat-aware planning" },
  { icon: "💶", label: "Good value, no tourist traps" }
];

// Driving legs: h = estimated hours door-to-door (summer, excl. stops). border = crosses into Montenegro.
export const ITINERARIES = [
  {
    id: 1,
    name: "Kristi's Route",
    tagline: "The local-friend Albania classic",
    score: 7.0,
    bases: 6,
    stress: "medium",
    bestFor: "Seeing the most highlights, local-style",
    mainRisk: "Too much Tirana, weak Durrës finish, some full transfer days",
    verdict: "Beautiful, but not optimised",
    summary:
      "A genuinely beautiful Albania route from a local friend: Tirana, Berat, Gjirokastër, Përmet, Himarë, Shkodër, Theth and a final Durrës/Tirana stop.",
    route: [
      { p: "Tirana", t: "city" }, { p: "Gjirokastër", t: "city" }, { p: "Himarë", t: "sea" },
      { p: "Shkodër", t: "city" }, { p: "Theth", t: "mountain" }, { p: "Durrës", t: "sea" }
    ],
    legs: [
      { from: "Tirana", to: "Berat", h: 2.0 },
      { from: "Berat", to: "Gjirokastër", h: 2.5 },
      { from: "Gjirokastër", to: "Himarë", h: 4.0, note: "via Përmet" },
      { from: "Himarë", to: "Shkodër", h: 5.5, note: "via Dhërmi / Mrizi i Zanave" },
      { from: "Shkodër", to: "Theth", h: 2.25 },
      { from: "Theth", to: "Durrës", h: 3.75 },
      { from: "Durrës", to: "Tirana (airport)", h: 0.75 }
    ],
    timeline: [
      "01 · Tirana", "02 · Tirana", "03 · Gjirokastër (via Berat)", "04 · Gjirokastër",
      "05 · Himarë (via Përmet)", "06 · Himarë", "07 · Himarë", "08 · Himarë / Butrint / Porto Palermo",
      "09 · Himarë", "10 · Himarë", "11 · Shkodër (via Dhërmi / Mrizi)", "12 · Theth",
      "13 · Theth", "14 · Durrës", "15 · Tirana", "16 · Flight home"
    ],
    pros: [
      "Strong highlights: Gjirokastër, Himarë, Shkodër, Theth",
      "Great variety — city, culture, sea, mountains, food",
      "Himarë well covered as the main beach base",
      "Theth gives a memorable mountain finale",
      "Mrizi i Zanave is a superb food stop if booked"
    ],
    cons: [
      "Two nights in Tirana — more than the group wants",
      "Durrës is a weak final stop vs Himarë / Theth",
      "One brutal 5h30 transfer (Himarë → Shkodër) plus a packed Tirana→Berat→Gjirokastër day",
      "Përmet — loved for nature/thermal baths — is only a quick passage",
      "Heat poorly managed if towns/castles are visited at midday"
    ]
  },
  {
    id: 2,
    name: "Albania + Montenegro",
    tagline: "The ambitious cross-border route",
    score: 6.5,
    scoreNote: "beauty 8/10 · practicality for this group 6/10",
    bases: 5,
    stress: "high",
    bestFor: "Adding a second country & the Bay of Kotor",
    mainRisk: "Border crossings, extra driving, crowds, cost & logistics",
    verdict: "Stunning on paper, too tiring in practice",
    summary:
      "South Albania + the Riviera, then Montenegro (especially the Bay of Kotor) instead of North Albania and Theth.",
    route: [
      { p: "Tirana", t: "airport" }, { p: "Gjirokastër", t: "city" }, { p: "Himarë", t: "sea" },
      { p: "Shkodër", t: "city" }, { p: "Kotor (ME)", t: "border" }, { p: "Tirana", t: "airport" }
    ],
    legs: [
      { from: "Tirana", to: "Gjirokastër", h: 3.75 },
      { from: "Gjirokastër", to: "Përmet", h: 1.25 },
      { from: "Përmet", to: "Himarë", h: 2.75 },
      { from: "Himarë", to: "Shkodër", h: 5.5 },
      { from: "Shkodër", to: "Kotor (ME)", h: 2.5, border: true },
      { from: "Kotor (ME)", to: "Tirana (airport)", h: 4.5, border: true, note: "via Shkodër" }
    ],
    timeline: [
      "01 · Tirana Airport", "02 · Gjirokastër", "03 · Gjirokastër", "04 · Përmet → coast",
      "05 · Himarë", "06 · Himarë", "07 · Himarë", "08 · Himarë", "09 · Himarë",
      "10 · Shkodër", "11 · Montenegro / Kotor Bay", "12 · Kotor Bay", "13 · Kotor Bay",
      "14 · Kotor Bay", "15 · Tirana Airport", "16 · Flight home"
    ],
    pros: [
      "Montenegro is genuinely beautiful",
      "Kotor, Perast, Herceg Novi — memorable coastal scenery",
      "A second country makes the trip feel broader",
      "Sea + mountain landscapes without hard trekking",
      "All four liked the idea at the start"
    ],
    cons: [
      "Two border crossings in peak August (paperwork + queues)",
      "The longest legs (5h30 + a 4h30 border return) are tiring",
      "Needs cross-border car authorisation + green card / insurance",
      "Kotor, Perast & Budva get very crowded; parking is hard",
      "More cost and stress — and it forces dropping Theth"
    ]
  },
  {
    id: 3,
    name: "Optimised Albania-only",
    tagline: "The smartest route for the four of you",
    recommended: true,
    score: 8.5,
    bases: 5,
    stress: "low",
    bestFor: "Balance: sea, nature, culture, mountain — low stress",
    mainRisk: "Giving up Montenegro (a conscious quality trade-off)",
    verdict: "Best balance for this group",
    summary:
      "South Albania, real nature in Përmet, a long Himarë beach base, Tirana as a smart buffer, then Shkodër & Theth as a cooler mountain finale.",
    route: [
      { p: "Tirana", t: "airport" }, { p: "Gjirokastër", t: "city" }, { p: "Përmet", t: "nature" },
      { p: "Himarë", t: "sea" }, { p: "Tirana", t: "city" }, { p: "Shkodër", t: "city" }, { p: "Theth", t: "mountain" }
    ],
    legs: [
      { from: "Tirana (airport)", to: "Gjirokastër", h: 3.75 },
      { from: "Gjirokastër", to: "Përmet", h: 1.25 },
      { from: "Përmet", to: "Himarë", h: 2.75 },
      { from: "Himarë", to: "Tirana", h: 3.75 },
      { from: "Tirana", to: "Shkodër", h: 1.75 },
      { from: "Shkodër", to: "Theth", h: 2.25 },
      { from: "Theth", to: "Tirana (airport)", h: 3.75, note: "via Shkodër" }
    ],
    timeline: [
      "01 · Tirana Airport", "02 · Gjirokastër", "03 · Gjirokastër", "04 · Përmet",
      "05 · Himarë", "06 · Himarë", "07 · Himarë", "08 · Himarë", "09 · Himarë", "10 · Himarë",
      "11 · Tirana (buffer)", "12 · Shkodër", "13 · Theth", "14 · Theth",
      "15 · Tirana Airport / Krujë", "16 · Flight home"
    ],
    pros: [
      "Best overall balance — culture, nature, sea, city, mountain",
      "No international border complexity",
      "No single brutal drive: the longest leg is ~3h45, not 5h30",
      "Himarë gets a real 6-night beach base, not just a stop",
      "Përmet gets a proper role (river, thermal baths, nature)",
      "Theth keeps the 'wow' finale, with 2 nights so it's not rushed",
      "Safe last night near the airport for the noon flight"
    ],
    cons: [
      "Montenegro is sacrificed",
      "A few ~3h45 transfer days remain (keep them activity-free)",
      "Theth needs mountain driving — easy-access lodging, leave early",
      "Himarë is busy in August — book early, AC + parking"
    ]
  }
];

export const MATRIX = {
  criteria: [
    { label: "Beauty of places", scores: [8.5, 9.0, 8.5] },
    { label: "Relaxation", scores: [7.0, 6.5, 8.5] },
    { label: "Light driving", scores: [6.0, 5.5, 7.5] },
    { label: "Low logistical stress", scores: [6.0, 5.0, 8.0] },
    { label: "Fit for the group", scores: [7.0, 6.5, 9.0] },
    { label: "Sea / beach quality", scores: [8.5, 8.0, 8.5] },
    { label: "Nature / mountain", scores: [8.0, 7.5, 8.5] },
    { label: "Food / local life", scores: [8.0, 7.5, 8.0] },
    { label: "Low crowd risk", scores: [6.5, 5.5, 7.0] },
    { label: "Heat management", scores: [6.5, 6.5, 7.5] },
    { label: "Ease of booking", scores: [7.0, 5.5, 7.0] },
    { label: "Safe final flight", scores: [7.0, 6.0, 8.5] }
  ],
  overall: ["Good, but needs edits", "Beautiful, but tiring", "Best balance"]
};

export const RECOMMENDATION = {
  giveUp: "Montenegro",
  reframe:
    "Montenegro isn't dropped because it's not worth it — it's dropped because, in this specific 15-day route, it adds more stress than value.",
  whyWins: [
    "Keeps Albania's best variety with the least stress",
    "No border crossing, car paperwork or queues",
    "No single brutal drive — longest leg ~3h45 vs 5h30",
    "A real Himarë beach base + a Theth mountain finale",
    "Heat-aware rhythm and a safe airport-side last night"
  ],
  gain: [
    "A smoother, more relaxed, more realistic trip",
    "More time actually enjoying places vs driving",
    "Better value — fewer, better-located stays",
    "A trip that fits all four travellers, not just one"
  ]
};

export const PRACTICAL = [
  { icon: "🛂", title: "Border complexity", text: "Montenegro needs car permission, green card/insurance and possible queues. Dropping it removes a whole category of risk." },
  { icon: "🥵", title: "Heat fatigue is cumulative", text: "It's not just temperature — it's heat + driving + hotel changes stacking up. Fewer moves = less exhaustion." },
  { icon: "🅿️", title: "Parking is the hidden stress", text: "In August, parking in Himarë, Gjirokastër, Theth and coastal towns can be the biggest daily headache. Book stays with parking." },
  { icon: "🛣️", title: "Transfer-day rule", text: "On any day with more than ~3h of driving, don't schedule major sightseeing too." },
  { icon: "🏔️", title: "Theth, realistically", text: "Treat Theth as scenic mountain time, not a hard hiking destination. Easy walks only." },
  { icon: "🛏️", title: "Quality over quantity", text: "Better to spend a bit more on fewer, well-located stays with AC and parking than chase many stops." },
  { icon: "📅", title: "Weekend beach crowds", text: "Beaches near Himarë get busier on weekends — save the most relaxed beach day for then, not an ambitious day-trip." },
  { icon: "✈️", title: "Protect the flight", text: "Last night near Tirana/Krujë, never in Theth or the deep south, so the noon departure is safe." }
];

export const HEAT_NOTES = [
  "Visit towns, castles & viewpoints in the morning or after 17:00.",
  "Use midday (12:00–17:00) for the beach, lunch, shade or AC.",
  "Never overload a transfer day with big activities.",
  "Always choose lodging with AC and confirmed parking.",
  "For Theth: confirm road access & parking, leave early, no night driving."
];

export const DRIVING_NOTE =
  "Estimated summer driving times, door-to-door and excluding stops. Real times vary with traffic, roadworks and the famously scenic-but-slow coastal & mountain roads — add buffer.";
