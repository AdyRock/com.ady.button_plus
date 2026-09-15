Kontrollknapp + paneler

Appen støtter knapp + maskinvare.

For å konfigurere appen:

3. Installer appen på din Homey.
4. Åpne Button + App Settings / Configuration-siden i Homey.
5. Sørg for at Tillat oppdatering av Button+-konfigurasjon er merket av.

Det er to typer konfigurasjoner, knappelinje og skjerm, og hver har for øyeblikket 20 spor.
Knappelinjekonfigurasjonene vises når den første slipplisten viser knappelinjekonfigurasjoner og skjermkonfigurasjonene vises ved å endre droplisten til Skjermkonfigurasjoner.

Sette opp knappelinjekonfigurasjoner:

1. Velg knappelinjekonfigurasjoner fra den første drop-listen.
2. Velg et konfigurasjonsnummer som skal redigeres (vi kan tilordne hvilken som helst av konfigurasjonene til Button+ Panels senere).
3. Under venstre knappelinje er alternativene for knappen på venstre side av Button+-knappelinjen.
4. Velg en Homey-enhet som du vil kontrollere fra drop-listen (panelene støtter kun boolske funksjoner, men filtrering av listene skal fortsatt implementeres)
5. Velg en funksjon fra rullelisten.
6. Angi en toppetikett (valgfritt). Dette vises i grønt på knappeskjermen.
7. Skriv inn en etikett. Dette vises i hvitt og en større skrift på knappeskjermen, rett under toppteksten.
8. Gjenta trinnene for høyre knappelinje.
9. Klikk på knappen Lagre konfigurasjoner. Fortsatt å gjøre er å legge til en melding hvis du glemmer å lagre og lukke vinduet.

Sette opp skjermkonfigurasjoner:

1. Velg Skjermkonfigurasjoner fra den første drop-listen.
2. Velg et konfigurasjonsnummer å redigere (vi kan tilordne alle konfigurasjonene til Button+ Display senere).
3. Klikk på Nytt visningselement.
4. Velg en enhet eller "variabel"
5. Velg en funksjon eller variabel.
6. Rediger etiketten om nødvendig.
7. Rediger enhetene om nødvendig. (dette er kun tekst og endrer ikke verdiene som sendes til displayet).
8. Angi X- og Y-posisjonene. Disse er en prosentandel av skjermbredden/høyden.
9. Angi en bredde. Igjen er dette en prosentandel av skjermbredden.
10. Angi en avrundingsverdi. 0 = hele tall (heltall), 1 er 1 desimal osv.
11. Velg en skriftstørrelse fra listen.
12. Legg til flere visningselementer etter behov.
13. Klikk på Lagre konfigurasjoner.

Legge til en enhet i Homey:

1. Velg alternativet Ny enhet i Homey.
2. Velg knappelinje.
3. Klikk på Koble til.
4. Du skal da se enheten oppført, så velg den og fortsett. (Appen bruker for øyeblikket navnet som finnes under de generelle innstillingene for å identifisere knappelinjen). Hvis knappen + ikke finnes, kan du prøve å legge den til manuelt ved å velge alternativet Manuell og angi IP-adressen.
5. Enheten vil bli lagt til Homey.

Bruke Homey-enheten:

1. Åpne enheten i Homey.
2. Åpne den andre kategorien for å vise en liste over konfigurasjoner for skjermen og hver kobling.
3. Velg skjermnummeret eller et koblingsnummer fra den øverste droplisten (Homey trekker for øyeblikket konfigurasjonslisten over droplisten, så det kan være vanskelig å velge hva du vil ha).
4. Velg et konfigurasjonsnummer som skal brukes på skjerm- / knappelinjekontakten.
5. Konfigurasjonen lastes opp til simulatoren, men du må oppdatere simulatoren for å få den til å tre i kraft. Det er en knapp til høyre for den virtuelle ID-en for å oppdatere siden.
6. Du skal nå se informasjonen du valgte i konfigurasjonen vist på knappelinjen.
7. Du kan klikke på knappene i miniskjermene for å veksle mellom funksjonen i Homey.

Appen har en innebygd MQTT-megler, så det kreves ingen oppsett for det. Det er imidlertid mulig å legge til en eller flere eksterne MQTT-meglere på siden for appinnstillinger.
