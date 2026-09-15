Button +

Zmień swoją konfigurację Homey w inteligentniejsze i bardziej uporządkowane centrum sterowania dla rzeczy, których używasz każdego dnia.

Button + ułatwia tworzenie własnych fizycznych paneli sterowania, które bardziej przypominają wysokiej klasy dashboard smart home niż zbiór przełączników i stron. Dzięki panelowi Button + możesz umieścić sterowanie, którego naprawdę używasz, w jednym miejscu, pokazywać stan na żywo na pierwszy rzut oka i sprawić, że Twój dom będzie bardziej dopracowany i intuicyjny.

Dlaczego Button + jest tego wart

1. Sterowanie najważniejszymi urządzeniami i scenami jednym dotknięciem.
2. Szybka informacja wizualna dzięki własnym etykietom, tekstowi stanu i wartościom wyświetlanym na żywo.
3. Bardziej uporządkowane, ścienne środowisko smart home bez przekopywania się przez menu.
4. Elastyczne układy dla przycisków, wyświetlaczy i grupowanych paneli.
5. Szybsze codzienne korzystanie z rutyn takich jak oświetlenie, klimat, bezpieczeństwo i media.
6. Nowoczesny, konfigurowalny wygląd, który pasuje do Twojego domu i konfiguracji sprzętowej.

Szybka konfiguracja

1. Zainstaluj aplikację na swoim Homey.
2. Otwórz w Homey stronę Button + App settings / Configuration.

W aplikacji są trzy główne obszary konfiguracji.

1. Button bar configurations.
2. Display configurations.
3. Group configurations.

Każdy obszar konfiguracji ma zestaw slotów do budowania układów panelu. Konfiguracje button bar służą do przycisków sterujących, konfiguracje display służą do wyświetlacza panelu, a konfiguracje grup pozwalają połączyć je w pełną konfigurację panelu Button +.

Konfigurowanie button bar configurations

1. Wybierz Button bar Configurations z pierwszej listy rozwijanej.
2. Wybierz numer konfiguracji do edycji. Ten numer można później przypisać do panelu Button+.
3. W sekcji Left button bar znajdują się opcje dla przycisku po lewej stronie Button+ button bar.
4. Wybierz z listy rozwijanej urządzenie Homey, którym chcesz sterować. Panele obsługują boolean capabilities, chociaż filtrowanie jest nadal ulepszane.
5. Wybierz capability z listy rozwijanej.
6. Wprowadź Top Label, jeśli chcesz. Zostanie wyświetlony na zielono na wyświetlaczu przycisku.
7. Wprowadź Label. Zostanie wyświetlony na biało i większą czcionką na wyświetlaczu przycisku, tuż pod Top Text.
8. Powtórz kroki dla Right button bar.
9. Kliknij przycisk Save Configurations.

Konfigurowanie display configurations

1. Wybierz Display Configurations z pierwszej listy rozwijanej.
2. Wybierz numer konfiguracji do edycji. Później można go przypisać do wyświetlacza Button+.
3. Kliknij New Display Item.
4. Wybierz Device.
5. Wybierz Capability.
6. W razie potrzeby edytuj Label.
7. W razie potrzeby edytuj Units. To jest tylko tekst i nie zmienia wartości wysyłanych do wyświetlacza.
8. Wprowadź pozycje X i Y. Są to wartości procentowe szerokości i wysokości wyświetlacza.
9. Wprowadź szerokość. To również jest procent szerokości wyświetlacza.
10. Wprowadź wartość Rounding. 0 oznacza liczby całkowite, 1 oznacza 1 miejsce po przecinku i tak dalej.
11. Wybierz Font Size z listy.
12. Dodaj więcej elementów wyświetlacza w razie potrzeby.
13. Kliknij Save Configurations.

Konfigurowanie grup

Grupy są najłatwiejszym sposobem zdefiniowania kompletnego fizycznego panelu Button +. Grupa reprezentuje jeden gotowy układ panelu i może łączyć:

1. jedną konfigurację wyświetlacza.
2. jedną lub więcej konfiguracji button bar albo connector.
3. własną nazwę panelu.

Jak skonfigurować grupę:

1. Otwórz kartę Group Configurations w ustawieniach aplikacji.
2. Wybierz istniejącą grupę albo kliknij przycisk +, aby utworzyć nową.
3. Nadaj grupie nazwę taką jak Panel salonu albo Panel głównego korytarza.
4. Wybierz konfigurację wyświetlacza, którą chcesz przypisać do tej grupy.
5. Przypisz do grupy jedną lub więcej konfiguracji connector albo button.
6. Użyj obszaru podglądu, aby sprawdzić pełny układ panelu przed zapisaniem.
7. Duplikuj lub usuwaj grupy według potrzeb, jeśli chcesz mieć wiele układów paneli.

To przydaje się, gdy chcesz mieć różne fizyczne panele w różnych pomieszczeniach albo do różnych celów, a jednocześnie ponownie używać tych samych ustawień wstępnych wyświetlacza i przycisków.

Dodawanie urządzenia do Homey

1. Wybierz w Homey opcję New Device.
2. Wybierz Button button bar.
3. Kliknij Connect.
4. Następnie powinieneś zobaczyć urządzenie na liście, więc wybierz je i kontynuuj. Aplikacja obecnie używa Name z General settings do identyfikacji button bar. Jeśli Button + nie zostanie znaleziony, możesz spróbować dodać go ręcznie, wybierając opcję Manual i wpisując adres IP.
5. Urządzenie zostanie dodane do Homey.

Korzystanie z urządzenia Homey

1. Otwórz urządzenie w Homey.
2. Otwórz drugą kartę, aby wyświetlić listę konfiguracji wyświetlacza i każdego connector.
3. Wybierz Display albo numer Connector z górnej listy rozwijanej. Homey obecnie rysuje listę Configuration nad listą rozwijaną, więc wybranie tego, czego chcesz, może być uciążliwe.
4. Wybierz numer Configuration, który ma zostać zastosowany do Display albo connector button bar.
5. Konfiguracja jest przesyłana do symulatora, ale musisz odświeżyć symulator, aby zaczęła działać. Po prawej stronie Virtual Id znajduje się przycisk do odświeżenia strony.
6. Powinieneś teraz zobaczyć na button bar informacje wybrane w konfiguracji.
7. Możesz klikać przyciski na mini displays, aby przełączać capability w Homey.

Aplikacja ma wbudowany MQTT broker, więc nie wymaga to żadnej konfiguracji. Jednak na stronie ustawień aplikacji można dodać jednego lub więcej zewnętrznych MQTT brokers.
