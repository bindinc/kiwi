# Call Center Queue Simulatie - Implementatie Plan

## Overzicht
Implementatie van een wachtrij simulatie voor het call center, waarbij klanten in de wacht staan en de volgende beller zichtbaar is wanneer de agent niet in een actief gesprek zit.

## Doelstellingen
1. Simuleren van een realistische call center wachtrij met meerdere wachtende klanten
2. Tonen van de eerstvolgende beller in de blauwe header (alleen wanneer geen actief gesprek)
3. Mogelijkheid om gesprek te starten met de eerstvolgende beller
4. Indicatie van wachtrijlengte (aantal wachtende klanten)
5. Debug functionaliteit om wachtrij te genereren met mock data

## Architectuur

### Data Structuur

#### Queue State Management
```javascript
let callQueue = {
    enabled: false,           // Is queue mode geactiveerd
    queue: [],                // Array van wachtende bellers
    currentPosition: 0,       // Huidige positie in queue
    autoAdvance: true         // Automatisch volgende nemen na gesprek
};
```

#### Queue Entry Object
```javascript
{
    id: string,               // Unieke ID voor queue entry
    callerType: string,       // 'anonymous' of 'known'
    customerId: number|null,  // ID van klant (null voor anonymous)
    customerName: string,     // Naam van klant of 'Anonieme Beller'
    serviceNumber: string,    // AVROBODE, MIKROGIDS, NCRVGIDS, ALGEMEEN
    waitTime: number,         // Gesimuleerde wachttijd in seconden
    queuedAt: timestamp,      // Wanneer toegevoegd aan queue
    priority: number          // 1-5 (1=hoogste prioriteit)
}
```

### UI Componenten

#### 1. Queue Info Bar in Header
**Locatie**: Tussen `header-top` en bestaande `session-info`  
**Conditie**: Alleen zichtbaar wanneer:
- Queue is enabled (`callQueue.enabled === true`)
- Er zijn wachtende bellers in de queue
- Er is GEEN actief gesprek (`callSession.active === false`)

**Structuur**:
```html
<div id="queueInfo" class="queue-info" style="display: none;">
    <div class="queue-info-content">
        <!-- Volgende beller informatie -->
        <div class="queue-next-caller">
            <span class="queue-icon">👤</span>
            <span class="queue-label">Volgende beller:</span>
            <span id="queueNextCallerName" class="queue-next-name">Jan Jansen</span>
        </div>
        
        <!-- Service nummer -->
        <div class="queue-service">
            <span class="service-icon">📞</span>
            <span id="queueNextService">AVROBODE SERVICE</span>
        </div>
        
        <!-- Wachttijd -->
        <div class="queue-wait">
            <span class="wait-icon">⏳</span>
            <span>Wacht: </span>
            <span id="queueNextWaitTime">2:45</span>
        </div>
        
        <!-- Queue lengte indicator -->
        <div class="queue-length">
            <span class="queue-length-icon">📋</span>
            <span>In wachtrij: </span>
            <span id="queueLength" class="queue-count">8</span>
        </div>
        
        <!-- Start gesprek actie -->
        <div class="queue-actions">
            <button id="acceptCallBtn" 
                    class="btn-accept-call" 
                    onclick="acceptNextCall()">
                📞 Gesprek Starten
            </button>
        </div>
    </div>
</div>
```

#### 2. Debug Menu Uitbreiding
**Nieuwe sectie** in debug modal voor queue management:

