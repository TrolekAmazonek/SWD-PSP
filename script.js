// =========================================================================
// PLIK 4: script.js - PEŁNY RDZEŃ SWD + CO-OP + SUPABASE + HISTORIA EDYCJI
// =========================================================================

// Upewnienie się, że czytanie głosowe (TTS) jest całkowicie wyłączone
if (typeof window !== 'undefined') {
    if ('speechSynthesis' in window) {
        try {
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak = function() {};
        } catch (e) {}
    }
    window.speakRadioText = function() {};
    window.speakText = function() {};
    window.playRadioTTS = function() {};
}

// --- KONFIGURACJA POŁĄCZENIA SUPABASE I TRYBU WSPÓŁPRACY (CO-OP) ---
const DEFAULT_SUPABASE_URL = "https://ckfkdvwmpidbfgjvraee.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_DWZxf6vIGWyIKxyhexxNxA_GgTy92Nt";

let supabaseClient = null;
let coopChannel = null;
let myClientId = "op_" + Math.random().toString(36).substring(2, 10);
let currentUserRole = "UNIWERSALNY"; // UNIWERSALNY | PRZYJMUJĄCY | KIERUJĄCY
let onlinePeers = {};
let coopIntercomLogs = [];
let coopIntercomModalEl = null;
let isApplyingRemoteState = false;
let lastDbSyncTimestamp = 0;

function getSupabaseCredentials() {
    const savedKey = localStorage.getItem('SWDST_SUPABASE_ANON_KEY');
    const savedUrl = localStorage.getItem('SWDST_SUPABASE_URL');
    return {
        url: (savedUrl && savedUrl.trim()) ? savedUrl.trim() : DEFAULT_SUPABASE_URL,
        key: (savedKey && savedKey.trim()) ? savedKey.trim() : DEFAULT_SUPABASE_KEY
    };
}

function initSupabaseAndCoop() {
    if (!window.supabase) return;
    const creds = getSupabaseCredentials();
    try {
        supabaseClient = window.supabase.createClient(creds.url, creds.key);
    } catch (e) {
        console.warn("Błąd inicjalizacji Supabase:", e);
        return;
    }

    if (coopChannel) {
        try { supabaseClient.removeChannel(coopChannel); } catch (e) {}
    }

    coopChannel = supabaseClient.channel('swd_global_coop_v1', {
        config: {
            broadcast: { self: false },
            presence: { key: myClientId }
        }
    });

    coopChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'swd_state' }, payload => {
        if (payload.new && payload.new.id === currentCountyId && payload.new.data) {
            if (payload.new.data.senderId && payload.new.data.senderId === myClientId) return;
            applyRemoteStatePayload(payload.new.data);
        }
    });

    coopChannel.on('broadcast', { event: 'swd_state_sync' }, ({ payload }) => {
        if (!payload || payload.senderId === myClientId) return;
        if (payload.countyId === currentCountyId && payload.stateObj) {
            applyRemoteStatePayload(payload.stateObj);
        }
    });

    coopChannel.on('broadcast', { event: 'swd_speed_sync' }, ({ payload }) => {
        if (!payload || payload.senderId === myClientId) return;
        if (payload.speed && payload.speed !== simSpeed) {
            setSimulationSpeed(payload.speed, false);
        }
    });

    coopChannel.on('broadcast', { event: 'swd_cpr_sync' }, ({ payload }) => {
        if (!payload || payload.senderId === myClientId || payload.countyId !== currentCountyId) return;
        if (payload.action === 'NEW_CPR' && payload.cprData) {
            const peerIsPrzyjmujacy = Object.values(onlinePeers).some(p => p.clientId !== myClientId && p.countyId === currentCountyId && p.role === 'PRZYJMUJĄCY');
            currentCPRData = payload.cprData;
            safeSetElementText('cpr-id', currentCPRData.id);
            safeSetElementText('cpr-city', currentCPRData.city);
            safeSetElementText('cpr-street', currentCPRData.street);
            safeSetElementText('cpr-caller', currentCPRData.caller);
            safeSetElementText('cpr-desc', currentCPRData.desc);
            if (!(currentUserRole === 'KIERUJĄCY' && peerIsPrzyjmujacy)) {
                audioCpr.currentTime = 0; audioCpr.play().catch(() => {});
                const cprModal = document.getElementById('cpr-modal');
                if (cprModal) cprModal.style.display = 'flex';
            }
        } else if (payload.action === 'CLOSE_CPR') {
            currentCPRData = null;
            const modal = document.getElementById('cpr-modal');
            if (modal) modal.style.display = 'none';
        }
    });

    coopChannel.on('broadcast', { event: 'swd_intercom_msg' }, ({ payload }) => {
        if (!payload) return;
        receiveCoopIntercomMessage(payload);
    });

    coopChannel.on('broadcast', { event: 'swd_mutual_aid_req' }, ({ payload }) => {
        if (!payload || payload.senderId === myClientId) return;
        if (payload.targetCountyId === currentCountyId || payload.targetCountyId === 'ALL') {
            showIncomingMutualAidRequest(payload);
        }
    });

    coopChannel.on('broadcast', { event: 'swd_mutual_aid_grant' }, ({ payload }) => {
        if (!payload || payload.senderId === myClientId) return;
        if (payload.requesterCountyId === currentCountyId) {
            receiveGrantedMutualAidVehicle(payload);
        }
    });

    coopChannel.on('presence', { event: 'sync' }, () => {
        const state = coopChannel.presenceState();
        onlinePeers = {};
        Object.keys(state).forEach(k => {
            if (state[k] && state[k][0]) {
                onlinePeers[k] = state[k][0];
            }
        });
        updateCoopOnlineBadge();
        renderCoopIntercomPeers();
    });

    coopChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            await trackMyPresence();
            updateCoopOnlineBadge();
        }
    });
}

async function trackMyPresence() {
    if (!coopChannel) return;
    const profile = COUNTY_PROFILES[currentCountyId] || RAW_PROFILES.find(r => r.id === currentCountyId);
    try {
        await coopChannel.track({
            clientId: myClientId,
            name: getFormattedOperatorName(),
            role: currentUserRole,
            countyId: currentCountyId,
            countyName: profile ? profile.name : currentCountyId,
            onlineAt: new Date().toLocaleTimeString()
        });
    } catch (e) {}
}

function isMasterClientForCounty() {
    const sameCountyPeers = Object.values(onlinePeers)
        .filter(p => p.countyId === currentCountyId)
        .map(p => p.clientId)
        .sort();
    if (sameCountyPeers.length === 0) return true;
    return sameCountyPeers[0] === myClientId;
}

function applyRemoteStatePayload(remoteData) {
    if (!remoteData) return;
    isApplyingRemoteState = true;
    try {
        if (Array.isArray(remoteData.events)) events = remoteData.events;
        if (Array.isArray(remoteData.unitsPSP) && remoteData.unitsPSP.length >= 2) unitsPSP = remoteData.unitsPSP;
        if (Array.isArray(remoteData.unitsOSP) && remoteData.unitsOSP.length >= 2) unitsOSP = remoteData.unitsOSP;
        if (remoteData.unitExactLocations) {
            Object.keys(remoteData.unitExactLocations).forEach(k => {
                if (!unitExactLocations[k]) unitExactLocations[k] = remoteData.unitExactLocations[k];
            });
        }
        if (remoteData.shiftStats) shiftStats = remoteData.shiftStats;
        if (typeof remoteData.cprCounter === 'number') cprCounter = remoteData.cprCounter;
        if (Array.isArray(remoteData.mainRadioLogs)) {
            const hadLessLogs = mainRadioLogs.length < remoteData.mainRadioLogs.length;
            mainRadioLogs = remoteData.mainRadioLogs;
            if (typeof updateMainRadioChat === 'function') updateMainRadioChat();
            if (hadLessLogs) {
                audioMotorola.currentTime = 0; audioMotorola.play().catch(() => {});
            }
        }
        if (selectedEvIdForRadio === null && events.length > 0) {
            selectedEvIdForRadio = events[events.length - 1].id;
            const btnOpen = document.getElementById('btn-open-radio');
            if (btnOpen) btnOpen.style.display = 'block';
        }
        renderUnits();
        renderEvents();
        renderSelectedEventDetails();
        Object.keys(openRadioWindows).forEach(evId => {
            if (typeof updateRadioChatDynamic === 'function') updateRadioChatDynamic(Number(evId));
        });
    } catch (e) {}
    isApplyingRemoteState = false;
}

function updateCoopOnlineBadge() {
    const badge = document.getElementById('coop-online-badge');
    if (!badge) return;
    const peersList = Object.values(onlinePeers);
    const count = peersList.length;
    if (count <= 1) {
        badge.style.background = '#eef4ff';
        badge.style.color = '#0a246a';
        badge.innerHTML = `🟢 Co-op Online: 1 dyspozytor (${currentUserRole}) — Kliknij, aby otworzyć Interkom`;
    } else {
        badge.style.background = '#d4edda';
        badge.style.color = '#155724';
        const others = peersList.filter(p => p.clientId !== myClientId).map(p => `${p.name} [${p.role}]`).join(', ');
        badge.innerHTML = `🟢 Współpraca (${count} online): Ty + ${others}`;
    }
}

if (typeof window.callUniversalAI !== 'function') {
    window._swdKeys = {
        g: "Z3NrX2dEQkRQMWhzenZtVjBQc010OWlXR2d5YjNGWUhzYW5FZ2twUEg2anNIWnY2WGFyY2o0QzM="
    };
    window.callUniversalAI = async function(systemPrompt, userPrompt, jsonMode = false) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        try {
            const response = await fetch('https://text.pollinations.ai/openai', {
                method: 'POST',
                signal: controller.signal,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'openai',
                    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                    temperature: 0.8,
                    jsonMode: jsonMode
                })
            });
            clearTimeout(timeoutId);
            if (response.ok) {
                const data = await response.json();
                if (data.choices && data.choices[0]?.message?.content) return data.choices[0].message.content.trim();
            }
        } catch (err) {}

        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${atob(window._swdKeys.g)}` },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                    temperature: 0.8,
                    max_tokens: 180,
                    ...(jsonMode ? { response_format: { type: "json_object" } } : {})
                })
            });
            const data = await res.json();
            if (data.choices && data.choices[0]?.message?.content) return data.choices[0].message.content.trim();
        } catch (e) {}

        throw new Error("AI Offline");
    };
}

let weatherTimeoutId = null;

function getAllUnitsIncludingSgr() {
    return [...unitsPSP, ...unitsOSP, ...getCurrentRegionSgrGroups()];
}

function getStorageKeyForCounty(countyId) {
    return `SWDST_SAVED_SHIFT_STATE_${countyId}_V1`;
}

function getFormattedOperatorName() {
    return (currentUserName && currentUserName.trim() !== "")
        ? `${currentUserRank} ${currentUserName.trim()}`
        : "Dyspozytor SK";
}

function updateStatusBarUserDisplay() {
    const firstSpan = document.querySelector('.status-bar span');
    if (!firstSpan) return;
    const profile = COUNTY_PROFILES[currentCountyId] || RAW_PROFILES.find(r => r.id === currentCountyId);
    const pName = profile ? profile.name : currentCountyId;
    const roleBadge = `<span style="background:#0a246a; color:#fff; padding:1px 5px; border-radius:2px; font-size:10px; margin-left:4px;">Rola: ${currentUserRole}</span>`;
    firstSpan.innerHTML = (currentUserName && currentUserName.trim() !== "")
        ? `Zalogowano jako: <b>${currentUserRank} ${currentUserName.trim()}</b> ${roleBadge} <span style="color:#0a246a; font-weight:bold; margin-left:6px;">[${pName}]</span>`
        : `Zalogowano jako: <b style="color:#777; font-style:italic;">Dyspozytor SK</b> ${roleBadge} <span style="color:#0a246a; font-weight:bold; margin-left:6px;">[${pName}]</span>`;
}

function updateJrgSelectOptions() {
    const profile = COUNTY_PROFILES[currentCountyId];
    if (!profile) return;
    const jrgList = profile.jrgList;
    ['inp-ev-jrg', 'inp-ev-lead', 'inp-ev-area'].forEach(selId => {
        const el = document.getElementById(selId);
        if (el) el.innerHTML = jrgList.map(j => `<option value="${j}">${j}</option>`).join('');
    });
}

function ensureSgrButtonInEventModal() {
    const lblCount = document.getElementById('lbl-selected-count');
    const modalEv = document.getElementById('modal-event');
    if (!modalEv) return;

    const allBtns = modalEv.querySelectorAll('button');
    let dispBtn = null;
    allBtns.forEach(b => {
        if (b.innerText.trim().includes('Dyspozycja') || (b.getAttribute('onclick') || '').includes('openDispatchModal')) {
            dispBtn = b;
        }
    });

    if (!document.getElementById('btn-open-mutual-aid-modal')) {
        const aidBtn = document.createElement('button');
        aidBtn.type = 'button';
        aidBtn.id = 'btn-open-mutual-aid-modal';
        aidBtn.className = 'btn-win';
        aidBtn.style.cssText = 'background: #e2f0d9; border: 1.5px solid #155724; color: #155724; font-weight: bold; margin-right: 6px; cursor: pointer;';
        aidBtn.innerHTML = '🤝 Wsparcie z innego powiatu (Co-op)';
        aidBtn.onclick = () => openMutualAidModal();
        if (dispBtn && dispBtn.parentElement) dispBtn.parentElement.insertBefore(aidBtn, dispBtn);
    }

    if (!document.getElementById('btn-open-sgr-modal')) {
        const sgrBtn = document.createElement('button');
        sgrBtn.type = 'button';
        sgrBtn.id = 'btn-open-sgr-modal';
        sgrBtn.className = 'btn-win';
        sgrBtn.style.cssText = 'background: #fff3a1; border: 1.5px solid #b30000; color: #800000; font-weight: bold; margin-right: 6px; cursor: pointer;';
        sgrBtn.innerHTML = '🚨 Dysponuj SGR (KW PSP)';
        sgrBtn.onclick = () => openSgrModal();

        if (dispBtn && dispBtn.parentElement) {
            dispBtn.parentElement.insertBefore(sgrBtn, dispBtn);
        } else if (lblCount && lblCount.parentElement) {
            lblCount.parentElement.appendChild(sgrBtn);
        }
    }
}

function ensureLauncherModalExists() {
    if (document.getElementById('modal-launcher')) return;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modal-launcher';
    modal.style.cssText = 'display:flex; background:rgba(10, 36, 106, 0.45); z-index:12000;';

    const radiosHtml = RAW_PROFILES.map((rp, idx) => `
        <label style="display: flex; align-items: center; gap: 8px; padding: 5px 8px; border: 1.5px solid #0a246a; background: ${idx === 0 ? '#f0f5ff' : '#ffffff'}; cursor: pointer; border-radius: 3px;">
            <input type="radio" name="launcher-county" value="${rp.id}" ${idx === 0 ? 'checked' : ''}>
            <div>
                <div style="font-weight: bold; color: #0a246a; font-size: 12px;">${rp.name}</div>
                <div style="font-size: 10px; color: #444;">${rp.desc} • Kryptonim: <b>${rp.radioCallsign}</b></div>
            </div>
        </label>
    `).join('');

    const creds = getSupabaseCredentials();

    modal.innerHTML = `
        <div class="modal-window" style="width: 560px; background: #ece9d8; border: 2px solid #0a246a; box-shadow: 0 6px 25px rgba(0,0,0,0.6);">
            <div class="modal-header" style="background: linear-gradient(90deg, #0a246a, #1d4f91); color: #fff; padding: 6px 10px; font-size: 13px;">
                <span>🚒 ${APP_VERSION} — Logowanie Dyspozytora i Tryb Współpracy (Co-op)</span>
            </div>
            <div class="modal-body" style="padding: 12px; display: flex; flex-direction: column; gap: 8px;">
                <div class="form-box" style="padding: 8px;">
                    <div class="form-title" style="font-size: 12px; margin-bottom: 6px;">1. Dane Dyspozytora i Podział Ról na Stanowisku Kierowania</div>
                    <div style="display: flex; gap: 8px; margin-bottom: 6px;">
                        <div class="form-group" style="width: 130px;">
                            <label>Stopień służbowy:</label>
                            <select id="launcher-rank" style="padding: 4px;">
                                <option value="str.">strażak</option><option value="st. str.">st. strażak</option>
                                <option value="sekc.">sekcyjny</option><option value="st. sekc.">st. sekcyjny</option>
                                <option value="mł. ogn.">mł. ogniomistrz</option><option value="ogn.">ogniomistrz</option>
                                <option value="st. ogn.">st. ogniomistrz</option><option value="mł. asp.">mł. aspirant</option>
                                <option value="asp." selected>aspirant</option><option value="st. asp.">st. aspirant</option>
                                <option value="asp. szt.">asp. sztabowy</option><option value="mł. kpt.">mł. kapitan</option>
                                <option value="kpt.">kapitan</option><option value="st. kpt.">st. kapitan</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label>Identyfikator / Imię operatora:</label>
                            <input type="text" id="launcher-username" placeholder="np. Kuba" style="padding: 4px 8px; font-size: 12px; font-weight: bold;" onkeypress="if(event.key==='Enter') confirmLauncherLogin()">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Funkcja w Trybie Współpracy (Co-op dla 2 graczy):</label>
                        <select id="launcher-role" style="padding: 4px; font-weight: bold; color: #0a246a;">
                            <option value="UNIWERSALNY">🎖️ Dyspozytor Uniwersalny (Pełny dostęp do wszystkich funkcji)</option>
                            <option value="PRZYJMUJĄCY">📞 Dyspozytor Przyjmujący (Odbiór 112 CPR, zakładanie kart i 1. rzut SiS)</option>
                            <option value="KIERUJĄCY">📻 Dyspozytor Kierujący (Korespondencja radiowa z KDR, dosyłanie SiS/SGR i PZR)</option>
                        </select>
                    </div>
                </div>
                <div class="form-box" style="padding: 8px;">
                    <div class="form-title" style="font-size: 12px; margin-bottom: 6px;">2. Wybór Rejonu Operacyjnego (Wspólny powiat lub sąsiednie komendy)</div>
                    <div style="display: flex; flex-direction: column; gap: 4px; max-height: 210px; overflow-y: auto; padding-right: 4px;">
                        ${radiosHtml}
                    </div>
                </div>
                <div class="form-box" style="padding: 6px 8px; background: #f4f7fc;">
                    <div style="font-size: 10px; color: #333; margin-bottom: 3px;">🔗 <b>Baza Online Supabase</b> — klucz <i>anon public</i>:</div>
                    <input type="text" id="launcher-sb-key" value="${creds.key}" placeholder="Wklej skopiowany klucz anon public z Supabase..." style="width: 100%; font-size: 10px; padding: 3px 5px; font-family: monospace; box-sizing: border-box;">
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button class="btn-win" style="padding: 6px 18px; font-weight: bold; font-size: 12px; background: #e2f0d9; border: 1.5px solid #155724; color: #155724;" onclick="confirmLauncherLogin()">🚀 Rozpocznij służbę w SWD ➔</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function openLauncherModal() {
    ensureLauncherModalExists();
    const inpUser = document.getElementById('launcher-username');
    const selRank = document.getElementById('launcher-rank');
    const selRole = document.getElementById('launcher-role');
    if (inpUser) inpUser.value = currentUserName;
    if (selRank) selRank.value = currentUserRank;
    if (selRole) selRole.value = currentUserRole;
    const rad = document.querySelector(`input[name="launcher-county"][value="${currentCountyId}"]`);
    if (rad) rad.checked = true;
    document.getElementById('modal-launcher').style.display = 'flex';
}

