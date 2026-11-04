// =========================================================================
// PLIK 2: map.js - MAPA LEAFLET, GEOKODER, CZASY DOJAZDU I OKIENKO SGR
// =========================================================================

let leafletMap = null;
let mapMarkersLayer = null;
let stationsGeocoded = false;

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getUnitProximity(unitName, city) {
    let unitLoc = unitExactLocations[unitName];
    if (!unitLoc) {
        const sgrList = getCurrentRegionSgrGroups();
        const sgrFound = sgrList.find(g => g.unitName === unitName || g.groupName === unitName);
        if (sgrFound) unitLoc = { town: sgrFound.town, address: sgrFound.address, lat: sgrFound.lat, lng: sgrFound.lng };
    }
    if (!unitLoc) {
        const firstUnitKey = Object.keys(unitExactLocations)[0];
        unitLoc = unitExactLocations[firstUnitKey];
    }

    const defaultTown = COUNTY_PROFILES[currentCountyId].defaultTown;
    const targetTown = Object.keys(gpsCoords).find(c => c.toLowerCase() === (city || "").trim().toLowerCase()) || defaultTown;

    let kmRounded = 1.5;
    if (unitLoc && unitLoc.town.toLowerCase() === targetTown.toLowerCase()) {
        kmRounded = unitName.includes("JRG") ? 1.5 : 1.8;
    } else if (unitLoc) {
        const tCoords = gpsCoords[targetTown] || COUNTY_PROFILES[currentCountyId].mapCenter;
        const roadDist = haversineKm(unitLoc.lat, unitLoc.lng, tCoords[0], tCoords[1]) * 1.25;
        kmRounded = Math.max(1.5, Math.round(roadDist * 10) / 10);
    }
    return { sec: Math.max(15, Math.round(kmRounded * 15)), kmNum: kmRounded, km: `${kmRounded.toFixed(1)} km` };
}

function generateDeparturePrepSeconds(unitName) {
    const isPSP = unitName.includes("JRG") || unitName.includes("KP PSP") || unitName.includes("KM PSP") || unitName.includes("SGR");
    // PSP: od 20 do 45 sekund | OSP: od 40 do 80 sekund
    return isPSP ? (Math.floor(Math.random() * 26) + 20) : (Math.floor(Math.random() * 41) + 40);
}

function calculateRouteTravelSeconds(unitName, city) {
    const prox = getUnitProximity(unitName, city);
    // Czas dojazdu: ok. 15-20 sekund na 1 km
    return Math.max(10, Math.round(prox.kmNum * (15 + Math.random() * 5)));
}

function calculateActionDurationSeconds(desc, subtype, type, vehicles = []) {
    if (type === 'PZR') return -1;
    const text = ((desc || "") + " " + (subtype || "")).toLowerCase();

    const hasQuad = vehicles.some(v => v.name.toLowerCase().includes("quad") || v.id.includes("Q01"));
    const hasBoat = vehicles.some(v => v.name.toLowerCase().includes("łódź") || v.name.toLowerCase().includes("łodzi") || v.name.toLowerCase().includes("ponton") || v.id.includes("Ł"));
    const hasSgrChem = vehicles.some(v => v.name.toLowerCase().includes("srchem") || v.name.toLowerCase().includes("chem"));
    const hasSgrt = vehicles.some(v => v.name.toLowerCase().includes("scrt") || v.name.toLowerCase().includes("scdz") || v.name.toLowerCase().includes("srt"));

    let baseDuration = Math.floor(Math.random() * 121) + 150;

    const isBig = /poszukiwan|zaginion|hala|hali|magazyn|zakład|produkcyjn|składowisk|tartak/.test(text);
    const isChem = /chemiczn|wyciek|substancj|kwas|rozszczelnien/.test(text);
    const isWater = /topienie|woda|jezioro|rzeka|ponton|lodzie/.test(text);
    const isAccident = /wypadek|zderzenie|zakleszcz/.test(text);

    if (isBig) baseDuration = Math.floor(Math.random() * 301) + 300;
    if (isChem) {
        if (!hasSgrChem) baseDuration *= 1.8;
        else baseDuration *= 0.7;
    }
    if (isWater && hasBoat) baseDuration *= 0.75;
    if (isAccident && hasSgrt) baseDuration *= 0.8;
    if (/poszukiwan/.test(text) && hasQuad) baseDuration *= 0.6;

    if (currentWeatherData.condition === 'DROUGHT' && /las|traw|stog|pole/.test(text)) baseDuration *= 1.3;
    if (currentWeatherData.condition === 'STORM' || currentWeatherData.condition === 'WIND') baseDuration *= 1.25;

    return Math.round(baseDuration);
}

