# Avaya Telefoongesprek Simulatie

## Overzicht
Deze feature simuleert Avaya telefoongesprekken in het debug scherm met een actieve gespreks-timer en beller informatie.

## Functionaliteit

### 1. Gesprek Timer
Wanneer een telefoongesprek wordt gesimuleerd via het debug scherm:
- Start automatisch een timer die elke seconde wordt bijgewerkt
- Toont de gespreksduur in het formaat:
  - `MM:SS` voor gesprekken korter dan 1 uur
  - `H:MM:SS` voor gesprekken langer dan 1 uur

### 2. Beller Informatie in Blauwe Bovenbalk
De header toont tijdens een actief gesprek:
- **Timer**: ⏱️ met de gespreksduur (in geel gemarkeerd)
- **Beller naam**: De volledige naam van de klant of "Anoniem"
- **Telefoonnummer**: Het telefoonnummer of "Niet weergegeven"

Voorbeeld display:
```
⏱️ 2:35
📞 J. de Vries • 06-12345678
```

### 3. Sessie Rapport bij Afsluiten
Wanneer de sessie wordt beëindigd (via "Sessie Afsluiten" knop):
- Het gesprek wordt automatisch beëindigd
- Er verschijnt een groen rapport in de bovenbalk met de totale gespreksduur
- Rapport toont: "✓ Gesprek beëindigd - Duur: [tijd]"
- Het rapport verdwijnt automatisch na 10 seconden

Formaten voor duur:
- `XXs` voor gesprekken korter dan 1 minuut
- `XXm XXs` voor gesprekken korter dan 1 uur  
- `XXu XXm XXs` voor gesprekken langer dan 1 uur

## Gebruik

### Debug Scherm Activeren
Druk 4x op de `]` toets om het debug scherm te openen.

### Gesprek Simuleren

#### Anonieme Beller
1. Klik op "📞 Anonieme Beller"
2. Timer start automatisch
3. Header toont: "Anoniem • Niet weergegeven"
4. Zoek handmatig naar de klant

#### Bekende Beller
1. Klik op een van de klant knoppen onder "Mimic Avaya Bellers"
2. Timer start automatisch
3. Header toont: klant naam en telefoonnummer
4. Klant profiel wordt automatisch geopend

### Gesprek Beëindigen
- Klik op "✕ Sessie Afsluiten" in de header
- Of start een nieuw gesimuleerd gesprek (beëindigt automatisch het vorige)

## Technische Details

### Nieuwe Variabelen
```javascript
let callActive = false;           // Status van actief gesprek
let callStartTime = null;         // Starttijd van gesprek
let callTimerInterval = null;     // Interval voor timer updates
let currentCallerInfo = null;     // Beller naam en nummer
```

### Functies

#### `startCall(callerName, callerNumber)`
Start een nieuwe gesprekssimulatie met gegeven beller informatie.

#### `updateCallTimer()`
Update de timer display elke seconde met de huidige gespreksduur.

#### `endCall()`
Beëindigt het actieve gesprek en toont het sessie rapport.

### HTML Wijzigingen
- Toegevoegd: `<span id="callStatus" class="call-status">` in de header

### CSS Styling
- `.call-status`: Container met glasmorfisme effect
- `.call-timer`: Gele, vette tekst voor de timer
- `.caller-info`: Subtielere tekst voor beller info
- `.call-report`: Groen rapport voor beëindigde gesprekken

## Design Keuzes

1. **Automatische Start**: Gesprek start direct bij simulatie (geen extra knop)
2. **Glasmorfisme Effect**: Moderne, doorzichtige achtergrond voor call status
3. **Kleurcodering**: 
   - Geel voor actieve timer (attentie)
   - Groen voor voltooid gesprek (succes)
4. **Auto-hide Rapport**: Verdwijnt na 10 seconden om header clean te houden
5. **Integratie met Sessie**: Gesprek eindigt automatisch bij session end

## Toekomstige Uitbreidingen
- Pauzeer/Hervat functionaliteit
- Gesprekgeschiedenis logging
- Audio notificaties bij lange gesprekken
- Statistieken dashboard voor gespreksduren
