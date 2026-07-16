// Data for professionals - Ordine: Paolo, Andrea, Francesco, Massimo, Alberto, Roberto
const professionisti = [
    {
        surname: "BIANCALANI",
        givenName: "Paolo",
        name: "PAOLO BIANCALANI",
        role: "Dottore Commercialista, Revisore Legale dei Conti",
        roleLine1: "Dottore Commercialista",
        roleLine2: "Revisore legale dei conti",
        bio: "Nato a Prato nel 1958, si è laureato all'Università degli Studi di Firenze nel 1982. Iscritto dal 1983 all'Albo e dal 1985 al Registro dei Revisori.\nFondatore dello Studio. Esperto in consulenza aziendale, diritto commerciale e tributario.",
        image: "images/professionisti/paolo-biancalani.jpeg",
        email: "pbiancalani@studiobiancalani.it",
        pec: "paolo.biancalani@odcecprato.legalmail.it"
    },
    {
        surname: "BIANCALANI",
        givenName: "Andrea",
        name: "ANDREA BIANCALANI",
        role: "Dottore Commercialista, Revisore Legale dei Conti",
        roleLine1: "Dottore Commercialista",
        roleLine2: "Revisore legale dei conti",
        bio: "Nato a Firenze nel 1980, si è laureato con lode presso la Facoltà di Economia dell'Università degli Studi di Firenze nel 2002. Iscritto all'Ordine e al Registro dei Revisori dal 2007. Specializzato in consulenza fiscale, bilanci e contabilità. Esperto in operazioni straordinarie.",
        image: "images/professionisti/andrea-biancalani.jpg",
        email: "andrea@studiobiancalani.it",
        pec: "andrea.biancalani@odcecprato.legalmail.it"
    },
    {
        surname: "BIANCALANI",
        givenName: "Francesco",
        name: "FRANCESCO BIANCALANI",
        role: "Dottore Commercialista, Revisore Legale dei Conti",
        roleLine1: "Dottore Commercialista",
        roleLine2: "Revisore legale dei conti",
        bio: "Nato a Firenze nel 1988, si laurea in Economia presso l'Università di Firenze nel 2010. Master in Amministrazione e Controllo l'anno successivo. Iscritto all'Ordine e al Registro dei Revisori dal 2013. Specializzato in procedure concorsuali e risanamenti aziendali.",
        image: "images/professionisti/francesco-biancalani.jpg",
        email: "francesco@studiobiancalani.it",
        pec: "francesco.biancalani@odcecprato.legalmail.it"
    },
    {
        surname: "CONTE",
        givenName: "Massimo",
        name: "MASSIMO CONTE",
        role: "Dottore Commercialista, Revisore Legale dei Conti",
        roleLine1: "Dottore Commercialista",
        roleLine2: "Revisore legale dei conti",
        bio: "Nato a Prato nel 1976, si laurea in Economia presso l'Università di Firenze nel 2005.\nIscritto all'Ordine ed al Registro dei Revisori Legali dal 2010.",
        image: "images/professionisti/massimo-conte.png",
        email: "mconte@studiobiancalani.it",
        pec: "massimoconte@odcecprato.legalmail.it"
    },
    {
        surname: "LAMANNA",
        givenName: "Alberto",
        name: "ALBERTO LAMANNA",
        role: "Dottore Commercialista, Revisore Legale dei Conti",
        roleLine1: "Dottore Commercialista",
        roleLine2: "Revisore legale dei conti",
        bio: "Nato nel 1987, si laurea all'Università di Firenze in Scienze Economiche Aziendali nel 2012.\nIscritto all'Ordine ed al Registro dei Revisori Legali dal 2015.",
        image: "images/professionisti/alberto-lamanna.png",
        email: "alberto@studiobiancalani.it",
        pec: "alberto.lamanna@odcecprato.legalmail.it"
    },
    {
        surname: "TOSA",
        givenName: "Roberto",
        name: "ROBERTO TOSA",
        role: "Dottore Commercialista, Revisore Legale dei Conti",
        roleLine1: "Dottore Commercialista",
        roleLine2: "Revisore legale dei conti",
        bio: "Nato a Prato nel 1986, si laurea in Economia con lode nel 2008. Master in Scienze Economiche nel 2010.\nIscritto all'Ordine ed al Registro dei Revisori Legali dal 2014.",
        image: "images/professionisti/roberto-tosa.jpg",
        email: "roberto.tosa@studiobiancalani.it",
        pec: "roberto.tosa@pec.commercialisti.it"
    }
];