function confirmLauncherLogin() {
    const inpUser = document.getElementById('launcher-username');
    const selRank = document.getElementById('launcher-rank');
    const selRole = document.getElementById('launcher-role');
    const inpSbKey = document.getElementById('launcher-sb-key');
    const chosenCountyRadio = document.querySelector('input[name="launcher-county"]:checked');

    currentUserRank = selRank ? selRank.value : "asp.";
    currentUserName = inpUser ? inpUser.value.trim() : "";
    currentUserRole = selRole ? selRole.value : "UNIWERSALNY";
    const newCountyId = chosenCountyRadio ? chosenCountyRadio.value : "wejherowski";

    if (inpSbKey && inpSbKey.value.trim()) {
        localStorage.setItem('SWDST_SUPABASE_ANON_KEY', inpSbKey.value.trim());
    }

    localStorage.setItem('SWDST_USER_SESSION', JSON.stringify({
        rank: currentUserRank, username: currentUserName, role: currentUserRole, countyId: newCountyId
    }));

    initSupabaseAndCoop();
    applyCountyProfile(newCountyId);
    updateStatusBarUserDisplay();
    trackMyPresence();

    const modal = document.getElementById('modal-launcher');
    if (modal) modal.style.display = 'none';
}

function applyCountyProfile(countyId) {
    const profile = COUNTY_PROFILES[countyId] || COUNTY_PROFILES.wejherowski;
    currentCountyId = profile.id;
    currentCountyCallsign = profile.radioCallsign;

    locationsDatabase = { ...profile.locationsDatabase };
    townsList = Object.keys(locationsDatabase);
    realStreetsByTown = { ...profile.realStreetsByTown };
    gpsCoords = { ...profile.gpsCoords };
    unitExactLocations = JSON.parse(JSON.stringify(profile.unitExactLocations));
    unitsPSP = JSON.parse(JSON.stringify(profile.unitsPSP));
    unitsOSP = JSON.parse(JSON.stringify(profile.unitsOSP));

    unitsOSP.forEach(u => {
        u.vehicles.forEach(v => { v.obsada = Math.floor(Math.random() * 4) + 3; });
    });

    getCurrentRegionSgrGroups().forEach(g => {
        g.vehicles.forEach(v => { v.status = "green"; });
    });

    events = []; selectedEvIdForRadio = null; activeEditingId = null;
    mainRadioLogs = []; cprCounter = 101;
    shiftStats = { cprTotalGenerated: 0, cprAccepted: 0, cprRefused: 0, refusalReasons: {} };
    if (typeof closeRadioWindow === 'function') {
        Object.keys(openRadioWindows).forEach(k => closeRadioWindow(k));
    }

    loadSimulationState().then(() => {
        updateJrgSelectOptions();
        renderUnits(); renderEvents(); renderSelectedEventDetails();
        if (typeof updateMainRadioChat === 'function') updateMainRadioChat();
    });

    const mainHdr = document.querySelector('#main-radio-modal .main-radio-header span');
    if (mainHdr) mainHdr.innerText = `📻 Główne Radio SKKP (${currentCountyCallsign})`;
    if (typeof updateMainRadioChat === 'function') updateMainRadioChat();

    stationsGeocoded = false;
    geocodeAllFireStationsExact();
    if (leafletMap) {
        leafletMap.setView(profile.mapCenter, 11);
        updateMapMarkers();
    }
    trackMyPresence();
}

function updateSubtypes(type) {
    const select = document.getElementById('inp-ev-subtype');
    const group = document.getElementById('subtype-group');
    if(!select) return;
    select.innerHTML = '';
    if (group) {
        if (type === 'PZR') { group.style.display = 'none'; return; }
        else { group.style.display = 'flex'; }
    }
    (subtypesData[type] || ["Brak"]).forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub; opt.innerText = sub;
        select.appendChild(opt);
    });
}

async function saveSimulationState(forceImmediateBroadcast = true) {
    if (isApplyingRemoteState) return;
    try {
        const stateObj = {
            version: APP_VERSION,
            countyId: currentCountyId,
            senderId: myClientId,
            savedAt: new Date().toISOString(),
            events,
            unitsPSP,
            unitsOSP,
            unitExactLocations,
            shiftStats,
            cprCounter,
            mainRadioLogs: mainRadioLogs.slice(-100)
        };
        localStorage.setItem(getStorageKeyForCounty(currentCountyId), JSON.stringify(stateObj));

        if (coopChannel && forceImmediateBroadcast) {
            coopChannel.send({
                type: 'broadcast',
                event: 'swd_state_sync',
                payload: { senderId: myClientId, countyId: currentCountyId, stateObj }
            }).catch(() => {});
        }

        const nowMs = Date.now();
        if (supabaseClient && (forceImmediateBroadcast || nowMs - lastDbSyncTimestamp > 2500)) {
            lastDbSyncTimestamp = nowMs;
            await supabaseClient
                .from('swd_state')
                .upsert({ id: currentCountyId, data: stateObj });
        }
    } catch (e) {}
}

async function loadSimulationState() {
    try {
        if (supabaseClient) {
            const { data, error } = await supabaseClient
                .from('swd_state')
                .select('data')
                .eq('id', currentCountyId)
                .single();

            if (!error && data && data.data && Array.isArray(data.data.events)) {
                applyRemoteStatePayload(data.data);
                return true;
            }
        }
    } catch (e) {}

    try {
        const raw = localStorage.getItem(getStorageKeyForCounty(currentCountyId));
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.events)) return false;

        events = data.events;
        if (Array.isArray(data.unitsPSP) && data.unitsPSP.length >= 2) unitsPSP = data.unitsPSP;
        if (Array.isArray(data.unitsOSP) && data.unitsOSP.length >= 2) unitsOSP = data.unitsOSP;
        if (data.unitExactLocations) {
            Object.keys(data.unitExactLocations).forEach(k => {
                if (!unitExactLocations[k]) unitExactLocations[k] = data.unitExactLocations[k];
            });
        }
        if (data.shiftStats) shiftStats = data.shiftStats;
        if (typeof data.cprCounter === 'number') cprCounter = data.cprCounter;
        if (Array.isArray(data.mainRadioLogs)) mainRadioLogs = data.mainRadioLogs;

        if (events.length > 0) {
            selectedEvIdForRadio = events[events.length - 1].id;
            const btnOpen = document.getElementById('btn-open-radio');
            if (btnOpen) btnOpen.style.display = 'block';
        }
        return true;
    } catch (e) { return false; }
}

function exportShiftStateToFile() {
    saveSimulationState(true);
    const raw = localStorage.getItem(getStorageKeyForCounty(currentCountyId)) || "{}";
    const blob = new Blob([raw], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SWDST_${currentCountyId}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importShiftStateFromFile() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const parsed = JSON.parse(ev.target.result);
                if (!parsed || !Array.isArray(parsed.events)) { alert("Nieprawidłowy plik zapisu służby!"); return; }
                if (parsed.countyId && COUNTY_PROFILES[parsed.countyId]) currentCountyId = parsed.countyId;
                localStorage.setItem(getStorageKeyForCounty(currentCountyId), JSON.stringify(parsed));
                applyCountyProfile(currentCountyId);
                saveSimulationState(true);
                alert("✅ Pomyślnie wczytano zapis służby z pliku i zsynchronizowano z chmurą!");
            } catch (err) { alert("Błąd podczas odczytu pliku zapisu!"); }
        };
        reader.readAsText(file);
    };
    inp.click();
}

async function resetShiftState() {
    if (!confirm("Czy na pewno chcesz zresetować obecną służbę i przywrócić pełny podział bojowy w wybranym rejonie (również u kolegi)?")) return;
    localStorage.removeItem(getStorageKeyForCounty(currentCountyId));
    if (supabaseClient) {
        try { await supabaseClient.from('swd_state').delete().eq('id', currentCountyId); } catch (e) {}
    }
    applyCountyProfile(currentCountyId);
    saveSimulationState(true);
    const sisBody = document.getElementById('details-sis-body');
    if (sisBody) sisBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #888;">Brak wybranego zdarzenia</td></tr>';
}