```html
<div class="debug-section">
    <h3>📋 Wachtrij Simulatie</h3>
    
    <div class="debug-row">
        <label>Queue status:</label>
        <span id="debugQueueStatus">Uitgeschakeld</span>
    </div>
    
    <div class="debug-row">
        <label>Aantal wachtenden:</label>
        <input type="number" id="debugQueueSize" 
               value="5" min="1" max="50" />
    </div>
    
    <div class="debug-row">
        <label>Mix van bellers:</label>
        <select id="debugQueueMix">
            <option value="balanced">Gebalanceerd (50/50)</option>
            <option value="mostly_known">Vooral bekende klanten (80/20)</option>
            <option value="mostly_anonymous">Vooral anoniem (20/80)</option>
            <option value="all_known">Alleen bekende klanten</option>
            <option value="all_anonymous">Alleen anoniem</option>
        </select>
    </div>
    
    <div class="debug-actions">
        <button class="btn btn-primary btn-block" 
                onclick="debugGenerateQueue()">
            🎯 Genereer Wachtrij
        </button>
        <button class="btn btn-secondary btn-block" 
                onclick="debugClearQueue()">
            🗑️ Wis Wachtrij
        </button>
    </div>
    
    <!-- Queue preview -->
    <div id="debugQueuePreview" class="debug-queue-preview" 
         style="display: none;">
        <h4>Huidige wachtrij:</h4>
        <div id="debugQueueList" class="debug-queue-list">
            <!-- Dynamisch gevuld met queue items -->
        </div>
    </div>
</div>
```

### CSS Styling

#### Queue Info Bar
```css
/* Queue Info Bar - tussen header-top en session-info */
.queue-info {
    background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.75rem 2rem;
}

.queue-info-content {
    max-width: 1800px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 2rem;
    font-size: 0.9rem;
    color: white;
}

.queue-next-caller,
.queue-service,
.queue-wait,
.queue-length {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.queue-next-name {
    font-weight: 600;
    font-size: 1rem;
    color: #fbbf24;
}

.queue-count {
    font-weight: 700;
    font-size: 1.1rem;
    background: rgba(255, 255, 255, 0.2);
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    min-width: 2rem;
    text-align: center;
}

.queue-actions {
    margin-left: auto;
}

.btn-accept-call {
    background: #10b981;
    color: white;
    border: none;
    padding: 0.6rem 1.5rem;
    border-radius: var(--radius-sm);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.btn-accept-call:hover {
    background: #059669;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

/* Debug Queue Preview */
.debug-queue-preview {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--bg-primary);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
}

.debug-queue-list {
    max-height: 300px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.debug-queue-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: white;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-color);
    font-size: 0.85rem;
}

.debug-queue-item.current {
    border: 2px solid var(--primary-color);
    background: #eff6ff;
}

.debug-queue-item-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.debug-queue-item-name {
    font-weight: 600;
}

.debug-queue-item-details {
    color: var(--text-secondary);
    font-size: 0.8rem;
}

.debug-queue-item-wait {
    color: var(--warning-color);
    font-weight: 600;
}
```

## JavaScript Implementatie

### Fase 1: Core Queue Management Functies

#### 1.1 Queue Initialisatie
```javascript
// Queue State (toevoegen aan bestaande state)
let callQueue = {
    enabled: false,
    queue: [],
    currentPosition: 0,
    autoAdvance: true
};

// Initialize queue from localStorage
function initializeQueue() {
    const savedQueue = localStorage.getItem('callQueue');
    if (savedQueue) {
        callQueue = JSON.parse(savedQueue);
        updateQueueDisplay();
    }
}

// Save queue to localStorage
function saveQueue() {
    localStorage.setItem('callQueue', JSON.stringify(callQueue));
}
```

#### 1.2 Queue Entry Generatie
```javascript
function generateQueueEntry(customerId = null, callerType = 'anonymous') {
    const serviceNumbers = ['AVROBODE', 'MIKROGIDS', 'NCRVGIDS', 'ALGEMEEN'];
    const randomService = serviceNumbers[Math.floor(Math.random() * serviceNumbers.length)];
    
    let entry = {
        id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        callerType: callerType,
        customerId: customerId,
        customerName: 'Anonieme Beller',
        serviceNumber: randomService,
        waitTime: Math.floor(Math.random() * (300 - 30 + 1)) + 30, // 30-300 sec
        queuedAt: Date.now(),
        priority: Math.floor(Math.random() * 5) + 1
    };
    
    // Voor bekende klant
    if (customerId && callerType === 'known') {
        const customer = customers.find(c => c.id === customerId);
        if (customer) {
            entry.customerName = `${customer.initials || customer.firstName} ${customer.middleName ? customer.middleName + ' ' : ''}${customer.lastName}`;
        }
    }
    
    return entry;
}
```

