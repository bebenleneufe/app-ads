// Prix indicatifs de l'assortiment permanent Lidl France (niveau de prix de septembre 2026).
// Ils varient selon le magasin et les promotions : l'interface les présente toujours comme une estimation.

// L'ordre suit le parcours habituel d'un magasin Lidl : fruits et légumes à l'entrée,
// épicerie au centre, produits frais le long des murs et surgelés en dernier pour
// qu'ils restent froids jusqu'à la caisse. La disposition exacte varie selon le magasin.
export const AISLES = Object.freeze({
  PRODUCE: 'Fruits & légumes',
  BAKERY: 'Pain',
  STARCHES: 'Pâtes, riz & légumineuses',
  CANS: 'Conserves & sauces',
  WORLD: 'Cuisine du monde',
  BREAKFAST: 'Petit-déjeuner & fruits secs',
  PANTRY: 'Huiles, condiments & épices',
  DAIRY: 'Crèmerie & œufs',
  CHILLED: 'Frais : pâtes, gnocchi & tofu',
  MEAT: 'Boucherie & charcuterie',
  FISH: 'Poissonnerie',
  FROZEN: 'Surgelés',
});

export const AISLE_ORDER = Object.freeze([
  AISLES.PRODUCE,
  AISLES.BAKERY,
  AISLES.STARCHES,
  AISLES.CANS,
  AISLES.WORLD,
  AISLES.BREAKFAST,
  AISLES.PANTRY,
  AISLES.DAIRY,
  AISLES.CHILLED,
  AISLES.MEAT,
  AISLES.FISH,
  AISLES.FROZEN,
]);

// Rayons dont les restes se gardent plusieurs semaines : ils serviront aux courses suivantes.
export const LONG_LASTING_AISLES = Object.freeze([
  AISLES.STARCHES,
  AISLES.CANS,
  AISLES.WORLD,
  AISLES.BREAKFAST,
  AISLES.PANTRY,
  AISLES.FROZEN,
]);

export const UNITS = Object.freeze({ GRAM: 'g', MILLILITER: 'ml', PIECE: 'pièce' });

function defineProduct({
  id,
  name,
  brand = null,
  aisle,
  packageLabel,
  packageSize,
  unit,
  price,
  shortName,
  pieceNames = null,
  isPantryStaple = false,
}) {
  return Object.freeze({
    id,
    name,
    brand,
    aisle,
    packageLabel,
    packageSize,
    unit,
    price,
    shortName,
    pieceNames,
    isPantryStaple,
  });
}

