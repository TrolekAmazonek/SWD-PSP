// =========================================================================
// PLIK 1: data.js - PEŁNA BAZA DANYCH (6 POWIATÓW, WSZYSTKIE OSP, POGODA, SGR)
// =========================================================================

const APP_VERSION = "SWDST 0.41,5";

// Całkowita blokada głosowego czytania komunikatów radiowych (TTS)
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak = function() {};
    } catch (e) {}
}

const audioSelekt = new Audio('selekt.wav');
const audioCpr = new Audio('nowe zdarzenie odbierz.mp3');
const audioMotorola = new Audio('motorola.ogg');

function playSound(type) {
    if (type === 'cpr') { audioCpr.currentTime = 0; audioCpr.play().catch(() => {}); }
    else if (type === 'motorola') { audioMotorola.currentTime = 0; audioMotorola.play().catch(() => {}); }
}

function playOspAlarmRepeated(ospCount) {
    if (ospCount <= 0) return;
    let played = 0;
    function playNext() {
        if (played < ospCount) {
            audioSelekt.currentTime = 0;
            audioSelekt.play().then(() => {
                played++;
                if (played < ospCount) setTimeout(playNext, 3000);
            }).catch(() => {});
        }
    }
    playNext();
}

let currentWeatherData = {
    condition: "NORMAL",
    label: "☀️ Słonecznie / Stabilnie",
    multiplier: 1.0,
    cprFreqMultiplier: 1.0
};

const weatherScenarios = [
    { condition: "NORMAL", label: "☀️ Słonecznie / Stabilnie", mult: 1.0, freq: 1.0, alert: null },
    { condition: "DROUGHT", label: "🔥 Susza (3. st. zagrożenia pożarowego)", mult: 1.3, freq: 1.2, alert: "Komunikat KW PSP: W związku z długotrwałą suszą obowiązuje 3. stopień zagrożenia pożarowego!" },
    { condition: "STORM", label: "⛈️ Ulewy i gwałtowne burze", mult: 1.5, freq: 1.8, alert: "Komunikat KW PSP: Front burzowy z ulewnymi opadami deszczu!" },
    { condition: "WIND", label: "💨 Silny wiatr", mult: 1.5, freq: 1.8, alert: "Komunikat KW PSP: Front silnego wiatru w powiecie!" }
];

function triggerWeatherChange() {
    const nextW = weatherScenarios[Math.floor(Math.random() * weatherScenarios.length)];
    currentWeatherData.condition = nextW.condition;
    currentWeatherData.label = nextW.label;
    currentWeatherData.multiplier = nextW.mult;
    currentWeatherData.cprFreqMultiplier = nextW.freq;

    const badge = document.getElementById('weather-status-badge');
    if (badge) badge.innerText = nextW.label;

    if (nextW.alert && typeof logToMainRadio === 'function') {
        logToMainRadio("STANOWISKO KIEROWANIA KW PSP", nextW.alert, "#ff00ff", false);
    }
}

const EXTERNAL_SPECIAL_GROUPS = {
    pomorskie: [
        {
            groupName: "SGRChem Gdynia (JRG 1 Gdynia Śródmieście)",
            unitName: "JRG 1 Gdynia (SGRChem)",
            town: "Gdynia", address: "ul. Władysława IV 12/14, Gdynia", lat: 54.5221, lng: 18.5364,
            vehicles: [
                { id: "431[G]60", name: "SRChem Iveco Eurocargo (Ciężki Chemiczny)", status: "green", obsada: 3 },
                { id: "431[G]61", name: "SLRRChem Mercedes Sprinter (Rozpoznanie Chemiczne)", status: "green", obsada: 2 },
                { id: "431[G]64", name: "SLRR Ford Ranger (Rozpoznawczo-Ratowniczy)", status: "green", obsada: 2 },
                { id: "431[G]90", name: "SLRR Ford Ranger (Dowodzenie/Sztab)", status: "green", obsada: 2 }
            ]
        },
        {
            groupName: "SGRT Tczew (JRG Tczew)",
            unitName: "JRG Tczew (SGRT)",
            town: "Tczew", address: "ul. Lecha 11, Tczew", lat: 54.0912, lng: 18.7831,
            vehicles: [
                { id: "401[G]43", name: "SCRt Volvo (Ciężki Ratownictwa Technicznego)", status: "green", obsada: 3 },
                { id: "401[G]49", name: "SCRt MEGA-CITY Volvo (Ciężki Techniczny)", status: "green", obsada: 3 },
                { id: "401[G]71", name: "SCDz 70 Liebherr (Ciężki Dźwig Samochodowy)", status: "green", obsada: 2 },
                { id: "401[G]90", name: "SLOp Nissan Qashqai (Operacyjny Dowódcy)", status: "green", obsada: 2 }
            ]
        },
        {
            groupName: "SGRWys Rumia (JRG 2 Rumia)",
            unitName: "JRG 2 Rumia (SGRWys)",
            town: "Rumia", address: "ul. Świętego Floriana 1, Rumia", lat: 54.5798, lng: 18.3973,
            vehicles: [
                { id: "552[G]72", name: "SRWys Mercedes Atego/Bocar (Ratownictwo Wysokościowe)", status: "green", obsada: 3 },
                { id: "552[G]51", name: "SD-32 Mercedes Atego/Rosenbauer (Drabina)", status: "green", obsada: 2 }
            ]
        },
        {
            groupName: "SGRWN Gdańsk (JRG 2 Gdańsk Śródmieście)",
            unitName: "JRG 2 Gdańsk (SGRWN)",
            town: "Gdańsk", address: "ul. Siennicka 29, Gdańsk", lat: 54.3522, lng: 18.6752,
            vehicles: [
                { id: "302[G]71", name: "SRw Mercedes Atego 4x4 (Wodno-Nurkowy)", status: "green", obsada: 4 },
                { id: "302[G]Ł1", name: "Łódź pontonowa z silnikiem śrubowym", status: "green", obsada: 0 }
            ]
        },
        {
            groupName: "SGRWN Kościerzyna (JRG Kościerzyna)",
            unitName: "JRG Kościerzyna (SGRWN)",
            town: "Kościerzyna", address: "ul. Traugutta 6, Kościerzyna", lat: 54.1215, lng: 17.9812,
            vehicles: [
                { id: "441[G]81", name: "SRW Iveco (Specjalistyczny Wodno-Nurkowy)", status: "green", obsada: 3 },
                { id: "441[G]90", name: "SLKw Nissan Navara (Lekki Kwatermistrzowski)", status: "green", obsada: 2 },
                { id: "441[G]Ł1", name: "Łódź 6-osobowa z silnikiem zaburtowym", status: "green", obsada: 0 },
                { id: "441[G]Ł2", name: "Łódź 5-osobowa z silnikiem zaburtowym", status: "green", obsada: 0 }
            ]
        }
    ],
    slaskie: [
        {
            groupName: "SGRChem-Eko Katowice",
            unitName: "JRG 2 Katowice",
            town: "Gliwice", address: "ul. Tadeusza Kościuszki 189, 40-689 Katowice", lat: 50.3340, lng: 18.6180,
            vehicles: [
                { id: "302[S]25", name: "GCBA 5/38 Scania P410 XT/WISS", status: "green", obsada: 3 },
                { id: "302[S]60", name: "SCRChem Volvo FH 500/Bocar", status: "green", obsada: 2 },
                { id: "302[S]61", name: "SRChem Scania P370/PS Szczęśniak", status: "green", obsada: 2 },
                { id: "302[S]90", name: "SLRr Ford Ranger/Frank Cars", status: "green", obsada: 2 },
                { id: "302[S]96", name: "SLRChem Mercedes Benz X250d/Zeszuta", status: "green", obsada: 2 }
            ]
        },
        {
            groupName: "SGRT Bielsko-Biała",
            unitName: "JRG 1 Bielsko-Biała",
            town: "Bielsko-Biała", address: "ul. Leszczyńska 43, 43-300 Bielsko-Biała", lat: 49.80349716573004, lng: 19.05207219452952,
            vehicles: [
                { id: "331[S]43", name: "SCRt Scania P450/PS Szczęśniak", status: "green", obsada: 3 },
                { id: "331[S]49", name: "SCRd Volvo FL10/EuroKran", status: "green", obsada: 2 },
                { id: "331[S]90", name: "SLRr Ford Ranger/Frank Car", status: "green", obsada: 2 }
            ]
        },
        {
            groupName: "SGRWys Jastrzębie-Zdrój (JRG Jastrzębie-Zdrój)",
            unitName: "JRG Jastrzębie-Zdrój (SGRWys)",
            town: "Jastrzębie-Zdrój", address: "ul. Jagiełły 3, Jastrzębie-Zdrój", lat: 49.9500, lng: 18.5750,
            vehicles: [
                { id: "471[S]91", name: "SLRr Toyota Hilux/Szybicki", status: "green", obsada: 3 }
            ]
        },
        {
            groupName: "SGRWN Bytom (JRG Bytom)",
            unitName: "JRG Bytom (SGRWN)",
            town: "Bytom", address: "ul. Strażacka 3, Bytom", lat: 50.3480, lng: 18.9150,
            vehicles: [
                { id: "411[S]71", name: "SRw Scania P320/WISS", status: "green", obsada: 4 },
                { id: "411[S]90", name: "SLRr Ford Ranger", status: "green", obsada: 2 },
                { id: "411[S]Ł1", name: "Łódź ratownicza z silnikiem zaburtowym", status: "green", obsada: 0 }
            ]
        },
        {
            groupName: "Proszkowy Jastrzębie-Zdrój",
            unitName: "JRG Jastrzębie-Zdrój",
            town: "Jastrzębie-Zdrój", address: "ul. Jagiełły 3, Jastrzębie-Zdrój", lat: 49.9500, lng: 18.5750,
            vehicles: [
                { id: "471[S]23", name: "GBAPr 2/30+750 Renault Midlum/WISS", status: "green", obsada: 3 }
            ]
        },
        {
            groupName: "Kontener ODO Knurów",
            unitName: "JRG Knurów",
            town: "Knurów", address: "ul. 1 maja 1, Knurów", lat: 49.9500, lng: 18.5750,
            vehicles: [
                { id: "453[S]87", name: "SCKn Iveco Trakker 410/Zamet", status: "green", obsada: 3 },
                { id: "453-K6", name: "Kontener z AODO", status: "green", obsada: 0 }
            ]
        }
    ]
};

function getCurrentRegionSgrGroups() {
    const regionKey = (currentCountyId === 'raciborski') ? 'slaskie' : 'pomorskie';
    return EXTERNAL_SPECIAL_GROUPS[regionKey] || EXTERNAL_SPECIAL_GROUPS.pomorskie;
}

function unpackProfile(raw) {
    const locationsDatabase = {}, gpsCoords = {}, realStreetsByTown = {}, unitExactLocations = {};
    raw.towns.forEach(([tName, regionDesc, lat, lng, streets]) => {
        locationsDatabase[tName] = `${regionDesc}, ${raw.countyName}, woj. ${raw.voivodeship}`;
        gpsCoords[tName] = [lat, lng];
        realStreetsByTown[tName] = (Array.isArray(streets) && streets.length > 0) ? streets : [tName];
    });
    const mapUnitList = (list) => list.map(([uName, town, addr, lat, lng, locked, vehs]) => {
        unitExactLocations[uName] = { town, address: addr, lat, lng, locked: !!locked };
        return {
            name: uName,
            vehicles: vehs.map(([id, name, obsada]) => ({ id, name, status: "green", obsada: obsada ?? 6 }))
        };
    });
    return {
        id: raw.id, name: raw.name, radioCallsign: raw.radioCallsign, desc: raw.desc,
        voivodeship: raw.voivodeship, countyName: raw.countyName, mapCenter: raw.mapCenter,
        bbox: raw.bbox, jrgList: raw.jrgList, defaultTown: raw.defaultTown,
        locationsDatabase, gpsCoords, realStreetsByTown, unitExactLocations,
        unitsPSP: mapUnitList(raw.psp), unitsOSP: mapUnitList(raw.osp)
    };
}