#### 1.3 Queue Generatie (Debug)
```javascript
function debugGenerateQueue() {
    const queueSize = parseInt(document.getElementById('debugQueueSize').value) || 5;
    const queueMix = document.getElementById('debugQueueMix').value;
    
    // Clear bestaande queue
    callQueue.queue = [];
    callQueue.currentPosition = 0;
    
    // Bepaal verdeling
    let knownPercentage = 0.5;
    switch(queueMix) {
        case 'mostly_known': knownPercentage = 0.8; break;
        case 'mostly_anonymous': knownPercentage = 0.2; break;
        case 'all_known': knownPercentage = 1.0; break;
        case 'all_anonymous': knownPercentage = 0.0; break;
    }
    
    // Genereer queue entries
    for (let i = 0; i < queueSize; i++) {
        const isKnown = Math.random() < knownPercentage && customers.length > 0;
        
        if (isKnown) {
            const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
            callQueue.queue.push(generateQueueEntry(randomCustomer.id, 'known'));
        } else {
            callQueue.queue.push(generateQueueEntry(null, 'anonymous'));
        }
    }
    
    callQueue.enabled = true;
    saveQueue();
    updateQueueDisplay();
    updateDebugQueuePreview();
    
    showToast(`✅ Wachtrij gegenereerd met ${queueSize} bellers`, 'success');
    
    // Update debug status
    document.getElementById('debugQueueStatus').textContent = 
        `Actief - ${callQueue.queue.length} wachtenden`;
}
```

#### 1.4 Queue Display Update
```javascript
function updateQueueDisplay() {
    const queueInfoBar = document.getElementById('queueInfo');
    
    // Alleen tonen als:
    // - Queue is enabled
    // - Er zijn wachtenden
    // - Geen actief gesprek
    const shouldShow = callQueue.enabled && 
                       callQueue.queue.length > 0 && 
                       !callSession.active;
    
    if (!shouldShow) {
        queueInfoBar.style.display = 'none';
        return;
    }
    
    // Toon queue info
    queueInfoBar.style.display = 'block';
    
    // Huidige (eerste) entry in queue
    const nextCaller = callQueue.queue[0];
    
    if (nextCaller) {
        document.getElementById('queueNextCallerName').textContent = nextCaller.customerName;
        document.getElementById('queueNextService').textContent = 
            serviceNumbers[nextCaller.serviceNumber]?.label || nextCaller.serviceNumber;
        document.getElementById('queueNextWaitTime').textContent = 
            formatTime(nextCaller.waitTime);
        document.getElementById('queueLength').textContent = 
            callQueue.queue.length - 1; // Aantal achter de huidige
    }
}
```

### Fase 2: Call Accept Flow

#### 2.1 Accept Next Call
```javascript
function acceptNextCall() {
    if (!callQueue.enabled || callQueue.queue.length === 0) {
        showToast('⚠️ Geen bellers in wachtrij', 'error');
        return;
    }
    
    if (callSession.active) {
        showToast('⚠️ Er is al een actief gesprek', 'error');
        return;
    }
    
    // Check agent status
    if (agentStatus.current !== 'ready') {
        showToast('⚠️ Agent status moet "Beschikbaar" zijn om gesprek te accepteren', 'error');
        return;
    }
    
    // Haal eerste entry uit queue
    const nextEntry = callQueue.queue.shift();
    
    // Start call session met queue entry data
    startCallFromQueue(nextEntry);
    
    // Update queue display
    saveQueue();
    updateQueueDisplay();
    updateDebugQueuePreview();
}
```

#### 2.2 Start Call From Queue
```javascript
function startCallFromQueue(queueEntry) {
    // Initialize call session met queue data
    callSession = {
        active: true,
        callerType: queueEntry.callerType,
        serviceNumber: queueEntry.serviceNumber,
        waitTime: queueEntry.waitTime,
        startTime: Date.now(),
        customerId: queueEntry.customerId,
        customerName: queueEntry.customerName,
        pendingIdentification: null,
        durationInterval: null,
        recordingActive: false,
        totalHoldTime: 0,
        holdStartTime: null,
        onHold: false
    };
    
    // Als het een bekende klant is, open automatisch het klantrecord
    if (queueEntry.callerType === 'known' && queueEntry.customerId) {
        setTimeout(() => {
            selectCustomer(queueEntry.customerId);
        }, 500);
    }
    
    // Start normale call session flow
    startCallSession();
    
    showToast(
        `📞 Gesprek gestart met ${queueEntry.customerName}`,
        'success'
    );
}
```

