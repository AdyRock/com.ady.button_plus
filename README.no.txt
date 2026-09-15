Button +

Gjør Homey oppsettet ditt til et smartere og ryddigere kontrollsenter for tingene du bruker hver dag.

Button + gjør det enkelt å bygge tilpassede fysiske kontrollpaneler som føles som et smart home dashboard i premiumklassen i stedet for en samling av brytere og sider. Med et Button + panel kan du samle kontrollene du faktisk bruker på ett sted, vise live status med et blikk og få hjemmet ditt til å føles mer gjennomført og intuitivt.

Hvorfor Button + er verdt det

1. Styring med ett trykk for de viktigste enhetene og scenene dine.
2. Rask visuell tilbakemelding med tilpassede etiketter, statustekst og live visningsverdier.
3. En ryddigere veggmontert smart home opplevelse uten å måtte lete gjennom menyer.
4. Fleksible oppsett for knapper, displayer og grupperte paneler.
5. Raskere daglig bruk for rutiner som belysning, klima, sikkerhet og media.
6. Et moderne og tilpassbart utseende som passer inn i hjemmet og maskinvareoppsettet ditt.

Rask oppsett

1. Installer appen på Homey.
2. Åpne siden Button + App settings / Configuration i Homey.

Det finnes tre hovedområder for konfigurasjon i appen.

1. Button bar configurations.
2. Display configurations.
3. Group configurations.

Hvert konfigurasjonsområde har et sett med spor for å bygge paneloppsettene dine. Konfigurasjonene for button bar brukes til kontrollknappene, displaykonfigurasjonene brukes til paneldisplayet, og gruppekonfigurasjonene lar deg kombinere dem til et komplett Button + paneloppsett.

Sette opp button bar configurations

1. Velg Button bar Configurations fra den første nedtrekkslisten.
2. Velg et konfigurasjonsnummer som skal redigeres. Dette nummeret kan senere tildeles et Button+ panel.
3. Under Left button bar finner du alternativene for knappen på venstre side av Button+ button bar.
4. Velg en Homey enhet som du vil styre fra nedtrekkslisten. Panelene støtter boolean capabilities, selv om filtreringen fortsatt forbedres.
5. Velg en capability fra nedtrekkslisten.
6. Angi en Top Label hvis du ønsker det. Denne vises i grønt på knappedisplayet.
7. Angi en Label. Denne vises i hvitt og med større skrift på knappedisplayet, rett under Top Text.
8. Gjenta trinnene for Right button bar.
9. Klikk på knappen Save Configurations.

Sette opp display configurations

1. Velg Display Configurations fra den første nedtrekkslisten.
2. Velg et konfigurasjonsnummer som skal redigeres. Dette kan senere tildeles et Button+ display.
3. Klikk på New Display Item.
4. Velg en Device.
5. Velg en Capability.
6. Rediger Label ved behov.
7. Rediger Units ved behov. Dette er bare tekst og endrer ikke verdiene som sendes til displayet.
8. Angi X og Y posisjonene. Disse er prosentandeler av displayets bredde og høyde.
9. Angi en bredde. Dette er også en prosentandel av displayets bredde.
10. Angi en Rounding verdi. 0 betyr hele tall, 1 betyr 1 desimal og så videre.
11. Velg en Font Size fra listen.
12. Legg til flere displayelementer ved behov.
13. Klikk på Save Configurations.

Sette opp grupper

Grupper er den enkleste måten å definere et komplett fysisk Button + panel på. En gruppe representerer ett ferdig paneloppsett og kan kombinere:

1. én displaykonfigurasjon.
2. én eller flere button bar eller connector konfigurasjoner.
3. et tilpasset navn på panelet.

Slik setter du opp en gruppe:

1. Åpne fanen Group Configurations i appinnstillingene.
2. Velg en eksisterende gruppe eller klikk på knappen + for å opprette en ny.
3. Gi gruppen et navn som Stuepanel eller Panel i hovedgangen.
4. Velg displaykonfigurasjonen som skal tildeles gruppen.
5. Tildel én eller flere connector eller button konfigurasjoner til gruppen.
6. Bruk forhåndsvisningsområdet til å se gjennom hele paneloppsettet før du lagrer.
7. Dupliser eller slett grupper etter behov hvis du ønsker flere paneloppsett.

Dette er nyttig når du vil ha ulike fysiske paneler i forskjellige rom eller til forskjellige formål, samtidig som du gjenbruker de samme forhåndsinnstillingene for display og knapper.

Legge til en enhet i Homey

1. Velg alternativet New Device i Homey.
2. Velg Button button bar.
3. Klikk på Connect.
4. Deretter skal du se enheten i listen, så velg den og fortsett. Appen bruker for øyeblikket Name under General settings for å identifisere button bar. Hvis Button + ikke blir funnet, kan du prøve å legge den til manuelt ved å velge alternativet Manual og skrive inn IP adressen.
5. Enheten blir lagt til i Homey.

Bruke Homey enheten

1. Åpne enheten i Homey.
2. Åpne den andre fanen for å vise en liste over konfigurasjoner for displayet og hver connector.
3. Velg Display eller et Connector nummer fra den øverste nedtrekkslisten. Homey tegner for øyeblikket listen Configuration over nedtrekkslisten, så det kan være tungvint å velge det du vil ha.
4. Velg et Configuration nummer som skal brukes på Display eller button bar connector.
5. Konfigurasjonen lastes opp til simulatoren, men du må oppdatere simulatoren for at den skal tre i kraft. Det finnes en knapp til høyre for Virtual Id for å oppdatere siden.
6. Du skal nå se informasjonen du valgte i konfigurasjonen vist på button bar.
7. Du kan klikke på knappene i mini displays for å slå capability i Homey av eller på.

Appen har en innebygd MQTT broker, så det kreves ikke noe oppsett for dette. Det er imidlertid mulig å legge til én eller flere eksterne MQTT brokers på siden for appinnstillinger.