function autoSelectJRGByCity(city) {
    const jrgList = COUNTY_PROFILES[currentCountyId].jrgList;
    let bestJrg = jrgList[0];
    if (jrgList.length > 1) {
        let bestSec = 999999;
        jrgList.forEach(jName => {
            const p = getUnitProximity(jName, city);
            if (p.sec < bestSec) { bestSec = p.sec; bestJrg = jName; }
        });
    }
    ['inp-ev-jrg', 'inp-ev-lead', 'inp-ev-area'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = bestJrg;
    });
}

// --- OSOBNE OKIENKO DYSPONOWANIA GRUP SPECJALISTYCZNYCH (WYBIERANIE POJAZDÓW JAK W DYSPOZYCJI) ---
function openSgrModal() {
    let modal = document.getElementById('modal-sgr-select');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-sgr-select';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display:none; background:rgba(0,0,0,0.45); z-index:11000;';
        document.body.appendChild(modal);
    }

    const cityInput = document.getElementById('inp-ev-city');
    const targetCity = cityInput && cityInput.value.trim() ? cityInput.value.trim() : COUNTY_PROFILES[currentCountyId].defaultTown;
    const regionLabel = (currentCountyId === 'raciborski') ? 'Województwo Śląskie (KW PSP Katowice)' : 'Województwo Pomorskie (KW PSP Gdańsk)';
    const groups = getCurrentRegionSgrGroups();

    const groupsHtml = groups.map((g, gIdx) => {
        const prox = getUnitProximity(g.unitName, targetCity);
        const vehsHtml = g.vehicles.map(v => {
            const isChecked = selectedVehicles.some(sv => sv.id === v.id);
            return `
                <label class="dispatch-vehicle-item" style="cursor:pointer; color:#000000; display:flex; align-items:center; gap:6px; padding:4px 8px; border-bottom:1px solid #eee;">
                    <input type="checkbox" class="sgr-veh-cb sgr-group-cb-${gIdx}" value="${v.id}" ${isChecked ? 'checked' : ''}>
                    <span class="status-dot ${v.status}"></span>
                    <span><b>${v.id}</b> - ${v.name} <small style="color:#555;">(Obsada: ${v.obsada})</small></span>
                </label>
            `;
        }).join('');

        return `
            <div class="dispatch-unit-group" style="margin-bottom:8px; border:1px solid #7f9db9; background:#fff;">
                <div class="dispatch-unit-header" style="background:#dbe8f9; padding:5px 8px; font-weight:bold; display:flex; justify-content:space-between; align-items:center;">
                    <span>🚨 ${g.groupName} <small style="font-weight:normal; color:#333;">(${g.address})</small></span>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:11px; color:#0a246a;">${prox.km} | Dojazd: ~${formatMMSS(prox.sec)}</span>
                        <button type="button" class="btn-win" style="font-size:10px; padding:1px 6px;" onclick="toggleAllSgrInGroup(${gIdx})">Zaznacz całą grupę</button>
                    </div>
                </div>
                <div>${vehsHtml}</div>
            </div>
        `;
    }).join('');

    modal.innerHTML = `
        <div class="modal-window" style="width: 640px; background: #ece9d8; border: 2px solid #0a246a; box-shadow: 0 6px 20px rgba(0,0,0,0.5);">
            <div class="modal-header" style="background: #0a246a; color: #fff; padding: 5px 10px;">
                <span>🚨 Dysponowanie Specjalistycznych Grup Ratowniczych — ${regionLabel}</span>
                <div class="modal-close" onclick="closeModal('modal-sgr-select')">×</div>
            </div>
            <div class="modal-body" style="padding: 10px; display:flex; flex-direction:column; gap:8px;">
                <div style="background:#fff8c4; border:1px solid #d4ac0d; padding:6px 10px; font-size:11px; color:#000;">
                    📍 <b>Cel zadysponowania:</b> <span style="color:#b30000; font-weight:bold;">${targetCity}</span> — Wybierz konkretne zastępy specjalistyczne z listy poniżej (lub zaznacz całą grupę):
                </div>
                <div id="sgr-dispatch-list" style="max-height: 340px; overflow-y: auto; border: 1px solid #999; padding: 6px; background: #f5f5f5;">
                    ${groupsHtml}
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px;">
                    <button type="button" class="btn-win" style="padding: 5px 16px; font-weight: bold; background: #e2f0d9; border:1px solid #155724; color:#155724;" onclick="confirmDispatchSgr()">✔ Zatwierdź wybrane zastępy SGR</button>
                    <button type="button" class="btn-win" style="padding: 5px 12px;" onclick="closeModal('modal-sgr-select')">Anuluj</button>
                </div>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
    const win = modal.querySelector('.modal-window');
    const hdr = modal.querySelector('.modal-header');
    if (win && hdr && typeof makeDraggable === 'function') makeDraggable(win, hdr);
}

function toggleAllSgrInGroup(gIdx) {
    const cbs = document.querySelectorAll(`.sgr-group-cb-${gIdx}`);
    const allChecked = Array.from(cbs).every(cb => cb.checked);
    cbs.forEach(cb => { cb.checked = !allChecked; });
}

function confirmDispatchSgr() {
    const cityInput = document.getElementById('inp-ev-city');
    const targetCity = (cityInput && cityInput.value.trim()) ? cityInput.value.trim() : COUNTY_PROFILES[currentCountyId].defaultTown;
    const groups = getCurrentRegionSgrGroups();
    const sgrAllVehIds = new Set();
    groups.forEach(g => g.vehicles.forEach(v => sgrAllVehIds.add(v.id)));

    const keptRegularVehicles = selectedVehicles.filter(sv => !sgrAllVehIds.has(sv.id));
    const checkedSgrIds = Array.from(document.querySelectorAll('#sgr-dispatch-list input.sgr-veh-cb:checked')).map(cb => cb.value);

    const newSgrSelection = [];
    checkedSgrIds.forEach(vehId => {
        const existing = selectedVehicles.find(sv => sv.id === vehId);
        if (existing) {
            newSgrSelection.push(existing);
        } else {
            groups.forEach(g => {
                const v = g.vehicles.find(veh => veh.id === vehId);
                if (v) {
                    const prepSec = generateDeparturePrepSeconds(g.unitName);
                    const routeSec = calculateRouteTravelSeconds(g.unitName, targetCity);
                    newSgrSelection.push({
                        ...v,
                        unitName: g.unitName,
                        phase: 'PREP',
                        prepTime: prepSec,
                        travelTime: routeSec,
                        baseRouteSeconds: routeSec,
                        returnTime: routeSec
                    });
                }
            });
        }
    });

    selectedVehicles = [...keptRegularVehicles, ...newSgrSelection];
    const countLbl = document.getElementById('lbl-selected-count');
    if (countLbl) countLbl.innerText = "Wybrano pojazdów: " + selectedVehicles.length;

    closeModal('modal-sgr-select');
}

// --- GEOKODER ---
async function resolveExactCoordinates(streetAddress, townName) {
    const profile = COUNTY_PROFILES[currentCountyId];
    const cleanTown = (townName || profile.defaultTown).trim().replace(/^Gdynia\s+|^Gdańsk\s+/i, (m) => m.split(' ')[0] + ' ');
    let cleanedStreet = (streetAddress || "").replace(/^(Przystanek Autobusowy|Kamienica|Blok mieszkalny|Hala Magazynowa|Tartak \/ Skład Drzewny)[,\s-]*/i, '').split('/')[0].trim();

    const fullQuery = cleanedStreet ? `${cleanedStreet}, ${cleanTown}, ${profile.voivodeship}, Polska` : `${cleanTown}, ${profile.voivodeship}, Polska`;

    try {
        const arcUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(fullQuery)}&countryCode=POL&searchExtent=${profile.bbox}&maxLocations=1`;
        const res = await fetch(arcUrl);
        if (res.ok) {
            const data = await res.json();
            if (data.candidates && data.candidates.length > 0) {
                const loc = data.candidates[0].location;
                if (loc && loc.y && loc.x) return { lat: parseFloat(loc.y), lng: parseFloat(loc.x) };
            }
        }
    } catch (e) {}
    return null;
}

