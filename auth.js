// =========================================================================
// PLIK: auth.js - LOGOWANIE Z BAZY SUPABASE, UPRAWNIENIA ORAZ LOGIKA RADIOWA KDR
// =========================================================================

let currentLoggedAccount = null;
const _originalApplyCountyProfile = window.applyCountyProfile;

// 1. FILTROWANIE JEDNOSTEK WG UPRAWNIEŃ POBRANYCH Z BAZY
window.applyCountyProfile = function(countyId) {
    if (typeof _originalApplyCountyProfile === 'function') {
        _originalApplyCountyProfile(countyId);
    }
    if (currentLoggedAccount && Array.isArray(currentLoggedAccount.allowed_units) && !currentLoggedAccount.allowed_units.includes("ALL")) {
        unitsPSP = unitsPSP.filter(u => currentLoggedAccount.allowed_units.includes(u.name));
        unitsOSP = unitsOSP.filter(u => currentLoggedAccount.allowed_units.includes(u.name));
        renderUnits();
    }
};

// 2. OKNO LOGOWANIA Z BAZY SUPABASE
window.ensureLauncherModalExists = function() {
    let modal = document.getElementById('modal-launcher');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modal-launcher';
    modal.style.cssText = 'display:flex; background:rgba(10, 36, 106, 0.65); z-index:12000;';

    const creds = getSupabaseCredentials();

    modal.innerHTML = `
        <div class="modal-window" style="width: 540px; background: #ece9d8; border: 2px solid #0a246a; box-shadow: 0 6px 25px rgba(0,0,0,0.6);">
            <div class="modal-header" style="background: linear-gradient(90deg, #0a246a, #1d4f91); color: #fff; padding: 6px 10px; font-size: 13px;">
                <span>🔐 ${APP_VERSION} — Autoryzacja i Uprawnienia w Bazie</span>
            </div>
            <div class="modal-body" style="padding: 12px; display: flex; flex-direction: column; gap: 8px;">
                
                <div id="auth-step-login" class="form-box" style="padding: 12px;">
                    <div class="form-title" style="font-size: 12px; margin-bottom: 8px;">Logowanie do Stanowiska Kierowania</div>
                    <div id="auth-error-msg" style="display:none; background:#ffe6e6; border:1px solid #b30000; color:#800000; padding:6px; font-size:11px; font-weight:bold; margin-bottom:8px;"></div>
                    
                    <div class="form-group" style="margin-bottom: 8px;">
                        <label style="width: 110px; font-weight: bold;">Login operatora:</label>
                        <input type="text" id="auth-inp-login" placeholder="Wpisz login..." style="flex:1; padding: 5px 8px; font-size: 12px; font-weight: bold;" onkeypress="if(event.key==='Enter') verifyAccountCredentials()">
                    </div>
                    <div class="form-group" style="margin-bottom: 10px;">
                        <label style="width: 110px; font-weight: bold;">Hasło dostępu:</label>
                        <input type="password" id="auth-inp-pass" placeholder="Wpisz hasło..." style="flex:1; padding: 5px 8px; font-size: 12px;" onkeypress="if(event.key==='Enter') verifyAccountCredentials()">
                    </div>
                    <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 6px;">
                        <button id="btn-auth-submit" class="btn-win" style="padding: 6px 18px; font-weight: bold; font-size: 12px; background: #dbe8f9; border: 1.5px solid #0a246a; color: #0a246a;" onclick="verifyAccountCredentials()">🔑 Zaloguj z bazy ➔</button>
                    </div>
                </div>

                <div id="auth-step-setup" style="display: none; flex-direction: column; gap: 8px;">
                    <div class="form-box" style="padding: 8px; background: #e2f0d9; border-color: #155724; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            Zalogowano z bazy: <b id="auth-lbl-operator" style="color: #155724; font-size: 12px;"></b>
                        </div>
                        <button class="btn-win" style="font-size: 10px; padding: 2px 8px; background: #ffe6e6; color: #800000;" onclick="logoutSwdAccount()">🚪 Wyloguj</button>
                    </div>

                    <div class="form-box" style="padding: 8px;">
                        <div class="form-title" style="font-size: 12px; margin-bottom: 6px;">1. Funkcja w Trybie Współpracy (Co-op)</div>
                        <div class="form-group">
                            <label>Rola na dyżurze:</label>
                            <select id="launcher-role" style="padding: 4px; font-weight: bold; color: #0a246a; flex: 1;">
                                <option value="UNIWERSALNY">🎖️ Dyspozytor Uniwersalny</option>
                                <option value="PRZYJMUJĄCY">📞 Dyspozytor Przyjmujący (112 CPR)</option>
                                <option value="KIERUJĄCY">📻 Dyspozytor Kierujący (Radio i SiS)</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-box" style="padding: 8px;">
                        <div class="form-title" style="font-size: 12px; margin-bottom: 6px;">2. Przydzielone Rejony Operacyjne</div>
                        <div id="auth-counties-list" style="display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow-y: auto; padding-right: 4px;"></div>
                    </div>

                    <div class="form-box" style="padding: 6px 8px; background: #f4f7fc;">
                        <div style="font-size: 10px; color: #333; margin-bottom: 3px;">🔗 <b>Baza Online Supabase</b> — klucz <i>anon public</i>:</div>
                        <input type="text" id="launcher-sb-key" value="${creds.key}" style="width: 100%; font-size: 10px; padding: 3px 5px; font-family: monospace; box-sizing: border-box;">
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 8px;">
                        <button class="btn-win" style="padding: 6px 18px; font-weight: bold; font-size: 12px; background: #e2f0d9; border: 1.5px solid #155724; color: #155724;" onclick="confirmLauncherLogin()">🚀 Rozpocznij służbę w SWD ➔</button>
                    </div>
                </div>

            </div>
        </div>
    `;
    document.body.appendChild(modal);
    restoreSavedDatabaseSession();
};