function ensureCoopIntercomWindow() {
    if (coopIntercomModalEl) return coopIntercomModalEl;
    const modal = document.createElement('div');
    modal.id = 'coop-intercom-modal';
    modal.style.cssText = 'position:fixed; z-index:1048; width:430px; left:20px; bottom:35px; display:none;';
    modal.innerHTML = `
        <div style="background: #c0c0c0; border: 2px solid #ffffff; border-right-color: #404040; border-bottom-color: #404040; box-shadow: 2px 2px 8px rgba(0,0,0,0.5); font-family: 'Segoe UI', Tahoma, sans-serif;">
            <div class="coop-intercom-header" style="background: linear-gradient(90deg, #155724, #1e7e34); color: #ffffff; padding: 4px 8px; font-weight: bold; font-size: 13px; display: flex; justify-content: space-between; align-items: center; cursor: move; user-select: none;">
                <span>🎧 Telefon Dyżurny / Interkom Co-op (Stanowiska SK)</span>
                <div style="display: flex; gap: 2px;">
                    <button style="background: #c0c0c0; border: 1px solid #fff; width: 18px; height: 16px; font-size: 10px; font-weight: bold; cursor: pointer; padding: 0;" onclick="closeCoopIntercom()">✕</button>
                </div>
            </div>
            <div style="padding: 6px; background: #ece9d8;">
                <div style="font-size: 11px; font-weight: bold; color: #0a246a; margin-bottom: 4px;">Aktywni dyspozytorzy na dyżurze:</div>
                <div id="coop-peers-list" style="background: #ffffff; border: 1px solid #7f9db9; padding: 4px 6px; font-size: 11px; max-height: 55px; overflow-y: auto; margin-bottom: 6px;"></div>
                <div id="coop-intercom-chat" style="background: #1a1a1a; color: #00ff99; font-family: 'Consolas', monospace; font-size: 12px; height: 165px; padding: 6px; overflow-y: auto; border: 2px solid #808080; line-height: 1.35;">
                    <div style="color:#aaa; font-style:italic;">[Interkom] Linia dyżurna pomiędzy stanowiskami aktywna...</div>
                </div>
                <div style="display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap;">
                    <button class="btn-win" style="font-size: 10px; padding: 2px 6px; background: #fff3a1; font-weight: bold;" onclick="sendCoopBuzzer()">🔔 Zadzwoń brzęczykiem</button>
                    <button class="btn-win" style="font-size: 10px; padding: 2px 6px;" onclick="sendQuickIntercom('Odbierz formatkę 112, ja prowadzę radio!')">📞 Odbierz 112</button>
                    <button class="btn-win" style="font-size: 10px; padding: 2px 6px;" onclick="sendQuickIntercom('Doślij dodatkowe SiS do aktywnego zdarzenia!')">🚒 Doślij SiS</button>
                    <button class="btn-win" style="font-size: 10px; padding: 2px 6px;" onclick="sendQuickIntercom('Zabezpiecz rejon (PZR) wolnym zastępem OSP!')">🛡️ Zrób PZR</button>
                </div>
                <div style="display: flex; gap: 4px; margin-top: 6px;">
                    <input type="text" id="inp-coop-intercom" placeholder="Napisz do drugiego dyspozytora..." style="flex: 1; padding: 4px 6px; font-size: 12px; border: 2px solid #808080;" onkeypress="if(event.key==='Enter') sendCustomIntercom()">
                    <button class="btn-win" style="font-weight: bold; padding: 4px 10px; background: #e2f0d9;" onclick="sendCustomIntercom()">Wyślij</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    makeDraggable(modal, modal.querySelector('.coop-intercom-header'));
    coopIntercomModalEl = modal;
    renderCoopIntercomPeers();
    return modal;
}

function openCoopIntercom() {
    const modal = ensureCoopIntercomWindow();
    modal.style.display = 'block';
    renderCoopIntercomPeers();
}

function closeCoopIntercom() {
    if (coopIntercomModalEl) coopIntercomModalEl.style.display = 'none';
}

function renderCoopIntercomPeers() {
    const box = document.getElementById('coop-peers-list');
    if (!box) return;
    const peers = Object.values(onlinePeers);
    if (peers.length === 0) {
        box.innerHTML = `<span style="color:#666;">Trwa łączenie z serwerem Co-op...</span>`;
        return;
    }
    box.innerHTML = peers.map(p => {
        const isMe = p.clientId === myClientId;
        return `<div style="padding: 1px 0;">🟢 <b>${p.name}</b> ${isMe ? '(Ty)' : ''} — <span style="color:#155724; font-weight:bold;">[${p.role}]</span> • <span style="color:#0a246a;">${p.countyName}</span></div>`;
    }).join('');
}

function sendQuickIntercom(text) {
    transmitIntercomMessage(text, false);
}

function sendCustomIntercom() {
    const inp = document.getElementById('inp-coop-intercom');
    if (!inp || !inp.value.trim()) return;
    transmitIntercomMessage(inp.value.trim(), false);
    inp.value = '';
}

function sendCoopBuzzer() {
    transmitIntercomMessage("🔔 [SYGNAŁ BRZĘCZYKA DYŻURNEGO — PILNY KONTAKT!]", true);
}

function transmitIntercomMessage(text, isBuzzer = false) {
    const profile = COUNTY_PROFILES[currentCountyId] || RAW_PROFILES[0];
    const msgPayload = {
        senderId: myClientId,
        senderName: getFormattedOperatorName(),
        senderRole: currentUserRole,
        countyName: profile ? profile.radioCallsign : currentCountyId,
        text: text,
        isBuzzer: isBuzzer,
        time: new Date().toLocaleTimeString()
    };
    appendIntercomLog(msgPayload);
    if (coopChannel) {
        coopChannel.send({
            type: 'broadcast',
            event: 'swd_intercom_msg',
            payload: msgPayload
        }).catch(() => {});
    }
}

function receiveCoopIntercomMessage(payload) {
    ensureCoopIntercomWindow();
    if (payload.isBuzzer) {
        audioCpr.currentTime = 0; audioCpr.play().catch(() => {});
        openCoopIntercom();
    } else {
        audioMotorola.currentTime = 0; audioMotorola.play().catch(() => {});
    }
    appendIntercomLog(payload);
}

function appendIntercomLog(p) {
    ensureCoopIntercomWindow();
    const color = p.isBuzzer ? '#ffcc00' : (p.senderId === myClientId ? '#00ffff' : '#7CFC00');
    coopIntercomLogs.push(`<div style="margin-bottom:5px; color:${color}; border-bottom:1px dashed #333; padding-bottom:2px;"><span style="color:#aaa;">[${p.time}]</span> <b>${p.senderName} (${p.countyName} • ${p.senderRole}):</b><br>${p.text}</div>`);
    const chat = document.getElementById('coop-intercom-chat');
    if (chat) {
        chat.innerHTML = coopIntercomLogs.join('');
        chat.scrollTop = chat.scrollHeight;
    }
}

function openMutualAidModal() {
    let modal = document.getElementById('modal-mutual-aid');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-mutual-aid';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display:none; background:rgba(0,0,0,0.5); z-index:11500;';
        document.body.appendChild(modal);
    }

    const cityInput = document.getElementById('inp-ev-city');
    const targetCity = (cityInput && cityInput.value.trim()) ? cityInput.value.trim() : COUNTY_PROFILES[currentCountyId].defaultTown;
    const otherCounties = RAW_PROFILES.filter(rp => rp.id !== currentCountyId);
    const countyOptions = otherCounties.map(rp => `<option value="${rp.id}">${rp.name} (${rp.radioCallsign})</option>`).join('');

    modal.innerHTML = `
        <div class="modal-window" style="width: 620px; background: #ece9d8; border: 2px solid #155724; box-shadow: 0 6px 20px rgba(0,0,0,0.5);">
            <div class="modal-header" style="background: linear-gradient(90deg, #155724, #1e7e34); color: #fff; padding: 5px 10px;">
                <span>🤝 Wsparcie Międzypowiatowe (Pomoc Sąsiedzka z Ościennych Komend PSP)</span>
                <div class="modal-close" onclick="closeModal('modal-mutual-aid')">×</div>
            </div>
            <div class="modal-body" style="padding: 10px; display:flex; flex-direction:column; gap:8px;">
                <div style="background:#e2f0d9; border:1px solid #155724; padding:6px 10px; font-size:11px; color:#000;">
                    📍 <b>Miejsce docelowe wsparcia:</b> <span style="color:#b30000; font-weight:bold;">${targetCity}</span> (${COUNTY_PROFILES[currentCountyId].name}).<br>
                    Możesz wysłać zapotrzebowanie do kolegi pełniącego służbę na sąsiedniej komendzie lub bezpośrednio zadysponować zastęp z powiatu ościennego:
                </div>
                <div class="form-box" style="padding: 8px;">
                    <div class="form-title" style="margin-bottom:4px;">1. Wybierz komendę ościenną (powiat wspierający):</div>
                    <select id="mutual-aid-county-select" style="width:100%; padding:5px; font-weight:bold;" onchange="renderMutualAidVehiclesList()">
                        ${countyOptions}
                    </select>
                </div>
                <div class="form-box" style="padding: 8px;">
                    <div class="form-title" style="margin-bottom:4px;">2. Wyślij zapotrzebowanie przez Co-op do dyspozytora tej komendy:</div>
                    <div style="display:flex; gap:6px;">
                        <input type="text" id="mutual-aid-req-note" placeholder="np. Potrzebujemy ciężkiego GCBA i podnośnika do pożaru hali!" style="flex:1; padding:4px 6px;">
                        <button type="button" class="btn-win" style="background:#fff3a1; font-weight:bold; padding:4px 10px;" onclick="sendMutualAidRequestToPeer()">📨 Wyślij prośbę o wsparcie (Co-op)</button>
                    </div>
                </div>
                <div class="form-box" style="padding: 8px;">
                    <div class="form-title" style="margin-bottom:4px;">3. Lub zaznacz zastępy z sąsiedniego powiatu do bezpośredniego zadysponowania:</div>
                    <div id="mutual-aid-vehicles-box" style="max-height:220px; overflow-y:auto; background:#fff; border:1px solid #999; padding:4px;"></div>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:6px;">
                    <button type="button" class="btn-win" style="padding:5px 14px; font-weight:bold; background:#e2f0d9; color:#155724;" onclick="confirmDirectMutualAidDispatch()">✔ Zadysponuj wybrane wsparcie</button>
                    <button type="button" class="btn-win" style="padding:5px 12px;" onclick="closeModal('modal-mutual-aid')">Zamknij</button>
                </div>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
    renderMutualAidVehiclesList();
}

function renderMutualAidVehiclesList() {
    const sel = document.getElementById('mutual-aid-county-select');
    const box = document.getElementById('mutual-aid-vehicles-box');
    if (!sel || !box) return;
    const neighborProfile = COUNTY_PROFILES[sel.value];
    if (!neighborProfile) return;

    let html = '';
    neighborProfile.unitsPSP.forEach(u => {
        html += `<div style="background:#dbe8f9; padding:3px 6px; font-weight:bold; font-size:11px; margin-top:4px;">🚒 ${u.name} (${neighborProfile.name})</div>`;
        u.vehicles.forEach(v => {
            const isChecked = selectedVehicles.some(sv => sv.id === v.id);
            html += `
                <label style="display:flex; align-items:center; gap:6px; padding:3px 8px; border-bottom:1px solid #eee; cursor:pointer; font-size:11px; color:#000;">
                    <input type="checkbox" class="mutual-aid-cb" data-unit="${u.name}" data-county="${neighborProfile.id}" value="${v.id}" ${isChecked ? 'checked' : ''}>
                    <span class="status-dot green"></span>
                    <span><b>${v.id}</b> - ${v.name} (Obsada: ${v.obsada})</span>
                </label>
            `;
        });
    });
    box.innerHTML = html;
}

function confirmDirectMutualAidDispatch() {
    const sel = document.getElementById('mutual-aid-county-select');
    if (!sel) return;
    const neighborProfile = COUNTY_PROFILES[sel.value];
    if (!neighborProfile) return;

    const checkedCbs = Array.from(document.querySelectorAll('#mutual-aid-vehicles-box input.mutual-aid-cb:checked'));
    checkedCbs.forEach(cb => {
        const vehId = cb.value;
        if (!selectedVehicles.some(sv => sv.id === vehId)) {
            neighborProfile.unitsPSP.forEach(u => {
                const found = u.vehicles.find(v => v.id === vehId);
                if (found) {
                    const routeSec = Math.floor(Math.random() * 60) + 120;
                    selectedVehicles.push({
                        ...found,
                        unitName: `${u.name} [WSPARCIE]`,
                        phase: 'PREP',
                        prepTime: Math.floor(Math.random() * 30) + 30,
                        travelTime: routeSec,
                        baseRouteSeconds: routeSec,
                        returnTime: routeSec
                    });
                }
            });
        }
    });

    const countLbl = document.getElementById('lbl-selected-count');
    if (countLbl) countLbl.innerText = "Wybrano pojazdów: " + selectedVehicles.length;
    closeModal('modal-mutual-aid');
}

function sendMutualAidRequestToPeer() {
    const sel = document.getElementById('mutual-aid-county-select');
    const noteInp = document.getElementById('mutual-aid-req-note');
    const cityInp = document.getElementById('inp-ev-city');
    const streetInp = document.getElementById('inp-ev-street');
    if (!sel) return;

    const reqPayload = {
        senderId: myClientId,
        senderName: getFormattedOperatorName(),
        requesterCountyId: currentCountyId,
        requesterCallsign: currentCountyCallsign,
        targetCountyId: sel.value,
        eventId: activeEditingId || (events.length + 1),
        city: (cityInp && cityInp.value.trim()) ? cityInp.value.trim() : COUNTY_PROFILES[currentCountyId].defaultTown,
        street: streetInp ? streetInp.value.trim() : '',
        note: (noteInp && noteInp.value.trim()) ? noteInp.value.trim() : 'Prośba o zadysponowanie zastępu wsparcia (GCBA / SD).'
    };

    if (coopChannel) {
        coopChannel.send({
            type: 'broadcast',
            event: 'swd_mutual_aid_req',
            payload: reqPayload
        }).catch(() => {});
    }
    transmitIntercomMessage(`🤝 [ZAPOTRZEBOWANIE MIĘDZYPOWIATOWE do ${sel.value.toUpperCase()}]: ${reqPayload.note} (Miejscowość: ${reqPayload.city})`, true);
    alert("✅ Wysłano zapotrzebowanie na wsparcie do stanowiska kierowania sąsiedniego powiatu!");
    closeModal('modal-mutual-aid');
}

