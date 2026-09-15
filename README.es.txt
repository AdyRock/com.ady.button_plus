Botón de control + paneles

La aplicación es compatible con el botón + hardware.

Para configurar la aplicación:

3. Instale la aplicación en su Homey.
4. Abra la página Botón + Configuración de la aplicación / Configuración en Homey.
5. Asegúrese de que la opción Permitir actualización de la configuración de Button+ esté marcada.

Hay dos tipos de configuraciones, barra de botones y pantalla, y cada una tiene actualmente 20 espacios.
Las configuraciones de la barra de botones se muestran cuando la primera lista desplegable muestra Configuraciones de la barra de botones y las configuraciones de pantalla se muestran cambiando la lista desplegable a Configuraciones de pantalla.

Configurar las configuraciones de la barra de botones:

1. Seleccione Configuraciones de la barra de botones de la primera lista desplegable.
2. Seleccione un número de configuración para editar (podemos asignar cualquiera de las configuraciones a los Paneles Button+ más adelante).
3. En la barra de botones izquierda están las opciones para el botón en el lado izquierdo de la barra de botones Button+.
4. Seleccione un dispositivo Homey que desee controlar de la lista desplegable (los paneles solo admiten capacidades booleanas, pero aún no se ha implementado el filtrado de las listas)
5. Seleccione una capacidad de la lista desplegable.
6. Ingrese una etiqueta superior (opcional). Esto se muestra en verde en la pantalla de los botones.
7. Ingrese una etiqueta. Esto se muestra en blanco y con una fuente más grande en la pantalla de los botones, justo debajo del texto superior.
8. Repita los pasos para la barra de botones derecha.
9. Haga clic en el botón Guardar configuraciones. Aún queda por hacer es agregar un mensaje si olvida guardar y cerrar la ventana.

Configuración de configuraciones de pantalla:

1. Seleccione Configuraciones de pantalla de la primera lista desplegable.
2. Seleccione un número de configuración para editar (podemos asignar cualquiera de las configuraciones a Button+ Display más adelante).
3. Haga clic en Nuevo elemento de visualización.
4. Seleccione un Dispositivo o "Variable"
5. Seleccione una capacidad o variable.
6. Edite la etiqueta si es necesario.
7. Edite las Unidades si es necesario. (esto es solo texto y no cambia los valores que se envían a la pantalla).
8. Ingrese las posiciones X e Y. Estos son un porcentaje del ancho/alto de la pantalla.
9. Introduzca un ancho. Nuevamente, este es un porcentaje del ancho de la pantalla.
10. Introduzca un valor de Redondeo. 0 = números enteros (entero), 1 es 1 decimal, etc.
11. Seleccione un Tamaño de fuente de la lista.
12. Agregue más elementos de visualización según sea necesario.
13. Haga clic en Guardar configuraciones.

Agregar un dispositivo a Homey:

1. Seleccione la opción Nuevo dispositivo en Homey.
2. Seleccione la barra de botones Botón.
3. Haga clic en Conectar.
4. Luego debería ver el dispositivo en la lista, así que selecciónelo y continúe. (La aplicación actualmente usa el Nombre que se encuentra en la configuración General para identificar la barra de botones). Si no se encuentra el Botón +, puede intentar agregarlo manualmente seleccionando la opción Manual e ingresando la dirección IP.
5. El dispositivo se agregará a Homey.

Usando el dispositivo Homey:

1. Abra el dispositivo en Homey.
2. Abra la segunda pestaña para ver una lista de configuraciones para la pantalla y cada conector.
3. Seleccione la Pantalla o un número de Conector de la lista desplegable superior (Homey actualmente dibuja la lista de Configuración sobre la lista desplegable, por lo que puede ser complicado seleccionar lo que desea).
4. Seleccione un número de configuración para aplicarlo al conector de pantalla/barra de botones.
5. La configuración se carga en el simulador, pero es necesario actualizar el simulador para que surta efecto. Hay un botón a la derecha de la identificación virtual para actualizar la página.
6. Ahora debería ver la información que seleccionó en la configuración que se muestra en la barra de botones.
7. Puede hacer clic en los botones de las minipantallas para alternar la capacidad en Homey.

La aplicación tiene un intermediario MQTT integrado, por lo que no será necesaria ninguna configuración para ello. Sin embargo, es posible agregar uno o más agentes MQTT externos en la página de configuración de la aplicación.
