# Call Session Management - Implementatieplan

## Overzicht
Dit document beschrijft de implementatie van verbeterde call session management, inclusief anonieme beller identificatie, service nummer tracking en debug functionaliteit.

---

## 1. Sessie State Management

### 1.1 Nieuwe State Variabelen (app.js)
```javascript
let callSession = {
    active: false,              // Is er momenteel een actieve call?
    callerType: 'anonymous',    // 'anonymous' of 'identified'
    customerId: null,           // ID van geïdentificeerde klant
    customerName: null,         // Naam van geïdentificeerde klant
    serviceNumber: null,        // Welk service nummer werd gebeld
    waitTime: 0,                // Wachttijd in seconden
    startTime: null,            // Timestamp wanneer call startte
    pendingIdentification: null // Tijdelijke opslag voor klant die nog niet gekoppeld is
};
```

### 1.2 Status Overgangen
- **Geen call** → **Anonieme call**: Via debug modal "Start simulatie"
- **Anonieme call** → **Geïdentificeerde call**: Via "Dit is de persoon die belt" knop
- **Geïdentificeerde call** → **Geen call**: Via "Sessie afsluiten" of debug "Beëindig gesprek"

---

## 2. UI Aanpassingen Bovenbalk

### 2.1 Uitgebreide Sessie Informatie Display
Huidige weergave:
```
📞 Gesprek met: [Anonieme Beller] | ⏱️ Gesprekstijd: 00:03:45
```

Nieuwe weergave met service nummer en wachttijd:
```
📞 [AVROBODE SERVICE] | ⏳ Wacht: 0:45 | Gesprek met: [Anonieme Beller] | ⏱️ 00:03:45
```

Of bij geïdentificeerde beller:
```
📞 [MIKROGIDS SERVICE] | ⏳ Wacht: 1:23 | Gesprek met: Jan de Vries | ⏱️ 00:05:12
```

### 2.2 HTML Structuur Aanpassing (index.html)
```html
<div id="sessionInfo" class="session-info" style="display: none;">
    <div class="session-service">
        <span class="service-icon">📞</span>
        <span id="sessionServiceNumber" class="service-number">AVROBODE SERVICE</span>
    </div>
    <div class="session-wait">
        <span class="wait-icon">⏳</span>
        <span>Wacht: </span>
        <span id="sessionWaitTime">0:00</span>
    </div>
    <div class="session-caller">
        <span>Gesprek met: </span>
        <span id="sessionCallerName">Anonieme Beller</span>
    </div>
    <div class="session-duration">
        <span class="duration-icon">⏱️</span>
        <span id="sessionDuration">00:00:00</span>
    </div>
    <button id="endSessionBtn" class="btn-end-session" 
            onclick="endCallSession()" 
            style="display: none;">
        📞 Sessie Afsluiten
    </button>
</div>
```

### 2.3 CSS Styling (styles.css)
```css
.session-info {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    font-size: 0.9rem;
}

.session-service {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: bold;
    color: #fff;
    background: rgba(255, 255, 255, 0.2);
    padding: 0.3rem 0.8rem;
    border-radius: 4px;
}

.session-wait {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    color: #ffd700;
}

.session-caller {
    display: flex;
    align-items: center;
    gap: 0.3rem;
}

.session-duration {
    display: flex;
    align-items: center;
    gap: 0.3rem;
}

.btn-end-session {
    margin-left: auto;
    padding: 0.4rem 1rem;
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 0.2s;
}

.btn-end-session:hover {
    background: #c82333;
}
```

---

## 3. "Dit is de Persoon die Belt" Functionaliteit

### 3.1 Knop Plaatsing
De knop moet verschijnen op drie locaties:

#### 3.1.1 In Zoekresultaten
```html
<!-- Per zoekresultaat -->
<div class="search-result-item">
    <div class="result-info">
        <!-- Bestaande klant info -->
    </div>
    <div class="result-actions">
        <button onclick="selectCustomer(id)">Bekijken</button>
        <!-- NIEUW: Alleen zichtbaar bij actieve anonieme call -->
        <button class="btn-identify-caller" 
                onclick="identifyCallerAsCustomer(id)"
                style="display: none;">
            👤 Dit is de beller
        </button>
    </div>
</div>
```

#### 3.1.2 In Klant Detail Weergave
```html
<!-- Bovenkant customer-detail card -->
<div class="customer-header">
    <div class="customer-info">
        <!-- Bestaande info -->
    </div>
    <div class="customer-actions">
        <!-- NIEUW: Alleen zichtbaar bij actieve anonieme call -->
        <button id="identifyCallerBtn" 
                class="btn btn-small btn-primary" 
                onclick="identifyCurrentCustomerAsCaller()"
                style="display: none;">
            👤 Dit is de persoon die belt
        </button>
        <!-- Bestaande knoppen -->
    </div>
</div>
```

#### 3.1.3 Na Aanmaken Nieuw Abonnement/Artikel
Bij succesvolle aanmaak popup tonen:
```javascript
function showSuccessIdentificationPrompt(customerId, customerName) {
    if (callSession.active && callSession.callerType === 'anonymous') {
        showModal({
            title: '✅ Succesvol Aangemaakt',
            message: `${customerName} is succesvol aangemaakt. Is dit de persoon die belt?`,
            actions: [
                {
                    label: 'Ja, dit is de beller',
                    primary: true,
                    callback: () => identifyCallerAsCustomer(customerId)
                },
                {
                    label: 'Nee',
                    callback: () => closeModal()
                }
            ]
        });
    }
}
```