const RAW_PROFILES = [
    {
        id: "wejherowski", name: "KP PSP Wejherowo (Powiat Wejherowski)", radioCallsign: "Wejherowo 998",
        desc: "Woj. pomorskie • JRG 1 Wejherowo, JRG 2 Rumia + 36 jednostek OSP",
        voivodeship: "pomorskie", countyName: "pow. wejherowski", mapCenter: [54.6052, 18.2345], bbox: "17.65,54.38,18.50,54.85",
        jrgList: ["JRG 1 Wejherowo", "JRG 2 Rumia"], defaultTown: "Bolszewo",
        towns: [
            ["Wejherowo", "m. Wejherowo", 54.6052, 18.2345, ["ul. Jana III Sobieskiego", "ul. 12 Marca", "ul. Gdańska", "ul. Tartaczna", "ul. 3 Maja", "ul. Przemysłowa", "ul. Kalwaryjska", "ul. Sikorskiego", "ul. Chopina"]],
            ["Bolszewo", "gm. Wejherowo", 54.6155, 18.1772, ["ul. Zamostna", "ul. Strażacka", "ul. Główna", "ul. Wejherowska", "ul. Szkolna", "ul. Długa", "ul. Leśna", "ul. Polna"]],
            ["Rumia", "m. Rumia", 54.5798, 18.3973, ["ul. Grunwaldzka", "ul. Dąbrowskiego", "ul. Starowiejska", "ul. Świętego Floriana", "ul. Kosynierów", "ul. Pomorska", "ul. Gdańska"]],
            ["Reda", "m. Reda", 54.6053, 18.3478, ["ul. Wejherowska", "ul. Gdańska", "ul. Pucka", "ul. Gniewowska", "ul. Obwodowa", "ul. Łąkowa", "ul. Cechowa"]],
            ["Gościcino", "gm. Wejherowo", 54.5975, 18.1458, ["ul. Drzewiarza", "ul. Wejherowska", "ul. Lęborska", "ul. Słoneczna", "ul. Fabryczna"]],
            ["Gniewowo", "gm. Wejherowo", 54.5655, 18.2995, ["ul. Jakuba Wejhera", "ul. Słoneczna", "ul. Leśna", "ul. Długa"]],
            ["Gowino", "gm. Wejherowo", 54.5682, 18.2025, ["ul. Wejherowska", "ul. Szkolna", "ul. Długa", "ul. Kwiatowa"]],
            ["Góra", "gm. Wejherowo", 54.6368, 18.1492, ["ul. Wiejska", "ul. Długa", "ul. Szkolna", "ul. Polna"]],
            ["Kniewo", "gm. Wejherowo", 54.6548, 18.1408, ["al. Lipowa", "ul. Strażacka", "ul. Długa"]],
            ["Nowy Dwór Wejherowski", "gm. Wejherowo", 54.5365, 18.2575, ["ul. Wejherowska", "ul. Kwiatowa", "ul. Leśna"]],
            ["Orle", "gm. Wejherowo", 54.6295, 18.1765, ["ul. Strażacka", "ul. Zamostna", "ul. Główna"]],
            ["Zbychowo", "gm. Wejherowo", 54.5528, 18.3275, ["ul. Kamienna", "ul. Białogórska", "ul. Jeziorna"]],
            ["Luzino", "gm. Luzino", 54.5608, 18.1038, ["ul. Ofiar Stutthofu", "ul. Kościelna", "ul. Młyńska", "ul. Wilczka", "ul. Szkolna"]],
            ["Zelewo", "gm. Luzino", 54.6146, 18.0825, ["ul. Długa", "ul. Słoneczna", "ul. Leśna"]],
            ["Milwino", "gm. Luzino", 54.5185, 18.1345, ["ul. Strażacka", "ul. Długa", "ul. Leśna"]],
            ["Szemud", "gm. Szemud", 54.4862, 18.2278, ["ul. Wejherowska", "ul. Samorządowa", "ul. Kartuska", "ul. Szkolna"]],
            ["Kielno", "gm. Szemud", 54.4552, 18.3475, ["ul. Oliwska", "ul. Szkolna", "ul. Jeziorna"]],
            ["Bojano", "gm. Szemud", 54.4776, 18.3842, ["ul. Józefa Wybickiego", "ul. Majora H. Sucharskiego", "ul. Kartuska"]],
            ["Częstkowo", "gm. Szemud", 54.5045, 18.1745, ["ul. Strażacka", "ul. Długa"]],
            ["Łebno", "gm. Szemud", 54.4555, 18.1365, ["ul. Kartuska", "ul. Szkolna"]],
            ["Przetoczyno", "gm. Szemud", 54.5345, 18.2045, ["ul. Pomorska", "ul. Strażacka"]],
            ["Gniewino", "gm. Gniewino", 54.7161, 18.0156, ["ul. Strażacka", "ul. Szkolna", "ul. Pomorska"]],
            ["Nadole", "gm. Gniewino", 54.7495, 18.0365, ["ul. Strażacka", "ul. Bałtycka"]],
            ["Kostkowo", "gm. Gniewino", 54.6755, 18.0385, ["ul. Wejherowska", "ul. Ks. Stanisława Galasa"]],
            ["Rybno", "gm. Gniewino", 54.6775, 18.1055, ["ul. Dębowa", "ul. Długa"]],
            ["Opalino", "gm. Gniewino", 54.7185, 18.0615, ["Opalino", "ul. Długa"]],
            ["Choczewo", "gm. Choczewo", 54.7422, 17.8915, ["ul. Pierwszych Osadników", "ul. Świerkowa", "ul. Pucka"]],
            ["Słajszewo", "gm. Choczewo", 54.7695, 17.8048, ["ul. Bursztynowa", "ul. Morska"]],
            ["Sasino", "gm. Choczewo", 54.7628, 17.7562, ["ul. Brukowa", "ul. Strażacka"]],
            ["Kopalino", "gm. Choczewo", 54.7895, 17.8485, ["ul. Bursztynowa", "ul. Strażacka"]],
            ["Linia", "gm. Linia", 54.4503, 17.9355, ["ul. Turystyczna", "ul. Długa", "ul. Kaszubska"]],
            ["Strzepcz", "gm. Linia", 54.4590, 18.0398, ["ul. Ks. Józefa Rotty", "ul. Długa"]],
            ["Lewino", "gm. Linia", 54.4815, 17.9945, ["ul. Długa", "ul. Leśna"]],
            ["Łęczyce", "gm. Łęczyce", 54.5992, 17.8685, ["ul. Długa", "ul. Sportowa", "ul. Kościelna"]],
            ["Bożepole Wielkie", "gm. Łęczyce", 54.5745, 17.9682, ["ul. Chmieleniecka", "ul. Strażacka"]],
            ["Rozłazino", "gm. Łęczyce", 54.5445, 17.8615, ["ul. Długa", "ul. Kościelna"]],
            ["Kaczkowo", "gm. Łęczyce", 54.6215, 17.8925, ["Kaczkowo"]]
        ],
        psp: [
            ["JRG 1 Wejherowo", "Wejherowo", "ul. Tartaczna 5, 84-200 Wejherowo", 54.6075, 18.2195, true, [
                ["551[G]21", "GBA 2,5/16 Volvo FL280/Bocar", 6], ["551[G]25", "GCBA 5,4/25 Man TGM 18.320/Bocar", 4],
                ["551[G]26", "GCBA 9,5/60 Man TGS 26.440/Stolarczyk", 3], ["551[G]53", "SH-40 Volvo FM12/Bumar", 2],
                ["551[G]90", "SLRr Ford Ranger", 2], ["551[G]P05", "Przyczepa EKO", 0], ["551[G]Ł01", "Przyczepa z pontonem", 0], ["551[G]Ł02", "Przyczepa z łodzią hybrydową", 0]
            ]],
            ["JRG 2 Rumia", "Rumia", "ul. Świętego Floriana 1, 84-230 Rumia", 54.5798, 18.3973, true, [
                ["552[G]21", "GBAPr 2,5/28/250 MB Atego/Bocar", 4], ["552[G]25", "GCBA 5/32 Scania P410/WISS", 4],
                ["552[G]51", "SD-32 Mercedes Atego/Rosenbauer", 2], ["552[G]72", "SRWys Mercedes Atego/Bocar", 3],
                ["552[G]90", "SLRr Isuzu D-Max", 2], ["552[G]Q01", "Quad CF Moto", 1]
            ]],
            ["KP PSP Wejherowo", "Wejherowo", "ul. Tartaczna 5, 84-200 Wejherowo", 54.6077, 18.2199, true, [
                ["550[G]81", "SLKw VW T6", 2], ["550[G]90", "SLOp Skoda Octavia", 1], ["550[G]92", "SLOp Skoda Yeti", 1]
            ]]
        ],
        osp: [
            [".OSP KSRG Bolszewo", "Bolszewo", "ul. Zamostna 4A, 84-239 Bolszewo", 54.6156, 18.1772, true, [["559[G]56", "GBA 2,5/16 Star 12.185/Stolarczyk", 6], ["559[G]57", "SLRr Toyota Hilux", 3], ["559[G]58", "GCBA 5/32 MB Atego/Mototruck", 4], ["559[G]59", "SLKw Ford Transit/Stolarczyk", 2], ["559[G]Q01", "Quad CF MOTO 500-2A", 1]]],
            [".OSP KSRG Gościcino", "Gościcino", "ul. Drzewiarza 22, 84-241 Gościcino", 54.5975, 18.1458, false, [["559[G]63", "GBA 2,5/16 Volvo/Bocar", 6]]],
            [".OSP KSRG Wejherowo", "Wejherowo", "ul. 3 Maja 2, 84-200 Wejherowo", 54.6014, 18.2333, true, [["559[G]66", "GBA Scania", 6], ["559[G]67", "SLRr Nissan Navara", 3], ["559[G]68", "GBA 2,5/24 Renault Midlum/WISS", 6], ["559[G]69", "SLKw Mitsubishi Canter/Szczęśniak", 3]]],
            [".OSP KSRG Reda", "Reda", "ul. Pucka 1, 84-240 Reda", 54.6053, 18.3478, false, [["559[G]41", "GBA 2,5/16 MB Atego/Mototruck", 6], ["559[G]42", "GBA 2,5/16 Star 12.185/Stolarczyk", 6], ["559[G]43", "GCBA Scania", 6]]],
            [".OSP KSRG Luzino", "Luzino", "ul. Ofiar Stutthofu 39, 84-242 Luzino", 54.5608, 18.1038, false, [["559[G]26", "GBA 3,5/25 Man TGM/Mototruck", 6], ["559[G]27", "GCBA 5/32 Man TGM/Mototruck", 6], ["559[G]28", "SLRt Ford Transit/Stolarczyk", 3], ["559[G]29", "SLOp Toyota Avensis", 2]]],
            [".OSP KSRG Zelewo", "Zelewo", "ul. Długa 31, 84-252 Zelewo", 54.6146, 18.0825, false, [["559[G]87", "GBA Man TGM/Mototruck", 6]]],
            [".OSP KSRG Szemud", "Szemud", "ul. Samorządowa 3, 84-217 Szemud", 54.4862, 18.2278, false, [["559[G]51", "GBA 2,5/25 Man 13.290/Stolarczyk", 6], ["559[G]52", "GBA 2,5/16 Man TGL/Stolarczyk", 6], ["559[G]53", "GCBA 5/32 Scania P400/WISS", 6]]],
            [".OSP KSRG Kielno", "Kielno", "ul. Oliwska 85, 84-208 Kielno", 54.4552, 18.3475, false, [["559[G]46", "GCBA 5/42 MB Axor/Mototruck", 6], ["559[G]47", "GCBA 8,3/60 MAN KAT.1 Buffalo", 3], ["559[G]48", "GBA 3/24 Man TGM/Mototruck", 6]]],
            [".OSP KSRG Bojano", "Bojano", "ul. Józefa Wybickiego 16, 84-207 Bojano", 54.4776, 18.3842, false, [["559[G]76", "GCBA 5/32 Man TGM/Stolarczyk", 6], ["559[G]77", "GBA Man TGM/Stolarczyk", 6], ["559[G]78", "SLRr Nissan Navara", 3]]],
            [".OSP KSRG Choczewo", "Choczewo", "ul. Świerkowa 8, 84-210 Choczewo", 54.7422, 17.8915, false, [["559[G]01", "GCBA 5/32 Man TGM/Mototruck", 6], ["559[G]02", "GBA 2,5/16 Star 244/JZS", 6], ["559[G]03", "SLRt Ford Transit/Bocar", 3]]],
            [".OSP KSRG Słajszewo", "Słajszewo", "ul. Bursztynowa 67, 84-210 Słajszewo", 54.7695, 17.8048, false, [["559[G]81", "GBA 4,5/30 Man TGM/Moto-Truck", 6]]],
            [".OSP KSRG Sasino", "Sasino", "ul. Brukowa 3, 84-210 Sasino", 54.7628, 17.7562, false, [["559[G]91", "GBA Volvo FL280/Bocar", 6], ["559[G]92", "SLRr Ford Ranger", 3]]],
            [".OSP KSRG Gniewino", "Gniewino", "ul. Strażacka 2, 84-250 Gniewino", 54.7161, 18.0156, false, [["559[G]06", "GBA 2,5/25 Man TGM/Stolarczyk", 6], ["559[G]07", "SLKw Ford Transit/Stolarczyk", 3]]],
            [".OSP KSRG Nadole", "Nadole", "ul. Strażacka 20, 84-250 Nadole", 54.7495, 18.0365, false, [["559[G]11", "GCBA 5/32 Volvo FMX/Bocar", 6], ["559[G]12", "SLRt Renault Master", 3]]],
            [".OSP KSRG Kostkowo", "Kostkowo", "ul. Wejherowska 24A, 84-251 Kostkowo", 54.6755, 18.0385, false, [["559[G]71", "GBA 2/24 Renault Midlum/WISS", 6], ["559[G]72", "GCBA 7/42 Scania P450/Szczęśniak", 6]]],
            [".OSP KSRG Linia", "Linia", "ul. Turystyczna 3, 84-223 Linia", 54.4503, 17.9355, false, [["559[G]16", "GBA 2,5/16 Volvo FL280/Bocar", 6], ["559[G]17", "GCBA 5/35 Man TGM/Stolarczyk", 6], ["559[G]18", "SLRt Lublin III", 3]]],
            [".OSP KSRG Strzepcz", "Strzepcz", "ul. Ks. Józefa Rotty 15, 84-223 Strzepcz", 54.4590, 18.0398, false, [["559[G]21", "GBA 2,5/16 MB Atego/Mototruck", 6], ["559[G]22", "SLRt Ford Transit", 3]]],
            [".OSP KSRG Bożepole Wielkie", "Bożepole Wielkie", "ul. Chmieleniecka 40, 84-214 Bożepole Wielkie", 54.5745, 17.9682, false, [["559[G]31", "GBA 2,5/16 MB Atego/Mototruck", 6], ["559[G]32", "SLRt Iveco Daily", 3]]],
            [".OSP KSRG Łęczyce", "Łęczyce", "ul. Sportowa 5, 84-218 Łęczyce", 54.5992, 17.8685, false, [["559[G]36", "GCBA 5/32 Man TGM/Mototruck", 6], ["559[G]37", "GBA Man TGM", 6]]],
            [".OSP KSRG Rozłazino", "Rozłazino", "ul. Długa 26, 84-218 Rozłazino", 54.5445, 17.8615, false, [["559[G]96", "GBA Volvo FL280/Bocar", 6]]],
            ["OSP Gowino", "Gowino", "ul. Wejherowska 58, 84-215 Gowino", 54.5682, 18.2025, false, [["557[G]66", "GBA 4,5/32 Scania P370/Szczęśniak", 6], ["557[G]67", "GLBA Iveco Daily/Bocar", 6]]],
            ["OSP Orle", "Orle", "ul. Strażacka 2, 84-252 Orle", 54.6295, 18.1765, false, [["557[G]76", "GCBA 5/37 MB Atego/Szczęśniak", 6], ["557[G]77", "SLRr Mitsubishi L200", 3]]],
            ["OSP Kniewo", "Kniewo", "al. Lipowa 14, 84-252 Kniewo", 54.6548, 18.1408, false, [["557[G]71", "GBA Mercedes Benz 1124/Ziegler", 6]]],
            ["OSP Zbychowo", "Zbychowo", "ul. Kamienna 2, 84-206 Zbychowo", 54.5528, 18.3275, false, [["557[G]81", "GBA 2,5/16 MB Atego/Mototruck", 6]]],
            ["OSP Gniewowo", "Gniewowo", "ul. Jakuba Wejhera 16, 84-240 Gniewowo", 54.5655, 18.2995, false, [["557[G]86", "GBA 2/20 Renault Midliner", 6], ["557[G]87", "GBM 2,5/8 Star 244", 6]]],
            ["OSP Góra", "Góra", "ul. Wiejska 14, 84-252 Góra", 54.6368, 18.1492, false, [["557[G]91", "GBA Iveco Eurocargo/Sides", 6]]],
            ["OSP Nowy Dwór Wejherowski", "Nowy Dwór Wejherowski", "ul. Kwiatowa 16, 84-206 Nowy Dwór Wejherowski", 54.5365, 18.2575, false, [["558[G]01", "GLM 8 Volkswagen T4", 6], ["558[G]02", "GLBA Iveco Daily", 6]]],
            ["OSP Rybno", "Rybno", "ul. Dębowa 7, 84-251 Rybno", 54.6775, 18.1055, false, [["557[G]11", "GBA 2,5/16 Mercedes Atego", 6]]],
            ["OSP Opalino", "Opalino", "Opalino 4, 84-250 Gniewino", 54.7185, 18.0615, false, [["557[G]96", "GCBA 5/24 Jelcz 422", 4]]],
            ["OSP Kopalino", "Kopalino", "ul. Bursztynowa 24, 84-210 Kopalino", 54.7895, 17.8485, false, [["557[G]01", "GLM 8 Ford Transit", 6]]],
            ["OSP Lewino", "Lewino", "ul. Długa 28, 84-223 Lewino", 54.4815, 17.9945, false, [["557[G]21", "GBA 2,5/16 Mercedes 1619", 6]]],
            ["OSP Milwino", "Milwino", "ul. Strażacka 5, 84-242 Milwino", 54.5185, 18.1345, false, [["557[G]26", "GBA 2,5/16 Renault Midlum", 6]]],
            ["OSP Kaczkowo", "Kaczkowo", "Kaczkowo 18B, 84-218 Kaczkowo", 54.6215, 17.8925, false, [["557[G]36", "GBA Renault Range D", 6]]],
            ["OSP Częstkowo", "Częstkowo", "ul. Strażacka 1, 84-217 Częstkowo", 54.5045, 18.1745, false, [["557[G]51", "GCBA Scania", 6]]],
            ["OSP Łebno", "Łebno", "ul. Kartuska 10, 84-217 Łebno", 54.4555, 18.1365, false, [["557[G]56", "GBA 2,5/16 Mercedes Atego", 6]]],
            ["OSP Przetoczyno", "Przetoczyno", "ul. Pomorska 21, 84-217 Przetoczyno", 54.5345, 18.2045, false, [["557[G]61", "GBA 2,5/16 Magirus", 6]]]
        ]
    },
    {
        id: "pucki", name: "KP PSP Puck (Powiat Pucki)", radioCallsign: "Puck 998",
        desc: "Woj. pomorskie • JRG Puck + 14 jednostek OSP",
        voivodeship: "pomorskie", countyName: "pow. pucki", mapCenter: [54.7180, 18.4080], bbox: "18.00,54.55,18.85,54.85",
        jrgList: ["JRG Puck"], defaultTown: "Puck",
        towns: [
            ["Puck", "m. Puck", 54.7178, 18.4083, ["ul. Żarnowiecka", "ul. 1 Maja", "ul. Wejherowska", "ul. Kopernika", "ul. Morska"]],
            ["Władysławowo", "gm. Władysławowo", 54.7909, 18.4036, ["ul. Gdańska", "ul. Starowiejska", "ul. Hallera", "ul. Morska"]],
            ["Jastarnia", "gm. Jastarnia", 54.6983, 18.6766, ["ul. Ks. P. Stefańskiego", "ul. Adama Mickiewicza", "ul. Bałtycka"]],
            ["Hel", "m. Hel", 54.6081, 18.8013, ["ul. Kuracyjna", "ul. Wiejska", "ul. Adm. Steyera", "ul. Leśna"]],
            ["Kosakowo", "gm. Kosakowo", 54.6186, 18.4682, ["ul. Chrzanowskiego", "ul. Żeromskiego", "ul. Derdowskiego"]],
            ["Krokowa", "gm. Krokowa", 54.7738, 18.1619, ["ul. Żarnowiecka", "ul. Wejherowska", "ul. Zamkowa"]],
            ["Żelistrzewo", "gm. Puck", 54.6761, 18.4239, ["ul. Lipowa", "ul. Pucka", "ul. Rzemieślnicza"]],
            ["Chłapowo", "gm. Władysławowo", 54.8031, 18.3742, ["ul. Władysławowska", "ul. Żeromskiego"]],
            ["Karwia", "gm. Władysławowo", 54.8286, 18.2119, ["ul. Wojska Polskiego", "ul. Kopernika"]],
            ["Jastrzębia Góra", "gm. Władysławowo", 54.8305, 18.3095, ["ul. Rozewska", "ul. Królewska"]],
            ["Leśniewo", "gm. Puck", 54.6789, 18.2683, ["ul. Krótka", "ul. Wejherowska"]],
            ["Starzyno", "gm. Puck", 54.7561, 18.3164, ["ul. Długa", "ul. Szkolna"]],
            ["Strzelno", "gm. Puck", 54.7825, 18.3711, ["ul. Świerkowa", "ul. Pucka"]],
            ["Wierzchucino", "gm. Krokowa", 54.7919, 18.0189, ["ul. Abrahama", "ul. Szkolna"]],
            ["Gnieżdżewo", "gm. Puck", 54.7564, 18.3992, ["ul. Klonowa", "ul. Gdańska"]],
            ["Smolno", "gm. Puck", 54.6881, 18.3842, ["ul. Główna", "ul. Szkolna"]]
        ],
        psp: [
            ["JRG Puck", "Puck", "ul. Żarnowiecka 7, 84-100 Puck", 54.7185, 18.3976, true, [
                ["501[G]21", "GBA 2,5/24 MAN TGM 13.290/Stolarczyk", 6], ["501[G]25", "GCBA 5/32 Scania P410/Szczęśniak", 4],
                ["501[G]43", "SRt Scania P370/Szczęśniak", 3], ["501[G]53", "SHD-23 MAN TGL 12.250/Bumar", 2], ["501[G]90", "SLRr Ford Ranger", 2]
            ]],
            ["KP PSP Puck", "Puck", "ul. Żarnowiecka 7, 84-100 Puck", 54.7187, 18.3980, true, [
                ["500[G]90", "SLOp Skoda Octavia", 1], ["500[G]81", "SLKw Renault Trafic", 2]
            ]]
        ],
        osp: [
            [".OSP KSRG Władysławowo", "Władysławowo", "ul. Gdańska 59, 84-120 Władysławowo", 54.7865, 18.4042, true, [["509[G]64", "GBA 2,5/16 Volvo FL/Bocar", 6], ["509[G]65", "GCBA 5/32 MAN TGM", 6], ["509[G]66", "SLRr Ford Ranger", 3]]],
            [".OSP KSRG Jastarnia", "Jastarnia", "ul. Ks. P. Stefańskiego 5, 84-140 Jastarnia", 54.6983, 18.6766, true, [["509[G]31", "GBA 3/28 Mercedes Atego/Bocar", 6], ["509[G]32", "GCBA 4/32 Mercedes", 6]]],
            [".OSP KSRG Hel", "Hel", "ul. Kuracyjna 3, 84-150 Hel", 54.6081, 18.8013, true, [["509[G]21", "GBA 2,5/16 MAN TGM", 6], ["509[G]22", "SLRr Nissan Navara", 3]]],
            [".OSP KSRG Kosakowo", "Kosakowo", "ul. Chrzanowskiego 44, 81-198 Kosakowo", 54.6186, 18.4682, true, [["509[G]41", "GBA 2,5/25 MAN TGM/Stolarczyk", 6], ["509[G]42", "GCBA 5/32 Scania", 6]]],
            [".OSP KSRG Krokowa", "Krokowa", "ul. Żarnowiecka 29, 84-110 Krokowa", 54.7738, 18.1619, true, [["509[G]51", "GBA 3/25 MAN TGM/Mototruck", 6], ["509[G]52", "GCBA 5/32 Jelcz", 4]]],
            [".OSP KSRG Żelistrzewo", "Żelistrzewo", "ul. Lipowa 17, 84-100 Żelistrzewo", 54.6761, 18.4239, false, [["509[G]01", "GBA 2,5/16 Mercedes Atego", 6], ["509[G]02", "GCBA 5/32 MAN", 6]]],
            [".OSP KSRG Chłapowo", "Chłapowo", "ul. Władysławowska 87, 84-120 Chłapowo", 54.8031, 18.3742, false, [["509[G]61", "GBA 2,5/16 MAN TGM", 6]]],
            [".OSP KSRG Karwia", "Karwia", "ul. Wojska Polskiego 71, 84-105 Karwia", 54.8286, 18.2119, false, [["509[G]67", "GBA 2,5/24 Mercedes Atego", 6]]],
            [".OSP KSRG Leśniewo", "Leśniewo", "ul. Krótka 2, 84-106 Leśniewo", 54.6789, 18.2683, false, [["509[G]04", "GBA 3/16 Volvo FL", 6]]],
            [".OSP KSRG Starzyno", "Starzyno", "ul. Długa 21, 84-107 Starzyno", 54.7561, 18.3164, false, [["509[G]07", "GBA 2,5/16 Star 14.225", 6]]],
            [".OSP KSRG Strzelno", "Strzelno", "ul. Świerkowa 2, 84-103 Strzelno", 54.7825, 18.3711, false, [["509[G]11", "GBA 2,5/16 Mercedes", 6]]],
            [".OSP KSRG Wierzchucino", "Wierzchucino", "ul. Abrahama 11, 84-113 Wierzchucino", 54.7919, 18.0189, false, [["509[G]56", "GBA 2,5/16 MAN", 6]]],
            ["OSP Gnieżdżewo", "Gnieżdżewo", "ul. Klonowa 2, 84-100 Gnieżdżewo", 54.7564, 18.3992, false, [["507[G]01", "GBA 2,5/16 Star", 6]]],
            ["OSP Smolno", "Smolno", "ul. Główna 32, 84-100 Smolno", 54.6881, 18.3842, false, [["507[G]05", "GBA 2,5/16 Volvo", 6]]]
        ]
    },
    {
        id: "leborski", name: "KP PSP Lębork (Powiat Lęborski)", radioCallsign: "Lębork 998",
        desc: "Woj. pomorskie • JRG Lębork + 11 jednostek OSP",
        voivodeship: "pomorskie", countyName: "pow. lęborski", mapCenter: [54.5442, 17.7525], bbox: "17.40,54.35,17.95,54.80",
        jrgList: ["JRG Lębork"], defaultTown: "Lębork",
        towns: [
            ["Lębork", "m. Lębork", 54.5442, 17.7525, ["ul. Ogniowa", "ul. Aleja Wolności", "ul. Abrahama", "ul. Staromiejska", "ul. Słupska", "ul. Gdańska", "ul. Wojska Polskiego", "ul. Krzywoustego"]],
            ["Łeba", "m. Łeba", 54.7608, 17.5561, ["ul. Kościuszki", "ul. 11 Listopada", "ul. Nadmorska", "ul. Turystyczna", "ul. Morska", "ul. Portowa"]],
            ["Nowa Wieś Lęborska", "gm. Nowa Wieś Lęborska", 54.5681, 17.7289, ["ul. Grunwaldzka", "ul. Lęborska", "ul. Młynarska", "ul. Łebska"]],
            ["Cewice", "gm. Cewice", 54.4325, 17.7419, ["ul. Witosa", "ul. Lęborska", "ul. Osiedle Na Wzgórzu", "ul. Długa"]],
            ["Wicko", "gm. Wicko", 54.6681, 17.6164, ["ul. Słupska", "ul. Łebska", "ul. Szkolna"]],
            ["Krępa Kaszubska", "gm. Nowa Wieś Lęborska", 54.6119, 17.7511, ["Krępa Kaszubska", "ul. Kolejowa"]],
            ["Maszewo Lęborskie", "gm. Cewice", 54.4619, 17.7214, ["ul. Szkolna", "ul. Długa"]],
            ["Bukowina", "gm. Cewice", 54.4019, 17.8314, ["Bukowina"]],
            ["Charbrowo", "gm. Wicko", 54.6914, 17.5819, ["ul. Długa", "ul. Łebska"]],
            ["Pogorszewo", "gm. Nowa Wieś Lęborska", 54.5819, 17.6811, ["Pogorszewo"]],
            ["Tawęcino", "gm. Nowa Wieś Lęborska", 54.6281, 17.8114, ["Tawęcino"]]
        ],
        psp: [
            ["JRG Lębork", "Lębork", "ul. Ogniowa 2, 84-300 Lębork", 54.5446, 17.7532, true, [
                ["451[G]21", "GBAPr 2,5/25 MAN TGM 13.290/Stolarczyk", 6], ["451[G]25", "GCBA 5/32 MAN TGM 18.340/Moto-Truck", 4],
                ["451[G]43", "SRt Scania P370/Szczęśniak", 3], ["451[G]53", "SHD-25 MAN TGL 12.250/Bumar", 2], ["451[G]90", "SLRr Ford Ranger", 2]
            ]],
            ["KP PSP Lębork", "Lębork", "ul. Ogniowa 2, 84-300 Lębork", 54.5448, 17.7535, true, [
                ["450[G]90", "SLOp Skoda Octavia", 1], ["450[G]81", "SLKw Ford Transit", 2]
            ]]
        ],
        osp: [
            [".OSP KSRG Łeba", "Łeba", "ul. Kościuszki 92, 84-360 Łeba", 54.7608, 17.5561, true, [["459[G]21", "GBA 3,5/27 Iveco Eurocargo", 6], ["459[G]22", "GCBA 5/32 MAN TGM", 6], ["459[G]23", "SLRr Mitsubishi L200", 3]]],
            [".OSP KSRG Nowa Wieś Lęborska", "Nowa Wieś Lęborska", "ul. Grunwaldzka 28, 84-351 Nowa Wieś Lęborska", 54.5681, 17.7289, true, [["459[G]01", "GBA 3/16 Volvo FL/Bocar", 6], ["459[G]02", "GCBA 5/32 Scania", 6]]],
            [".OSP KSRG Cewice", "Cewice", "ul. Witosa 29, 84-312 Cewice", 54.4325, 17.7419, true, [["459[G]31", "GBA 2,5/24 Renault Midlum/WISS", 6], ["459[G]32", "GCBA 5/32 MAN", 6]]],
            [".OSP KSRG Wicko", "Wicko", "Wicko 32, 84-352 Wicko", 54.6681, 17.6164, true, [["459[G]41", "GBA 3/28 Volvo FL/Bocar", 6]]],
            [".OSP KSRG Lębork", "Lębork", "ul. Staszica 8, 84-300 Lębork", 54.5412, 17.7495, true, [["459[G]51", "GBA 2,5/16 Mercedes Atego", 6]]],
            [".OSP KSRG Krępa Kaszubska", "Krępa Kaszubska", "Krępa Kaszubska 19, 84-351 Nowa Wieś Lęborska", 54.6119, 17.7511, false, [["459[G]06", "GBA 2,5/16 MAN TGM", 6]]],
            [".OSP KSRG Maszewo Lęborskie", "Maszewo Lęborskie", "Maszewo Lęborskie 12, 84-312 Cewice", 54.4619, 17.7214, false, [["459[G]35", "GBA 2,5/16 Star", 6]]],
            [".OSP KSRG Bukowina", "Bukowina", "Bukowina 40, 84-311 Bukowina", 54.4019, 17.8314, false, [["459[G]38", "GBA 2,5/16 Volvo", 6]]],
            [".OSP KSRG Charbrowo", "Charbrowo", "ul. Długa 10, 84-352 Charbrowo", 54.6914, 17.5819, false, [["459[G]44", "GBA 2,5/16 Mercedes", 6]]],
            ["OSP Pogorszewo", "Pogorszewo", "Pogorszewo 8, 84-351 Nowa Wieś Lęborska", 54.5819, 17.6811, false, [["457[G]04", "GLM Ford Transit", 6]]],
            ["OSP Tawęcino", "Tawęcino", "Tawęcino 15, 84-351 Nowa Wieś Lęborska", 54.6281, 17.8114, false, [["457[G]08", "GBA 2,5/16 Star 244", 6]]]
        ]
    },
    {
        id: "gdynia", name: "KM PSP Gdynia (Miasto Gdynia)", radioCallsign: "Gdynia 998",
        desc: "Woj. pomorskie • JRG 1 Śródmieście, JRG 2 Chylonia, JRG 3 Oksywie, JRG 4 Wielki Kack + OSP",
        voivodeship: "pomorskie", countyName: "m. Gdynia", mapCenter: [54.5189, 18.5305], bbox: "18.35,54.43,18.60,54.58",
        jrgList: ["JRG 1 Gdynia Śródmieście", "JRG 2 Gdynia Chylonia", "JRG 3 Gdynia Oksywie", "JRG 4 Gdynia Wielki Kack"], defaultTown: "Gdynia Śródmieście",
        towns: [
            ["Gdynia Śródmieście", "m. Gdynia", 54.5189, 18.5305, ["ul. Władysława IV", "ul. Świętojańska", "ul. 10 Lutego", "ul. Starowiejska", "ul. Śląska", "al. Jana Pawła II", "ul. Portowa"]],
            ["Gdynia Chylonia", "m. Gdynia", 54.5442, 18.4589, ["ul. Hutnicza", "ul. Morska", "ul. Chylońska", "ul. Kartuska", "ul. Pucka", "ul. Rozewska"]],
            ["Gdynia Oksywie", "m. Gdynia", 54.5481, 18.5392, ["ul. Bosmańska", "ul. Benisławskiego", "ul. Zielona", "ul. Dickmana", "ul. Śmidowicza"]],
            ["Gdynia Obłuże", "m. Gdynia", 54.5556, 18.5089, ["ul. Unruga", "ul. Kwiatkowskiego", "ul. Płk. Dąbka", "ul. Boisko"]],
            ["Gdynia Pogórze", "m. Gdynia", 54.5681, 18.4981, ["ul. Płk. Dąbka", "ul. Porębskiego", "ul. Paderewskiego"]],
            ["Gdynia Cisowa", "m. Gdynia", 54.5528, 18.4319, ["ul. Morska", "ul. Chylońska", "ul. Owsiana", "ul. Kcyńska"]],
            ["Gdynia Redłowo", "m. Gdynia", 54.4919, 18.5481, ["al. Zwycięstwa", "ul. Powstania Styczniowego", "ul. Legionów", "ul. Stryjska"]],
            ["Gdynia Orłowo", "m. Gdynia", 54.4792, 18.5542, ["al. Zwycięstwa", "ul. Orłowska", "ul. Wielkopolska", "ul. Wrocławska"]],
            ["Gdynia Wielki Kack", "m. Gdynia", 54.4698, 18.4945, ["ul. Wielkopolska", "ul. Nowodworcowa", "ul. Starodworcowa", "ul. Źródło Marii"]],
            ["Gdynia Karwiny", "m. Gdynia", 54.4775, 18.4819, ["ul. Wielkopolska", "ul. Sopocka", "ul. Tuwima", "ul. Brzechwy"]],
            ["Gdynia Dąbrowa", "m. Gdynia", 54.4719, 18.4525, ["ul. Rdestowa", "ul. Miętowa", "ul. Szafranowa", "ul. Nagietkowa"]],
            ["Gdynia Chwarzno-Wiczlino", "m. Gdynia", 54.4925, 18.4219, ["ul. Chwarznieńska", "ul. Wiczlińska", "ul. Filipkowskiego", "ul. Jowisza"]],
            ["Gdynia Witomino", "m. Gdynia", 54.4986, 18.5019, ["ul. Małokacka", "ul. Rolnicza", "ul. Chwarznieńska", "ul. Konwaliowa"]],
            ["Gdynia Grabówek", "m. Gdynia", 54.5289, 18.4911, ["ul. Morska", "ul. Kalksztajnów", "ul. Mireckiego"]]
        ],
        psp: [
            ["JRG 1 Gdynia Śródmieście", "Gdynia Śródmieście", "ul. Władysława IV 12/14, 81-353 Gdynia", 54.5221, 18.5364, true, [
                ["341[G]21", "GBAPr 2,5/30 MAN TGM 15.290/Stolarczyk", 6], ["341[G]25", "GCBA 5/32 MAN TGM 18.340/Stolarczyk", 4],
                ["341[G]43", "SRt Mercedes Atego/Bocar", 3], ["341[G]51", "SD-37 Iveco Magirus", 2], ["341[G]90", "SLRr Nissan Navara", 2]
            ]],
            ["JRG 2 Gdynia Chylonia", "Gdynia Chylonia", "ul. Hutnicza 15, 81-061 Gdynia", 54.5442, 18.4589, true, [
                ["342[G]21", "GBA 2,5/25 MAN TGM/Stolarczyk", 6], ["342[G]25", "GCBA 8/50 Renault K440/WISS", 4],
                ["342[G]60", "SRChem Iveco Eurocargo", 3], ["342[G]90", "SLRr Ford Ranger", 2]
            ]],
            ["JRG 3 Gdynia Oksywie", "Gdynia Oksywie", "ul. Bosmańska 103, 81-116 Gdynia", 54.5481, 18.5392, true, [
                ["343[G]21", "GBA 2,5/24 Renault D16/WISS", 6], ["343[G]25", "GCBA 5/32 Scania P410/Szczęśniak", 4], ["343[G]90", "SLRr Isuzu D-Max", 2]
            ]],
            ["JRG 4 Gdynia Wielki Kack", "Gdynia Wielki Kack", "ul. Wielkopolska 250, 81-531 Gdynia", 54.4698, 18.4945, true, [
                ["344[G]21", "GBA 2,5/25 MAN TGM/Bocar", 6], ["344[G]25", "GCBA 5/32 Scania P370/Szczęśniak", 4], ["344[G]90", "SLRr Toyota Hilux", 2]
            ]],
            ["KM PSP Gdynia", "Gdynia Śródmieście", "ul. Władysława IV 12/14, 81-353 Gdynia", 54.5224, 18.5368, true, [
                ["340[G]90", "SLOp Skoda Octavia", 1], ["340[G]81", "SLKw VW Crafter", 2]
            ]]
        ],
        osp: [
            [".OSP KSRG Gdynia-Wiczlino", "Gdynia Chwarzno-Wiczlino", "ul. Filipkowskiego 12, 81-578 Gdynia", 54.4925, 18.4219, true, [["349[G]01", "GBA 2,5/16 Star Man", 6], ["349[G]02", "SLRt Ford Transit", 3]]],
            ["OSP Gdynia-Karwiny", "Gdynia Karwiny", "ul. Wielkopolska 402, 81-531 Gdynia", 54.4775, 18.4819, true, [["347[G]01", "GLM 8 Renault Master", 6]]]
        ]
    },
    {
        id: "gdansk", name: "KM PSP Gdańsk (Miasto Gdańsk)", radioCallsign: "Gdańsk 998",
        desc: "Woj. pomorskie • JRG 1-6 + OSP",
        voivodeship: "pomorskie", countyName: "m. Gdańsk", mapCenter: [54.3520, 18.6466], bbox: "18.42,54.27,18.95,54.45",
        jrgList: ["JRG 1 Gdańsk Wrzeszcz", "JRG 2 Gdańsk Śródmieście", "JRG 3 Gdańsk Orunia", "JRG 4 Gdańsk Przymorze", "JRG 5 Gdańsk Kokoszki", "JRG 6 Gdańsk Przeróbka"], defaultTown: "Gdańsk Śródmieście",
        towns: [
            ["Gdańsk Śródmieście", "m. Gdańsk", 54.3485, 18.6532, ["ul. Długa", "ul. Podwale Przedmiejskie", "ul. Okopowa", "ul. Wały Jagiellońskie", "ul. Siennicka", "ul. Elbląska"]],
            ["Gdańsk Wrzeszcz", "m. Gdańsk", 54.3805, 18.6042, ["al. Grunwaldzka", "ul. Sosnowa", "ul. Słowackiego", "ul. Kościuszki", "ul. Hallera", "ul. Do Studzienki"]],
            ["Gdańsk Orunia", "m. Gdańsk", 54.3161, 18.6345, ["ul. Trakt Św. Wojciecha", "ul. Małomiejska", "ul. Gościnna", "ul. Starogardzka"]],
            ["Gdańsk Chełm", "m. Gdańsk", 54.3319, 18.6085, ["ul. Witosa", "ul. Sikorskiego", "ul. Cienista", "ul. Jabłońskiego", "al. Havla"]],
            ["Gdańsk Przymorze", "m. Gdańsk", 54.4065, 18.5895, ["ul. Beniowskiego", "ul. Kołobrzeska", "ul. Chłopska", "ul. Obrońców Wybrzeża", "al. Rzeczypospolitej"]],
            ["Gdańsk Oliwa", "m. Gdańsk", 54.4119, 18.5625, ["al. Grunwaldzka", "ul. Spacerowa", "ul. Polanki", "ul. Bażyńskiego"]],
            ["Gdańsk Osowa", "m. Gdańsk", 54.4265, 18.4785, ["ul. Kielnieńska", "ul. Wodnika", "ul. Jednorożca", "ul. Biwakowa"]],
            ["Gdańsk Kokoszki", "m. Gdańsk", 54.3545, 18.4912, ["ul. Kalinowa", "ul. Kartuska", "ul. Budowlanych", "ul. Nowatorów"]],
            ["Gdańsk Przeróbka", "m. Gdańsk", 54.3642, 18.6945, ["ul. Siennicka", "ul. Stryjewskiego", "ul. Pokoleń Lechii Gdańsk", "ul. Ku Ujściu"]],
            ["Gdańsk Sobieszewo", "m. Gdańsk", 54.3375, 18.8285, ["ul. Turystyczna", "ul. Nadwiślańska", "ul. Przegalińska", "ul. Boguckiego"]]
        ],
        psp: [
            ["JRG 1 Gdańsk Wrzeszcz", "Gdańsk Wrzeszcz", "ul. Sosnowa 2, 80-251 Gdańsk", 54.3768, 18.5985, true, [
                ["301[G]21", "GBA 2,5/24 Renault D16/WISS", 6], ["301[G]25", "GCBA 5/36 Scania P410/Szczęśniak", 4],
                ["301[G]43", "SRt Scania P370/Szczęśniak", 3], ["301[G]51", "SD-40 Iveco Magirus", 2], ["301[G]90", "SLRr Ford Ranger", 2]
            ]],
            ["JRG 2 Gdańsk Śródmieście", "Gdańsk Śródmieście", "ul. Siennicka 29, 80-758 Gdańsk", 54.3522, 18.6752, true, [
                ["302[G]21", "GBA 2,5/25 MAN TGM/Stolarczyk", 6], ["302[G]25", "GCBA 5/32 MAN TGM/Bocar", 4],
                ["302[G]71", "SRw Mercedes Atego", 3], ["302[G]90", "SLRr Isuzu D-Max", 2]
            ]],
            ["JRG 3 Gdańsk Orunia", "Gdańsk Orunia", "ul. Trakt Św. Wojciecha 253, 80-018 Gdańsk", 54.3161, 18.6345, true, [
                ["303[G]21", "GBA 2,5/16 Volvo FL280/Bocar", 6], ["303[G]25", "GCBA 5/32 Scania P370", 4], ["303[G]90", "SLRr Nissan Navara", 2]
            ]],
            ["JRG 4 Gdańsk Przymorze", "Gdańsk Przymorze", "ul. Beniowskiego 7, 80-382 Gdańsk", 54.4142, 18.5795, true, [
                ["304[G]21", "GBA 2,5/24 Renault D16/WISS", 6], ["304[G]25", "GCBA 5/32 MAN TGM", 4],
                ["304[G]51", "SD-37 Iveco Magirus", 2], ["304[G]90", "SLRr Toyota Hilux", 2]
            ]],
            ["JRG 5 Gdańsk Kokoszki", "Gdańsk Kokoszki", "ul. Kalinowa 4, 80-298 Gdańsk", 54.3545, 18.4912, true, [
                ["305[G]21", "GBA 2,5/25 MAN TGM", 6], ["305[G]25", "GCBA 8/50 Renault K440/WISS", 4], ["305[G]90", "SLRr Ford Ranger", 2]
            ]],
            ["JRG 6 Gdańsk Przeróbka", "Gdańsk Przeróbka", "ul. Pokoleń Lechii Gdańsk 1, 80-560 Gdańsk", 54.3895, 18.6412, true, [
                ["306[G]21", "GBA 2,5/24 MAN TGM", 6], ["306[G]25", "GCBA 5/32 Scania", 4], ["306[G]60", "SRChem Scania", 3], ["306[G]90", "SLRr Mitsubishi L200", 2]
            ]],
            ["KM PSP Gdańsk", "Gdańsk Wrzeszcz", "ul. Sosnowa 2, 80-251 Gdańsk", 54.3770, 18.5988, true, [
                ["300[G]90", "SLOp Skoda Octavia", 1], ["300[G]81", "SLKw Renault Master", 2]
            ]]
        ],
        osp: [
            [".OSP KSRG Gdańsk-Sobieszewo", "Gdańsk Sobieszewo", "ul. Turystyczna 28, 80-680 Gdańsk", 54.3375, 18.8285, true, [["309[G]31", "GBA 2,5/24 Mercedes Atego", 6], ["309[G]32", "GCBA 5/32 MAN TGM", 6]]],
            ["OSP Gdańsk-Świbno", "Gdańsk Sobieszewo", "ul. Boguckiego 98, 80-690 Gdańsk", 54.3312, 18.9285, true, [["309[G]41", "GBA 2,5/16 Star 12.185", 6]]],
            ["OSP Gdańsk-Osowa", "Gdańsk Osowa", "ul. Kielnieńska 126, 80-299 Gdańsk", 54.4265, 18.4785, true, [["307[G]21", "GLM 8 Ford Transit", 6]]]
        ]
    },
    {
        id: "raciborski",
        name: "KP PSP Racibórz (Powiat Raciborski)",
        radioCallsign: "Racibórz 998",
        desc: "Woj. śląskie • JRG Racibórz, KP PSP Racibórz + jednostki OSP KSRG i Gminne",
        voivodeship: "śląskie",
        countyName: "pow. raciborski",
        mapCenter: [50.0919, 18.2198],
        bbox: "17.95,49.90,18.55,50.25",
        jrgList: ["JRG Racibórz"],
        defaultTown: "Racibórz",
        towns: [
            ["Racibórz", "m. Racibórz", 50.0919, 18.2198, [
                "ul. 1 Maja", "ul. Adama Asnyka", "ul. Adama Mickiewicza", "ul. Agaty", "ul. Agnieszki", "ul. Akacjowa", "ul. Akademicka", "ul. Aleja Ojca Johannesa Leppicha", "ul. Aleksandra Fredry", "ul. Alojzego Nowary", "ul. Alojzego Segeta", "ul. Anny", "ul. Antoniego Kapuścika", "ul. Antoniego Pośpiecha", "ul. Arcybiskupa Józefa Gawliny", "ul. Arki Bożka", "ul. Armii Krajowej", "ul. Babicka", "ul. Bankowa", "ul. Barbary", "ul. Bartka Lasoty", "ul. Bartosza Głowackiego", "ul. Basztowa", "ul. Bielska", "ul. Bitwy Olzańskiej", "ul. Boczna", "ul. Bogumińska", "ul. Bojanowska", "ul. Bolesława Leśmiana", "ul. Bolesława Prusa", "ul. Bosacka", "ul. Browarna", "ul. Brzeska", "ul. Brzozowa", "ul. Bukowa", "ul. Bułgarska", "ul. Bydgoska", "ul. Cecylii", "ul. Cegielniana", "ul. Chłopska", "ul. Chorwacka", "ul. Chorzowska", "ul. Ciechowicka", "ul. Cieszyńska", "ul. Cmentarna", "ul. Cygarowa", "ul. Cypriana Kamila Norwida", "ul. Cyryla Ratajskiego", "ul. Czekoladowa", "ul. Czeska", "ul. Częstochowska", "ul. Czynu Społecznego", "ul. Dębiczna", "ul. Dębniki", "ul. Długa", "ul. Dobra", "ul. Doktora Józefa Rostka", "ul. Doktora Juliusza Rogera", "ul. Dolna", "ul. Drewniana", "ul. Dworcowy", "ul. Dworska", "ul. Działdowska", "ul. Elizy Orzeszkowej", "ul. Elżbiety", "ul. Emanuela Smołki", "ul. Emilii Plater", "ul. Fabryczna", "ul. Filmowa", "ul. Fiołkowa", "ul. Floriana", "ul. Folwarczna", "ul. Franciszka Goduli", "ul. Franciszka Grzonki", "ul. Franciszka Siwonia", "ul. Francuska", "ul. Fryderyka Chopina", "ul. Gajowa", "ul. Gamowska", "ul. Gdańska", "ul. Gdyńska", "ul. Generała Jarosława Dąbrowskiego", "ul. Generała Józefa Bema", "ul. Gimnazjalna", "ul. Gliniana", "ul. Gliwicka", "ul. Głubczycka", "ul. Gnieźnieńska", "ul. Gospodarcza", "ul. Górna", "ul. Górnośląska", "ul. Grabowa", "ul. Graniczna", "ul. Grecka", "ul. Grobla", "ul. Gruntowa", "ul. Grunwaldzka", "ul. Gustawa Morcinka", "ul. Gwiaździsta", "ul. Handlowa", "ul. Henryka Jordana", "ul. Henryka Sienkiewicza", "ul. Hetmana Jana Karola Chodkiewicza", "ul. Hetmana Jana Zamoyskiego", "ul. Hetmana Stanisława Żółkiewskiego", "ul. Hetmana Stefana Czarnieckiego", "ul. Hetmańska", "ul. Hugo Kołłątaja", "ul. Hulczyńska", "ul. Huzarska", "ul. Ignacego Fojcika", "ul. im. Miasta Roth", "ul. Jabłoniowa", "ul. Jagielnia", "ul. Jagodowa", "ul. Jakuba Mandrysza", "ul. Jana", "ul. Jana Badury", "ul. Jana Karola Maćkowskiego", "ul. Jana Kasprowicza", "ul. Jana Kilińskiego", "ul. Jana Kochanowskiego", "ul. Jana Matejki", "ul. Jana Pawła II", "ul. Jana Wyglendy", "ul. Janusza Korczaka", "ul. Jasna", "ul. Jaśminowa", "ul. Jeziorowa", "ul. Josepha von Eichendorffa", "ul. Józefa Chełmońskiego", "ul. Józefa Chudoby", "ul. Józefa Lompy", "ul. Józefa Rymera", "ul. Juliana Ordona", "ul. Juliana Tuwima", "ul. Juliusza Kossaka", "ul. Juliusza Ligonia", "ul. Juliusza Słowackiego", "ul. Kamienna", "ul. Kanałowa", "ul. Kapitana Serafina Myśliwca", "ul. Kardynała Stefana Wyszyńskiego", "ul. Karola", "ul. Karola Miarki", "ul. Karola Szymanowskiego", "ul. Karola Tomali", "ul. Kaspra Adamczyka", "ul. Kasztanowa", "ul. Katarzyny", "ul. Katowicka", "ul. Kazimierza Malczewskiego", "ul. Kazimierza Wierzyńskiego", "ul. Klasztorna", "ul. Klonowa", "ul. Kobylska", "ul. Kolejowa", "ul. Kolonialna", "ul. Kombatantów", "ul. Komunalna", "ul. Konstantego Ildefonsa Gałczyńskiego", "ul. Kornela Makuszyńskiego", "ul. Kosmonautów", "ul. Kosynierów", "ul. Koszalińska", "ul. Kościelna", "ul. Kowalska", "ul. Kozielska", "ul. Kresowian", "ul. Kręta", "ul. Króla Bolesława Chrobrego", "ul. Króla Jana III Sobieskiego", "ul. Króla Kazimierza Wielkiego", "ul. Króla Stefana Batorego", "ul. Króla Władysława Łokietka", "ul. Królewska", "ul. Królowej Jadwigi", "ul. Krótka", "ul. Książęca", "ul. Księcia Henryka Pobożnego", "ul. Księcia Leszka Raciborskego", "ul. Księcia Przemysława", "ul. Księżycowa", "ul. Kwiatowa", "ul. Lecznicza", "ul. Lekarska", "ul. Leona Czogały", "ul. Leopolda Staffa", "ul. Leśna", "ul. Letnia", "ul. Lipowa", "ul. Litewska", "ul. Lotnicza", "ul. Ludwika", "ul. Ludwika Waryńskiego", "ul. Lunonautów", "ul. Lwowska", "ul. Łąkowa", "ul. Łużycka", "ul. Malinowa", "ul. Mała", "ul. Marcina Kopca", "ul. Mariańska", "ul. Marii Konopnickiej", "ul. Marii Rodziewiczówny", "ul. Marii Skłodowskiej-Curie", "ul. Markowicka", "ul. Markowickie Tarasy", "ul. Marty", "ul. Michała Drzymały", "ul. Miechowska", "ul. Mieszka I Raciborskiego", "ul. Mikołaja", "ul. Mikołaja Kopernika", "ul. Mikołowska", "ul. Miodowa", "ul. Młyńska", "ul. Morawska", "ul. Mostowy", "ul. Mysłowicka", "ul. Myśliwska", "ul. Na Wzgórzu", "ul. Nad Koleją", "ul. Nad Potokiem", "ul. Nieboczowska", "ul. Norberta Bończyka", "ul. Nowa", "ul. Nowomiejska", "ul. Nowy Zamek", "ul. Ocicka", "ul. Odpoczynkowa", "ul. Odrodzenia", "ul. Odrzańska", "ul. Ogrodowa", "ul. Olchowa", "ul. Olimpijczyka", "ul. Olimpijczyków i Sław Sportu Ziemi Raciborskiej", "ul. Oliwkowa", "ul. Olszynkowa", "ul. Opawska", "ul. Opolska", "ul. Osiedleńcza", "ul. Ostrógska", "ul. Owocowa", "ul. Park im. kpt. Franciszka Stala, Kawalera Orderu Virtuti Militar", "ul. Parkowa", "ul. Pastora Franciszka Michejdy", "ul. Pawła", "ul. Pawła Stalmacha", "ul. Piaskowa", "ul. Piastowska", "ul. Pionierów", "ul. Piotrowska", "ul. Piwna", "ul. Plac Bohaterów Westerplatte", "ul. Plac Dominikański", "ul. Plac Jana Długosza", "ul. Plac Konstytucji 3 Maja", "ul. Plac Króla Władysława Jagiełły", "ul. Plac ks. Franciszka Melzera", "ul. Plac Księżnej Ofki Piastówny", "ul. Plac Stefana Okrzei", "ul. Plac Targowy", "ul. Plac Wolności", "ul. Plac Zofii Nałkowskiej", "ul. Plebiscytowa", "ul. Pocztowa", "ul. Pod Lasem", "ul. Pod Lipami", "ul. Pod Widokiem", "ul. Podmiejska", "ul. Podwale", "ul. Pogodna", "ul. Pogrzebieńska", "ul. Pogwizdowska", "ul. Polna", "ul. Pomnikowa", "ul. Poprzeczna", "ul. Porzeczkowa", "ul. Powstańców Śląskich", "ul. Poziomkowa", "ul. Poznańska", "ul. Pracy", "ul. Promenada", "ul. Przejazdowa", "ul. Pszczyńska", "ul. Radosna", "ul. Rolna", "ul. Rondo im. Jana Darowskiego", "ul. Rondo im. Żołnierzy Niezłomnych", "ul. Rondo Zamkowe", "ul. Różana", "ul. Rudnicka", "ul. Rudzka", "ul. Rybna", "ul. Rybnicka", "ul. Rynek", "ul. Rzeczna", "ul. Rzemieślnicza", "ul. Rzeźnicza", "ul. Sadowa", "ul. Sejmowa", "ul. Senatorska", "ul. Skwer Bractw Strzeleckich", "ul. Skwer św. Notburgi", "ul. Słoneczna", "ul. Słoneczny Stok", "ul. Słowacka", "ul. Solidarności", "ul. Solna", "ul. Sosienkowa", "ul. Sosnowiecka", "ul. Spokojna", "ul. Społeczna", "ul. Spółdzielcza", "ul. Srebrna", "ul. Stalowa", "ul. Stanisława Moniuszki", "ul. Stanisława Wyspiańskiego", "ul. Starowiejska", "ul. Stawowa", "ul. Stefana Drzewieckiego", "ul. Stefana Żeromskiego", "ul. Stefanii Sempołowskiej", "ul. Strażacka", "ul. Studzienna", "ul. Sudecka", "ul. Sybiraków", "ul. Szczecińska", "ul. Szczęśliwa", "ul. Szewska", "ul. Szkolna", "ul. Szwajcarska", "ul. Śląska", "ul. Śliska", "ul. Środkowa", "ul. Świerkowa", "ul. Tadeusza Kościuszki", "ul. Tarnowska", "ul. Tęczowa", "ul. Topolowa", "ul. Torowa", "ul. Toruńska", "ul. Towarzystwa Gimnastycznego", "ul. Transportowa", "ul. Tulipanowa", "ul. Tunelowa", "ul. Urbana", "ul. Walentego Ciemięgi", "ul. Walentego Zająca", "ul. Wałbrzyska", "ul. Wandy", "ul. Warszawska", "ul. Warzywna", "ul. Wawrzyńca", "ul. Wąska", "ul. Wczasowa", "ul. Wesoła", "ul. Węgierska", "ul. Węglowa", "ul. Wiatrakowa", "ul. Widokowa", "ul. Wiejska", "ul. Wiktora Różyckiego", "ul. Wileńska", "ul. Willowa", "ul. Winna", "ul. Wiosenna", "ul. Wiśniowa", "ul. Wita Stwosza", "ul. Władysława Broniewskiego", "ul. Władysława Reymonta", "ul. Włoska", "ul. Wodna", "ul. Wojciecha Korfantego", "ul. Wojnowicka", "ul. Wojska Polskiego", "ul. Wrocławska", "ul. Wrzosowa", "ul. Wschodnia", "ul. Wybrzeżna", "ul. Wygonowa", "ul. Wysoka", "ul. Za Dębiczem", "ul. Zaciszna", "ul. Zakładowa", "ul. Zakopiańska", "ul. Zamkowa", "ul. Zborowa", "ul. Zbożowa", "ul. Zielona", "ul. Złota", "ul. Źródlana", "ul. Żorska", "ul. Żurawia", "ul. Żwirki i Wigury", "ul. Żwirowa", "ul. ks. Stanisława Staszica", "ul. ks. Józefa Londzina", "ul. ks. Piotra Skargi", "ul. ks. Prałata Bernarda Gadego", "ul. ks. Prałata Stefana Pieczki"]],
            ["Kobyla", "gm. Kornowac", 50.1064, 18.3156, ["ul. Brzozowa", "ul. Budzińska", "ul. Gajowa", "ul. Główna", "ul. Kościelna", "ul. Krótka", "ul. Kuliga", "ul. Leśna", "ul. Łączna", "ul. Markowicka", "ul. Polna", "ul. Poprzeczna", "ul. Rzeczna", "ul. Sosnowa", "ul. Spacerowa", "ul. Świerkowa", "ul. Topolowa", "ul. Wilczok", "ul. Willowa", "ul. Wypoczynkowa"]],
            ["Kornowac", "gm. Kornowac", 50.0819, 18.3347, ["ul. Kolonia", "ul. Raciborska", "ul. Rekreacyjna", "ul. Sadowa", "ul. Spokojna", "ul. Starowiejska", "ul. Stawowa", "ul. Wojska Polskiego", "ul. Zacisze"]],
            ["Łańce", "gm. Kornowac", 50.0911, 18.3517, ["ul. Borek", "ul. Długa", "ul. Grzybowa", "ul. Jarzębinowa", "ul. Kozłówki", "ul. Rzuchowska", "ul. Słoneczna", "ul. Strażacka", "ul. Szkolna", "ul. Wolności", "ul. Źródlana"]],
            ["Pogrzebień", "gm. Kornowac", 50.0886, 18.3039, ["ul. Brzezka", "ul. Farna", "ul. Grabowa", "ul. Jasna", "ul. Jodłowa", "ul. Klasztorna", "ul. Kornowacka", "ul. Lipowa", "ul. Lubomska", "ul. Nowa", "ul. Ogrodowa", "ul. Pamiątki", "ul. Piaskowa", "ul. Plac św. Jana Nepomucena", "ul. Potoki", "ul. Wiejska", "ul. Wrzosowa"]],
            ["Bojanów", "gm. Krzanowice", 50.0381, 18.1653, ["ul. Bieńkowicka", "ul. Borucka", "ul. Cicha", "ul. Kościuszki", "ul. Krzanowicka", "ul. Łąkowa", "ul. Okrężna", "ul. Polna", "ul. Poprzeczna", "ul. Powstańców Śląskich", "ul. Raciborska", "ul. Szkolna", "ul. Tylna", "ul. Wiejska", "ul. Wojnowicka", "ul. Żeromskiego"]],
            ["Borucin", "gm. Krzanowice", 50.0075, 18.1569, ["ul. Bończyka", "ul. Cegielniana", "ul. Chabowiec", "ul. Cicha", "ul. Doktora Rostka", "ul. Grunwaldzka", "ul. Jesionowa", "ul. Kasztanowa", "ul. Klonowa", "ul. Kopernika", "ul. Krótka", "ul. Krzanowicka", "ul. Kuchelnicka", "ul. Polna", "ul. Tylna"]],
            ["Krzanowice", "gm. Krzanowice", 50.0206, 18.1264, ["ul. Akacjowa", "ul. Cegielniana", "ul. Cicha", "ul. Długa", "ul. Graniczna", "ul. Kolejowa", "ul. Kościelna", "ul. Krótka", "ul. Księdza Kwitka", "ul. Księdza Pawlara", "ul. Magdaleny", "ul. Mikołaja", "ul. Młyńska", "ul. Morawska", "ul. Ogrodowa", "ul. Opawska", "ul. Polna", "ul. Raciborska", "ul. Rohowska", "ul. Rynek", "ul. Rzeczna", "ul. Sikorskiego", "ul. Słoneczna", "ul. Srebrna Góra", "ul. Staszica", "ul. Sudzicka", "ul. Szpitalna", "ul. Tylna", "ul. Winna", "ul. Wojska Polskiego", "ul. Zamkowa", "ul. Zawadzkiego"]],
            ["Pietraszyn", "gm. Krzanowice", 50.0247, 18.0931, ["ul. Babia Góra", "ul. Chmielna", "ul. Dolna", "ul. Lipowa", "ul. Trulleya", "ul. Wesoła", "ul. Zaciszna"]],
            ["Wojnowice", "gm. Krzanowice", 50.0522, 18.1489, ["ul. Cicha", "ul. Cukrownicza", "ul. Jana", "ul. Kolejowa", "ul. Kopernika", "ul. Kościelna", "ul. Krótka", "ul. Łąkowa", "ul. Mickiewicza", "ul. Odrodzenia", "ul. Ogrodowa", "ul. Pałacowa", "ul. Pocztowa", "ul. Polna", "ul. Poprzeczna", "ul. Powstańców Śląskich", "ul. Rostka", "ul. Szkolna", "ul. Szpitalna", "ul. Wojska Polskiego"]],
            ["Bieńkowice", "gm. Krzyżanowice", 50.0369, 18.2144, ["ul. Bojanowska", "ul. Dębowa", "ul. Łąkowa", "ul. Młyńska", "ul. Myśliwska", "ul. Niwkowa", "ul. Odrzańska", "ul. Ogrodowa", "ul. Pomnikowa", "ul. Raciborska", "ul. Rzemieślnicza", "ul. Szkolna", "ul. Wojnowska", "ul. Zachodnia"]],
            ["Bolesław", "gm. Krzyżanowice", 50.0072, 18.2192, ["ul. Główna", "ul. Kowalowa", "ul. Krótka", "ul. Nowa", "ul. Polna", "ul. Społeczna", "ul. Środkowa", "ul. Tworkowska"]],
            ["Chałupki", "gm. Krzyżanowice", 49.9261, 18.3128, ["ul. 1 Maja", "ul. Boczna", "ul. Bogumińska", "ul. Długa", "ul. Fabryczna", "ul. Kamykowa", "ul. Kopernika", "ul. Krótka", "ul. Kwiatowa", "ul. Łąkowa", "ul. Mickiewicza", "ul. Nowa", "ul. Odrzańska", "ul. Ogrodowa", "Plac Warszawski", "ul. Polna", "ul. Polowa", "ul. Poprzeczna", "ul. Powstańców Śląskich", "ul. Raciborska", "ul. Relaksowa", "Rondo Trzech Narodów", "ul. Słoneczna", "ul. Spacerowa", "ul. Spokojna", "ul. Stare Chałupki", "ul. Szkolna", "ul. Vajdy", "ul. Wałowa", "ul. Zabełkowska"]],
            ["Krzyżanowice", "gm. Krzyżanowice", 49.9881, 18.2697, ["ul. 1 Maja", "ul. Akacjowa", "ul. Aleja Lichnowskiego", "ul. Boczna", "ul. Bukowa", "ul. Dworcowa", "ul. Główna", "ul. Horniok-Pieńki", "ul. Kolejowa", "ul. Kościelna", "ul. Krótka", "ul. Lompy", "ul. Łąkowa", "ul. Miarki", "ul. Mickiewicza", "ul. Moniuszki", "ul. Odrzańska", "ul. Ogrodowa", "ul. Piaskowa", "ul. Polna", "ul. Poprzeczna", "ul. Powstańców Śląskich", "ul. Słoneczna", "ul. Tworkowska", "ul. Wyzwolenia"]],
            ["Nowa Wioska", "gm. Krzyżanowice", 49.9875, 18.2250, ["ul. Cegielniana", "ul. Główna", "ul. Leśna", "ul. Młodzieżowa", "ul. Wrzosowa"]],
            ["Owsiszcze", "gm. Krzyżanowice", 49.9836, 18.2047, ["ul. Graniczna", "ul. Krzywa", "ul. Krzyżanowicka", "ul. Leśna", "ul. Nowa", "ul. Okrężna", "ul. Opawska", "ul. Polna", "ul. Sportowa", "ul. Szkolna", "ul. Wąska", "ul. Wojska Polskiego", "ul. Wydale"]],
            ["Roszków", "gm. Krzyżanowice", 49.9678, 18.2869, ["ul. Kolejowa", "ul. Krótka", "ul. Łąkowa", "ul. Nowa", "ul. Osiedlowa", "ul. Pomnikowa", "ul. Poprzeczna", "ul. Raciborska", "ul. Słoneczna", "ul. Wiejska"]],
            ["Rudyszwałd", "gm. Krzyżanowice", 49.9317, 18.2803, ["ul. Boczna", "ul. Cicha", "ul. Główna", "ul. Graniczna", "ul. Krótka", "ul. Młyńska", "ul. Osiedlowa", "ul. Polna", "ul. Poprzeczna", "ul. Rakowiec", "ul. Słoneczna", "ul. Wiejska", "ul. Wojsk Ochrony Pogranicza", "ul. Zabełkowska", "ul. Zagumnie"]],
            ["Tworków", "gm. Krzyżanowice", 50.0244, 18.2325, ["ul. 1 Maja", "ul. Boczna", "ul. Bolesławska", "ul. Brzeziny", "ul. Cicha", "ul. Długa", "ul. Drzymały", "ul. Dworcowa", "ul. Dworcowa PKP", "ul. Główna", "ul. Hanowiec", "ul. Kopernika", "ul. Krzyżanowska", "ul. Księdza Bonczyka", "ul. Księdza Doktora Weltzla", "ul. Księdza Dzierżona", "ul. Księdza Gregora", "ul. Kwiatowa", "ul. Ludwika Bielaczka", "ul. Miarki", "ul. Mickiewicza", "ul. Młyńska", "ul. Nowa", "ul. Odrzańska", "ul. Ogrodowa", "ul. Parkowa", "ul. Piaskowa", "ul. Polna", "ul. Południowa", "ul. Raciborska", "ul. Różana", "Skwer przy Krzyżu", "ul. Słoneczna", "ul. Sportowa", "ul. Stawowa", "ul. Świętego Jana", "ul. Świętego Urbana", "ul. Wąska", "ul. Wypoczynkowa", "ul. Zachodnia", "ul. Zamkowa", "ul. Żwirowa"]],
            ["Zabełków", "gm. Krzyżanowice", 49.9461, 18.2975, ["ul. Boczna", "ul. Bogumińska", "ul. Długa", "ul. Dolna", "ul. Domowa", "ul. Jana", "ul. Krótka", "ul. Łąkowa", "ul. Młyńska", "ul. Nowa", "ul. Odrzańska", "ul. Ogrodowa", "ul. Okrężna", "ul. Piesza", "ul. Podwórkowa", "ul. Polna", "ul. Powstańców Śląskich", "ul. Prosta", "ul. Rakowiecka", "ul. Rudyszwałdzka", "ul. Rymera", "ul. Słoneczna", "ul. Spacerowa", "ul. Torowa", "ul. Zagumnie"]],
            ["Budziska", "gm. Kuźnia Raciborska", 50.1742, 18.2611, ["ul. Fabryczna", "ul. Frosowa", "ul. Główna", "ul. Leśna", "ul. Nowa", "ul. Polna", "ul. Szkolna", "ul. Tkocza", "ul. Wolności"]],
            ["Jankowice", "gm. Kuźnia Raciborska", 50.1917, 18.3750, ["ul. Leśna", "ul. Leśne Zacisze", "ul. Polna", "ul. Raciborska", "ul. Szkolna", "ul. Wiejska", "ul. Wypoczynkowa"]],
            ["Kuźnia Raciborska", "gm. Kuźnia Raciborska", 50.1983, 18.3117, ["ul. Arki Bożka", "ul. Bohaterów Westerplatte", "ul. Browarna", "ul. Brzozowa", "ul. Dębowa", "ul. Drzymały", "ul. Działkowców", "ul. Fabryczna", "ul. Garbarska", "ul. Generała Bema", "ul. Gliwickih Saperów", "ul. Górnicza", "ul. Henryka Sienkiewicza", "ul. Ignacego Krasickiego", "ul. Jagodowa", "ul. Jana Matejki", "ul. Kasztanowa", "ul. Klasztorna", "ul. Klonowa", "ul. Kocura", "ul. Kolejowa", "ul. Kościelna", "ul. Kozielska", "ul. Kręta", "ul. Krótka", "ul. Krzyżowa", "ul. Kwiatowa", "ul. Leśna", "ul. Lipowa", "ul. Łączna", "ul. Mikołaja Reja", "ul. Moniuszki", "ul. Morcinka", "ul. Myśliwska", "ul. Nowy Świat", "ul. Ogrodowa", "ul. Parkowa", "ul. Piaskowa", "Plac Mickiewicza", "Plac Zwycięstwa", "ul. Powstańców", "ul. Raciborska", "ul. Roberta Lewandowskiego", "ul. Rudzka", "Skwer imienia ks. dr. mjr. Adama Kocura", "Skwer św. Jana Pawła II", "ul. Słoneczna", "ul. Słowackiego", "ul. Sosnowa", "ul. Spacerowa", "ul. Spokojna", "ul. Staszica", "ul. Stefana Czarnieckiego", "ul. Strażacka", "ul. Świerkowa", "ul. Tadeusza Kościuszki", "ul. Tartaczna", "ul. Topolowa", "ul. Wesoła", "ul. Wierzbowa", "ul. Willowa", "ul. Żwirowa"]],
            ["Ruda", "gm. Kuźnia Raciborska", 50.1583, 18.2750, ["ul. Główna", "ul. Leśna", "ul. Młyńska", "ul. Odrzańska", "ul. Okrężna", "ul. Rudzka"]],
            ["Ruda Kozielska", "gm. Kuźnia Raciborska", 50.1778, 18.3306, ["ul. Boczna", "ul. Górnicza", "ul. Handlowa", "ul. Hubertusa", "ul. Hutnicza", "ul. Krótka", "ul. Lipowa", "ul. Nowa", "ul. Ogrodowa", "ul. Raciborska", "ul. Skośna", "ul. Słoneczna", "ul. Sportowa", "Wildek", "ul. Wiśniowa", "ul. Zielona"]],
            ["Rudy", "gm. Kuźnia Raciborska", 50.1906, 18.4486, ["ul. Akacjowa", "Aleja Lipowa", "Biały Dwór", "ul. Borowa", "ul. Brzozowa", "ul. Bukowa", "ul. Cegielska", "ul. Cysterska", "ul. Dębowa", "ul. Dworcowa", "ul. Gliwicka", "ul. Jesionowa", "ul. Kasztanowa", "Kolonia Renerowska", "ul. Kozielska", "ul. Krótka", "ul. Leszczynowa", "ul. Leśna", "ul. Łąkowa", "ul. Majowa", "ul. Mickiewicza", "ul. Paproć", "ul. Parkowa", "ul. Podbiała", "ul. Polna", "ul. Powstańców Śląskich", "ul. Przerycie", "ul. Raciborska", "ul. Rogera", "ul. Rybnicka", "ul. Rzeczna", "Skwer Księdza Radcy Emila Theodora Jatzka", "ul. Sobieskiego", "ul. Sosnowa", "ul. Szkolna", "Szybki", "ul. Świerkowa", "ul. Świętojańska", "ul. Wierzbowa", "ul. Zielona"]],
            ["Siedliska", "gm. Kuźnia Raciborska", 50.1639, 18.2528, ["ul. Arki Bożka", "ul. Dąbrowskiego", "ul. Domańskiego", "ul. Gliwicka", "ul. Krótka", "ul. Leśna", "ul. Mała", "ul. Marii Konopnickiej", "ul. Młyńska", "ul. Nowa", "ul. Powstańców", "ul. Wojciecha Korfantego", "ul. Wojciecha Kossaka", "ul. Żwirki i Wigury"]],
            ["Turze", "gm. Kuźnia Raciborska", 50.1506, 18.2431, ["ul. Kościelna", "ul. Kościuszki", "ul. Płonia", "ul. Raciborska", "ul. Rudzka", "ul. Stawowa"]],
            ["Babice", "gm. Nędza", 50.1556, 18.3056, ["ul. Adamowicka", "ul. Arki Bożka", "ul. Drzewna", "ul. Jana Matejki", "ul. Leśna", "ul. Piaskowa", "ul. Polna", "ul. Powstańców", "ul. Przyrwy", "ul. Rudzka", "ul. Rybacka", "ul. Szkolna", "ul. Wiejska", "ul. Wyrobiskowa", "ul. Wyzwolenia"]],
            ["Ciechowice", "gm. Nędza", 50.1417, 18.2389, ["ul. Betonowa", "ul. Boczna", "ul. Dojazdowa", "ul. Gwiaździsta", "ul. Kanałowa", "ul. Kosmonautów", "ul. Księżycowa", "ul. Kuźnicka", "ul. Kwiatów Polnych", "ul. Melioracyjna", "ul. Odrzańska", "ul. Powstańców Śląskich", "ul. Raciborska", "ul. Wodna"]],
            ["Górki Śląskie", "gm. Nędza", 50.1583, 18.3611, ["ul. Astrów", "ul. Basenowa", "ul. Bogunicka", "ul. Brzozowa", "ul. Jasna", "ul. Leśna", "ul. Nad Koleją", "ul. Nowa", "ul. Ofiar Oświęcimskich", "ul. Rudzka", "ul. Słoneczna", "ul. Za Lasem"]],
            ["Łęg", "gm. Nędza", 50.1333, 18.2583, ["ul. Koniewa", "ul. Łęgowa", "ul. Okrężna", "ul. Polna", "ul. Poprzeczna", "ul. Saperska", "ul. Wita Stwosza", "ul. Wyzwolenia"]],
            ["Nędza", "gm. Nędza", 50.1589, 18.3125, ["ul. 1 Maja", "ul. Adama Mickiewicza", "ul. Akacjowa", "ul. Boczna", "ul. Borowiec", "ul. Brzozowa", "ul. Dębowa", "ul. Drzymały", "ul. Gliwicka", "ul. Gołębia", "ul. Górnicza", "ul. Jabłoniowa", "ul. Jana III Sobieskiego", "ul. Jana Pawła II", "ul. Jesionowa", "ul. Kasztanowa", "ul. Kolejowa", "ul. Konarskiego", "ul. Kopernika", "ul. Kościelna", "ul. Krótka", "ul. Kwiatowa", "ul. Lecznicza", "ul. Leśna", "ul. Letniskowa", "ul. Lipowa", "ul. Lniana", "ul. Łąkowa", "ul. Modrzewiowa", "ul. Myśliwska", "ul. Nad Suminą", "ul. Nowa", "ul. Ogrodowa", "ul. Osiedlowa", "ul. Piaskowa", "Plac Klemensa Boruty", "ul. Pocztowa", "ul. Polna", "ul. Pomiarowa", "ul. Prosta", "ul. Rogol", "ul. Rolnicza", "ul. Rzeczna", "ul. Rzemieślnicza", "ul. Sadowa", "ul. Sienkiewicza", "ul. Skośna", "ul. Słoneczna", "ul. Sosnowa", "ul. Sportowa", "ul. Spółdzielcza", "ul. Stawowa", "ul. Strażacka", "ul. Topolowa", "ul. Towarowa", "ul. Trawniki", "ul. Tuwima", "ul. Ustronna", "ul. Wąska", "ul. Wiejska", "ul. Wiśniowa", "ul. Zaciszna", "ul. Zamknięta", "ul. Zielona", "ul. Złocista", "ul. Źródlana", "ul. Żwirowa"]],
            ["Szymocice", "gm. Nędza", 50.1694, 18.3806, ["ul. Gliwicka", "ul. Jagodowa", "ul. Malinowa", "ul. Poręczkowa", "ul. Spacerowa", "ul. Wiejska", "ul. Wrzosowa"]],
            ["Zawada Książęca", "gm. Nędza", 50.1472, 18.2528, ["ul. Betonowa", "ul. Boczna", "ul. Brzegowa", "ul. Cicha", "ul. Ciechowicka", "ul. Dzwonkowa", "ul. Koszykowa", "ul. Krótka", "ul. Leśna", "ul. Łąkowa", "ul. Łukowa", "ul. Olimpijska", "ul. Polna", "ul. Południowa", "ul. Raciborska", "ul. Stawowa", "ul. Szkolna", "ul. Wesoła"]],
            ["Amandów", "gm. Pietrowice Wielkie", 50.1069, 18.0697, ["ul. Wiejska"]],
            ["Cyprzanów", "gm. Pietrowice Wielkie", 50.0764, 18.1408, ["ul. Dolna", "ul. Janowska", "ul. Łąkowa", "ul. Młyńska", "ul. Ogrodowa", "ul. Polna", "ul. Słoneczna", "ul. Szkolna"]],
            ["Gródczanki", "gm. Pietrowice Wielkie", 50.0711, 18.0931, ["ul. Wiejska"]],
            ["Kornice", "gm. Pietrowice Wielkie", 50.0911, 18.1481, ["ul. Główna", "ul. Leśna", "ul. Przejazdowa", "ul. Przemysłowa", "ul. Raciborska", "ul. Spacerowa", "ul. Spółdzielcza", "ul. Św. Jana", "ul. Św. Łukasza", "ul. Św. Marka", "ul. Św. Pawła", "ul. Świętego Mateusza"]],
            ["Krowiarki", "gm. Pietrowice Wielkie", 50.1464, 18.0772, ["ul. Folwarczna", "ul. Kasztanowa", "ul. Kościuszki", "ul. Leśna", "ul. Mickiewicza", "ul. Ogrodowa", "ul. Powstańców Śląskich", "ul. Raciborska", "ul. Spokojna", "ul. Szkolna", "ul. Wyzwolenia", "ul. Zamkowa"]],
            ["Lekartów", "gm. Pietrowice Wielkie", 50.0667, 18.1514, ["ul. Kolejowa", "ul. Ogrodowa", "ul. Polna", "ul. Raciborska", "ul. Spółdzielcza", "ul. Wesoła"]],
            ["Maków", "gm. Pietrowice Wielkie", 50.1228, 18.1069, ["ul. Lipowa", "ul. Łąkowa", "ul. Młyńska", "ul. Ogrodowa", "ul. Raciborska", "ul. Radosna", "ul. Spółdzielcza", "ul. Staszica", "ul. Szkolna"]],
            ["Pawłów", "gm. Pietrowice Wielkie", 50.1114, 18.1442, ["ul. Boczna", "ul. Gamowska", "ul. Nowa", "ul. Osiedleńcza", "ul. Pietrowicka", "ul. Polna", "ul. Powstańców Śląskich", "ul. Rudnicka", "ul. Słoneczna", "ul. Słowackiego", "ul. Spółdzielcza", "ul. Stawowa", "ul. Tuwima"]],
            ["Pietrowice Wielkie", "gm. Pietrowice Wielkie", 50.0928, 18.0983, ["ul. 1 Maja", "ul. Bończyka", "ul. Brzozowa", "ul. Chopina", "ul. Daszyńskiego", "ul. Fabryczna", "ul. Górska", "ul. Jana Pawła II", "ul. Janowska", "ul. Klonowa", "ul. Konopnickiej", "ul. Krawiecka", "ul. Krótkie Pole", "ul. Kwiatowa", "ul. Ligonia", "ul. Miarki", "ul. Mickiewicza", "ul. Młyńska", "ul. Nowa", "ul. Ojca Pawła Schebesty", "ul. Parkowa", "ul. Raciborska", "ul. Sienkiewicza", "ul. Skłodowskiej-Curie", "ul. Słoneczna", "ul. Spółdzielcza", "ul. Szkolna", "ul. Średnia", "ul. Świętokrzyska", "ul. Tłustomostka", "ul. Topolowa", "ul. Wiosenna", "ul. Wrzosowa", "ul. Wspólna", "ul. Wyzwolenia", "ul. Zawodzie", "ul. Zielona", "ul. Żeromskiego"]],
            ["Samborowice", "gm. Pietrowice Wielkie", 50.0439, 18.1039, ["ul. Długa", "ul. Opawska", "ul. Polna", "ul. Szkolna", "ul. Średnia"]],
            ["Żerdziny", "gm. Pietrowice Wielkie", 50.0886, 18.1258, ["ul. Lawendowa", "ul. Ocicka", "ul. Ogrodowa", "ul. Pawłowska", "ul. Powstańców Śląskich", "ul. Sikorskiego", "ul. Stawowa", "ul. Szczęśliwa", "ul. Szkolna", "ul. Widokowa"]],
            ["Brzeźnica", "gm. Rudnik", 50.1333, 18.2000, ["ul. Górna", "ul. Kozielska", "ul. Leśna"]],
            ["Czerwięcice", "gm. Rudnik", 50.1167, 18.1833, ["ul. Główna"]],
            ["Dolędzin", "gm. Rudnik", 50.1333, 18.1500, []],
            ["Gamów", "gm. Rudnik", 50.1000, 18.1833, ["ul. Długa", "ul. Kurzydyma", "ul. Mickiewicza", "ul. Modzurowska", "ul. Ogrodowa", "ul. Stawowa", "ul. Szkolna", "ul. Wiatrakowa"]],
            ["Grzegorzowice", "gm. Rudnik", 50.1333, 18.2333, ["Kolonia Gacki", "ul. Łąkowa", "ul. Młyńska", "ul. Odrzańska", "ul. Powstańców Śląskich", "ul. Żabnik"]],
            ["Jastrzębie", "gm. Rudnik", 50.1167, 18.2167, ["ul. Raciborska"]],
            ["Lasaki", "gm. Rudnik", 50.1500, 18.1833, ["ul. Boczna", "Kolonia", "ul. Kręta", "ul. Nadodrzańska", "ul. Sławikowska", "ul. Stara Odra"]],
            ["Ligota Książęca", "gm. Rudnik", 50.1667, 18.1833, ["ul. Asnyka", "ul. Nad Potokiem", "ul. Sportowa"]],
            ["Lubowice", "gm. Rudnik", 50.1500, 18.2333, ["ul. Eichendorffa", "ul. Kasztanowa", "ul. Łąkowa", "ul. Polna", "ul. Wolności", "ul. Zamkowa"]],
            ["Modzurów", "gm. Rudnik", 50.0833, 18.2000, ["ul. 1 Maja", "ul. Arki Bożka", "ul. Księdza Strzybnego", "ul. Słowackiego", "ul. Wyzwolenia"]],
            ["Ponięcice", "gm. Rudnik", 50.1167, 18.2500, ["ul. Leśna", "ul. Łąkowa", "ul. Szkolna"]],
            ["Rudnik", "gm. Rudnik", 50.1167, 18.2167, ["ul. Akacjowa", "ul. Arcybiskupa Gawliny", "ul. Bukowa", "ul. Cisza", "ul. Grabowa", "ul. Jesionowa", "ul. Jodłowa", "ul. Klonowa", "ul. Kozielska", "ul. Leszczynowa", "ul. Mickiewicza", "ul. Nowa", "ul. Pawłowska", "ul. Powstańców Śląskich", "ul. Przemysłowa", "ul. Rzeczna", "ul. Słoneczna", "ul. Sosnowa", "ul. Starowiejska", "ul. Stawowa", "ul. Sylwestra", "ul. Szkolna", "ul. Wesoła", "ul. Wiejska"]],
            ["Sławienko", "gm. Rudnik", 50.1500, 18.1500, ["ul. Kręta"]],
            ["Sławików", "gm. Rudnik", 50.1333, 18.2667, ["ul. Dębowa", "ul. Grzegorzowicka", "ul. Lasacka", "ul. Parkowa", "ul. Powstańców Śląskich", "ul. Słowackiego", "ul. Strażacka"]],
            ["Strzybnik", "gm. Rudnik", 50.0833, 18.2333, ["ul. Długa", "Kolonia", "ul. Parkowa", "ul. Polna", "ul. Słoneczna", "Strzybniczek", "ul. Zamkowa"]],
            ["Szonowice", "gm. Rudnik", 50.1000, 18.2333, ["ul. Cicha", "ul. Konopnickiej", "ul. Obrońców Pokoju", "ul. Przejazdowa", "ul. Słowackiego", "ul. Wiosenna", "ul. Wygon"]]
        ],
        psp: [
            ["JRG Racibórz", "Racibórz", "ul. Władysława Reymonta 8, 47-400 Racibórz", 50.094089, 18.218574, true, [
                ["561[S]21", "GBA-Rt 3/27 Scania P360/WISS", 5],
                ["561[S]22", "GBA 2,5/16 Iveco EuroCargo 150-320/PS Szczęśniak", 3],
                ["561[S]25", "GCBA-Rt 5/32 Scania P410/WISS", 4],
                ["561[S]40", "SLRt Renault Mascott/WISS", 1],
                ["561[S]51", "SCD-42 Iveco EuroCargo 180-320/Magirus", 1],
                ["561[S]81", "SW 2000/40 + AS-9000/4 Mercedes Benz Atego 1218/Tramp", 1],
                ["561[S]90", "SLRr Ford Ranger", 1],
                ["561[S]X1", "Ładowarka Teleskopowa Dieci", 1],
                ["561[S]Ł1", "Łódź strumieniowa - QUICKSILVER", 0]
            ]],
            ["KP PSP Racibórz", "Racibórz", "ul. Władysława Reymonta 8, 47-400 Racibórz", 50.094089, 18.218574, true, [
                ["560[S]81", "SLKw Volkswagen Crafter", 1],
                ["560[S]82", "SLKw BYD Seal", 1],
                ["560[S]84", "SLBus Renault Trafic III", 1],
                ["560[S]90", "SLOp Kia Sportage III", 1],
                ["560[S]91", "SLOp Skoda Octavia", 1],
                ["560[S]92", "SLRr Toyota Hilux/Bocar", 1]
            ]]
        ],
        osp: [
            [".OSP KSRG Racibórz-Markowice", "Racibórz", "ul. Arki Bożka 20A, 47-400 Racibórz", 50.109748, 18.276390, true, [["569[S]31", "GBA 2/8 Mercedes Unimog U1300/Zigler", 3], ["569[S]32", "GBA-Rt 3/29 Volvo FL280/Bocar", 6], ["569[S]33", "SLRr VW Crafter", 9], ["569[S]Q1-31", "QUAD CF MOTO 520L", 1], ["569[S]Ł1-31", "Łódź Kontra 450 RCC", 1]]],
            [".OSP KSRG Racibórz-Brzezie", "Racibórz", "ul. Bitwy Olzańskiej 28, 47-400 Racibórz", 50.071633, 18.268751, true, [["569[S]28", "SLRr VW Amarok", 5], ["569[S]29", "GBA-Rt 4,5/30 MAN TGM 18.340 MotoTruck", 6], ["569[S]30", "GLBA 1/0,7 Ford Transit/Frank-Cars", 5]]],
            [".OSP KSRG Racibórz-Sudół", "Racibórz", "ul. Hulczyńska 164, 47-400 Racibórz", 50.052258, 18.195159, true, [["569[S]34", "GCBA 5/36 Scania P370 XT/Szczęśniak", 6], ["569[S]35", "SLRr Land Rover Defender 90", 6], ["569[S]36", "GLBA-Rt 1/0,7 Ford Transit/Szybicki", 6]]],
            [".OSP KSRG Racibórz-Miedonia", "Racibórz", "ul. Podmiejska 29, 47-400 Racibórz", 50.121745, 18.220343, true, [["569[S]61", "SLRr Land Rover Freelander 2", 5], ["569[S]62", "GBA-Rt 3,5/30 Mercedes Benz 1530/Bonex", 6], ["569[S]63", "GLBA 1/1,25 Iveco/SHL", 6]]],
            [".OSP KSRG Kobyla", "Kobyla", "ul. Główna 78, 44-285 Kobyla", 50.090617, 18.295590, true, [["569[S]37", "GCBA-Rt 4/32 Jelcz 415/Bonex", 6], ["569[S]38", "GLBM 1,5/20 Mitshubishi Fuso/Dragon", 6]]],
            [".OSP KSRG Łańce", "Łańce", "ul. Strażacka 2, 44-285 Łańce", 50.082178, 18.334188, true, [["569[S]40", "GCBARt 5,7/32 Jelcz 325/PS Szczęśniak", 4], ["569[S]41", "GLM-Rt Mercedes Sprinter", 6]]],
            [".OSP Pogrzebień", "Pogrzebień", "ul. Grabowa 4, 44-285 Pogrzebień", 50.067700, 18.300571, true, [["567[S]40", "GBA-Rt 4,1/16 Volvo FL 320/Bocar", 6], ["567[S]42", "SLRr Land Rover 110", 9]]],
            [".OSP Rzuchów", "Rzuchów", "ul. Miarki 8B, 44-285 Rzuchów", 50.07003626914419, 18.35689517655173, true, [["567[S]43", "GLBA-Rt 0,2/0,5 Volkswagen Crafter/PERFEKT", 6], ["567[S]44", "GBA 3/16 Renault S170/Camiva", 6]]],
            [".OSP KSRG Krzanowice", "Krzanowice", "ul. Morawska 18, 47-470 Krzanowice", 50.018297, 18.123197, true, [["569[S]52", "GBA-Rt 3/30 Volvo FL 280/Bocar", 6], ["569[S]53", "GCBA 5/24 Mercedes-Benz 1626", 3]]],
            [".OSP KSRG Bojanów", "Bojanów", "ul. Borucka 3, 47-470 Bojanów", 50.030783, 18.162002, true, [["569[S]43", "GCBA 6/32 Jelcz 325 DS/JZS", 4], ["569[S]44", "GBA-Rt 4,1/16 Volvo FL 280/Bocar", 6]]],
            [".OSP Borucin", "Borucin", "ul. Mikołaja Kopernika 48, 47-470 Borucin", 50.004804, 18.156952, true, [["567[S]48", "GBA 2,4/16 Mercedes", 6]]],
            [".OSP Wojnowice", "Wojnowice", "ul. Rostka 29, 47-475 Wojnowice", 50.055274, 18.153633, true, [["567[S]50", "GBA 2,5/16 Magirus", 6], ["567[S]51", "SLRt Ford Transit", 6]]],
            [".OSP Pietraszyn", "Pietraszyn", "ul. Trulleya 64, 47-470 Pietraszyn", 50.035119, 18.087957, true, [["567[S]52", "GBA 0,8/16 Magirus Deutz 170 D", 6], ["567[S]53", "GLM Żuk/FS Lublin", 6]]],
            [".OSP Bieńkowice", "Bieńkowice", "ul. Raciborska 72, 47-451 Bieńkowice", 50.022501, 18.213979, true, [["567[S]67", "GBA-Rt 3/24 Volvo FL 280/WISS", 6], ["567[S]68", "SLRr Range Rover Evoque", 6]]],
            [".OSP Bolesław", "Bolesław", "ul. Główna 40, 47-451 Bolesław", 50.005520, 18.201682, true, [["567[S]59", "GBA 3/24 Renault G230/Camiva", 6]]],
            [".OSP KSRG Tworków", "Tworków", "ul. Główna 14, 47-451 Tworków", 50.008274, 18.234707, true, [["569[S]49", "GBA-Rt 2,5/16/2,5 Mercedes-Benz Atego 1329/Bocar", 6], ["569[S]50", "SLRr Tarpan Honker", 6]]],
            [".OSP KSRG Krzyżanowice", "Krzyżanowice", "ul. Kościelna 4, 47-450 Krzyżanowice", 49.980805, 18.261513, true, [["569[S]46", "GBARt 4,5/16/4 Mercedes-Benz Atego 1629/Bocar", 6], ["569[S]47", "GBA 3/16 Star 1142/Osiny", 6], ["569[S]Ł1-46", "Przyczepa z łódką strażacką", 0]]],
            [".OSP Nowa Wioska", "Nowa Wioska", "ul. Główna 13, 47-450 Nowa Wioska", 49.974937, 18.247570, true, [["567[S]54", "GBA 3/16 Renault S170/Sairep", 6]]],
            [".OSP Owsiszcze", "Owsiszcze", "ul. Wojska Polskiego 2, 47-450 Owsiszcze", 49.976070, 18.220268, true, [["567[S]57", "GBA 3.6/24 Mercedes Atego 1630/Dragon", 6]]],
            [".OSP Roszków", "Roszków", "ul. Nowa 10, 47-450 Roszków", 49.965254, 18.299499, true, [["567[S]65", "GBA 2/16 Renault Midliner M210/WISS", 6]]],
            [".OSP Rudyszwałd", "Rudyszwałd", "ul. Zagumnie 31, 47-460 Rudyszwałd", 49.938727, 18.291447, true, [["567[S]61", "GBA 2,6/16 Magirus Deutz 192D11/Magirus", 6]]],
            [".OSP KSRG Zabełków", "Zabełków", "ul. Rymera 2, 47-460 Zabełków", 49.938601, 18.323779, true, [["569[S]64", "GBA-Rt 3/30 Volvo FL 280/Bocar", 6]]],
            [".OSP Chałupki", "Chałupki", "ul. Długa 39, 47-460 Chałupki", 49.928197, 18.312755, true, [["567[S]69", "GCBA 5/24 Jelcz 422/JZS", 6]]],
            [".OSP Ruda", "Ruda", "ul. Główna 22, 47-420 Ruda", 50.212466, 18.250129, true, [["567[S]81", "GLBM 0,3/13/0,5 Volkswagen T5/Strażak Sam", 6]]],
            [".OSP Budziska", "Budziska", "ul. Fabryczna 10A, 47-420 Budziska", 50.200770, 18.279366, true, [["567[S]83", "GBA 3/28 Renault D15/Szczęśniak", 6], ["567[S]84", "SLRr VW T4", 6]]],
            [".OSP Turze", "Turze", "ul. Raciborska 68, 47-420 Turze", 50.191630, 18.264494, true, [["567[S]79", "GCBA 5/32 Scania P380/WISS", 6], ["567[S]80", "SLRr Mitsubishi L300", 6]]],
            [".OSP KSRG Siedliska", "Siedliska", "ul. Leśna 1, 47-420 Siedliska", 50.193789, 18.292454, true, [["569[S]04", "GBA 2/30 Renault Midliner M210/WISS", 6], ["569[S]05", "GBA-Rt 2,5/16 Mercedes Benz 1429AF/Bocar", 6], ["569[S]06", "SLRr Lublin 3304", 6], ["569[S]Ł1-04", "Łódź Kontra 450 RCC", 0]]],
            [".OSP KSRG Kuźnia Raciborska", "Kuźnia Raciborska", "ul. Strażacka 4, 47-420 Kuźnia Raciborska", 50.200868, 18.310236, true, [["569[S]01", "GBA-Rt 4,3/35 Mercedes Atego 1630/Bocar", 6], ["569[S]02", "SLRt Ford Transit 90T350/Stolarczyk", 6]]],
            [".OSP KSRG Ruda Kozielska", "Ruda Kozielska", "ul. Wildek 2, 47-430 Ruda Kozielska", 50.200340, 18.410991, true, [["569[S]07", "GBA 2,5/16 Star 266/BoCar", 6], ["569[S]08", "GBA 2/16 Steyr 10S23/AutoSHL", 3]]],
            [".OSP KSRG Rudy", "Rudy", "ul. Juliusza Rogera 22, 47-430 Rudy", 50.190448, 18.451554, true, [["569[S]10", "GBA-Rt 3/16 Volvo FL 280/Bocar", 6], ["569[S]11", "GBA 2,3/16 Star 266/Szczęśniak", 6]]],
            [".OSP KSRG Jankowice", "Jankowice", "ul. Raciborska 40, 47-430 Jankowice", 50.16891110761812, 18.38771375462394, true, [["569[S]13", "GBA-Rt 2,5/25 Star 12.185/Stolarczyk", 6], ["569[S]14", "GBA 2,5/16 star 244/JZS", 6]]],
            [".OSP KSRG Nędza", "Nędza", "ul. Strażacka 2, 47-440 Nędza", 50.159663, 18.303819, true, [["569[S]16", "GBA 2,5/16/4 Mercedes Benz Atego 1429/Bocar", 6], ["569[S]18", "GBA 2,4/16 Magirus Deutz", 6]]],
            [".OSP Szymocice", "Szymocice", "ul. DW919, 47-440 Szymocice", 50.161050, 18.371121, true, [["567[S]08", "GBA 2,6/16 Magirus 170D11/Magirus", 6]]],
            [".OSP KSRG Górki Śląskie", "Górki Śląskie", "ul. Ofiar Oświęcimskich 2, 44-295 Górki Śląskie", 50.139768, 18.390806, true, [["569[S]59", "GBA-Rt 4/28 MAN TGM 18.320/Szczęśniak", 6], ["569[S]60", "GBA 2,4/16 Magirus Deutz/Magirus", 6]]],
            [".OSP Babice", "Babice", "ul. Szkolna 9, 47-440 Babice", 50.136625, 18.300818, true, [["567[S]15", "GCBA 5/24 Magirus Deutz 232D17", 3], ["567[S]16", "SLOp Land Rover Defender 110", 6]]],
            [".OSP Zawada Książęca", "Zawada Książęca", "ul. Raciborska 55, 47-442 Zawada Książęca", 50.151600, 18.249183, true, [["567[S]12", "SLOp Opel Astra", 5], ["567[S]13", "GBA 3/16+4 Volvo FL 280/Bocar", 6], ["567[S]14", "SLBus Opel Vivaro", 6], ["567[S]Q1-13", "CFMTOTO C-Force 520", 1]]],
            [".OSP Żerdziny", "Żerdziny", "ul. Powstańców Śląskich, 47-400 Żerdziny", 50.094448, 18.147712, true, [["567[S]71", "GBA 3/16 Volvo FL 320/Bocar", 6]]],
            [".OSP Pawłów", "Pawłów", "ul. Powstańców Śląskich 35, 47-491 Pawłów", 50.107414, 18.137046, true, [["567[S]33", "GBA 2,5/24 Renault Midlum 300.14 DXi/WISS", 6]]],
            [".OSP Maków", "Maków", "ul. Raciborska 39, 47-480 Maków", 50.107312, 18.084928, true, [["567[S]27", "SLRr VW Crafter", 6], ["567[S]28", "GBA-Rt 3,5/2,5 Volvo FL320/ŁPSP", 6]]],
            [".OSP Krowiarki", "Krowiarki", "ul. Wyzwolenia 24, 47-494 Krowiarki", 50.136128, 18.080229, true, [["567[S]24", "GBA-Rt 3,3/16 Renault G230/Camiva", 6], ["567[S]25", "GLBM 0,3/12/0,5 Volkswagen Crafter/PERFEKT", 6]]],
            [".OSP Kornice", "Kornice", "ul. Główna 5A, 47-480 Kornice", 50.092251, 18.106718, true, [["567[S]77", "GCBA 6/32 Jelcz 325/Osiny", 4]]],
            [".OSP KSRG Pietrowice Wielkie", "Pietrowice Wielkie", "ul. Nowa 6, 47-480 Pietrowice Wielkie", 50.085175, 18.092074, true, [["569[S]25", "GCBA 7/50 Scania P450XT/Szczęśniak", 6], ["569[S]26", "GLBM-Rt 0,5/0,3 MAN TGE 3.180/Dragon", 6], ["569[S]27", "GCBA 5/24 Mercedes 1622/Metz", 3]]],
            [".OSP KSRG Cyprzanów", "Cyprzanów", "ul. Janowska 31, 47-480 Cyprzanów", 50.071246, 18.117088, true, [["569[S]55", "GBA-Rt 3/16 Volvo FL 280/Bocar", 6], ["569[S]56", "GBA 2,4/16 Mercedes-Benz 1017/Ziegler", 6]]],
            [".OSP Lekartów", "Lekartów", "ul. Raciborska 14, 47-475 Lekartów", 50.067465, 18.141230, true, [["567[S]73", "GBA 1,8/16 Magirus", 6]]],
            [".OSP Samborowice", "Samborowice", "ul. Szkolna 3, 47-470 Samborowice", 50.059513, 18.124032, true, [["567[S]29", "GBA 3/16 Renault G230/Camiva", 6]]],
            [".OSP Gródczanki", "Gródczanki", "ul. Wiejska 15, 47-480 Gródczanki", 50.067420, 18.052548, true, [["567[S]75", "GLBM 0,4/13 Volkswagen T6/Strażak Sam", 6]]],
            [".OSP Gamów", "Gamów", "ul. Długa 60, 47-411 Gamów", 50.137202, 18.125097, true, [["567[S]23", "GBA 3,5/27 Iveco Eurocargo ML150E28/PS Szczęśniak", 6]]],
            [".OSP KSRG Modzurów", "Modzurów", "ul. Słowackiego 16A, 47-415 Modzurów", 50.155872, 18.134075, true, [["569[S]22", "GBA-Rt 3/16 Volvo FL 280/Bocar", 6], ["569[S]23", "SLRt Ford Transit/Intex", 6]]],
            [".OSP Strzybnik", "Strzybnik", "ul. Słoneczna 11, 47-411 Strzybnik", 50.136162, 18.161847, true, [["567[S]17", "GBA 3,5/16 Kamaz 43265/Bocar", 6]]],
            [".OSP KSRG Rudnik", "Rudnik", "ul. Mickiewicza 2, 47-411 Rudnik", 50.126153, 18.187787, true, [["569[S]19", "GCBARt 5/32 Mercedes-Benz AXOR 1833 A/Bocar", 6], ["569[S]20", "GLBM Fiat Ducato", 6]]],
            [".OSP Brzeźnica", "Brzeźnica", "ul. Kozielska 32, 47-411 Brzeźnica", 50.148054, 18.227663, true, [["567[S]21", "GBA 3/16 Scania 93M 230/Camiva", 6]]],
            [".OSP Sławików", "Sławików", "ul. Strażacka 15, 47-417 Sławików", 50.184035, 18.220630, true, [["567[S]22", "GBA 3/20 Renault Midliner M220/GICAR", 6]]]
        ]
    },
    {
        id: "lubelski",
        name: "KM PSP Lublin / Powiat Lubelski",
        radioCallsign: "Lublin 998",
        desc: "Woj. lubelskie • KM PSP Lublin + jednostki OSP",
        voivodeship: "lubelskie",
        countyName: "pow. lubelski",
        mapCenter: [51.2465, 22.5684],
        bbox: "22.30,51.10,22.85,51.40",
        jrgList: ["JRG 1 Lublin", "JRG 2 Lublin", "JRG 3 Lublin", "JRG 4 Lublin", "JRG Bełżyce", "JRG Bychawa"],
        defaultTown: "Lublin",
        towns: [
            ["Lublin", "m. Lublin", 51.2465, 22.5684, [
                "ul. 1 Maja", "ul. 100-lecia KUL", "ul. 100-lecia praw wyborczych Polek", "ul. 11 Listopada", "ul. 3 Maja", "ul. Abelarda", "ul. Abrahama Sterna", "ul. Abramowicka", "ul. Adama Asnyka", "ul. Adama Kerstena", "ul. Adama Mickiewicza", "ul. Adolfa Dygasińskiego", "ul. Agaty", "ul. Agrestowa", "ul. Agronomiczna", "ul. Akacjowa", "ul. Akademicka", "ul. Aksini", "ul. Al. generała Władysława Sikorskiego", "ul. Al. Wincentego Witosa", "ul. al. Władysława Andersa", "ul. Aleja Jana Długosza", "ul. Aleja Józefa Piłsudskiego", "ul. Aleja Kompozytorów Polskich", "ul. Aleja Kraśnicka", "ul. Aleja Marzeń", "ul. Aleja Mieczysława Smorawińskiego", "ul. Aleja Młodości", "ul. Aleja Róż", "ul. Aleja Solidarności", "ul. Aleja Spółdzielczości Pracy", "ul. aleja Stanisława Jasińskiego", "ul. aleja Tadeusza Mazowieckiego", "ul. Aleja Unii Lubelskiej", "ul. Aleja Warszawska", "ul. Aleje Racławickie", "ul. Aleje Tysiąclecia", "ul. Aleje Zygmuntowskie", "ul. Aleksandra Czekanowskiego", "ul. Aleksandra Fredry", "ul. Aleksandra Gierymskiego", "ul. Aleksandra Orłowskiego", "ul. Aleksandra Świętochowskiego", "ul. Aleksandra Zelwerowicza", "ul. Alojzego Grochowskiego", "ul. Altanowa", "ul. Ametystowa", "ul. Anastazego Suligowskiego", "ul. Andrzeja Struga", "ul. Anny Henryki Pustowójtówny", "ul. Anny Langfus", "ul. Anny Stanisławskiej", "ul. Anny Walentynowicz", "ul. Antoniego Jeziorańskiego", "ul. Antoniego Pączka", "ul. Antoniego Słomkowskiego", "ul. Antoniego Szczerbowskiego", "ul. Antoniny Grygowej", "ul. arch. Ignacego Kędzierskiego", "ul. Archidiakońska", "ul. Armii Krajowej", "ul. Aroniowa", "ul. Artura Grottgera", "ul. Azaliowa", "ul. Bagatela", "ul. Bajkowa", "ul. Balladyny", "ul. Baltazara Paśnikowskiego", "ul. Bandtkich", "ul. Bartnicza", "ul. Bartosza Głowackiego", "ul. Barwinkowa", "ul. Barwna", "ul. Baśniowa", "ul. Batalionów Chłopskich", "ul. Bazylianówka", "ul. Bażantowa", "ul. Beatrycze", "ul. Beliniaków", "ul. Bełżycka", "ul. Berberysowa", "ul. Bernarda Wapowskiego", "ul. Bernardyńska", "ul. Berylowa", "ul. Beskidzka", "ul. Betonowa", "ul. Biała", "ul. Białkowska Góra", "ul. Białostocka", "ul. Biedronki", "ul. Biernata z Lublina", "ul. Bieszczadzka", "ul. Biłgorajska", "ul. Biskupa Mariana Fulmana", "ul. Biskupie", "ul. Biskupińska", "ul. Blacharska", "ul. Bliska", "ul. Bluszczowa", "ul. bł. ks. Antoniego Zawistowskiego", "ul. bł. ks. Ignacego Kłopotowskiego", "ul. Bławatkowa", "ul. Błękitna", "ul. Bobrzan", "ul. Bociania", "ul. Boczna Lubomelskiej", "ul. Boczna Łęczyńskiej", "ul. Boczna Rusałki", "ul. Boczna Siewnej", "ul. Bogdanówka", "ul. Bohaterów Monte Cassino", "ul. Bohaterów Września", "ul. Bohdana Dobrzańskiego", "ul. Bolesława Chrobrego", "ul. Bolesława Leśmiana", "ul. Bolesława Liszkowskiego", "ul. Bolesława Prusa", "ul. Bolesława Sekutowicza", "ul. Bolesława Śmiałego", "ul. Borówkowa", "ul. Boryny", "ul. Botaniczna", "ul. Bór", "ul. Braci Krausse", "ul. Braci Rylskich", "ul. Braci Wieniawskich", "ul. Bramowa", "ul. Brata Alberta", "ul. Bratnia", "ul. Bronowicka", "ul. Browarna", "ul. Brylantowa", "ul. Bryńskiego", "ul. Brzoskwiniowa", "ul. Brzozowa", "ul. Budowlana", "ul. Budrysów", "ul. Bukietowa", "ul. Bukowa", "ul. Bukszpanowa", "ul. Bulwar im. Stanisława Zalewskiego", "ul. Bulwarowa", "ul. Bursaki", "ul. Bursztynowa", "ul. Bużan", "ul. Bystrzycka", "ul. Cedrowa", "ul. Ceglana", "ul. Celestyna Miklasińskiego", "ul. Ceramiczna", "ul. Cerkiewna", "ul. Chabrowa", "ul. Chełmska", "ul. Chemiczna", "ul. Chłodna", "ul. Chmielna", "ul. Choiny", "ul. Ciasna", "ul. Cicha", "ul. Cienista", "ul. Ciepła", "ul. Ciepłownicza", "ul. Cisowa", "ul. Cmentarna", "ul. Cukrownicza", "ul. Cyda", "ul. Cynamonowa", "ul. Cypriana Godebskiego", "ul. Cypriana Kamila Norwida", "ul. Cyprysowa", "ul. Cyrkoniowa", "ul. Cyrulicza", "ul. Czapla", "ul. Czechowska", "ul. Czeremchowa", "ul. Czereśniowa", "ul. Czernicowa", "ul. Czerniejowska", "ul. Czerwcowa", "ul. Czeska", "ul. Czesława Strzeszewskiego", "ul. Czesława Szczepańskiego", "ul. Czesława Zgorzelskiego", "ul. Czwartaków", "ul. Czwartek", "ul. Czysta", "ul. Daktylowa", "ul. Daliowa", "ul. Dąbrowicka", "ul. Dąbrowska", "ul. Dąbrówki", "ul. Dereniowa", "ul. Deszczowa", "ul. Dębowa", "ul. Diamentowa", "ul. Ditty", "ul. Dłotlice", "ul. Długa", "ul. Do Dysa", "ul. Dobra", "ul. Dojazdowa", "ul. Dolna 3 Maja", "ul. Dolna Panny Marii", "ul. Dominikańska", "ul. Dominowska", "ul. Doświadczalna", "ul. Dożynkowa", "ul. dr Aleksandra Jaworowskiego", "ul. Dr Józefa Sztajna", "ul. dr Wacława Lasockiego", "ul. Dra Gustawa Dolińskiego", "ul. Dra Kazimierza Jaczewskiego", "ul. Dra Witolda Chodźki", "ul. Dragonów", "ul. Drewniana", "ul. Droga Męczenników Majdanka", "ul. Dworcowa", "ul. Dworska", "ul. Dywizjonu 303", "ul. Dzbenin", "ul. Działkowa", "ul. Dzieci Zamojszczyzny", "ul. Dzierżawna", "ul. Dziesiąta", "ul. Dziewanny", "ul. Edwarda Dembowskiego", "ul. Edwarda Kołaczkowskiego", "ul. Edwarda Raczyńskiego", "ul. Edwarda Stachury", "ul. Edwarda Wojtasa", "ul. Edwarda Zwolskiego", "ul. Elektryczna", "ul. Elizy Orzeszkowej", "ul. Emancypantek", "ul. Emanuela Graffa", "ul. Emila Czaplińskiego", "ul. Emila Zegadłowicza", "ul. Emilii i Karola Wojtyłów", "ul. Emilii Plater", "ul. Energetyków", "ul. Erazma Plewińskiego", "ul. Eugeniusza Kwiatkowskiego", "ul. Eugeniusza Romera", "ul. Europejskiej Stolicy Młodzieży Lublin 2023", "ul. Ewalda Sasimowskiego", "ul. Ewangelicka", "ul. Ewy Szelburg-Zarembiny", "ul. Fabryczna", "ul. Fantastyczna", "ul. Faraona", "ul. Farbiarska", "ul. Farmaceutyczna", "ul. Faustyny Morzyckiej", "ul. Feliksa Araszkiewicza", "ul. Feliksa Bieczyńskiego", "ul. Feliksa Brodowskiego", "ul. Feliksa Nowowiejskiego", "ul. Feliksa Skubiszewskiego", "ul. Feliksa Strojnowskiego", "ul. Felin", "ul. Figowa", "ul. Filaretów", "ul. Filona", "ul. Fiołkowa", "ul. Firlejowska", "ul. Floriańska", "ul. Folwarczna", "ul. Forsycjowa", "ul. Franciszka Dionizego Kniaźnina", "ul. Franciszka Galery", "ul. Franciszka Grabowskiego", "ul. Franciszka Kleeberga", "ul. Franciszka Mireckiego", "ul. Franciszka Osiaka", "ul. Franciszka Raczkowskiego", "ul. Franciszka Salezego Jezierskiego", "ul. Franciszka Stefczyka", "ul. Franciszka Uhorczaka", "ul. Franciszka Zabłockiego", "ul. Franciszki Arnsztajnowej", "ul. Frezerów", "ul. Fryderyka Chopina", "ul. Furmańska", "ul. Gabrieli Zapolskiej", "ul. Gajowa", "ul. Gałęzowskich", "ul. Garbarska", "ul. Garncarska", "ul. Gawareckich", "ul. Gawronia", "ul. Gazowa", "ul. Gdańska", "ul. Gen. Bolesława Ducha", "ul. Gen. Józefa Zajączka", "ul. gen. Michała Kruka", "ul. Generała Augusta Fieldorfa", "ul. Generała Stanisława Skalskiego", "ul. Generała Witolda Urbanowicza", "ul. Geodetów", "ul. Gerberowa", "ul. Gęsia", "ul. Gilowa", "ul. Gliniana", "ul. Głęboka", "ul. Głogowa", "ul. Główna", "ul. Głuska", "ul. Gminna", "ul. Gnieźnieńska", "ul. Gołębia", "ul. Goplan", "ul. Gorczańska", "ul. Gospodarcza", "ul. Gościnna", "ul. Goździkowa", "ul. Górna", "ul. Górska", "ul. Grabowa", "ul. Gracjana Chmielewskiego", "ul. Granatowa", "ul. Graniczna", "ul. Granitowa", "ul. Grażyny", "ul. Grenadierów", "ul. Grodzka", "ul. Grunwaldzka", "ul. Gruszkowa", "ul. Grzybowa", "ul. Guliwera", "ul. Gustawa Daniłowskiego", "ul. Gustawa Morcinka", "ul. H. M. Sachsów", "ul. Hajdowska", "ul. Hamleta", "ul. Handlowa", "ul. Hanki Ordonówny", "ul. Harcerska", "ul. Harnasie", "ul. Heleny Dziubińskiej", "ul. Heleny Modrzejewskiej", "ul. Heloizy", "ul. Henryka Halickiego", "ul. Henryka Siemiradzkiego", "ul. Henryka Sienkiewicza", "ul. Henryka Wiercieńskiego", "ul. Henryka Wolińskiego", "ul. Herbowa", "ul. Hetmańska", "ul. Hiacyntowa", "ul. Hieronima Dekutowskiego", "ul. Hieronima Jawłowskiego", "ul. Hieronima Łopacińskiego", "ul. Hipoteczna", "ul. Honorowych Krwiodawców", "ul. Hrubieszowska", "ul. Hubalczyków", "ul. Hugo Kołłątaja", "ul. Husarska", "ul. Hutnicza", "ul. Idziego Radziszewskiego", "ul. Ignacego Czumy", "ul. Ignacego Daszyńskiego", "ul. Ignacego Domeyki", "ul. Ignacego Jana Paderewskiego", "ul. Ignacego Krasickiego", "ul. Ignacego Mościckiego", "ul. Ignacego Rzeckiego", "ul. Ignacego Solarza", "ul. Imbirowa", "ul. Inżynierska", "ul. Ireny Kosmowskiej", "ul. Ireny Sendlerowej", "ul. Irydiona", "ul. Irysowa", "ul. Iwana Pawłowa", "ul. Izabeli Czartoryskiej", "ul. Izabeli Sierakowskiej", "ul. Izerska", "ul. Izoldy", "ul. Jabłoniowa", "ul. Jacka Kuronia", "ul. Jacka Malczewskiego", "ul. Jacka Przybylskiego", "ul. Jacka Woronieckiego", "ul. Jagiellońska", "ul. Jagodowa", "ul. Jakuba Hałasa", "ul. Jakuba Jasińskiego", "ul. Jakubowska", "ul. Jałowcowa", "ul. Jana Barcickiego", "ul. Jana Chęcińskiego", "ul. Jana Ciepielewskiego", "ul. Jana Gilasa", "ul. Jana Igatowskiego", "ul. Jana Karola Chodkiewicza", "ul. Jana Karskiego", "ul. Jana Kasprowicza", "ul. Jana Kiepury", "ul. Jana Kilińskiego", "ul. Jana Kochanowskiego", "ul. Jana Kochanowskiego", "ul. Jana Lisa", "ul. Jana Markowskiego", "ul. Jana Matejki", "ul. Jana Pawła II", "ul. Jana Pocka", "ul. Jana Riabinina", "ul. Jana Samsonowicza", "ul. Jana Sapiehy", "ul. Jana Sawy", "ul. Jana Sobieskiego", "ul. Jana Śniadeckiego", "ul. Jana Śnieżyńskiego", "ul. Jana Turczynowicza", "ul. Janiny Porazińskiej", "ul. Janowska", "ul. Jantarowa", "ul. Janusza Korczaka", "ul. Janusza Krupskiego", "ul. Jarmarczna", "ul. Jarosława Iwaszkiewicza", "ul. Jarzębinowa", "ul. Jaskółcza", "ul. Jasna", "ul. Jaspisowa", "ul. Jastrzębia", "ul. Jaśminowa", "ul. Jaworowa", "ul. Jaworzniacy", "ul. Jemiołowa", "ul. Jemiołuszki", "ul. Jerzego de Tramecourta", "ul. Jerzego Kwiecińskiego", "ul. Jerzego Rudlickiego", "ul. Jerzego Szaniawskiego", "ul. Jesienna", "ul. Jesionowa", "ul. Jezuicka", "ul. Jeżynowa", "ul. Jodłowa", "ul. Józefa Bema", "ul. Józefa Chełmońskiego", "ul. Józefa Czapskiego", "ul. Józefa Dwernickiego", "ul. Józefa Elsnera", "ul. Józefa Franczaka \"Lalka\"", "ul. Józefa Hallera", "ul. Józefa Hauke-Bosaka", "ul. Józefa Ignacego Kraszewskiego", "ul. Józefa Jankowskiego", "ul. Józefa Korzeniowskiego", "ul. Józefa Kustronia", "ul. Józefa Lompy", "ul. Józefa Łobodowskiego", "ul. Józefa Mackiewicza", "ul. Józefa Molickiego", "ul. Józefa Pankiewicza", "ul. Józefa Piechoty", "ul. Józefa Poniatowskiego", "ul. Józefa Sowińskiego", "ul. Józefa Śliwińskiego", "ul. Józefa Toczyskiego", "ul. Józefata Barszczewskiego", "ul. Judyma", "ul. Juliana Falata", "ul. Juliana Ochockiego", "ul. Juliana Tuwima", "ul. Juliana Ursyna Niemcewicza", "ul. Julii", "ul. Juliusza Cezara", "ul. Juliusza Dudzińskiego", "ul. Juliusza Kleinera", "ul. Juliusza Kossaka", "ul. Juliusza Ligonia", "ul. Juliusza Słowackiego", "ul. Jurajska", "ul. Juranda", "ul. Jurka Bitschana", "ul. Jutrzenki", "ul. Kacza", "ul. Kaczeńcowa", "ul. Kajetana Cieszkowskiego", "ul. Kajetana Hryniewieckiego", "ul. Kajetana Koźmiana", "ul. Kalinowa", "ul. Kalinowszczyzna", "ul. Kaliska", "ul. Kameliowa", "ul. Kameralna", "ul. Kamienna", "ul. Kaprysowa", "ul. Kapucyńska", "ul. Karkonoska", "ul. Karmelicka", "ul. Karola Lipińskiego", "ul. Karola Namysłowskiego", "ul. Karola Olszewskiego", "ul. Karola Szymanowskiego", "ul. Karpacka", "ul. Kaskadowa", "ul. Kasztanowa", "ul. Kasztelańska", "ul. Kaszubska", "ul. Kawaleryjska", "ul. Kawia", "ul. Kazimiery Litwiniukowej", "ul. Kazimierza Andrzeja Jaworskiego", "ul. Kazimierza Bogdanowicza", "ul. Kazimierza Dulęby", "ul. Kazimierza Glińskiego", "ul. Kazimierza Jagiellończyka", "ul. Kazimierza Przerwy-Tetmajera", "ul. Kazimierza Pułaskiego", "ul. Kazimierza Tumidajskiego", "ul. Kazimierza Wielkiego", "ul. Kąkolowa", "ul. Kąpielowa", "ul. Kielecka", "ul. Kijańska", "ul. Klemensa Junoszy", "ul. Kleniewskich", "ul. Kleopatry", "ul. Kłosowa", "ul. Kmicica", "ul. Kmieca", "ul. Kminkowa", "ul. Kogucia", "ul. Kolorowa", "ul. Koło", "ul. Koncertowa", "ul. Konopnicka", "ul. Konradana Bielskiego", "ul. Konrada Staczyńskiego", "ul. Konrada Wallenroda", "ul. Konstantego Gałczyńskiego", "ul. Konstantego Józefa Rayskiego", "ul. Konstantynów", "ul. Konstruktorów", "ul. Konwaliowa", "ul. Koralowa", "ul. Kornela Makuszyńskiego", "ul. Korpusu Ochrony Pogranicza", "ul. Korzenna", "ul. Kosmonautów", "ul. Kosynierów", "ul. Kościelna", "ul. Kotlarska", "ul. Kowalska", "ul. Kozia", "ul. kpt. Władysława Raginisa", "ul. Krakowskie Przedmieście", "ul. Krańcowa", "ul. Kredowa", "ul. Kresowa", "ul. Krępiecka", "ul. Kręta", "ul. Krężnicka", "ul. Krochmalna", "ul. Krokusowa", "ul. Króla Rogera", "ul. Królewska", "ul. Królowej Bony", "ul. Królowej Jadwigi", "ul. Krótka", "ul. Krucza", "ul. Kruszynowa", "ul. Kryniczna", "ul. Krystaliczna", "ul. Kryształowa", "ul. Krzemieniecka", "ul. Krzemionki", "ul. Ks. Ludwika Zalewskiego", "ul. ks. Michała Słowikowskiego", "ul. ks. prałata Stanisław Roga", "ul. ks. Wincentego Granata", "ul. Ksawerego Dunikowskiego", "ul. Ksawerego Pruszyńskiego", "ul. Księdza Franciszka Blachnickiego", "ul. księdza Jana Wadowskiego", "ul. księdza Jerzego Popiełuszki", "ul. Księdza Mieczysława Brzozowskiego", "ul. Księdza Wojciecha Danielskiego", "ul. Księżycowa", "ul. Ku Farze", "ul. Ku Słońcu", "ul. Kujawska", "ul. Kukułcza", "ul. Kupiecka", "ul. Kurantowa", "ul. Kurpiowska", "ul. Kwarcowa", "ul. Kwiatowa", "ul. Kwiatów Polnych", "ul. Kwietniowa", "ul. Kwitnąca", "ul. Laskowa", "ul. Laurowa", "ul. Laury", "ul. Laury Kaufman", "ul. Lawendowa", "ul. Lawinowa", "ul. Lazurowa", "ul. Legendy", "ul. Legionowa", "ul. Leona Frankowskiego", "ul. Leona Urmowskiego", "ul. Leona Wyczółkowskiego", "ul. Leonarda", "ul. Leonarda Zub-Zdanowicza", "ul. Leopolda Okulickiego", "ul. Leopolda Staffa", "ul. Lesława Pagi", "ul. Leszczynowa", "ul. Leszka", "ul. Leszka Czarnego", "ul. Leśna", "ul. Letnia", "ul. Letniskowa", "ul. Lędzian", "ul. Liliowa", "ul. Limbowa", "ul. Lipniak", "ul. Lipowa", "ul. Lipska", "ul. Lisia", "ul. Lotnicza", "ul. Lubartowska", "ul. Lubczykowa", "ul. Lubelskich Olimpijczyków", "ul. Lubelskiego Lipca '80", "ul. Lubomelska", "ul. Lubuszan", "ul. Ludomira Michała Rogowskiego", "ul. Ludowa", "ul. Ludwika Hirszfelda", "ul. Ludwika Spiessa", "ul. Ludwika Zamenhofa", "ul. Lutowa", "ul. Lwowska", "ul. Łabędzia", "ul. Łagiewnicka", "ul. Łanowa", "ul. Łazienkowska", "ul. Łąkowa", "ul. Łęczyńska", "ul. Łomżyńska", "ul. Łowicka", "ul. Łubinowa", "ul. Łukasza Rodakiewicza", "ul. Łukowska", "ul. Łuszczkowa", "ul. Łużyczan", "ul. Łysakowska", "ul. Macieja Rataja", "ul. Macierzanki", "ul. Magdaleny Brzeskiej", "ul. Magnoliowa", "ul. Majdan Tatarski", "ul. Majdanek", "ul. Majerankowa", "ul. Makowa", "ul. Maksymiliana Chmielarczyka", "ul. Malinowa", "ul. Malwowa", "ul. Małgorzaty Szewczyk", "ul. Małopolska", "ul. Marcowa", "ul. Margaret Thatcher", "ul. Mariana Dubieckiego", "ul. Mariana Langiewicza", "ul. Mariana Rapackiego", "ul. Mariana Smoluchowskiego", "ul. Mariańska", "ul. Marii Curie-Skłodowskiej", "ul. Marii Koryznowej", "ul. Marii Kuncewiczowej", "ul. Marii Ronikerowej", "ul. Marii Świtalskiej", "ul. Marii Urban-Mieszkowskiej", "ul. Marii Walciszewskiej", "ul. Marzanny", "ul. Masarska", "ul. Maszynowa", "ul. Matki Teresy z Kalkuty", "ul. Maurycego Mochnackiego", "ul. Mazowiecka", "ul. Mazurska", "ul. Medalionów", "ul. Melomanów", "ul. Mełgiewska", "ul. Metalurgiczna", "ul. Mgielna", "ul. Mieczykowa", "ul. Mieczysława Biernackiego", "ul. Mieczysława Jastruna", "ul. Mieczysława Karłowicza", "ul. Mieczysława Romanowskiego", "ul. Mieczysława Stelmasiaka", "ul. Mieczysławy Ćwiklińskiej", "ul. Miedziana", "ul. Miernicza", "ul. Mieszczanka", "ul. Mieszka I", "ul. Miętowa", "ul. Migdałowa", "ul. Mikołaja Kopernika", "ul. Mikołaja Pajdowskiego", "ul. Mikołaja Reja", "ul. Milczan", "ul. Milenijna", "ul. Miła", "ul. Miłorzębowa", "ul. Mineralna", "ul. Miodowa", "ul. Mirosława Dereckiego", "ul. Mirtowa", "ul. Misjonarska", "ul. mjr Mariana Gołębiewskiego", "ul. Młodej Polski", "ul. Młodzieńcza", "ul. Młyńska", "ul. Modra", "ul. Modrzewiowa", "ul. Montażowa", "ul. Morawian", "ul. Morelowa", "ul. Morsztynów", "ul. Morwowa", "ul. Most 700-lecia Lublina", "ul. Most im. Prezydenta RP Ryszarda Kaczorowskiego", "ul. Most Mariana Lutosławskiego", "ul. Motorowa", "ul. Motylowa", "ul. Mrówcza", "ul. Muzyczna", "ul. Na Stoku", "ul. Nad Zalewem", "ul. Nadbystrzycka", "ul. Nadłączna", "ul. Nadrzeczna", "ul. Nadstawna", "ul. Naftowa", "ul. Nagietkowa", "ul. Nałęczowska", "ul. Nałkowskich", "ul. Narcyzowa", "ul. Narcyzy Żmichowskiej", "ul. Narzędziowa", "ul. Nasturcjowa", "ul. Nasutowska", "ul. Nataszy", "ul. Nefrytowa", "ul. Nektarowa", "ul. Niccolo Paganiniego", "ul. Niecała", "ul. Niepodległości", "ul. Niezapominajki", "ul. Niska", "ul. Nizinna", "ul. Notarialna", "ul. Nowogródzka", "ul. Nowomiejska", "ul. Noworybna", "ul. Nowy Plac Targowy", "ul. Nowy Rynek", "ul. Nowy Świat", "ul. Obrońców Lublina", "ul. Obrońców Pokoju", "ul. Obywatelska", "ul. Ochotnicza", "ul. Odległa", "ul. Odlewnicza", "ul. Ofelii", "ul. Ofiar Katynia", "ul. Ogrodowa", "ul. Ogródkowa", "ul. Okopowa", "ul. Okólna", "ul. Olchowa", "ul. Olejna", "ul. Oliwkowa", "ul. Olszyńska", "ul. Olszynowa", "ul. Oniegina", "ul. Onyksowa", "ul. Opalowa", "ul. Operowa", "ul. Opolan", "ul. Opolska", "ul. Oratoryjna", "ul. Organowa", "ul. Orla", "ul. Orlanda", "ul. Orląt Lwowskich", "ul. Orna", "ul. Orzechowa", "ul. Osikowa", "ul. Oskara Kolberga", "ul. Osmolicka", "ul. Otella", "ul. Owocowa", "ul. Palmowa", "ul. Pana Balcera", "ul. Pana Tadeusza", "ul. Pana Wołodyjowskiego", "ul. Pancerniaków", "ul. Paprociowa", "ul. Parafialna", "ul. Parczewska", "ul. Park Jana Pawła II", "ul. Park Rury im. urbanisty Romualda Dylewskiego", "ul. Parkowa", "ul. Partyzantów", "ul. Parysa", "ul. Paryska", "ul. Pasieczna", "ul. Pasterska", "ul. Pawia", "ul. Pawła Konrada", "ul. Pawła Parady", "ul. PCK", "ul. Pejzażowa", "ul. Pelagii Majewskiej", "ul. Peoniowa", "ul. Peowiaków", "ul. Pergolowa", "ul. Perlicza", "ul. Perłowa", "ul. Piaskowa", "ul. Piastowska", "ul. Piekarska", "ul. Pielęgniarek", "ul. Pielgrzymia", "ul. Pienińska", "ul. Piękna", "ul. Pigwowa", "ul. pilota Eugeniusza Kasprzaka", "ul. Piotra Michałowskiego", "ul. Piotra Ściegiennego", "ul. Piotra Wysockiego", "ul. Pistacjowa", "ul. Plac Boboli", "ul. Plac Bychawski", "ul. Plac Dworcowy", "ul. Plac im. Marii Curie-Skłodowskiej", "ul. Plac Izaaka Singera", "ul. Plac Józefa Czechowicza", "ul. Plac Króla Władysława Łokietka", "ul. Plac Lecha Kaczyńskiego", "ul. Plac Litewski", "ul. Plac Mieczysława Alberta Krąpca", "ul. Plac Obrońców Lublina", "ul. Plac Ofiar Getta", "ul. Plac Po Farze", "ul. Plac Wolności", "ul. Plac Zamkowy", "ul. Plac Zygmunta Balickiego", "ul. Placowa", "ul. Plagego i Łaskiewicza", "ul. Platanowa", "ul. Plażowa", "ul. Plebańska", "ul. Pliszczyńska", "ul. płk Marcina Borelowskiego", "ul. płk Stanisława Nowickiego", "ul. płk. Władysława Rokickiego", "ul. Pochyła", "ul. Początkowa", "ul. Pocztowa", "ul. Pod Gajem", "ul. Podchorążych", "ul. Podhalańska", "ul. Podkomorska", "ul. Podlaska", "ul. Podleśna", "ul. Podwale", "ul. Podzamcze", "ul. Pogodna", "ul. Polan", "ul. Poli Gojawiczyńskiej", "ul. Poligonowa", "ul. Polna", "ul. Poloniusza", "ul. Połabian", "ul. Połaniecka", "ul. Południowa", "ul. Pomorska", "ul. Ponikwoda", "ul. Poprzeczna", "ul. Por. Henryka Cybulskiego", "ul. Poranna", "ul. Porzeczkowa", "ul. Potok", "ul. Poturzyńska", "ul. Powojowa", "ul. Powstania Styczniowego", "ul. Powstańców Śląskich", "ul. Powstańców Warszawy", "ul. Poziomkowa", "ul. Poznańska", "ul. Pozytywistów", "ul. Północna", "ul. ppor. Jana Bołbotta", "ul. Prawiednicka", "ul. Prezydenta Gabriela Narutowicza", "ul. Prezydenta Ronalda Reagana", "ul. Prezydenta Teodora Gruella", "ul. Probostwo", "ul. prof. Andrzeja Waksmundzkiego", "ul. prof. Antoniego Gębali", "ul. prof. Ignacego Wośki", "ul. prof. Kazimierza Górskiego", "ul. prof. Włodzimierza Fijałkowskiego", "ul. prof. Zbigniewa Religi", "ul. Projektowa", "ul. Promienista", "ul. Prosta", "ul. Próżna", "ul. Prymasa Stefana Wyszyńskiego", "ul. Prząśniczki", "ul. Przechodnia", "ul. Przecznica", "ul. Przedwiośnie", "ul. Przejazd", "ul. Przejrzysta", "ul. Przelot", "ul. Przemysłowa", "ul. Przemysłowców Lubelskich", "ul. Przepiórcza", "ul. Przeskok", "ul. Przesmyk", "ul. Przy Bocznicy", "ul. Przy Stawie", "ul. Przygodna", "ul. Przyjacielska", "ul. Przyjaźni", "ul. Przymieszańska", "ul. Przytulna", "ul. Pszczela", "ul. Pszenna", "ul. Pszowian", "ul. Ptasia", "ul. Puchacza", "ul. Puławska", "ul. Radomska", "ul. Radości", "ul. Radzikowska", "ul. Radziwiłłowska", "ul. Radzyńska", "ul. Rafała Krajewskiego", "ul. Rajska", "ul. Raszyńska", "ul. Rąblowska", "ul. Rektora Henryka Raabego", "ul. Relaksowa", "ul. Represjonowanych Żołnierzy Górników", "ul. Resorowa", "ul. Rezedowa", "ul. Robotnicza", "ul. Rolna", "ul. Rolna Osada", "ul. Romana Dmowskiego", "ul. Romana Dmowskiego", "ul. Romana Śląskiego", "ul. Romana Żulińskiego", "ul. Romantyczna", "ul. Romea", "ul. Romualda Traugutta", "ul. Rondo 27 Wołyńskiej Dywizji Piechoty AK", "ul. Rondo bł. ks. bp. Władysława Gorala", "ul. Rondo bł. ks. Emilian Kowcza", "ul. Rondo gen. Leona Berbeckiego", "ul. Rondo generała Franciszka Kamińskiego", "ul. Rondo Lubelskiego Lipca '80", "ul. Rondo Metropolity Piotra Mohyły", "ul. Rondo Narodowych Sił Zbrojnych", "ul. Rondo Nauczycieli Tajnego Nauczania", "ul. Rondo Niezależnego Zrzeszenia Studentów", "ul. Rondo płk. Ryszarda J. Kuklińskiego", "ul. Rondo por. Mariana Mokrskiego", "ul. Rondo Wincentego Pola", "ul. Rondo Zrzeszenia Wolność i Niezawisłość", "ul. Rosy", "ul. Roślinna", "ul. Rotmistrza Witolda Pileckiego", "ul. Rotmistrza Witolda Pileckiego", "ul. Rowerowa", "ul. Rozdroże", "ul. Rozmarynowa", "ul. Rozstajna", "ul. Roztocze", "ul. Równa", "ul. Różana", "ul. Róży Wiatrów", "ul. Rubinowa", "ul. Ruciana", "ul. Rudnicka", "ul. Rumiankowa", "ul. Rusałka", "ul. Ruska", "ul. Rybna", "ul. Rycerska", "ul. Rymwida", "ul. Rynek", "ul. Rysia", "ul. Ryszarda Jankowskiego", "ul. Rzemieślnicza", "ul. Rzeszowska", "ul. Sadowa", "ul. Samotna", "ul. Sandomierska", "ul. Sarnia", "ul. Sasankowa", "ul. Sądecka", "ul. Sądowa", "ul. Sąsiedzka", "ul. Sebastiana Klonowica", "ul. Sekwojowa", "ul. Serdeczna", "ul. Seweryna Sierpińskiego", "ul. Sielankowa", "ul. Sielska", "ul. Sienna", "ul. Sieroca", "ul. Sierpniowa", "ul. Siewierzan", "ul. Siewna", "ul. Siostry Bożeny Szerwentke", "ul. Skalista", "ul. Skautów", "ul. Skibińska", "ul. Skierki", "ul. Składowa", "ul. Skołuby", "ul. Skośna", "ul. Skowronkowa", "ul. Skrajna", "ul. Skromna", "ul. Skryta", "ul. Skrzatów", "ul. Skrzetuskiego", "ul. Skrzynicka", "ul. Skrzypcowa", "ul. Skwer adw. Stanisława Kalinowskiego", "ul. Skwer arch. T. Witkowskiego", "ul. Skwer Arcybiskupa Józefa Życińskiego", "ul. Skwer Borowiczan", "ul. Skwer Dzieci z Pahiatua", "ul. Skwer Grażyny Chrostowskiej", "ul. Skwer Ofiar Wołynia", "ul. Skwer Tarasa Szewczenki", "ul. Sławin", "ul. Sławinek", "ul. Sławinkowska", "ul. Słodowa", "ul. Słoneczna", "ul. Słonecznikowa", "ul. Słowian", "ul. Słowicza", "ul. Słupian", "ul. Słupkowa", "ul. Smolna", "ul. Smyczkowa", "ul. Snopkowska", "ul. Sobótki", "ul. Sokola", "ul. Sokolniki", "ul. Solna", "ul. Sołecka", "ul. Sosnowa", "ul. Sowa", "ul. Sójk", "ul. Spacerowa", "ul. Spadochroniarzy", "ul. Spadowa", "ul. Spokojna", "ul. Sportowa", "ul. Sportowców", "ul. Spółdzielcza", "ul. Sprawiedliwych Wśród Narodów Świata", "ul. Stadionowa", "ul. Stalowa", "ul. Stanisława Arcta", "ul. Stanisława Brzóski", "ul. Stanisława Dubois", "ul. Stanisława i Witolda Łokuciewskich", "ul. Stanisława Jachowicza", "ul. Stanisława Konarskiego", "ul. Stanisława Lema", "ul. Stanisława Leszczyńskiego", "ul. Stanisława Maczka", "ul. Stanisława Magierskiego", "ul. Stanisława Mikołajczyka", "ul. Stanisława Moniuszki", "ul. Stanisława Moskalewskiego", "ul. Stanisława Orzechowskiego", "ul. Stanisława Piątkowskiego", "ul. Stanisława Ptaszyckiego", "ul. Stanisława Serwaczyńskiego", "ul. Stanisława Staszica", "ul. Stanisława Szpinalskiego", "ul. Stanisława Węglarza", "ul. Stanisława Wyspiańskiego", "ul. Stanisława Żółkiewskiego", "ul. Startowa", "ul. Stary Gaj", "ul. Stefana Banacha", "ul. Stefana Batorego", "ul. Stefana Czarnieckiego", "ul. Stefana Kisielewskiego", "ul. Stefana Lelka-Sowy", "ul. Stefana Okrzei", "ul. Stefana Roweckiego", "ul. Stefana Skoczylasa", "ul. Stefana Żeromskiego", "ul. Stefanii Sempołowskiej", "ul. Stokrotki", "ul. Stolarska", "ul. Storczykowa", "ul. Strażacka", "ul. Stroma", "ul. Strumykowa", "ul. Strusia", "ul. Strzelecka", "ul. Sucha", "ul. Sudecka", "ul. Sulisławicka", "ul. Sybiraków", "ul. Symborówka", "ul. Symfoniczna", "ul. Sympatyczna", "ul. Szafirowa", "ul. Szafranowa", "ul. Szambelańska", "ul. Szańcowa", "ul. Szarotkowa", "ul. Szarych Szeregów", "ul. Szaserów", "ul. Szczecińska", "ul. Szczęśliwa", "ul. Szczygła", "ul. Szczytowa", "ul. Szerokie", "ul. Szewska", "ul. Szklana", "ul. Szklarniana", "ul. Szkolna", "ul. Szmaragdowa", "ul. Szpacza", "ul. Szwajcarska", "ul. Szwedzka", "ul. Szwejka", "ul. Szwoleżerów", "ul. Szymona Piotrowskiego", "ul. Szymona Szymonowica", "ul. Śląska", "ul. Ślęzan", "ul. Śliska", "ul. Śliwkowa", "ul. Ślusarska", "ul. Środkowa", "ul. Św. Magdaleny", "ul. Św. Wojciecha", "ul. Światowida", "ul. Światowych Dni Młodzieży 2016", "ul. Świdnicka", "ul. Świerkowa", "ul. Świetlista", "ul. Świeża", "ul. Świętoduska", "ul. Świętokrzyska", "ul. Świtezianka", "ul. Tadeusza Błońskiego", "ul. Tadeusza Boya-Żeleńskiego", "ul. Tadeusza Brezy", "ul. Tadeusza Dymowskiego", "ul. Tadeusza Grodzickiego", "ul. Tadeusza Jacyny-Onyszkiewicza", "ul. Tadeusza Karszo-Siedlewskiego", "ul. Tadeusza Kościuszki", "ul. Tadeusza Krwawicza", "ul. Tadeusza Kutrzeby", "ul. Tadeusza Piskora", "ul. Tadeusza Rejtana", "ul. Tadeusza Szeligowskiego", "ul. Tarasowa", "ul. Targowa", "ul. Tarninowa", "ul. Tatarakowa", "ul. Tatarska", "ul. Tatiany", "ul. Teatralny", "ul. Techniczna", "ul. Teodora Leszetyckiego", "ul. Teodora Lipeckiego", "ul. Tęczowa", "ul. Tokarska", "ul. Tomasza Strzembosza", "ul. Tomasza Zana", "ul. Topazowa", "ul. Topolowa", "ul. Torowa", "ul. Towarowa", "ul. Tristana", "ul. Truskawkowa", "ul. Trześniowska", "ul. Tulipanowa", "ul. Turkusowa", "ul. Turniowa", "ul. Turystyczna", "ul. Tymiankowa", "ul. Tyszowiecka", "ul. Ułanów", "ul. Unicka", "ul. Uniwersytecka", "ul. Uprawna", "ul. Urocza", "ul. Urodajna", "ul. Urzędowska", "ul. Ustronie", "ul. Ustronna", "ul. Uśmiechu", "ul. Vetterów", "ul. Wacława Bajkowskiego", "ul. Wacława Gralewskiego", "ul. Wacława Moritza", "ul. Wacława Rogińskiego", "ul. Wacława Sieroszewskiego", "ul. Wajdeloty", "ul. Walecznych", "ul. Walerego Wróblewskiego", "ul. Waleriana Łukasińskiego", "ul. Wałowa", "ul. Wandy", "ul. Wapienna", "ul. Warmińska", "ul. Watykańska", "ul. Wawrzynowa", "ul. Wądolna", "ul. Wąwozowa", "ul. Wąwóz Modesta Sękowskiego", "ul. Wertera", "ul. Wesoła", "ul. Westerplatte", "ul. Weteranów", "ul. Wędrowna", "ul. Węglinek", "ul. Węglowa", "ul. Wiązowa", "ul. Widok", "ul. Wiejska", "ul. Wielka", "ul. Wielkopolska", "ul. Wieniawska", "ul. Wiertnicza", "ul. Wierzbowa", "ul. Wigilijna", "ul. Wiklinowa", "ul. Wiktora Ziółkowskiego", "ul. Wiktoryn", "ul. Wilcza", "ul. Wilczopolska", "ul. Wileńska", "ul. Wilhelma Hessa", "ul. Wilhelma Orlika Ruckemana", "ul. Willowa", "ul. Wiosenna", "ul. Wirowa", "ul. Wiślan", "ul. Wiśniowa", "ul. Wita Stwosza", "ul. Witolda Klepackiego", "ul. Władysława Bartoszewskiego", "ul. Władysława Broniewskiego", "ul. Władysława Cholewy", "ul. Władysława Czarkowskiego", "ul. Władysława Grabskiego", "ul. Władysława Jagiełły", "ul. Władysława Kunickiego", "ul. Władysława Olechnowicza", "ul. Władysława Orkana", "ul. Władysława Petrykiewicza", "ul. Władysława Raczkiewicza", "ul. Władysława Ruckiego", "ul. Władysława Stanisława Reymonta", "ul. Władysława Warneńczyka", "ul. Włościańska", "ul. Wodna", "ul. Wodopojna", "ul. Wojciecha Bogusławskiego", "ul. Wojciecha Kilara", "ul. Wojciecha Kiwerskiego", "ul. Wojciecha Korfantego", "ul. Wojciecha Oczki", "ul. Wojciecha Sieciecha", "ul. Wojciecha Żywnego", "ul. Wojciechowska", "ul. Wojenna", "ul. Wojewódzińska", "ul. Wokulskiego", "ul. Wolska", "ul. Wołynian", "ul. Wołyńska", "ul. Wólczańska", "ul. Wrocławska", "ul. Wrońska", "ul. Wrotkowska", "ul. Wróbla", "ul. Wrzosowa", "ul. Wschodnia", "ul. Wspólna", "ul. Wygodna", "ul. Wygon", "ul. Wysoka", "ul. Wyścigowa", "ul. Wyzwolenia", "ul. Wyżynna", "ul. Zabytkowa", "ul. Zachodnia", "ul. Zaciszna", "ul. Zadębie", "ul. Zagajnikowa", "ul. Zagłoby", "ul. Zagonowa", "ul. Zagrodna", "ul. Zakątek", "ul. Zakładowa", "ul. Zakole", "ul. Zakopiańska", "ul. Zakręt", "ul. Zamkowa", "ul. Zamojska", "ul. Zaułek Hartwigów", "ul. Zaułek Władysława Panasa", "ul. Zawieprycka", "ul. Zawilcowa", "ul. Zbigniewa Herberta", "ul. Zbigniewa Hołdy", "ul. Zbożowa", "ul. Zdrojowa", "ul. Zdrowa", "ul. Zdzisława Jamróżka", "ul. Zdzisława Papierkowskiego", "ul. Zemborzycka", "ul. Zenona Kononowicza", "ul. Zesłańców Sybiru", "ul. Zgodna", "ul. Zielna", "ul. Zielona", "ul. Zielone Wzgórze", "ul. Ziemiańska", "ul. Ziemowita", "ul. Zimna", "ul. Zimowa", "ul. Ziołowa", "ul. Złota", "ul. Zofii Pelczarskiej", "ul. Zofii Zagrobskiej", "ul. Zorza", "ul. Zuchów", "ul. Związkowa", "ul. Zwycięska", "ul. Zygmunta Augusta", "ul. Zygmunta Klukowskiego", "ul. Zygmunta Krasińskiego", "ul. Zygmunta Noskowskiego", "ul. Zygmunta Starego", "ul. Źródlana", "ul. Żarnowiecka", "ul. Żeglarska", "ul. Żelazna", "ul. Żelazowej Woli", "ul. Żmigród", "ul. Żniwna", "ul. Żołnierska", "ul. Żołnierzy Niepodległej", "ul. Żonkilowa", "ul. Żurawia", "ul. Żurawinowa", "ul. Żwirki i Wigury", "ul. Żytnia", "ul. Żywiecka"]],
// Gm. Jastków
["Jastków", "gm. Jastków", 51.31044709714943, 22.439648308143468, ["ul. Baśniowa","ul. Lawendowe Wzgórze","ul. Leśna","ul. Na wzgórzu","ul. Radosna","ul. Wrzosowe Wzgórze"]],
["Panieńszczyzna", "gm. Jastków", 51.30538975970641, 22.43741314842188, ["ul. Chmielowa", "ul. Księżycowa", "ul. Lawendowa", "ul. Legionistów", "ul. Lubelska", "ul. Motylowa", "ul. Nadrzeczna", "ul. Pałacowe Wzgórze", "ul. Pocztowa", "ul. Poprzeczna", "ul. Przechodnia", "ul. Słoneczna", "ul. Spółdzielcza", "ul. Sympatyczna", "ul. Szkolna", "ul. Warszawska", "ul. Żołnierzy II AWP"]],
["Piotrawin", "gm. Jastków", 51.32445232634477, 22.429182260952583, ["ul. Widokowa"]],
["Snopków", "gm. Jastków", 51.30622666411855, 22.49004334674798, ["ul. Faceliowa", "ul. Klonowa", "ul. Kościelna", "ul. Lawendowa", "ul. Ogórkowa", "ul. Parkowa", "ul. Pastelowa", "ul. Południowa", "ul. Seledynowa", "ul. Szkolna", "ul. Widokowa"]],
["Barak", "gm. Jastków", 51.28463551129551, 22.467968833269545, []],
["Dąbrowica", "gm. Jastków", 51.27298105854361, 22.458655197220843, ["ul. Brzozowa", "ul. Działkowa", "ul. Fiołkowa", "ul. Firlejowska", "ul. Jaksy z Miechowa", "ul. Kolorowa", "ul. Konwaliowa", "ul. Kresowa", "ul. Krótka", "ul. Kwiatowa", "ul. Legionowa", "ul. Lipowa", "ul. Łąkowa", "ul. Magnoliowa", "ul. Makowa", "ul. Malinowa", "ul. Malownicza", "ul. Nałęczowska", "ul. Ogrodowa", "ul. Owocowa", "ul. Pejzażowa", "ul. Polna", "ul. Promienna", "ul. Prosta", "ul. Przyjazna", "ul. Pszeniczna", "ul. Różana", "ul. Skrajna", "ul. Słoneczna", "ul. Spacerowa", "ul. Szkolna", "ul. Środkowa", "ul. Ukośna", "ul. Uzdrowiskowa", "ul. Widokowa", "ul. Wierzbowa", "ul. Wiosenna", "ul. Wiśniowa", "ul. Wrzosowa", "ul. Zakole", "ul. Zwycięska", "ul. Żeglarska"]],
["Dębówka", "gm. Jastków", 51.27682322479799, 22.490491882451384, ["ul. Podleśna"]],
["Józefów - Pociecha", "gm. Jastków", 51.31980769295482, 22.404595351956704, []],
["Ługów", "gm. Jastków", 51.317300907897476, 22.315227019006407, []],
["Marysin", "gm. Jastków", 51.2909290333686, 22.509055446979332, ["ul. Akacjowa", "ul. Aksamitna", "ul. Amarantowa", "ul. Barwna", "ul. Błękitna", "ul. Brzozowa", "ul. Chmielna", "ul. Fiołkowa", "ul. Grafitowa", "ul. Granatowa", "ul. Herbaciana", "ul. Jaskrawa", "ul. Karmelowa", "ul. Karminowa", "ul. Kawowa", "ul. Kobaltowa", "ul. Kremowa", "ul. Lazurowa", "ul. Makowa", "ul. Malownicza", "ul. Miodowa", "ul. Mleczna", "ul. Muzyczna", "ul. Oliwkowa", "ul. Orzechowa", "ul. Pastelowa", "ul. Pąsowa", "ul. Perłowa", "ul. Platynowa", "ul. Purpurowa", "ul. Różana", "ul. Rubinowa", "ul. Rumiana", "ul. Słomkowa", "ul. Szarugi", "ul. Tęczowa", "ul. Turkusowa", "ul. Zielna", "ul. Ziemska", "ul. Złocista"]],
["Miłocin", "gm. Jastków", 51.266756741749084, 22.31662412025646, ["ul. Nałęczowska"]],
["Moszenki", "gm. Jastków", 51.3043711507264, 22.3573729554372, []],
["Moszna", "gm. Jastków", 51.28296012607664, 22.319257151604603, ["ul. Nałęczowska"]],
["Moszna Kolonia", "gm. Jastków", 51.28861683884876, 22.332823793646714, []],
["Natalin", "gm. Jastków", 51.29288093485294, 22.48627308038238, ["ul. Azaliowa", "ul. Czarowna", "ul. Finezyjna", "ul. Gwieździsta", "ul. Jodłowa", "ul. Kosmiczna", "ul. Lotna", "ul. Magiczna", "ul. Modrzewiowa", "ul. Niebiańska", "ul. Orbitalna", "ul. Oriona", "ul. Planetarna", "ul. Podleśna", "ul. Przyjazna", "ul. Satelitarna", "ul. Skrzydlata", "ul. Słoneczna", "ul. Szelestna", "ul. Szumiąca", "ul. Śniegówka", "ul. Śpiewna", "ul. Ziemska"]],
["Ożarów", "gm. Jastków", 51.29509461179654, 22.300131307760324, []],
["Płouszowice", "gm. Jastków", 51.26998656147193, 22.417091160797856, []],
["Płouszowice - Kolonia", "gm. Jastków", 51.267010478840874, 22.415281878597188, ["ul. Chmielna", "ul. imienia por. Antoniego Wszelakiego", "ul. Nałęczowska"]],
["Sieprawice", "gm. Jastków", 51.30445997419549, 22.396049415192753, []],
["Sieprawki", "gm. Jastków", 51.29830164528659, 22.380891953154613, []],
["Sługocin", "gm. Jastków", 51.30884469421537, 22.373145236989465, []],
["Smugi", "gm. Jastków", 51.33112783009105, 22.497374637454254, ["ul. Księżycowa"]],
["Tomaszowice", "gm. Jastków", 51.28187233847689, 22.368621279165353, []],
["Tomaszowice - Kolonia", "gm. Jastków", 51.275528021094146, 22.380258191221024, ["ul. Nałęczowska"]],
["Wysokie", "gm. Jastków", 51.31592305549182, 22.354300525486586, []],
// Gm. Garbów
["Garbów", "gm. Garbów", 51.355300230953006, 22.328314725177894, ["ul. Akacjowa", "ul. Chabrowa", "ul. Dolna", "ul. Głęboka", "ul. Gutanowska", "ul. Jarzębinowa", "ul. Kasztanowa", "ul. Kościelna", "ul. Kościelnisko", "ul. Krakowskie Przedmieście", "ul. Krańcowa", "ul. Leśna", "ul. Lipowa", "ul. Łabędzia", "ul. Łąkowa", "ul. Magnoliowa", "ul. Makowa", "ul. Malinowa", "ul. Młyńska", "ul. Parkowa", "ul. Perłowa", "ul. Piaskowa", "ul. Pogodna", "ul. Południowa", "ul. Północna", "ul. Różana", "ul. Rumiankowa", "ul. Słoneczna", "ul. Słowicza", "ul. Sosnowa", "ul. Spacerowa", "ul. Stawowa", "ul. Szkolna", "ul. św. Wojciecha", "ul. Tatarakowa", "ul. Warszawska", "ul. Widokowa", "ul. Wspólna", "ul. Wyżynna", "ul. Zacisze", "ul. Zawiszy Czarnego", "ul. Zielone Wzgórze"]],
["Bogucin", "gm. Garbów", 51.34396619202308, 22.36228467848334, []],
["Gutanów", "gm. Garbów", 51.342732249108906, 22.28934651708439, []],
["Borków", "gm. Garbów", 51.38277097214857, 22.3838622177461, []],
["Janów", "gm. Garbów", 51.38846083957677, 22.369274585466307, []],
["Karolin", "gm. Garbów", 51.35952076167669, 22.373804227011924, []],
["Piotrowice Wielkie", "gm. Garbów", 51.34525523690894, 22.4138684761486, []],
["Piotrowice - Kolonia", "gm. Garbów", 51.355153887813685, 22.417296886847257, []],
["Leśce", "gm. Garbów", 51.35319791115422, 22.393493336874666, []],
["Meszno", "gm. Garbów", 51.41016687435609, 22.38832282023031, []],
["Wola Przybysławska", "gm. Garbów", 51.40216613426946, 22.33261816427352, []],
["Zagrody", "gm. Garbów", 51.36395954841772, 22.298173768411512, []],
["Przybysławice", "gm. Garbów", 51.36960549492772, 22.28199795475752, []],
// Gm. Wólka
["Turka", "gm. Wólka", 51.286920709484754, 22.67851803988223, ["ul. Akacjowa", "ul. Berberysowa", "ul. Borówkowa", "ul. Brzozowa", "ul. Bukowa", "ul. Cisowa", "ul. Dębowa", "ul. Grabowa", "ul. Jagodowa", "ul. Jałowcowa", "ul. Jarzębinowa", "ul. Jaśminowa", "ul. Jaworowa", "ul. Jesionowa", "ul. Jeżynowa", "ul. Jodłowa", "ul. Kalinowa", "ul. Klonowa", "ul. Konwaliowa", "ul. Leszczynowa", "ul. Lipowa", "ul. Malinowa", "ul. Modrzewiowa", "ul. Olchowa", "ul. Poziomkowa", "ul. Sosnowa", "ul. Świerkowa", "ul. Topolowa", "ul. Wiązowa", "ul. Wierzbowa", "ul. Wrzosowa", "ul. Zawilcowa", "ul. Żurawinowa"]],
["Wólka", "gm. Wólka", 51.26473501500984, 22.638769979209087, []],
["Świdniczek", "gm. Wólka", 51.25996570601213, 22.647655330842742, []],
["Biskupie - Kolonia", "gm. Wólka", 51.258284502632954, 22.661521085211774, []],
["Świdnik Duży", "gm. Wólka", 51.25448801076552, 22.692719032542104, []],
["Kolonia Świdnik Mały", "gm. Wólka", 51.250311507602355, 22.676166788264073, []],
["Długie", "gm. Wólka", 51.274575912997065, 22.648815671690112, []],
["Rudnik", "gm. Wólka", 51.282601121770995, 22.611277519931484, []],
["Pliszczyn", "gm. Wólka", 51.301452559401206, 22.649558493793414, []],
["Łysaków", "gm. Wólka", 51.30045340036395, 22.66394109868774, []],
["Sobianowice", "gm. Wólka", 51.30276959944702, 22.687185712658373, []],
["Bystrzyca", "gm. Wólka", 51.30976290305661, 22.70338430301915, []],
["Jakubowice Murowane", "gm. Wólka", 51.27000477201332, 22.63494788350747, []],
["Kolonia Pliszczyn", "gm. Wólka", 51.297452052036235, 22.642210097920113, []],
["Łuszczów Pierwszy", "gm. Wólka", 51.302255832933554, 22.726613197648714, []],
["Łuszczów Drugi", "gm. Wólka", 51.291201047051, 22.73777921851825, []],
["Świdnik Mały", "gm. Wólka", 51.255488364297136, 22.681230351069008, []],
// Gm. Konopnica
["Konopnica", "gm. Konopnica", 51.219562877599095, 22.45335622558534, []],
["Kozubszczyzna", "gm. Konopnica", 51.22314242823724, 22.42835191315562, []],
["Lipniak", "gm. Konopnica", 51.24251544260733, 22.45363937557803, []],
["Marynin", "gm. Konopnica", 51.21496670612104, 22.428455039844255, []],
["Motycz", "gm. Konopnica", 51.23937783622615, 22.378393865907157, []],
["Motycz Leśny", "gm. Konopnica", 51.24091908228674, 22.352327456213345, []],
["Motycz - Józefin", "gm. Konopnica", 51.26095057821882, 22.378104239166518, []],
["Pawlin", "gm. Konopnica", 51.20502658778032, 22.353689845415623, []],
["Radawczyk Drugi", "gm. Konopnica", 51.18572792832361, 22.41146634079682, []],
["Radawiec Duży", "gm. Konopnica", 51.206640585882795, 22.386132225683898, []],
["Radawiec Mały", "gm. Konopnica", 51.19076568621551, 22.393050779208714, []],
["Sporniak", "gm. Konopnica", 51.23460134215425, 22.362622031467836, []],
["Stasin", "gm. Konopnica", 51.21193212430949, 22.478529147699643, []],
["Szerokie", "gm. Konopnica", 51.251038688478104, 22.473376255689708, []],
["Tereszyn", "gm. Konopnica", 51.200495869563035, 22.419968132818113, []],
["Uniszowice", "gm. Konopnica", 51.25280163083852, 22.441975490161063, []],
["Zemborzyce Dolne", "gm. Konopnica", 51.19046367849755, 22.4670886488781, []],
["Zemborzyce Podleśne", "gm. Konopnica", 51.198271933795716, 22.485418893132994, []],
["Zemborzyce Wojciechowskie", "gm. Konopnica", 51.17825415769393, 22.455277717296713, []],
// Gm. Niemce
["Niemce", "gm. Niemce", 51.36132739202353, 22.632468913689124, ["ul. Boczna", "ul. Centralna", "ul. Ceramiczna", "ul. Chmielna", "ul. Cicha", "ul. Głęboka", "ul. Graniczna", "ul. Ignacego Bonawentury Budnego", "ul. Kolejowa", "ul. Kościelna", "ul. Kręta", "ul. Kwiatowa", "ul. Leonów", "ul. Leśna", "ul. Lubelska", "ul. Ogrodowa", "ul. Orzechowa", "ul. Park im. Rodzin Budnych i Łosiów", "ul. Parkowa", "ul. Południowa", "ul. Prosta", "ul. Przemysłowa", "ul. Różana", "ul. Słoneczna", "ul. Spacerowa", "ul. Spokojna", "ul. Szklarniowa", "ul. Szkolna", "ul. Topolowa", "ul. Willowa", "ul. Włóki", "ul. Zielona"]],
["Wola Niemiecka", "gm. Niemce", 51.35846841452829, 22.608620581615146, []],
["Rudka Kozłowiecka", "gm. Niemce", 51.36187769059084, 22.591184174632993, []],
["Nasutów", "gm. Niemce", 51.36259397802264, 22.52950603622651, []],
["Nowy Staw", "gm. Niemce", 51.383086125949326, 22.55805986085558, []],
["Stoczek", "gm. Niemce", 51.367339904892816, 22.49424816308204, []],
["Stoczek - Kolonia", "gm. Niemce", 51.34598005792184, 22.52189856628714, []],
["Krasienin", "gm. Niemce", 51.360242007152024, 22.457083857628202, []],
["Krasienin - Kolonia", "gm. Niemce", 51.36765685086108, 22.469926938111595, []],
["Osówka", "gm. Niemce", 51.36398519959412, 22.449181490541857, []],
["Kawka", "gm. Niemce", 51.38691626571609, 22.469361253160848, []],
["Pryszczowa Góra", "gm. Niemce", 51.39500084319839, 22.45027429880994, []],
["Majdan Krasieniński", "gm. Niemce", 51.344538288533805, 22.45283380731938, []],
["Pólko", "gm. Niemce", 51.33209877951458, 22.557052058157144, []],
["Jakubowice Konińskie - Kolonia", "gm. Niemce", 51.32021465394913, 22.53120700138625, ["ul. Akacjowa", "ul. Berberysowa", "ul. Białych Brzóz", "ul. Brzozowa", "ul. Bukowa", "ul. Cedrowa", "ul. Cisowa", "ul. Cyprysowa", "ul. Dębina", "ul. Do Dysa", "ul. Gościniec", "ul. Hiacyntowa", "ul. Jodłowa", "ul. Kasztanowa", "ul. Kubusia Puchatka", "ul. Liliowa", "ul. Lubelska", "ul. Makowa", "ul. Modrzewiowa", "ul. Ogrodowa", "ul. Oleandra", "ul. Orzechowa", "ul. Plac Jakuba Konińskiego", "ul. Plac Św. Faustyny", "ul. Starowiejska", "ul. Stary Trakt", "ul. Storczykowa", "ul. Szkolna", "ul. Świerkowa", "ul. Widokowa", "ul. Wierzbowa", "ul. Wrzosowa", "ul. Zawilcowa"]],
["Jakubowice Konińskie", "gm. Niemce", 51.31234099478176, 22.536977438592665, ["ul. Agrestowa", "ul. Czeremchowa", "ul. Fiołkowa", "ul. Jarzębinowa", "ul. Jaśminowa", "ul. Kalinowa", "ul. Klonowa", "ul. Konwaliowa", "ul. Lawendowa", "ul. Lubelska", "ul. Malinowa", "ul. Miła", "ul. Morwowa", "ul. Nad Ciemęgą", "ul. Nowowiejska", "ul. Platanowa", "ul. Pogodna", "ul. Różana", "ul. Słoneczne Wzgórze", "ul. Stokrotki", "ul. Wichrowe Wzgórze", "ul. Widokowa", "ul. Zemborska", "ul. Zielone Wzgórze"]],
["Dys", "gm. Niemce", 51.31630339217817, 22.584278768932545, ["ul. Akacjowa", "ul. Bajkowa", "ul. Bernatówka", "ul. Biskupa Władysława Gorala", "ul. Brzozowa", "ul. Bukowa", "ul. Cyprysowa", "ul. Dolina Ciemęgi", "ul. Dworska", "ul. Gajowa", "ul. Graniczna", "ul. Jaśminowa", "ul. Jaworzniacy", "ul. Karmelicka", "ul. Klasztorna", "ul. Klonowa", "ul. Księżycowa", "ul. Kwiatowa", "ul. Lipowa", "ul. Lotników Polskich", "ul. Lubelska", "ul. Malinowa", "ul. Miodowa", "ul. Nadrzeczna", "ul. Ogrodowa", "ul. Polna", "ul. Południowa", "ul. Poprzeczna", "ul. Północna", "ul. Przyjazna", "ul. Rumiankowa", "ul. Samsonówka", "ul. Skośna", "ul. Skowronkowa", "ul. Słoneczna", "ul. Spacerowa", "ul. Spokojna", "ul. Topolowa", "ul. Wąwozowa", "ul. Widokowa", "ul. Wiśniowa", "ul. Zbożowa", "ul. Zielona", "ul. Złota", "ul. Źródlana"]],
["Ciecierzyn", "gm. Niemce", 51.31925328705057, 22.607590552689164, []],
["Elizówka", "gm. Niemce", 51.29427280984898, 22.579411623848234, ["ul. Ananasowa", "ul. Aroniowa", "ul. Barwinkowa", "ul. Bluszczowa", "ul. Borówkowa", "ul. Bylicowa", "ul. Cedrowa", "ul. Chabrowa", "ul. Cynamonowa", "ul. Daktylowa", "ul. Dereniowa", "ul. Elizówka", "ul. Goździkowa", "ul. Imbirowa", "ul. Irysowa", "ul. Jagodowa", "ul. Jałowcowa", "ul. Jaśminowa", "ul. Jemiołowa", "ul. Jeżynowa", "ul. Kminkowa", "ul. Kokosowa", "ul. Laurowa", "ul. Lawendowa", "ul. Limonkowa", "ul. Lubczykowa", "ul. Miętowa", "ul. Mirabelkowa", "ul. Morelowa", "ul. Nagietkowa", "ul. Nawłociowa", "ul. Oliwkowa", "ul. Pigwowa", "ul. Poziomkowa", "ul. Słoneczna", "ul. Szafranowa", "ul. Szałwiowa", "ul. Tymiankowa", "ul. Waniliowa", "ul. Żurawinowa"]],
["Łagiewniki", "gm. Niemce", 51.29885513135288, 22.604891348510172, []],
["Ludwinów", "gm. Niemce", 51.32501847346549, 22.620577184859997, []],
["Baszki", "gm. Niemce", 51.314300927620216, 22.630817679057287, []],
["Boduszyn", "gm. Niemce", 51.324967685315144, 22.642764922287466, []],
["Dziuchów", "gm. Niemce", 51.327705766545556, 22.65910412786923, []],
["Bystrzyca - Kolonia", "gm. Niemce", 51.32526597270649, 22.678739021828406, []]
        ],
        psp: [
            ["JRG 1 Lublin", "Lublin", "ul. Antoniego Szczerbowskiego 6, 20-012 Lublin", 51.23958397276713, 22.555679861890084, true, [
                ["301[L]21", "GBARt 2,5/16 Renault Trucks D16/MotoTruck", 5],
                ["301[L]22", "GBARt 3,5/16 Renault Range D16/MotoTruck", 5],
                ["301[L]25", "GCBA 5/32 MAN TGM 18.320/MotoTruck", 5],
                ["301[L]26", "GCBA 8,2/50 Scania P410/WISS", 3],
                ["301[L]51", "SD 42 Iveco Magirus 160E30/ Magirus", 2],
                ["301[L]43", "Renault Midlum 300DXi/ISS Wawrzaszek SRt", 2],
                ["301[L]60", "SCRChem Scania G500/Szczęśniak", 3],
                ["301[L]64", "SLRchem Mercedes-Benz Sprinter 319 CDI/ISS Wawrzaszek", 3],
                ["301[L]90", "SLRR Ford Ranger/Frank Cars", 1]
            ]],
            ["JRG 2 Lublin", "Lublin", "ul. Zemborzycka 94, 20-445 Lublin", 51.206376228811465, 22.56695551430396, true, [
                ["302[L]21", "GBA 3/30 Iveco Eurocargo 150-320/MotoTruck", 3],
                ["302[L]25", "GCBA 5/32 MAN TGM 18.320/Stolarczyk", 5],
                ["302[L]26", "GCBA 10/61 Scania P450 XT/Szczęśniak", 2],
                ["302[L]53", "SH 25 MAN TGL 12.240/Bumar-Koszalin", 2],
                ["302[L]43", "SCRt Scania G420CB/ISS Wawrzaszek", 2],
                ["302[L]55", "SLBus Ford Transit/Frank-Cars", 1],
                ["302[L]71", "SRWys Mercedes Benz Atego 1327 4x4/Bocar", 3],
                ["302[L]83", "SCKw Renault K440/Stolarczyk", 1],
                ["302[L]84", "SCKn Scania P450 XT/Szczęśniak", 1],
                ["302[L]91", "SLRr Isuzu D-Max", 1]
            ]],
            ["JRG 3 Lublin", "Lublin", "ul. Metalurgiczna 7, 20-200 Lublin", 51.23903881202467, 22.63776606897038, true, [
                ["303[L]21", "GBA 3/29 MAN TGM 13.290/MotoTruck", 3],
                ["303[L]25", "GCBA 5/32/4 Volvo FMX 380/Bocar", 5],
                ["303[L]53", "SHD-25 MAN TGM 15.290/WISS Bumar", 2],
                ["303[L]43", "SCRt Scania P460 XT/Szczęśniak", 2],
                ["303[L]48", "SCDź-40 Scania G450/WISS", 2],
                ["303[L]49", "SCRd Renault K520/Szczęśniak", 2],
                ["303[L]90", "SLBus Opel Vivaro", 1],
                ["303[L]91", "SLRR Ford Ranger/Frank Cars", 1]
            ]],
            ["JRG 4 Lublin", "Lublin", "ul. Stanisława Węglarza 4, 20-148 Lublin", 51.27072522647258, 22.577408249898753, true, [
                ["304[L]21", "GBARt 2,5/16 Renault Trucks D16/MotoTruck", 6],
                ["304[L]25", "GCBARt 5/32 MAN TGM 18.320/MotoTruck", 2],
                ["304[L]51", "SCD-37 Iveco Eurocargo 160E30/Magirus", 2],
                ["304[L]71", "SLRw Volkswagen Crafter", 2],
                ["304[L]72", "SRw Iveco Eurocargo 150E28/Szczęśniak", 2],
                ["304[L]91", "SLRr Isuzu", 1]
            ]],
            ["JRG Bełżyce", "Bełżyce", "ul. Ksiedza Biskupa Tomasza Wilczyńskiego 7, 24-200 Bełżyce", 51.17116157178525, 22.281457114302587, true, [
                ["305[L]21", "GBARt 3,5/16 Renault Range D16/MotoTruck", 5],
                ["305[L]25", "GCBA 5/38 Scania P410/WISS", 3],
                ["305[L]53", "SH 25 MAN TGL 12.240/Bumar-Koszalin", 1],
                ["305[L]81", "SLKw Ford Transit/Frank-Cars", 2],
                ["305[L]90", "SLRr Isuzu D-MAX", 1]
            ]],
            ["JRG Bychawa", "Bychawa", "ul. Armii Krajowej 2, 23-100 Bychawa", 51.01242580469097, 22.534273257983866, true, [
                ["306[L]21", "GBA 2,5/16 Iveco EuroCargo 150-320/PS Szczęśniak", 3],
                ["306[L]25", "GCBA 6/50 MAN TGM 18.320/Moto Truck", 5],
                ["306[L]53", "SHD-25 - MAN TGL 12.250/Bumar Koszalin", 1],
                ["306[L]81", "SLKw Ford Transit", 2],
                ["306[L]90", "SLOp Skoda octavia", 1]
            ]]
        ],
        osp: [
            [".OSP KSRG Babin", "Babin", "Babin 159A, 24-200 Babin", 51.170170309966004, 22.341526742357914, true, [["339[L]54", "GBA 2,5/25 MAN TGM 13.290/Stolarczyk", 6], ["339[L]56", "SLRt Ford Transit/Stolarczyk", 6]]],
            [".OSP KSRG Bełżyce", "Bełżyce", "Ksiedza Biskupa Tomasza Wilczyńskiego 7A, 24-200 Bełżyce", 51.17145750754837, 22.281845332575575, true, [["339[L]83", "GBA 2,5/25 MAN TGM 13.290/Stolarczyk", 6], ["339[L]95", "SD-31 Mercedes Benz/Metz", 3]]],
            [".OSP KSRG Borzechów", "Borzechów", "Borzechów 1, 24-224", 51.0907819495423, 22.282549602550237, true, [["339[L]07", "GBA-Rt 3/24 MAN TGM 13.290/Moto-Truck", 6], ["339[L]38", "SLKw Peugot Boxer", 6]]],
            [".OSP KSRG Chmiel", "Chmiel", "Chmiel Pierwszy 23, 23-114 Chmiel Pierwszy", 51.08760525179922, 22.695658703073825, true, [["339[L]82", "GBA 3/27 Scania P360/ WISS", 6]]],
            [".OSP KSRG Dragany", "Dragany", "Dragany 167, 23-145 Dragany", 50.88895247589527, 22.660386252753977, true, [["339[L]21", "GBA 2,5/25 MAN TGM 13.290/Stolarczyk", 6], ["339[L]20", "GBA 2,5/16 Star 244/JZS", 6]]],
            [".OSP KSRG Garbów", "Garbów", "Krakowskie Przedmieście 63, 21-080 Garbów", 51.3510572130496, 22.336811426487454, true, [["339[L]25", "GBA 3,5/30 Mercedes Benz Atego 1530/Bonex", 6], ["339[L]24", "GBA 2,5/16 Mercedes Benz Atego 1329/Bocar", 6], ["339[L]27", "SH-18 Star 200/Bumar-Koszalin", 2]]],
            [".OSP KSRG Kozubszczyzna", "Kozubszczyzna", "Kozubszczyzna 127B, 21-030 Kozubszczyzna", 51.22367796773349, 22.42749210899749, true, [["339[L]65", "GBARt 3/28 Renault Range D16/Szczęśniak", 6], ["339[L]64", "GLBM-Rt 3/3 Renault Master/BIBMOT", 6]]],
            [".OSP KSRG Krasienin", "Krasienin", "Krasienin-Kolonia 18a, 21-025 Krasienin-Kolonia", 51.36459830870726, 22.467736528344663, true, [["339[L]32", "GBARt 2,5/24 Man TGM 13.290/Stolarczyk", 6], ["339[L]94", "GLBM 0,2/0,5 Peugeot Boxer/Iuvo Cars", 6]]],
            [".OSP KSRG Maciejów Stary", "Maciejów Stary", "Maciejów Stary 45A, 23-145 Maciejów Stary", 50.90050619669896, 22.734971927593314, true, [["339[L]06", " GBARt 4/30 Renault D16/ MotoTruck", 6], ["339[L]08", "GBA 3/20 Renault G270/ Sides", 6]]],
            [".OSP KSRG Matczyn-Wojcieszyn", "Matczyn-Wojcieszyn", "Matczyn 25, 24-200 Matczyn", 51.20433133901405, 22.320365613383945, true, [["339[L]48", "GBARt 4,8/42 MAN TGM 18.320/Moto-Truck", 6], ["339[L]60", "GLBM Ford Transit/Frank Cars", 6]]],
            [".OSP KSRG Mętów", "Mętów", "Mętów 165, 20-388 Mętów", 51.14717947750697, 22.590693041054877, true, [["339[L]46", "GBA 4/24/4 MAN TGM 18.320/Szczęśniak", 6], ["339[L]51", "GBA 2,5/16 Volvo FL 290/PS Szczęśniak", 6], ["339[L]52", "Peugeot Boxer 335", 6]]],
            [".OSP KSRG Moszenki", "Moszenki", "Moszenki 5, 21-008 Moszenki", 51.303702894506344, 22.358298408672525, true, [["339[L]29", "GBARt 2,5/25 MAN TGM 13.290/Stolarczyk", 6], ["339[L]01", "GCBA 4,5/29 MAN TGM 18.320/Moto-Truck", 6], ["339[L]28", "SLBus Ford Transit Custom/Frank-Cars", 6], ["339[L]31", "SH-18 Star 200/BumarKoszalin", 2]]],
            [".OSP KSRG Nasutów", "Nasutów", "Nasutów 99 D, 21-025 Nasutów", 51.3626853428774, 22.530117686968016, true, [["339[L]41", "GBA-Rt 2,5/20 Mercedes-Benz", 6], ["339[L]42", "SH-18 Volvo FL6", 3]]],
            [".OSP KSRG Niedrzwica Kościelna", "Niedrzwica Kościelna", "Lipowa 32, 24-220 Niedrzwica Kościelna", 51.08475574948593, 22.361731117331708, true, [["339[L]47", "GBARt 2,5/28 Mercedes Benz Atego 1329 / MotoTruck", 6]]],
            [".OSP KSRG Niedrzwica Duża", "Niedrzwica Duża", "Lubelska 10, 24-220 Niedrzwica Duża", 51.112406467435314, 22.3874077615504, true, [["339[L]09", "GBA-Rt 3/24 MAN TGM 13.290/Moto-Truck", 6], ["339[L]10", "SLKw Ford Transit/Frank-Cars", 6]]],
            [".OSP KSRG Niemce", "Niemce", "Różana 10, 21-025 Niemce", 51.3603787073886, 22.623772657491028, true, [["339[L]30", "GBA 2,5/25 MAN TGM 13.290/Stolarczyk", 6], ["339[L]33", "SLBus Ford Transit/Frank-Cars", 6]]],
            [".OSP KSRG Piotrków", "Piotrków", "Piotrków Drugi 10, 23-114 Piotrków Drugi", 51.053439122960974, 22.62842693069839, true, [["339[L]18", "GCBA 5/36 Scania P380/ISS Wawrzaszek", 6]]],
            [".OSP KSRG Pawlin", "Pawlin", "Pawlin 27A, 21-030 Motycz", 51.19740924035124, 22.362054183736, true, [["339[L]45", "GBA 4/28 MAN TGM 18.320/Szczęśniak", 6], ["339[L]44", "GLM Ford Transit/Stolarczyk", 6]]],
            [".OSP KSRG Piotrowice", "Piotrowice", "Piotrowice 143, 23-107 Piotrowice", 51.08569091987645, 22.48332877924416, true, [["339[L]53", "GBA 2,5/16 MAN TGM 13.290/Stolarczyk", 6], ["339[L]14", "SLRt Ford Transit/BoCar", 6]]],
            [".OSP KSRG Płouszowice", "Płouszowice", "Płouszowice-Kolonia 131, 21-008 Płouszowice-Kolonia", 51.267534624344115, 22.414010125835354, true, [["339[L]66", "GBARt 3/16 Renault D14/Stolarczyk", 6]]],
            [".OSP KSRG Radawiec Duży", "Radawiec Duży", "Radawiec Duży 154, 21-030 Radawiec Duży", 51.20615543735089, 22.38634849164673, true, [["339[L]93", "GBARt 4/28 MAN TGM 18.320/Szczęśniak", 6]]],
            [".OSP KSRG Stara Wieś Druga", "Stara Wieś Druga", "68B, Stara Wieś Pierwsza, Stara Wieś Druga Pierwsza, 23-100", 50.94245907635892, 22.553985923295997, true, [["339[L]50", "GBA 2,5/16 MAN TGM 13.290/Stolarczyk", 6], ["339[L]11", "GCBA 6/32 Jelcz 004/JZS", 4]]],
            [".OSP KSRG Strzeszkowice Duże", "Strzeszkowice Duże", "24-220 Strzeszkowice Duże", 51.15471648019531, 22.40056163597355, true, [["339[L]34", "GCBA 5/32 Scania P360/Szczęśniak", 6], ["339[L]35", "SLKw Ford Transit/Frank-Cars", 6]]],
            [".OSP KSRG Świdnik Duży", "Świdnik Duży", "Świdnik Duży 48A, 20-258 Świdnik Duży", 51.25468606338316, 22.691361354822487, true, [["339[L]90", "GBARt Scania P360 3/32 WISS", 6], ["339[L]92", "GLBM-Rt 0,3/0,5 Volkswagen Crafter / Perfekt", 5]]],
            [".OSP KSRG Turka", "Turka", "Turka 124, 20-258 Turka", 51.290039758887026, 22.680184018620086, true, [["339[L]96", "GBA 4,2/16 Volvo FL280/Bocar", 6]]],
            [".OSP KSRG Wilczopole", "Wilczopole", "Wilczopole Kolonia 161B, 20-388 Wilczopole", 51.168389501239474, 22.644126706228032, true, [["339[L]59", "GBARt Scania P360/WISS", 6], ["339[L]70", "GCBA-Rt 7/45 MAN TGM 18.320/Stolarczyk", 6], ["339[L]63", "Renault Magnum SCCn", 2], ["339[L]58", "SD-30 Mercedes", 3], ["339[L]57", "SLRr Isuzu D-Max", 5]]],
            [".OSP KSRG Wojciechów", "Wojciechów", "Wojciechów 107, 24-204 Wojciechów", 51.23007012398404, 22.24707778164358, true, [["339[L]05", "GBARt 4,2/16 Volvo FL280/Bocar", 6]]],
            [".OSP KSRG Wojciechów Kolonia Pierwsza", "Wojciechów Kolonia Pierwsza", "Wojciechów-Kolonia Pierwsza 13, 24-204 Wojciechów-Kolonia Pierwsza", 51.235035072643576, 22.213827225812032, true, [["339[L]98", "GBARt 3/24 MAN TGM 13.290/Moto Truck", 6]]],
            [".OSP KSRG Wola Przybysławska", "Wola Przybysławska", "Wola Przybysławska 324, 21-080 Wola Przybysławska", 51.397925746755206, 22.329646604870273, true, [["339[L]62", "GBARt 3/16 Volvo FL 280/Bocar", 6], ["339[L]61", "GBA 2,5/16 Star 244/Moto Truck", 6]]],
            [".OSP KSRG Zakrzew", "Zakrzew", "Zakrzew 236, 23-155 Zakrzew", 50.88731759115839, 22.588077972186888, true, [["339[L]23", "GBA 4,4/4,5 MAN TGM 18.320/Stolarczyk", 6]]],
            [".OSP KSRG Żabia Wola", "Żabia Wola", "Pszczela Wola 8A, 23-107 Osmolice Pierwsze", 51.111373543877406, 22.501116447971235, true, [["339[L]81", "GBA-Rt 4,5/29 Man TGM 18.340/MotoTruck", 6], ["339[L]84", "SH-18 Star 200/Bumar", 2]]],
            [".OSP KSRG Żuków", "Żuków", "Żuków-Kolonia 58, 23-110 Żuków-Kolonia", 51.04213037806087, 22.785312618560525, true, [["339[L]40", "GBA 2,6/16 Mercedes Benz 1124AF/SCHLINGMANN", 9]]],
            [".OSP Konopnica", "Konopnica", "Konopnica 24A, 21-030 Konopnica", 51.2311704946784, 22.46273067803247, true, [["337[L]80", "GBA-Rt 2,5/16 MAN TGM 13.290/Stolarczyk", 6], ["337[L]82", "GLBM 0,8/02 Opel Movano/ IUVOcars", 5]]],
            [".OSP Jastków", "Jastków", "Jastków 67, 21-002", 51.317885202376935, 22.4410947341817, true, [["337[L]54", "GBA 3/28 Renault D16/Szczęśniak", 6], ["337[L]55", "SLBus Renault Trafic", 5]]],
            [".OSP Piotrowice Wielkie", "Piotrowice Wielkie", "Piotrowice Wielkie 47, 21-080 Piotrowice Wielkie", 51.34403830947209, 22.41032797045279, true, [["337[L]25", "GBA 2,5/20 Star 12.185/Stolarczyk", 6]]],
            [".OSP Jakubowice Konińskie - Kolonia", "Jakubowice Konińskie - Kolonia", "Lubelska 2, 21-003 Jakubowice Konińskie-Kolonia", 51.316595037471174, 22.535482811714218, true, [["337[L]50", "GBARt 3,5/27 MAN TGM 13.290/PUH Stolarczyk", 6]]],
            [".OSP Dys", "Dys", "Ogrodowa 8, 21-003 Dys", 51.31494504342334, 22.578934370853247, true, [["337[L]73", "GBARt 4,5/30 MAN TGM 18.320/MotoTruck", 6]]],
            [".OSP Bystrzyca", "Bystrzyca", "Bystrzyca 93, 20-258 Bystrzyca", 51.31036621863549, 22.707415126409877, true, [["338[L]61", "GCBA 5/40 MAN LE 18.280/Stolarczyk", 6]]],
            [".OSP Lublin - Głusk", "Lublin - Głusk", "20-387 Lublin", 51.191786543200536, 22.597497737863854, true, [["337[L]06", "GBA 2,5/25 MAN TGM 13.290/Stolarczyk", 6], ["337[L]03", "GLBA 0,3/0,8 RENAULT MASTER", 5], ["337[L]01", "SLBus Renault", 5]]],
            [".OSP Miłocin - Czajki", "Miłocin - Czajki", "Palikije Drugie 29A, 24-204 Palikije Drugie", 51.24756467880187, 22.3046303259807, true, [["338[L]70", "GCBA 4/34 MB Atego/Szczęśniak", 6], ["338[L]71", " SLKw Ford Transit", 6]]]
        ]
    }
];