### Fase 3: Queue Integration met Bestaand Call Flow

#### 3.1 End Session Hook
```javascript
// In bestaande endCallSession functie toevoegen:
function endCallSession(forcedByCustomer = false) {
    // ... bestaande code ...
    
    // Na gesprek: check of er meer bellers zijn in queue
    if (callQueue.enabled && callQueue.queue.length > 0 && callQueue.autoAdvance) {
        // Update queue display zodat volgende beller zichtbaar wordt
        setTimeout(() => {
            updateQueueDisplay();
        }, 1000);
    }
    
    // ... rest van bestaande code ...
}
```

#### 3.2 Agent Status Hook
```javascript
// In bestaande setAgentStatus functie aanpassen:
function setAgentStatus(newStatus) {
    // ... bestaande code ...
    
    // Update queue display wanneer status wijzigt
    updateQueueDisplay();
    
    // ... rest van bestaande code ...
}
```

### Fase 4: Debug Menu Functies

#### 4.1 Clear Queue
```javascript
function debugClearQueue() {
    if (confirm('🗑️ Wachtrij volledig wissen?')) {
        callQueue = {
            enabled: false,
            queue: [],
            currentPosition: 0,
            autoAdvance: true
        };
        
        saveQueue();
        updateQueueDisplay();
        updateDebugQueuePreview();
        
        document.getElementById('debugQueueStatus').textContent = 'Uitgeschakeld';
        showToast('✅ Wachtrij gewist', 'info');
    }
}
```

#### 4.2 Queue Preview in Debug
```javascript
function updateDebugQueuePreview() {
    const previewContainer = document.getElementById('debugQueuePreview');
    const listContainer = document.getElementById('debugQueueList');
    
    if (!callQueue.enabled || callQueue.queue.length === 0) {
        previewContainer.style.display = 'none';
        return;
    }
    
    previewContainer.style.display = 'block';
    listContainer.innerHTML = '';
    
    callQueue.queue.forEach((entry, index) => {
        const item = document.createElement('div');
        item.className = 'debug-queue-item';
        if (index === 0) item.classList.add('current');
        
        item.innerHTML = `
            <div class="debug-queue-item-info">
                <div class="debug-queue-item-name">
                    ${index + 1}. ${entry.customerName}
                </div>
                <div class="debug-queue-item-details">
                    ${entry.serviceNumber} • 
                    ${entry.callerType === 'known' ? '👤 Bekend' : '❓ Anoniem'}
                </div>
            </div>
            <div class="debug-queue-item-wait">
                ⏳ ${formatTime(entry.waitTime)}
            </div>
        `;
        
        listContainer.appendChild(item);
    });
}
```

## Implementatie Volgorde

### Stap 1: Data Structuur (30 min)
- [ ] Voeg `callQueue` state object toe aan app.js
- [ ] Implementeer `initializeQueue()` functie
- [ ] Implementeer `saveQueue()` functie
- [ ] Roep `initializeQueue()` aan in bestaande `init()` functie

### Stap 2: HTML Structuur (30 min)
- [ ] Voeg queue info bar toe aan header in index.html
- [ ] Positioneer tussen `header-top` en `session-info`
- [ ] Voeg debug sectie toe aan debug modal

### Stap 3: CSS Styling (45 min)
- [ ] Implementeer `.queue-info` styling
- [ ] Implementeer `.queue-info-content` en child elementen
- [ ] Implementeer `.btn-accept-call` styling
- [ ] Implementeer debug queue preview styling
- [ ] Test responsive behavior