async function restoreSavedDatabaseSession() {
    try {
        const savedAcc = localStorage.getItem('SWDST_AUTH_ACCOUNT');
        if (!savedAcc || !supabaseClient) return;
        const parsed = JSON.parse(savedAcc);
        if (!parsed.login) return;

        const { data, error } = await supabaseClient
            .from('swd_users')
            .select('*')
            .eq('login', parsed.login.toLowerCase())
            .single();

        if (!error && data) {
            unlockSetupStepForAccount(data);
            const modal = document.getElementById('modal-launcher');
            if (modal) modal.style.display = 'none';
            setTimeout(applyUserPermissionsToUI, 300);
        }
    } catch (e) {}
}

window.verifyAccountCredentials = async function() {
    const loginInp = document.getElementById('auth-inp-login');
    const passInp = document.getElementById('auth-inp-pass');
    const errBox = document.getElementById('auth-error-msg');
    const btnSubmit = document.getElementById('btn-auth-submit');

    const lVal = loginInp ? loginInp.value.trim().toLowerCase() : "";
    const pVal = passInp ? passInp.value.trim() : "";

    if (!lVal || !pVal) {
        if (errBox) { errBox.innerText = "⚠️ Wprowadź login oraz hasło!"; errBox.style.display = 'block'; }
        return;
    }

    if (!supabaseClient) initSupabaseAndCoop();
    if (!supabaseClient) {
        if (errBox) { errBox.innerText = "❌ Brak połączenia z bazą Supabase!"; errBox.style.display = 'block'; }
        return;
    }

    if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerText = "⏳ Weryfikacja w bazie..."; }

    try {
        const { data, error } = await supabaseClient
            .from('swd_users')
            .select('*')
            .ilike('login', lVal)
            .eq('password', pVal)
            .single();

        if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerText = "🔑 Zaloguj z bazy ➔"; }

        if (error || !data) {
            if (errBox) { errBox.innerText = "❌ Nieprawidłowy login lub hasło!"; errBox.style.display = 'block'; }
            return;
        }

        if (errBox) errBox.style.display = 'none';
        unlockSetupStepForAccount(data);
    } catch (e) {
        if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerText = "🔑 Zaloguj z bazy ➔"; }
        if (errBox) { errBox.innerText = "❌ Błąd połączenia z tabelą swd_users!"; errBox.style.display = 'block'; }
    }
};