const COUNTY_PROFILES = {};
RAW_PROFILES.forEach(rp => { COUNTY_PROFILES[rp.id] = unpackProfile(rp); });

const subtypesData = {
    "P": [
        "P - Inne pożary", "P - Instytucje, obiekty użyteczności publicznej", "P - Obiekty gospodarcze i inne rolnicze",
        "P - Obiekty magazynowe, place składowe", "P - Obiekty mieszkalne", "P - Obiekty produkcyjne, instalacje technologiczne",
        "P - Śmietniska, wysypiska", "P - Środki transportu drogowego (np. autobus)", "P - Środki transportu kolejowego",
        "P - Środki transportu lotniczego", "P - Środki transportu wodnego", "P - Trawy, torfowiska, lasy, pola, stogi"
    ],
    "MZ": [
        "Inne MZ", "MZ - Atmosferyczne", "MZ - Budowlane", "MZ - Chemiczne", "MZ - Drogowe", "MZ - Kolejowe",
        "MZ - Kolizja", "MZ - Lotnicze", "MZ - Wodne", "MZ - Palenie ognisk w miejscach niedozwolonych",
        "MZ - Podejrzenie podłożenia ładunku", "MZ - Pomoc innym służbom", "MZ - Pomoc Policji", "MZ - Pomoc PRM",
        "MZ - Pomoc w otwarciu mieszkania, podejrzenie zgonu", "MZ - Poszukiwanie osób zaginionych", "MZ - Próba samobójcza",
        "MZ - Sanitarno-epidemiologiczne", "MZ - Topienie się", "MZ - Wypadek", "MZ - Zabezpieczenie ładunku", "MZ - Zwierzęta"
    ],
    "AF": ["AF - Fałszywy z instalacji", "AF - Złośliwy", "AF - W dobrej wierze"],
    "CW": ["CW - Zagrożenie chemiczne", "CW - Zagrożenie ekologiczne"],
    "WG": ["WG - Wybuch gazu", "WG - Inne zagrożenie wybuchem"],
    "BL": ["BL - Budynek zagrożony zawaleniem"],
    "ZPR": ["ZPR - Zagrożenie promieniotwórcze"],
    "PZR": []
};

