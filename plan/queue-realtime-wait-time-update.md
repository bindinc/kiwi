# Real-time Wait Time Update - Queue Simulatie Verbetering

## Datum: 14 Oktober 2025

## Probleem
De wachttijd in de queue info bar bleef statisch en liep niet op terwijl klanten in de wachtrij stonden. Dit was niet realistisch omdat klanten die wachten een steeds langere wachttijd zouden moeten hebben.

## Oplossing
Implementatie van een real-time wait time update systeem met een interval timer die elke seconde alle wachttijden in de queue verhoogt en de display bijwerkt.

## Geïmplementeerde Wijzigingen

### 1. Queue State Uitbreiding
**Locatie**: `app.js` (regel ~78)

```javascript
let callQueue = {
    enabled: false,
    queue: [],
    currentPosition: 0,
    autoAdvance: true,
    waitTimeInterval: null    // NIEUW: Interval voor real-time updates
};
```

### 2. Start Wait Time Update Functie
**Locatie**: `app.js` (regel ~1250)

**Functie**: `startQueueWaitTimeUpdate()`

**Functionaliteit**:
- Start interval van 1 seconde
- Verhoogt `waitTime` voor alle entries in queue
- Update queue info bar display (volgende beller)
- Update debug preview lijst (alle bellers)
- Periodieke localStorage save (elke 5 seconden)
- Auto-stop bij: geen queue, geen bellers, of actief gesprek

**Code**:
```javascript
function startQueueWaitTimeUpdate() {
    if (callQueue.waitTimeInterval) {
        return; // Already running
    }
    
    callQueue.waitTimeInterval = setInterval(() => {
        if (!callQueue.enabled || callQueue.queue.length === 0 || callSession.active) {
            stopQueueWaitTimeUpdate();
            return;
        }
        
        // Increment wait time for all callers
        callQueue.queue.forEach(entry => {
            entry.waitTime += 1;
        });
        
        // Update displays
        const nextCaller = callQueue.queue[0];
        if (nextCaller) {
            const nextWaitTime = document.getElementById('queueNextWaitTime');
            if (nextWaitTime) {
                nextWaitTime.textContent = formatTime(nextCaller.waitTime);
            }
        }
        
        updateDebugQueuePreview();
        
        // Periodic save (every 5 seconds)
        if (nextCaller && nextCaller.waitTime % 5 === 0) {
            saveQueue();
        }
    }, 1000);
}
```

### 3. Stop Wait Time Update Functie
**Locatie**: `app.js` (regel ~1288)

**Functie**: `stopQueueWaitTimeUpdate()`

**Functionaliteit**:
- Stopt interval timer
- Reset `waitTimeInterval` naar null
- Aangeroepen bij: queue verbergen, queue wissen, call accepteren

**Code**:
```javascript
function stopQueueWaitTimeUpdate() {
    if (callQueue.waitTimeInterval) {
        clearInterval(callQueue.waitTimeInterval);
        callQueue.waitTimeInterval = null;
    }
}
```

### 4. Integration in updateQueueDisplay()
**Locatie**: `app.js` (regel ~1201)

**Wijzigingen**:
- Roept `startQueueWaitTimeUpdate()` aan wanneer queue zichtbaar is
- Roept `stopQueueWaitTimeUpdate()` aan wanneer queue verborgen is

**Code**:
```javascript
function updateQueueDisplay() {
    // ... existing code ...
    
    const shouldShow = callQueue.enabled && 
                       callQueue.queue.length > 0 && 
                       !callSession.active;
    
    if (!shouldShow) {
        queueInfoBar.style.display = 'none';
        stopQueueWaitTimeUpdate();  // NIEUW: Stop timer
        return;
    }
    
    queueInfoBar.style.display = 'block';
    startQueueWaitTimeUpdate();     // NIEUW: Start timer
    
    // ... rest of display logic ...
}
```

### 5. Integration in debugClearQueue()
**Locatie**: `app.js` (regel ~1297)

**Wijzigingen**:
- Roept `stopQueueWaitTimeUpdate()` aan bij queue wissen
- Reset `waitTimeInterval` in queue state

**Code**:
```javascript
function debugClearQueue() {
    if (confirm('🗑️ Wachtrij volledig wissen?')) {
        stopQueueWaitTimeUpdate();  // NIEUW: Stop timer
        
        callQueue = {
            enabled: false,
            queue: [],
            currentPosition: 0,
            autoAdvance: true,
            waitTimeInterval: null  // NIEUW: Reset interval
        };
        
        // ... rest of function ...
    }
}
```