### 3.2 Identificatie Functie (app.js)
```javascript
function identifyCallerAsCustomer(customerId) {
    if (!callSession.active || callSession.callerType !== 'anonymous') {
        return;
    }
    
    const customer = customers.find(c => c.id === customerId);
    if (!customer) {
        showNotification('Klant niet gevonden', 'error');
        return;
    }
    
    // Update sessie state
    callSession.callerType = 'identified';
    callSession.customerId = customerId;
    callSession.customerName = `${customer.initials} ${customer.middleName ? customer.middleName + ' ' : ''}${customer.lastName}`;
    
    // Update UI
    document.getElementById('sessionCallerName').textContent = callSession.customerName;
    document.getElementById('endSessionBtn').style.display = 'block';
    
    // Verberg alle "Dit is de beller" knoppen
    document.querySelectorAll('.btn-identify-caller, #identifyCallerBtn').forEach(btn => {
        btn.style.display = 'none';
    });
    
    // Voeg contact moment toe
    addContactMoment(customerId, 'call_identified', 
        `Beller geïdentificeerd tijdens ${callSession.serviceNumber} call`);
    
    showNotification(`Beller geïdentificeerd als ${callSession.customerName}`, 'success');
}
```

---

## 4. Debug Modal Uitbreidingen

### 4.1 Uitgebreide Debug UI (index.html)
```html
<div id="debugModal" class="modal">
    <div class="modal-content debug-modal">
        <h2>🐛 Debug Controls</h2>
        
        <!-- NIEUWE SECTIE: Call Simulation -->
        <div class="debug-section">
            <h3>📞 Call Simulation</h3>
            
            <div class="debug-row">
                <label>Service Nummer:</label>
                <select id="debugServiceNumber">
                    <option value="AVROBODE">Avrobode Service</option>
                    <option value="MIKROGIDS">Mikrogids Service</option>
                    <option value="NCRVGIDS">NcrvGids Service</option>
                    <option value="ALGEMEEN">Algemeen Service</option>
                </select>
            </div>
            
            <div class="debug-row">
                <label>Wachttijd simulatie:</label>
                <select id="debugWaitTime">
                    <option value="random">Willekeurig (15-90 sec)</option>
                    <option value="15">15 seconden</option>
                    <option value="30">30 seconden</option>
                    <option value="60">1 minuut</option>
                    <option value="120">2 minuten</option>
                    <option value="300">5 minuten</option>
                </select>
            </div>
            
            <div class="debug-row">
                <label>Beller type:</label>
                <select id="debugCallerType">
                    <option value="anonymous">Anonieme Beller</option>
                    <option value="known">Bekende Klant</option>
                </select>
            </div>
            
            <div id="debugKnownCallerSelect" class="debug-row" style="display: none;">
                <label>Selecteer klant:</label>
                <select id="debugKnownCustomer">
                    <!-- Populated by JavaScript -->
                </select>
            </div>
            
            <div class="debug-actions">
                <button class="btn btn-success" onclick="debugStartCall()">
                    📞 Start Gesprek Simulatie
                </button>
                <button id="debugEndCallBtn" 
                        class="btn btn-danger" 
                        onclick="debugEndCall()"
                        style="display: none;">
                    ❌ Beëindig Telefoongesprek
                </button>
            </div>
        </div>
        
        <!-- Bestaande debug secties -->
        <div class="debug-section">
            <h3>💾 Data Management</h3>
            <!-- Bestaande content -->
        </div>
        
        <button class="btn btn-secondary" onclick="closeDebugModal()">Sluiten</button>
    </div>
</div>
```

### 4.2 Debug Functionaliteit (app.js)