function unlockSetupStepForAccount(account) {
    currentLoggedAccount = account;
    currentUserRank = account.rank || "asp.";
    currentUserName = account.name || account.login;
    currentUserRole = account.default_role || "UNIWERSALNY";

    const allowedCounties = Array.isArray(account.allowed_counties) ? account.allowed_counties : ["ALL"];

    const stepLogin = document.getElementById('auth-step-login');
    const stepSetup = document.getElementById('auth-step-setup');
    const lblOp = document.getElementById('auth-lbl-operator');
    const roleSel = document.getElementById('launcher-role');
    const countiesBox = document.getElementById('auth-counties-list');

    if (stepLogin) stepLogin.style.display = 'none';
    if (stepSetup) stepSetup.style.display = 'flex';
    if (lblOp) lblOp.innerText = `${currentUserRank} ${currentUserName} (login: ${account.login})`;
    if (roleSel) roleSel.value = currentUserRole;

    const allowedProfiles = RAW_PROFILES.filter(rp =>
        allowedCounties.includes("ALL") || allowedCounties.includes(rp.id)
    );

    if (countiesBox) {
        countiesBox.innerHTML = allowedProfiles.map((rp, idx) => `
            <label style="display: flex; align-items: center; gap: 8px; padding: 5px 8px; border: 1.5px solid #0a246a; background: ${idx === 0 ? '#f0f5ff' : '#ffffff'}; cursor: pointer; border-radius: 3px;">
                <input type="radio" name="launcher-county" value="${rp.id}" ${idx === 0 ? 'checked' : ''}>
                <div>
                    <div style="font-weight: bold; color: #0a246a; font-size: 12px;">${rp.name}</div>
                    <div style="font-size: 10px; color: #444;">${rp.desc} • Kryptonim: <b>${rp.radioCallsign}</b></div>
                </div>
            </label>
        `).join('');
    }
}

window.logoutSwdAccount = function() {
    currentLoggedAccount = null;
    localStorage.removeItem('SWDST_AUTH_ACCOUNT');
    localStorage.removeItem('SWDST_USER_SESSION');

    const stepLogin = document.getElementById('auth-step-login');
    const stepSetup = document.getElementById('auth-step-setup');
    const passInp = document.getElementById('auth-inp-pass');

    if (passInp) passInp.value = '';
    if (stepSetup) stepSetup.style.display = 'none';
    if (stepLogin) stepLogin.style.display = 'block';
};

window.openLauncherModal = function() {
    if (!document.getElementById('modal-launcher')) ensureLauncherModalExists();
    const modal = document.getElementById('modal-launcher');
    if (currentLoggedAccount) {
        unlockSetupStepForAccount(currentLoggedAccount);
        const rad = document.querySelector(`input[name="launcher-county"][value="${currentCountyId}"]`);
        if (rad) rad.checked = true;
    }
    if (modal) modal.style.display = 'flex';
};

