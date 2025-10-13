# Verbetering: Klant Zoeken met Paginering

## Huidige Situatie

De "Klant Zoeken" functie toont momenteel alle zoekresultaten direct onder de zoekinput box in het linkerpaneel. Bij grote hoeveelheden resultaten (100+) ontstaan de volgende problemen:

- **Ruimtegebrek**: Het linkerpaneel is beperkt in breedte (~350-400px) en hoogte
- **Geen paginering**: Alle resultaten worden in één keer getoond, wat leidt tot zeer lange scroll-lijsten
- **Beperkte zichtbaarheid**: Klanten moeten veel scrollen om alle resultaten te bekijken
- **Middenpaneel onderbezet**: Het middenpaneel toont alleen de welkomstmelding totdat een klant is geselecteerd

## Voorgestelde Oplossing

### 1. Zoekresultaten naar Middenpaneel Verplaatsen

**Doel**: Het grotere middenpaneel benutten voor een overzichtelijke weergave van zoekresultaten.

**Wijzigingen**:
- Zoekresultaten worden getoond in het `center-panel` in plaats van in het `left-panel`
- Het linkerpaneel houdt alleen het zoekformulier en een kleine indicator (bijv. "23 resultaten gevonden")
- Het middenpaneel krijgt een nieuwe sectie: "Zoekresultaten Overzicht"

**Voordelen**:
- Meer horizontale ruimte voor klantinformatie in resultaten
- Betere zichtbaarheid van actieve/beëindigde abonnementen
- Ruimte voor extra kolommen (bijv. laatste contactdatum, klantnummer)

### 2. Paginering Implementeren