#### 4.2.1 Start Call Simulation
```javascript
function debugStartCall() {
    const serviceNumber = document.getElementById('debugServiceNumber').value;
    const callerType = document.getElementById('debugCallerType').value;
    const waitTimeOption = document.getElementById('debugWaitTime').value;
    
    // Bereken wachttijd
    let waitTime;
    if (waitTimeOption === 'random') {
        waitTime = Math.floor(Math.random() * (90 - 15 + 1)) + 15;
    } else {
        waitTime = parseInt(waitTimeOption);
    }
    
    // Initialize call session
    callSession = {
        active: true,
        callerType: callerType,
        serviceNumber: serviceNumber,
        waitTime: waitTime,
        startTime: Date.now(),
        customerId: null,
        customerName: null
    };
    
    // Voor bekende beller, koppel direct
    if (callerType === 'known') {
        const customerId = document.getElementById('debugKnownCustomer').value;
        if (customerId) {
            const customer = customers.find(c => c.id === parseInt(customerId));
            if (customer) {
                callSession.customerId = parseInt(customerId);
                callSession.customerName = `${customer.initials} ${customer.middleName ? customer.middleName + ' ' : ''}${customer.lastName}`;
            }
        }
    }
    
    // Start UI updates
    startCallSession();
    closeDebugModal();
    
    showNotification(
        `Call simulatie gestart: ${serviceNumber} (wachttijd: ${formatTime(waitTime)})`,
        'success'
    );
}

function startCallSession() {
    // Toon sessie info in bovenbalk
    document.getElementById('sessionInfo').style.display = 'flex';
    
    // Update service nummer
    const serviceLabels = {
        'AVROBODE': 'AVROBODE SERVICE',
        'MIKROGIDS': 'MIKROGIDS SERVICE',
        'NCRVGIDS': 'NCRVGIDS SERVICE',
        'ALGEMEEN': 'ALGEMEEN SERVICE'
    };
    document.getElementById('sessionServiceNumber').textContent = 
        serviceLabels[callSession.serviceNumber] || callSession.serviceNumber;
    
    // Update wachttijd
    document.getElementById('sessionWaitTime').textContent = 
        formatTime(callSession.waitTime);
    
    // Update beller naam
    document.getElementById('sessionCallerName').textContent = 
        callSession.customerName || 'Anonieme Beller';
    
    // Toon/verberg sessie afsluiten knop
    document.getElementById('endSessionBtn').style.display = 
        callSession.callerType === 'identified' ? 'block' : 'none';
    
    // Toon debug end call button
    document.getElementById('debugEndCallBtn').style.display = 'block';
    
    // Start gespreksduur timer
    updateCallDuration();
    callSession.durationInterval = setInterval(updateCallDuration, 1000);
    
    // Update "Dit is de beller" knoppen zichtbaarheid
    updateIdentifyCallerButtons();
}

function updateCallDuration() {
    if (!callSession.active) return;
    
    const elapsed = Math.floor((Date.now() - callSession.startTime) / 1000);
    document.getElementById('sessionDuration').textContent = formatTime(elapsed);
}

function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
```

#### 4.2.2 End Call Simulation
```javascript
function debugEndCall() {
    if (!callSession.active) return;
    
    const callDuration = Math.floor((Date.now() - callSession.startTime) / 1000);
    
    showModal({
        title: '📞 Gesprek Beëindigd',
        message: `Het telefoongesprek is beëindigd door de klant.\n\nGespreksduur: ${formatTime(callDuration)}`,
        actions: [
            {
                label: 'OK',
                primary: true,
                callback: () => {
                    endCallSession(true);
                    closeModal();
                }
            }
        ]
    });
}

function endCallSession(forcedByCustomer = false) {
    if (!callSession.active) return;
    
    const callDuration = Math.floor((Date.now() - callSession.startTime) / 1000);
    
    // Voeg contact moment toe als beller geïdentificeerd was
    if (callSession.customerId) {
        const endReason = forcedByCustomer ? 'call_ended_by_customer' : 'call_ended_by_agent';
        addContactMoment(
            callSession.customerId,
            endReason,
            `${callSession.serviceNumber} call beëindigd (duur: ${formatTime(callDuration)}, wacht: ${formatTime(callSession.waitTime)})`
        );
    }
    
    // Stop timer
    if (callSession.durationInterval) {
        clearInterval(callSession.durationInterval);
    }
    
    // Reset session state
    callSession = {
        active: false,
        callerType: 'anonymous',
        customerId: null,
        customerName: null,
        serviceNumber: null,
        waitTime: 0,
        startTime: null
    };
    
    // Verberg UI elementen
    document.getElementById('sessionInfo').style.display = 'none';
    document.getElementById('debugEndCallBtn').style.display = 'none';
    updateIdentifyCallerButtons();
    
    if (!forcedByCustomer) {
        showNotification('Call sessie afgesloten', 'success');
    }
}
```

#### 4.2.3 Update "Dit is de Beller" Knoppen
```javascript
function updateIdentifyCallerButtons() {
    const shouldShow = callSession.active && callSession.callerType === 'anonymous';
    
    // Update in search results
    document.querySelectorAll('.btn-identify-caller').forEach(btn => {
        btn.style.display = shouldShow ? 'inline-block' : 'none';
    });
    
    // Update in customer detail
    const identifyBtn = document.getElementById('identifyCallerBtn');
    if (identifyBtn) {
        identifyBtn.style.display = shouldShow ? 'inline-block' : 'none';
    }
}
```

---

## 5. Service Nummer Configuratie

### 5.1 Service Nummer Definities
```javascript
const serviceNumbers = {
    'AVROBODE': {
        label: 'AVROBODE SERVICE',
        phone: '088-0123456',
        color: '#2563eb',
        icon: '📘'
    },
    'MIKROGIDS': {
        label: 'MIKROGIDS SERVICE',
        phone: '088-0123457',
        color: '#dc2626',
        icon: '📕'
    },
    'NCRVGIDS': {
        label: 'NCRVGIDS SERVICE',
        phone: '088-0123458',
        color: '#16a34a',
        icon: '📗'
    },
    'ALGEMEEN': {
        label: 'ALGEMEEN SERVICE',
        phone: '088-0123459',
        color: '#9333ea',
        icon: '📞'
    }
};
```

---

## 6. Implementatie Volgorde

### Fase 1: Basis Infrastructuur
1. ✅ Voeg `callSession` state object toe aan app.js
2. ✅ Implementeer `startCallSession()` en `endCallSession()` functies
3. ✅ Voeg service nummer configuratie toe

