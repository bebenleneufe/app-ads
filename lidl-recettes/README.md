# Semainier Lidl

Générateur de menus pour la semaine. Il produit aussi la liste de courses et une estimation du ticket de caisse, en utilisant uniquement des produits de l'assortiment permanent Lidl.

## Fonctionnalités

- **Perte de poids** : à partir du profil (sexe, âge, poids, taille, activité), le besoin journalier est calculé avec la formule de Mifflin-St Jeor, moins 500 kcal. Seules les recettes sous la cible d'un repas (35 % de la journée) sont proposées, en privilégiant les plus légères. Les calories sont affichées pour chaque repas et chaque jour.
- **Menus** : de 1 à 7 jours, dîner seul ou déjeuner et dîner, de 1 à 8 personnes.
- **Régimes** : tout, sans viande (poisson autorisé), végétarien, avec une option sans porc.
- **Choix des recettes** : le générateur préfère les recettes qui partagent des ingrédients, pour moins gaspiller de paquets entamés. Il équilibre aussi viande, poisson et végétarien.
- **Budget** : si tu fixes un plafond, les recettes les plus chères sont remplacées jusqu'à passer dessous, quand c'est possible.
- **Bouton « Changer »** : remplace un seul repas sans toucher aux autres.
- **Liste de courses** : rangée par rayon, arrondie au paquet entier. Chaque ligne indique le besoin réel et le reste. Tu peux cocher les articles pendant les courses.
- **Ticket estimé** : total à payer, valeur réellement consommée dans la semaine et coût par portion. Les basiques du placard (huile, épices, condiments) peuvent être exclus du total.
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
| `js/planner.js` | Génération du planning, changement d'un repas, ajustement au budget |
| `js/nutrition-facts.js` | Valeurs énergétiques moyennes de chaque produit |
| `js/nutrition.js` | Calories par recette, besoin journalier, cible par repas |
| `js/shopping-list.js` | Regroupement des besoins, arrondi au paquet, calcul des totaux |
| `js/render.js` | Affichage (DocumentFragment, aucun `innerHTML`) |
| `js/app.js` | Contrôleur : état, écouteurs (debounce, nettoyage via `AbortController`) |

## À propos des prix

Les prix sont **des estimations** basées sur le niveau de prix Lidl France (septembre 2026), hors promotions. Ils varient selon le magasin. Lidl ne publie pas de catalogue alimentaire complet avec les prix en ligne : pour ajuster, modifie le champ `price` dans `js/catalog.js`.

Ce projet est un outil personnel, non affilié à Lidl.