**Specificaties**:
- **Items per pagina**: 20 resultaten (configureerbaar)
- **Navigatie**: Previous/Next knoppen + pagina-nummers (1, 2, 3, ... 10)
- **Resultaatteller**: "Toont 1-20 van 153 resultaten"
- **Jump to page**: Directe navigatie naar specifieke pagina bij veel resultaten (>10 pagina's)

**UI Componenten**:
```
┌─────────────────────────────────────────────────────┐
│ 🔍 Zoekresultaten: "Jan" (153 resultaten)          │
│ Toont 1-20 van 153 • Sorteer: Achternaam ▼         │
├─────────────────────────────────────────────────────┤
│ [Resultaat 1]                                       │
│ [Resultaat 2]                                       │
│ ...                                                  │
│ [Resultaat 20]                                      │
├─────────────────────────────────────────────────────┤
│ ← Vorige  [1] [2] [3] ... [8]  Volgende →         │
└─────────────────────────────────────────────────────┘
```

### 3. Tabelweergave voor Resultaten

**Kolommen**:
1. **Naam**: Volledige naam met achternaam vet
2. **Adres**: Straat + plaats (compacte weergave)
3. **Abonnementen**: Badge-weergave (Actief: groen, Beëindigd: grijs)
4. **Contact**: Telefoon/Email iconen
5. **Acties**: Selecteer knop + Identificeer knop (indien relevant)

**Layout**:
- Responsive tabelweergave met zebra-striping
- Hover effect voor hele rij
- Clickable rijen (behalve actieknoppen)
- Mobile: Kolommen samenvoegen tot kaartweergave

### 4. Verbeterde Zoek-Feedback

**Toevoegingen**:
- **Loading indicator**: Tijdens het zoeken
- **Resultaat samenvatting**: In linkerpaneel na zoeken
  ```
  ✓ 153 klanten gevonden
  Klik om resultaten te bekijken
  ```
- **Lege staat**: Verbeterde "Geen resultaten" met zoek-tips
- **Gedeeltelijke match indicator**: Visuele feedback voor partial matches

### 5. Sorteer- en Filterfunctionaliteit

**Sorteeropties**:
- Achternaam (A-Z / Z-A)
- Postcode
- Aantal actieve abonnementen
- Laatste contactdatum

**Filters** (optioneel voor fase 2):
- Alleen actieve abonnementen
- Specifiek magazine type
- Stad/Regio

## Implementatie Stappen

### Stap 1: HTML Structuur Aanpassen
**Bestand**: `index.html`

1. Linkerpaneel: Resultaat-indicator toevoegen na zoekformulier
   ```html
   <div id="searchSummary" class="search-summary" style="display: none;">
       <div class="summary-badge">
           <span id="resultCount">0</span> resultaten gevonden
       </div>
       <button class="btn btn-link" onclick="scrollToResults()">
           Bekijk resultaten →
       </button>
   </div>
   ```

2. Middenpaneel: Nieuwe zoekresultaten sectie toevoegen
   ```html
   <div id="searchResultsView" class="search-results-view" style="display: none;">
       <div class="results-header">
           <h2 id="resultsTitle">🔍 Zoekresultaten</h2>
           <div class="results-meta">
               <span id="resultsRange">Toont 1-20 van 153</span>
               <select id="sortBy" onchange="sortResults(this.value)">
                   <option value="name">Sorteer: Achternaam</option>
                   <option value="postal">Sorteer: Postcode</option>
               </select>
           </div>
       </div>
       <div id="paginatedResults" class="results-table"></div>
       <div id="pagination" class="pagination"></div>
   </div>
   ```

### Stap 2: CSS Styling
**Bestand**: `styles.css`

1. Zoekresultaten verwijderen uit linkerpaneel styling
2. Nieuwe styles toevoegen:
   - `.search-results-view`: Full-width container in center panel
   - `.results-table`: Tabel-achtige layout met flexbox/grid
   - `.pagination`: Paginering controls
   - `.search-summary`: Compacte resultaat indicator

**Voorbeeld CSS**:
```css
/* Search Summary in Left Panel */
.search-summary {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--bg-primary);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
}

/* Search Results View in Center Panel */
.search-results-view {
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    box-shadow: var(--shadow-md);
}

.results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
}

.results-meta {
    display: flex;
    gap: 1rem;
    align-items: center;
}

/* Results Table */
.results-table {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
}

.result-row {
    display: grid;
    grid-template-columns: 2fr 2fr 2fr auto;
    gap: 1rem;
    padding: 1rem;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    transition: all 0.2s;
}

.result-row:hover {
    border-color: var(--primary-color);
    background: rgba(37, 99, 235, 0.05);
    cursor: pointer;
}

/* Pagination */
.pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
}

.page-btn {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border-color);
    background: white;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s;
}

.page-btn:hover {
    background: var(--bg-primary);
}

.page-btn.active {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
}
```

### Stap 3: JavaScript Logica
**Bestand**: `app.js`

1. **Paginering State Toevoegen**:
   ```javascript
   let searchState = {
       results: [],
       currentPage: 1,
       itemsPerPage: 20,
       sortBy: 'name',
       sortOrder: 'asc'
   };
   ```

2. **`searchCustomer()` Aanpassen**:
   - Resultaten opslaan in `searchState.results`
   - Pagina resetten naar 1
   - Samenvatting tonen in linkerpaneel
   - Zoekresultaten view tonen in middenpaneel
   - Welkomstmelding verbergen

3. **Nieuwe Functie: `displayPaginatedResults()`**:
   ```javascript
   function displayPaginatedResults() {
       const { results, currentPage, itemsPerPage } = searchState;
       const startIdx = (currentPage - 1) * itemsPerPage;
       const endIdx = startIdx + itemsPerPage;
       const pageResults = results.slice(startIdx, endIdx);
       
       // Render page results
       const container = document.getElementById('paginatedResults');
       container.innerHTML = pageResults.map(customer => 
           renderCustomerRow(customer)
       ).join('');
       
       // Update pagination controls
       renderPagination();
       
       // Update meta info
       updateResultsMeta();
   }
   ```

4. **Nieuwe Functie: `renderPagination()`**:
   ```javascript
   function renderPagination() {
       const { results, currentPage, itemsPerPage } = searchState;
       const totalPages = Math.ceil(results.length / itemsPerPage);
       const pagination = document.getElementById('pagination');
       
       let html = '';
       
       // Previous button
       if (currentPage > 1) {
           html += `<button class="page-btn" onclick="goToPage(${currentPage - 1})">← Vorige</button>`;
       }
       
       // Page numbers (with ellipsis for many pages)
       const pageNumbers = getPageNumbers(currentPage, totalPages);
       pageNumbers.forEach(page => {
           if (page === '...') {
               html += `<span class="page-ellipsis">...</span>`;
           } else {
               const activeClass = page === currentPage ? 'active' : '';
               html += `<button class="page-btn ${activeClass}" onclick="goToPage(${page})">${page}</button>`;
           }
       });
       
       // Next button
       if (currentPage < totalPages) {
           html += `<button class="page-btn" onclick="goToPage(${currentPage + 1})">Volgende →</button>`;
       }
       
       pagination.innerHTML = html;
   }
   ```

5. **Helper Functie: `getPageNumbers()`**:
   - Smart page number logic (1, 2, 3, ..., 8, 9, 10)
   - Altijd eerste en laatste pagina tonen
   - Ellipsis (...) voor overgeslagen pagina's

6. **Sorteer Functionaliteit**:
   ```javascript
   function sortResults(sortBy) {
       searchState.sortBy = sortBy;
       
       searchState.results.sort((a, b) => {
           switch(sortBy) {
               case 'name':
                   return a.lastName.localeCompare(b.lastName);
               case 'postal':
                   return a.postalCode.localeCompare(b.postalCode);
               default:
                   return 0;
           }
       });
       
       displayPaginatedResults();
   }
   ```

### Stap 4: Integratie met Bestaande Functionaliteit

1. **`selectCustomer()` Aanpassen**:
   - Zoekresultaten blijven zichtbaar in middenpaneel
   - Klantdetails openen in rechter overlay/modal OF
   - Klantdetails vervangen zoekresultaten (met "Terug naar resultaten" knop)

2. **"Identify Caller" Knop**:
   - Blijft zichtbaar in resultatenrijen tijdens anonieme call
   - Na identificatie: resultaten blijven zichtbaar met indicatie

3. **Responsive Gedrag**:
   - Op kleine schermen: Card-layout in plaats van tabel
   - Minder items per pagina (10 i.p.v. 20)
   - Simpelere paginering (alleen prev/next)

## User Experience Flow

### Scenario: Agent zoekt klant "Jan"

1. **Zoeken**:
   - Agent typt "Jan" in linkerpaneel
   - Klikt op "Zoeken" knop
   - Loading indicator verschijnt

2. **Resultaten ontvangen**:
   - Linkerpaneel toont: "✓ 153 klanten gevonden - Bekijk resultaten →"
   - Middenpaneel toont zoekresultaten tabel met eerste 20 resultaten
   - Welkomstmelding verdwijnt

3. **Navigeren**:
   - Agent scrollt door eerste 20 resultaten
   - Klikt op "Volgende →" of "2" om pagina 2 te bekijken
   - Scroll position reset naar top van resultaten

4. **Klant selecteren**:
   - Agent klikt op een klant in de lijst
   - Klantdetails openen rechts OF vervangen zoekresultaten
   - "Terug naar zoekresultaten" knop beschikbaar

5. **Nieuwe zoekopdracht**:
   - Agent past zoekcriteria aan in linkerpaneel
   - Klikt opnieuw op "Zoeken"
   - Nieuwe resultaten vervangen oude resultaten
   - Paginering reset naar pagina 1

## Edge Cases en Validaties

1. **0 Resultaten**: Duidelijke "Geen klanten gevonden" melding met zoek-tips
2. **1 Resultaat**: Automatisch klant selecteren? Of toch resultaat tonen?
3. **Zeer veel resultaten (1000+)**: Performance optimalisatie overwegen (virtual scrolling)
4. **Sorteer tijdens paginering**: Huidige pagina behouden of resetten?
5. **Browser back button**: Zoekresultaten state behouden

## Performance Overwegingen

1. **Lazy Loading**: Alleen huidige pagina renderen, niet alle resultaten
2. **Debounce**: Wachten met zoeken tot gebruiker stopt met typen (optioneel)
3. **Caching**: Zoekresultaten cachen voor snellere navigatie terug
4. **Virtual Scrolling**: Voor zeer grote datasets (fase 2)

## Toegankelijkheid

1. **Keyboard navigatie**: Paginering bedienbaar met Tab en Enter
2. **Screen readers**: Aria-labels voor paginering controls
3. **Focus management**: Focus op eerste resultaat na pagina wissel
4. **Visuele feedback**: Duidelijke active/hover states

## Testing Checklist

- [ ] Zoeken met 0 resultaten
- [ ] Zoeken met 1 resultaat
- [ ] Zoeken met 20 resultaten (exact 1 pagina)
- [ ] Zoeken met 100+ resultaten (meerdere pagina's)
- [ ] Navigeren tussen pagina's (next/previous)
- [ ] Direct naar pagina springen
- [ ] Sorteren op verschillende velden
- [ ] Klant selecteren uit resultaten
- [ ] Nieuwe zoekopdracht tijdens resultaten weergave
- [ ] Responsive gedrag op kleine schermen
- [ ] Identify caller knop tijdens anonieme call
- [ ] Performance met 1000+ resultaten

## Toekomstige Uitbreidingen

1. **Geavanceerd zoeken**: Meer zoekfilters (stad, magazine type, status)
2. **Export functionaliteit**: Resultaten exporteren naar CSV
3. **Bulk acties**: Meerdere klanten selecteren voor bulk operaties
4. **Opgeslagen zoekopdrachten**: Veelgebruikte zoekopdrachten opslaan
5. **Fuzzy search**: Spelfouten automatisch corrigeren
6. **Recent bekeken**: Recent geselecteerde klanten snel terugvinden