### Fase 2: UI Updates
4. ✅ Pas bovenbalk HTML aan voor uitgebreide sessie info
5. ✅ Voeg CSS styling toe voor nieuwe elementen
6. ✅ Implementeer sessie info display logica

### Fase 3: Debug Modal
7. ✅ Breid debug modal uit met call simulation controls
8. ✅ Implementeer `debugStartCall()` functie
9. ✅ Implementeer `debugEndCall()` functie
10. ✅ Voeg service nummer selectie toe

### Fase 4: Identificatie Functionaliteit
11. ✅ Voeg "Dit is de beller" knoppen toe aan zoekresultaten
12. ✅ Voeg "Dit is de beller" knop toe aan customer detail
13. ✅ Implementeer `identifyCallerAsCustomer()` functie
14. ✅ Voeg identificatie prompt toe na aanmaken abonnement/artikel
15. ✅ Implementeer `updateIdentifyCallerButtons()` voor visibility management

### Fase 5: Testing & Refinement
16. ✅ Test volledige flow: anoniem → geïdentificeerd → sessie afsluiten
17. ✅ Test debug "beëindig gesprek" functionaliteit
18. ✅ Test verschillende service nummers
19. ✅ Valideer contact history logging
20. ✅ UI polish en responsive design check

---

## 7. Edge Cases & Validaties

### 7.1 Edge Cases
- **Dubbele identificatie**: Voorkom dat anonieme beller twee keer geïdentificeerd wordt
- **Sessie zonder identificatie**: Sta toe dat sessie wordt afgesloten zonder identificatie
- **Nieuwe call tijdens actieve call**: Toon waarschuwing en vraag bevestiging
- **Browser refresh tijdens call**: Bewaar sessie in sessionStorage (optioneel)

### 7.2 Validaties
```javascript
// Voorkom starten nieuwe call tijdens actieve call
function debugStartCall() {
    if (callSession.active) {
        showModal({
            title: '⚠️ Actieve Call Detecteerd',
            message: 'Er is al een actieve call. Wil je deze beëindigen en een nieuwe starten?',
            actions: [
                {
                    label: 'Ja, start nieuwe call',
                    primary: true,
                    callback: () => {
                        endCallSession();
                        // Start nieuwe call
                        proceedWithDebugStartCall();
                    }
                },
                {
                    label: 'Annuleren',
                    callback: () => closeModal()
                }
            ]
        });
        return;
    }
    
    proceedWithDebugStartCall();
}
```

---

## 8. Contact History Logging

### 8.1 Nieuwe Contact Types
```javascript
const contactTypes = {
    // Bestaande...
    'call_started_anonymous': {
        label: 'Anonieme call gestart',
        icon: '📞',
        color: '#fbbf24'
    },
    'call_started_identified': {
        label: 'Call gestart',
        icon: '📞',
        color: '#3b82f6'
    },
    'call_identified': {
        label: 'Beller geïdentificeerd',
        icon: '👤',
        color: '#10b981'
    },
    'call_ended_by_agent': {
        label: 'Call beëindigd (agent)',
        icon: '📞',
        color: '#6b7280'
    },
    'call_ended_by_customer': {
        label: 'Call beëindigd (klant)',
        icon: '📞',
        color: '#ef4444'
    }
};
```

---

## 9. Testing Checklist

- [ ] Start anonieme call via debug
- [ ] Verifieer service nummer en wachttijd in bovenbalk
- [ ] Zoek klant en zie "Dit is de beller" knop
- [ ] Klik "Dit is de beller" en verifieer naam update
- [ ] Verifieer "Sessie afsluiten" knop verschijnt
- [ ] Test handmatig sessie afsluiten
- [ ] Test debug "Beëindig gesprek" knop
- [ ] Start nieuwe call met ander service nummer
- [ ] Verifieer gespreksduur timer werkt
- [ ] Test identificatie na nieuw abonnement aanmaken
- [ ] Test identificatie na artikel verkoop aanmaken
- [ ] Verifieer contact history logging correct is
- [ ] Test alle drie service nummers
- [ ] Test verschillende wachttijden
- [ ] Test bekende beller simulatie via debug

---

## 10. Agent Status Management

### 10.1 Agent Status State
```javascript
let agentStatus = {
    current: 'offline',  // offline, ready, busy, acw, break
    canReceiveCalls: false,
    acwStartTime: null,
    breakStartTime: null
};

const agentStatuses = {
    'offline': { label: 'Offline', color: '#6b7280', icon: '⚫' },
    'ready': { label: 'Beschikbaar', color: '#10b981', icon: '🟢' },
    'busy': { label: 'In Gesprek', color: '#ef4444', icon: '🔴' },
    'acw': { label: 'Nabewerkingstijd', color: '#f59e0b', icon: '🟡' },
    'break': { label: 'Pauze', color: '#3b82f6', icon: '🔵' }
};
```

### 10.2 Status Widget in Header
```html
<div class="agent-status-widget">
    <div class="status-indicator" id="agentStatusIndicator">
        <span class="status-icon">⚫</span>
        <span class="status-label">Offline</span>
    </div>
    <button class="status-dropdown-btn" onclick="toggleStatusMenu()">▼</button>
    <div class="status-menu" id="agentStatusMenu" style="display: none;">
        <div class="status-menu-item" onclick="setAgentStatus('ready')">
            🟢 Beschikbaar
        </div>
        <div class="status-menu-item" onclick="setAgentStatus('break')">
            🔵 Pauze
        </div>
        <div class="status-menu-item" onclick="setAgentStatus('offline')">
            ⚫ Offline
        </div>
    </div>
</div>
```