### Stap 4: Core Queue Functies (1 uur)
- [ ] Implementeer `generateQueueEntry()`
- [ ] Implementeer `debugGenerateQueue()`
- [ ] Implementeer `updateQueueDisplay()`
- [ ] Test queue generatie en display

### Stap 5: Call Accept Flow (1 uur)
- [ ] Implementeer `acceptNextCall()`
- [ ] Implementeer `startCallFromQueue()`
- [ ] Test accept flow met anonieme bellers
- [ ] Test accept flow met bekende klanten

### Stap 6: Integration (45 min)
- [ ] Voeg queue check toe aan `endCallSession()`
- [ ] Voeg queue update toe aan `setAgentStatus()`
- [ ] Test volledige call flow met queue
- [ ] Test met verschillende agent statussen

### Stap 7: Debug Functies (30 min)
- [ ] Implementeer `debugClearQueue()`
- [ ] Implementeer `updateDebugQueuePreview()`
- [ ] Voeg queue status indicator toe aan debug menu
- [ ] Test alle debug functies

### Stap 8: Polish & Testing (45 min)
- [ ] Test met verschillende queue groottes (1, 5, 20, 50)
- [ ] Test met verschillende caller mix ratios
- [ ] Test edge cases (lege queue, 1 beller, etc.)
- [ ] Test interactie met bestaande features
- [ ] Verfijn animaties en transitions
- [ ] Test op verschillende schermformaten

## Edge Cases & Validatie

### Edge Cases
1. **Queue leeg tijdens actief gesprek**: Queue info moet niet verschijnen
2. **Agent status niet 'ready'**: Accept button moet disabled zijn of error tonen
3. **Queue entry met niet-bestaande klant ID**: Fallback naar anonieme beller
4. **Actief gesprek starten via debug**: Queue info moet verdwijnen
5. **Agent gaat naar break met wachtenden**: Queue info verdwijnt
6. **Laatste beller in queue accepteren**: Queue info moet verdwijnen

### Validatie
- Queue size tussen 1-50
- Service numbers moeten valid zijn
- Customer IDs moeten bestaan voor 'known' callers
- Wait times realistisch (30-300 seconden)
- Queue state moet persistent zijn (localStorage)

## Toekomstige Uitbreidingen (Optioneel)

### Fase 2 Features
1. **Priority Queue**: Sorteer op prioriteit in plaats van FIFO
2. **Queue Statistics**: Gemiddelde wachttijd, aantal afgehandeld, etc.
3. **Auto-refresh Wait Time**: Incrementeer wachttijd real-time
4. **Queue Callbacks**: Simuleer terugbel functionaliteit
5. **Queue Filters**: Filter queue op service type
6. **Manual Queue Management**: Verwijder/verplaats entries in queue

### Performance Optimizations
1. Lazy loading voor grote queues (>50 entries)
2. Virtual scrolling voor debug preview
3. Throttle queue display updates

## Afhankelijkheden

### Bestaande Functionaliteit
- `callSession` state management
- `agentStatus` state management
- `startCallSession()` functie
- `endCallSession()` functie
- `selectCustomer()` functie
- `showToast()` functie
- `formatTime()` utility
- Debug modal infrastructure

### Geen Breaking Changes
Deze implementatie breidt bestaande functionaliteit uit zonder wijzigingen aan de huidige call flow voor directe gesprekken (via debug "Start Gesprek Simulatie").

## Success Criteria

✅ Queue kan gegenereerd worden met configureerbare grootte en mix  
✅ Volgende beller is zichtbaar in header alleen zonder actief gesprek  
✅ Wachtrijlengte wordt correct getoond  
✅ Gesprek kan gestart worden door op "Gesprek Starten" te klikken  
✅ Queue state is persistent via localStorage  
✅ Bestaande call flow blijft intact en functioneel  
✅ Agent status bepaalt of queue info zichtbaar is  
✅ Debug preview toont complete queue met correcte styling  
✅ Edge cases worden netjes afgehandeld  
✅ UI is responsive en visueel consistent met bestaande design  

## Geschatte Tijd
**Totaal: 5-6 uur**
- Development: 4-5 uur
- Testing & refinement: 1 uur