const callersMaleFirst = ["Jan", "Piotr", "Tomasz", "Michał", "Krzysztof", "Andrzej", "Paweł", "Marek", "Adam", "Łukasz", "Marcin", "Jakub", "Mateusz", "Wojciech", "Henryk", "Dawid", "Szymon", "Kamil", "Robert", "Rafał", "Jacek", "Grzegorz", "Dariusz", "Mariusz", "Zbigniew", "Sławomir", "Jarosław", "Mirosław", "Ryszard", "Tadeusz", "Artur", "Sebastian", "Patryk", "Damian", "Przemysław", "Maciej", "Bartosz", "Dominik", "Karol", "Filip", "Hubert", "Kacper", "Mikołaj", "Błażej", "Cezary", "Leszek", "Waldemar", "Roman", "Kazimierz", "Wiesław"];
const callersMaleLast = ["Kowalski", "Nowak", "Wiśniewski", "Wójcik", "Kowalczyk", "Kamiński", "Lewandowski", "Zieliński", "Szymański", "Woźniak", "Dąbrowski", "Kozłowski", "Jankowski", "Mazur", "Kwiatkowski", "Wojciechowski", "Krawczyk", "Kaczmarek", "Piotrowski", "Grabowski", "Zając", "Pawłowski", "Michalski", "Król", "Wieczorek", "Jabłoński", "Wróbel", "Nowakowski", "Majewski", "Olszewski", "Stępień", "Malinowski", "Jaworski", "Adamczyk", "Dudek", "Nowicki", "Pawlak", "Górski", "Witkowski", "Walczak", "Sikora", "Baran", "Rutkowski", "Michalak", "Szewczyk", "Ostrowski", "Tomaszewski", "Pietrzak", "Zalewski", "Wróblewski", "Kreft", "Formela", "Kwidziński", "Labuda", "Hirsz", "Damps", "Treder", "Gaffke", "Kunkel", "Rohde", "Bistram", "Bojke", "Ceynowa", "Dettlaff", "Gruba", "Kohnke", "Liedtke", "Miotk", "Płotka", "Richert"];
const callersFemaleFirst = ["Anna", "Katarzyna", "Magdalena", "Agnieszka", "Małgorzata", "Krystyna", "Barbara", "Ewa", "Elżbieta", "Zofia", "Teresa", "Joanna", "Monika", "Danuta", "Natalia", "Karolina", "Marta", "Beata", "Dorota", "Halina", "Jadwiga", "Aleksandra", "Irena", "Alicja", "Paulina", "Justyna", "Renata", "Bożena", "Urszula", "Weronika", "Sylwia", "Agata", "Patrycja", "Izabela", "Aneta", "Emilia", "Ewelina", "Kinga", "Martyna", "Klaudia", "Dominika", "Julia", "Zuzanna", "Maja", "Hanna", "Oliwia", "Wiktoria", "Kamila", "Edyta", "Marzena"];
const callersFemaleLast = ["Kowalska", "Nowak", "Wiśniewska", "Wójcik", "Kowalczyk", "Kamińska", "Lewandowska", "Zielińska", "Szymańska", "Woźniak", "Dąbrowska", "Kozłowska", "Jankowska", "Mazur", "Kwiatkowska", "Wojciechowska", "Krawczyk", "Kaczmarek", "Piotrowska", "Grabowska", "Zając", "Pawłowska", "Michalska", "Król", "Wieczorek", "Jabłońska", "Wróbel", "Nowakowska", "Majewska", "Olszewska", "Stępień", "Malinowska", "Jaworska", "Adamczyk", "Dudek", "Nowicka", "Pawlak", "Górska", "Witkowska", "Walczak", "Sikora", "Baran", "Rutkowska", "Michalak", "Szewczyk", "Ostrowska", "Tomaszewska", "Pietrzak", "Zalewska", "Wróblewska", "Kreft", "Formela", "Kwidzińska", "Labuda", "Hirsz", "Damps", "Treder", "Gaffke", "Kunkel", "Rohde", "Bistram", "Bojke", "Ceynowa", "Dettlaff", "Gruba", "Kohnke", "Liedtke", "Miotk", "Płotka", "Richert"];