### 10.3 Status Management Functions
```javascript
function setAgentStatus(newStatus) {
    // Validatie
    if (callSession.active && newStatus === 'ready') {
        showNotification('Kan niet naar Beschikbaar tijdens actief gesprek', 'error');
        return;
    }
    
    const oldStatus = agentStatus.current;
    agentStatus.current = newStatus;
    
    // Update UI
    const statusConfig = agentStatuses[newStatus];
    document.querySelector('.status-icon').textContent = statusConfig.icon;
    document.querySelector('.status-label').textContent = statusConfig.label;
    document.getElementById('agentStatusIndicator').style.backgroundColor = 
        statusConfig.color + '20'; // 20% opacity
    
    // Update availability
    agentStatus.canReceiveCalls = (newStatus === 'ready');
    
    // Log status change
    console.log(`Agent status: ${oldStatus} → ${newStatus}`);
    
    // Close menu
    document.getElementById('agentStatusMenu').style.display = 'none';
    
    showNotification(`Status gewijzigd naar: ${statusConfig.label}`, 'success');
}

function autoSetAgentStatus(callState) {
    // Automatische status updates tijdens call flow
    if (callState === 'call_started') {
        agentStatus.current = 'busy';
        agentStatus.canReceiveCalls = false;
    } else if (callState === 'call_ended') {
        startACW();
    }
}
```

---

## 11. Call Disposition & After Call Work (ACW)

### 11.1 Disposition Codes Configuration
```javascript
const dispositionCategories = {
    'subscription': {
        label: 'Abonnement',
        outcomes: [
            { code: 'new_subscription', label: 'Nieuw abonnement afgesloten' },
            { code: 'subscription_changed', label: 'Abonnement gewijzigd' },
            { code: 'subscription_cancelled', label: 'Abonnement opgezegd' },
            { code: 'subscription_paused', label: 'Abonnement gepauzeerd' },
            { code: 'info_provided', label: 'Informatie verstrekt' }
        ]
    },
    'delivery': {
        label: 'Bezorging',
        outcomes: [
            { code: 'delivery_issue_resolved', label: 'Bezorgprobleem opgelost' },
            { code: 'magazine_resent', label: 'Editie opnieuw verzonden' },
            { code: 'delivery_prefs_updated', label: 'Bezorgvoorkeuren aangepast' },
            { code: 'escalated_delivery', label: 'Geëscaleerd naar bezorging' }
        ]
    },
    'payment': {
        label: 'Betaling',
        outcomes: [
            { code: 'payment_resolved', label: 'Betaling afgehandeld' },
            { code: 'payment_plan_arranged', label: 'Betalingsregeling getroffen' },
            { code: 'iban_updated', label: 'IBAN gegevens bijgewerkt' },
            { code: 'escalated_finance', label: 'Geëscaleerd naar financiën' }
        ]
    },
    'article_sale': {
        label: 'Artikel Verkoop',
        outcomes: [
            { code: 'article_sold', label: 'Artikel verkocht' },
            { code: 'quote_provided', label: 'Offerte verstrekt' },
            { code: 'no_sale', label: 'Geen verkoop' }
        ]
    },
    'complaint': {
        label: 'Klacht',
        outcomes: [
            { code: 'complaint_resolved', label: 'Klacht opgelost' },
            { code: 'complaint_escalated', label: 'Klacht geëscaleerd' },
            { code: 'callback_scheduled', label: 'Terugbelafspraak gemaakt' }
        ]
    },
    'general': {
        label: 'Algemeen',
        outcomes: [
            { code: 'info_provided', label: 'Informatie verstrekt' },
            { code: 'transferred', label: 'Doorverbonden' },
            { code: 'customer_hung_up', label: 'Klant opgehangen' },
            { code: 'wrong_number', label: 'Verkeerd verbonden' },
            { code: 'no_answer_needed', label: 'Geen actie vereist' }
        ]
    }
};
```

