Button +

Trasforma la tua configurazione Homey in un centro di controllo più intelligente e ordinato per le cose che usi ogni giorno.

Button + rende semplice creare pannelli di controllo fisici personalizzati che sembrano una dashboard smart home premium invece di un insieme confuso di interruttori e pagine. Con un pannello Button + puoi riunire in un solo posto i controlli che usi davvero, mostrare lo stato in tempo reale a colpo d'occhio e rendere la tua casa più rifinita e intuitiva.

Perché Button + vale la pena

1. Controllo con un solo tocco per i dispositivi e le scene più importanti.
2. Feedback visivo rapido con etichette personalizzate, testo di stato e valori del display in tempo reale.
3. Un'esperienza smart home a parete più pulita, senza dover scavare nei menu.
4. Layout flessibili per pulsanti, display e pannelli raggruppati.
5. Uso quotidiano più rapido per routine come illuminazione, clima, sicurezza e media.
6. Un aspetto moderno e personalizzabile che si integra con la tua casa e con la tua configurazione hardware.

Configurazione rapida

1. Installa l'app sul tuo Homey.
2. Apri la pagina Button + App settings / Configuration in Homey.

Nell'app ci sono tre aree principali di configurazione.

1. Button bar configurations.
2. Display configurations.
3. Group configurations.

Ogni area di configurazione ha una serie di slot per costruire i layout del pannello. Le configurazioni della button bar vengono usate per i pulsanti di controllo, le configurazioni del display vengono usate per il display del pannello e le configurazioni di gruppo ti permettono di combinarle in una configurazione completa di pannello Button +.

Impostare le button bar configurations

1. Seleziona Button bar Configurations dal primo elenco a discesa.
2. Seleziona un numero di configurazione da modificare. In seguito questo numero potrà essere assegnato a un pannello Button+.
3. Sotto Left button bar ci sono le opzioni per il pulsante sul lato sinistro della Button+ button bar.
4. Seleziona dall'elenco a discesa un dispositivo Homey che vuoi controllare. I pannelli supportano le boolean capabilities, anche se il filtro è ancora in fase di miglioramento.
5. Seleziona una capability dall'elenco a discesa.
6. Inserisci un Top Label se lo desideri. Verrà visualizzato in verde sul display del pulsante.
7. Inserisci un Label. Verrà mostrato in bianco e con un carattere più grande sul display del pulsante, appena sotto il Top Text.
8. Ripeti i passaggi per la Right button bar.
9. Fai clic sul pulsante Save Configurations.

Impostare le display configurations

1. Seleziona Display Configurations dal primo elenco a discesa.
2. Seleziona un numero di configurazione da modificare. In seguito potrà essere assegnato a un display Button+.
3. Fai clic su New Display Item.
4. Seleziona un Device.
5. Seleziona una Capability.
6. Modifica il Label se necessario.
7. Modifica le Units se necessario. Si tratta solo di testo e non cambia i valori inviati al display.
8. Inserisci le posizioni X e Y. Sono percentuali della larghezza e dell'altezza del display.
9. Inserisci una larghezza. Anche questa è una percentuale della larghezza del display.
10. Inserisci un valore di Rounding. 0 significa numeri interi, 1 significa 1 cifra decimale e così via.
11. Seleziona una Font Size dall'elenco.
12. Aggiungi altri elementi del display secondo necessità.
13. Fai clic su Save Configurations.

Impostare i gruppi

I gruppi sono il modo più semplice per definire un pannello fisico Button + completo. Un gruppo rappresenta un layout di pannello finito e può combinare:

1. una configurazione display.
2. una o più configurazioni di button bar o connector.
3. un nome personalizzato per il pannello.

Per impostare un gruppo:

1. Apri la scheda Group Configurations nelle impostazioni dell'app.
2. Seleziona un gruppo esistente oppure fai clic sul pulsante + per crearne uno nuovo.
3. Dai al gruppo un nome come Pannello soggiorno o Pannello corridoio principale.
4. Scegli la configurazione display da assegnare a quel gruppo.
5. Assegna al gruppo una o più configurazioni di connector o button.
6. Usa l'area di anteprima per controllare il layout completo del pannello prima di salvare.
7. Duplica o elimina i gruppi secondo necessità se vuoi più layout di pannello.

Questo è utile quando vuoi pannelli fisici diversi in stanze diverse o per scopi diversi, riutilizzando gli stessi preset di display e pulsanti.

Aggiungere un dispositivo a Homey

1. Seleziona l'opzione New Device in Homey.
2. Seleziona Button button bar.
3. Fai clic su Connect.
4. Dovresti quindi vedere il dispositivo nell'elenco. Selezionalo e continua. Attualmente l'app usa il Name presente nelle General settings per identificare la button bar. Se il Button + non viene trovato, puoi provare ad aggiungerlo manualmente selezionando l'opzione Manual e inserendo l'indirizzo IP.
5. Il dispositivo verrà aggiunto a Homey.

Usare il dispositivo Homey

1. Apri il dispositivo in Homey.
2. Apri la seconda scheda per visualizzare un elenco delle configurazioni del display e di ciascun connector.
3. Seleziona il Display oppure un numero di Connector dall'elenco a discesa superiore. Attualmente Homey disegna l'elenco Configuration sopra l'elenco a discesa, quindi può essere scomodo selezionare ciò che desideri.
4. Seleziona un numero di Configuration da applicare al Display o al connector della button bar.
5. La configurazione viene caricata nel simulatore, ma devi aggiornare il simulatore perché abbia effetto. A destra del Virtual Id c'è un pulsante per aggiornare la pagina.
6. Ora dovresti vedere sulla button bar le informazioni che hai selezionato nella configurazione.
7. Puoi fare clic sui pulsanti nei mini display per attivare o disattivare la capability in Homey.

L'app ha un broker MQTT integrato, quindi non è necessaria alcuna configurazione per questo. Tuttavia, è possibile aggiungere uno o più broker MQTT esterni nella pagina delle impostazioni dell'app.