async function geocodeAllFireStationsExact() {
    if (stationsGeocoded) return;
    stationsGeocoded = true;
    const cacheKey = `SWD_EXACT_STATIONS_${currentCountyId}_V9`;
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            Object.keys(parsed).forEach(uName => {
                if (unitExactLocations[uName] && !unitExactLocations[uName].locked && parsed[uName].lat && parsed[uName].lng) {
                    unitExactLocations[uName].lat = parsed[uName].lat; unitExactLocations[uName].lng = parsed[uName].lng;
                }
            });
            updateMapMarkers(); return;
        }
    } catch (e) {}

    const unitNames = Object.keys(unitExactLocations).filter(u => !unitExactLocations[u].locked);
    const cacheToSave = {};
    await Promise.all(unitNames.map(async (uName) => {
        const info = unitExactLocations[uName];
        const coords = await resolveExactCoordinates(info.address, info.town);
        if (coords) { info.lat = coords.lat; info.lng = coords.lng; cacheToSave[uName] = { lat: info.lat, lng: info.lng }; }
    }));
    try { if (Object.keys(cacheToSave).length > 2) localStorage.setItem(cacheKey, JSON.stringify(cacheToSave)); } catch (e) {}
    updateMapMarkers();
}

async function geocodeEventAddress(ev) {
    const rawStreet = (ev.street || "").trim();
    const coords = await resolveExactCoordinates(rawStreet, ev.city);
    if (coords) { ev.lat = coords.lat; ev.lng = coords.lng; }
    else if (!ev.lat || !ev.lng) {
        const fallback = gpsCoords[ev.city] || COUNTY_PROFILES[currentCountyId].mapCenter;
        ev.lat = fallback[0]; ev.lng = fallback[1];
    }
    updateMapMarkers();
    if (typeof saveSimulationState === 'function') saveSimulationState();
}