window.confirmLauncherLogin = function() {
    if (!currentLoggedAccount) { alert("Najpierw zaloguj się na swoje konto!"); return; }

    const selRole = document.getElementById('launcher-role');
    const inpSbKey = document.getElementById('launcher-sb-key');
    const chosenCountyRadio = document.querySelector('input[name="launcher-county"]:checked');
    const allowedCounties = Array.isArray(currentLoggedAccount.allowed_counties) ? currentLoggedAccount.allowed_counties : ["ALL"];

    currentUserRank = currentLoggedAccount.rank;
    currentUserName = currentLoggedAccount.name;
    currentUserRole = selRole ? selRole.value : (currentLoggedAccount.default_role || "UNIWERSALNY");
    const newCountyId = chosenCountyRadio ? chosenCountyRadio.value : (
        allowedCounties.includes("ALL") ? "wejherowski" : allowedCounties[0]
    );

    if (inpSbKey && inpSbKey.value.trim()) {
        localStorage.setItem('SWDST_SUPABASE_ANON_KEY', inpSbKey.value.trim());
    }

    localStorage.setItem('SWDST_AUTH_ACCOUNT', JSON.stringify({ login: currentLoggedAccount.login }));
    localStorage.setItem('SWDST_USER_SESSION', JSON.stringify({
        rank: currentUserRank, username: currentUserName, role: currentUserRole, countyId: newCountyId
    }));

    initSupabaseAndCoop();
    applyCountyProfile(newCountyId);
    updateStatusBarUserDisplay();
    trackMyPresence();

    const modal = document.getElementById('modal-launcher');
    if (modal) modal.style.display = 'none';

    setTimeout(applyUserPermissionsToUI, 300);
};

// 3. EGZEKWOWANIE UPRAWNIEŃ Z BAZY DANYCH DLA PRZYCISKÓW INTERFEJSU
window.applyUserPermissionsToUI = function() {
    if (!currentLoggedAccount) return;
    const perms = currentLoggedAccount.permissions || { simulate_cpr: true, change_speed: true, change_weather: true, reset_shift: true };

    // 1. Przycisk: Symuluj nowe zgłoszenie z CPR (112)
    const btnSimCpr = document.querySelector('button[onclick*="simulateIncomingCPR"]');
    if (btnSimCpr) {
        btnSimCpr.style.display = perms.simulate_cpr ? 'inline-block' : 'none';
    }

    // 2. Przyciski: Zmiana tempa czasu (1x, 2x, 5x)
    ['btn-speed-1x', 'btn-speed-2x', 'btn-speed-5x'].forEach(id => {
        const btnSpeed = document.getElementById(id);
        if (btnSpeed) {
            btnSpeed.disabled = !perms.change_speed;
            btnSpeed.style.opacity = !perms.change_speed ? '0.4' : '1';
            btnSpeed.title = !perms.change_speed ? 'Brak uprawnień w bazie do zmiany tempa czasu' : '';
        }
    });

    // 3. Przycisk: Zmiana pogody
    const weatherBadge = document.getElementById('weather-status-badge');
    if (weatherBadge) {
        weatherBadge.style.pointerEvents = perms.change_weather ? 'auto' : 'none';
        weatherBadge.title = perms.change_weather ? 'Kliknij, aby zmienić pogodę' : 'Brak uprawnień w bazie do zmiany pogody';
    }

    // 4. Przycisk: Reset służby
    const btnReset = document.querySelector('button[onclick*="resetShiftState"]');
    if (btnReset) {
        btnReset.style.display = perms.reset_shift ? 'inline-block' : 'none';
    }
};

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(applyUserPermissionsToUI, 600);
});

// =========================================================================
// 4. POPRAWIONA LOGIKA RADIOWA KDR: OWADY, PODZIAŁ P/MZ ORAZ WYMIARY OBIEKTÓW
// =========================================================================

