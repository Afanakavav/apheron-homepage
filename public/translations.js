/* Apheron — L'Edizione · dizionario EN/IT
   Meccanismo: ogni elemento con data-i18n="chiave" riceve il testo della lingua attiva.
   Lingua di default: EN. Persistenza: localStorage 'apheron-lang'. */

const TRANSLATIONS = {
  en: {
    'fascia.morning': 'Morning edition',
    'fascia.afternoon': 'Afternoon edition',
    'fascia.evening': 'Evening edition',
    'fascia.night': 'Night edition',
    'tema.ink': '☾ Ink',
    'tema.paper': '☀ Paper',

    'h1.a': 'An index of the things I’ve built, ',
    'h1.b': 'for myself and for others.',
    'bio': ' — websites made by hand, for myself and for the people I care about. This is the ever-current table of contents of everything that lives on apheron.io.',

    'sec1': 'In my own name',
    'sec1.count': '3 chapters',
    'sec2': 'Commissioned',
    'sec2.count': '4 chapters',
    'sec3': 'Archive',
    'sec3.count': '1 chapter',

    'e1.title': 'Albania & Montenegro',
    'e1.live': 'In progress',
    'e1.meta': 'Journey · August 2026',
    'e1.desc': 'The road-trip diary: day-by-day itinerary, map, shared expenses, and photos as they arrive.',

    'e2.title': 'Home Assistant',
    'e2.meta': 'Couple’s app · Login · 2025',
    'e2.desc': 'Our little household app: shared expenses, lists and reminders. Reserved for two very select users.',

    'e3.title': 'Italian Lessons in Dublin',
    'e3.meta': 'Teaching · 2025',
    'e3.tag': 'Archive',
    'e3.desc': 'From when I taught Italian to the Irish: the project’s site, preserved as it was.',

    'e4.title': 'Chiara Caruso, nanny',
    'e4.meta': 'Prato · 2025',
    'e4.desc': 'A calling-card site for a professional nanny: services, references, contacts.',

    'e5.title': 'Studio Legale Taiti',
    'e5.meta': 'Law firm · Prato · 2025',
    'e5.desc': 'An online presence for a law firm: practice areas and a contact form.',

    'e6.title': 'L.A. Mason Group',
    'e6.meta': 'Florence · 2024',
    'e6.desc': 'A showcase for a construction company: completed works and contacts.',

    'e7.title': 'Studio Biancalani',
    'e7.meta': 'studiobiancalani.it',
    'e7.desc': 'The firm’s site, grown big enough to have a home of its own: it now lives on its own domain.',

    'e8.title': 'Gift my English',
    'e8.meta': 'Reserved edition',
    'e8.desc': 'This chapter exists, but it is out of catalogue: its pages are private and only the editor may read them.',

    'ghost.title': 'Forthcoming ····',
    'ghost.meta': 'Chapter № 9 will appear here',

    'colophon.now.label': 'Now — July 2026:',
    'colophon.now': ' living between Dublin and Prato, getting ready for the road trip across Albania.',
    'colophon.made': 'This site is hand-written HTML and CSS. No frameworks, no tracking, no cookies. Type: Fraunces, Manrope, IBM Plex Mono. Hosted on Firebase.',
    'colophon.tagline': 'Apheron — a personal periodical'
  },

  it: {
    'fascia.morning': 'Edizione del mattino',
    'fascia.afternoon': 'Edizione del pomeriggio',
    'fascia.evening': 'Edizione della sera',
    'fascia.night': 'Edizione della notte',
    'tema.ink': '☾ Inchiostro',
    'tema.paper': '☀ Carta',

    'h1.a': 'Indice delle cose che ho costruito, ',
    'h1.b': 'per me e per gli altri.',
    'bio': ' — siti fatti a mano, per me e per le persone a cui voglio bene. Questo è il sommario, sempre aggiornato, di tutto quello che vive su apheron.io.',

    'sec1': 'In proprio',
    'sec1.count': '3 capitoli',
    'sec2': 'Su commissione',
    'sec2.count': '4 capitoli',
    'sec3': 'Archivio',
    'sec3.count': '1 capitolo',

    'e1.title': 'Albania & Montenegro',
    'e1.live': 'In corso',
    'e1.meta': 'Viaggio · Agosto 2026',
    'e1.desc': 'Il diario del viaggio on the road: itinerario giorno per giorno, mappa, spese condivise e le foto man mano che arrivano.',

    'e2.title': 'Home Assistant',
    'e2.meta': 'App di coppia · Login · 2025',
    'e2.desc': 'La piccola app di casa: spese, liste e promemoria condivisi. Riservata a due utenti molto selezionati.',

    'e3.title': 'Lezioni d’italiano a Dublino',
    'e3.meta': 'Insegnamento · 2025',
    'e3.tag': 'Archivio',
    'e3.desc': 'Di quando insegnavo italiano agli irlandesi: il sito del progetto, conservato com’era.',

    'e4.title': 'Chiara Caruso, tata',
    'e4.meta': 'Prato · 2025',
    'e4.desc': 'Sito-biglietto da visita per una tata professionista: servizi, referenze, contatti.',

    'e5.title': 'Studio Legale Taiti',
    'e5.meta': 'Studio legale · Prato · 2025',
    'e5.desc': 'Presenza online per uno studio legale: aree di attività e modulo di contatto.',

    'e6.title': 'L.A. Mason Group',
    'e6.meta': 'Firenze · 2024',
    'e6.desc': 'Vetrina per un’impresa edile: lavori realizzati e contatti.',

    'e7.title': 'Studio Biancalani',
    'e7.meta': 'studiobiancalani.it',
    'e7.desc': 'Il sito dello studio, cresciuto fino ad avere casa propria: ora vive sul suo dominio.',

    'e8.title': 'Gift my English',
    'e8.meta': 'Edizione riservata',
    'e8.desc': 'Questo capitolo esiste ma è fuori catalogo: le sue pagine sono private e solo il direttore può leggerle.',

    'ghost.title': 'Di prossima pubblicazione ····',
    'ghost.meta': 'Il capitolo n. 9 si aggiunge qui',

    'colophon.now.label': 'Ora — luglio 2026:',
    'colophon.now': ' vivo tra Dublino e Prato, preparo il viaggio on the road in Albania.',
    'colophon.made': 'Questo sito è HTML e CSS scritti a mano. Nessun framework, nessun tracciamento, nessun cookie. Caratteri: Fraunces, Manrope, IBM Plex Mono. Ospitato su Firebase.',
    'colophon.tagline': 'Apheron — periodico personale'
  }
};

function applyTranslations(lang) {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const t = dict[el.dataset.i18n];
    if (t !== undefined) el.textContent = t;
  });
}
