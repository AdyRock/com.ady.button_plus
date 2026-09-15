Bouton de contrôle + panneaux

L'application prend en charge le matériel Button +.

Pour configurer l'application :

3. Installez l'application sur votre Homey.
4. Ouvrez la page Bouton + Paramètres de l'application / Configuration dans Homey.
5. Assurez-vous que la case Autoriser la mise à jour de la configuration Button+ est cochée.

Il existe deux types de configurations, barre de boutons et affichage, et chacune dispose actuellement de 20 emplacements.
Les configurations de la barre de boutons sont affichées lorsque la première liste déroulante affiche les configurations de la barre de boutons et les configurations d'affichage sont affichées en modifiant la liste déroulante en Configurations d'affichage.

Configuration des configurations de la barre de boutons :

1. Sélectionnez les configurations de la barre de boutons dans la première liste déroulante.
2. Sélectionnez un numéro de configuration à modifier (nous pourrons attribuer n'importe laquelle des configurations aux panneaux Button+ plus tard).
3. Sous la barre de boutons gauche se trouvent les options du bouton sur le côté gauche de la barre de boutons Button+.
4. Sélectionnez un appareil Homey que vous souhaitez contrôler dans la liste déroulante (les panneaux ne prennent en charge que les capacités booléennes mais le filtrage des listes doit encore être implémenté)
5. Sélectionnez une fonctionnalité dans la liste déroulante.
6. Saisissez une étiquette supérieure (facultatif). Celui-ci est affiché en vert sur l'écran des boutons.
7. Entrez une étiquette. Ceci est affiché en blanc et en police plus grande sur l'écran des boutons, juste en dessous du texte supérieur.
8. Répétez les étapes pour la barre de boutons droite.
9. Cliquez sur le bouton Enregistrer les configurations. Il reste à ajouter une invite si vous oubliez de sauvegarder et de fermer la fenêtre.

Configuration des configurations d'affichage :

1. Sélectionnez Configurations d'affichage dans la première liste déroulante.
2. Sélectionnez un numéro de configuration à modifier (nous pourrons attribuer n'importe laquelle des configurations à Button+ Display ultérieurement).
3. Cliquez sur Nouvel élément d'affichage.
4. Sélectionnez un appareil ou une « variable »
5. Sélectionnez une capacité ou une variable.
6. Modifiez l'étiquette si nécessaire.
7. Modifiez les unités si nécessaire. (ce n'est que du texte et ne modifie pas les valeurs envoyées à l'écran).
8. Entrez les positions X et Y. Il s'agit d'un pourcentage de la largeur/hauteur de l'affichage.
9. Entrez une largeur. Encore une fois, il s'agit d'un pourcentage de la largeur d'affichage.
10. Entrez une valeur d'arrondi. 0 = nombres entiers (entier), 1 est 1 décimale, etc.
11. Sélectionnez une taille de police dans la liste.
12. Ajoutez d'autres éléments d'affichage selon vos besoins.
13. Cliquez sur Enregistrer les configurations.

Ajout d'un appareil à Homey :

1. Sélectionnez l'option Nouvel appareil dans Homey.
2. Sélectionnez Barre de boutons Bouton.
3. Cliquez sur Connecter.
4. Vous devriez alors voir l'appareil répertorié, alors sélectionnez-le et continuez. (L'application utilise actuellement le nom trouvé dans les paramètres généraux pour identifier la barre de boutons). Si le bouton + n'est pas trouvé, vous pouvez essayer de l'ajouter manuellement en sélectionnant l'option Manuel et en saisissant l'adresse IP.
5. L'appareil sera ajouté à Homey.

Utilisation de l'appareil Homey :

1. Ouvrez l'appareil dans Homey.
2. Ouvrez le deuxième onglet pour afficher une liste de configurations pour l'écran et chaque connecteur.
3. Sélectionnez l'écran ou un numéro de connecteur dans la liste déroulante supérieure (Homey dessine actuellement la liste de configuration sur la liste déroulante, il peut donc être difficile de sélectionner ce que vous voulez).
4. Sélectionnez un numéro de configuration à appliquer au connecteur Affichage/barre de boutons.
5. La configuration est téléchargée sur le simulateur, mais vous devez actualiser le simulateur pour qu'elle prenne effet. Il y a un bouton à droite de l'identifiant virtuel pour actualiser la page.
6. Vous devriez maintenant voir les informations que vous avez sélectionnées dans la configuration affichées dans la barre de boutons.
7. Vous pouvez cliquer sur les boutons des mini-écrans pour activer/désactiver la fonctionnalité dans Homey.

L'application dispose d'un courtier MQTT intégré, donc aucune configuration ne sera requise pour cela. Cependant, il est possible d'ajouter un ou plusieurs courtiers MQTT externes dans la page des paramètres de l'application.