function getRealisticBuildingDimensions(ev) {
    const text = `${ev.desc || ''} ${ev.subtype || ''}`.toLowerCase();

    if (text.includes('hal') || text.includes('magazyn') || text.includes('produkcyj') || text.includes('zakład') || text.includes('fabryk')) {
        const dims = [
            "hala o wymiarach około 60 na 25 metrów i wysokości 10 metrów, konstrukcja stalowa, dach kryty płytą warstwową",
            "obiekt magazynowo-produkcyjny o wymiarach 45 na 20 metrów, wysokość w szczycie około 9 metrów",
            "hala wielkopowierzchniowa około 80 na 30 metrów, jednokondygnacyjna, wysokość 12 metrów"
        ];
        return dims[Math.floor(Math.random() * dims.length)];
    }

    if (text.includes('mieszkan') || text.includes('blok') || text.includes('kamienic') || text.includes('wielorodzin') || text.includes('piętrz') || text.includes('klatk')) {
        const dims = [
            "mieszkanie o powierzchni około 48 m² zlokalizowane na 2. piętrze w budynku wielorodzinnym 4-kondygnacyjnym (wysokość budynku około 12 metrów)",
            "lokal mieszkalny około 60 m² na 3. piętrze, budynek 5-kondygnacyjny o wymiarach w rzucie 35 na 12 metrów",
            "mieszkanie o powierzchni około 42 m² na 1. piętrze w kamienicy 3-kondygnacyjnej (wysokość do gzymsu około 10 metrów)"
        ];
        return dims[Math.floor(Math.random() * dims.length)];
    }

    if (text.includes('sklep') || text.includes('handlow') || text.includes('market') || text.includes('lokal') || text.includes('usług')) {
        const dims = [
            "pawilon handlowo-usługowy o wymiarach 20 na 15 metrów, jednokondygnacyjny, wysokość około 4,5 metra",
            "budynek sklepu o powierzchni około 250 m² (wymiary 25 na 10 metrów), dach płaski, wysokość 5 metrów",
            "lokal handlowy o wymiarach 15 na 12 metrów na parterze budynku usługowego, wysokość około 4 metrów"
        ];
        return dims[Math.floor(Math.random() * dims.length)];
    }

    if (text.includes('stodoł') || text.includes('gospodarcz') || text.includes('szop') || text.includes('altan') || text.includes('garaż') || text.includes('kurnik')) {
        const dims = [
            "budynek gospodarczy o wymiarach 16 na 8 metrów i wysokości około 6 metrów, konstrukcja murowano-drewniana",
            "obiekt o wymiarach około 8 na 5 metrów, wysokość 3,5 metra, dach kryty blachą",
            "stodoła o wymiarach 20 na 10 metrów, wysokość w kalenicy około 8 metrów"
        ];
        return dims[Math.floor(Math.random() * dims.length)];
    }

    if (text.includes('szkoł') || text.includes('przedszkol') || text.includes('urząd') || text.includes('szpital') || text.includes('hotel')) {
        return "budynek użyteczności publicznej o wymiarach 40 na 15 metrów, 3-kondygnacyjny, wysokość około 11 metrów";
    }

    const houseDims = [
        "budynek mieszkalny jednorodzinny o wymiarach 12 na 10 metrów, parterowy z poddaszem użytkowym, wysokość w kalenicy około 8 metrów",
        "dom jednorodzinny o wymiarach 14 na 9 metrów, dwukondygnacyjny, dach dwuspadowy kryty dachówką (wysokość około 8,5 metra)",
        "budynek mieszkalny o wymiarach 11 na 9 metrów, parterowy, wysokość do kalenicy około 6,5 metra"
    ];
    return houseDims[Math.floor(Math.random() * houseDims.length)];
}

function hasLadderOrLiftDispatched(ev) {
    if (!ev || !Array.isArray(ev.vehicles)) return false;
    return ev.vehicles.some(v => {
        const n = (v.name || '').toUpperCase();
        const id = (v.id || '').toUpperCase();
        return n.includes('SD') || n.includes('SH') || n.includes('SCD') || n.includes('SHD') ||
               id.endsWith('51') || id.endsWith('52') || id.endsWith('53') || id.endsWith('54');
    });
}

