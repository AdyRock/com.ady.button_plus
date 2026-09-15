Bedien Button+-panelen

De app ondersteunt de Button+-hardware.

De app instellen:

3. Installeer de app op je Homey.
4. Open in Homey de pagina Instellingen / Configuratie van de Button+-app.
5. Zorg dat Bijwerken van de Button+-configuratie toestaan is aangevinkt.

Er zijn twee soorten configuraties, Knoppenbalk en Display, die momenteel elk 20 plaatsen hebben.
De knoppenbalkconfiguraties worden weergegeven wanneer in de eerste keuzelijst Knoppenbalkconfiguraties is geselecteerd. Selecteer Displayconfiguraties in de keuzelijst om de displayconfiguraties weer te geven.

Knoppenbalkconfiguraties instellen:

1. Selecteer Knoppenbalkconfiguraties in de eerste keuzelijst.
2. Selecteer een configuratienummer om te bewerken (we kunnen elk van de configuraties later aan Button+-panelen toewijzen).
3. Onder Linkerknoppenbalk staan de opties voor de knop aan de linkerkant van de Button+-knoppenbalk.
4. Selecteer in de keuzelijst een Homey-apparaat dat je wilt bedienen (de panelen ondersteunen alleen booleaanse mogelijkheden, maar het filteren van de lijsten moet nog worden geïmplementeerd).
5. Selecteer een mogelijkheid in de keuzelijst.
6. Voer een bovenste label in (optioneel). Dit wordt groen weergegeven op het display van de knoppen.
7. Voer een label in. Dit wordt wit en met een groter lettertype weergegeven op het display van de knoppen, direct onder de bovenste tekst.
8. Herhaal de stappen voor de rechterknoppenbalk.
9. Klik op de knop Configuraties opslaan. Er moet nog een melding worden toegevoegd voor als je vergeet op te slaan en het venster sluit.

Displayconfiguraties instellen:

1. Selecteer Displayconfiguraties in de eerste keuzelijst.
2. Selecteer een configuratienummer om te bewerken (we kunnen elk van de configuraties later aan het Button+-display toewijzen).
3. Klik op Nieuw display-item.
4. Selecteer een apparaat of "Variabele".
5. Selecteer een mogelijkheid of variabele.
6. Bewerk zo nodig het label.
7. Bewerk zo nodig de eenheden. (Dit is alleen tekst en verandert de waarden die naar het display worden verzonden niet.)
8. Voer de X- en Y-posities in. Dit zijn percentages van de breedte / hoogte van het display.
9. Voer een breedte in. Ook dit is een percentage van de breedte van het display.
10. Voer een afrondingswaarde in. 0 = gehele getallen (integer), 1 is 1 decimaal, enzovoort.
11. Selecteer een lettergrootte in de lijst.
12. Voeg naar wens meer display-items toe.
13. Klik op Configuraties opslaan.

Een apparaat aan Homey toevoegen:

1. Selecteer de optie Nieuw apparaat in Homey.
2. Selecteer Button-knoppenbalk.
3. Klik op Verbinden.
4. Het apparaat wordt nu in de lijst weergegeven. Selecteer het en ga verder. (De app gebruikt momenteel de naam onder de algemene instellingen om de knoppenbalk te identificeren.) Als de Button+ niet wordt gevonden, kun je deze handmatig toevoegen door de optie Handmatig te selecteren en het IP-adres in te voeren.
5. Het apparaat wordt aan Homey toegevoegd.

Het Homey-apparaat gebruiken:

1. Open het apparaat in Homey.
2. Open het tweede tabblad om een lijst met configuraties voor het display en elke connector te bekijken.
3. Selecteer het display of een connectornummer in de bovenste keuzelijst (Homey tekent de configuratielijst momenteel over de keuzelijst heen, waardoor het lastig kan zijn om de gewenste optie te selecteren).
4. Selecteer een configuratienummer om toe te passen op het display / de knoppenbalkconnector.
5. De configuratie wordt naar de simulator geüpload, maar je moet de simulator vernieuwen voordat deze van kracht wordt. Rechts van de virtuele ID staat een knop om de pagina te vernieuwen.
6. De informatie die je in de configuratie hebt geselecteerd, wordt nu op de knoppenbalk weergegeven.
7. Je kunt op de knoppen in de minidisplays klikken om de mogelijkheid in Homey in of uit te schakelen.

De app heeft een ingebouwde MQTT-broker, dus daarvoor is geen configuratie nodig. Het is echter mogelijk om op de instellingenpagina van de app een of meer externe MQTT-brokers toe te voegen.
