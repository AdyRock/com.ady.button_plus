Button +

Gör din Homey installation till ett smartare och renare kontrollcenter för de saker du använder varje dag.

Button + gör det enkelt att bygga anpassade fysiska kontrollpaneler som känns som en smart home dashboard av premiumklass i stället för en röra av reglage och sidor. Med en Button + panel kan du samla de kontroller du faktiskt använder på ett ställe, visa live status med en snabb blick och få ditt hem att kännas mer genomarbetat och intuitivt.

Varför Button + är värt det

1. Styrning med en enda tryckning för dina viktigaste enheter och scener.
2. Snabb visuell återkoppling med anpassade etiketter, statustext och live visningsvärden.
3. En renare väggmonterad smart home upplevelse utan att behöva leta i menyer.
4. Flexibla layouter för knappar, displayer och grupperade paneler.
5. Snabbare daglig användning för rutiner som belysning, klimat, säkerhet och media.
6. Ett modernt och anpassningsbart utseende som passar in i ditt hem och din hårdvaruuppsättning.

Snabb installation

1. Installera appen på din Homey.
2. Öppna sidan Button + App settings / Configuration i Homey.

Det finns tre huvudsakliga konfigurationsområden i appen.

1. Button bar configurations.
2. Display configurations.
3. Group configurations.

Varje konfigurationsområde har en uppsättning platser för att bygga dina panellayouter. Konfigurationerna för button bar används för kontrollknapparna, displaykonfigurationerna används för panelens display och gruppkonfigurationerna låter dig kombinera dem till en komplett Button + paneluppsättning.

Konfigurera button bar configurations

1. Välj Button bar Configurations i den första listrutan.
2. Välj ett konfigurationsnummer att redigera. Detta nummer kan senare tilldelas en Button+ panel.
3. Under Left button bar finns alternativen för knappen på vänster sida av Button+ button bar.
4. Välj en Homey enhet som du vill styra från listrutan. Panelerna stöder boolean capabilities, även om filtreringen fortfarande förbättras.
5. Välj en capability från listrutan.
6. Ange en Top Label om du vill. Den visas i grönt på knappens display.
7. Ange en Label. Den visas i vitt och med större teckenstorlek på knappens display, precis under Top Text.
8. Upprepa stegen för Right button bar.
9. Klicka på knappen Save Configurations.

Konfigurera display configurations

1. Välj Display Configurations i den första listrutan.
2. Välj ett konfigurationsnummer att redigera. Detta kan senare tilldelas en Button+ display.
3. Klicka på New Display Item.
4. Välj en Device.
5. Välj en Capability.
6. Redigera Label om det behövs.
7. Redigera Units om det behövs. Detta är bara text och ändrar inte de värden som skickas till displayen.
8. Ange positionerna X och Y. De är procent av displayens bredd och höjd.
9. Ange en bredd. Även detta är en procentandel av displayens bredd.
10. Ange ett Rounding värde. 0 betyder heltal, 1 betyder 1 decimal och så vidare.
11. Välj en Font Size i listan.
12. Lägg till fler visningsobjekt vid behov.
13. Klicka på Save Configurations.

Konfigurera grupper

Grupper är det enklaste sättet att definiera en komplett fysisk Button + panel. En grupp representerar en färdig panellayout och kan kombinera:

1. en displaykonfiguration.
2. en eller flera button bar eller connector konfigurationer.
3. ett anpassat namn för panelen.

Så här ställer du in en grupp:

1. Öppna fliken Group Configurations i appinställningarna.
2. Välj en befintlig grupp eller klicka på knappen + för att skapa en ny.
3. Ge gruppen ett namn som Vardagsrumspanel eller Panel i huvudhall.
4. Välj den displaykonfiguration som ska tilldelas gruppen.
5. Tilldela en eller flera connector eller button konfigurationer till gruppen.
6. Använd förhandsgranskningsområdet för att granska den fullständiga panellayouten innan du sparar.
7. Duplicera eller ta bort grupper vid behov om du vill ha flera panellayouter.

Detta är användbart när du vill ha olika fysiska paneler i olika rum eller för olika ändamål samtidigt som du återanvänder samma förinställningar för display och knappar.

Lägga till en enhet i Homey

1. Välj alternativet New Device i Homey.
2. Välj Button button bar.
3. Klicka på Connect.
4. Då bör du se enheten i listan. Välj den och fortsätt. Appen använder för närvarande Name under General settings för att identifiera button bar. Om Button + inte hittas kan du försöka lägga till den manuellt genom att välja alternativet Manual och ange IP adressen.
5. Enheten läggs till i Homey.

Använda Homey enheten

1. Öppna enheten i Homey.
2. Öppna den andra fliken för att visa en lista över konfigurationer för displayen och varje connector.
3. Välj Display eller ett Connector nummer från den översta listrutan. Homey ritar för närvarande listan Configuration över listrutan, så det kan vara besvärligt att välja det du vill ha.
4. Välj ett Configuration nummer som ska tillämpas på Display eller button bar connector.
5. Konfigurationen laddas upp till simulatorn, men du måste uppdatera simulatorn för att den ska börja gälla. Det finns en knapp till höger om Virtual Id för att uppdatera sidan.
6. Nu bör du se den information som du valde i konfigurationen visas på button bar.
7. Du kan klicka på knapparna i mini displays för att växla capability i Homey.

Appen har en inbyggd MQTT broker, så ingen konfiguration krävs för det. Det är dock möjligt att lägga till en eller flera externa MQTT brokers på appens inställningssida.