window.evaluateSiSRequirementForEvent = function(ev, kdrCallsign) {
    const desc = `${ev.desc || ''} ${ev.subtype || ''}`.toLowerCase();
    const isInsects = desc.includes('szersze') || desc.includes('os ') || desc.includes('osy') || desc.includes('pszcz') || desc.includes('owad') || desc.includes('gniazd') || desc.includes('rój');
    const hasAerial = hasLadderOrLiftDispatched(ev);

    // A) OWADY (Szerszenie / Osy / Pszczoły)
    if (isInsects) {
        const isHighLocation = desc.includes('dach') || desc.includes('podbitk') || desc.includes('strych') || desc.includes('poddasz') || desc.includes('wysoko') || desc.includes('piętr') || desc.includes('drzew');
        if (isHighLocation && !hasAerial) {
            if (ev._insectLadderRequested === undefined) {
                ev._insectLadderRequested = Math.random() < 0.45;
            }
            if (ev._insectLadderRequested) {
                return `${currentCountyCallsign}, tu ${kdrCallsign}. Gniazdo owadów znajduje się wysoko pod podbitką/na dachu (brak bezpiecznego dojścia z drabiny przystawnej). Proszę o zadysponowanie podnośnika hydraulicznego lub drabiny mechanicznej (SH/SD). Inne siły i środki nie są potrzebne. Bez odbioru.`;
            }
        }
        return `${currentCountyCallsign}, tu ${kdrCallsign}. Siły i środki na miejscu są w pełni wystarczające. Zabezpieczyliśmy teren, strażacy w ubraniach specjalnych przystępują do usunięcia gniazda owadów. Bez odbioru.`;
    }

    // B) POZOSTAŁE MIEJSCOWE ZAGROŻENIA (MZ / AF) - bez wzmianek o pożarze
    if (ev.type === 'MZ' || ev.type === 'AF') {
        const isSeriousAccident = desc.includes('wypadek') || desc.includes('zakleszcz') || desc.includes('zderzeni') || desc.includes('dachow') || desc.includes('potrąc');
        if (isSeriousAccident && ev.vehicles.length < 2) {
            return `${currentCountyCallsign}, tu ${kdrCallsign}. Siły i środki są niewystarczające! Do zabezpieczenia miejsca wypadku i prowadzenia działań ratowniczych potrzebny jeszcze 1 zastęp ratowniczo-gaśniczy (GBA/SRt). Bez odbioru.`;
        }
        return `${currentCountyCallsign}, tu ${kdrCallsign}. Siły i środki na miejscu są wystarczające, prowadzimy działania własnymi siłami. Bez odbioru.`;
    }

    // C) POŻARY (Typ 'P')
    if (ev.type === 'P') {
        const isBuildingFire = desc.includes('budynk') || desc.includes('mieszkan') || desc.includes('dom') || desc.includes('hal') || desc.includes('poddasz') || desc.includes('dach');
        const hasPspUnit = ev.vehicles.some(v => (v.unitName || '').includes('JRG'));

        if (isBuildingFire && !desc.includes('sadz') && !desc.includes('komin')) {
            const missing = [];
            if (!hasPspUnit) missing.push("wsparcie z JRG PSP");
            if (!hasAerial) missing.push("podnośnik lub drabina mechaniczna (SH/SD)");
            if (ev.vehicles.length < 3) missing.push(`minimum jeszcze ${3 - ev.vehicles.length} zastęp(y) GBA/GCBA do pracy w aparatach ODO`);

            if (missing.length > 0) {
                return `${currentCountyCallsign}, tu ${kdrCallsign}. Siły i środki są NIEWYSTARCZAJĄCE! Na pożar obiektu konieczne: ${missing.join(', ')}. Bez odbioru.`;
            }
        }
        return `${currentCountyCallsign}, tu ${kdrCallsign}. Siły i środki na miejscu są wystarczające, pożar zlokalizowany, trwa dogaszanie i oddymianie. Bez odbioru.`;
    }

    return `${currentCountyCallsign}, tu ${kdrCallsign}. Siły i środki na miejscu są wystarczające, działamy bez wsparcia. Bez odbioru.`;
};

