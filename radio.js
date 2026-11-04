// =========================================================================
// PLIK 3: radio.js - GŁÓWNE RADIO SKKP, SYNTETYZATOR MOWY I TAKTYKA KDR
// =========================================================================

// --- SYNTETYZATOR MOWY (GŁOSOWE RADIO) ---
function speakRadioMessage(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // Przerwij poprzednią wypowiedź, jeśli gra
    
    // Czyszczenie tekstu z formatowania HTML i cudzysłowów do syntezatora
    const cleanText = text.replace(/<[^>]*>?/gm, '').replace(/["„”]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'pl-PL';
    utterance.pitch = 0.85; // Niższy ton – bardziej radiowy
    utterance.rate = 1.15;  // Nieco szybsze tempo (styl korespondencji służbowej)

    // Wybór polskiego głosu, jeśli jest dostępny w systemie
    const voices = window.speechSynthesis.getVoices();
    const polishVoice = voices.find(v => v.lang === 'pl-PL' || v.lang === 'pl');
    if (polishVoice) utterance.voice = polishVoice;

    window.speechSynthesis.speak(utterance);
}

// --- GŁÓWNE RADIO OGÓLNOPOWIATOWE SKKP ---
function ensureMainRadioWindow() {
    if (mainRadioModalEl) return mainRadioModalEl;
    const modal = document.createElement('div');
    modal.id = 'main-radio-modal';
    modal.style.cssText = 'position:fixed; z-index:1045; width:460px; right:20px; bottom:35px;';
    modal.innerHTML = `
        <div style="background: #c0c0c0; border: 2px solid #ffffff; border-right-color: #404040; border-bottom-color: #404040; box-shadow: 2px 2px 6px rgba(0,0,0,0.5); font-family: 'Segoe UI', Tahoma, sans-serif;">
            <div class="main-radio-header" style="background: linear-gradient(90deg, #800000, #b30000); color: #ffffff; padding: 4px 6px; font-weight: bold; font-size: 13px; display: flex; justify-content: space-between; align-items: center; cursor: move; user-select: none;">
                <span>📻 Główne Radio SKKP (${currentCountyCallsign})</span>
                <div style="display: flex; gap: 2px;">
                    <button style="background: #c0c0c0; border: 1px solid #fff; width: 18px; height: 16px; font-size: 10px; font-weight: bold; cursor: pointer; padding: 0;" onclick="minimizeMainRadio()">_</button>
                    <button style="background: #c0c0c0; border: 1px solid #fff; width: 18px; height: 16px; font-size: 10px; font-weight: bold; cursor: pointer; padding: 0;" onclick="closeMainRadio()">✕</button>
                </div>
            </div>
            <div style="padding: 6px; background: #c0c0c0;">
                <div style="font-size:10px; color:#222; margin-bottom:3px; font-weight:bold;">Meldunki wyjazdów, dojazdów, zakończenia działań i powrotów do bazy:</div>
                <div id="main-radio-chat" style="background: #111111; color: #ffffff; font-family: 'Consolas', 'Courier New', monospace; font-weight: bold; font-size: 12px; height: 210px; padding: 6px; overflow-y: auto; border: 2px solid #808080; box-sizing: border-box; line-height: 1.35;"></div>
                <div style="display: flex; gap: 4px; margin-top: 6px; align-items: center;">
                    <button style="padding: 4px 8px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold; color:#000;" onclick="sendMainRadioDispatchMsg(currentCountyCallsign + ', przyjąłem.')">✔ Przyjąłem</button>
                    <input type="text" id="inp-main-radio" placeholder="Nadaj komunikat ogólny..." style="flex: 1; padding: 4px 6px; font-size: 12px; background: #ffffff; color:#000; border: 2px solid #808080; outline: none;" onkeypress="if(event.key==='Enter') sendMainRadioCustom()">
                    <button style="padding: 4px 10px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold; color:#000;" onclick="sendMainRadioCustom()">Nadaj</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    if (typeof makeDraggable === 'function') makeDraggable(modal, modal.querySelector('.main-radio-header'));
    mainRadioModalEl = modal;
    updateMainRadioChat();
    return modal;
}

function openMainRadio() {
    const modal = ensureMainRadioWindow();
    modal.style.display = 'block';
    const minItem = document.getElementById('min-main-radio');
    if (minItem) minItem.remove();
    updateMainRadioChat();
}

function closeMainRadio() { if (mainRadioModalEl) mainRadioModalEl.style.display = 'none'; }

function minimizeMainRadio() {
    if (mainRadioModalEl) mainRadioModalEl.style.display = 'none';
    const bar = document.getElementById('minimized-bar');
    if (bar && !document.getElementById('min-main-radio')) {
        const item = document.createElement('div');
        item.className = 'minimized-item'; item.id = 'min-main-radio';
        item.innerHTML = `📻 Główne Radio SKKP`;
        item.onclick = () => openMainRadio();
        bar.appendChild(item);
    }
}

function logToMainRadio(callsign, messageText, color = '#7CFC00', playBeep = true) {
    ensureMainRadioWindow();
    if (playBeep) {
        audioMotorola.currentTime = 0;
        audioMotorola.play().catch(() => {});
        // Odczytaj komunikat głosem po krótkim opóźnieniu na dźwięk Motoroli
        setTimeout(() => speakRadioMessage(`${callsign}: ${messageText}`), 600);
    }
    const timeStr = new Date().toLocaleTimeString();
    mainRadioLogs.push(`<div style="margin-bottom: 6px; color: ${color}; border-bottom: 1px dashed #333; padding-bottom: 3px;"><span style="color:#cccccc;">[${timeStr}]</span> <b>${callsign}:</b><br>"${messageText}"</div>`);
    updateMainRadioChat();
    if (typeof saveSimulationState === 'function') saveSimulationState();
}

function updateMainRadioChat() {
    const chat = document.getElementById('main-radio-chat');
    if (chat) {
        chat.innerHTML = mainRadioLogs.length > 0
            ? mainRadioLogs.join('')
            : `<div style="color:#aaa; font-style:italic;">[System] Kanał główny SKKP (${currentCountyCallsign}) aktywny. Nasłuch statusów SiS...</div>`;
        chat.scrollTop = chat.scrollHeight;
    }
}

function sendMainRadioDispatchMsg(text) {
    if (!text) return;
    logToMainRadio(`${currentCountyCallsign} ➔ WSZYSCY`, text, '#00ffff', true);
}

function sendMainRadioCustom() {
    const inp = document.getElementById('inp-main-radio');
    if (!inp || !inp.value.trim()) return;
    sendMainRadioDispatchMsg(inp.value.trim());
    inp.value = '';
}

// --- TAKTYKA I OCENA SIŁ I ŚRODKÓW KDR ---
function evaluateTacticalForces(ev) {
    const text = ((ev.desc || "") + " " + (ev.subtype || "")).toLowerCase();
    const vehicles = ev.vehicles || [];
    const totalCount = vehicles.length;
    const hasJRG = vehicles.some(v => v.unitName && v.unitName.includes("JRG"));
    const onlyOSP = totalCount > 0 && !hasJRG;
    const hasLadder = vehicles.some(v => /SH-|SD-|SHD-|53|51/.test(v.name + " " + v.id));
    const gcbaCount = vehicles.filter(v => v.name.includes("GCBA")).length;

    if (/hala|hali|magazyn|zakład|produkcyjn|składowisk|tartak/.test(text)) {
        let missing = [];
        if (!hasJRG) missing.push("zastępy gaśnicze z JRG PSP");
        if (gcbaCount < 2) missing.push("co najmniej dwa ciężkie zastępy GCBA");
        if (!hasLadder) missing.push("drabina mechaniczna lub podnośnik (SH/SD)");
        if (totalCount < 4) missing.push(`dodatkowe zastępy gaśnicze (obecnie tylko ${totalCount}, potrzeba min. 4-5)`);
        if (missing.length > 0) return { sufficient: false, reason: `Siły i środki są ZDECYDOWANIE NIEWYSTARCZAJĄCE jak na pożar hali/zakładu! Pilnie potrzebne: ${missing.join(", ")}.` };
    }
    if (/mieszkan|kamienic|balkon|klatce|dach|poddasz|szkoł|urząd|budynk|komin|sadz/.test(text)) {
        let missing = [];
        if (onlyOSP) missing.push("wsparcie z JRG PSP (samo OSP na pożarze budynku mieszkalnego to za mało)");
        if (!hasLadder) missing.push("podnośnik lub drabina mechaniczna (SH/SD)");
        if (totalCount < 3) missing.push(`minimum jeszcze ${3 - totalCount} zastęp(y) GBA/GCBA do pracy w aparatach ODO`);
        if (missing.length > 0) return { sufficient: false, reason: `Siły i środki są NIEWYSTARCZAJĄCE! Na pożar w obiekcie mieszkalnym/budynku konieczne: ${missing.join(", ")}.` };
    }
    if (/las|leśn|traw|stog|stodoł|gospodarcz|rolnicz/.test(text)) {
        let missing = [];
        if (onlyOSP && totalCount < 3) missing.push("wsparcie z JRG PSP oraz sąsiednich OSP");
        if (gcbaCount < 1) missing.push("ciężki samochód gaśniczy GCBA do dowożenia wody");
        if (totalCount < 3) missing.push(`dodatkowe zastępy gaśnicze (obecnie tylko ${totalCount})`);
        if (missing.length > 0) return { sufficient: false, reason: `Siły i środki są NIEWYSTARCZAJĄCE! Prosimy o zadysponowanie: ${missing.join(", ")}.` };
    }
    if (/wypadek|zderzenie|czołow|zakleszcz/.test(text) && (totalCount < 2 || onlyOSP)) {
        return { sufficient: false, reason: `Siły i środki są niewystarczające na wypadek komunikacyjny – potrzebujemy wsparcia zastępu ratownictwa technicznego z JRG PSP oraz ZRM i Policji.` };
    }
    if (/poszukiwan|zaginion/.test(text) && totalCount < 3) {
        return { sufficient: false, reason: `Siły i środki są niewystarczające do przeszukania terenu – prosimy o zadysponowanie dodatkowych zastępów OSP/PSP.` };
    }
    if (totalCount <= 1 && (ev.type === 'P' || onlyOSP) && !/śmietnik|os|szerszeni|konar/.test(text)) {
        return { sufficient: false, reason: `Jeden zastęp na miejscu to za mało ze względów bezpieczeństwa taktycznego – prosimy o zadysponowanie jeszcze jednego zastępu GBA/GCBA.` };
    }
    return { sufficient: true, reason: `Siły i środki zadysponowane na miejsce (${totalCount} zast.) są w tej chwili wystarczające do opanowania sytuacji.` };
}

function generateSmartKdrResponse(kdrCallsign, userQuestion, ev) {
    const q = userQuestion.toLowerCase();
    const desc = (ev.desc || "").toLowerCase();
    const tactical = evaluateTacticalForces(ev);
    const isSmall = /śmietnik|os|szerszeni|konar/.test(desc);
    const hasPrm = /pogotow|zrm|karetk|medyczn/.test(q);
    const hasPol = /policj|patrol/.test(q);
    const hasSis = /dodatkow|siły|środki|srodki|zastęp|podnośnik|drabin|wystarcz/.test(q);

    if (hasSis) return `${currentCountyCallsign}, tu ${kdrCallsign}. ${tactical.reason} Bez odbioru.`;
    if (hasPrm && hasPol) return `${currentCountyCallsign}, tu ${kdrCallsign}. Przyda się u nas zarówno ZRM, jak i patrol Policji do zabezpieczenia miejsca. Bez odbioru.`;
    if (hasPrm) return isSmall ? `${currentCountyCallsign}, tu ${kdrCallsign}. Nie ma osób poszkodowanych, ZRM nie jest potrzebny. Bez odbioru.` : `${currentCountyCallsign}, tu ${kdrCallsign}. Tak, mamy osobę wymagającą przebadania, poproszę ZRM na miejsce. Bez odbioru.`;
    if (hasPol) return `${currentCountyCallsign}, tu ${kdrCallsign}. Tak, przyda się patrol Policji na miejscu. Bez odbioru.`;
    if (/przyjąłem|zrozumiałem/.test(q)) return `${currentCountyCallsign}, tu ${kdrCallsign}. Zrozumiałem, działamy dalej na miejscu. Bez odbioru.`;
    if (!tactical.sufficient) return `${currentCountyCallsign}, tu ${kdrCallsign}. Prowadzimy działania pod adresem ${ev.street || ev.city}, ale ${tactical.reason.charAt(0).toLowerCase() + tactical.reason.slice(1)} Bez odbioru.`;
    return `${currentCountyCallsign}, tu ${kdrCallsign}. Sytuacja na miejscu pod kontrolą, prowadzimy działania pod adresem ${ev.street || ev.city}. Bez odbioru.`;
}

// --- OKNO RADIA ZDARZENIA ---
function createRadioWindow(evId) {
    if (openRadioWindows[evId]) {
        openRadioWindows[evId].style.display = 'block';
        return openRadioWindows[evId];
    }
    const ev = events.find(e => e.id === evId);
    if (!ev) return null;

    const modal = document.createElement('div');
    modal.id = `radio-modal-${evId}`;
    const offset = (Object.keys(openRadioWindows).length * 25) % 150;
    modal.style.cssText = `position:fixed; z-index:1050; width:440px; left:calc(50% - 220px + ${offset}px); top:calc(50% - 210px + ${offset}px);`;

    modal.innerHTML = `
        <div style="background: #c0c0c0; border: 2px solid #ffffff; border-right-color: #404040; border-bottom-color: #404040; box-shadow: 2px 2px 5px rgba(0,0,0,0.5); font-family: 'Segoe UI', Tahoma, sans-serif;">
            <div class="radio-win-header" style="background: linear-gradient(90deg, #004080, #1060b0); color: #ffffff; padding: 3px 6px; font-weight: bold; font-size: 13px; display: flex; justify-content: space-between; align-items: center; cursor: move; user-select: none;">
                <span id="radio-title-${evId}">🖵 Korespondencja Radiowa - ID: ${ev.id} (${ev.city}, ${ev.street || ''})</span>
                <div style="display: flex; gap: 2px;">
                    <button style="background: #c0c0c0; border: 1px solid #fff; width: 18px; height: 16px; font-size: 10px; font-weight: bold; cursor: pointer; padding: 0;" onclick="minimizeRadioWindow(${ev.id})">_</button>
                    <button style="background: #c0c0c0; border: 1px solid #fff; width: 18px; height: 16px; font-size: 10px; font-weight: bold; cursor: pointer; padding: 0;" onclick="closeRadioWindow(${ev.id})">✕</button>
                </div>
            </div>
            <div style="padding: 6px; background: #c0c0c0;">
                <div id="radio-chat-${evId}" style="background: #000000; color: #ffcc00; font-family: 'Courier New', monospace; font-weight: bold; font-size: 12px; height: 195px; padding: 6px; overflow-y: auto; border: 2px solid #808080; box-sizing: border-box; line-height: 1.3;"></div>
                <div style="display: flex; gap: 4px; margin-top: 6px; justify-content: space-between;">
                    <button style="flex: 1; padding: 4px 2px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold; color: #000;" onclick="sendRadioReplyDynamic(${ev.id}, 'Przyjąłem.')"><span style="color: green;">✔</span> Przyjąłem</button>
                    <button style="flex: 1; padding: 4px 2px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold; color: #000;" onclick="sendRadioReplyDynamic(${ev.id}, currentCountyCallsign + ', czy na miejscu wymagany jest zespół ZRM?')"><span style="color: red;">🚑</span> Wymagany ZRM?</button>
                    <button style="flex: 1; padding: 4px 2px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold; color: #000;" onclick="sendRadioReplyDynamic(${ev.id}, currentCountyCallsign + ', czy potrzebny jest patrol Policji?')"><span style="color: blue;">🚔</span> Potrzebna Policja?</button>
                    <button style="flex: 1; padding: 4px 2px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold; color: #000;" onclick="sendRadioReplyDynamic(${ev.id}, currentCountyCallsign + ', czy potrzebne są dodatkowe siły i środki?')"><span style="color: darkred;">🚒</span> Dodatkowe SiS?</button>
                </div>
                <div style="display: flex; gap: 4px; margin-top: 6px; align-items: center;">
                    <input type="text" id="inp-radio-reply-${ev.id}" placeholder="Wpisz treść wiadomości radiowej..." style="flex: 1; padding: 5px 8px; font-size: 12px; background: #ffffff; border: 2px solid #808080; outline: none;" onkeypress="if(event.key==='Enter') sendCustomInputRadio(${ev.id})">
                    <button style="padding: 5px 12px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold;" onclick="sendCustomInputRadio(${ev.id})">Nadaj</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    if (typeof makeDraggable === 'function') makeDraggable(modal, modal.querySelector('.radio-win-header'));
    openRadioWindows[evId] = modal;
    updateRadioChatDynamic(evId);
    return modal;
}

function updateRadioChatDynamic(evId) {
    const ev = events.find(e => e.id === evId);
    if (!ev) return;
    const chat = document.getElementById(`radio-chat-${evId}`);
    if (chat) {
        chat.innerHTML = (ev.radioLogs || []).join('');
        chat.scrollTop = chat.scrollHeight;
    }
}

function closeRadioWindow(evId) {
    if (openRadioWindows[evId]) {
        openRadioWindows[evId].remove();
        delete openRadioWindows[evId];
    }
}

function minimizeRadioWindow(evId) {
    if (openRadioWindows[evId]) {
        openRadioWindows[evId].style.display = 'none';
        const bar = document.getElementById('minimized-bar');
        if (bar) {
            const item = document.createElement('div');
            item.className = 'minimized-item';
            item.id = `min-radio-${evId}`;
            item.innerHTML = `📻 Radio (ID: ${evId})`;
            item.onclick = () => {
                if (openRadioWindows[evId]) openRadioWindows[evId].style.display = 'block';
                item.remove();
            };
            bar.appendChild(item);
        }
    }
}

function openRadioForEvent(evId) {
    selectedEvIdForRadio = evId;
    createRadioWindow(evId);
    const btnOpen = document.getElementById('btn-open-radio');
    if (btnOpen) btnOpen.style.display = 'block';
}

function openRadioForSelectedEvent() {
    if (selectedEvIdForRadio !== null) openRadioForEvent(selectedEvIdForRadio);
    else if (events.length > 0) openRadioForEvent(events[0].id);
    else alert('Brak aktywnych zdarzeń.');
}

function sendCustomInputRadio(evId) {
    const input = document.getElementById(`inp-radio-reply-${evId}`);
    if (!input || !input.value.trim()) return;
    const val = input.value.trim();
    input.value = '';
    sendRadioReplyDynamic(evId, val);
}

function getCommandRank(vehicle) {
    const uName = (vehicle.unitName || "").toUpperCase();
    const vId = (vehicle.id || "").toUpperCase();
    if (uName.includes("KP PSP") || uName.includes("KM PSP")) return 4.0;
    if (uName.includes("JRG")) {
        if (vId.includes("90")) return 3.3;
        if (vId.includes("21")) return 3.2;
        if (vId.includes("25")) return 3.1;
        return 3.0;
    }
    if (uName.includes("KSRG")) return 2.0;
    return 1.0;
}

async function triggerArrivalRadioReport(ev, vehicle) {
    if (!ev.radioLogs) ev.radioLogs = [];
    if (ev.type === 'PZR') return;

    createRadioWindow(ev.id);
    const newRank = getCommandRank(vehicle);
    const prevRank = ev.kdrRank || 0;
    let takeoverText = "";

    if (!ev.kdrVehicleId) {
        ev.kdrVehicleId = vehicle.id;
        ev.kdrUnitName = vehicle.unitName;
        ev.kdrRank = newRank;
    } else if (newRank > prevRank) {
        takeoverText = ` Dowodzenie na miejscu zdarzenia przejmuje przybyły zastęp ${vehicle.id} (${vehicle.unitName}).`;
        ev.kdrVehicleId = vehicle.id;
        ev.kdrUnitName = vehicle.unitName;
        ev.kdrRank = newRank;
    }

    const vehiclesListStr = ev.vehicles.map(v => `${v.id} (${v.unitName})`).join(', ');
    const sysPrompt = `Jesteś dowódcą zastępu straży pożarnej (${vehicle.id} z jednostki ${vehicle.unitName}). Dojechałeś na miejsce w miejscowości ${ev.city}, adres: ${ev.street || ''}.
Zdarzenie: "${ev.desc}". Zadysponowane siły: ${vehiclesListStr}.
KOMUNIKAT O PRZEJĘCIU DOWODZENIA: ${takeoverText || 'Brak zmiany KDR.'}
Rozpocznij od: "${currentCountyCallsign}, tu ${vehicle.id}." Zakończ: "Bez odbioru."`;

    let reportText = "";
    try {
        reportText = await callUniversalAI(sysPrompt, "Podaj meldunek z dojazdu i informację o dowodzeniu.", false);
        reportText = reportText.replace(/^["']|["']$/g, '');
    } catch (e) {}

    if (!reportText) {
        reportText = takeoverText
            ? `${currentCountyCallsign}, tu ${vehicle.id}. Dotarliśmy na miejsce (${ev.city}).${takeoverText} Prowadzimy działania. Bez odbioru.`
            : `${currentCountyCallsign}, tu ${vehicle.id}. Jesteśmy na miejscu (${ev.city}, ${ev.street || ''}) – potwierdzam dojazd, prowadzimy działania. Bez odbioru.`;
    }

    audioMotorola.currentTime = 0;
    audioMotorola.play().catch(() => {});
    const timeStr = new Date().toLocaleTimeString();
    ev.radioLogs.push(`<div style="margin-bottom: 6px; color: #ffcc00;">[${timeStr}] ${vehicle.id} ➔ ${currentCountyCallsign}:<br>"${reportText}"</div>`);
    updateRadioChatDynamic(ev.id);
    if (typeof saveSimulationState === 'function') saveSimulationState();

    if (takeoverText) {
        logToMainRadio(`${vehicle.id} ➔ SKKP`, `Przejęcie dowodzenia na zdarzeniu ID ${ev.id} (${ev.city}):${takeoverText}`, '#ffaa00', false);
    }
}

async function sendRadioReplyDynamic(evId, text) {
    if (!text) return;
    const ev = events.find(e => e.id === evId);
    if (!ev) return;

    audioMotorola.currentTime = 0;
    audioMotorola.play().catch(() => {});
    const kdrName = ev.kdrVehicleId || (ev.vehicles[0] ? ev.vehicles[0].id : 'KDR');
    const timeStr = new Date().toLocaleTimeString();
    if (!ev.radioLogs) ev.radioLogs = [];
    ev.radioLogs.push(`<div style="margin-bottom: 6px; color: #00ff00;">[${timeStr}] ${currentCountyCallsign} ➔ ${kdrName}:<br>"${text}"</div>`);

    const chatBox = document.getElementById(`radio-chat-${evId}`);
    if (chatBox) {
        chatBox.innerHTML = ev.radioLogs.join('') + `<div id="ai-typing-${evId}" style="color:#aaa; font-style:italic; padding:2px;">⏳ ${kdrName} nadaje...</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    const qLower = text.toLowerCase();
    const tactical = evaluateTacticalForces(ev);
    const asksForSis = /siły|środki|srodki|dodatkow|zastęp|potrzeb|wystarcz/.test(qLower);

    let aiReply = "";
    if (asksForSis && !tactical.sufficient) {
        aiReply = `${currentCountyCallsign}, tu ${kdrName}. ${tactical.reason} Bez odbioru.`;
    } else {
        const vehiclesListStr = ev.vehicles.map(v => `${v.id} (${v.unitName} - ${v.name})`).join(', ');
        const systemPrompt = `Jesteś dowódcą akcji straży pożarnej (${kdrName}) na miejscu w miejscowości ${ev.city}, adres: ${ev.street || ''}.
Opis zdarzenia: "${ev.desc}". Zadysponowane wozy: ${vehiclesListStr}.
OCENA TAKTYCZNA SIŁ I ŚRODKÓW: ${tactical.reason}
Dyspozytor (${currentCountyCallsign}) mówi do Ciebie przez radio: "${text}".
Format: "${currentCountyCallsign}, tu ${kdrName}. [Krótka, konkretna odpowiedź]. Bez odbioru."`;
        try {
            aiReply = await callUniversalAI(systemPrompt, text, false);
            aiReply = aiReply.replace(/^["']|["']$/g, '');
        } catch (err) {}
        if (!aiReply) aiReply = generateSmartKdrResponse(kdrName, text, ev);
    }

    audioMotorola.currentTime = 0;
    audioMotorola.play().catch(() => {});
    ev.radioLogs.push(`<div style="margin-bottom: 6px; color: #ffcc00;">[${new Date().toLocaleTimeString()}] ${kdrName} ➔ ${currentCountyCallsign}:<br>"${aiReply}"</div>`);
    updateRadioChatDynamic(evId);
    if (typeof saveSimulationState === 'function') saveSimulationState();
}

function buildDepartureRadioMessage(vehicle, ev) {
    if (ev.type === 'PZR') return `${vehicle.id} zgłaszam wyjazd na zabezpieczenie rejonu (${ev.city}), odbiór.`;
    if (Math.random() < 0.10) {
        const fullAddr = ev.street ? `${ev.city}, ${ev.street}` : ev.city;
        return `${vehicle.id} zgłaszam wyjazd do zdarzenia na adres: ${fullAddr}, odbiór.`;
    }
    const simpleVariants = [
        `${vehicle.id} zgłaszam wyjazd do zdarzenia, odbiór.`,
        `${vehicle.id} wyjazd, odbiór.`,
        `${currentCountyCallsign}, tu ${vehicle.id}, wyjeżdżamy do zdarzenia, odbiór.`,
        `${vehicle.id} w drodze do zdarzenia, odbiór.`
    ];
    return simpleVariants[Math.floor(Math.random() * simpleVariants.length)];
}
