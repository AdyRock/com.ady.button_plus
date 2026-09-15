Przycisk sterowania + panele

Aplikacja obsługuje przycisk + sprzęt.

Aby skonfigurować aplikację:

3. Zainstaluj aplikację na swoim Homey. 
4. Otwórz stronę Ustawienia przycisku + aplikacji / Konfiguracja w Homey.
5. Upewnij się, że zaznaczona jest opcja Zezwalaj na aktualizację konfiguracji Button+.

Istnieją dwa typy konfiguracji, pasek przycisków i wyświetlacz, a każda ma obecnie 20 miejsc.
Konfiguracje paska przycisków są wyświetlane, gdy pierwsza lista rozwijana przedstawia konfiguracje paska przycisków, a konfiguracje wyświetlacza są wyświetlane po zmianie listy rozwijanej na Konfiguracje wyświetlania.

Konfigurowanie konfiguracji paska przycisków:

1. Wybierz konfiguracje paska przycisków z pierwszej listy rozwijanej.
2. Wybierz numer konfiguracji do edycji (później możemy przypisać dowolną konfigurację do Paneli Button+).
3. W lewym pasku przycisków znajdują się opcje przycisku po lewej stronie paska przycisków Button+.
4. Wybierz z listy rozwijanej urządzenie Homey, którym chcesz sterować (panele obsługują tylko funkcje logiczne, ale filtrowanie list pozostaje jeszcze do zaimplementowania)
5. Wybierz możliwość z listy rozwijanej.
6. Wprowadź górną etykietę (opcjonalnie). Jest to wyświetlane na wyświetlaczu przycisków w kolorze zielonym.
7. Wprowadź etykietę. Jest to pokazane białą i większą czcionką na wyświetlaczu przycisków, tuż pod górnym tekstem.
8. Powtórz kroki dla prawego paska przycisków.
9. Kliknij przycisk Zapisz konfiguracje. Pozostało jeszcze dodać monit, jeśli zapomnisz zapisać i zamknąć okno.

Konfigurowanie konfiguracji wyświetlania:

1. Wybierz opcję Konfiguracje wyświetlania z pierwszej listy rozwijanej.
2. Wybierz numer konfiguracji do edycji (później możemy przypisać dowolną konfigurację do Button+ Display).
3. Kliknij opcję Nowy element wyświetlany.
4. Wybierz urządzenie lub „zmienną”
5. Wybierz zdolność lub zmienną.
6. W razie potrzeby edytuj etykietę.
7. W razie potrzeby edytuj jednostki. (jest to tylko tekst i nie zmienia wartości wysyłanych do wyświetlacza).
8. Wprowadź pozycje X i Y. Są to procenty szerokości/wysokości wyświetlacza.
9. Wprowadź szerokość. Ponownie jest to procent szerokości wyświetlacza.
10. Wprowadź wartość zaokrąglenia. 0 = liczby całkowite (liczba całkowita), 1 to 1 miejsce po przecinku itp.
11. Wybierz rozmiar czcionki z listy.
12. W razie potrzeby dodaj więcej wyświetlanych elementów.
13. Kliknij Zapisz konfiguracje.

Dodawanie urządzenia do Homey:

1. Wybierz opcję Nowe urządzenie w Homey.
2. Wybierz pasek przycisków przycisku.
3. Kliknij Połącz.
4. Powinieneś zobaczyć urządzenie na liście, więc wybierz je i kontynuuj. (Aplikacja używa obecnie nazwy znalezionej w ustawieniach ogólnych do identyfikacji paska przycisków). Jeżeli Przycisk + nie zostanie odnaleziony to możesz spróbować dodać go ręcznie wybierając opcję Ręcznie i wpisując adres IP.
5. Urządzenie zostanie dodane do Homey.

Korzystanie z urządzenia Homey:

1. Otwórz urządzenie w Homey.
2. Otwórz drugą zakładkę, aby wyświetlić listę konfiguracji wyświetlacza i każdego złącza.
3. Wybierz numer wyświetlacza lub złącza z górnej listy rozwijanej (Homey obecnie rysuje listę konfiguracji nad listą rozwijaną, więc wybranie tego, co chcesz, może być trudne).
4. Wybierz numer konfiguracji, który chcesz zastosować do złącza paska wyświetlacza/przycisków.
5. Konfiguracja została przesłana do symulatora, ale należy odświeżyć symulator, aby zaczęła obowiązywać. Po prawej stronie wirtualnego identyfikatora znajduje się przycisk umożliwiający odświeżenie strony.
6. Powinieneś teraz zobaczyć informacje wybrane w konfiguracji wyświetlone na pasku przycisków.
7. Możesz kliknąć przyciski na miniwyświetlaczach, aby przełączyć funkcje Homey.

Aplikacja ma wbudowanego brokera MQTT, więc nie będzie wymagana żadna konfiguracja. Można jednak dodać jednego lub więcej zewnętrznych brokerów MQTT na stronie ustawień aplikacji.