const fallbackPhrasesP = [
    "Pali się sadza w kominie, z komina lecą iskry na dach budynku",
    "Mieszkaniec zgłasza gęsty czarny dym z budynku gospodarczego",
    "Widzę płomienie wydostające się przez dach pustostanu",
    "Właściciel zgłasza pożar trawy i suchego ścierniska blisko lasu",
    "Pożar samochodu osobowego na poboczu drogi, ogień pod maską",
    "Pali się altana śmietnikowa przy budynku wielorodzinnym",
    "Zadymienie na klatce schodowej w bloku, czuć spaleniznę z mieszkania na parterze",
    "Pożar poddasza w domu jednorodzinnym, domownicy ewakuowali się na zewnątrz",
    "Pali się sterta gałęzi i drewniana szopa na terenie ogródków działkowych",
    "Pożar ciągnika rolniczego podczas prac polowych, ogień obejmuje kabinę",
    "Z okna mieszkania na drugim piętrze wydobywa się gęsty szary dym, brak kontaktu z lokatorem",
    "Pali się rozdzielnia elektryczna na korytarzu budynku usługowego",
    "Pożar poszycia leśnego, ogień szybko przesuwa się z wiatrem w stronę młodnika",
    "Płonie stodoła wypełniona słomą, zagrożony sąsiedni budynek mieszkalny",
    "Pożar kotłowni na paliwo stałe w piwnicy domu jednorodzinnego, silne zadymienie",
    "Pali się kuchnia w mieszkaniu, zapalił się olej na kuchence gazowej",
    "Pożar naczepy samochodu ciężarowego na drodze, palą się opony",
    "Zauważono ogień w opuszczonej hali magazynowej, słychać trzask pękającego eternitu",
    "Pali się kontener budowlany oraz składowane obok materiały styropianowe",
    "Pożar instalacji fotowoltaicznej na dachu budynku mieszkalnego, widać iskrzenie i dym",
    "Płonie garaż blaszany przy posesji, w środku znajduje się samochód i butla z gazem",
    "Pożar bel słomy złożonych na skraju pola, silne zadymienie widoczne z kilku kilometrów",
    "Dym wydobywający się spod maski autobusu komunikacji lokalnej, pasażerowie opuścili pojazd",
    "Pali się drewniana wiata rekreacyjna oraz składowane pod nią drewno opałowe",
    "Pożar w warsztacie samochodowym, gęsty czarny dym wydostaje się przez bramę wjazdową",
    "Wzbudzenie czujki dymu oraz wyczuwalny zapach spalenizny w piwnicy budynku mieszkalnego"
];

