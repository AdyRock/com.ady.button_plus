Button +

Gør dit Homey setup til et smartere og mere ryddeligt kontrolcenter for de ting, du bruger hver dag.

Button + gør det nemt at bygge tilpassede fysiske kontrolpaneler, som føles som et smart home dashboard i premiumklassen i stedet for et rod af kontakter og sider. Med et Button + panel kan du samle de styringer, du faktisk bruger, ét sted, vise live status med et enkelt blik og få dit hjem til at føles mere gennemført og intuitivt.

Hvorfor Button + er det værd

1. Styring med ét tryk af dine vigtigste enheder og scener.
2. Hurtig visuel feedback med tilpassede etiketter, statustekst og live visningsværdier.
3. En renere vægmonteret smart home oplevelse uden at skulle grave i menuer.
4. Fleksible layouts til knapper, displays og grupperede paneler.
5. Hurtigere daglig brug til rutiner som belysning, klima, sikkerhed og medier.
6. Et moderne, tilpasningsvenligt udseende, der passer ind i dit hjem og din hardwareopsætning.

Hurtig opsætning

1. Installer appen på din Homey.
2. Åbn siden Button + App settings / Configuration i Homey.

Der er tre vigtigste konfigurationsområder i appen.

1. Button bar configurations.
2. Display configurations.
3. Group configurations.

Hvert konfigurationsområde har et sæt pladser til at opbygge dine panellayouts. Konfigurationerne for button bar bruges til kontrolknapperne, displaykonfigurationerne bruges til paneldisplayet, og gruppekonfigurationerne lader dig samle dem i en komplet Button + panelopsætning.

Opsætning af button bar configurations

1. Vælg Button bar Configurations i den første rullemenu.
2. Vælg et konfigurationsnummer, der skal redigeres. Dette nummer kan senere tildeles et Button+ panel.
3. Under Left button bar finder du mulighederne for knappen på venstre side af Button+ button bar.
4. Vælg en Homey enhed, som du vil styre, fra rullemenuen. Panelerne understøtter boolean capabilities, selv om filtreringen stadig bliver forbedret.
5. Vælg en capability fra rullemenuen.
6. Indtast en Top Label, hvis du ønsker det. Den vises i grønt på knappens display.
7. Indtast en Label. Den vises i hvidt og med større skrift på knappens display lige under Top Text.
8. Gentag trinnene for Right button bar.
9. Klik på knappen Save Configurations.

Opsætning af display configurations

1. Vælg Display Configurations i den første rullemenu.
2. Vælg et konfigurationsnummer, der skal redigeres. Dette kan senere tildeles et Button+ display.
3. Klik på New Display Item.
4. Vælg en Device.
5. Vælg en Capability.
6. Rediger Label, hvis det er nødvendigt.
7. Rediger Units, hvis det er nødvendigt. Dette er kun tekst og ændrer ikke de værdier, der sendes til displayet.
8. Indtast positionerne X og Y. De er procentdele af displayets bredde og højde.
9. Indtast en bredde. Det er igen en procentdel af displayets bredde.
10. Indtast en Rounding værdi. 0 betyder hele tal, 1 betyder 1 decimal, og så videre.
11. Vælg en Font Size fra listen.
12. Tilføj flere displayelementer efter behov.
13. Klik på Save Configurations.

Opsætning af grupper

Grupper er den nemmeste måde at definere et komplet fysisk Button + panel på. En gruppe repræsenterer ét færdigt panellayout og kan kombinere:

1. én displaykonfiguration.
2. én eller flere button bar eller connector konfigurationer.
3. et brugerdefineret navn til panelet.

Sådan opsætter du en gruppe:

1. Åbn fanen Group Configurations i appindstillingerne.
2. Vælg en eksisterende gruppe, eller klik på knappen + for at oprette en ny.
3. Giv gruppen et navn som Stuepanel eller Panel i hovedgangen.
4. Vælg den displaykonfiguration, der skal tildeles gruppen.
5. Tildel gruppen én eller flere connector eller button konfigurationer.
6. Brug forhåndsvisningsområdet til at gennemgå det fulde panellayout, før du gemmer.
7. Dupliker eller slet grupper efter behov, hvis du vil have flere panellayouts.

Dette er nyttigt, når du vil have forskellige fysiske paneler i forskellige rum eller til forskellige formål, mens du genbruger de samme forhåndsindstillinger for display og knapper.

Tilføjelse af en enhed til Homey

1. Vælg indstillingen New Device i Homey.
2. Vælg Button button bar.
3. Klik på Connect.
4. Du bør derefter se enheden på listen, så vælg den og fortsæt. Appen bruger i øjeblikket Name under General settings til at identificere button bar. Hvis Button + ikke findes, kan du prøve at tilføje den manuelt ved at vælge indstillingen Manual og indtaste IP adressen.
5. Enheden bliver tilføjet til Homey.

Brug af Homey enheden

1. Åbn enheden i Homey.
2. Åbn den anden fane for at se en liste over konfigurationer for displayet og hver connector.
3. Vælg Display eller et Connector nummer fra den øverste rullemenu. Homey tegner i øjeblikket listen Configuration oven på rullemenuen, så det kan være besværligt at vælge det, du vil have.
4. Vælg et Configuration nummer, der skal anvendes på Display eller button bar connector.
5. Konfigurationen uploades til simulatoren, men du skal opdatere simulatoren, før den træder i kraft. Der er en knap til højre for Virtual Id til at opdatere siden.
6. Du bør nu se de oplysninger, du valgte i konfigurationen, vist på button bar.
7. Du kan klikke på knapperne i mini displays for at skifte capability i Homey.

Appen har en indbygget MQTT broker, så der kræves ingen opsætning til det. Det er dog muligt at tilføje en eller flere eksterne MQTT brokers på appens indstillingsside.
