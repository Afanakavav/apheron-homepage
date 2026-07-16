/* Apheron — L'Edizione · logica di redazione
   Edizione del giorno, tema carta/inchiostro, lingua EN/IT.
   Nessuna dipendenza, nessun tracciamento. */

(function () {
  var root = document.documentElement;
  var adesso = new Date();
  var ora = adesso.getHours();

  /* ---- fascia oraria ---- */
  var fasciaKey, oraKey, temaAuto;
  if (ora >= 5 && ora < 11)       { fasciaKey = 'fascia.morning';   oraKey = 'alba';   temaAuto = 'light'; }
  else if (ora >= 11 && ora < 17) { fasciaKey = 'fascia.afternoon'; oraKey = 'giorno'; temaAuto = 'light'; }
  else if (ora >= 17 && ora < 23) { fasciaKey = 'fascia.evening';   oraKey = 'sera';   temaAuto = 'dark';  }
  else                            { fasciaKey = 'fascia.night';     oraKey = 'notte';  temaAuto = 'dark';  }

  root.setAttribute('data-ora', oraKey);

  /* ---- tema: scelta salvata > fascia oraria ---- */
  var temaSalvato = null;
  try { temaSalvato = localStorage.getItem('apheron-theme'); } catch (e) {}
  root.setAttribute('data-theme', temaSalvato === 'light' || temaSalvato === 'dark' ? temaSalvato : temaAuto);

  /* ---- lingua: scelta salvata > EN ---- */
  var lang = 'en';
  try { lang = localStorage.getItem('apheron-lang') === 'it' ? 'it' : 'en'; } catch (e) {}

  /* ---- numero progressivo: giorni dal 1º gennaio 2026 ---- */
  var epoca = new Date(2026, 0, 1);
  var numero = Math.floor((adesso - epoca) / 86400000) + 1;

  function dict() { return TRANSLATIONS[lang] || TRANSLATIONS.en; }

  function componiGronda() {
    document.getElementById('fascia').textContent = dict()[fasciaKey];
    document.getElementById('numero').textContent = 'Nº ' + numero;
    document.getElementById('data').textContent = adesso.toLocaleDateString(
      lang === 'it' ? 'it-IT' : 'en-GB',
      { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    );
  }

  function aggiornaTema() {
    var scuro = root.getAttribute('data-theme') === 'dark';
    var btn = document.getElementById('tema');
    btn.textContent = scuro ? dict()['tema.paper'] : dict()['tema.ink'];
  }

  function aggiornaLingua() {
    applyTranslations(lang);
    componiGronda();
    aggiornaTema();
    document.querySelectorAll('button.lingua').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    aggiornaLingua();

    document.getElementById('tema').addEventListener('click', function () {
      var nuovo = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', nuovo);
      try { localStorage.setItem('apheron-theme', nuovo); } catch (e) {}
      aggiornaTema();
    });

    document.querySelectorAll('button.lingua').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.lang === lang) return;
        lang = b.dataset.lang;
        try { localStorage.setItem('apheron-lang', lang); } catch (e) {}
        aggiornaLingua();
      });
    });
  });

  /* ---- bonifica: rimuove ogni vecchio service worker della PWA dismessa ---- */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(function (rs) { rs.forEach(function (r) { r.unregister(); }); })
      .catch(function () {});
  }
})();
