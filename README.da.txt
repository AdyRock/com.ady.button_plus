Kontrolknap + paneler

Appen understøtter knappen + hardware.

Sådan konfigurerer du appen:

3. Installer appen på din Homey. 
4. Åbn knappen Knap + App-indstillinger / Konfigurationssiden i Homey.
5. Sørg for, at Tillad opdatering af Button+-konfiguration er afkrydset.

Der er to typer konfigurationer, knaplinje og display, og hver har i øjeblikket 20 pladser.
Knaplinjekonfigurationerne vises, når den første dropliste viser knaplinjekonfigurationer, og Displaykonfigurationerne vises ved at ændre droplisten til Display Configurations.

Opsætning af knaplinjekonfigurationer:

1. Vælg knaplinjekonfigurationer fra den første dropliste.
2. Vælg et konfigurationsnummer, der skal redigeres (vi kan tildele enhver af konfigurationerne til Button+ Panels senere).
3. Under venstre knaplinje er mulighederne for knappen i venstre side af knap+ knaplinjen.
4. Vælg en Homey-enhed, som du vil styre fra droplisten (panelerne understøtter kun booleske funktioner, men filtrering af listerne skal stadig implementeres)
5. Vælg en funktion på rullelisten.
6. Indtast en Top Label (valgfrit). Dette vises med grønt på knappernes display.
7. Indtast en etiket. Dette er vist i hvidt og en større skrifttype på knappernes display lige under topteksten.
8. Gentag trinene for højre knaplinje.
9. Klik på knappen Gem konfigurationer. Stadig at gøre er at tilføje en prompt, hvis du glemmer at gemme og lukke vinduet.

Opsætning af skærmkonfigurationer:

1. Vælg skærmkonfigurationer fra den første dropliste.
2. Vælg et konfigurationsnummer, der skal redigeres (vi kan tildele enhver af konfigurationerne til Button+ Display senere).
3. Klik på Nyt displayelement.
4. Vælg en enhed eller "variabel"
5. Vælg en funktion eller en variabel.
6. Rediger etiketten, hvis det er nødvendigt.
7. Rediger enhederne om nødvendigt. (dette er kun tekst og ændrer ikke de værdier, der sendes til displayet).
8. Indtast X- og Y-positionerne. Disse er en procentdel af displayets bredde/højde.
9. Indtast en bredde. Igen er dette en procentdel af skærmbredden.
10. Indtast en afrundingsværdi. 0 = hele tal (heltal), 1 er 1 decimal osv.
11. Vælg en skriftstørrelse på listen.
12. Tilføj flere displayelementer efter behov.
13. Klik på Gem konfigurationer.

Tilføjelse af en enhed til Homey:

1. Vælg indstillingen Ny enhed i Homey.
2. Vælg knap-knaplinje.
3. Klik på Connect.
4. Du bør derefter se enheden på listen, så vælg den og fortsæt. (Appen bruger i øjeblikket navnet fundet under de generelle indstillinger til at identificere knaplinjen). Hvis knappen + ikke findes, kan du prøve at tilføje den manuelt ved at vælge indstillingen Manuel og indtaste IP-adressen.
5. Enheden føjes til Homey.

Brug af Homey-enheden:

1. Åbn enheden i Homey.
2. Åbn den anden fane for at se en liste over konfigurationer for skærmen og hvert stik.
3. Vælg Display- eller Connector-nummeret fra den øverste dropliste (Homey trækker i øjeblikket Konfigurationslisten over droplisten, så det kan være en smerte at vælge, hvad du ønsker).
4. Vælg et konfigurationsnummer, der skal anvendes på stikket Display / knaplinje.
5. Konfigurationen uploades til simulatoren, men du skal opdatere simulatoren for at få den til at træde i kraft. Der er en knap til højre for det virtuelle id for at opdatere siden.
6. Du bør nu se de oplysninger, du valgte i konfigurationen, vist på knaplinjen.
7. Du kan klikke på knapperne i miniskærmene for at skifte mellem funktionerne i Homey.

Appen har en indbygget MQTT-mægler, så der kræves ingen opsætning til det. Det er dog muligt at tilføje en eller flere eksterne MQTT-mæglere på siden med appindstillinger.
