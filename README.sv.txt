Kontrollknapp + paneler

Appen stöder knapp + hårdvara.

Så här ställer du in appen:

3. Installera appen på din Homey. 
4. Öppna knappen Knapp + Appinställningar / Konfigurationssidan i Homey.
5. Se till att Tillåt uppdatering av Button+-konfigurationen är markerad.

Det finns två typer av konfigurationer, knapprad och display, och var och en har för närvarande 20 platser.
Knappradens konfigurationer visas när den första listrutan visar knappradens konfigurationer och Display-konfigurationerna visas genom att ändra listrutan till Display Configurations.

Konfigurera knappradskonfigurationer:

1. Välj knappradskonfigurationer från den första listrutan.
2. Välj ett konfigurationsnummer att redigera (vi kan tilldela någon av konfigurationerna till Button+ Panels senare).
3. Under Vänster knappfält finns alternativen för knappen på vänster sida av knappfältet Button+.
4. Välj en Homey-enhet som du vill styra från listrutan (panelerna stöder bara booleska funktioner men filtrering av listorna är fortfarande inte implementerad)
5. Välj en funktion från listrutan.
6. Ange en toppetikett (valfritt). Detta visas i grönt på knappdisplayen.
7. Ange en etikett. Detta visas i vitt och ett större teckensnitt på knappdisplayen, precis under den övre texten.
8. Upprepa stegen för den högra knappraden.
9. Klicka på knappen Spara konfigurationer. Fortfarande att göra är att lägga till en uppmaning om du glömmer att spara och stänga fönstret.

Konfigurera bildskärmskonfigurationer:

1. Välj bildskärmskonfigurationer från den första listrutan.
2. Välj ett konfigurationsnummer att redigera (vi kan tilldela någon av konfigurationerna till Button+ Display senare).
3. Klicka på Nytt visningsobjekt.
4. Välj en enhet eller "Variabel"
5. Välj en funktion eller variabel.
6. Redigera etiketten om det behövs.
7. Redigera enheterna om det behövs. (detta är endast text och ändrar inte de värden som skickas till displayen).
8. Ange X- och Y-positionerna. Dessa är en procentandel av displayens bredd/höjd.
9. Ange en bredd. Återigen är detta en procentandel av displayens bredd.
10. Ange ett avrundningsvärde. 0 = heltal (heltal), 1 är 1 decimal osv.
11. Välj en teckenstorlek i listan.
12. Lägg till fler visningsobjekt efter behov.
13. Klicka på Spara konfigurationer.

Lägga till en enhet i Homey:

1. Välj alternativet Ny enhet i Homey.
2. Välj knappfältet.
3. Klicka på Anslut.
4. Du bör då se enheten i listan, så välj den och fortsätt. (Appen använder för närvarande namnet som finns under de allmänna inställningarna för att identifiera knappraden). Om knappen + inte hittas kan du försöka lägga till den manuellt genom att välja alternativet Manuell och ange IP-adressen.
5. Enheten läggs till i Homey.

Använda Homey-enheten:

1. Öppna enheten i Homey.
2. Öppna den andra fliken för att se en lista över konfigurationer för skärmen och varje anslutning.
3. Välj bildskärms- eller anslutningsnummer från den översta droplistan (Homey ritar för närvarande konfigurationslistan över droplistan, så det kan vara jobbigt att välja vad du vill ha).
4. Välj ett konfigurationsnummer som ska tillämpas på kontakten Display / knappfält.
5. Konfigurationen laddas upp till simulatorn, men du måste uppdatera simulatorn för att den ska träda i kraft. Det finns en knapp till höger om det virtuella ID:t för att uppdatera sidan.
6. Du bör nu se informationen du valde i konfigurationen som visas på knappraden.
7. Du kan klicka på knapparna i miniskärmarna för att växla mellan funktionerna i Homey.

Appen har en inbyggd MQTT-mäklare, så ingen installation kommer att krävas för det. Det är dock möjligt att lägga till en eller flera externa MQTT-mäklare på sidan för appinställningar.
