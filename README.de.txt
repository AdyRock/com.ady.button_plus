Control Button + Panels

Die App unterstützt die Button + Hardware.

So richten Sie die App ein:

3. Installieren Sie die App auf Ihrem Homey.
4. Öffnen Sie die Seite „Button + App-Einstellungen/Konfiguration“ in Homey.
5. Stellen Sie sicher, dass das Kontrollkästchen Aktualisierung der Button+-Konfiguration zulassen aktiviert ist.

Es gibt zwei Arten von Konfigurationen, Schaltflächenleiste und Anzeige, und jede verfügt derzeit über 20 Steckplätze.
Die Schaltflächenleistenkonfigurationen werden angezeigt, wenn in der ersten Dropdown-Liste Schaltflächenleistenkonfigurationen angezeigt werden, und die Anzeigekonfigurationen werden angezeigt, indem die Dropdown-Liste in „Anzeigekonfigurationen“ geändert wird.

Einrichten der Schaltflächenleisten-Konfigurationen:

1. Wählen Sie Schaltflächenleisten-Konfigurationen aus der ersten Dropdown-Liste.
2. Wählen Sie eine Konfigurationsnummer zum Bearbeiten aus (wir können Button+ Panels später beliebige Konfigurationen zuweisen).
3. Unter „Linke Schaltflächenleiste“ finden Sie die Optionen für die Schaltfläche auf der linken Seite der Button+-Schaltflächenleiste.
4. Wählen Sie aus der Dropdown-Liste ein Homey-Gerät aus, das Sie steuern möchten. (Die Panels unterstützen nur boolesche Funktionen, das Filtern der Listen muss jedoch noch implementiert werden.)
5. Wählen Sie eine Funktion aus der Dropdown-Liste aus.
6. Geben Sie eine Top-Beschriftung ein (optional). Dies wird auf dem Tastendisplay grün angezeigt.
7. Geben Sie eine Bezeichnung ein. Dies wird in Weiß und einer größeren Schriftart auf dem Tastendisplay direkt unter dem oberen Text angezeigt.
8. Wiederholen Sie die Schritte für die rechte Schaltflächenleiste.
9. Klicken Sie auf die Schaltfläche Konfigurationen speichern. Sie müssen noch eine Eingabeaufforderung hinzufügen, wenn Sie das Speichern vergessen haben, und das Fenster schließen.

Einrichten von Anzeigekonfigurationen:

1. Wählen Sie Anzeigekonfigurationen aus der ersten Dropdown-Liste.
2. Wählen Sie eine Konfigurationsnummer zum Bearbeiten aus (wir können Button+ Display später beliebige Konfigurationen zuweisen).
3. Klicken Sie auf Neues Anzeigeelement.
4. Wählen Sie ein Gerät oder eine „Variable“ aus
5. Wählen Sie eine Fähigkeit oder Variable aus.
6. Bearbeiten Sie das Etikett bei Bedarf.
7. Bearbeiten Sie bei Bedarf die Einheiten. (Dies ist nur Text und ändert nicht die Werte, die an die Anzeige gesendet werden).
8. Geben Sie die X- und Y-Positionen ein. Hierbei handelt es sich um einen Prozentsatz der Anzeigebreite/-höhe.
9. Geben Sie eine Breite ein. Auch hier handelt es sich um einen Prozentsatz der Anzeigebreite.
10. Geben Sie einen Rundungswert ein. 0 = ganze Zahlen (Ganzzahl), 1 ist 1 Dezimalstelle usw.
11. Wählen Sie eine Schriftgröße aus der Liste aus.
12. Fügen Sie nach Bedarf weitere Anzeigeelemente hinzu.
13. Klicken Sie auf Konfigurationen speichern.

Hinzufügen eines Geräts zu Homey:

1. Wählen Sie in Homey die Option Neues Gerät.
2. Wählen Sie Schaltflächenleiste aus.
3. Klicken Sie auf Verbinden.
4. Anschließend sollte das Gerät aufgelistet sein. Wählen Sie es aus und fahren Sie fort. (Die App verwendet derzeit den Namen, der unter den allgemeinen Einstellungen gefunden wird, um die Schaltflächenleiste zu identifizieren.) Wenn die Schaltfläche + nicht gefunden wird, können Sie versuchen, sie manuell hinzuzufügen, indem Sie die Option „Manuell“ auswählen und die IP-Adresse eingeben.
5. Das Ger��t wird zu Homey hinzugefügt.

Verwendung des Homey-Geräts:

1. Öffnen Sie das Gerät in Homey.
2. Öffnen Sie die zweite Registerkarte, um eine Liste der Konfigurationen für das Display und jeden Anschluss anzuzeigen.
3. Wählen Sie die Display- oder Connector-Nummer aus der oberen Dropdown-Liste aus (Homey zeichnet derzeit die Konfigurationsliste über die Dropdown-Liste, daher kann es schwierig sein, das Gewünschte auszuwählen).
4. Wählen Sie eine Konfigurationsnummer aus, die Sie auf den Display-/Tastenleisten-Anschluss anwenden möchten.
5. Die Konfiguration wird in den Simulator hochgeladen, aber Sie müssen den Simulator aktualisieren, damit sie wirksam wird. Rechts neben der virtuellen ID befindet sich eine Schaltfläche zum Aktualisieren der Seite.
6. Die von Ihnen in der Konfiguration ausgewählten Informationen sollten nun in der Schaltflächenleiste angezeigt werden.
7. Sie können auf die Schaltflächen in den Mini-Displays klicken, um die Funktion in Homey umzuschalten.

Die App verfügt über einen integrierten MQTT-Broker, daher ist hierfür keine Einrichtung erforderlich. Es ist jedoch möglich, auf der Seite mit den App-Einstellungen einen oder mehrere externe MQTT-Broker hinzuzufügen.