function showIncomingMutualAidRequest(payload) {
    audioCpr.currentTime = 0; audioCpr.play().catch(() => {});
    let modal = document.getElementById('modal-incoming-aid');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-incoming-aid';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display:none; background:rgba(128,0,0,0.45); z-index:12500;';
        document.body.appendChild(modal);
    }

    const freeVehs = [];
    unitsPSP.forEach(u => {
        u.vehicles.forEach(v => {
            if (v.status === 'green') freeVehs.push({ ...v, unitName: u.name });
        });
    });

    const vehOptions = freeVehs.map(v => `<option value="${v.id}">${v.id} - ${v.name} (${v.unitName})</option>`).join('');

    modal.innerHTML = `
        <div class="modal-window" style="width: 480px; background: #fff0f0; border: 2px solid #b30000; box-shadow: 0 6px 25px rgba(0,0,0,0.6);">
            <div class="modal-header" style="background: #b30000; color: #fff; padding: 6px 10px;">
                <span>🚨 PILNE ZAPOTRZEBOWANIE NA WSPARCIE z ${payload.requesterCallsign}!</span>
                <div class="modal-close" onclick="closeModal('modal-incoming-aid')">×</div>
            </div>
            <div class="modal-body" style="padding: 12px; display:flex; flex-direction:column; gap:8px; color:#000;">
                <div><b>Dyspozytor wzywający:</b> ${payload.senderName} (${payload.requesterCallsign})</div>
                <div><b>Miejsce akcji:</b> ${payload.city}${payload.street ? ', ' + payload.street : ''}</div>
                <div style="background:#fff; border:1px solid #b30000; padding:6px; font-weight:bold; color:#800000;">"${payload.note}"</div>
                <div class="form-group">
                    <label>Wybierz wolny zastęp ze swojego powiatu do przekazania:</label>
                    <select id="incoming-aid-veh-select" style="padding:5px; font-weight:bold;">
                        ${vehOptions || '<option value="">Brak wolnych pojazdów PSP</option>'}
                    </select>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:6px;">
                    <button class="btn-win" style="background:#e2f0d9; font-weight:bold; padding:5px 14px;" onclick='approveMutualAidGrant(${JSON.stringify(payload)})'>🚀 Przekaż i zadysponuj zastęp</button>
                    <button class="btn-win" onclick="closeModal('modal-incoming-aid')">Odrzuć</button>
                </div>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

function approveMutualAidGrant(reqPayload) {
    const sel = document.getElementById('incoming-aid-veh-select');
    if (!sel || !sel.value) { closeModal('modal-incoming-aid'); return; }
    const chosenId = sel.value;
    let grantedVeh = null;
    let grantedUnit = "";

    unitsPSP.forEach(u => {
        const v = u.vehicles.find(x => x.id === chosenId);
        if (v) {
            v.status = 'orange';
            grantedVeh = { ...v };
            grantedUnit = u.name;
        }
    });

    if (grantedVeh && coopChannel) {
        coopChannel.send({
            type: 'broadcast',
            event: 'swd_mutual_aid_grant',
            payload: {
                senderId: myClientId,
                providerCallsign: currentCountyCallsign,
                requesterCountyId: reqPayload.requesterCountyId,
                eventId: reqPayload.eventId,
                city: reqPayload.city,
                vehicle: grantedVeh,
                unitName: `${grantedUnit} [WSPARCIE]`
            }
        }).catch(() => {});
        logToMainRadio(`${currentCountyCallsign} ➔ ${chosenId}`, `Zadysponowano zastęp ${chosenId} poza teren powiatu — wsparcie dla ${reqPayload.requesterCallsign} (${reqPayload.city}).`, '#00ffff', true);
        renderUnits();
        saveSimulationState(true);
    }
    closeModal('modal-incoming-aid');
}

function receiveGrantedMutualAidVehicle(payload) {
    if (!payload || !payload.vehicle) return;
    const routeSec = 120;
    const newVehEntry = {
        ...payload.vehicle,
        unitName: payload.unitName,
        phase: 'PREP',
        prepTime: 30,
        travelTime: routeSec,
        baseRouteSeconds: routeSec,
        returnTime: routeSec
    };

    const modalEv = document.getElementById('modal-event');
    if (modalEv && modalEv.style.display === 'flex') {
        if (!selectedVehicles.some(sv => sv.id === newVehEntry.id)) {
            selectedVehicles.push(newVehEntry);
            const countLbl = document.getElementById('lbl-selected-count');
            if (countLbl) countLbl.innerText = "Wybrano pojazdów: " + selectedVehicles.length;
        }
    } else if (events.length > 0) {
        const targetEv = events.find(e => e.id === payload.eventId && e.status === 'ACTIVE') || events.find(e => e.status === 'ACTIVE');
        if (targetEv && !targetEv.vehicles.some(v => v.id === newVehEntry.id)) {
            targetEv.vehicles.push(newVehEntry);
            renderEvents();
            renderSelectedEventDetails();
            saveSimulationState(true);
        }
    }

    logToMainRadio(`SKKW / ${payload.providerCallsign}`, `Przekazujemy zastęp ${newVehEntry.id} (${newVehEntry.unitName}) jako wsparcie do działań w m. ${payload.city}!`, '#00ff7f', true);
}

function setSimulationSpeed(speed, broadcastToPeer = true) {
    simSpeed = speed;
    [1, 2, 5].forEach(s => {
        const btn = document.getElementById(`btn-speed-${s}x`);
        if (btn) {
            btn.style.background = s === speed ? '#0a246a' : '#e1e1e1';
            btn.style.color = s === speed ? '#ffffff' : '#000000';
        }
    });
    startSimulationLoop();
    scheduleNextAutoCPR();

    if (broadcastToPeer && coopChannel) {
        coopChannel.send({
            type: 'broadcast',
            event: 'swd_speed_sync',
            payload: { senderId: myClientId, speed: speed }
        }).catch(() => {});
    }
}

function injectSpeedAndSaveControls() {
    if (document.getElementById('swd-speed-controls')) return;
    const btnOpenRadio = document.getElementById('btn-open-radio');
    if (btnOpenRadio && btnOpenRadio.parentElement) {
        const bar = btnOpenRadio.parentElement;
        bar.style.flexWrap = 'wrap';
        const speedBox = document.createElement('div');
        speedBox.id = 'swd-speed-controls';
        speedBox.style.cssText = 'display: inline-flex; align-items: center; gap: 3px; background: #d4d0c8; border: 1px solid #808080; padding: 2px 6px; border-radius: 2px; margin-left: auto;';
        speedBox.innerHTML = `
            <button class="btn-win" style="padding: 1px 8px; font-weight: bold; background:#d4edda; color:#155724; border-color:#155724;" onclick="openCoopIntercom()">🎧 Interkom Co-op</button>
            <span style="margin: 0 2px; color:#777;">|</span>
            <span style="font-weight:bold; color:#000; margin-right:2px;">⏩ Tempo:</span>
            <button id="btn-speed-1x" class="btn-win" style="padding: 1px 7px; font-weight: bold; background: #0a246a; color: #fff;" onclick="setSimulationSpeed(1, true)">1x</button>
            <button id="btn-speed-2x" class="btn-win" style="padding: 1px 7px; font-weight: bold;" onclick="setSimulationSpeed(2, true)">2x</button>
            <button id="btn-speed-5x" class="btn-win" style="padding: 1px 7px; font-weight: bold;" onclick="setSimulationSpeed(5, true)">5x</button>
            <span style="margin: 0 3px; color:#777;">|</span>
            <button class="btn-win" style="padding: 1px 6px; font-weight: bold; background:#eef4ff; color:#0a246a;" onclick="openLauncherModal()">👤 Rola / Komenda</button>
            <button class="btn-win" style="padding: 1px 6px; font-weight: bold;" onclick="exportShiftStateToFile()">💾 Eksportuj</button>
            <button class="btn-win" style="padding: 1px 6px;" onclick="importShiftStateFromFile()">📂 Wczytaj</button>
            <button class="btn-win" style="padding: 1px 6px; background:#ffe6e6; color:#800000;" onclick="resetShiftState()">🗑️ Reset</button>
        `;
        bar.appendChild(speedBox);
    }
}

function injectPzrStyles() {
    if (document.getElementById('swd-pzr-styles')) return;
    const style = document.createElement('style');
    style.id = 'swd-pzr-styles';
    style.innerHTML = `
        .status-dot.yellow { background-color: #f1c40f !important; box-shadow: 0 0 4px #d4ac0d; }
        .vehicle-row.pzr-active { background-color: #fff8c4 !important; border-left: 3px solid #f1c40f !important; }
        .unit-box.unit-on-pzr { border: 1.5px solid #d4ac0d !important; background-color: #fffdf0 !important; }
        .unit-header.header-on-pzr { background-color: #ffe875 !important; color: #000000 !important; }
    `;
    document.head.appendChild(style);
}

function getActivePzrForVehicle(vehId) {
    let foundPzrEv = null;
    events.forEach(ev => {
        if (ev.status === 'ACTIVE' && ev.type === 'PZR') {
            if (ev.vehicles && ev.vehicles.some(v => v.id === vehId)) foundPzrEv = ev;
        }
    });
    return foundPzrEv;
}

function isVehicleInCombatAction(vehId) {
    return events.some(ev => {
        if (ev.type === 'PZR') return false;
        if (ev.status === 'ACTIVE') return ev.vehicles.some(v => v.id === vehId && v.phase !== 'DONE');
        if (ev.status === 'FINISHED') return ev.vehicles.some(v => v.id === vehId && v.phase === 'RETURN' && v.returnTime > 0);
        return false;
    });
}

function makeDraggable(elmnt, header) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    if (header) header.onmousedown = dragMouseDown;
    function dragMouseDown(e) {
        if (e.target.closest('.modal-close, .modal-min, button')) return;
        e.preventDefault();
        pos3 = e.clientX; pos4 = e.clientY;
        const rect = elmnt.getBoundingClientRect();
        elmnt.style.position = 'fixed';
        elmnt.style.left = rect.left + 'px'; elmnt.style.top = rect.top + 'px';
        elmnt.style.margin = '0'; elmnt.style.right = 'auto'; elmnt.style.bottom = 'auto';
        document.onmouseup = closeDragElement; document.onmousemove = elementDrag;
    }
    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY;
        pos3 = e.clientX; pos4 = e.clientY;
        elmnt.style.top = (elmnt.offsetTop - pos2) + 'px';
        elmnt.style.left = (elmnt.offsetLeft - pos1) + 'px';
    }
    function closeDragElement() { document.onmouseup = null; document.onmousemove = null; }
}

function ensureVersionBadgeInStatusBar() {
    const clockBox = document.getElementById('clock-box');
    if (!clockBox || !clockBox.parentElement) return;

    let weatherBadge = document.getElementById('weather-status-badge');
    if (!weatherBadge) {
        weatherBadge = document.createElement('div');
        weatherBadge.id = 'weather-status-badge';
        weatherBadge.style.cssText = 'display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: bold; color: #004080; background: #eef4ff; border: 1px solid #7f9db9; margin-left: 4px; vertical-align: middle; cursor: pointer;';
        weatherBadge.title = "Aktualna pogoda w powiecie (kliknij, aby wylosować zmianę pogody)";
        weatherBadge.onclick = () => triggerWeatherChange();
        weatherBadge.innerText = currentWeatherData.label;
        clockBox.parentElement.insertBefore(weatherBadge, clockBox);
    }

    let badge = document.getElementById('swdst-version-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'swdst-version-badge';
        badge.style.cssText = 'display: inline-block; padding: 2px 6px; font-size: 11px; font-weight: bold; color: #000; background: #ece9d8; border: 1px solid #7f9db9; margin-left: 4px; vertical-align: middle; cursor: pointer;';
        badge.title = "Kliknij, aby zmienić komendę / rolę Co-op";
        badge.onclick = () => openLauncherModal();
        badge.innerText = `${APP_VERSION} (${simSpeed}x)`;
        clockBox.parentElement.insertBefore(badge, clockBox);
    } else {
        badge.innerText = `${APP_VERSION} (${simSpeed}x)`;
    }
}

function ensureSubtypeDOMIntegration() {
    const radios = document.querySelectorAll('input[name="ev-type"]');
    radios.forEach(r => { r.onclick = () => updateSubtypes(r.value); });
    if (!document.getElementById('inp-ev-subtype') && radios.length > 0) {
        const radioRow = radios[0].closest('.form-row');
        if (radioRow && radioRow.parentElement) {
            const subGroup = document.createElement('div');
            subGroup.className = 'form-group'; subGroup.id = 'subtype-group'; subGroup.style.marginTop = '4px';
            subGroup.innerHTML = `<label>Podrodzaj:</label><select id="inp-ev-subtype"></select>`;
            radioRow.insertAdjacentElement('afterend', subGroup);
        }
    }
    updateSubtypes('P');
}

function safeSetElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

function ensureSiSModalExists() {
    let sisModal = document.getElementById('modal-sis');
    if (!sisModal) {
        sisModal = document.createElement('div');
        sisModal.className = 'modal-overlay'; sisModal.id = 'modal-sis';
        document.body.appendChild(sisModal);
    }
    sisModal.innerHTML = `
        <div class="modal-window" style="width: 780px; height: 500px;">
            <div class="modal-header">
                <span>🚒 Zarządzanie Siłami i Środkami (Podział Bojowy)</span>
                <div class="modal-close" onclick="closeModal('modal-sis')">×</div>
            </div>
            <div class="modal-body" style="display:flex; flex-direction:column; gap:8px;">
                <div style="display: flex; gap: 8px;">
                    <div class="form-box" style="flex:1;">
                        <div class="form-title">Państwowa Straż Pożarna (JRG)</div>
                        <div style="display:flex; gap:6px; margin-top:6px;">
                            <button class="btn-win" onclick="addCustomUnit('PSP')">➕ Dodaj jednostkę PSP</button>
                            <button class="btn-win" onclick="addCustomVehicle('PSP')">🚒 Dodaj pojazd PSP</button>
                        </div>
                    </div>
                    <div class="form-box" style="flex:1;">
                        <div class="form-title">Ochotnicza Straż Pożarna (OSP)</div>
                        <div style="display:flex; gap:6px; margin-top:6px;">
                            <button class="btn-win" onclick="addCustomUnit('OSP')">➕ Dodaj jednostkę OSP</button>
                            <button class="btn-win" onclick="addCustomVehicle('OSP')">🚒 Dodaj pojazd OSP</button>
                        </div>
                    </div>
                </div>
                <div class="form-box" style="flex:1; overflow-y:auto;">
                    <div class="form-title">Wykaz jednostek, oficjalnych adresów strażnic oraz statusów pojazdów:</div>
                    <div id="sis-manager-list" style="max-height:300px; overflow-y:auto;"></div>
                </div>
            </div>
            <div style="padding: 6px; background: #e1e1e1; display: flex; justify-content: flex-end;">
                <button class="btn-win" onclick="closeModal('modal-sis')">Zamknij</button>
            </div>
        </div>
    `;
    const win = sisModal.querySelector('.modal-window');
    const hdr = sisModal.querySelector('.modal-header');
    if (win && hdr) makeDraggable(win, hdr);
}

function renderSiSManagerList() {
    const container = document.getElementById('sis-manager-list');
    if (!container) return;
    let html = `<table class="sis-table"><thead><tr><th>Jednostka</th><th>Oficjalny adres strażnicy</th><th>Kryptonim</th><th>Pojazd</th><th>Status</th><th>Akcja</th></tr></thead><tbody>`;
    [...unitsPSP, ...unitsOSP].forEach(u => {
        const addr = unitExactLocations[u.name]?.address || "";
        u.vehicles.forEach(v => {
            const stText = v.status === 'green' ? 'W bazie' : (v.status === 'yellow' ? 'Zabezpieczenie rejonu (PZR)' : (v.status === 'orange' ? 'W drodze / Powrót' : 'W akcji na miejscu'));
            const stColor = v.status === 'green' ? '#155724' : (v.status === 'yellow' ? '#b38600' : (v.status === 'orange' ? '#b36b00' : '#b30000'));
            html += `
                <tr style="${v.status === 'yellow' ? 'background:#fff8c4;' : ''}">
                    <td><b>${u.name}</b></td>
                    <td style="font-size:10px; color:#333;">${addr}</td>
                    <td><b>${v.id}</b></td>
                    <td>${v.name}</td>
                    <td style="color:${stColor}; font-weight:bold;">${stText}</td>
                    <td>
                        <button class="btn-win" style="font-size:10px; padding:1px 5px;" onclick="setVehicleStatusManual('${v.id}', 'green')">Wolny</button>
                        <button class="btn-win" style="font-size:10px; padding:1px 5px; background:#fff3a1;" onclick="setVehicleStatusManual('${v.id}', 'yellow')">PZR</button>
                        <button class="btn-win" style="font-size:10px; padding:1px 5px;" onclick="setVehicleStatusManual('${v.id}', 'red')">W akcji</button>
                    </td>
                </tr>
            `;
        });
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
}

function setVehicleStatusManual(vehId, newStatus) {
    getAllUnitsIncludingSgr().forEach(u => {
        const v = u.vehicles.find(x => x.id === vehId);
        if (v) v.status = newStatus;
    });
    renderUnits(); renderSiSManagerList(); updateMapMarkers(); saveSimulationState(true);
}

async function addCustomUnit(type) {
    const defTown = COUNTY_PROFILES[currentCountyId].defaultTown;
    const name = prompt(`Podaj nazwę nowej jednostki ${type}:`);
    if (!name || !name.trim()) return;
    const town = prompt(`Podaj miejscowość stacjonowania jednostki:`, defTown) || defTown;
    const address = prompt(`Podaj dokładną ulicę i numer strażnicy:`, `ul. Strażacka 1, ${town}`) || town;
    const tCoords = gpsCoords[town.trim()] || COUNTY_PROFILES[currentCountyId].mapCenter;
    unitExactLocations[name.trim()] = { town: town.trim(), address: address.trim(), lat: tCoords[0], lng: tCoords[1] };

    if (type === 'PSP') unitsPSP.push({ name: name.trim(), vehicles: [] });
    else unitsOSP.push({ name: name.trim(), vehicles: [] });

    const exact = await resolveExactCoordinates(address, town);
    if (exact) { unitExactLocations[name.trim()].lat = exact.lat; unitExactLocations[name.trim()].lng = exact.lng; }
    renderUnits(); renderSiSManagerList(); updateMapMarkers(); saveSimulationState(true);
}

function addCustomVehicle(type) {
    const targetArray = type === 'PSP' ? unitsPSP : unitsOSP;
    const unitName = prompt(`Podaj dokładną nazwę jednostki ${type}:`, targetArray[0]?.name || "");
    if (!unitName) return;
    const unit = targetArray.find(u => u.name.toLowerCase() === unitName.trim().toLowerCase());
    if (!unit) { alert("Nie znaleziono takiej jednostki na liście!"); return; }
    const id = prompt("Podaj numer operacyjny pojazdu:", currentCountyId === "raciborski" ? "569[S]99" : "559[G]99");
    const vName = prompt("Podaj typ i markę pojazdu:", "GBA 2,5/16 MAN");
    if (id && vName) {
        unit.vehicles.push({ id: id.trim(), name: vName.trim(), status: "green", obsada: 6 });
        renderUnits(); renderSiSManagerList(); updateMapMarkers(); saveSimulationState(true);
    }
}

function ensureReportsModalExists() {
    if (document.getElementById('modal-reports')) return;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay'; modal.id = 'modal-reports';
    modal.innerHTML = `
        <div class="modal-window" style="width: 920px; height: 660px; background: #d4d0c8; border: 2px solid #0a246a;">
            <div class="modal-header" style="background: #0a246a; color: #fff; padding: 4px 8px;">
                <span>Raporty — Statystyka</span>
                <div class="modal-close" onclick="closeModal('modal-reports')">×</div>
            </div>
            <div class="modal-body" style="padding: 8px; background: #d4d0c8; display: flex; flex-direction: column; gap: 8px; overflow-y: auto;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <b>Zakres:</b>
                        <button class="btn-win" style="background: #eef4ff; font-weight: bold;">Dzień</button>
                        <button class="btn-win">Miesiąc</button>
                        <button class="btn-win">Rok</button>
                        <button class="btn-win">Wszystkie</button>
                        <span id="rep-date-sub" style="color: #444; margin-left: 6px;">Statystyka z bieżącej służby (Wspólna Co-op)</span>
                    </div>
                    <div style="display:flex; gap:4px;">
                        <button class="btn-win" style="padding: 4px 10px; font-weight: bold;" onclick="exportShiftStateToFile()">💾 Eksportuj JSON</button>
                        <button class="btn-win" style="padding: 4px 10px;" onclick="importShiftStateFromFile()">📂 Wczytaj JSON</button>
                        <button class="btn-win" style="padding: 4px 14px; font-weight: bold;" onclick="window.print()">Drukuj</button>
                    </div>
                </div>
                <div style="background: #ece9d8; border: 1px solid #999; padding: 6px 8px;">
                    <b>Tryb statystyk:</b> Zapis automatyczny w chmurze Supabase + localStorage + obsługa plików .json.
                </div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Zgłoszenia ogółem</div><div id="rep-total" style="font-size: 20px; font-weight: bold; margin-top: 4px; color:#000;">0</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Aktywne</div><div id="rep-active" style="font-size: 20px; font-weight: bold; margin-top: 4px; color:#000;">0</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Zakończone</div><div id="rep-finished" style="font-size: 20px; font-weight: bold; margin-top: 4px; color:#000;">0</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Średni czas obsługi</div><div id="rep-avg-time" style="font-size: 16px; font-weight: bold; margin-top: 6px; color:#000;">00:08:30</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Odmowy / Anulowane CPR</div><div id="rep-refused" style="font-size: 20px; font-weight: bold; margin-top: 4px; color:#000;">0</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Zdarzenia powiązane (CPR)</div><div id="rep-cpr-linked" style="font-size: 20px; font-weight: bold; margin-top: 4px; color:#000;">0</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Nowe powyżej 2 min</div><div id="rep-over-2m" style="font-size: 20px; font-weight: bold; margin-top: 4px; color:#000;">0</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Komenda</div><div id="rep-range-box" style="font-size: 12px; font-weight: bold; margin-top: 6px; color:#000;">KP PSP</div></div>
                </div>
                <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;">
                    <div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 6px;">SŁUŻBY — PRM / PSP / POLICJA</div>
                    <table class="sis-table" style="background: #fff;">
                        <thead><tr><th>Służba</th><th style="text-align:right;">Zadysponowano</th><th style="text-align:right;">Oczekuje (Dojazd)</th><th style="text-align:right;">Obsługa (Na miejscu)</th><th style="text-align:right;">Zakończono</th><th style="text-align:right;">Śr. reakcja</th><th style="text-align:right;">Śr. obsługa</th></tr></thead>
                        <tbody>
                            <tr><td>PRM / ZRM</td><td id="rep-prm-disp" style="text-align:right;">0</td><td id="rep-prm-wait" style="text-align:right;">0</td><td id="rep-prm-act" style="text-align:right;">0</td><td id="rep-prm-fin" style="text-align:right;">0</td><td style="text-align:right;">00:01:20</td><td style="text-align:right;">00:08:00</td></tr>
                            <tr><td>PSP / OSP</td><td id="rep-psp-disp" style="text-align:right;">0</td><td id="rep-psp-wait" style="text-align:right;">0</td><td id="rep-psp-act" style="text-align:right;">0</td><td id="rep-psp-fin" style="text-align:right;">0</td><td style="text-align:right;">00:01:15</td><td style="text-align:right;">00:08:30</td></tr>
                            <tr><td>Policja</td><td id="rep-pol-disp" style="text-align:right;">0</td><td id="rep-pol-wait" style="text-align:right;">0</td><td id="rep-pol-act" style="text-align:right;">0</td><td id="rep-pol-fin" style="text-align:right;">0</td><td style="text-align:right;">00:01:45</td><td style="text-align:right;">00:08:00</td></tr>
                        </tbody>
                    </table>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;"><div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 4px;">STATUSY CPR</div><table class="sis-table" style="background: #fff;"><thead><tr><th>Nazwa</th><th style="width:70px; text-align:right;">Liczba</th></tr></thead><tbody id="rep-cpr-statuses"></tbody></table></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;"><div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 4px;">OPERATORZY</div><table class="sis-table" style="background: #fff;"><thead><tr><th>Nazwa</th><th style="width:70px; text-align:right;">Liczba</th></tr></thead><tbody id="rep-operators"></tbody></table></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;"><div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 4px;">TOP KATEGORIE</div><table class="sis-table" style="background: #fff;"><thead><tr><th>Nazwa</th><th style="width:70px; text-align:right;">Liczba</th></tr></thead><tbody id="rep-top-cats"></tbody></table></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;"><div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 4px;">TOP PODKATEGORIE</div><table class="sis-table" style="background: #fff;"><thead><tr><th>Nazwa</th><th style="width:70px; text-align:right;">Liczba</th></tr></thead><tbody id="rep-top-subcats"></tbody></table></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;"><div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 4px;">POWODY ODMÓW / ANULOWAŃ</div><table class="sis-table" style="background: #fff;"><thead><tr><th>Nazwa</th><th style="width:70px; text-align:right;">Liczba</th></tr></thead><tbody id="rep-refusals-body"></tbody></table></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;"><div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 4px;">MIEJSCOWOŚCI / ADRESY</div><table class="sis-table" style="background: #fff;"><thead><tr><th>Nazwa</th><th style="width:70px; text-align:right;">Liczba</th></tr></thead><tbody id="rep-locations-body"></tbody></table></div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const win = modal.querySelector('.modal-window');
    const hdr = modal.querySelector('.modal-header');
    if (win && hdr) makeDraggable(win, hdr);
}

function openReportsModal() {
    ensureReportsModalExists();
    const total = events.length;
    const active = events.filter(e => e.status === 'ACTIVE').length;
    const finished = events.filter(e => e.status === 'FINISHED').length;

    safeSetElementText('rep-total', total);
    safeSetElementText('rep-active', active);
    safeSetElementText('rep-finished', finished);
    safeSetElementText('rep-refused', shiftStats.cprRefused);
    safeSetElementText('rep-cpr-linked', shiftStats.cprAccepted);
    safeSetElementText('rep-over-2m', events.filter(e => e.vehicles.length >= 2).length);
    const profile = COUNTY_PROFILES[currentCountyId] || RAW_PROFILES.find(r => r.id === currentCountyId);
    safeSetElementText('rep-range-box', profile ? profile.name : currentCountyId);

    let prmDisp = 0, prmWait = 0, prmAct = 0, prmFin = 0;
    let pspDisp = 0, pspWait = 0, pspAct = 0, pspFin = 0;
    let polDisp = 0, polWait = 0, polAct = 0, polFin = 0;
    const catMap = {}, subcatMap = {}, locMap = {};

    events.forEach(ev => {
        const isWaiting = ev.status === 'ACTIVE' && !ev.firstArrived;
        const isOnSite = ev.status === 'ACTIVE' && ev.firstArrived;
        const isDone = ev.status === 'FINISHED';

        if (ev.services && ev.services.prm) { prmDisp++; if (isWaiting) prmWait++; else if (isOnSite) prmAct++; else if (isDone) prmFin++; }
        if (ev.services && ev.services.police) { polDisp++; if (isWaiting) polWait++; else if (isOnSite) polAct++; else if (isDone) polFin++; }
        if (ev.vehicles && ev.vehicles.length > 0) {
            pspDisp += ev.vehicles.length;
            ev.vehicles.forEach(v => {
                if (ev.status === 'FINISHED' && v.phase === 'DONE') pspFin++;
                else if (v.phase === 'PREP' || v.phase === 'TRAVEL') pspWait++;
                else pspAct++;
            });
        }
        const catKey = ev.type || 'P'; catMap[catKey] = (catMap[catKey] || 0) + 1;
        const subKey = ev.subtype || 'Brak podkategorii'; subcatMap[subKey] = (subcatMap[subKey] || 0) + 1;
        const locKey = `${ev.city}${ev.street ? ', ' + ev.street : ''}`; locMap[locKey] = (locMap[locKey] || 0) + 1;
    });

    safeSetElementText('rep-prm-disp', prmDisp); safeSetElementText('rep-prm-wait', prmWait); safeSetElementText('rep-prm-act', prmAct); safeSetElementText('rep-prm-fin', prmFin);
    safeSetElementText('rep-psp-disp', pspDisp); safeSetElementText('rep-psp-wait', pspWait); safeSetElementText('rep-psp-act', pspAct); safeSetElementText('rep-psp-fin', pspFin);
    safeSetElementText('rep-pol-disp', polDisp); safeSetElementText('rep-pol-wait', polWait); safeSetElementText('rep-pol-act', polAct); safeSetElementText('rep-pol-fin', polFin);

    const cprStatBody = document.getElementById('rep-cpr-statuses');
    if (cprStatBody) {
        cprStatBody.innerHTML = (shiftStats.cprTotalGenerated === 0 && total === 0)
            ? `<tr><td colspan="2" style="color:#666;">Brak statusów</td></tr>`
            : `<tr><td>Wygenerowane zgłoszenia 112</td><td style="text-align:right;">${shiftStats.cprTotalGenerated}</td></tr>
               <tr><td>Przyjęte do obsługi (Karty SWD)</td><td style="text-align:right;">${shiftStats.cprAccepted}</td></tr>
               <tr><td>Odrzucone / Zamknięte formatki</td><td style="text-align:right;">${shiftStats.cprRefused}</td></tr>`;
    }

    const opBody = document.getElementById('rep-operators');
    if (opBody) {
        opBody.innerHTML = total === 0
            ? `<tr><td colspan="2" style="color:#666;">Brak danych operatorów</td></tr>`
            : `<tr><td>${getFormattedOperatorName()} (${currentUserRole})</td><td style="text-align:right;">${total}</td></tr>`;
    }

    const fillTable = (tbodyId, dataObj, emptyLabel) => {
        const el = document.getElementById(tbodyId);
        if (!el) return;
        const entries = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
        el.innerHTML = entries.length === 0
            ? `<tr><td colspan="2" style="color:#666;">${emptyLabel}</td></tr>`
            : entries.map(([k, v]) => `<tr><td>${k}</td><td style="text-align:right;">${v}</td></tr>`).join('');
    };

    fillTable('rep-top-cats', catMap, 'Brak kategorii');
    fillTable('rep-top-subcats', subcatMap, 'Brak podkategorii');
    fillTable('rep-refusals-body', shiftStats.refusalReasons, 'Brak odmów w wybranym zakresie');
    fillTable('rep-locations-body', locMap, 'Brak danych adresowych');

    const modal = document.getElementById('modal-reports');
    if (modal) modal.style.display = 'flex';
}

async function simulateIncomingCPR() {
    audioCpr.currentTime = 0; audioCpr.play().catch(() => {});
    shiftStats.cprTotalGenerated++;
    saveSimulationState(true);

    const newCprId = `WCPR-2026-${cprCounter++}`;
    const randomTown = townsList[Math.floor(Math.random() * townsList.length)];
    const chosenType = Math.random() < 0.5 ? "P" : "MZ";

    const townStreets = realStreetsByTown[randomTown] || [randomTown];
    const baseStreet = townStreets[Math.floor(Math.random() * townStreets.length)];
    const houseNum = Math.floor(Math.random() * 25) + 1;
    const verifiedStreetAddress = baseStreet.toLowerCase().startsWith('ul.') ? `${baseStreet} ${houseNum}` : `${baseStreet} ${houseNum}`;

    const arr = chosenType === 'P' ? fallbackPhrasesP : fallbackPhrasesMZ;
    let generatedDesc = arr[Math.floor(Math.random() * arr.length)];

    if (Math.random() < 0.3) {
        safeSetElementText('cpr-id', newCprId);
        safeSetElementText('cpr-city', randomTown);
        safeSetElementText('cpr-street', verifiedStreetAddress);
        safeSetElementText('cpr-caller', "Łączenie z operatorem 112...");
        safeSetElementText('cpr-desc', "Odbieranie formatki z CPR...");
        const cprModal = document.getElementById('cpr-modal');
        if (cprModal) cprModal.style.display = 'flex';

        try {
            const aiPrompt = `Wygeneruj krótką, w 100% realistyczną i unikalną treść zgłoszenia od świadka dla operatora numeru 112 w Polsce.
Typ zdarzenia: ${chosenType === 'P' ? 'Pożar' : 'Zagrożenie miejscowe / Wypadek / Awaria'}, miejscowość: ${randomTown}, adres: ${verifiedStreetAddress}.
Zwróć TYLKO treść powiadomienia po polsku, bez cudzysłowów, maksymalnie 12 słów.`;
            const aiRes = await callUniversalAI("Jesteś operatorem CPR (112), zapisujesz zgłoszenia od obywateli w systemie.", aiPrompt, false);
            if (aiRes && aiRes.trim().length > 5) {
                generatedDesc = aiRes.replace(/^["']|["']$/g, '').trim();
            }
        } catch (e) {}
    }

    const finalCaller = generateRandomPolishCaller();
    currentCPRData = { id: newCprId, city: randomTown, street: verifiedStreetAddress, type: chosenType, subtype: generatedDesc, desc: generatedDesc, caller: finalCaller };

    resolveExactCoordinates(verifiedStreetAddress, randomTown).then(coords => {
        if (coords && currentCPRData && currentCPRData.id === newCprId) { currentCPRData.lat = coords.lat; currentCPRData.lng = coords.lng; }
    });

    safeSetElementText('cpr-id', currentCPRData.id);
    safeSetElementText('cpr-city', currentCPRData.city);
    safeSetElementText('cpr-street', currentCPRData.street);
    safeSetElementText('cpr-caller', currentCPRData.caller);
    safeSetElementText('cpr-desc', currentCPRData.desc);

    const cprModal = document.getElementById('cpr-modal');
    if (cprModal) cprModal.style.display = 'flex';

    if (coopChannel) {
        coopChannel.send({
            type: 'broadcast',
            event: 'swd_cpr_sync',
            payload: { senderId: myClientId, countyId: currentCountyId, action: 'NEW_CPR', cprData: currentCPRData }
        }).catch(() => {});
    }
}

function closeCPR(isAccepted = false) { 
    if (!isAccepted && currentCPRData) {
        shiftStats.cprRefused++;
        const reason = "Zamknięto formatkę CPR bez otwarcia karty";
        shiftStats.refusalReasons[reason] = (shiftStats.refusalReasons[reason] || 0) + 1;
        currentCPRData = null;
        saveSimulationState(true);
    }
    const modal = document.getElementById('cpr-modal');
    if(modal) modal.style.display = 'none';
    if (coopChannel) {
        coopChannel.send({
            type: 'broadcast',
            event: 'swd_cpr_sync',
            payload: { senderId: myClientId, countyId: currentCountyId, action: 'CLOSE_CPR' }
        }).catch(() => {});
    }
}

function minimizeCPR() {
    if (!currentCPRData) return;
    const modal = document.getElementById('cpr-modal');
    if(modal) modal.style.display = 'none';
    const bar = document.getElementById('minimized-bar');
    if(bar) {
        const item = document.createElement('div');
        item.className = 'minimized-item';
        item.innerHTML = `🚨 Zgłoszenie CPR (${currentCPRData.city}, ${currentCPRData.street})`;
        item.onclick = () => { const m = document.getElementById('cpr-modal'); if(m) m.style.display = 'flex'; item.remove(); };
        bar.appendChild(item);
    }
}

function acceptCPRToEvent() {
    if (!currentCPRData) return;
    shiftStats.cprAccepted++;
    openNewEventModal();

    const inpRec = document.getElementById('inp-ev-received');
    const inpCity = document.getElementById('inp-ev-city');
    const inpReg = document.getElementById('inp-ev-region');
    const inpStreet = document.getElementById('inp-ev-street');
    const inpDesc = document.getElementById('inp-ev-desc');
    if(inpRec) inpRec.value = 'CPR';
    if(inpCity) inpCity.value = currentCPRData.city;
    if(inpReg) inpReg.value = locationsDatabase[currentCPRData.city] || '';
    if(inpStreet) inpStreet.value = currentCPRData.street;
    
    let cleanDesc = (currentCPRData.desc || "").replace(/^(P|MZ|AF|CW|WG|BL|ZPR)\s*-\s*/i, "").trim();
    if (inpDesc) inpDesc.value = cleanDesc;

    autoSelectJRGByCity(currentCPRData.city);

    const radioType = document.querySelector(`input[name="ev-type"][value="${currentCPRData.type || 'P'}"]`);
    if (radioType) radioType.checked = true;
    updateSubtypes(currentCPRData.type || 'P');

    const rawCaller = currentCPRData.caller || "";
    const namePart = rawCaller.split(' (tel.')[0] || "";
    const phoneMatch = rawCaller.match(/tel\.\s*([0-9\-]+)/);
    const callerParts = namePart.trim().split(' ');
    const lastNameVal = callerParts.length > 1 ? callerParts.pop() : '';
    const firstNameVal = callerParts.join(' ');

    const nameInp = document.getElementById('inp-caller-name');
    const surInp = document.getElementById('inp-caller-surname');
    const phoneInp = document.getElementById('inp-caller-phone');
    if(nameInp) nameInp.value = firstNameVal;
    if(surInp) surInp.value = lastNameVal;
    if(phoneInp && phoneMatch) phoneInp.value = phoneMatch[1];

    closeCPR(true);
    currentCPRData = null;
    saveSimulationState(true);
}

function formatMMSS(sec) {
    if (sec < 0) return "Zabezpieczenie rejonu (PZR)";
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s} min`;
}

function toggleService(service) {
    servicesState[service] = !servicesState[service];
    const btn = document.getElementById(service === 'prm' ? 'btn-service-prm' : 'btn-service-police');
    if (btn) {
        if (servicesState[service]) btn.classList.add('active');
        else btn.classList.remove('active');
    }
}

function renderUnits() {
    const pspGrid = document.getElementById('grid-psp');
    const ospGrid = document.getElementById('grid-osp');
    if(pspGrid) pspGrid.innerHTML = unitsPSP.map(u => createUnitHTML(u)).join('');
    if(ospGrid) ospGrid.innerHTML = unitsOSP.map(u => createUnitHTML(u)).join('');
}

function createUnitHTML(unit) {
    const exactAddr = unitExactLocations[unit.name]?.address || "";
    const unitHasPzr = unit.vehicles.some(v => v.status === 'yellow' || getActivePzrForVehicle(v.id) !== null);

    let vehiclesHTML = unit.vehicles.length === 0 ? `<div style="padding: 4px; color: #888; font-style: italic;">Brak pojazdów</div>` :
        unit.vehicles.map(v => {
            const pzrEv = getActivePzrForVehicle(v.id);
            const isYellowRow = v.status === 'yellow' || pzrEv !== null;
            const pzrBadge = pzrEv ? ` <span style="background:#f1c40f; color:#000; padding:0 4px; border-radius:2px; font-weight:bold; font-size:9px;">PZR (${pzrEv.city})</span>` : '';
            return `
                <div class="vehicle-row ${isYellowRow ? 'pzr-active' : ''}">
                    <span class="status-dot ${v.status}"></span>
                    <span style="color:#000000;"><b>${v.id}</b> - ${v.name}${pzrBadge}</span>
                </div>
            `;
        }).join('');

    return `
        <div class="unit-box ${unitHasPzr ? 'unit-on-pzr' : ''}">
            <div class="unit-header ${unitHasPzr ? 'header-on-pzr' : ''}" style="color:#000000; font-weight:bold;" title="Adres: ${exactAddr}">
                ${unit.name} ${unitHasPzr ? '🛡️ [PZR]' : ''}
            </div>
            <div>${vehiclesHTML}</div>
        </div>
    `;
}

function renderEvents() {
    const tbody = document.getElementById('events-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    const isCprStation = (typeof currentSelectedStation !== 'undefined' && currentSelectedStation === 'CPR');
    let tableEl = document.querySelector('.events-table-container table, table.sis-table');
    
    if (tableEl) {
        let thead = tableEl.querySelector('thead');
        if (thead) {
            if (isCprStation) {
                thead.innerHTML = `
                    <tr style="background:#d4d0c8; font-size:11px; font-weight:bold; border-bottom:2px solid #808080; text-align:left;">
                        <th style="padding:4px; border-right:1px solid #999;">ID</th>
                        <th style="padding:4px; border-right:1px solid #999;">Data i czas</th>
                        <th style="padding:4px; border-right:1px solid #999;">Nr telefonu</th>
                        <th style="padding:4px; border-right:1px solid #999;">Stan połączenia</th>
                        <th style="padding:4px; border-right:1px solid #999;">Adres</th>
                        <th style="padding:4px; border-right:1px solid #999;">Powiat</th>
                        <th style="padding:4px; border-right:1px solid #999;">Gmina</th>
                        <th style="padding:4px; border-right:1px solid #999;">Kategoria</th>
                        <th style="padding:4px; border-right:1px solid #999; text-align:center;">Priorytet</th>
                        <th style="padding:4px; border-right:1px solid #999; text-align:center;">PRM</th>
                        <th style="padding:4px; border-right:1px solid #999; text-align:center;">PSP</th>
                        <th style="padding:4px; border-right:1px solid #999; text-align:center;">Policja</th>
                        <th style="padding:4px;">Status CPR</th>
                    </tr>
                `;
            } else {
                thead.innerHTML = `
                    <tr>
                        <th>ID zdarzenia</th>
                        <th>Data/Godzina</th>
                        <th>KP/KM</th>
                        <th>JRG</th>
                        <th>Miejsce</th>
                        <th>Zastępy</th>
                        <th>Rodzaj</th>
                        <th>Opis</th>
                        <th>Czas / Status</th>
                        <th>Nr meldunku</th>
                    </tr>
                `;
            }
        }
    }

    events.forEach(ev => {
        const tr = document.createElement('tr');
        tr.className = (ev.status === 'ACTIVE' ? 'active-ev' : 'finished-ev') + (selectedEvIdForRadio === ev.id ? ' selected-ev' : '');
        tr.ondblclick = () => openEditEventModal(ev.id);
        tr.onclick = () => selectEvent(ev.id);

        if (isCprStation) {
            tr.style.background = ev.status === 'ACTIVE' ? '#fcf8e3' : '#e6e6e6';
            tr.style.borderBottom = '1px solid #d6d3c2';

            let timeDisplay = ev.status === 'FINISHED' ? "Zakończono" : `Aktywne (${formatMMSS(ev.remainingSeconds)})`;
            const fullPlace = ev.street ? `${ev.city}, ${ev.street}` : ev.city;
            const profile = COUNTY_PROFILES[currentCountyId] || RAW_PROFILES[0];
            
            const prmStatus = ev.services?.prm ? '<span style="color:#b30000; font-weight:bold;">Zadysponowano</span>' : '<span style="color:#777;">-</span>';
            const pspNames = ev.vehicles.length > 0 ? ev.vehicles.map(v => v.id).join(', ') : '<span style="color:#777;">-</span>';
            const polStatus = ev.services?.police ? '<span style="color:#004080; font-weight:bold;">Zadysponowano</span>' : '<span style="color:#777;">-</span>';

            tr.innerHTML = `
                <td style="padding:4px; border-right:1px solid #ddd; font-weight:bold; color:#0a246a;">${ev.id}/CPR/2026</td>
                <td style="padding:4px; border-right:1px solid #ddd;">${ev.time}</td>
                <td style="padding:4px; border-right:1px solid #ddd; font-family:monospace;">501-234-567</td>
                <td style="padding:4px; border-right:1px solid #ddd; color:#155724;">Aktywne (112)</td>
                <td style="padding:4px; border-right:1px solid #ddd;"><b>${fullPlace}</b></td>
                <td style="padding:4px; border-right:1px solid #ddd; font-size:11px;">${profile.countyName}</td>
                <td style="padding:4px; border-right:1px solid #ddd; font-size:11px;">${ev.city}</td>
                <td style="padding:4px; border-right:1px solid #ddd;"><b>${ev.type}</b> — ${ev.subtype}</td>
                <td style="padding:4px; border-right:1px solid #ddd; text-align:center; font-weight:bold;">${ev.type === 'P' ? '1' : '2'}</td>
                <td style="padding:4px; border-right:1px solid #ddd; text-align:center; font-size:11px;">${prmStatus}</td>
                <td style="padding:4px; border-right:1px solid #ddd; font-size:11px;">${pspNames}</td>
                <td style="padding:4px; border-right:1px solid #ddd; text-align:center; font-size:11px;">${polStatus}</td>
                <td style="padding:4px; font-size:11px;">${timeDisplay}</td>
            `;
        } else {
            if (ev.type === 'PZR' && selectedEvIdForRadio !== ev.id) tr.style.color = '#ffff00';

            let timeDisplay = "";
            if (ev.status === 'FINISHED') {
                const anyReturning = ev.vehicles.some(v => v.phase === 'RETURN' && v.returnTime > 0);
                timeDisplay = anyReturning ? "Powrót SiS..." : "0:00 min (Zakończono)";
            } else if (ev.type === 'PZR') {
                timeDisplay = !ev.firstArrived ? "Dojazd na PZR..." : "Zabezpieczenie rejonu (Aktywne)";
            } else if (!ev.firstArrived) {
                timeDisplay = `W drodze na miejsce... (Czas akcji: ${formatMMSS(ev.remainingSeconds)})`;
            } else {
                timeDisplay = `Działania: ${formatMMSS(ev.remainingSeconds)}`;
            }

            const fullPlace = ev.street ? `${ev.city}, ${ev.street}` : ev.city;
            const rowColorStyle = (ev.status === 'ACTIVE' && ev.type === 'PZR' && selectedEvIdForRadio !== ev.id) ? 'style="color:#ffd700;"' : '';

            const srvTags = [];
            if (ev.services?.prm) srvTags.push('PRM');
            if (ev.services?.police) srvTags.push('Policja');
            const srvBadge = srvTags.length > 0 ? ` [${srvTags.join(', ')}]` : '';

            tr.innerHTML = `
                <td ${rowColorStyle}>${ev.id}/???/2026</td>
                <td ${rowColorStyle}>${ev.time}</td>
                <td ${rowColorStyle}>${ev.jrg}</td>
                <td ${rowColorStyle}>${ev.jrg}</td>
                <td ${rowColorStyle} title="Kliknij pinezkę, aby przybliżyć adres na mapie">${fullPlace} <span style="cursor:pointer;" onclick="event.stopPropagation(); focusEventOnMap(${ev.id});" title="Pokaż dokładny adres na mapie">📍</span></td>
                <td ${rowColorStyle}>${ev.vehicles.length}</td>
                <td ${rowColorStyle}>${ev.type}</td>
                <td ${rowColorStyle}>${ev.desc || (ev.type === 'PZR' ? 'Przekazanie na zabezpieczenie rejonu' : '')}${srvBadge}</td>
                <td ${rowColorStyle}><b>${timeDisplay}</b></td>
                <td ${rowColorStyle}>???-0000${ev.id}</td>
            `;
        }
        tbody.appendChild(tr);
    });
    updateMapMarkers();
}

function renderSelectedEventDetails() {
    if (selectedEvIdForRadio === null) return;
    const ev = events.find(e => e.id === selectedEvIdForRadio);
    if (!ev) return;
    const sisBody = document.getElementById('details-sis-body');
    if (!sisBody) return;

    if (ev.vehicles.length === 0) {
        sisBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #888;">Brak zadysponowanych SiS</td></tr>';
        return;
    }

    sisBody.innerHTML = ev.vehicles.map(v => {
        let statusText = "";
        if (v.phase === 'PREP') statusText = `<span style="color: #d35400; font-weight: bold;">Alarmowanie / Wyjazd za ${v.prepTime}s</span>`;
        else if (v.phase === 'TRAVEL') statusText = `<span style="color: #b36b00; font-weight: bold;">W drodze (${formatMMSS(v.travelTime)})</span>`;
        else if (v.phase === 'ONSITE') {
            statusText = ev.type === 'PZR'
                ? `<span style="color: #b38600; background:#fff8c4; padding:1px 4px; font-weight: bold;">Na zabezpieczeniu rejonu (PZR)</span>`
                : `<span style="color: #b30000; font-weight: bold;">Na miejscu działań</span>`;
        } else if (v.phase === 'RETURN') {
            const pzrEv = getActivePzrForVehicle(v.id);
            const destLabel = (pzrEv && ev.type !== 'PZR') ? `Powrót na PZR ${pzrEv.city}` : `Powrót do bazy`;
            statusText = `<span style="color: #004080; font-weight: bold;">${destLabel} (${formatMMSS(v.returnTime)})</span>`;
        } else {
            const pzrEv = getActivePzrForVehicle(v.id);
            statusText = pzrEv
                ? `<span style="color: #b38600; background:#fff8c4; padding:1px 4px; font-weight: bold;">Na PZR (${pzrEv.city})</span>`
                : `<span style="color: #155724; font-weight: bold;">W bazie (Wolny)</span>`;
        }
        return `
            <tr style="color:#000000; ${ev.type === 'PZR' ? 'background:#fffdf0;' : ''}">
                <td><b>${v.id}</b> - ${v.name}</td>
                <td>${v.obsada}</td>
                <td>${v.unitName}</td>
                <td>${statusText}</td>
            </tr>
        `;
    }).join('');
}

function selectEvent(id) {
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    selectedEvIdForRadio = ev.id;
    const btnOpen = document.getElementById('btn-open-radio');
    const detailsTitle = document.getElementById('details-title');
    if(btnOpen) btnOpen.style.display = 'block';
    if(detailsTitle) detailsTitle.innerText = `ID: ${ev.id} - ${ev.city}${ev.street ? ', ' + ev.street : ''}`;
    renderEvents();
    renderSelectedEventDetails();
}

function switchTab(tab) {
    const pspGrid = document.getElementById('grid-psp');
    const ospGrid = document.getElementById('grid-osp');
    const mapContainer = document.getElementById('view-map-container');
    const btnPsp = document.getElementById('btn-tab-psp');
    const btnOsp = document.getElementById('btn-tab-osp');
    const btnMap = document.getElementById('btn-tab-map');

    if(mapContainer) mapContainer.style.display = 'none';
    if(btnMap) btnMap.classList.remove('active');
    if(pspGrid) pspGrid.style.display = tab === 'PSP' ? 'grid' : 'none';
    if(ospGrid) ospGrid.style.display = tab === 'OSP' ? 'grid' : 'none';
    if(btnPsp) btnPsp.className = 'tab-btn ' + (tab === 'PSP' ? 'active' : '');
    if(btnOsp) btnOsp.className = 'tab-btn ' + (tab === 'OSP' ? 'active' : '');
}

function handleCityInput(input) {
    if(!input) return;
    const val = input.value.trim().toLowerCase();
    const suggestionsBox = document.getElementById('city-suggestions');
    if(!suggestionsBox) return;
    suggestionsBox.innerHTML = '';
    if (!val) { suggestionsBox.style.display = 'none'; return; }

    const matches = Object.keys(locationsDatabase).filter(c => c.toLowerCase().includes(val));
    if (matches.length > 0) {
        matches.forEach(c => {
            const div = document.createElement('div');
            div.className = 'suggestion-item'; div.innerText = c;
            div.onclick = () => {
                const cityInp = document.getElementById('inp-ev-city');
                const regInp = document.getElementById('inp-ev-region');
                if(cityInp) cityInp.value = c;
                if(regInp) regInp.value = locationsDatabase[c];
                autoSelectJRGByCity(c);
                suggestionsBox.style.display = 'none';
            };
            suggestionsBox.appendChild(div);
        });
        suggestionsBox.style.display = 'block';
    } else {
        suggestionsBox.style.display = 'none';
    }
}

function openNewEventModal() {
    activeEditingId = null;
    selectedVehicles = [];
    servicesState = { prm: false, police: false };
    updateJrgSelectOptions();
    ensureSgrButtonInEventModal();

    const btnPrm = document.getElementById('btn-service-prm');
    const btnPol = document.getElementById('btn-service-police');
    if(btnPrm) btnPrm.classList.remove('active');
    if(btnPol) btnPol.classList.remove('active');

    const titleEl = document.getElementById('modal-event-title');
    const timeEl = document.getElementById('inp-ev-time');
    const cityEl = document.getElementById('inp-ev-city');
    const regEl = document.getElementById('inp-ev-region');
    const streetEl = document.getElementById('inp-ev-street');
    const descEl = document.getElementById('inp-ev-desc');
    const nameEl = document.getElementById('inp-caller-name');
    const surEl = document.getElementById('inp-caller-surname');
    const phoneEl = document.getElementById('inp-caller-phone');
    const countEl = document.getElementById('lbl-selected-count');
    const modalEl = document.getElementById('modal-event');

    if(titleEl) titleEl.innerText = "Nowa Karta Zdarzenia";
    if(timeEl) timeEl.value = new Date().toLocaleTimeString();
    if(cityEl) { cityEl.value = ''; cityEl.placeholder = `Wpisz np. ${COUNTY_PROFILES[currentCountyId].defaultTown}...`; }
    if(regEl) regEl.value = '';
    if(streetEl) streetEl.value = '';
    if(descEl) descEl.value = '';
    if(nameEl) nameEl.value = '';
    if(surEl) surEl.value = '';
    if(phoneEl) phoneEl.value = '';
    if(countEl) countEl.innerText = "Wybrano pojazdów: 0";

    const radioP = document.querySelector('input[name="ev-type"][value="P"]');
    if (radioP) radioP.checked = true;
    updateSubtypes('P');

    switchModalTab('dane');
    if(modalEl) modalEl.style.display = 'flex';
}

function openEditEventModal(id) {
    const ev = events.find(e => e.id === id);
    if (!ev) return;

    activeEditingId = id;
    selectedVehicles = [...ev.vehicles];
    updateJrgSelectOptions();
    ensureSgrButtonInEventModal();

    const titleEl = document.getElementById('modal-event-title');
    const timeEl = document.getElementById('inp-ev-time');
    const cityEl = document.getElementById('inp-ev-city');
    const regEl = document.getElementById('inp-ev-region');
    const streetEl = document.getElementById('inp-ev-street');
    const descEl = document.getElementById('inp-ev-desc');
    const countEl = document.getElementById('lbl-selected-count');
    const modalEl = document.getElementById('modal-event');

    if(titleEl) titleEl.innerText = `Edycja zdarzenia ID: ${ev.id}`;
    if(timeEl) timeEl.value = ev.time;
    if(cityEl) cityEl.value = ev.city;
    if(regEl) regEl.value = ev.region || (locationsDatabase[ev.city] || '');
    if(streetEl) streetEl.value = ev.street;
    if(descEl) descEl.value = ev.desc;
    if(countEl) countEl.innerText = "Wybrano pojazdów: " + selectedVehicles.length;

    const radio = document.querySelector(`input[name="ev-type"][value="${ev.type}"]`);
    if (radio) radio.checked = true;
    updateSubtypes(ev.type);
    const subSel = document.getElementById('inp-ev-subtype');
    if (ev.type !== 'PZR' && subSel) subSel.value = ev.subtype || "";

    servicesState = { ...(ev.services || { prm: false, police: false }) };
    const btnPrm = document.getElementById('btn-service-prm');
    const btnPol = document.getElementById('btn-service-police');
    if (btnPrm) { if (servicesState.prm) btnPrm.classList.add('active'); else btnPrm.classList.remove('active'); }
    if (btnPol) { if (servicesState.police) btnPol.classList.add('active'); else btnPol.classList.remove('active'); }

    switchModalTab('dane');
    if(modalEl) modalEl.style.display = 'flex';
}

function openDispatchModal() {
    const container = document.getElementById('dispatch-list');
    const infoBar = document.getElementById('dispatch-info-bar');
    const cityInput = document.getElementById('inp-ev-city');
    const modalDisp = document.getElementById('modal-dispatch');
    
    if(!container) return;
    const targetCity = cityInput ? cityInput.value.trim() : "";
    container.innerHTML = '';

    if(infoBar) {
        infoBar.innerHTML = targetCity ? `📍 Kolejność wg odległości dla: <span style="color:#b30000;">${targetCity}</span>` : `⚠️ Brak miejscowości`;
    }

    const availableUnits = [...unitsPSP, ...unitsOSP]
        .filter(u => u.vehicles.length > 0)
        .map(u => ({ ...u, ...getUnitProximity(u.name, targetCity) }))
        .sort((a, b) => a.sec - b.sec);

    availableUnits.forEach((u, index) => {
        const isClosest = index === 0 && targetCity !== "";
        const exactAddr = unitExactLocations[u.name]?.address || "";
        const isPSP = u.name.includes("JRG") || u.name.includes("KP PSP") || u.name.includes("KM PSP");
        const prepRange = isPSP ? "Wyjazd: 30-90s" : "Wyjazd: 1-3 min";
        const groupDiv = document.createElement('div');
        groupDiv.className = 'dispatch-unit-group';

        groupDiv.innerHTML = `
            <div class="dispatch-unit-header ${isClosest ? 'closest' : ''}" title="${exactAddr}">
                <span>${index + 1}. ${u.name} <small style="font-weight:normal; color:#333;">(${exactAddr})</small> ${isClosest ? '⭐' : ''}</span>
                <span>${u.km} | Jazda: ~${formatMMSS(u.sec)} (${prepRange})</span>
            </div>
            ${u.vehicles.map(v => {
                const pzrEv = getActivePzrForVehicle(v.id);
                const pzrLabel = pzrEv ? `<span style="margin-left:auto; background:#f1c40f; color:#000; padding:1px 5px; border-radius:2px; font-weight:bold; font-size:10px;">🛡️ PZR (${pzrEv.city})</span>` : '';
                return `
                    <label class="dispatch-vehicle-item" style="cursor:pointer; color:#000000; ${pzrEv ? 'background:#fff8c4;' : ''}">
                        <input type="checkbox" value="${v.id}" ${selectedVehicles.some(sv => sv.id === v.id) ? 'checked' : ''}>
                        <span class="status-dot ${v.status}"></span>
                        <span><b>${v.id}</b> - ${v.name}</span>
                        ${pzrLabel}
                    </label>
                `;
            }).join('')}
        `;
        container.appendChild(groupDiv);
    });

    if(modalDisp) modalDisp.style.display = 'flex';
}

function confirmDispatch() {
    const checkboxes = document.querySelectorAll('#dispatch-list input:checked');
    const cityInput = document.getElementById('inp-ev-city');
    const defTown = COUNTY_PROFILES[currentCountyId].defaultTown;
    const targetCity = (cityInput && cityInput.value.trim()) ? cityInput.value.trim() : defTown;

    const sgrAllVehIds = new Set();
    getCurrentRegionSgrGroups().forEach(g => g.vehicles.forEach(v => sgrAllVehIds.add(v.id)));
    const keptSpecialOrAidVehicles = selectedVehicles.filter(sv => sgrAllVehIds.has(sv.id) || (sv.unitName && sv.unitName.includes('[WSPARCIE]')));

    const newSelection = [];
    checkboxes.forEach(cb => {
        const vehId = cb.value;
        const existing = selectedVehicles.find(sv => sv.id === vehId);
        if (existing) {
            newSelection.push(existing);
        } else {
            let pzrActiveEv = null;
            events.forEach(ev => {
                if (ev.status === 'ACTIVE' && ev.type === 'PZR') {
                    if (ev.vehicles && ev.vehicles.some(v => v.id === vehId)) pzrActiveEv = ev;
                }
            });

            [...unitsPSP, ...unitsOSP].forEach(u => {
                const v = u.vehicles.find(veh => veh.id === vehId);
                if (v) {
                    const routeSec = calculateRouteTravelSeconds(u.name, targetCity);
                    const prepSec = pzrActiveEv ? (Math.floor(Math.random() * 21) + 15) : generateDeparturePrepSeconds(u.name);
                    newSelection.push({
                        ...v, 
                        unitName: u.name, 
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

    selectedVehicles = [...newSelection, ...keptSpecialOrAidVehicles];
    const countLbl = document.getElementById('lbl-selected-count');
    if(countLbl) countLbl.innerText = "Wybrano pojazdów: " + selectedVehicles.length;
    closeModal('modal-dispatch');
}

function saveEvent() {
    try {

    const cityInput = document.getElementById('inp-ev-city');
    const city = cityInput ? cityInput.value.trim() : "";
    if (!city) { alert('Proszę podać miejscowość!'); return; }

    const typeChecked = document.querySelector('input[name="ev-type"]:checked');
    const typeVal = typeChecked ? typeChecked.value : 'P';
    const subSel = document.getElementById('inp-ev-subtype');
    const subtypeVal = typeVal === 'PZR' ? 'Zabezpieczenie rejonu' : (subSel && subSel.value ? subSel.value : 'Zgłoszenie operacyjne');
    
    const descInput = document.getElementById('inp-ev-desc');
    let descVal = descInput ? descInput.value.trim() : '';
    descVal = descVal.replace(/^(P|MZ|AF|CW|WG|BL|ZPR)\s*-\s*/i, "").trim();
    if (typeVal === 'PZR' && !descVal) descVal = `Przekazanie na zabezpieczenie rejonu operacyjnego (${city})`;

    const streetInput = document.getElementById('inp-ev-street');
    const streetVal = streetInput ? streetInput.value.trim() : '';

    selectedVehicles.forEach(sv => {
        if (!sv.phase) {
            sv.phase = 'PREP';
            sv.prepTime = generateDeparturePrepSeconds(sv.unitName);
            const routeSec = calculateRouteTravelSeconds(sv.unitName, city);
            sv.travelTime = routeSec; sv.baseRouteSeconds = routeSec; sv.returnTime = routeSec;
        }
    });

    let targetEventObj = null;

    if (activeEditingId === null) {
        let countedOspNames = [];
        selectedVehicles.forEach(sv => {
            if (!sv.unitName.includes("JRG") && !sv.unitName.includes("KP PSP") && !sv.unitName.includes("KM PSP") && !countedOspNames.includes(sv.unitName)) {
                countedOspNames.push(sv.unitName);
            }
        });
        playOspAlarmRepeated(countedOspNames.length);

        const timeInput = document.getElementById('inp-ev-time');
        const regInput = document.getElementById('inp-ev-region');
        const jrgInput = document.getElementById('inp-ev-jrg');
        const fallback = gpsCoords[city] || COUNTY_PROFILES[currentCountyId].mapCenter;
        const calcDuration = calculateActionDurationSeconds(descVal, subtypeVal, typeVal, selectedVehicles);

        const newEv = {
            id: events.length + 1,
            time: timeInput && timeInput.value ? timeInput.value : new Date().toLocaleTimeString(),
            city: city,
            region: regInput ? regInput.value : (locationsDatabase[city] || ''),
            street: streetVal,
            lat: fallback[0], lng: fallback[1],
            desc: descVal, type: typeVal, subtype: subtypeVal,
            remainingSeconds: calcDuration, firstArrived: false, radioReported: false, radioLogs: [],
            jrg: jrgInput ? jrgInput.value : COUNTY_PROFILES[currentCountyId].jrgList[0],
            services: { ...servicesState },
            vehicles: [...selectedVehicles],
            status: 'ACTIVE'
        };
        // Nowe zgłoszenia zawsze na samej górze we wszystkich widokach
        events.unshift(newEv);
        targetEventObj = newEv;
        selectEvent(newEv.id);
    } else {
        const ev = events.find(e => e.id === activeEditingId);
        if (ev) {
            const oldDesc = ev.desc || "";
            if (descVal && !oldDesc.endsWith(descVal) && oldDesc !== descVal) {
                const timeNow = new Date().toLocaleTimeString();
                const operatorTag = getFormattedOperatorName();
                ev.desc = `${oldDesc}
------
[${timeNow}] Edycja karty (${operatorTag}): ${descVal}`;
            } else if (descVal) {
                ev.desc = descVal;
            }

            ev.city = city; 
            ev.street = streetVal; 
            ev.type = typeVal;
            ev.subtype = subtypeVal; 
            ev.services = { ...servicesState }; 
            ev.vehicles = [...selectedVehicles];
            targetEventObj = ev;
        }
    }

    selectedVehicles.forEach(sv => {
        getAllUnitsIncludingSgr().forEach(u => {
            const v = u.vehicles.find(veh => veh.id === sv.id);
            if (v) {
                if (typeVal === 'PZR') v.status = 'yellow';
                else if (v.status === 'green' || v.status === 'yellow') v.status = 'orange';
            }
        });
    });

    if (targetEventObj) geocodeEventAddress(targetEventObj);
    renderUnits(); renderEvents(); saveSimulationState(true); closeModal('modal-event');
}

    } catch(err) {
        console.error("Błąd w saveEvent:", err);
        alert("Błąd zapisu karty zdarzenia: " + err.message);
    }
}

function triggerEventFinishAndReturn(ev) {
    if (!ev || ev.status === 'FINISHED') return;
    ev.status = 'FINISHED';
    ev.remainingSeconds = 0;

    ev.vehicles.forEach(sv => {
        const activePzr = (ev.type !== 'PZR') ? getActivePzrForVehicle(sv.id) : null;

        if (sv.phase === 'ONSITE' || sv.phase === 'TRAVEL') {
            sv.phase = 'RETURN';
            sv.returnTime = sv.baseRouteSeconds || calculateRouteTravelSeconds(sv.unitName, ev.city);
            const approxMin = Math.max(1, Math.round(sv.returnTime / 60));

            getAllUnitsIncludingSgr().forEach(u => {
                const veh = u.vehicles.find(vObj => vObj.id === sv.id);
                if (veh) veh.status = 'orange';
            });

            if (typeof logToMainRadio === 'function') {
                if (activePzr) {
                    logToMainRadio(
                        `${sv.id} ➔ ${currentCountyCallsign}`,
                        `${currentCountyCallsign}, tu ${sv.id}. Zakończyliśmy działania w miejscowości ${ev.city}${ev.street ? ' (' + ev.street + ')' : ''}, wracamy z powrotem na zabezpieczenie rejonu (${activePzr.city}). Bez odbioru.`,
                        '#ffd700', true
                    );
                } else {
                    logToMainRadio(
                        `${sv.id} ➔ ${currentCountyCallsign}`,
                        `${currentCountyCallsign}, tu ${sv.id}. Zakończyliśmy działania w miejscowości ${ev.city}${ev.street ? ' (' + ev.street + ')' : ''}, wracamy do koszar (czas powrotu ok. ${approxMin} min). Bez odbioru.`,
                        '#ffcc00', true
                    );
                }
            }
        } else if (sv.phase === 'PREP') {
            sv.phase = 'DONE';
            sv.returnTime = 0;
            getAllUnitsIncludingSgr().forEach(u => {
                const veh = u.vehicles.find(vObj => vObj.id === sv.id);
                if (veh) veh.status = activePzr ? 'yellow' : 'green';
            });
            if (typeof logToMainRadio === 'function') {
                logToMainRadio(
                    `${currentCountyCallsign} ➔ ${sv.id}`,
                    `${sv.id}, odwołuję alarm dla waszego zastępu, ${activePzr ? 'pozostańcie na zabezpieczeniu rejonu' : 'pozostańcie w koszarach'}.`,
                    '#00ffff', false
                );
            }
        }
    });
    saveSimulationState(true);
}

function finishCurrentEvent() {
    const targetId = activeEditingId !== null ? activeEditingId : selectedEvIdForRadio;
    if (targetId === null) return;
    const ev = events.find(e => e.id === targetId);
    if (ev) triggerEventFinishAndReturn(ev);
    renderUnits(); renderEvents(); closeModal('modal-event');
}

function switchModalTab(tab) {
    const daneContent = document.getElementById('modal-tab-dane-content');
    const czasyContent = document.getElementById('modal-tab-czasy-content');
    const tabDane = document.getElementById('tab-modal-dane');
    const tabCzasy = document.getElementById('tab-modal-czasy');

    if(daneContent) daneContent.style.display = tab === 'dane' ? 'block' : 'none';
    if(czasyContent) czasyContent.style.display = tab === 'czasy' ? 'block' : 'none';
    if(tabDane) tabDane.className = 'tab-btn ' + (tab === 'dane' ? 'active' : '');
    if(tabCzasy) tabCzasy.className = 'tab-btn ' + (tab === 'czasy' ? 'active' : '');
}

function openSiSModal() { 
    ensureSiSModalExists(); renderSiSManagerList();
    const modal = document.getElementById('modal-sis');
    if(modal) modal.style.display = 'flex'; 
}

function closeModal(id) { 
    const modal = document.getElementById(id);
    if(modal) modal.style.display = 'none'; 
}

function runSimulationTick() {
    let needsRender = false;
    let majorPhaseTransition = false;

    events.forEach(ev => {
        if (ev.status === 'ACTIVE') {
            ev.vehicles.forEach(v => {
                if (v.phase === 'PREP') {
                    if (v.prepTime > 0) { v.prepTime--; needsRender = true; }
                    else {
                        v.phase = 'TRAVEL';
                        majorPhaseTransition = true;
                        if (isMasterClientForCounty() && typeof logToMainRadio === 'function' && typeof buildDepartureRadioMessage === 'function') {
                            logToMainRadio(`${v.id} ➔ ${currentCountyCallsign}`, buildDepartureRadioMessage(v, ev), '#7CFC00', true);
                        }
                        needsRender = true;
                    }
                }
                else if (v.phase === 'TRAVEL') {
                    if (v.travelTime > 0) { v.travelTime--; needsRender = true; }
                    else {
                        v.phase = 'ONSITE';
                        majorPhaseTransition = true;
                        getAllUnitsIncludingSgr().forEach(u => {
                            const veh = u.vehicles.find(vObj => vObj.id === v.id);
                            if (veh) {
                                if (ev.type === 'PZR') {
                                    if (!isVehicleInCombatAction(v.id)) veh.status = 'yellow';
                                } else {
                                    veh.status = 'red';
                                }
                            }
                        });

                        if (isMasterClientForCounty() && typeof logToMainRadio === 'function') {
                            if (ev.type === 'PZR') {
                                logToMainRadio(`${v.id} ➔ ${currentCountyCallsign}`, `${currentCountyCallsign}, tu ${v.id}. Jesteśmy na miejscu zabezpieczenia rejonu w ${ev.city}, pozostajemy w gotowości bojowej, odbiór.`, '#ffd700', true);
                            } else {
                                logToMainRadio(`${v.id} ➔ ${currentCountyCallsign}`, `${currentCountyCallsign}, tu ${v.id}. Jesteśmy na miejscu zdarzenia w ${ev.city}${ev.street ? ' (' + ev.street + ')' : ''}, odbiór.`, '#ffa500', true);
                            }
                        }

                        if (!ev.firstArrived) ev.firstArrived = true;
                        if (isMasterClientForCounty() && typeof triggerArrivalRadioReport === 'function') triggerArrivalRadioReport(ev, v);
                        needsRender = true;
                    }
                }
            });

            if (ev.type !== 'PZR' && ev.firstArrived && ev.remainingSeconds > 0) {
                ev.remainingSeconds--; needsRender = true;
            } else if (ev.type !== 'PZR' && ev.firstArrived && ev.remainingSeconds === 0) {
                if (isMasterClientForCounty()) {
                    triggerEventFinishAndReturn(ev);
                    majorPhaseTransition = true;
                    needsRender = true;
                }
            }
        }
        else if (ev.status === 'FINISHED') {
            ev.vehicles.forEach(v => {
                if (v.phase === 'RETURN') {
                    if (v.returnTime > 0) { v.returnTime--; needsRender = true; }
                    else {
                        v.phase = 'DONE';
                        majorPhaseTransition = true;
                        const activePzr = (ev.type !== 'PZR') ? getActivePzrForVehicle(v.id) : null;

                        getAllUnitsIncludingSgr().forEach(u => {
                            const veh = u.vehicles.find(vObj => vObj.id === v.id);
                            if (veh) veh.status = activePzr ? 'yellow' : 'green';
                        });

                        if (isMasterClientForCounty() && typeof logToMainRadio === 'function') {
                            if (activePzr) {
                                const pzrVehObj = activePzr.vehicles.find(pv => pv.id === v.id);
                                if (pzrVehObj) pzrVehObj.phase = 'ONSITE';
                                logToMainRadio(`${v.id} ➔ ${currentCountyCallsign}`, `${currentCountyCallsign}, tu ${v.id} (${v.unitName}). Powróciliśmy na zabezpieczenie rejonu (${activePzr.city}), w gotowości bojowej, odbiór.`, '#ffd700', true);
                            } else {
                                logToMainRadio(`${v.id} ➔ ${currentCountyCallsign}`, `${currentCountyCallsign}, tu ${v.id} (${v.unitName}). Zastęp w bazie, gotowy do działań, odbiór.`, '#00ff7f', true);
                            }
                        }
                        needsRender = true;
                    }
                }
            });
        }
    });

    if (needsRender) {
        renderUnits();
        renderEvents();
        if (isMasterClientForCounty()) {
            saveSimulationState(majorPhaseTransition);
        }
    }
    renderSelectedEventDetails();
    ensureVersionBadgeInStatusBar();

    const clockEl = document.getElementById('clock-box');
    if (clockEl) {
        const now = new Date();
        clockEl.innerText = now.toISOString().slice(0, 10) + ' ' + now.toLocaleTimeString();
    }
}

function startSimulationLoop() {
    if (simIntervalId) clearInterval(simIntervalId);
    const intervalMs = Math.max(200, Math.round(1000 / simSpeed));
    simIntervalId = setInterval(runSimulationTick, intervalMs);
}

function scheduleNextAutoCPR() {
    if (autoCprTimeoutId) clearTimeout(autoCprTimeoutId);
    const baseRandomTime = Math.floor(Math.random() * (600000 - 60000 + 1)) + 60000;
    const scaledTime = Math.max(15000, Math.round(baseRandomTime / (simSpeed * (currentWeatherData.cprFreqMultiplier || 1))));

    autoCprTimeoutId = setTimeout(() => {
        const cprModal = document.getElementById('cpr-modal');
        const launcherModal = document.getElementById('modal-launcher');
        const isLauncherOpen = launcherModal && launcherModal.style.display === 'flex';
        if (isMasterClientForCounty() && !isLauncherOpen && (!cprModal || cprModal.style.display !== 'flex')) {
            simulateIncomingCPR();
        }
        scheduleNextAutoCPR();
    }, scaledTime);
}

function scheduleNextWeatherChange() {
    if (weatherTimeoutId) clearTimeout(weatherTimeoutId);
    const randomWeatherMs = Math.floor(Math.random() * (1200000 - 600000 + 1)) + 600000;
    weatherTimeoutId = setTimeout(() => {
        if (isMasterClientForCounty()) triggerWeatherChange();
        scheduleNextWeatherChange();
    }, randomWeatherMs);
}

window.addEventListener('DOMContentLoaded', () => {
    injectPzrStyles();

    try {
        const savedSession = localStorage.getItem('SWDST_USER_SESSION');
        if (savedSession) {
            const parsed = JSON.parse(savedSession);
            if (parsed.rank) currentUserRank = parsed.rank;
            if (typeof parsed.username === 'string') currentUserName = parsed.username;
            if (parsed.role) currentUserRole = parsed.role;
            if (parsed.countyId && COUNTY_PROFILES[parsed.countyId]) currentCountyId = parsed.countyId;
        }
    } catch (e) {}

    initSupabaseAndCoop();
    applyCountyProfile(currentCountyId);
    updateStatusBarUserDisplay();
    if (typeof ensureMainRadioWindow === 'function') ensureMainRadioWindow();
    ensureCoopIntercomWindow();
    ensureVersionBadgeInStatusBar();
    ensureSubtypeDOMIntegration();
    ensureLauncherModalExists();
    ensureSgrButtonInEventModal();

    document.querySelectorAll('.top-menu .menu-item').forEach(item => {
        const txt = item.innerText.trim().toLowerCase();
        if (txt.includes('system')) item.onclick = () => openLauncherModal();
        else if (txt.includes('siły i środki')) item.onclick = () => openSiSModal();
        else if (txt.includes('mapy')) item.onclick = () => switchMainView('map');
        else if (txt.includes('podział bojowy') || txt.includes('widok')) item.onclick = () => switchMainView('table');
        else if (txt.includes('zestawienia') || txt.includes('raporty') || txt.includes('rejestr')) item.onclick = () => openReportsModal();
        else if (txt.includes('komunikator') || txt.includes('urządzenia')) item.onclick = () => openCoopIntercom();
    });

    const tabsBar = document.querySelector('.workspace .tabs-bar');
    if (tabsBar && !document.getElementById('btn-tab-map')) {
        const mapTabBtn = document.createElement('button');
        mapTabBtn.className = 'tab-btn'; mapTabBtn.id = 'btn-tab-map';
        mapTabBtn.innerHTML = '🗺️ Mapa Operacyjna';
        mapTabBtn.onclick = () => switchMainView('map');
        tabsBar.appendChild(mapTabBtn);

        const repTabBtn = document.createElement('button');
        repTabBtn.className = 'tab-btn';
        repTabBtn.innerHTML = '📊 Zestawienia i Raporty';
        repTabBtn.onclick = () => openReportsModal();
        tabsBar.appendChild(repTabBtn);
    }

    const btnOpenRadio = document.getElementById('btn-open-radio');
    if (btnOpenRadio && btnOpenRadio.parentElement && !document.getElementById('btn-open-main-radio')) {
        const mainRadBtn = document.createElement('button');
        mainRadBtn.className = 'btn-win'; mainRadBtn.id = 'btn-open-main-radio';
        mainRadBtn.style.cssText = 'background: #fff0f0; border-color: #800000; font-weight: bold; color: #800000;';
        mainRadBtn.innerHTML = '📻 Główne Radio SKKP';
        mainRadBtn.onclick = () => { if (typeof openMainRadio === 'function') openMainRadio(); };
        btnOpenRadio.parentElement.appendChild(mainRadBtn);
    }

    injectSpeedAndSaveControls();

    const pspGrid = 'grid-psp';
    const pspGridEl = document.getElementById(pspGrid);
    if (pspGridEl && !document.getElementById('view-map-container')) {
        const mapWrap = document.createElement('div');
        mapWrap.id = 'view-map-container';
        mapWrap.style.cssText = 'flex: 1; display: none; width: 100%; min-height: 260px; border: 1px solid #7f9db9; position: relative;';
        mapWrap.innerHTML = '<div id="leaflet-map" style="width: 100%; height: 100%;"></div>';
        pspGridEl.parentNode.insertBefore(mapWrap, pspGridEl);
    }

    ensureSiSModalExists();
    ensureReportsModalExists();

    const eventModal = document.querySelector('#modal-event .modal-window');
    if (eventModal) makeDraggable(eventModal, document.querySelector('#modal-event .modal-header'));

    const cprModal = document.getElementById('cpr-modal');
    if (cprModal) makeDraggable(cprModal, cprModal.querySelector('.cpr-header'));

    scheduleNextWeatherChange();
});

startSimulationLoop();
scheduleNextAutoCPR();
renderUnits();