### 11.2 Disposition Modal (HTML)
```html
<div id="dispositionModal" class="modal">
    <div class="modal-content disposition-modal">
        <div class="modal-header">
            <h2>📋 Gesprek Afronden</h2>
            <p class="modal-subtitle">Vul de gespreksinformatie in voordat je verder gaat</p>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label for="dispCategory">Categorie *</label>
                <select id="dispCategory" required onchange="updateDispositionOutcomes()">
                    <option value="">Selecteer categorie...</option>
                    <option value="subscription">Abonnement</option>
                    <option value="delivery">Bezorging</option>
                    <option value="payment">Betaling</option>
                    <option value="article_sale">Artikel Verkoop</option>
                    <option value="complaint">Klacht</option>
                    <option value="general">Algemeen</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="dispOutcome">Uitkomst *</label>
                <select id="dispOutcome" required disabled>
                    <option value="">Selecteer eerst een categorie</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="dispNotes">Notities</label>
                <textarea id="dispNotes" 
                          rows="4" 
                          placeholder="Vat het gesprek samen en noteer belangrijke details..."></textarea>
                <small class="form-text">Beschrijf kort wat er besproken is en welke acties zijn ondernomen</small>
            </div>
            
            <div class="form-group">
                <label>
                    <input type="checkbox" id="dispFollowUpRequired">
                    <span>Follow-up vereist</span>
                </label>
            </div>
            
            <div id="followUpSection" class="form-group" style="display: none;">
                <label for="dispFollowUpDate">Follow-up datum</label>
                <input type="date" id="dispFollowUpDate">
                <textarea id="dispFollowUpNotes" 
                          rows="2" 
                          placeholder="Wat moet er bij follow-up gebeuren?"></textarea>
            </div>
            
            <div class="disposition-info">
                <div class="info-row">
                    <span>Gespreksduur:</span>
                    <span id="dispCallDuration">-</span>
                </div>
                <div class="info-row">
                    <span>Klant:</span>
                    <span id="dispCustomerName">-</span>
                </div>
                <div class="info-row">
                    <span>Service nummer:</span>
                    <span id="dispServiceNumber">-</span>
                </div>
            </div>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="cancelDisposition()">Annuleren</button>
            <button class="btn btn-primary" onclick="saveDisposition()">Opslaan & Afronden</button>
        </div>
    </div>
</div>
```

### 11.3 ACW (After Call Work) Functionality
```javascript
const ACW_DEFAULT_DURATION = 120; // 120 seconds

function startACW() {
    agentStatus.current = 'acw';
    agentStatus.acwStartTime = Date.now();
    agentStatus.canReceiveCalls = false;
    
    // Update UI
    updateAgentStatusDisplay();
    
    // Show disposition modal
    showDispositionModal();
    
    // Start ACW timer
    startACWTimer();
}

function startACWTimer() {
    const acwEndTime = agentStatus.acwStartTime + (ACW_DEFAULT_DURATION * 1000);
    
    agentStatus.acwInterval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((acwEndTime - Date.now()) / 1000));
        
        // Update timer display in header
        document.getElementById('acwTimer').textContent = 
            `ACW: ${formatTime(remaining)}`;
        
        if (remaining === 0) {
            endACW();
        }
    }, 1000);
}

function endACW(manual = false) {
    clearInterval(agentStatus.acwInterval);
    agentStatus.acwInterval = null;
    
    // Automatically set to Ready after ACW
    setAgentStatus('ready');
    
    if (manual) {
        showNotification('Klaar voor volgende gesprek', 'success');
    } else {
        showNotification('ACW tijd verlopen - Status: Beschikbaar', 'info');
    }
}

function showDispositionModal() {
    const modal = document.getElementById('dispositionModal');
    
    // Pre-fill information
    if (callSession.customerId) {
        const customer = customers.find(c => c.id === callSession.customerId);
        document.getElementById('dispCustomerName').textContent = 
            callSession.customerName || 'Anonieme Beller';
    }
    
    const duration = Math.floor((Date.now() - callSession.startTime) / 1000);
    document.getElementById('dispCallDuration').textContent = formatTime(duration);
    document.getElementById('dispServiceNumber').textContent = 
        callSession.serviceNumber || '-';
    
    modal.style.display = 'flex';
}

function updateDispositionOutcomes() {
    const category = document.getElementById('dispCategory').value;
    const outcomeSelect = document.getElementById('dispOutcome');
    
    if (!category) {
        outcomeSelect.disabled = true;
        outcomeSelect.innerHTML = '<option value="">Selecteer eerst een categorie</option>';
        return;
    }
    
    const outcomes = dispositionCategories[category].outcomes;
    outcomeSelect.disabled = false;
    outcomeSelect.innerHTML = '<option value="">Selecteer uitkomst...</option>';
    
    outcomes.forEach(outcome => {
        const option = document.createElement('option');
        option.value = outcome.code;
        option.textContent = outcome.label;
        outcomeSelect.appendChild(option);
    });
}

function saveDisposition() {
    const category = document.getElementById('dispCategory').value;
    const outcome = document.getElementById('dispOutcome').value;
    const notes = document.getElementById('dispNotes').value;
    const followUpRequired = document.getElementById('dispFollowUpRequired').checked;
    
    if (!category || !outcome) {
        showNotification('Selecteer categorie en uitkomst', 'error');
        return;
    }
    
    const disposition = {
        category,
        outcome,
        notes,
        followUpRequired,
        callDuration: Math.floor((Date.now() - callSession.startTime) / 1000),
        timestamp: new Date().toISOString()
    };
    
    // Save to customer history if identified
    if (callSession.customerId) {
        addContactMoment(
            callSession.customerId,
            'call_disposition',
            `${dispositionCategories[category].label}: ${getOutcomeLabel(category, outcome)}${notes ? ' - ' + notes : ''}`
        );
        
        // Save follow-up if needed
        if (followUpRequired) {
            const followUpDate = document.getElementById('dispFollowUpDate').value;
            const followUpNotes = document.getElementById('dispFollowUpNotes').value;
            // Save follow-up task
        }
    }
    
    // Close modal
    document.getElementById('dispositionModal').style.display = 'none';
    
    showNotification('Gesprek succesvol afgerond', 'success');
}
```

