Button +

Machen Sie Ihr Homey Setup zu einem intelligenteren und aufgeräumteren Steuerzentrum für die Dinge, die Sie jeden Tag nutzen.

Mit Button + können Sie ganz einfach individuelle physische Bedienfelder erstellen, die sich eher wie ein hochwertiges Smart Home Dashboard anfühlen als wie ein Durcheinander aus Schaltern und Seiten. Mit einem Button + Panel können Sie die Steuerungen, die Sie wirklich verwenden, an einem Ort bündeln, den Live Status auf einen Blick sehen und Ihr Zuhause aufgeräumter und intuitiver wirken lassen.

Warum sich Button + lohnt

1. Steuerung Ihrer wichtigsten Geräte und Szenen mit nur einer Berührung.
2. Schnelle visuelle Rückmeldung mit benutzerdefinierten Beschriftungen, Statustext und Live Anzeigewerten.
3. Ein aufgeräumteres Smart Home Erlebnis an der Wand, ohne sich durch Menüs zu arbeiten.
4. Flexible Layouts für Tasten, Displays und gruppierte Panels.
5. Schnellere tägliche Nutzung für Routinen wie Licht, Klima, Sicherheit und Medien.
6. Ein moderner, anpassbarer Look, der sich in Ihr Zuhause und Ihr Hardware Setup einfügt.

Schnelle Einrichtung

1. Installieren Sie die App auf Ihrem Homey.
2. Öffnen Sie in Homey die Seite Button + App settings / Configuration.

Es gibt drei Hauptbereiche für die Konfiguration in der App.

1. Button bar configurations.
2. Display configurations.
3. Group configurations.

Jeder Konfigurationsbereich verfügt über eine Reihe von Slots zum Aufbau Ihrer Panel Layouts. Die Button bar Konfigurationen werden für die Steuertasten verwendet, die Display Konfigurationen für das Panel Display, und mit den Group Konfigurationen können Sie alles zu einem vollständigen Button + Panel Setup kombinieren.

Button bar Konfigurationen einrichten

1. Wählen Sie in der ersten Dropdown Liste Button bar Configurations aus.
2. Wählen Sie eine Konfigurationsnummer zum Bearbeiten aus. Diese Nummer kann später einem Button+ Panel zugewiesen werden.
3. Unter Left button bar befinden sich die Optionen für die Taste auf der linken Seite der Button+ button bar.
4. Wählen Sie in der Dropdown Liste ein Homey Gerät aus, das Sie steuern möchten. Die Panels unterstützen boolean capabilities, auch wenn die Filterung noch verbessert wird.
5. Wählen Sie in der Dropdown Liste eine capability aus.
6. Geben Sie bei Bedarf ein Top Label ein. Dieses wird auf dem Tasten Display grün angezeigt.
7. Geben Sie ein Label ein. Dieses wird auf dem Tasten Display weiß und in größerer Schrift direkt unter dem Top Text angezeigt.
8. Wiederholen Sie die Schritte für die Right button bar.
9. Klicken Sie auf die Schaltfläche Save Configurations.

Display Konfigurationen einrichten

1. Wählen Sie in der ersten Dropdown Liste Display Configurations aus.
2. Wählen Sie eine Konfigurationsnummer zum Bearbeiten aus. Diese kann später einem Button+ Display zugewiesen werden.
3. Klicken Sie auf New Display Item.
4. Wählen Sie ein Device.
5. Wählen Sie eine Capability.
6. Bearbeiten Sie das Label bei Bedarf.
7. Bearbeiten Sie die Units bei Bedarf. Dies ist nur Text und ändert die an das Display gesendeten Werte nicht.
8. Geben Sie die X und Y Positionen ein. Diese sind Prozentsätze der Displaybreite und Displayhöhe.
9. Geben Sie eine Breite ein. Auch diese ist ein Prozentsatz der Displaybreite.
10. Geben Sie einen Rounding Wert ein. 0 bedeutet ganze Zahlen, 1 bedeutet 1 Dezimalstelle und so weiter.
11. Wählen Sie eine Font Size aus der Liste.
12. Fügen Sie bei Bedarf weitere Display Elemente hinzu.
13. Klicken Sie auf Save Configurations.

Gruppen einrichten

Gruppen sind die einfachste Möglichkeit, ein vollständiges physisches Button + Panel zu definieren. Eine Gruppe steht für ein fertiges Panel Layout und kann Folgendes kombinieren:

1. eine Display Konfiguration.
2. eine oder mehrere Button bar oder Connector Konfigurationen.
3. einen benutzerdefinierten Namen für das Panel.

So richten Sie eine Gruppe ein:

1. Öffnen Sie in den App Einstellungen die Registerkarte Group Configurations.
2. Wählen Sie eine vorhandene Gruppe aus oder klicken Sie auf die Schaltfläche +, um eine neue zu erstellen.
3. Geben Sie der Gruppe einen Namen wie Wohnzimmer Panel oder Hauptflur Panel.
4. Wählen Sie die Display Konfiguration aus, die dieser Gruppe zugewiesen werden soll.
5. Weisen Sie der Gruppe eine oder mehrere Connector oder Button Konfigurationen zu.
6. Verwenden Sie den Vorschaubereich, um das vollständige Panel Layout vor dem Speichern zu prüfen.
7. Duplizieren oder löschen Sie Gruppen nach Bedarf, wenn Sie mehrere Panel Layouts möchten.

Das ist nützlich, wenn Sie in verschiedenen Räumen oder für verschiedene Zwecke unterschiedliche physische Panels verwenden möchten und dabei dieselben Display und Button Voreinstellungen wiederverwenden wollen.

Ein Gerät zu Homey hinzufügen

1. Wählen Sie in Homey die Option New Device.
2. Wählen Sie Button button bar.
3. Klicken Sie auf Connect.
4. Danach sollten Sie das Gerät in der Liste sehen. Wählen Sie es aus und fahren Sie fort. Die App verwendet derzeit den Name aus den General settings, um die button bar zu identifizieren. Wenn Button + nicht gefunden wird, können Sie versuchen, es manuell hinzuzufügen, indem Sie die Option Manual auswählen und die IP Adresse eingeben.
5. Das Gerät wird zu Homey hinzugefügt.

Das Homey Gerät verwenden

1. Öffnen Sie das Gerät in Homey.
2. Öffnen Sie die zweite Registerkarte, um eine Liste der Konfigurationen für das Display und jeden Connector anzuzeigen.
3. Wählen Sie oben das Display oder eine Connector Nummer aus der Dropdown Liste aus. Homey zeichnet derzeit die Liste Configuration über die Dropdown Liste, daher kann die Auswahl etwas mühsam sein.
4. Wählen Sie eine Configuration Nummer aus, die auf den Display oder button bar Connector angewendet werden soll.
5. Die Konfiguration wird in den Simulator hochgeladen, aber Sie müssen den Simulator aktualisieren, damit sie wirksam wird. Rechts neben der Virtual Id befindet sich eine Schaltfläche zum Aktualisieren der Seite.
6. Sie sollten nun die Informationen, die Sie in der Konfiguration ausgewählt haben, auf der button bar sehen.
7. Sie können auf die Tasten in den Mini Displays klicken, um die capability in Homey umzuschalten.

Die App verfügt über einen integrierten MQTT Broker, daher ist dafür keine Einrichtung erforderlich. Es ist jedoch möglich, auf der Seite mit den App Einstellungen einen oder mehrere externe MQTT Broker hinzuzufügen.
