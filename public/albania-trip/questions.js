// Albania & Montenegro Summer Trip 2026 — questionnaire schema
// Single source of truth: both the form renderer and the analysis dashboard
// read from here, so question IDs and options can never drift apart.

export const PEOPLE = ["Francesco", "Martina", "Silvia", "Orrin"];

// Question types: "single" (radio), "multi" (checkbox),
// "scale" (1-5 radio with min/max labels), "paragraph" (free text).
export const SECTIONS = [
  {
    id: "s1",
    title: "Travel Style",
    questions: [
      {
        id: "q1",
        type: "single",
        required: true,
        label: "What kind of holiday would you prefer?",
        options: [
          "70% relax / 30% adventure",
          "60% relax / 40% adventure",
          "50% relax / 50% adventure",
          "40% relax / 60% adventure",
          "I'm flexible"
        ]
      },
      {
        id: "q2",
        type: "single",
        required: true,
        label: "What would be your ideal rhythm during the trip?",
        options: [
          "Slow mornings and relaxed days",
          "Early starts to avoid heat and crowds",
          "Active mornings, relaxed afternoons",
          "Mix of relaxed and active days",
          "I'm flexible"
        ]
      },
      {
        id: "q3",
        type: "scale",
        required: true,
        label: "How much do you enjoy changing places during a trip?",
        min: 1,
        max: 5,
        minLabel: "I strongly prefer staying longer in the same place",
        maxLabel: "I enjoy moving around and seeing many places"
      }
    ]
  },
  {
    id: "s2",
    title: "Sea & Relaxation",
    questions: [
      {
        id: "q4",
        type: "multi",
        required: true,
        label: "What kind of beach experience do you prefer?",
        options: [
          "Comfortable beaches with sunbeds",
          "Wild/natural beaches",
          "Small hidden coves",
          "Beach clubs",
          "Clear water and scenic views",
          "Easy access by car",
          "Less crowded places, even if less comfortable",
          "I'm flexible"
        ]
      },
      {
        id: "q5",
        type: "scale",
        required: true,
        label: "How much do crowded beaches bother you?",
        min: 1,
        max: 5,
        minLabel: "Not a problem",
        maxLabel: "I strongly want to avoid them"
      },
      {
        id: "q6",
        type: "single",
        required: true,
        label: "What would your ideal beach day look like?",
        options: [
          "Full day at the beach",
          "Beach in the morning, exploring in the afternoon",
          "Exploring in the morning, beach in the afternoon",
          "Short beach stop, then dinner/walk/exploration",
          "I don't want too many beach-focused days"
        ]
      }
    ]
  },
  {
    id: "s3",
    title: "Adventure & Nature",
    questions: [
      {
        id: "q7",
        type: "single",
        required: true,
        label: "What is the maximum hiking/trekking level you would genuinely enjoy?",
        options: [
          "Easy scenic walks, 1–2 hours",
          "Moderate hikes, 3–4 hours",
          "Longer hikes if the view is worth it",
          "I prefer minimal hiking",
          "I don't want hiking during this trip"
        ]
      },
      {
        id: "q8",
        type: "multi",
        required: true,
        label: "Which activities sound interesting to you?",
        options: [
          "Panoramic walks",
          "Boat trip",
          "Kayak",
          "Light rafting / river activity",
          "Thermal baths",
          "Canyon or river visit",
          "Mountain lake",
          "Castle / old towns",
          "Food or wine experience",
          "Scenic road trip",
          "Swimming in natural spots",
          "None of these / I prefer relaxing"
        ]
      },
      {
        id: "q9",
        type: "multi",
        required: true,
        label: "Is there anything you would prefer to avoid?",
        options: [
          "Long hikes",
          "Steep paths",
          "Difficult roads",
          "Very early wake-ups",
          "Boat trips",
          "Crowded tourist spots",
          "Too much driving",
          "Too many cultural visits",
          "Too many beach days",
          "Nothing specific"
        ]
      }
    ]
  },
  {
    id: "s4",
    title: "Heat, Comfort & Energy",
    questions: [
      {
        id: "q10",
        type: "single",
        required: true,
        label: "How well do you tolerate heat?",
        options: [
          "Low: above 30°C is difficult for me",
          "Medium: okay with shade, AC and sea",
          "High: not a big issue",
          "I'm not sure"
        ]
      },
      {
        id: "q11",
        type: "multi",
        required: true,
        label: "What should we avoid during the hottest hours?",
        options: [
          "Walking in towns",
          "Hiking",
          "Driving long distances",
          "Crowded beaches",
          "Being without air conditioning",
          "Nothing specific",
          "I'm flexible"
        ]
      },
      {
        id: "q12",
        type: "single",
        required: true,
        label: "Would you like to include a cooler mountain/nature area?",
        options: [
          "Yes, definitely",
          "Yes, if it fits naturally",
          "Maybe, but not at the cost of too much driving",
          "No, I prefer sea/towns",
          "I'm flexible"
        ]
      }
    ]
  },
  {
    id: "s5",
    title: "Driving & Logistics",
    questions: [
      {
        id: "q13",
        type: "single",
        required: true,
        label: "What is your maximum comfortable driving time in one day?",
        options: [
          "2 hours",
          "3 hours",
          "4 hours",
          "5 hours if needed",
          "I don't mind long drives"
        ]
      },
      {
        id: "q14",
        type: "single",
        required: true,
        label: "How often are you happy to change accommodation?",
        options: [
          "Every night is fine",
          "Prefer 2 nights minimum",
          "Prefer 3 nights when possible",
          "I strongly dislike moving often",
          "I'm flexible"
        ]
      },
      {
        id: "q15",
        type: "single",
        required: true,
        label: "How do you feel about mountain or coastal roads that may be slow, narrow, or winding?",
        options: [
          "Fine, part of the experience",
          "Okay occasionally",
          "I prefer to avoid them where possible",
          "I strongly dislike them",
          "I don't know"
        ]
      }
    ]
  },
  {
    id: "s6",
    title: "Montenegro",
    questions: [
      {
        id: "q16",
        type: "single",
        required: true,
        label: "How important is Montenegro for you?",
        options: [
          "Must-have",
          "Nice if it fits naturally",
          "Sacrificable if Albania becomes better",
          "I don't have a strong opinion"
        ]
      },
      {
        id: "q17",
        type: "multi",
        required: true,
        label: "What interests you most in Montenegro?",
        options: [
          "Kotor Bay",
          "Budva / coast",
          "Durmitor mountains",
          "Black Lake / mountain scenery",
          "Tara Canyon",
          "Lake Skadar",
          "Scenic drives",
          "Food and old towns",
          "I don't know yet",
          "Montenegro is not a priority for me"
        ]
      }
    ]
  },
  {
    id: "s7",
    title: "Food & Accommodation",
    questions: [
      {
        id: "q18",
        type: "multi",
        required: true,
        label: "What kind of food experiences matter most to you?",
        options: [
          "Traditional local food",
          "Seafood",
          "Agriturismo / guesthouse meals",
          "Wine / wineries",
          "Simple authentic restaurants",
          "Nice restaurants with atmosphere",
          "Street food / casual food",
          "Food is not a major priority"
        ]
      },
      {
        id: "q19",
        type: "multi",
        required: true,
        label: "Preferred accommodation style",
        options: [
          "Apartment with 2 bedrooms",
          "Boutique guesthouse",
          "Hotel with breakfast",
          "Seaside accommodation",
          "Mountain/nature guesthouse",
          "Place with pool",
          "Walkable location",
          "Quiet place outside the busy centre",
          "Mix"
        ]
      },
      {
        id: "q20",
        type: "multi",
        required: true,
        label: "Most important accommodation features",
        options: [
          "Air conditioning",
          "Parking",
          "Good location",
          "Sea view",
          "Pool",
          "Breakfast",
          "Kitchen",
          "Washing machine",
          "Comfortable beds",
          "Quiet rooms",
          "Good value for money"
        ]
      }
    ]
  },
  {
    id: "s8",
    title: "Deal-breakers & Personal Priorities",
    questions: [
      {
        id: "q21",
        type: "multi",
        required: true,
        label: "What would most ruin the trip for you?",
        options: [
          "Too much heat",
          "Too much driving",
          "Changing accommodation too often",
          "Crowded beaches",
          "Tourist traps",
          "Bad accommodation",
          "Too much hiking",
          "Poor food",
          "Stressful logistics",
          "Not enough relaxation",
          "Not enough adventure",
          "Spending too much money"
        ]
      },
      {
        id: "q22",
        type: "paragraph",
        required: false,
        label: "What would make this trip memorable for you?",
        prompt:
          "Write freely: places, feelings, experiences, rhythm, food, nature, sea, anything that would make this trip special for you."
      },
      {
        id: "q23",
        type: "paragraph",
        required: false,
        label: "Is there anything important we should know before planning the itinerary?",
        prompt:
          "Examples: health/fitness limits, strong preferences, budget concerns, food preferences, fear of heights, dislike of long drives, need for comfort, etc."
      }
    ]
  }
];

// Flat lookup: questionId -> question (with its section title attached).
export const QUESTION_BY_ID = {};
for (const section of SECTIONS) {
  for (const q of section.questions) {
    QUESTION_BY_ID[q.id] = { ...q, sectionTitle: section.title };
  }
}

export const ALL_QUESTIONS = Object.values(QUESTION_BY_ID);