---

## 12. Call Recording Compliance

### 12.1 Recording Indicator in Call UI
```html
<!-- Add to session info display -->
<div class="recording-indicator" id="recordingIndicator" style="display: none;">
    <span class="rec-icon">🔴</span>
    <span class="rec-text">REC</span>
    <span class="rec-notice">Dit gesprek wordt opgenomen</span>
</div>
```

### 12.2 CSS Styling
```css
.recording-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.8rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 4px;
    font-size: 0.85rem;
}

.rec-icon {
    animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
}

.rec-text {
    font-weight: bold;
    color: #dc2626;
}

.rec-notice {
    color: #6b7280;
    font-size: 0.8rem;
}
```

### 12.3 Recording State Management
```javascript
const recordingConfig = {
    enabled: true,  // Global setting
    requireConsent: true,  // GDPR compliance
    autoStart: true  // Start recording automatically
};

function handleCallRecording() {
    if (!recordingConfig.enabled) return;
    
    // Show indicator
    document.getElementById('recordingIndicator').style.display = 'flex';
    
    // Log recording start
    if (callSession.customerId) {
        addContactMoment(
            callSession.customerId,
            'recording_started',
            'Gespreksopname gestart (conform AVG/GDPR)'
        );
    }
    
    callSession.recordingActive = true;
}

function showRecordingConsent() {
    // For compliance, show consent notification
    showModal({
        title: '🔴 Gespreksopname',
        message: 'Dit gesprek wordt opgenomen voor kwaliteits- en trainingsdoeleinden, conform onze privacy policy.',
        actions: [
            {
                label: 'Begrepen',
                primary: true,
                callback: () => closeModal()
            }
        ]
    });
}
```

---

## 13. Hold/Resume Functionality

### 13.1 Hold Button in Active Call
```html
<!-- Add next to "Sessie Afsluiten" button -->
<button id="holdCallBtn" 
        class="btn-hold-call" 
        onclick="toggleCallHold()"
        style="display: none;">
    ⏸️ In Wacht Zetten
</button>
```

### 13.2 Hold State Management
```javascript
let callOnHold = false;

function toggleCallHold() {
    if (!callSession.active) return;
    
    callOnHold = !callOnHold;
    
    const holdBtn = document.getElementById('holdCallBtn');
    const sessionInfo = document.getElementById('sessionInfo');
    
    if (callOnHold) {
        // Put call on hold
        holdBtn.innerHTML = '▶️ Hervatten';
        holdBtn.classList.add('on-hold');
        
        // Show hold indicator
        sessionInfo.classList.add('call-on-hold');
        
        // Add hold music indicator
        const holdIndicator = document.createElement('div');
        holdIndicator.id = 'holdIndicator';
        holdIndicator.className = 'hold-indicator';
        holdIndicator.innerHTML = '🎵 Klant in wacht';
        sessionInfo.appendChild(holdIndicator);
        
        // Track hold time
        callSession.holdStartTime = Date.now();
        
        showNotification('Gesprek in wacht gezet', 'info');
        
        // Log hold
        if (callSession.customerId) {
            addContactMoment(
                callSession.customerId,
                'call_hold',
                'Gesprek in wacht gezet'
            );
        }
    } else {
        // Resume call
        holdBtn.innerHTML = '⏸️ In Wacht Zetten';
        holdBtn.classList.remove('on-hold');
        
        sessionInfo.classList.remove('call-on-hold');
        
        // Remove hold indicator
        const holdIndicator = document.getElementById('holdIndicator');
        if (holdIndicator) holdIndicator.remove();
        
        // Calculate hold duration
        const holdDuration = Math.floor((Date.now() - callSession.holdStartTime) / 1000);
        callSession.totalHoldTime = (callSession.totalHoldTime || 0) + holdDuration;
        
        showNotification(`Gesprek hervat (wacht: ${formatTime(holdDuration)})`, 'success');
        
        // Log resume
        if (callSession.customerId) {
            addContactMoment(
                callSession.customerId,
                'call_resumed',
                `Gesprek hervat na ${formatTime(holdDuration)} wachttijd`
            );
        }
    }
}
```

### 13.3 CSS for Hold State
```css
.btn-hold-call {
    padding: 0.4rem 1rem;
    background: #f59e0b;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 0.2s;
}

.btn-hold-call:hover {
    background: #d97706;
}

.btn-hold-call.on-hold {
    background: #10b981;
}

.hold-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0.8rem;
    background: rgba(245, 158, 11, 0.2);
    border-radius: 4px;
    font-size: 0.85rem;
    animation: pulse 2s ease-in-out infinite;
}

.call-on-hold {
    opacity: 0.8;
}
```

---

## 14. Enhanced Contact History Logging

### 14.1 Extended Contact Types
```javascript
const contactTypes = {
    // Existing types...
    
    // Call disposition types
    'call_disposition': {
        label: 'Gesprek afgerond',
        icon: '📋',
        color: '#3b82f6'
    },
    'call_hold': {
        label: 'Gesprek in wacht',
        icon: '⏸️',
        color: '#f59e0b'
    },
    'call_resumed': {
        label: 'Gesprek hervat',
        icon: '▶️',
        color: '#10b981'
    },
    'recording_started': {
        label: 'Opname gestart',
        icon: '🔴',
        color: '#dc2626'
    },
    'agent_status_change': {
        label: 'Agent status gewijzigd',
        icon: '🔄',
        color: '#6b7280'
    },
    'acw_completed': {
        label: 'Nabewerking voltooid',
        icon: '✅',
        color: '#10b981'
    }
};
```

