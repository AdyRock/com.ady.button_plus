Button +

Maak van je Homey installatie een slimmer en netter bedieningscentrum voor de dingen die je elke dag gebruikt.

Met Button + kun je eenvoudig aangepaste fysieke bedieningspanelen maken die aanvoelen als een premium smart home dashboard in plaats van een wirwar van schakelaars en pagina's. Met een Button + paneel kun je de bediening die je echt gebruikt op één plek zetten, in één oogopslag de live status tonen en je huis verfijnder en intuïtiever laten aanvoelen.

Waarom Button + de moeite waard is

1. Bediening met één aanraking voor je belangrijkste apparaten en scènes.
2. Snelle visuele feedback met aangepaste labels, statustekst en live weergavewaarden.
3. Een nettere smart home ervaring aan de muur zonder door menu's te hoeven gaan.
4. Flexibele indelingen voor knoppen, displays en gegroepeerde panelen.
5. Sneller dagelijks gebruik voor routines zoals verlichting, klimaat, beveiliging en media.
6. Een moderne, aanpasbare uitstraling die past bij je huis en hardwareopstelling.

Snelle installatie

1. Installeer de app op je Homey.
2. Open de pagina Button + App settings / Configuration in Homey.

Er zijn drie hoofdgebieden voor configuratie in de app.

1. Button bar configurations.
2. Display configurations.
3. Group configurations.

Elk configuratiegebied heeft een reeks slots om je paneelindelingen op te bouwen. De configuraties voor de button bar worden gebruikt voor de bedieningsknoppen, de displayconfiguraties worden gebruikt voor het display van het paneel en met de groepsconfiguraties kun je die combineren tot een volledige Button + paneelopstelling.

Button bar configuraties instellen

1. Selecteer Button bar Configurations in de eerste keuzelijst.
2. Selecteer een configuratienummer om te bewerken. Dit nummer kan later aan een Button+ paneel worden toegewezen.
3. Onder Left button bar staan de opties voor de knop aan de linkerkant van de Button+ button bar.
4. Selecteer in de keuzelijst een Homey apparaat dat je wilt bedienen. De panelen ondersteunen boolean capabilities, hoewel het filteren nog wordt verbeterd.
5. Selecteer een capability in de keuzelijst.
6. Voer desgewenst een Top Label in. Dit wordt groen weergegeven op het display van de knop.
7. Voer een Label in. Dit wordt wit en in een groter lettertype weergegeven op het display van de knop, net onder de Top Text.
8. Herhaal de stappen voor de Right button bar.
9. Klik op de knop Save Configurations.

Display configuraties instellen

1. Selecteer Display Configurations in de eerste keuzelijst.
2. Selecteer een configuratienummer om te bewerken. Dit kan later aan een Button+ display worden toegewezen.
3. Klik op New Display Item.
4. Selecteer een Device.
5. Selecteer een Capability.
6. Bewerk de Label indien nodig.
7. Bewerk de Units indien nodig. Dit is alleen tekst en verandert de waarden die naar het display worden verzonden niet.
8. Voer de X en Y posities in. Dit zijn percentages van de breedte en hoogte van het display.
9. Voer een breedte in. Ook dit is een percentage van de breedte van het display.
10. Voer een Rounding waarde in. 0 betekent hele getallen, 1 betekent 1 decimaal, enzovoort.
11. Selecteer een Font Size in de lijst.
12. Voeg meer displayitems toe indien nodig.
13. Klik op Save Configurations.

Groepen instellen

Groepen zijn de eenvoudigste manier om een compleet fysiek Button + paneel te definiëren. Een groep vertegenwoordigt één afgewerkte paneelindeling en kan het volgende combineren:

1. één displayconfiguratie.
2. één of meer button bar of connector configuraties.
3. een aangepaste naam voor het paneel.

Zo stel je een groep in:

1. Open het tabblad Group Configurations in de app instellingen.
2. Selecteer een bestaande groep of klik op de knop + om een nieuwe groep te maken.
3. Geef de groep een naam zoals Woonkamerpaneel of Paneel Hoofdgang.
4. Kies de displayconfiguratie die je aan die groep wilt toewijzen.
5. Wijs een of meer connector of button configuraties toe aan de groep.
6. Gebruik het voorbeeldgebied om de volledige paneelindeling te bekijken voordat je opslaat.
7. Dupliceer of verwijder groepen indien nodig als je meerdere paneelindelingen wilt.

Dit is handig als je verschillende fysieke panelen in verschillende kamers of voor verschillende doeleinden wilt gebruiken terwijl je dezelfde display en button presets hergebruikt.

Een apparaat toevoegen aan Homey

1. Selecteer in Homey de optie New Device.
2. Selecteer Button button bar.
3. Klik op Connect.
4. Je zou het apparaat dan in de lijst moeten zien. Selecteer het en ga verder. De app gebruikt momenteel de Name onder General settings om de button bar te identificeren. Als de Button + niet wordt gevonden, kun je proberen deze handmatig toe te voegen door de optie Manual te selecteren en het IP adres in te voeren.
5. Het apparaat wordt toegevoegd aan Homey.

Het Homey apparaat gebruiken

1. Open het apparaat in Homey.
2. Open het tweede tabblad om een lijst met configuraties voor het display en elke connector te bekijken.
3. Selecteer het Display of een Connector nummer in de bovenste keuzelijst. Homey tekent momenteel de lijst Configuration over de keuzelijst heen, waardoor het lastig kan zijn om te selecteren wat je wilt.
4. Selecteer een Configuration nummer om toe te passen op de Display of button bar connector.
5. De configuratie wordt naar de simulator geüpload, maar je moet de simulator vernieuwen voordat deze effect heeft. Rechts van de Virtual Id staat een knop om de pagina te vernieuwen.
6. Je zou nu de informatie die je in de configuratie hebt geselecteerd op de button bar moeten zien.
7. Je kunt op de knoppen in de mini displays klikken om de capability in Homey te schakelen.

De app heeft een ingebouwde MQTT broker, dus daarvoor is geen configuratie nodig. Het is echter mogelijk om op de app instellingenpagina een of meer externe MQTT brokers toe te voegen.
