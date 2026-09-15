Button +

Convierte tu configuración de Homey en un centro de control más inteligente y más limpio para las cosas que usas cada día.

Button + facilita la creación de paneles de control físicos personalizados que se sienten como un panel smart home de gama alta en lugar de una mezcla desordenada de interruptores y páginas. Con un panel Button + puedes reunir en un solo lugar los controles que realmente usas, mostrar el estado en vivo de un vistazo y hacer que tu hogar se sienta más pulido e intuitivo.

Por qué vale la pena Button +

1. Control con un solo toque para tus dispositivos y escenas más importantes.
2. Respuesta visual rápida con etiquetas personalizadas, texto de estado y valores de pantalla en vivo.
3. Una experiencia smart home montada en la pared más limpia, sin tener que rebuscar en menús.
4. Diseños flexibles para botones, pantallas y paneles agrupados.
5. Uso diario más rápido para rutinas como iluminación, clima, seguridad y medios.
6. Un aspecto moderno y personalizable que se integra con tu hogar y tu configuración de hardware.

Configuración rápida

1. Instala la aplicación en tu Homey.
2. Abre la página Button + App settings / Configuration en Homey.

Hay tres áreas principales de configuración en la aplicación.

1. Button bar configurations.
2. Display configurations.
3. Group configurations.

Cada área de configuración tiene un conjunto de espacios para crear los diseños de tus paneles. Las configuraciones de button bar se usan para los botones de control, las configuraciones de display se usan para la pantalla del panel y las configuraciones de grupo te permiten combinarlas en una configuración completa de panel Button +.

Configurar las button bar configurations

1. Selecciona Button bar Configurations en la primera lista desplegable.
2. Selecciona un número de configuración para editar. Ese número podrá asignarse más adelante a un panel Button+.
3. En Left button bar están las opciones para el botón situado en el lado izquierdo de la Button+ button bar.
4. Selecciona en la lista desplegable un dispositivo Homey que quieras controlar. Los paneles admiten boolean capabilities, aunque el filtrado todavía se está mejorando.
5. Selecciona una capability en la lista desplegable.
6. Introduce un Top Label si lo deseas. Se mostrará en verde en la pantalla del botón.
7. Introduce un Label. Se mostrará en blanco y con un tamaño de letra mayor en la pantalla del botón, justo debajo del Top Text.
8. Repite los pasos para Right button bar.
9. Haz clic en el botón Save Configurations.

Configurar las display configurations

1. Selecciona Display Configurations en la primera lista desplegable.
2. Selecciona un número de configuración para editar. Más adelante podrá asignarse a un display Button+.
3. Haz clic en New Display Item.
4. Selecciona un Device.
5. Selecciona una Capability.
6. Edita el Label si es necesario.
7. Edita las Units si es necesario. Esto es solo texto y no cambia los valores enviados a la pantalla.
8. Introduce las posiciones X e Y. Son porcentajes del ancho y de la altura de la pantalla.
9. Introduce un ancho. También es un porcentaje del ancho de la pantalla.
10. Introduce un valor de Rounding. 0 significa números enteros, 1 significa 1 decimal, y así sucesivamente.
11. Selecciona un Font Size de la lista.
12. Agrega más elementos de pantalla según sea necesario.
13. Haz clic en Save Configurations.

Configurar grupos

Los grupos son la forma más sencilla de definir un panel físico Button + completo. Un grupo representa un diseño de panel terminado y puede combinar:

1. una configuración de pantalla.
2. una o más configuraciones de button bar o connector.
3. un nombre personalizado para el panel.

Para configurar un grupo:

1. Abre la pestaña Group Configurations en la configuración de la aplicación.
2. Selecciona un grupo existente o haz clic en el botón + para crear uno nuevo.
3. Dale al grupo un nombre como Panel del salón o Panel del pasillo principal.
4. Elige la configuración de pantalla que quieres asignar a ese grupo.
5. Asigna al grupo una o más configuraciones de connector o button.
6. Usa el área de vista previa para revisar el diseño completo del panel antes de guardar.
7. Duplica o elimina grupos según sea necesario si quieres varios diseños de panel.

Esto es útil cuando quieres diferentes paneles físicos en diferentes habitaciones o para distintos propósitos mientras reutilizas los mismos ajustes predefinidos de pantalla y botones.

Agregar un dispositivo a Homey

1. Selecciona la opción New Device en Homey.
2. Selecciona Button button bar.
3. Haz clic en Connect.
4. Entonces deberías ver el dispositivo en la lista, así que selecciónalo y continúa. La aplicación usa actualmente el Name de General settings para identificar la button bar. Si no se encuentra el Button +, puedes intentar añadirlo manualmente seleccionando la opción Manual e introduciendo la dirección IP.
5. El dispositivo se añadirá a Homey.

Usar el dispositivo Homey

1. Abre el dispositivo en Homey.
2. Abre la segunda pestaña para ver una lista de configuraciones de la pantalla y de cada connector.
3. Selecciona el Display o un número de Connector en la lista desplegable superior. Homey dibuja actualmente la lista Configuration sobre la lista desplegable, por lo que puede resultar molesto seleccionar lo que quieres.
4. Selecciona un número de Configuration para aplicarlo al Display o al connector de button bar.
5. La configuración se sube al simulador, pero tienes que actualizar el simulador para que surta efecto. Hay un botón a la derecha de Virtual Id para actualizar la página.
6. Ahora deberías ver en la button bar la información que seleccionaste en la configuración.
7. Puedes hacer clic en los botones de las mini displays para alternar la capability en Homey.

La aplicación tiene un broker MQTT integrado, así que no hace falta configurarlo. Sin embargo, es posible añadir uno o más brokers MQTT externos en la página de configuración de la aplicación.