(function hookRadioQuestions() {
    const origSendDynamic = window.sendRadioMessageDynamic;
    window.sendRadioMessageDynamic = async function(evId, presetText = null) {
        const ev = events.find(e => e.id === evId);
        const inp = document.getElementById(`radio-inp-${evId}`);
        const rawText = presetText !== null ? presetText : (inp ? inp.value.trim() : '');
        if (!ev || !rawText) return;

        const lowText = rawText.toLowerCase();
        const isDimensionQuestion = lowText.includes('wymiar') || lowText.includes('powierzchni') || lowText.includes('wysokoś') || lowText.includes('jaki to obiekt') || lowText.includes('jaki budynek') || lowText.includes('wielkoś');
        const isSisQuestion = lowText.includes('dodatkowe siły') || lowText.includes('potrzebne są dodatkowe') || lowText.includes('wystarczające') || lowText.includes('wsparcie');

        if (isDimensionQuestion || isSisQuestion) {
            if (inp && presetText === null) inp.value = '';
            const arrivedVehs = ev.vehicles.filter(v => v.phase === 'ONSITE');
            const kdrVeh = arrivedVehs.length > 0 ? arrivedVehs[0] : ev.vehicles[0];
            const kdrCallsign = kdrVeh ? kdrVeh.id : "KDR";

            const timeNow = new Date().toLocaleTimeString();
            ev.radioLogs = ev.radioLogs || [];
            ev.radioLogs.push({
                time: timeNow,
                sender: `${currentCountyCallsign} ➔ ${kdrCallsign}`,
                text: `${currentCountyCallsign}, ${rawText}`,
                color: '#7CFC00'
            });
            if (typeof updateRadioChatDynamic === 'function') updateRadioChatDynamic(evId);

            setTimeout(() => {
                if (arrivedVehs.length === 0) {
                    ev.radioLogs.push({
                        time: new Date().toLocaleTimeString(),
                        sender: `${kdrCallsign} ➔ ${currentCountyCallsign}`,
                        text: `${currentCountyCallsign}, tu ${kdrCallsign}. Jesteśmy jeszcze w drodze na miejsce zdarzenia, podam szczegóły po dojeździe i przeprowadzeniu rozpoznania. Bez odbioru.`,
                        color: '#ffcc00'
                    });
                } else if (isDimensionQuestion) {
                    const dimDesc = getRealisticBuildingDimensions(ev);
                    ev.radioLogs.push({
                        time: new Date().toLocaleTimeString(),
                        sender: `${kdrCallsign} ➔ ${currentCountyCallsign}`,
                        text: `${currentCountyCallsign}, tu ${kdrCallsign}. Podaję parametry obiektu po rozpoznaniu: to ${dimDesc}. Bez odbioru.`,
                        color: '#ffa500'
                    });
                } else if (isSisQuestion) {
                    const sisReply = window.evaluateSiSRequirementForEvent(ev, kdrCallsign);
                    ev.radioLogs.push({
                        time: new Date().toLocaleTimeString(),
                        sender: `${kdrCallsign} ➔ ${currentCountyCallsign}`,
                        text: sisReply,
                        color: sisReply.includes('NIEWYSTARCZAJĄCE') || sisReply.includes('Proszę o zadysponowanie') ? '#ff9900' : '#00ff7f'
                    });
                }
                audioMotorola.currentTime = 0; audioMotorola.play().catch(() => {});
                if (typeof updateRadioChatDynamic === 'function') updateRadioChatDynamic(evId);
                if (typeof saveSimulationState === 'function') saveSimulationState(true);
            }, 900);
            return;
        }

        if (typeof origSendDynamic === 'function') {
            return origSendDynamic(evId, presetText);
        }
    };
})();