const fallbackPhrasesMZ = [
    "Samochód uderzył w przydrożne drzewo, kierowca zakleszczony w pojeździe",
    "Silny wiatr zerwał połowę dachu z budynku mieszkalnego, blacha zwisa nad chodnikiem",
    "Podejrzenie silnego wycieku gazu z instalacji w piwnicy budynku",
    "Duże drzewo całkowicie zablokowało oba pasy ruchu na drodze powiatowej",
    "Zderzenie dwóch samochodów osobowych na skrzyżowaniu, wyciek płynów eksploatacyjnych, jedna osoba ranna",
    "Czujnik tlenku węgla włączył się w łazience, dziecko skarży się na zawroty głowy i nudności",
    "Starsza osoba nie otwiera drzwi od wczoraj, słychać wołanie o pomoc z wnętrza mieszkania",
    "Plama oleju napędowego ciągnąca się na długości około 400 metrów na łuku drogi",
    "Samochód dostawczy wjechał do przydrożnego rowu i przewrócił się na bok, kierowca nie może wyjść",
    "Nadłamany gruby konar drzewa wisi bezpośrednio nad linią energetyczną i placem zabaw",
    "Zalana piwnica oraz kotłownia w budynku mieszkalnym po gwałtownej ulewie",
    "Gniazdo szerszeni pod podbitką dachową tuż nad wejściem do budynku mieszkalnego",
    "Wywrócona łódka wędkarska na jeziorze, dwie osoby w wodzie trzymają się kadłuba",
    "Rozszczelnienie mauzera z nieznaną substancją chemiczną na terenie bazy transportowej",
    "Potrącenie pieszego na przejściu, poszkodowany nieprzytomny, brak wolnej karetki PRM w rejonie",
    "Koń wpadł do głębokiego rowu melioracyjnego i nie jest w stanie samodzielnie wyjść",
    "Uszkodzona rura gazowa średniego ciśnienia podczas prac koparką na posesji",
    "Zatrzaśnięte małe dziecko w samochodzie osobowym na parkingu przed sklepem",
    "Zawalenie się części stropu w remontowanym starym budynku, jedna osoba przygnieciona gruzem",
    "Zespół Ratownictwa Medycznego prosi o pomoc w zniesieniu otyłego pacjenta z trzeciego piętra",
    "Pęknięta ściana nośna w starej kamienicy, słychać trzaski konstrukcji, mieszkańcy obawiają się zawalenia",
    "Samochód ciężarowy uszkodził barierki energochłonne, rozbity zbiornik paliwa, wyciek ropy do rowu",
    "Mężczyzna spadł z rusztowania podczas prac elewacyjnych na wysokości około 6 metrów",
    "Zaginiona starsza osoba chora na alzheimera wyszła z domu w kierunku kompleksu leśnego",
    "Zerwana linia niskiego napięcia iskrzy na mokrej nawierzchni drogi po uderzeniu wiatru",
    "Sarna uwięziona między metalowymi przęsłami ogrodzenia posesji, rani się próbując uwolnić"
];