### 14.2 Disposition Details in History
```javascript
function addDispositionToHistory(customerId, disposition) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    
    const moment = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type: 'call_disposition',
        category: disposition.category,
        outcome: disposition.outcome,
        notes: disposition.notes,
        callDuration: disposition.callDuration,
        holdTime: callSession.totalHoldTime || 0,
        agent: document.getElementById('agentName').textContent
    };
    
    customer.contactHistory.unshift(moment);
    saveCustomers();
    
    if (currentCustomer?.id === customerId) {
        displayContactHistory(customerId);
    }
}
```

---

## 15. Updated Implementation Phases

### **Fase 1A: Basis Call Session (Original)**
1. ✅ Call session state object
2. ✅ Service nummer configuratie  
3. ✅ Start/end session functies

### **Fase 1B: Agent Status Management (NEW)**
4. ✅ Agent status state object
5. ✅ Status widget in header
6. ✅ Status change functies
7. ✅ Automatic status updates

### **Fase 2A: UI Updates (Original)**
8. ✅ Bovenbalk sessie info HTML
9. ✅ CSS styling nieuwe elementen
10. ✅ Sessie info display logica

### **Fase 2B: Call Recording Indicator (NEW)**
11. ✅ Recording indicator HTML/CSS
12. ✅ Recording state management
13. ✅ GDPR compliance notices

### **Fase 3: Debug Modal (Original)**
14. ✅ Debug call simulation controls
15. ✅ debugStartCall() functie
16. ✅ debugEndCall() functie
17. ✅ Service nummer selectie

### **Fase 4A: Identificatie (Original)**
18. ✅ "Dit is de beller" knoppen
19. ✅ identifyCallerAsCustomer() functie
20. ✅ Identificatie prompt na aanmaken
21. ✅ Button visibility management

### **Fase 4B: Hold/Resume (NEW)**
22. ✅ Hold button in call UI
23. ✅ toggleCallHold() functie
24. ✅ Hold time tracking
25. ✅ Hold indicator styling

### **Fase 5A: Disposition & ACW (NEW - KRITIEK)**
26. ✅ Disposition codes configuratie
27. ✅ Disposition modal HTML
28. ✅ ACW timer functionaliteit
29. ✅ saveDisposition() functie
30. ✅ Automatic ACW start na call end
31. ✅ Manual ACW override

### **Fase 5B: Enhanced Logging (NEW)**
32. ✅ Extended contact types
33. ✅ Disposition details in history
34. ✅ Hold/resume logging
35. ✅ Agent status logging

### **Fase 6: Testing & Polish**
36. ✅ End-to-end flow testing
37. ✅ UI/UX refinements
38. ✅ Edge case handling
39. ✅ Performance optimization

---

## 16. Updated Testing Checklist

### Agent Status
- [ ] Status widget toont correct status
- [ ] Status dropdown werkt correct
- [ ] Kan niet naar Ready tijdens actief gesprek
- [ ] Status update naar Busy bij call start
- [ ] Automatische ACW mode na call end

### Call Disposition
- [ ] Disposition modal opent na call end
- [ ] Category/outcome dropdowns werken
- [ ] Follow-up checkbox toont extra velden
- [ ] Kan niet opslaan zonder category/outcome
- [ ] Disposition wordt correct gelogd in history

### ACW (After Call Work)
- [ ] ACW timer start na call end
- [ ] Timer telt correct af
- [ ] Agent kan handmatig ACW beëindigen
- [ ] Auto-return to Ready na ACW timeout
- [ ] Kan geen nieuwe call aannemen tijdens ACW

### Call Recording
- [ ] Recording indicator toont bij actieve call
- [ ] REC icon pulseert correct
- [ ] Recording state wordt gelogd
- [ ] Compliance notice werkt

### Hold/Resume
- [ ] Hold button verschijnt tijdens actieve call
- [ ] Hold indicator toont correct
- [ ] Resume werkt en logt hold duration
- [ ] Total hold time wordt bijgehouden
- [ ] Hold state visueel duidelijk

### Integration Tests
- [ ] Volledige flow: Status Ready → Call Start → Hold → Resume → Call End → ACW → Disposition → Ready
- [ ] Debug simulatie werkt met alle nieuwe features
- [ ] Contact history toont alle events correct
- [ ] Multi-call scenario (call 1 → ACW → call 2)

---

## 17. Toekomstige Uitbreidingen (Optioneel - P3)

- **Call transfer**: Simuleer doorverbinden naar andere afdeling
- **Conference call**: Drie-weg gesprek
- **IVR geschiedenis**: Toon welke menu opties klant heeft gekozen
- **Screen pop**: Automatisch klant record openen bij binnenkomende call
- **Queue statistics**: Real-time wachtrij informatie
- **Multi-channel**: Email, chat integratie
- **Supervisor monitoring**: Live call monitoring voor teamleiders
- **Call analytics dashboard**: Rapportage en statistieken
