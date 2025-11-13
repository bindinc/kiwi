# Feedback

## Nieuw abonnement 
- [ ] Eerste invoerveld (bovenaan): Werfsleutel.
  - [ ] Barcode intypen; systeem valideert (bestaat/actief).
  - [ ] Kanaal en titel niet kiezen in UI: worden afgeleid uit de werfsleutel om fouten te voorkomen.
- [ ] Na Enter op werfsleutel (read-only weergave): getoonde titel, looptijd, actie; gebruiker bevestigt.
- [ ] Betaalmethode (stap 2): keuze Automatische incasso (IBAN) of Factuur (adres).
  - [ ] Optionele "tweede betaler" (bijv. bewindvoerder) ná keuze betaalmethode: klantnummer zoeken/aanmaken; niet verplicht.
- [ ] Marketingconsent: sectie met opt-ins standaard op leeg'.
- [ ] Persoonsgegevens verrijken: geboortedatum veld opnemen bij nieuwe abo; telefoon/e-mail, adres en andere gegevens kunnen hier geactualiseerd worden.
- [ ] Startdatumkalender: alleen toegestane startdata klikbaar (bijv. tweewekelijks; geen te vroege data); duidelijk visueel onderscheid.

## Bevestiging & proceslogica
- [ ] Bevestigingspaneel standaard uitgeklapt na "Aanmaken", met duidelijke melding "gelukt".
- [ ] Contactgeschiedenis/actieve abonnementen: nieuwe mutatie bovenaan en opvallend gemarkeerd (tijdelijk highlight).
- [ ] Flow-uitzondering aan de bron: bij aanmaken kun je "proces/confirmatie niet starten" aanvinken (exception).
- [ ] 5-minuten bedenktijd: na bevestigen 5 minuten om zonder database-commit nog te wijzigen/annuleren; daarna definitief (latere wijzigingen via standaard Abel route blijft mogelijk).

## Opzeggen (opzegflow)
- [ ] Zoek & selecteer: zelfde zoekscherm als bij aanmaken.
- [ ] Stap 1 - Reden: lijst gesorteerd op populariteit; "Anders" klapt uit voor toelichting. "Overlijden" aanwezig.
- [ ] Stap 2 - Memo: memo-veld verplicht zichtbaar na reden (voor context zoals overstap),
  - [ ] Uitzondering: bij Overlijden (en mogelijk Verpleeghuis) geen memo tonen; ook geen winback.
- [ ] Te tonen abonnementen: alle actieve betaalde lidmaatschappen + gidsabonnementen; kosteloze lidmaatschappen stoppen automatisch.
- [ ] Overlijden-logica: restitutie automatisch bepaald door systeem op basis van betalingen; géén gebruikerskeuze tonen.
- [ ] Overzetten op andere persoon (aparte stopreden):
  - [ ] Looptijd blijft doorlopen bij overname,
  - [ ] Geboortedatum van nieuwe ontvanger vastleggen,
  - [ ] Betaalmethode/IBAN kunnen wijzigen (bijv. dochter gaat zelf betalen).
- [ ] Bevestigingsmail bij restitutie: aparte e-mail voor bevestiging in te voeren (wordt als extra e-mail opgeslagen; bestaande e-mail niet overschrijven).

UI/feedback & volgorde
- [ ] Nieuwe/gewijzigde items krijgen tijdelijke highlight;
- [ ] Procesregels zichtbaar; geen overbodige knoppen—simpel basis-ontwerp, later verfijnbaar.

Scope & planning
- [ ] Eerste iteratie focust op verwerking van mail en bonnetjes (geen telefonie/winback/klachtroute nu).
- [ ] Volgende stappen: tweewekelijks afstemmen met leverancier (HUP) en geüpdatete mock-ups laten zien voor visuele check.