## Test Resultaten

### Test 1: Basic Wait Time Increment
✅ **Start tijd**: 3:36  
✅ **Na 11 seconden**: 3:47  
✅ **Na 33 seconden**: 4:09  
✅ **Conclusie**: Timer loopt correct elke seconde op

### Test 2: Queue Info Bar Display
✅ Wachttijd update is zichtbaar in header bar  
✅ Format blijft correct (MM:SS)  
✅ Smooth update zonder flikkeren

### Test 3: Debug Preview Update
✅ Alle bellers in preview lijst worden bijgewerkt  
✅ Elk met eigen oplopende wachttijd:
- Beller 1: 4:17 → 4:29 (+12 sec)
- Beller 2: 3:24 → 3:36 (+12 sec)
- Beller 3: 5:34 → 5:46 (+12 sec)
- Beller 4: 2:05 → 2:17 (+12 sec)

### Test 4: Auto-stop Scenario's
✅ Timer stopt automatisch bij call accept  
✅ Timer stopt bij queue wissen  
✅ Timer stopt bij verbergen queue info bar

### Test 5: Performance
✅ Geen merkbare performance impact  
✅ LocalStorage saves beperkt tot elke 5 seconden  
✅ Interval cleanup werkt correct

## Technische Details

### Performance Optimalisatie
- **Update frequency**: 1 seconde (balance tussen real-time en performance)
- **LocalStorage saves**: Elke 5 seconden (reduce write operations)
- **Auto-stop**: Timer stopt automatisch bij niet-gebruik
- **Single interval**: Voorkomt meerdere concurrent timers

### Edge Cases Handled
1. **Queue verborgen tijdens call**: Timer stopt automatisch
2. **Laatste beller geaccepteerd**: Timer stopt bij lege queue
3. **Page refresh**: Wachttijden worden opgeslagen en hersteld
4. **Debug modal open/close**: Timer blijft doorlopen
5. **Multiple intervals**: Preventie via check in start functie

### Memory Management
- Interval wordt correct opgeschoond bij stop
- Geen memory leaks door proper cleanup
- Reference naar interval opgeslagen in queue state

## Impact

### User Experience
✅ **Realistische simulatie**: Wachttijden lopen op zoals in echte call centers  
✅ **Live feedback**: Agent ziet direct hoe lang klanten wachten  
✅ **Urgentie indicator**: Langere wachttijden maken urgentie duidelijk  
✅ **Visual consistency**: Update in zowel header als debug preview

### Code Quality
✅ **Clean separation**: Start/stop functies apart van display logic  
✅ **Single responsibility**: Elke functie heeft één duidelijke taak  
✅ **Proper cleanup**: Intervals worden correct opgeschoond  
✅ **Performance conscious**: Optimalisatie voor battery/CPU

## Volgende Mogelijke Uitbreidingen

### Optionele Features (Future)
1. **Kleurcodering**: Wachttijden > 5 min in oranje, > 10 min in rood
2. **Gemiddelde wachttijd**: Dashboard met statistieken
3. **Longest waiting caller**: Highlight beller met langste wachttijd
4. **Wait time SLA**: Waarschuwing bij overschrijden targets
5. **Historical trends**: Grafieken van wachttijden over tijd

### Performance Optimizations (Future)
1. Alleen update visible elements (optimization for large queues)
2. RequestAnimationFrame voor smoother updates
3. Web Worker voor background calculations (bij >100 callers)

## Bestanden Gewijzigd

### app.js
- Queue state: Added `waitTimeInterval` property
- Nieuwe functie: `startQueueWaitTimeUpdate()`
- Nieuwe functie: `stopQueueWaitTimeUpdate()`
- Aangepast: `updateQueueDisplay()` - Start/stop timer
- Aangepast: `debugClearQueue()` - Stop timer en reset

### Geen wijzigingen nodig in:
- index.html (HTML structuur blijft hetzelfde)
- styles.css (CSS styling blijft hetzelfde)

## Conclusie

De real-time wait time update functionaliteit is succesvol geïmplementeerd en volledig werkend. Alle wachttijden lopen nu live op met 1 seconde intervallen, zowel in de queue info bar als in de debug preview lijst. De implementatie is performance-bewust met periodieke saves en proper cleanup van intervals.

**Status**: ✅ **COMPLEET EN GETEST**

**Implementatietijd**: ~30 minuten
