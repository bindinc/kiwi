## Voorbeeld Werfsleutels & Barcodes

De UI leest automatisch alle werfsleutels uit `src/stores/onepager_werfsleutels.md`. Iedere rij in de onepager heeft een `offerId`; daar bouwen we een barcode van met het patroon `872` + `offerId` (laatste 10 cijfers, links opgevuld met nullen). Dankzij dit patroon komen barcodes altijd overeen met de brondata en hoeven we geen aparte overrides meer te beheren.

| Salescode | OfferId | Barcode        | Omschrijving                         | Beschikbare kanalen        |
|-----------|---------|----------------|--------------------------------------|---------------------------|
| AVRV525   | 573     | 8720000000573  | Ja, ik blijf bij Avrobode            | OL/IS, EM/OU, TM/IB, PR/ET |
| AVRV526   | 575     | 8720000000575  | Ja, ik blijf bij Avrobode (maandelijks) | OL/IS, EM/OU, TM/IB        |
| AVRV519   | 611     | 8720000000611  | 1 jaar Avrobode voor €52             | OL/IS, PR/ET               |
| AVRV520   | 612     | 8720000000612  | Ja, ik wil 1 jaar Avrobode           | OL/IS, PR/ET               |
| AVRV522   | 614     | 8720000000614  | Ja, ik wil 2 jaar Avrobode           | OL/IS, PR/ET               |

- Scan of typ een van de barcodes hierboven om de gecombineerde invoer te testen.
- Omdat de barcodes uit de onepager worden afgeleid, blijven ze automatisch up-to-date na een nieuwe export.
