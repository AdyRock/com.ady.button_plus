Button +

Transformez votre installation Homey en un centre de contrôle plus intelligent et plus épuré pour les éléments que vous utilisez chaque jour.

Button + permet de créer facilement des panneaux de commande physiques personnalisés qui ressemblent davantage à un tableau de bord smart home haut de gamme qu'à un ensemble confus d'interrupteurs et de pages. Avec un panneau Button +, vous pouvez regrouper au même endroit les commandes que vous utilisez vraiment, afficher l'état en direct en un coup d'oeil et rendre votre maison plus soignée et plus intuitive.

Pourquoi Button + vaut le coup

1. Contrôle en une seule pression de vos appareils et scènes les plus importants.
2. Retour visuel rapide avec des libellés personnalisés, du texte d'état et des valeurs d'affichage en direct.
3. Une expérience smart home murale plus propre, sans devoir fouiller dans les menus.
4. Des agencements flexibles pour les boutons, les affichages et les panneaux groupés.
5. Une utilisation quotidienne plus rapide pour des routines comme l'éclairage, le climat, la sécurité et les médias.
6. Un style moderne et personnalisable qui s'intègre à votre maison et à votre installation matérielle.

Configuration rapide

1. Installez l'application sur votre Homey.
2. Ouvrez la page Button + App settings / Configuration dans Homey.

L'application comporte trois grandes zones de configuration.

1. Button bar configurations.
2. Display configurations.
3. Group configurations.

Chaque zone de configuration contient un ensemble d'emplacements pour construire la disposition de vos panneaux. Les configurations de button bar servent pour les boutons de commande, les configurations de display servent pour l'affichage du panneau, et les configurations de groupe vous permettent de les combiner en une configuration complète de panneau Button +.

Configurer les button bar configurations

1. Sélectionnez Button bar Configurations dans la première liste déroulante.
2. Sélectionnez un numéro de configuration à modifier. Ce numéro pourra ensuite être attribué à un panneau Button+.
3. Sous Left button bar se trouvent les options du bouton situé sur le côté gauche de la Button+ button bar.
4. Sélectionnez dans la liste déroulante un appareil Homey que vous souhaitez contrôler. Les panneaux prennent en charge les boolean capabilities, même si le filtrage est encore en cours d'amélioration.
5. Sélectionnez une capability dans la liste déroulante.
6. Saisissez un Top Label si vous le souhaitez. Il s'affiche en vert sur l'affichage du bouton.
7. Saisissez un Label. Il s'affiche en blanc et dans une police plus grande sur l'affichage du bouton, juste sous le Top Text.
8. Répétez les étapes pour la Right button bar.
9. Cliquez sur le bouton Save Configurations.

Configurer les display configurations

1. Sélectionnez Display Configurations dans la première liste déroulante.
2. Sélectionnez un numéro de configuration à modifier. Il pourra ensuite être attribué à un display Button+.
3. Cliquez sur New Display Item.
4. Sélectionnez un Device.
5. Sélectionnez une Capability.
6. Modifiez le Label si nécessaire.
7. Modifiez les Units si nécessaire. Il s'agit uniquement de texte et cela ne change pas les valeurs envoyées à l'affichage.
8. Saisissez les positions X et Y. Il s'agit de pourcentages de la largeur et de la hauteur de l'affichage.
9. Saisissez une largeur. Là encore, il s'agit d'un pourcentage de la largeur de l'affichage.
10. Saisissez une valeur de Rounding. 0 signifie nombres entiers, 1 signifie 1 décimale, et ainsi de suite.
11. Sélectionnez une Font Size dans la liste.
12. Ajoutez d'autres éléments d'affichage si nécessaire.
13. Cliquez sur Save Configurations.

Configurer les groupes

Les groupes sont le moyen le plus simple de définir un panneau physique Button + complet. Un groupe représente une disposition de panneau terminée et peut combiner :

1. une configuration d'affichage.
2. une ou plusieurs configurations de button bar ou de connector.
3. un nom personnalisé pour le panneau.

Pour configurer un groupe :

1. Ouvrez l'onglet Group Configurations dans les paramètres de l'application.
2. Sélectionnez un groupe existant ou cliquez sur le bouton + pour en créer un nouveau.
3. Donnez au groupe un nom comme Panneau du salon ou Panneau du couloir principal.
4. Choisissez la configuration d'affichage à attribuer à ce groupe.
5. Attribuez au groupe une ou plusieurs configurations de connector ou de button.
6. Utilisez la zone de prévisualisation pour vérifier la disposition complète du panneau avant d'enregistrer.
7. Dupliquez ou supprimez des groupes selon vos besoins si vous souhaitez plusieurs dispositions de panneau.

Cela est utile si vous souhaitez des panneaux physiques différents dans différentes pièces ou pour différents usages tout en réutilisant les mêmes préréglages de display et de button.

Ajouter un appareil à Homey

1. Sélectionnez l'option New Device dans Homey.
2. Sélectionnez Button button bar.
3. Cliquez sur Connect.
4. Vous devriez alors voir l'appareil dans la liste. Sélectionnez le et continuez. L'application utilise actuellement le Name indiqué dans les General settings pour identifier la button bar. Si le Button + n'est pas trouvé, vous pouvez essayer de l'ajouter manuellement en sélectionnant l'option Manual et en saisissant l'adresse IP.
5. L'appareil sera ajouté à Homey.

Utiliser l'appareil Homey

1. Ouvrez l'appareil dans Homey.
2. Ouvrez le deuxième onglet pour afficher une liste des configurations pour l'affichage et chaque connector.
3. Sélectionnez le Display ou un numéro de Connector dans la liste déroulante supérieure. Homey dessine actuellement la liste Configuration par dessus la liste déroulante, ce qui peut rendre la sélection pénible.
4. Sélectionnez un numéro de Configuration à appliquer au Display ou au connector de button bar.
5. La configuration est téléversée vers le simulateur, mais vous devez actualiser le simulateur pour qu'elle prenne effet. Un bouton se trouve à droite du Virtual Id pour actualiser la page.
6. Vous devriez maintenant voir sur la button bar les informations que vous avez sélectionnées dans la configuration.
7. Vous pouvez cliquer sur les boutons des mini displays pour basculer la capability dans Homey.

L'application dispose d'un broker MQTT intégré, donc aucune configuration n'est nécessaire pour cela. Il est toutefois possible d'ajouter un ou plusieurs brokers MQTT externes dans la page des paramètres de l'application.
