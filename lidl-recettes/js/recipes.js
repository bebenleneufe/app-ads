// Quantités exprimées pour UNE portion, dans l'unité du produit du catalogue (g, ml ou pièce).

export const CATEGORIES = Object.freeze({
  MEAT: 'viande',
  FISH: 'poisson',
  VEGETARIAN: 'vegetarien',
});

export const CATEGORY_LABELS = Object.freeze({
  [CATEGORIES.MEAT]: 'Viande',
  [CATEGORIES.FISH]: 'Poisson',
  [CATEGORIES.VEGETARIAN]: 'Végétarien',
});

function defineRecipe({ id, name, category, containsPork = false, prepMinutes, ingredients, steps }) {
  return Object.freeze({
    id,
    name,
    category,
    containsPork,
    prepMinutes,
    ingredients: Object.freeze({ ...ingredients }),
    steps: Object.freeze([...steps]),
  });
}

export const RECIPES = Object.freeze([
  defineRecipe({
    id: 'spaghetti-bolognaise',
    name: 'Spaghetti bolognaise',
    category: CATEGORIES.MEAT,
    prepMinutes: 35,
    ingredients: { spaghetti: 100, 'boeuf-hache': 100, 'tomates-concassees': 150, oignon: 40, carotte: 40, ail: 3, 'huile-olive': 5, herbes: 1 },
    steps: [
      "Faire revenir l'oignon, l'ail et la carotte hachés dans l'huile.",
      'Ajouter le bœuf, le faire dorer puis verser les tomates et les herbes. Laisser mijoter 20 min.',
      'Cuire les spaghetti, égoutter et servir nappés de sauce.',
    ],
  }),
  defineRecipe({
    id: 'poulet-curry-coco',
    name: 'Poulet au curry et lait de coco, riz basmati',
    category: CATEGORIES.MEAT,
    prepMinutes: 30,
    ingredients: { 'poulet-filet': 125, 'lait-coco': 100, riz: 75, oignon: 40, poivron: 0.5, curry: 2, 'huile-olive': 5 },
    steps: [
      "Émincer l'oignon et le poivron, les faire revenir avec le curry.",
      'Ajouter le poulet en dés, dorer 5 min puis verser le lait de coco. Mijoter 15 min.',
      'Servir avec le riz cuit.',
    ],
  }),
  defineRecipe({
    id: 'chili-con-carne',
    name: 'Chili con carne',
    category: CATEGORIES.MEAT,
    prepMinutes: 40,
    ingredients: { 'boeuf-hache': 100, 'haricots-rouges': 80, 'tomates-concassees': 150, oignon: 40, poivron: 0.33, cumin: 1, paprika: 1, riz: 70, 'huile-olive': 5 },
    steps: [
      "Faire revenir l'oignon et le poivron, ajouter le bœuf et les épices.",
      'Verser les tomates et les haricots rincés, mijoter 25 min.',
      'Servir avec le riz.',
    ],
  }),
  defineRecipe({
    id: 'quiche-lorraine',
    name: 'Quiche lorraine et salade verte',
    category: CATEGORIES.MEAT,
    containsPork: true,
    prepMinutes: 45,
    ingredients: { 'pate-brisee': 0.25, lardons: 50, oeuf: 1, 'creme-epaisse': 40, lait: 50, emmental: 25, salade: 0.25 },
    steps: [
      'Préchauffer le four à 200 °C et foncer un moule avec la pâte.',
      "Faire griller les lardons à sec, les répartir sur la pâte avec l'emmental.",
      'Battre œufs, crème et lait, verser et cuire 35 min. Servir avec la salade.',
    ],
  }),
  defineRecipe({
    id: 'carbonara',
    name: 'Spaghetti carbonara',
    category: CATEGORIES.MEAT,
    containsPork: true,
    prepMinutes: 20,
    ingredients: { spaghetti: 100, lardons: 60, oeuf: 1, parmesan: 20, poivre: 0.5 },
    steps: [
      'Cuire les spaghetti. Pendant ce temps, dorer les lardons à sec.',
      'Battre les œufs avec le fromage râpé et beaucoup de poivre.',
      'Hors du feu, mélanger pâtes, lardons et œufs avec une louche d’eau de cuisson.',
    ],
  }),
  defineRecipe({
    id: 'fajitas-poulet',
    name: 'Fajitas de poulet aux poivrons',
    category: CATEGORIES.MEAT,
    prepMinutes: 25,
    ingredients: { tortilla: 2, 'poulet-filet': 110, poivron: 0.5, oignon: 40, paprika: 1, 'creme-epaisse': 30, salade: 0.15, 'huile-olive': 5 },
    steps: [
      'Émincer poulet, poivron et oignon. Saisir le tout avec le paprika 10 min.',
      'Réchauffer les tortillas à la poêle.',
      'Garnir de poulet, salade et une cuillère de crème.',
    ],
  }),
  defineRecipe({
    id: 'saucisses-puree',
    name: 'Saucisses de Toulouse, purée et haricots verts',
    category: CATEGORIES.MEAT,
    containsPork: true,
    prepMinutes: 35,
    ingredients: { saucisse: 150, 'pomme-de-terre': 250, lait: 60, beurre: 10, 'haricots-verts': 150 },
    steps: [
      'Cuire les pommes de terre épluchées 20 min dans l’eau salée.',
      'Dorer les saucisses à la poêle 15 min en les retournant.',
      'Écraser les pommes de terre avec le lait chaud et le beurre. Cuire les haricots verts 8 min.',
    ],
  }),
  defineRecipe({
    id: 'hachis-parmentier',
    name: 'Hachis parmentier',
    category: CATEGORIES.MEAT,
    prepMinutes: 50,
    ingredients: { 'boeuf-hache': 100, 'pomme-de-terre': 250, lait: 60, beurre: 10, oignon: 40, emmental: 25, 'huile-olive': 5 },
    steps: [
      "Cuire les pommes de terre et préparer une purée avec le lait et le beurre.",
      "Faire revenir l'oignon puis le bœuf haché.",
      'Monter en couches dans un plat, parsemer d’emmental et gratiner 20 min à 200 °C.',
    ],
  }),
  defineRecipe({
    id: 'gnocchi-champignons-jambon',
    name: 'Gnocchi crème, champignons et jambon',
    category: CATEGORIES.MEAT,
    containsPork: true,
    prepMinutes: 20,
    ingredients: { gnocchi: 200, champignon: 100, 'creme-epaisse': 50, jambon: 40, parmesan: 10, 'huile-olive': 5 },
    steps: [
      'Dorer les gnocchi à la poêle avec un filet d’huile, réserver.',
      'Faire sauter les champignons émincés, ajouter le jambon en lanières et la crème.',
      'Remettre les gnocchi, mélanger et parsemer de fromage.',
    ],
  }),
  defineRecipe({
    id: 'cuisses-poulet-patates-douces',
    name: 'Cuisses de poulet rôties, patates douces au four',
    category: CATEGORIES.MEAT,
    prepMinutes: 55,
    ingredients: { 'cuisse-poulet': 250, 'patate-douce': 200, herbes: 1, 'huile-olive': 10, salade: 0.25 },
    steps: [
      'Préchauffer le four à 210 °C. Couper les patates douces en quartiers.',
      "Disposer poulet et patates dans un plat, arroser d'huile et d'herbes.",
      'Rôtir 45 min en retournant à mi-cuisson. Servir avec la salade.',
    ],
  }),
  defineRecipe({
    id: 'poelee-chorizo',
    name: 'Poêlée de pommes de terre, chorizo et poivrons',
    category: CATEGORIES.MEAT,
    containsPork: true,
    prepMinutes: 30,
    ingredients: { chorizo: 50, 'pomme-de-terre': 250, poivron: 0.5, oignon: 40, paprika: 1, 'huile-olive': 10 },
    steps: [
      'Couper les pommes de terre en dés et les faire dorer 15 min dans l’huile.',
      "Ajouter l'oignon, le poivron et le chorizo en rondelles.",
      'Assaisonner au paprika et poursuivre 10 min à feu moyen.',
    ],
  }),
  defineRecipe({
    id: 'burger-maison',
    name: 'Burger maison et potatoes',
    category: CATEGORIES.MEAT,
    prepMinutes: 40,
    ingredients: { 'pain-burger': 1, 'boeuf-hache': 125, emmental: 20, tomate: 60, salade: 0.1, oignon: 20, 'pomme-de-terre': 200, paprika: 1, 'huile-olive': 10 },
    steps: [
      "Couper les pommes de terre en quartiers, les enrober d'huile et de paprika, cuire 35 min à 210 °C.",
      'Former les steaks et les cuire 3 min par face, ajouter le fromage en fin de cuisson.',
      'Monter les burgers avec tomate, salade et oignon.',
    ],
  }),

  defineRecipe({
    id: 'saumon-riz-brocoli',
    name: 'Saumon au citron, riz et brocoli',
    category: CATEGORIES.FISH,
    prepMinutes: 25,
    ingredients: { saumon: 125, riz: 75, brocoli: 0.4, citron: 0.25, 'huile-olive': 5 },
    steps: [
      'Cuire le riz. Cuire le brocoli en fleurettes 6 min à la vapeur.',
      'Saisir le saumon 4 min côté peau puis 2 min de l’autre côté.',
      'Arroser de jus de citron au moment de servir.',
    ],
  }),
  defineRecipe({
    id: 'colin-epinards-puree',
    name: 'Colin à la crème, épinards et purée',
    category: CATEGORIES.FISH,
    prepMinutes: 35,
    ingredients: { colin: 130, epinards: 150, 'creme-epaisse': 40, 'pomme-de-terre': 250, lait: 60, beurre: 10, citron: 0.2 },
    steps: [
      'Préparer une purée avec les pommes de terre, le lait et le beurre.',
      'Faire fondre les épinards à la poêle, ajouter la crème.',
      'Cuire le colin 10 min au four à 200 °C avec un filet de citron.',
    ],
  }),
  defineRecipe({
    id: 'salade-pates-thon',
    name: 'Salade de pâtes au thon, maïs et tomates',
    category: CATEGORIES.FISH,
    prepMinutes: 20,
    ingredients: { penne: 80, thon: 70, mais: 50, tomate: 100, concombre: 0.25, 'huile-olive': 10, vinaigre: 5, moutarde: 3 },
    steps: [
      'Cuire les penne, les rafraîchir sous l’eau froide.',
      'Couper tomates et concombre en dés, émietter le thon.',
      'Mélanger avec le maïs et une vinaigrette moutarde-balsamique.',
    ],
  }),
  defineRecipe({
    id: 'nouilles-crevettes',
    name: 'Nouilles sautées aux crevettes',
    category: CATEGORIES.FISH,
    prepMinutes: 20,
    ingredients: { nouilles: 80, crevettes: 70, carotte: 60, poivron: 0.33, oeuf: 0.5, 'sauce-soja': 15, 'huile-olive': 5, ail: 2 },
    steps: [
      'Cuire les nouilles 4 min, égoutter.',
      "Faire sauter l'ail, la carotte en julienne et le poivron 5 min à feu vif.",
      'Ajouter les crevettes, l’œuf battu, les nouilles et la sauce soja. Mélanger 2 min.',
    ],
  }),
  defineRecipe({
    id: 'spaghetti-thon-tomate',
    name: 'Spaghetti au thon et à la tomate',
    category: CATEGORIES.FISH,
    prepMinutes: 20,
    ingredients: { spaghetti: 100, thon: 60, coulis: 125, oignon: 30, herbes: 1, 'huile-olive': 5 },
    steps: [
      "Faire revenir l'oignon, ajouter le coulis et les herbes, mijoter 10 min.",
      'Ajouter le thon émietté hors du feu.',
      'Mélanger avec les spaghetti cuits.',
    ],
  }),

  defineRecipe({
    id: 'dahl-lentilles',
    name: 'Dahl de lentilles corail',
    category: CATEGORIES.VEGETARIAN,
    prepMinutes: 30,
    ingredients: { 'lentilles-corail': 80, 'lait-coco': 80, 'tomates-concassees': 100, oignon: 40, ail: 3, curry: 2, riz: 60, citron: 0.25 },
    steps: [
      "Faire revenir l'oignon, l'ail et le curry.",
      'Ajouter lentilles rincées, tomates, lait de coco et 150 ml d’eau par personne. Cuire 20 min.',
      'Servir sur le riz avec un filet de citron.',
    ],
  }),
  defineRecipe({
    id: 'chili-sin-carne',
    name: 'Chili sin carne',
    category: CATEGORIES.VEGETARIAN,
    prepMinutes: 35,
    ingredients: { 'haricots-rouges': 120, mais: 60, 'tomates-concassees': 150, poivron: 0.5, oignon: 40, cumin: 1, paprika: 1, riz: 70, 'huile-olive': 5 },
    steps: [
      "Faire revenir l'oignon et le poivron avec les épices.",
      'Ajouter tomates, haricots et maïs égouttés. Mijoter 20 min.',
      'Servir avec le riz.',
    ],
  }),
  defineRecipe({
    id: 'quiche-poireaux-chevre',
    name: 'Quiche poireaux et chèvre',
    category: CATEGORIES.VEGETARIAN,
    prepMinutes: 50,
    ingredients: { 'pate-brisee': 0.25, poireau: 120, chevre: 40, oeuf: 1, 'creme-epaisse': 50, salade: 0.25, beurre: 5 },
    steps: [
      'Faire fondre les poireaux émincés au beurre 15 min.',
      'Garnir la pâte de poireaux et de rondelles de chèvre.',
      'Verser œufs battus et crème, cuire 35 min à 200 °C. Servir avec la salade.',
    ],
  }),
  defineRecipe({
    id: 'penne-pesto-courgettes',
    name: 'Penne au pesto, courgettes et mozzarella',
    category: CATEGORIES.VEGETARIAN,
    prepMinutes: 20,
    ingredients: { penne: 100, pesto: 40, courgette: 150, mozzarella: 60, parmesan: 10, 'huile-olive': 5 },
    steps: [
      'Faire sauter les courgettes en demi-rondelles 8 min.',
      'Cuire les penne, les mélanger au pesto et aux courgettes.',
      'Ajouter la mozzarella en morceaux et le fromage râpé.',
    ],
  }),
  defineRecipe({
    id: 'tortillas-haricots-avocat',
    name: 'Tortillas haricots rouges, avocat et maïs',
    category: CATEGORIES.VEGETARIAN,
    prepMinutes: 15,
    ingredients: { tortilla: 2, 'haricots-rouges': 100, mais: 50, avocat: 0.5, tomate: 80, emmental: 25, cumin: 1 },
    steps: [
      'Écraser grossièrement les haricots avec le cumin et les réchauffer.',
      "Couper l'avocat et la tomate en dés.",
      'Garnir les tortillas, parsemer de fromage et passer 2 min à la poêle.',
    ],
  }),
  defineRecipe({
    id: 'tortilla-espagnole',
    name: 'Tortilla espagnole aux champignons',
    category: CATEGORIES.VEGETARIAN,
    prepMinutes: 35,
    ingredients: { oeuf: 2, 'pomme-de-terre': 200, oignon: 50, champignon: 60, salade: 0.25, 'huile-olive': 10 },
    steps: [
      "Cuire doucement pommes de terre en fines tranches et oignon dans l'huile 15 min.",
      'Ajouter les champignons, puis les œufs battus.',
      'Cuire à couvert 10 min à feu doux, retourner à l’aide d’une assiette. Servir avec la salade.',
    ],
  }),
  defineRecipe({
    id: 'couscous-legumes',
    name: 'Couscous de légumes et pois chiches',
    category: CATEGORIES.VEGETARIAN,
    prepMinutes: 40,
    ingredients: { semoule: 80, 'pois-chiches': 100, carotte: 80, courgette: 100, oignon: 40, 'tomates-concassees': 80, cumin: 1, bouillon: 0.5, 'huile-olive': 5 },
    steps: [
      "Faire revenir l'oignon, ajouter carottes et courgettes en tronçons, tomates, cumin et bouillon.",
      'Couvrir d’eau et mijoter 25 min, ajouter les pois chiches les 5 dernières minutes.',
      'Gonfler la semoule dans son volume d’eau bouillante et servir.',
    ],
  }),
  defineRecipe({
    id: 'wok-tofu',
    name: 'Wok de tofu, brocoli et nouilles',
    category: CATEGORIES.VEGETARIAN,
    prepMinutes: 25,
    ingredients: { tofu: 100, nouilles: 80, brocoli: 0.3, carotte: 60, 'sauce-soja': 15, ail: 2, 'huile-olive': 10 },
    steps: [
      'Dorer le tofu en cubes dans l’huile, réserver.',
      "Faire sauter l'ail, le brocoli et la carotte 6 min.",
      'Ajouter les nouilles cuites, le tofu et la sauce soja.',
    ],
  }),
  defineRecipe({
    id: 'veloute-lentilles-carottes',
    name: 'Velouté de lentilles vertes et carottes',
    category: CATEGORIES.VEGETARIAN,
    prepMinutes: 40,
    ingredients: { 'lentilles-vertes': 70, carotte: 100, oignon: 40, bouillon: 0.5, 'creme-epaisse': 20, cumin: 1, 'huile-olive': 5 },
    steps: [
      "Faire revenir l'oignon et les carottes en rondelles.",
      'Ajouter lentilles, cumin, bouillon et 350 ml d’eau par personne. Cuire 30 min.',
      'Mixer et servir avec une cuillère de crème.',
    ],
  }),
  defineRecipe({
    id: 'feuillete-epinards-feta',
    name: 'Feuilleté épinards et feta',
    category: CATEGORIES.VEGETARIAN,
    prepMinutes: 40,
    ingredients: { 'pate-feuilletee': 0.25, epinards: 150, feta: 50, oeuf: 0.5, salade: 0.25 },
    steps: [
      'Faire fondre les épinards et bien les égoutter.',
      "Mélanger avec la feta émiettée et l'œuf battu.",
      'Garnir la pâte, replier en chausson et cuire 25 min à 200 °C.',
    ],
  }),
  defineRecipe({
    id: 'curry-pois-chiches',
    name: 'Curry de pois chiches aux épinards',
    category: CATEGORIES.VEGETARIAN,
    prepMinutes: 25,
    ingredients: { 'pois-chiches': 130, epinards: 100, 'lait-coco': 80, 'tomates-concassees': 80, curry: 2, oignon: 40, riz: 70 },
    steps: [
      "Faire revenir l'oignon avec le curry.",
      'Ajouter tomates, lait de coco, pois chiches et épinards. Mijoter 15 min.',
      'Servir avec le riz.',
    ],
  }),
  defineRecipe({
    id: 'ratatouille-oeuf',
    name: 'Ratatouille, semoule et œuf au plat',
    category: CATEGORIES.VEGETARIAN,
    prepMinutes: 45,
    ingredients: { courgette: 120, aubergine: 0.4, poivron: 0.4, tomate: 120, oignon: 40, ail: 3, herbes: 1, oeuf: 1, semoule: 60, 'huile-olive': 10 },
    steps: [
      "Couper tous les légumes en dés et les faire revenir dans l'huile avec l'ail.",
      'Ajouter les herbes, couvrir et mijoter 30 min.',
      'Servir avec la semoule et un œuf au plat.',
    ],
  }),
  defineRecipe({
    id: 'gnocchi-tomate-mozzarella',
    name: 'Gnocchi gratinés tomate et mozzarella',
    category: CATEGORIES.VEGETARIAN,
    prepMinutes: 25,
    ingredients: { gnocchi: 200, coulis: 100, mozzarella: 60, herbes: 1, salade: 0.2 },
    steps: [
      'Mélanger les gnocchi crus avec le coulis et les herbes dans un plat.',
      'Couvrir de mozzarella en tranches.',
      'Enfourner 20 min à 210 °C. Servir avec la salade.',
    ],
  }),
  defineRecipe({
    id: 'salade-lentilles-feta',
    name: 'Salade de lentilles, feta et concombre',
    category: CATEGORIES.VEGETARIAN,
    prepMinutes: 30,
    ingredients: { 'lentilles-vertes': 70, feta: 40, concombre: 0.25, tomate: 80, oignon: 15, persil: 0.15, 'huile-olive': 10, vinaigre: 5, moutarde: 3 },
    steps: [
      'Cuire les lentilles 25 min, égoutter et laisser tiédir.',
      'Ajouter concombre, tomate, oignon émincé, persil et feta.',
      'Assaisonner avec la vinaigrette moutarde-balsamique.',
    ],
  }),
]);

export const RECIPES_BY_ID = new Map(RECIPES.map((recipe) => [recipe.id, recipe]));