// Data for services
const servizi = [
    {
        title: "Area Fiscale",
        titleLine1: "Area",
        titleLine2: "Fiscale",
        icon: "fas fa-calculator",
        description: "Consulenza e assistenza per la gestione fiscale, amministrazione finanziaria, fiscalità diretta e indiretta (nazionale e internazionale), dichiarazioni fiscali, pianificazione fiscale e contenzioso tributario."
    },
    {
        title: "Area Societaria e Contrattuale",
        icon: "fas fa-handshake",
        description: "Consulenza e assistenza in diritto societario (costituzione, modifica, scioglimento di società, rapporti tra soci e organi sociali) e assistenza nella formazione ed esecuzione di contratti."
    },
    {
        title: "Area Bilancio e Contabilità",
        icon: "fas fa-chart-line",
        description: "Consulenza e assistenza per la redazione di bilanci individuali e consolidati secondo Codice Civile, principi contabili nazionali/internazionali e norme fiscali. Redazione di Business Plan."
    },
    {
        title: "Area Consulenza Aziendale",
        icon: "fas fa-briefcase",
        description: "Consulenza e assistenza in organizzazione, amministrazione, pianificazione, controllo di gestione per imprese/enti. Assistenza in finanza aziendale, valutazione di complessi aziendali, partecipazioni, cespiti ed eventi economici specifici."
    },
    {
        title: "Area Procedure Concorsuali e Risanamenti Aziendali",
        icon: "fas fa-building",
        description: "Consulenza e assistenza nella fase pre-concorsuale per imprese in crisi, redazione di piani di risanamento e assistenza nelle istanze per procedure di composizione preventiva. In fase concorsuale, assunzione di ruoli come liquidatore e commissario giudiziale."
    },
    {
        title: "Area Operazioni Straordinarie",
        icon: "fas fa-exchange-alt",
        description: "Consulenza e assistenza per acquisizioni/cessioni d'impresa, fusioni, scissioni, conferimenti/trasferimenti di aziende, trasformazioni societarie, creazione di joint-venture e assistenza nei passaggi generazionali aziendali."
    }
];

// ACB Group gallery images
// Le foto non sono mai state caricate in images/acb/ (davano solo 404 in console,
// nascosti dall'onerror). Per riattivare la galleria: aggiungere i file jpg in
// images/acb/ e ripristinare le voci qui sotto.
const acbGallery = [
    // { image: "images/acb/convention-verona-2016.jpg", caption: "Convention Verona ACB Group 2016" },
    // { image: "images/acb/incontro-genova-2015.jpg", caption: "Incontro Genova ACB Group 2015" },
    // { image: "images/acb/convention-torino-2014.jpg", caption: "Convention Torino ACB Group 2014" },
    // { image: "images/acb/convention-milano-2013.jpg", caption: "Convention Milano ACB Group 2013" },
    // { image: "images/acb/convention-venezia-2012.jpg", caption: "Convention Venezia ACB Group 2012" },
    // { image: "images/acb/convention-monaco-2010.jpg", caption: "Convention Monaco ACB Group 2010" }
];

// Institutional links
const institutionalLinks = [
    { name: "Tribunale di Prato", url: "https://www.tribunale.prato.it/" },
    { name: "Palazzo delle Professioni Prato", url: "https://www.palazzodelleprofessioniprato.it" },
    { name: "Camera di Commercio Prato", url: "https://www.ptpo.camcom.it/" },
    { name: "Agenzia Entrate", url: "https://www.agenziaentrate.gov.it" },
    { name: "INPS", url: "https://www.inps.it" },
    { name: "MEF - Ministero dell'Economia e delle Finanze", url: "https://www.mef.gov.it" },
    { name: "Borsa Italiana", url: "https://www.borsaitaliana.it" },
    { name: "CNDCEC", url: "https://commercialisti.it/" },
    { name: "Ordine Dottori Commercialisti Prato", url: "https://www.odcecprato.it" }
];
