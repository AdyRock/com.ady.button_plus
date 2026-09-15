Controllo dei pannelli Button+

L'app supporta l'hardware Button+.

Per configurare l'app:

3. Installa l'app sul tuo Homey.
4. Apri la pagina Impostazioni / Configurazione dell'app Button+ in Homey.
5. Assicurati che l'opzione per consentire l'aggiornamento della configurazione di Button+ sia selezionata.

Esistono due tipi di configurazione, barra dei pulsanti e display, ciascuno dei quali dispone attualmente di 20 slot.
Le configurazioni della barra dei pulsanti vengono mostrate quando il primo elenco a discesa indica Configurazioni barra dei pulsanti; per mostrare le configurazioni del display, seleziona Configurazioni display nell'elenco a discesa.

Configurazione della barra dei pulsanti:

1. Seleziona Configurazioni barra dei pulsanti dal primo elenco a discesa.
2. Seleziona un numero di configurazione da modificare (in seguito potremo assegnare qualsiasi configurazione ai pannelli Button+).
3. Nella sezione Barra pulsanti sinistra sono disponibili le opzioni per il pulsante sul lato sinistro della barra dei pulsanti Button+.
4. Seleziona dall'elenco a discesa un dispositivo Homey da controllare (i pannelli supportano solo capability booleane, ma il filtro degli elenchi deve ancora essere implementato).
5. Seleziona una capability dall'elenco a discesa.
6. Inserisci un'etichetta superiore (facoltativa). Viene visualizzata in verde sul display dei pulsanti.
7. Inserisci un'etichetta. Viene visualizzata in bianco e con un carattere più grande sul display dei pulsanti, subito sotto il testo superiore.
8. Ripeti i passaggi per la barra dei pulsanti destra.
9. Fai clic sul pulsante Salva configurazioni. Resta da aggiungere un avviso nel caso in cui si chiuda la finestra senza salvare.

Configurazione del display:

1. Seleziona Configurazioni display dal primo elenco a discesa.
2. Seleziona un numero di configurazione da modificare (in seguito potremo assegnare qualsiasi configurazione al display Button+).
3. Fai clic su Nuovo elemento display.
4. Seleziona un dispositivo o "Variabile".
5. Seleziona una capability o una variabile.
6. Modifica l'etichetta, se necessario.
7. Modifica le unità, se necessario (si tratta solo di testo e non modifica i valori inviati al display).
8. Inserisci le posizioni X e Y. Sono espresse come percentuale della larghezza / altezza del display.
9. Inserisci una larghezza. Anche questa è espressa come percentuale della larghezza del display.
10. Inserisci un valore di arrotondamento. 0 = numeri interi, 1 = una cifra decimale e così via.
11. Seleziona una dimensione del carattere dall'elenco.
12. Aggiungi altri elementi display secondo necessità.
13. Fai clic su Salva configurazioni.

Aggiunta di un dispositivo a Homey:

1. Seleziona l'opzione Nuovo dispositivo in Homey.
2. Seleziona Barra dei pulsanti Button.
3. Fai clic su Connetti.
4. Il dispositivo dovrebbe apparire nell'elenco: selezionalo e continua. (Attualmente l'app usa il nome presente nelle impostazioni Generali per identificare la barra dei pulsanti.) Se Button+ non viene rilevato, puoi provare ad aggiungerlo manualmente selezionando l'opzione Manuale e inserendo l'indirizzo IP.
5. Il dispositivo verrà aggiunto a Homey.

Utilizzo del dispositivo Homey:

1. Apri il dispositivo in Homey.
2. Apri la seconda scheda per visualizzare l'elenco delle configurazioni del display e di ciascun connettore.
3. Seleziona il display o il numero di un connettore dall'elenco a discesa superiore (attualmente Homey disegna l'elenco Configurazione sopra l'elenco a discesa, quindi può essere difficile selezionare l'elemento desiderato).
4. Seleziona un numero di configurazione da applicare al display / connettore della barra dei pulsanti.
5. La configurazione viene caricata nel simulatore, ma è necessario aggiornare il simulatore affinché abbia effetto. A destra dell'ID virtuale è presente un pulsante per aggiornare la pagina.
6. Ora le informazioni selezionate nella configurazione dovrebbero essere visualizzate sulla barra dei pulsanti.
7. Puoi fare clic sui pulsanti dei mini display per commutare la capability in Homey.

L'app integra un broker MQTT, quindi non è necessaria alcuna configurazione. È comunque possibile aggiungere uno o più broker MQTT esterni nella pagina delle impostazioni dell'app.