export const PRODUCTS = Object.freeze([
  defineProduct({ id: 'oignon', name: 'Oignons jaunes', aisle: AISLES.PRODUCE, packageLabel: 'filet 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 1.29, shortName: 'oignon' }),
  defineProduct({ id: 'ail', name: 'Ail', aisle: AISLES.PRODUCE, packageLabel: 'filet 250 g', packageSize: 250, unit: UNITS.GRAM, price: 1.49, shortName: 'ail' }),
  defineProduct({ id: 'carotte', name: 'Carottes', aisle: AISLES.PRODUCE, packageLabel: 'sachet 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 0.99, shortName: 'carottes' }),
  defineProduct({ id: 'pomme-de-terre', name: 'Pommes de terre', aisle: AISLES.PRODUCE, packageLabel: 'sac 2,5 kg', packageSize: 2500, unit: UNITS.GRAM, price: 2.49, shortName: 'pommes de terre' }),
  defineProduct({ id: 'patate-douce', name: 'Patates douces', aisle: AISLES.PRODUCE, packageLabel: 'sachet 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 2.49, shortName: 'patates douces' }),
  defineProduct({ id: 'tomate', name: 'Tomates rondes', aisle: AISLES.PRODUCE, packageLabel: 'barquette 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 2.49, shortName: 'tomates' }),
  defineProduct({ id: 'courgette', name: 'Courgettes', aisle: AISLES.PRODUCE, packageLabel: 'sachet 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 1.99, shortName: 'courgettes' }),
  defineProduct({ id: 'poireau', name: 'Poireaux', aisle: AISLES.PRODUCE, packageLabel: 'botte 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 1.99, shortName: 'poireaux' }),
  defineProduct({ id: 'champignon', name: 'Champignons de Paris', aisle: AISLES.PRODUCE, packageLabel: 'barquette 500 g', packageSize: 500, unit: UNITS.GRAM, price: 1.89, shortName: 'champignons' }),
  defineProduct({ id: 'poivron', name: 'Poivrons tricolores', aisle: AISLES.PRODUCE, packageLabel: 'sachet de 3', packageSize: 3, unit: UNITS.PIECE, price: 1.99, shortName: 'poivron', pieceNames: ['poivron', 'poivrons'] }),
  defineProduct({ id: 'aubergine', name: 'Aubergine', aisle: AISLES.PRODUCE, packageLabel: 'à la pièce', packageSize: 1, unit: UNITS.PIECE, price: 0.99, shortName: 'aubergine', pieceNames: ['aubergine', 'aubergines'] }),
  defineProduct({ id: 'brocoli', name: 'Brocoli', aisle: AISLES.PRODUCE, packageLabel: 'à la pièce', packageSize: 1, unit: UNITS.PIECE, price: 1.49, shortName: 'brocoli', pieceNames: ['brocoli', 'brocolis'] }),
  defineProduct({ id: 'salade', name: 'Laitue', aisle: AISLES.PRODUCE, packageLabel: 'à la pièce', packageSize: 1, unit: UNITS.PIECE, price: 0.89, shortName: 'laitue', pieceNames: ['laitue', 'laitues'] }),
  defineProduct({ id: 'concombre', name: 'Concombre', aisle: AISLES.PRODUCE, packageLabel: 'à la pièce', packageSize: 1, unit: UNITS.PIECE, price: 0.79, shortName: 'concombre', pieceNames: ['concombre', 'concombres'] }),
  defineProduct({ id: 'avocat', name: 'Avocats', aisle: AISLES.PRODUCE, packageLabel: 'filet de 2', packageSize: 2, unit: UNITS.PIECE, price: 1.99, shortName: 'avocat', pieceNames: ['avocat', 'avocats'] }),
  defineProduct({ id: 'citron', name: 'Citrons jaunes', aisle: AISLES.PRODUCE, packageLabel: 'filet de 4', packageSize: 4, unit: UNITS.PIECE, price: 1.49, shortName: 'citron', pieceNames: ['citron', 'citrons'] }),
  defineProduct({ id: 'banane', name: 'Bananes', aisle: AISLES.PRODUCE, packageLabel: 'régime ≈ 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 1.69, shortName: 'banane' }),
  defineProduct({ id: 'pomme', name: 'Pommes Golden', aisle: AISLES.PRODUCE, packageLabel: 'sachet 1,5 kg', packageSize: 1500, unit: UNITS.GRAM, price: 2.49, shortName: 'pomme' }),
  defineProduct({ id: 'persil', name: 'Persil plat', aisle: AISLES.PRODUCE, packageLabel: 'bouquet', packageSize: 1, unit: UNITS.PIECE, price: 0.79, shortName: 'persil', pieceNames: ['bouquet de persil', 'bouquets de persil'] }),

  defineProduct({ id: 'poulet-filet', name: 'Filets de poulet', aisle: AISLES.MEAT, packageLabel: 'barquette 500 g', packageSize: 500, unit: UNITS.GRAM, price: 5.49, shortName: 'filet de poulet' }),
  defineProduct({ id: 'cuisse-poulet', name: 'Cuisses de poulet', aisle: AISLES.MEAT, packageLabel: 'barquette 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 3.99, shortName: 'cuisses de poulet' }),
  defineProduct({ id: 'boeuf-hache', name: 'Viande hachée de bœuf 5 % MG', aisle: AISLES.MEAT, packageLabel: 'barquette 500 g', packageSize: 500, unit: UNITS.GRAM, price: 4.99, shortName: 'bœuf haché' }),
  defineProduct({ id: 'lardons', name: 'Lardons fumés', aisle: AISLES.MEAT, packageLabel: '2 × 100 g', packageSize: 200, unit: UNITS.GRAM, price: 1.79, shortName: 'lardons' }),
  defineProduct({ id: 'saucisse', name: 'Saucisses de Toulouse', aisle: AISLES.MEAT, packageLabel: 'barquette 450 g', packageSize: 450, unit: UNITS.GRAM, price: 3.49, shortName: 'saucisses de Toulouse' }),
  defineProduct({ id: 'jambon', name: 'Jambon blanc', aisle: AISLES.MEAT, packageLabel: '4 tranches, 160 g', packageSize: 160, unit: UNITS.GRAM, price: 1.99, shortName: 'jambon blanc' }),
  defineProduct({ id: 'chorizo', name: 'Chorizo doux', aisle: AISLES.MEAT, packageLabel: 'pièce 225 g', packageSize: 225, unit: UNITS.GRAM, price: 2.29, shortName: 'chorizo' }),

  defineProduct({ id: 'saumon', name: 'Pavés de saumon', aisle: AISLES.FISH, packageLabel: '2 pavés, 250 g', packageSize: 250, unit: UNITS.GRAM, price: 4.99, shortName: 'saumon' }),
  defineProduct({ id: 'crevettes', name: 'Crevettes cuites décortiquées', aisle: AISLES.FISH, packageLabel: 'barquette 200 g', packageSize: 200, unit: UNITS.GRAM, price: 3.79, shortName: 'crevettes' }),
  defineProduct({ id: 'thon', name: 'Thon au naturel', brand: 'Nixe', aisle: AISLES.CANS, packageLabel: 'boîte 140 g', packageSize: 140, unit: UNITS.GRAM, price: 1.39, shortName: 'thon' }),

  defineProduct({ id: 'oeuf', name: 'Œufs de poules élevées en plein air', aisle: AISLES.DAIRY, packageLabel: 'boîte de 12', packageSize: 12, unit: UNITS.PIECE, price: 3.29, shortName: 'œuf', pieceNames: ['œuf', 'œufs'] }),
  defineProduct({ id: 'lait', name: 'Lait demi-écrémé', brand: 'Milbona', aisle: AISLES.DAIRY, packageLabel: 'bouteille 1 L', packageSize: 1000, unit: UNITS.MILLILITER, price: 0.99, shortName: 'lait' }),
  defineProduct({ id: 'creme-epaisse', name: 'Crème fraîche épaisse 15 %', brand: 'Milbona', aisle: AISLES.DAIRY, packageLabel: 'pot 20 cl', packageSize: 200, unit: UNITS.MILLILITER, price: 0.95, shortName: 'crème fraîche' }),
  defineProduct({ id: 'beurre', name: 'Beurre doux', brand: 'Milbona', aisle: AISLES.DAIRY, packageLabel: 'plaquette 250 g', packageSize: 250, unit: UNITS.GRAM, price: 2.39, shortName: 'beurre' }),
  defineProduct({ id: 'emmental', name: 'Emmental râpé', brand: 'Milbona', aisle: AISLES.DAIRY, packageLabel: 'sachet 200 g', packageSize: 200, unit: UNITS.GRAM, price: 1.89, shortName: 'emmental râpé' }),
  defineProduct({ id: 'mozzarella', name: 'Mozzarella', brand: 'Milbona', aisle: AISLES.DAIRY, packageLabel: 'boule 125 g', packageSize: 125, unit: UNITS.GRAM, price: 0.79, shortName: 'mozzarella' }),
  defineProduct({ id: 'parmesan', name: 'Grana Padano AOP', brand: 'Italiamo', aisle: AISLES.DAIRY, packageLabel: 'portion 200 g', packageSize: 200, unit: UNITS.GRAM, price: 2.99, shortName: 'grana padano' }),
  defineProduct({ id: 'feta', name: 'Feta AOP', brand: 'Eridanous', aisle: AISLES.DAIRY, packageLabel: 'bloc 200 g', packageSize: 200, unit: UNITS.GRAM, price: 1.99, shortName: 'feta' }),
  defineProduct({ id: 'fromage-blanc', name: 'Fromage blanc 0 %', brand: 'Milbona', aisle: AISLES.DAIRY, packageLabel: 'pot 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 1.89, shortName: 'fromage blanc 0 %' }),
  defineProduct({ id: 'chevre', name: 'Bûche de chèvre', aisle: AISLES.DAIRY, packageLabel: 'bûche 180 g', packageSize: 180, unit: UNITS.GRAM, price: 1.79, shortName: 'chèvre' }),
  defineProduct({ id: 'tofu', name: 'Tofu nature', brand: 'Vemondo', aisle: AISLES.CHILLED, packageLabel: 'bloc 200 g', packageSize: 200, unit: UNITS.GRAM, price: 1.69, shortName: 'tofu' }),

  defineProduct({ id: 'pain-complet', name: 'Pain de mie complet', aisle: AISLES.BAKERY, packageLabel: 'sachet 500 g', packageSize: 500, unit: UNITS.GRAM, price: 1.29, shortName: 'pain complet' }),
  defineProduct({ id: 'pate-brisee', name: 'Pâte brisée', aisle: AISLES.CHILLED, packageLabel: 'rouleau 230 g', packageSize: 1, unit: UNITS.PIECE, price: 0.95, shortName: 'pâte brisée', pieceNames: ['rouleau de pâte brisée', 'rouleaux de pâte brisée'] }),
  defineProduct({ id: 'pate-feuilletee', name: 'Pâte feuilletée', aisle: AISLES.CHILLED, packageLabel: 'rouleau 230 g', packageSize: 1, unit: UNITS.PIECE, price: 0.99, shortName: 'pâte feuilletée', pieceNames: ['rouleau de pâte feuilletée', 'rouleaux de pâte feuilletée'] }),
  defineProduct({ id: 'gnocchi', name: 'Gnocchi de pommes de terre', brand: 'Italiamo', aisle: AISLES.CHILLED, packageLabel: 'sachet 500 g', packageSize: 500, unit: UNITS.GRAM, price: 1.29, shortName: 'gnocchi' }),
  defineProduct({ id: 'tortilla', name: 'Tortillas de blé', aisle: AISLES.WORLD, packageLabel: 'sachet de 8', packageSize: 8, unit: UNITS.PIECE, price: 1.49, shortName: 'tortilla', pieceNames: ['tortilla', 'tortillas'] }),
  defineProduct({ id: 'pain-burger', name: 'Pains burger', aisle: AISLES.BAKERY, packageLabel: 'sachet de 4', packageSize: 4, unit: UNITS.PIECE, price: 1.29, shortName: 'pain burger', pieceNames: ['pain burger', 'pains burger'] }),

  defineProduct({ id: 'flocons-avoine', name: "Flocons d'avoine", brand: 'Crownfield', aisle: AISLES.BREAKFAST, packageLabel: 'sachet 500 g', packageSize: 500, unit: UNITS.GRAM, price: 0.99, shortName: "flocons d'avoine" }),
  defineProduct({ id: 'amandes', name: 'Amandes décortiquées', brand: 'Alesto', aisle: AISLES.BREAKFAST, packageLabel: 'sachet 200 g', packageSize: 200, unit: UNITS.GRAM, price: 2.49, shortName: 'amandes' }),
  defineProduct({ id: 'spaghetti', name: 'Spaghetti', brand: 'Combino', aisle: AISLES.STARCHES, packageLabel: 'paquet 500 g', packageSize: 500, unit: UNITS.GRAM, price: 0.85, shortName: 'spaghetti' }),
  defineProduct({ id: 'penne', name: 'Penne rigate', brand: 'Combino', aisle: AISLES.STARCHES, packageLabel: 'paquet 500 g', packageSize: 500, unit: UNITS.GRAM, price: 0.85, shortName: 'penne' }),
  defineProduct({ id: 'riz', name: 'Riz basmati', brand: 'Golden Sun', aisle: AISLES.STARCHES, packageLabel: 'paquet 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 2.29, shortName: 'riz basmati' }),
  defineProduct({ id: 'semoule', name: 'Semoule de blé moyenne', aisle: AISLES.STARCHES, packageLabel: 'paquet 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 1.39, shortName: 'semoule' }),
  defineProduct({ id: 'nouilles', name: 'Nouilles aux œufs', brand: 'Vitasia', aisle: AISLES.WORLD, packageLabel: 'paquet 250 g', packageSize: 250, unit: UNITS.GRAM, price: 1.29, shortName: 'nouilles' }),
  defineProduct({ id: 'lentilles-corail', name: 'Lentilles corail', aisle: AISLES.STARCHES, packageLabel: 'sachet 500 g', packageSize: 500, unit: UNITS.GRAM, price: 1.69, shortName: 'lentilles corail' }),
  defineProduct({ id: 'lentilles-vertes', name: 'Lentilles vertes', aisle: AISLES.STARCHES, packageLabel: 'sachet 500 g', packageSize: 500, unit: UNITS.GRAM, price: 1.49, shortName: 'lentilles vertes' }),
  defineProduct({ id: 'pois-chiches', name: 'Pois chiches', brand: 'Freshona', aisle: AISLES.CANS, packageLabel: 'boîte 400 g (265 g égouttés)', packageSize: 265, unit: UNITS.GRAM, price: 0.79, shortName: 'pois chiches égouttés' }),
  defineProduct({ id: 'haricots-rouges', name: 'Haricots rouges', brand: 'Freshona', aisle: AISLES.CANS, packageLabel: 'boîte 400 g (250 g égouttés)', packageSize: 250, unit: UNITS.GRAM, price: 0.79, shortName: 'haricots rouges égouttés' }),
  defineProduct({ id: 'mais', name: 'Maïs doux', brand: 'Freshona', aisle: AISLES.CANS, packageLabel: 'boîte 285 g égouttés', packageSize: 285, unit: UNITS.GRAM, price: 0.89, shortName: 'maïs' }),
  defineProduct({ id: 'tomates-concassees', name: 'Tomates concassées', brand: 'Freshona', aisle: AISLES.CANS, packageLabel: 'boîte 400 g', packageSize: 400, unit: UNITS.GRAM, price: 0.65, shortName: 'tomates concassées' }),
  defineProduct({ id: 'coulis', name: 'Coulis de tomate', aisle: AISLES.CANS, packageLabel: 'brique 500 g', packageSize: 500, unit: UNITS.GRAM, price: 0.79, shortName: 'coulis de tomate' }),
  defineProduct({ id: 'lait-coco', name: 'Lait de coco', brand: 'Vitasia', aisle: AISLES.WORLD, packageLabel: 'boîte 400 ml', packageSize: 400, unit: UNITS.MILLILITER, price: 1.29, shortName: 'lait de coco' }),
  defineProduct({ id: 'pesto', name: 'Pesto alla genovese', brand: 'Italiamo', aisle: AISLES.CANS, packageLabel: 'bocal 190 g', packageSize: 190, unit: UNITS.GRAM, price: 1.59, shortName: 'pesto' }),

  defineProduct({ id: 'epinards', name: 'Épinards en branches', aisle: AISLES.FROZEN, packageLabel: 'sachet 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 1.79, shortName: 'épinards surgelés' }),
  defineProduct({ id: 'haricots-verts', name: 'Haricots verts extra-fins', aisle: AISLES.FROZEN, packageLabel: 'sachet 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 1.99, shortName: 'haricots verts surgelés' }),
  defineProduct({ id: 'colin', name: "Filets de colin d'Alaska", aisle: AISLES.FROZEN, packageLabel: 'étui 400 g', packageSize: 400, unit: UNITS.GRAM, price: 3.49, shortName: 'colin surgelé' }),

  defineProduct({ id: 'huile-olive', name: "Huile d'olive vierge extra", brand: 'Primadonna', aisle: AISLES.PANTRY, packageLabel: 'bouteille 1 L', packageSize: 1000, unit: UNITS.MILLILITER, price: 7.99, shortName: "huile d'olive", isPantryStaple: true }),
  defineProduct({ id: 'vinaigre', name: 'Vinaigre balsamique de Modène', aisle: AISLES.PANTRY, packageLabel: 'bouteille 500 ml', packageSize: 500, unit: UNITS.MILLILITER, price: 1.49, shortName: 'vinaigre balsamique', isPantryStaple: true }),
  defineProduct({ id: 'moutarde', name: 'Moutarde de Dijon', aisle: AISLES.PANTRY, packageLabel: 'bocal 370 g', packageSize: 370, unit: UNITS.GRAM, price: 0.99, shortName: 'moutarde', isPantryStaple: true }),
  defineProduct({ id: 'sauce-soja', name: 'Sauce soja', brand: 'Vitasia', aisle: AISLES.WORLD, packageLabel: 'bouteille 250 ml', packageSize: 250, unit: UNITS.MILLILITER, price: 1.39, shortName: 'sauce soja', isPantryStaple: true }),
  defineProduct({ id: 'bouillon', name: 'Bouillon de légumes', aisle: AISLES.PANTRY, packageLabel: 'boîte de 12 cubes', packageSize: 12, unit: UNITS.PIECE, price: 0.99, shortName: 'cube de bouillon', pieceNames: ['cube de bouillon', 'cubes de bouillon'], isPantryStaple: true }),
  defineProduct({ id: 'curry', name: 'Curry en poudre', brand: 'Kania', aisle: AISLES.PANTRY, packageLabel: 'pot 45 g', packageSize: 45, unit: UNITS.GRAM, price: 0.99, shortName: 'curry', isPantryStaple: true }),
  defineProduct({ id: 'paprika', name: 'Paprika doux', brand: 'Kania', aisle: AISLES.PANTRY, packageLabel: 'pot 50 g', packageSize: 50, unit: UNITS.GRAM, price: 0.99, shortName: 'paprika', isPantryStaple: true }),
  defineProduct({ id: 'cumin', name: 'Cumin moulu', brand: 'Kania', aisle: AISLES.PANTRY, packageLabel: 'pot 40 g', packageSize: 40, unit: UNITS.GRAM, price: 0.99, shortName: 'cumin', isPantryStaple: true }),
  defineProduct({ id: 'herbes', name: 'Herbes de Provence', brand: 'Kania', aisle: AISLES.PANTRY, packageLabel: 'pot 20 g', packageSize: 20, unit: UNITS.GRAM, price: 0.99, shortName: 'herbes de Provence', isPantryStaple: true }),
  defineProduct({ id: 'poivre', name: 'Poivre noir moulu', brand: 'Kania', aisle: AISLES.PANTRY, packageLabel: 'pot 50 g', packageSize: 50, unit: UNITS.GRAM, price: 1.19, shortName: 'poivre', isPantryStaple: true }),
]);

export const PRODUCTS_BY_ID = new Map(PRODUCTS.map((product) => [product.id, product]));
