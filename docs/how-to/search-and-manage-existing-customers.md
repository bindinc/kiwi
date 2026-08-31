# Bestaande klanten zoeken en beheren

## Wanneer Gebruik Je Dit

Gebruik deze werkwijze om een bestaande klant op te zoeken, het klantprofiel te openen en de beschikbare klant- en abonnementsgegevens te bekijken of te beheren.

## Benodigdheden

- Toegang tot Kiwi.
- Minimaal één bekend klantgegeven, zoals postcode en huisnummer, naam, klantnummer, e-mailadres, IBAN, geboortedatum of telefoonnummer.

## Stappen

### Een bestaande klant zoeken

1. Ga in het linkerpaneel naar **Klant Zoeken**.
2. Vul de bekende zoekgegevens in. Postcode en huisnummer staan direct in beeld. Open **Additionele filters** om te zoeken op naam, klantnummer, e-mailadres, IBAN, geboortedatum, telefoonnummer of mandant.
3. Kies eventueel een of meer mandanten om de zoekopdracht te beperken.
4. Selecteer **Zoeken** of druk in een zoekveld op Enter.
5. Controleer de resultaten in het middenpaneel. De lijst toont onder andere naam, adres, abonnementen en abonnee- of klantnummer.

### Een klant selecteren

1. Zoek de juiste klant in de resultatenlijst.
2. Selecteer de resultaatregel of kies **Bekijken**.
3. Controleer bovenaan het klantprofiel de naam, het adres, het e-mailadres en het telefoonnummer.
4. Bekijk de abonnementen en artikelen in het middenpaneel.
5. Bekijk de **Contact Geschiedenis** in het rechterpaneel.

De tekst **Selecteer een klant om geschiedenis te zien** betekent dus dat eerst via **Klant Zoeken** een resultaat moet worden geopend. Er is geen aparte klantselectie in het paneel **Contact Geschiedenis**.

### Klantgegevens beheren

1. Open de klant via de resultatenlijst.
2. Kies **Bewerken** in het klantprofiel.
3. Pas de benodigde klantgegevens of marketingvoorkeuren aan.
4. Sla het formulier op.
5. Controleer na het opslaan het bijgewerkte klantprofiel. Bij klanten die Kiwi zelf kan wijzigen, wordt de wijziging ook aan de contactgeschiedenis toegevoegd.

Andere beschikbare acties staan in het klantprofiel bij de klant en de abonnementen, bijvoorbeeld **Editie Verzenden**, **Klacht Redactie** en abonnementsacties. Welke acties beschikbaar zijn, hangt af van de bron en status van de klantgegevens.

## Verifiëren

- Na het kiezen van een resultaat is het zoekresultatenscherm vervangen door het klantprofiel.
- De geselecteerde naam en contactgegevens staan bovenaan het profiel.
- Het rechterpaneel toont de contactgeschiedenis of de melding **Geen contactgeschiedenis beschikbaar**.
- Na een ondersteunde wijziging toont Kiwi een bevestiging en worden de opgeslagen gegevens opnieuw geladen.

## Foutafhandeling

### Geen zoekresultaten

- **Symptoom:** er verschijnt geen resultatenlijst.
- **Controle:** controleer de spelling en verwijder filters die mogelijk te specifiek zijn, waaronder de mandantselectie.
- **Oplossing:** zoek opnieuw met minder gegevens of een ander bekend klantgegeven.

### Zoeken via de backend mislukt

- **Symptoom:** Kiwi toont de melding **Zoeken via backend mislukt**.
- **Controle:** controleer of Kiwi bereikbaar blijft en probeer dezelfde zoekopdracht nogmaals.
- **Oplossing:** meld de storing wanneer een nieuwe poging dezelfde fout geeft.

### Klantgegevens kunnen niet worden gewijzigd

- **Symptoom:** Kiwi meldt dat de klant Subscription API-detailgegevens gebruikt en daarom tijdelijk niet kan worden bewerkt.
- **Controle:** controleer de melding die na het kiezen van **Bewerken** verschijnt.
- **Oplossing:** behandel de gegevens in Kiwi als alleen-lezen. Gebruik voor een wijziging het daarvoor aangewezen bronsysteem.

### Geen contactgeschiedenis beschikbaar

- **Symptoom:** na het selecteren van een klant blijft **Geen contactgeschiedenis beschikbaar** zichtbaar.
- **Controle:** controleer of het klantprofiel wel is geopend. Klanten uit de Subscription API hebben in Kiwi momenteel geen beschikbare contactgeschiedenis.
- **Oplossing:** gebruik het daarvoor aangewezen bronsysteem wanneer historische contactmomenten nodig zijn.

## Bronnen voor deze werkwijze

- [Zoekformulier en klantprofiel](../../templates/base/index.html.twig)
- [Zoeken, resultaten tonen en een resultaat openen](../../assets/js/app/slices/customer-search-slice.js)
- [Klantdetails en abonnementen laden](../../assets/js/app/slices/customer-detail-slice.js)
- [Klantgegevens bewerken en beperkingen voor Subscription API-klanten](../../assets/js/app/slices/subscription-workflow-slice.js)
- [Contactgeschiedenis tonen](../../assets/js/app/slices/contact-history-slice.js)

## Metadata

- Doc type: howto
- Source repo paths:
  - /home/bartdeijkers/kiwi/templates/base/index.html.twig
  - /home/bartdeijkers/kiwi/assets/js/app/slices/customer-search-slice.js
  - /home/bartdeijkers/kiwi/assets/js/app/slices/customer-detail-slice.js
  - /home/bartdeijkers/kiwi/assets/js/app/slices/subscription-workflow-slice.js
  - /home/bartdeijkers/kiwi/assets/js/app/slices/contact-history-slice.js
- Last validated: 2026-08-31
- Owner: ICT Services
- Review cadence: quarterly
- Labels: bink8s, howto, layer-applications
