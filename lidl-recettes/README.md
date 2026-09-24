# Semainier Lidl

Générateur de menus pour la semaine. Il produit aussi la liste de courses et une estimation du ticket de caisse, en utilisant uniquement des produits de l'assortiment permanent Lidl. Il est pensé pour perdre du poids en cuisinant vite et pour pas cher.

## Fonctionnalités

### Menus
- **Trois repas et une collation par jour** : le même petit-déjeuner et la même collation toute la semaine (affichés une fois en tête des menus), puis par défaut le même plat au déjeuner et au dîner, cuisiné une fois en double (7 plats par semaine au lieu de 14). On peut aussi choisir deux plats différents ou le dîner seul.
- **Recettes rapides** : 15, 20 (par défaut) ou 30 minutes maximum, ou sans limite. Avec une limite, 6 ingrédients frais maximum (l'huile et les épices ne comptent pas). 88 plats (aucun avec de la tomate crue), 7 petits-déjeuners et 6 collations au total, dont près de 60 plats en 20 minutes ou moins compatibles avec l'objectif par défaut.
- **« J'aime » / « Pas pour moi »** : un plat aimé revient plus souvent, un plat écarté ne revient plus (réautorisable dans les réglages). Les plats des deux dernières semaines sont évités.
- **Bouton « Changer »** : remplace un seul repas, ou le petit-déjeuner et la collation de toute la semaine.
- **Mode cuisine** : les ingrédients puis une étape à la fois, en grand, avec un minuteur quand l'étape annonce une durée. L'écran reste allumé.
- **Photos** : une photo indicative par recette (`images/recettes/<id>.webp`, 480 × 320, environ 18 Ko chacune).
- **Régimes** : tout, sans viande (poisson autorisé), végétarien, avec une option sans porc.

### Perte de poids
- **Besoin calorique** calculé avec la formule de Mifflin-St Jeor, moins 500 kcal (plancher de 1 500 kcal pour un homme, 1 200 pour une femme). Cible par repas : 25 % au petit-déjeuner, 35 % au déjeuner, 35 % au dîner, 5 % pour la collation.
- **Portions ajustées** de 0,9 à 1,5 fois pour que chaque repas atteigne sa cible (sauf produits à la pièce et collations).
- **Protéines** : objectif de 1,6 g par kilo, calculé au-delà d'un IMC de 25 sur le poids correspondant à cet IMC. Affichées par plat et par jour ; les plats riches en protéines sont favorisés.
- **Suivi du poids** : une pesée par jour au plus, courbe, rythme de perte par régression linéaire sur 4 semaines, conseil si la perte est trop rapide (plus d'1 kg par semaine), si elle stagne (moins de 200 g en trois semaines) ou en cas de prise. Chaque pesée met à jour le poids du profil, donc l'objectif calorique.

### Courses
- **Petit prix** : le générateur calcule ce que chaque recette ajoute vraiment au ticket, en tenant compte des paquets déjà ouverts. Environ 38 € la semaine pour 1 personne, 3 repas et une collation par jour (médiane mesurée sur 200 semaines). Les priorités « Prix et variété » (≈ 40 €) et « Variété » (≈ 45 €) proposent plus de plats différents.
- **Liste rangée par rayon** dans l'ordre du parcours habituel d'un magasin Lidl (surgelés en dernier), avec sous-total par rayon, besoin réel, reste de chaque paquet et barre de progression.
- **Mode magasin** : la liste seule, en grand, avec l'écran qui reste allumé.
- **Restes reportés** : quand on passe à la semaine suivante, les restes d'épicerie, de conserves et de surgelés **cochés** (donc achetés) sont gardés en stock et déduits des courses suivantes ; le générateur privilégie les plats qui les finissent.
- **Budget** : plafond respecté à la génération, quand les réglages changent et avec « Changer ».
- **Copie** de la liste en texte (pour l'envoyer par message, par exemple).

### Application
- **Installable sur téléphone** et **utilisable hors ligne** (manifeste et service worker).
- Tout est mémorisé dans le navigateur (`localStorage`) : réglages, semaine, cases cochées, préférences, pesées, stock.

## Lancer l'application

Les modules ES ne se chargent pas depuis `file://`. Il faut donc un petit serveur local :

```bash
cd lidl-recettes
npm start          # équivaut à : python3 -m http.server 8000
```

Ouvre ensuite <http://localhost:8000>. Aucune dépendance à installer.

## Publier et installer sur téléphone

1. Dans les réglages du dépôt GitHub : **Settings → Pages → Build and deployment → Source : GitHub Actions** (à faire une seule fois).
2. Chaque push sur `main` lance les tests puis publie le site (workflow `.github/workflows/pages.yml`). L'appli est alors en ligne à l'adresse `https://<utilisateur>.github.io/<dépôt>/lidl-recettes/`. `app-ads.txt` reste à la racine du site.
3. Sur le téléphone, ouvre cette adresse dans Chrome et touche **« Installer l'appli sur ce téléphone »** en haut de la page (ou menu ⋮ → « Installer l'application »). Choisir « Créer un raccourci » donne un simple lien qui s'ouvre dans Chrome, pas une appli. Sur iPhone : Safari, bouton Partager → « Sur l'écran d'accueil ».
4. Si Chrome affiche « Impossible d'installer cette appli » (fréquent sur Xiaomi), touche **« Télécharger l'appli Android (.apk) »** puis ouvre le fichier téléchargé et autorise l'installation. Cette petite appli (dossier `android/` à la racine du dépôt) affiche le site en plein écran : elle reçoit donc chaque mise à jour du site sans être réinstallée. GitHub la fabrique à chaque publication avec `android/build.sh`. Elle est signée avec la clé `android/semainier.keystore`, versionnée exprès pour qu'une nouvelle version s'installe par-dessus l'ancienne sans perdre les données.

À chaque mise en ligne qui modifie les fichiers, augmente `CACHE_VERSION` dans `sw.js` pour que les téléphones récupèrent la nouvelle version.

## Tests

```bash
cd lidl-recettes
npm test           # node --test, Node 20 ou plus récent
```

Les tests tournent aussi automatiquement sur GitHub à chaque push et pull request (`.github/workflows/tests.yml`).

## Structure

| Fichier | Rôle |
| --- | --- |
| `js/catalog.js` | Produits Lidl : rayon, conditionnement, prix indicatif |
| `js/recipes.js` | Plats, petits-déjeuners et collations, avec les quantités pour une portion |
| `js/meal-structure.js` | Organisation des repas et nombre de portions cuisinées |
| `js/planner.js` | Génération du planning, changement d'un repas, ajustement au budget |
| `js/preferences.js` | Plats aimés, écartés et historique des semaines |
| `js/nutrition-facts.js` | Calories et protéines moyennes de chaque produit |
| `js/nutrition.js` | Besoin journalier, cibles par repas, portions ajustées |
| `js/shopping-list.js` | Regroupement des besoins, stock, arrondi au paquet, totaux |
| `js/stock.js` | Restes reportés d'une semaine à l'autre |
| `js/weight-log.js` | Pesées et analyse de la tendance |
| `js/week.js` | Date de la semaine enregistrée |
| `js/render.js`, `js/render-weight.js` | Affichage (DocumentFragment, aucun `innerHTML`) |
| `js/cook-mode.js`, `js/wake-lock.js` | Mode cuisine, minuteur, écran allumé |
| `js/app.js` | Contrôleur : état, écouteurs (debounce, nettoyage via `AbortController`) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installation sur téléphone et mode hors ligne |

## À propos des prix

Les prix sont **des estimations** basées sur le niveau de prix Lidl France (septembre 2026), hors promotions. Ils varient selon le magasin. Lidl ne publie pas de catalogue alimentaire complet avec les prix en ligne : pour ajuster, modifie le champ `price` dans `js/catalog.js`.

Les calories et protéines sont des valeurs moyennes (table Ciqual) : un repère, pas un avis médical.

Ce projet est un outil personnel, non affilié à Lidl.
