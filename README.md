# Klantenservice Portal - Magazine Abonnementen

Een moderne, lichtgewicht webinterface voor klantenservice medewerkers om magazine abonnementen te beheren.

## 📋 Functionaliteiten

### 🔍 Klant Zoeken
- Zoeken op naam (voor- en achternaam)
- Zoeken op postcode en huisnummer
- Directe toegang tot klantgegevens

### ➕ Nieuw Abonnement Aanmaken
- Volledige klantregistratie tijdens telefoongesprek
- Keuze uit magazines: Avrobode, Mikrogids, Ncrvgids
- Directe startdatum instelling

### ✏️ Gegevens Beheren
- Klantgegevens wijzigen
- Abonnementsgegevens aanpassen
- Adreswijzigingen verwerken

### 📋 Contact Geschiedenis
- Verticale tijdlijn met alle contactmomenten
- Accordion view voor gedetailleerde informatie
- Automatische registratie van alle acties

### 📮 Magazine Verzenden
- Handmatig laatste editie opnieuw verzenden
- Reden registratie (niet ontvangen, beschadigd, etc.)
- Automatische logging in contactgeschiedenis

### 🎯 Winback Flow
- Gestructureerde opzegflow met scripts
- Reden analyse voor opzegging
- Gepersonaliseerde winback aanbiedingen:
  - Bij prijs: kortingsacties
  - Bij inhoud: upgrades en extra content
  - Bij levering: premium service
  - Algemeen: flexibele voorwaarden
- Resultaat tracking (geaccepteerd/geweigerd)

## 🚀 Installatie & Gebruik

### Optie 1: Direct openen
1. Open `index.html` in een moderne browser
2. De interface werkt direct met demo data

### Optie 2: Met Live Server (aanbevolen)
1. Installeer een lokale webserver:
   - **VS Code**: Installeer "Live Server" extensie
   - **Python**: `python -m http.server 8000`
   - **Node.js**: `npx serve`

2. Open de applicatie via localhost

## 💾 Data Opslag

- **LocalStorage**: Alle data wordt lokaal opgeslagen in de browser
- **Demo Data**: Bij eerste gebruik wordt automatisch demo data geladen
- **Persistentie**: Wijzigingen blijven bewaard tussen sessies

### Demo Klanten
1. **Jan de Vries** - Amsterdam (1012AB, nr. 42)
   - Avrobode abonnement

2. **Maria Jansen** - Rotterdam (3011BD, nr. 15)
   - Mikrogids én Ncrvgids abonnement

3. **Pieter Bakker** - Den Haag (2511VA, nr. 88)
   - Avrobode abonnement

## 🎨 Interface Highlights

### Modern Design
- Clean, professioneel uiterlijk
- Responsief voor verschillende schermformaten
- Duidelijke visuele hiërarchie

### Drie-koloms Layout
- **Links**: Zoekfunctie en snelle acties
- **Midden**: Klantdetails en formulieren
- **Rechts**: Contact geschiedenis tijdlijn

### Gebruiksvriendelijk
- Intuïtieve navigatie
- Duidelijke call-to-action buttons
- Toast notificaties voor feedback
- Keyboard shortcuts (Esc, Ctrl+K)

## ⌨️ Sneltoetsen

- `Esc` - Sluit huidige formulier
- `Ctrl/Cmd + K` - Focus op zoekveld

## 🛠️ Technische Details

### Tech Stack
- **HTML5**: Semantische structuur
- **CSS3**: Modern styling met CSS variables
- **Vanilla JavaScript**: Geen frameworks, pure JS

### Browser Compatibiliteit
- Chrome/Edge (laatste 2 versies)
- Firefox (laatste 2 versies)
- Safari (laatste 2 versies)

### Responsive Breakpoints
- Desktop: > 1200px (3-koloms)
- Tablet: 768px - 1200px (aanpassingen)
- Mobile: < 768px (1-kolom stacked)

## 📝 Gebruik Scenario's

### Scenario 1: Nieuwe Klant Belt
1. Klik "Nieuw Abonnement"
2. Vul klantgegevens in tijdens gesprek
3. Selecteer gewenst magazine
4. Stel startdatum in
5. Bevestig → klant wordt aangemaakt met eerste contact

### Scenario 2: Magazine Niet Ontvangen
1. Zoek klant op naam/adres
2. Selecteer klant uit resultaten
3. Klik "Editie Verzenden"
4. Selecteer betreffend abonnement
5. Kies reden
6. Bevestig → actie wordt gelogd

### Scenario 3: Klant Wil Opzeggen
1. Open klantprofiel
2. Klik 🚫 bij betreffend abonnement
3. Winback flow start automatisch:
   - Vraag naar reden
   - Presenteer passend aanbod
   - Registreer resultaat
4. Bij acceptatie: abonnement blijft, aanbod wordt toegepast
5. Bij weigering: abonnement wordt beëindigd

### Scenario 4: Adreswijziging
1. Open klantprofiel
2. Klik "Bewerken"
3. Pas gegevens aan
4. Opslaan → wijziging wordt gelogd in historie

## 🎯 Verbeterpunten t.o.v. Huidige Interface

### Oude Interface Problemen
- ❌ Onoverzichtelijke layout
- ❌ Te veel informatie tegelijk
- ❌ Onduidelijke navigatie
- ❌ Verouderd design
- ❌ Geen duidelijke workflow

### Nieuwe Interface Verbeteringen
- ✅ Schone, gerichte interface per taak
- ✅ Duidelijke informatie hiërarchie
- ✅ Intuïtieve navigatie en acties
- ✅ Modern, professioneel design
- ✅ Gestructureerde workflows met scripts
- ✅ Visuele feedback op alle acties
- ✅ Efficiënte three-panel layout
- ✅ Sneltoetsen voor power users

## 🔮 Toekomstige Uitbreidingen

- [ ] Backend API integratie
- [ ] Authenticatie & autorisatie
- [ ] Betaalstatus en facturatie
- [ ] E-mail templates
- [ ] Rapportages en statistieken
- [ ] Export functionaliteit
- [ ] Geavanceerde filters
- [ ] Notificaties systeem
- [ ] Multi-language support

## 📄 Licentie

Dit is een Proof of Concept voor intern gebruik.

## 👥 Support

Voor vragen of suggesties, neem contact op met het development team.

---

**Laatst bijgewerkt**: Oktober 2024  
**Versie**: 1.0.0 (PoC)