# Feedback

## Nieuw abonnement 
- [ ] 1 Eerste invoerveld (bovenaan): Werfsleutel zoek/keuze veld (alleen salescode en omschrijving + prijs per werfsleutel laten zien)
  - [ ] 1.1 Barcode intypen; systeem valideert (bestaat/actief). voorbeeld barcodes documenteren in de /docs folder.
  - [ ] 1.2 Kanaal keuze in UI (mag met duidelijke icons ipv tekst, mits bij mouseover de kanaal uitgeschreven zichtbaar wordt in een tooltip): 
            OL/IS/** = online interne sites. 
            EM/OU/** = e-mail outbound.
            TM/IB/** = telemarketing inbound.
            PR/ET/** = Print eigen titels.

- [ ] 2 Na Enter op werfsleutel (of knop 'bevestigen' rechts naast werfsleutel invoerveld)  dan de read-only overzicht modal en knop eronder om definitief te bevestigen: getoonde titel, looptijd, actie; gebruiker bevestigt.
- [ ] 3 Betaalmethode is stap 2 (nog voor naw gegevens invulvelden): keuze Automatische incasso (IBAN) of Factuur (adres).
  - [ ] 3.1 Optionele "tweede betaler" (bijv. bewindvoerder) ná keuze betaalmethode: klantnummer zoeken/aanmaken; niet verplicht. de tweede betaler krijgt ook een apart klantnummer
- [ ] 4 Marketingconsent: sectie met opt-ins standaard op leeg als geen bestaand profiel is ingeladen.
- [ ] 5 Persoonsgegevens verrijken: geboortedatum veld opnemen bij nieuwe abo; telefoon/e-mail, adres en andere gegevens kunnen hier geactualiseerd worden.
- [ ] 6 Startdatumkalender: alleen toegestane startdata klikbaar (bijv. tweewekelijks; geen te vroege data); duidelijk visueel onderscheid.

## Bevestiging & proceslogica
- [ ] 8 Bevestigingspaneel standaard uitgeklapt na "Aanmaken", met duidelijke melding "gelukt".
- [ ] 9 Contactgeschiedenis/actieve abonnementen: nieuwe mutatie bovenaan en opvallend gemarkeerd (tijdelijk highlight).
- [ ] 10 Flow-uitzondering aan de bron: bij aanmaken kun je "proces/confirmatie niet starten" aanvinken (exception).
- [ ] 11 5-minuten bedenktijd: na bevestigen 5 minuten om zonder database-commit nog te wijzigen/annuleren; daarna definitief (latere wijzigingen via standaard Abel route blijft mogelijk).

## Opzeggen (opzegflow)
- [ ] 12 Zoek & selecteer: zelfde zoekscherm als bij aanmaken.
- [ ] 13 Stap 1 - Reden: lijst gesorteerd op populariteit; "Anders" klapt uit voor toelichting. "Overlijden" aanwezig.
- [ ] 14 Stap 2 - Memo: memo-veld verplicht zichtbaar na reden (voor context zoals overstap),
  - [ ] 15 Uitzondering: bij Overlijden (en mogelijk Verpleeghuis) geen memo tonen; ook geen winback.
- [ ] 16 Te tonen abonnementen: alle actieve betaalde lidmaatschappen + gidsabonnementen; kosteloze lidmaatschappen stoppen automatisch.
- [ ] 17 Overlijden-logica: restitutie automatisch bepaald door systeem op basis van betalingen; géén gebruikerskeuze tonen.
- [ ] 18 Overzetten op andere persoon (aparte stopreden):
  - [ ] 18.1 Looptijd blijft doorlopen bij overname,
  - [ ] 18.2 Geboortedatum van nieuwe ontvanger vastleggen,
  - [ ] 18.3 Betaalmethode/IBAN kunnen wijzigen (bijv. dochter gaat zelf betalen).
- [ ] 19 Bevestigingsmail bij restitutie: aparte e-mail voor bevestiging in te voeren (wordt als extra e-mail opgeslagen; bestaande e-mail niet overschrijven).

UI/feedback & volgorde
- [ ] 20 Nieuwe/gewijzigde items krijgen tijdelijke highlight;
- [ ] 21 Procesregels zichtbaar; geen overbodige knoppen—simpel basis-ontwerp, later verfijnbaar.

Scope & planning
- [ ] 22 Eerste iteratie focust op verwerking van mail en bonnetjes (geen telefonie/winback/klachtroute nu).
- [ ] 23 Volgende stappen: tweewekelijks afstemmen met leverancier (HUP) en geüpdatete mock-ups laten zien voor visuele check.