function generateRandomPolishCaller() {
    const isFemale = Math.random() < 0.48;
    const first = isFemale ? callersFemaleFirst[Math.floor(Math.random() * callersFemaleFirst.length)] : callersMaleFirst[Math.floor(Math.random() * callersMaleFirst.length)];
    const last = isFemale ? callersFemaleLast[Math.floor(Math.random() * callersFemaleLast.length)] : callersMaleLast[Math.floor(Math.random() * callersMaleLast.length)];
    const prefixes = ["50", "51", "53", "57", "60", "66", "69", "72", "78", "79", "88"];
    const numStr = `${prefixes[Math.floor(Math.random() * prefixes.length)]}${Math.floor(Math.random() * 9000000 + 1000000)}`;
    return `${first} ${last} (tel.${numStr.slice(0, 3)}-${numStr.slice(3, 6)}-${numStr.slice(6, 9)})`;
}

let currentCountyId = "wejherowski";
let currentCountyCallsign = "Wejherowo 998";
let currentUserRank = "asp.";
let currentUserName = "";

let locationsDatabase = { ...COUNTY_PROFILES.wejherowski.locationsDatabase };
let townsList = Object.keys(locationsDatabase);
let realStreetsByTown = { ...COUNTY_PROFILES.wejherowski.realStreetsByTown };
let gpsCoords = { ...COUNTY_PROFILES.wejherowski.gpsCoords };
let unitExactLocations = JSON.parse(JSON.stringify(COUNTY_PROFILES.wejherowski.unitExactLocations));
let unitsPSP = JSON.parse(JSON.stringify(COUNTY_PROFILES.wejherowski.unitsPSP));
let unitsOSP = JSON.parse(JSON.stringify(COUNTY_PROFILES.wejherowski.unitsOSP));

let events = [];
let activeEditingId = null;
let selectedEvIdForRadio = null;
let selectedVehicles = [];
let servicesState = { prm: false, police: false };
let currentCPRData = null;
let cprCounter = 101;
let openRadioWindows = {};
let mainRadioLogs = [];
let mainRadioModalEl = null;

let simSpeed = 1;
let simIntervalId = null;
let autoCprTimeoutId = null;
let shiftStats = { cprTotalGenerated: 0, cprAccepted: 0, cprRefused: 0, refusalReasons: {} };
