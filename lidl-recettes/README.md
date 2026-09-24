# Semainier Lidl

Générateur de menus pour la semaine. Il produit aussi la liste de courses et une estimation du ticket de caisse, en utilisant uniquement des produits de l'assortiment permanent Lidl.

## Fonctionnalités

- **Perte de poids** : à partir du profil (sexe, âge, poids, taille, activité), le besoin journalier est calculé avec la formule de Mifflin-St Jeor, moins 500 kcal. Cible par repas : 25 % au petit-déjeuner, 35 % au déjeuner, 35 % au dîner. Les recettes au-dessus de la cible sont écartées, et le générateur choisit celles qui s'en approchent le plus, pour ne pas manger trop peu. Les calories sont affichées pour chaque repas et chaque jour.
- **Trois repas par jour** : le même petit-déjeuner simple toute la semaine (affiché une fois en tête des menus, « Changer » le remplace pour tous les jours), puis par défaut le même plat au déjeuner et au dîner, cuisiné une fois en double (7 plats par semaine au lieu de 14). On peut aussi choisir deux plats différents ou le dîner seul.
- **Temps de préparation** : 15, 20 (par défaut) ou 30 minutes maximum, ou sans limite. Avec une limite, 6 ingrédients frais maximum (l'huile et les épices ne comptent pas). Plus de 75 plats font 20 minutes ou moins (108 plats et 7 petits-déjeuners au total).
- **Priorité petit prix** : le générateur calcule ce que chaque recette ajoute vraiment au ticket, en tenant compte des paquets déjà ouverts, et privilégie celles qui les finissent. Environ 34 € la semaine pour 1 personne et 3 repas par jour (médiane mesurée sur 200 semaines), contre 63 € sans ce calcul. Les modes « Prix et variété » et « Variété » proposent plus de plats différents.
- **Portions ajustées** : en mode perte de poids, les quantités (sauf produits à la pièce) sont ajustées de 0,9 à 1,5 fois pour que chaque repas atteigne sa cible calorique.
- **Menus** : de 1 à 7 jours, de 1 à 8 personnes.
- **Régimes** : tout, sans viande (poisson autorisé), végétarien, avec une option sans porc.
- **Choix des recettes** : le générateur préfère les recettes qui partagent des ingrédients, pour moins gaspiller de paquets entamés. Il équilibre aussi viande, poisson et végétarien.
- **Budget** : si tu fixes un plafond, les recettes les plus chères sont remplacées jusqu'à passer dessous, quand c'est possible.
- **Bouton « Changer »** : remplace un seul repas sans toucher aux autres.
- **Liste de courses** : rangée par rayon dans l'ordre du parcours habituel d'un magasin Lidl (fruits et légumes, pain, épicerie, frais, puis surgelés en dernier), avec un sous-total par rayon et une barre de progression pendant les courses. Arrondie au paquet entier. Chaque ligne indique le besoin réel et le reste. Tu peux cocher les articles pendant les courses.
- **Ticket estimé** : total à payer, valeur réellement consommée dans la semaine et coût par portion. Les basiques du placard (huile, épices, condiments) peuvent être exclus du total.
- **Photos** : une photo indicative par recette (`images/recettes/<id>.webp`, 480 × 320, environ 18 Ko chacune).
- **Copie** de la liste en texte (pour l'envoyer par message, par exemple).
- La semaine, les réglages et les cases cochées sont mémorisés dans le navigateur (`localStorage`).

## Lancer l'application

Les modules ES ne se chargent pas depuis `file://`. Il faut donc un petit serveur local :

```bash
cd lidl-recettes
npm start          # équivaut à : python3 -m http.server 8000
```

Ouvre ensuite <http://localhost:8000>. Aucune dépendance à installer.

## Tests

```bash
cd lidl-recettes
npm test           # node --test, Node 20 ou plus récent
```

## Structure

| Fichier | Rôle |
| --- | --- |
| `js/catalog.js` | Produits Lidl : rayon, conditionnement, prix indicatif |
| `js/recipes.js` | Recettes, avec les quantités pour une portion |
| `js/meal-structure.js` | Organisation des repas : petit-déjeuner, plat unique ou deux plats |
| `js/planner.js` | Génération du planning, changement d'un repas, ajustement au budget |
| `js/nutrition-facts.js` | Valeurs énergétiques moyennes de chaque produit |
| `js/nutrition.js` | Calories par recette, besoin journalier, cible par repas |
| `js/shopping-list.js` | Regroupement des besoins, arrondi au paquet, calcul des totaux |
| `js/render.js` | Affichage (DocumentFragment, aucun `innerHTML`) |
| `js/app.js` | Contrôleur : état, écouteurs (debounce, nettoyage via `AbortController`) |

## À propos des prix

Les prix sont **des estimations** basées sur le niveau de prix Lidl France (septembre 2026), hors promotions. Ils varient selon le magasin. Lidl ne publie pas de catalogue alimentaire complet avec les prix en ligne : pour ajuster, modifie le champ `price` dans `js/catalog.js`.

Ce projet est un outil personnel, non affilié à Lidl.