function focusEventOnMap(evId) {
    const ev = events.find(e => e.id === evId);
    if (!ev) return;
    switchMainView('map');
    setTimeout(async () => {
        if (!ev.geocodedOnce) { ev.geocodedOnce = true; await geocodeEventAddress(ev); }
        if (leafletMap && ev.lat && ev.lng) leafletMap.setView([ev.lat, ev.lng], 17);
    }, 250);
}

// --- MAPA LEAFLET ---
function ensureLeafletLoaded(callback) {
    if (window.L) { callback(); return; }
    if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
    }
    const script = document.createElement('script'); script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = callback; document.head.appendChild(script);
}

function initLeafletMap() {
    ensureLeafletLoaded(() => {
        const mapEl = document.getElementById('leaflet-map');
        if (!mapEl) return;
        const center = COUNTY_PROFILES[currentCountyId].mapCenter;
        if (!leafletMap) {
            leafletMap = L.map('leaflet-map').setView(center, 11);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(leafletMap);
            mapMarkersLayer = L.layerGroup().addTo(leafletMap);
            geocodeAllFireStationsExact();
        }
        leafletMap.invalidateSize();
        updateMapMarkers();
    });
}

function updateMapMarkers() {
    if (!leafletMap || !mapMarkersLayer || !window.L) return;
    mapMarkersLayer.clearLayers();

    [...unitsPSP, ...unitsOSP].forEach(u => {
        const firstKey = Object.keys(unitExactLocations)[0];
        const loc = unitExactLocations[u.name] || unitExactLocations[firstKey];
        if (!loc) return;

        const isPSP = u.name.includes("JRG") || u.name.includes("KP PSP") || u.name.includes("KM PSP");
        const hasPzrVeh = u.vehicles.some(v => v.status === 'yellow');
        const borderColor = hasPzrVeh ? "#d4ac0d" : (isPSP ? "#b30000" : "#0a246a");
        const bgBadge = hasPzrVeh ? "#ffe875" : (isPSP ? "#ffe6e6" : "#ffffff");
        const vehListHtml = u.vehicles.map(v => {
            const color = v.status === 'green' ? '#1e8449' : (v.status === 'yellow' ? '#d4ac0d' : (v.status === 'orange' ? '#d68910' : '#c0392b'));
            const pzrTag = v.status === 'yellow' ? ' <b style="color:#b38600;">[PZR]</b>' : '';
            return `<div style="font-size:11px; color:#000;"><span style="color:${color}; font-weight:bold;">●</span> <b>${v.id}</b> - ${v.name}${pzrTag}</div>`;
        }).join('');

        const marker = L.marker([loc.lat, loc.lng], {
            icon: L.divIcon({
                className: '',
                html: `<div style="transform:translate(-50%, -50%); background:${bgBadge}; color:#000000; border:2px solid ${borderColor}; border-radius:4px; padding:2px 6px; font-size:11px; font-weight:bold; white-space:nowrap; box-shadow:0 2px 5px rgba(0,0,0,0.45); cursor:pointer;">🚒 ${u.name}</div>`,
                iconSize: [0, 0], iconAnchor: [0, 0]
            })
        });
        marker.bindPopup(`<div style="min-width:220px; color:#000;"><div style="font-weight:bold; color:${borderColor}; font-size:12px;">${u.name}</div><div style="font-size:10px; color:#222; border-bottom:1px solid #ccc; margin-bottom:4px; padding-bottom:3px;">📍 <b>Adres:</b> ${loc.address}</div>${vehListHtml}</div>`);
        mapMarkersLayer.addLayer(marker);
    });

    events.forEach(ev => {
        if (ev.status !== 'ACTIVE') return;
        const fallback = gpsCoords[ev.city] || COUNTY_PROFILES[currentCountyId].mapCenter;
        const evLat = ev.lat || fallback[0], evLng = ev.lng || fallback[1];

        const isPZR = ev.type === 'PZR';
        const bgEv = isPZR ? '#fff3a1' : '#ffcccc';
        const borderEv = isPZR ? '#d4ac0d' : '#b30000';
        const iconEv = isPZR ? '🛡️ [PZR]' : `🚨 [ID:${ev.id}]`;

        const marker = L.marker([evLat, evLng], {
            icon: L.divIcon({
                className: '',
                html: `<div style="transform:translate(-50%, -50%); background:${bgEv}; color:#000000; border:2.5px solid ${borderEv}; border-radius:4px; padding:2px 7px; font-size:11px; font-weight:bold; white-space:nowrap; box-shadow:0 0 8px rgba(0,0,0,0.5); cursor:pointer;">${iconEv} ${ev.city}${ev.street ? ', ' + ev.street : ''}</div>`,
                iconSize: [0, 0], iconAnchor: [0, 0]
            })
        });

        const sisList = ev.vehicles.map(v => {
            if (v.phase === 'PREP') return `${v.id} (Wyjazd z bazy za: ${v.prepTime}s)`;
            if (v.phase === 'TRAVEL') return `${v.id} (Dojazd: ${formatMMSS(v.travelTime)})`;
            if (v.phase === 'ONSITE') return `${v.id} (${isPZR ? 'Zabezpieczenie rejonu' : 'Na miejscu akcji'})`;
            if (v.phase === 'RETURN') return `${v.id} (Powrót: ${formatMMSS(v.returnTime)})`;
            return `${v.id}`;
        }).join('<br>');

        marker.bindPopup(`
            <div style="min-width:230px; color:#000;">
                <b style="color:${borderEv};">ZDARZENIE ID: ${ev.id}/2026 (${ev.type})</b><br>
                <b>Dokładny adres:</b> ${ev.city}, ${ev.street || 'Rejon operacyjny'}<br>
                <b>Opis:</b> ${ev.desc || 'Zabezpieczenie operacyjne rejonu'}<br>
                <b>Zadysponowane SiS (${ev.vehicles.length}):</b><br>${sisList || 'Brak'}<br>
                <div style="margin-top:6px; display:flex; gap:4px;">
                    <button class="btn-win" onclick="openEditEventModal(${ev.id})">Edytuj kartę</button>
                    <button class="btn-win" onclick="openRadioForEvent(${ev.id})">📻 Radio zdarzenia</button>
                </div>
            </div>
        `);
        mapMarkersLayer.addLayer(marker);
    });
}

function switchMainView(viewType) {
    let mapContainer = document.getElementById('view-map-container');
    const pspGrid = document.getElementById('grid-psp');
    const ospGrid = document.getElementById('grid-osp');
    const btnPsp = document.getElementById('btn-tab-psp');
    const btnOsp = document.getElementById('btn-tab-osp');
    const btnMap = document.getElementById('btn-tab-map');

    if (viewType === 'map') {
        if (pspGrid) pspGrid.style.display = 'none';
        if (ospGrid) ospGrid.style.display = 'none';
        if (mapContainer) mapContainer.style.display = 'block';
        if (btnPsp) btnPsp.classList.remove('active');
        if (btnOsp) btnOsp.classList.remove('active');
        if (btnMap) btnMap.classList.add('active');
        setTimeout(() => initLeafletMap(), 100);
    } else {
        if (mapContainer) mapContainer.style.display = 'none';
        if (btnMap) btnMap.classList.remove('active');
        if (typeof switchTab === 'function') switchTab('PSP');
    }
}
