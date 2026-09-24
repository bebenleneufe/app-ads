// Prix de l'assortiment permanent Lidl France, relevés en septembre 2026 dans :
// - les listes de prix nationaux publiées par Lidl (lidl.fr, « Liste des produits comparés », 02/2025 et 07/2026) ;
// - les relevés en magasin Lidl France d'Open Prices (prices.openfoodfacts.org, 2025-2026) ;
// - lidl.fr et les catalogues Lidl (prix hors promotion).
// Sans relevé trouvé, le prix reste une estimation : persil, dinde, chorizo, crevettes, colin, lait,
// ricotta, nouilles, boulgour, quinoa, maïs, haricots blancs, lentilles en boîte, sauce soja, bouillon,
// épinards, petits pois et poêlée surgelés, patates douces, courgettes.

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
  defineProduct({ id: 'oignon', name: 'Oignons jaunes', aisle: AISLES.PRODUCE, packageLabel: 'filet 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 1.69, shortName: 'oignon' }),
  defineProduct({ id: 'ail', name: 'Ail', aisle: AISLES.PRODUCE, packageLabel: 'filet ≈ 200 g', packageSize: 200, unit: UNITS.GRAM, price: 2.99, shortName: 'ail' }),
  defineProduct({ id: 'carotte', name: 'Carottes', aisle: AISLES.PRODUCE, packageLabel: 'sachet 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 1.69, shortName: 'carottes' }),
  defineProduct({ id: 'pomme-de-terre', name: 'Pommes de terre', aisle: AISLES.PRODUCE, packageLabel: 'sac 2,5 kg', packageSize: 2500, unit: UNITS.GRAM, price: 2.99, shortName: 'pommes de terre' }),
  defineProduct({ id: 'patate-douce', name: 'Patates douces', aisle: AISLES.PRODUCE, packageLabel: 'sachet 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 2.49, shortName: 'patates douces' }),
  defineProduct({ id: 'tomate', name: 'Tomates rondes', aisle: AISLES.PRODUCE, packageLabel: 'barquette 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 1.99, shortName: 'tomates' }),
  defineProduct({ id: 'courgette', name: 'Courgettes', aisle: AISLES.PRODUCE, packageLabel: 'sachet 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 1.99, shortName: 'courgettes' }),
  defineProduct({ id: 'poireau', name: 'Poireaux', aisle: AISLES.PRODUCE, packageLabel: 'botte 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 1.69, shortName: 'poireaux' }),
  defineProduct({ id: 'champignon', name: 'Champignons de Paris', aisle: AISLES.PRODUCE, packageLabel: 'barquette 400 g', packageSize: 400, unit: UNITS.GRAM, price: 2.39, shortName: 'champignons' }),
  defineProduct({ id: 'poivron', name: 'Poivrons tricolores', aisle: AISLES.PRODUCE, packageLabel: 'sachet de 3', packageSize: 3, unit: UNITS.PIECE, price: 1.95, shortName: 'poivron', pieceNames: ['poivron', 'poivrons'] }),
  defineProduct({ id: 'aubergine', name: 'Aubergine', aisle: AISLES.PRODUCE, packageLabel: 'à la pièce', packageSize: 1, unit: UNITS.PIECE, price: 1.69, shortName: 'aubergine', pieceNames: ['aubergine', 'aubergines'] }),
  defineProduct({ id: 'brocoli', name: 'Brocoli', aisle: AISLES.PRODUCE, packageLabel: 'à la pièce', packageSize: 1, unit: UNITS.PIECE, price: 1.29, shortName: 'brocoli', pieceNames: ['brocoli', 'brocolis'] }),
  defineProduct({ id: 'salade', name: 'Laitue', aisle: AISLES.PRODUCE, packageLabel: 'à la pièce', packageSize: 1, unit: UNITS.PIECE, price: 0.99, shortName: 'laitue', pieceNames: ['laitue', 'laitues'] }),
  defineProduct({ id: 'concombre', name: 'Concombre', aisle: AISLES.PRODUCE, packageLabel: 'à la pièce', packageSize: 1, unit: UNITS.PIECE, price: 0.99, shortName: 'concombre', pieceNames: ['concombre', 'concombres'] }),
  defineProduct({ id: 'avocat', name: 'Avocat', aisle: AISLES.PRODUCE, packageLabel: 'à la pièce', packageSize: 1, unit: UNITS.PIECE, price: 0.99, shortName: 'avocat', pieceNames: ['avocat', 'avocats'] }),
  defineProduct({ id: 'citron', name: 'Citrons jaunes', aisle: AISLES.PRODUCE, packageLabel: 'filet 750 g (5 citrons)', packageSize: 5, unit: UNITS.PIECE, price: 1.85, shortName: 'citron', pieceNames: ['citron', 'citrons'] }),
  defineProduct({ id: 'banane', name: 'Bananes', aisle: AISLES.PRODUCE, packageLabel: 'régime ≈ 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 1.79, shortName: 'banane' }),
  defineProduct({ id: 'pomme', name: 'Pommes Golden', aisle: AISLES.PRODUCE, packageLabel: 'sachet 1,5 kg', packageSize: 1500, unit: UNITS.GRAM, price: 2.79, shortName: 'pomme' }),
  defineProduct({ id: 'persil', name: 'Persil plat', aisle: AISLES.PRODUCE, packageLabel: 'bouquet', packageSize: 1, unit: UNITS.PIECE, price: 0.79, shortName: 'persil', pieceNames: ['bouquet de persil', 'bouquets de persil'] }),

  defineProduct({ id: 'poulet-filet', name: 'Filets de poulet', brand: "L'étal du Volailler", aisle: AISLES.MEAT, packageLabel: 'barquette 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 9.49, shortName: 'filet de poulet' }),
  defineProduct({ id: 'cuisse-poulet', name: 'Hauts de cuisse de poulet', aisle: AISLES.MEAT, packageLabel: 'barquette 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 4.59, shortName: 'cuisses de poulet' }),
  defineProduct({ id: 'boeuf-hache', name: 'Viande hachée pur bœuf 5 % MG', brand: "L'étal du Boucher", aisle: AISLES.MEAT, packageLabel: 'barquette 300 g', packageSize: 300, unit: UNITS.GRAM, price: 4.88, shortName: 'bœuf haché' }),
  defineProduct({ id: 'dinde', name: 'Filets de dinde', aisle: AISLES.MEAT, packageLabel: 'barquette 500 g', packageSize: 500, unit: UNITS.GRAM, price: 4.99, shortName: 'filet de dinde' }),
  defineProduct({ id: 'lardons', name: 'Lardons fumés', brand: 'Saint Alby', aisle: AISLES.MEAT, packageLabel: '2 × 100 g', packageSize: 200, unit: UNITS.GRAM, price: 1.85, shortName: 'lardons' }),
  defineProduct({ id: 'saucisse', name: 'Saucisses de Toulouse', brand: "L'étal du Boucher", aisle: AISLES.MEAT, packageLabel: 'barquette 480 g', packageSize: 480, unit: UNITS.GRAM, price: 3.99, shortName: 'saucisses de Toulouse' }),
  defineProduct({ id: 'jambon', name: 'Jambon supérieur', brand: 'Saint Alby', aisle: AISLES.MEAT, packageLabel: '4 tranches, 140 g', packageSize: 140, unit: UNITS.GRAM, price: 1.85, shortName: 'jambon blanc' }),
  defineProduct({ id: 'chorizo', name: 'Chorizo doux', aisle: AISLES.MEAT, packageLabel: 'pièce 225 g', packageSize: 225, unit: UNITS.GRAM, price: 2.29, shortName: 'chorizo' }),

  defineProduct({ id: 'saumon', name: 'Pavés de saumon', brand: 'Landfein', aisle: AISLES.FISH, packageLabel: '4 pavés, 500 g', packageSize: 500, unit: UNITS.GRAM, price: 11.49, shortName: 'saumon' }),
  defineProduct({ id: 'crevettes', name: 'Crevettes cuites décortiquées', aisle: AISLES.FISH, packageLabel: 'barquette 200 g', packageSize: 200, unit: UNITS.GRAM, price: 3.79, shortName: 'crevettes' }),
  defineProduct({ id: 'thon', name: 'Filets de thon au naturel', brand: 'Nixe', aisle: AISLES.CANS, packageLabel: 'boîte 150 g', packageSize: 150, unit: UNITS.GRAM, price: 1.45, shortName: 'thon' }),

  defineProduct({ id: 'oeuf', name: 'Œufs de poules élevées en plein air', aisle: AISLES.DAIRY, packageLabel: 'boîte de 12', packageSize: 12, unit: UNITS.PIECE, price: 2.88, shortName: 'œuf', pieceNames: ['œuf', 'œufs'] }),
  defineProduct({ id: 'lait', name: 'Lait demi-écrémé', brand: 'Milbona', aisle: AISLES.DAIRY, packageLabel: 'bouteille 1 L', packageSize: 1000, unit: UNITS.MILLILITER, price: 0.99, shortName: 'lait' }),
  defineProduct({ id: 'creme-epaisse', name: 'Crème fraîche épaisse 15 %', brand: 'Envia', aisle: AISLES.DAIRY, packageLabel: 'pot 50 cl', packageSize: 500, unit: UNITS.MILLILITER, price: 1.29, shortName: 'crème fraîche' }),
  defineProduct({ id: 'beurre', name: 'Beurre de Bretagne doux', brand: 'Envia', aisle: AISLES.DAIRY, packageLabel: 'plaquette 250 g', packageSize: 250, unit: UNITS.GRAM, price: 2.55, shortName: 'beurre' }),
  defineProduct({ id: 'emmental', name: 'Emmental râpé', brand: "Chêne d'Argent", aisle: AISLES.DAIRY, packageLabel: '3 sachets de 70 g', packageSize: 210, unit: UNITS.GRAM, price: 1.89, shortName: 'emmental râpé' }),
  defineProduct({ id: 'mozzarella', name: 'Mozzarella', brand: 'Milbona', aisle: AISLES.DAIRY, packageLabel: 'boule 125 g', packageSize: 125, unit: UNITS.GRAM, price: 0.76, shortName: 'mozzarella' }),
  defineProduct({ id: 'parmesan', name: 'Grana Padano', brand: 'Milbona', aisle: AISLES.DAIRY, packageLabel: 'portion 150 g', packageSize: 150, unit: UNITS.GRAM, price: 2.19, shortName: 'grana padano' }),
  defineProduct({ id: 'feta', name: 'Feta grecque', brand: 'Milbona', aisle: AISLES.DAIRY, packageLabel: 'bloc 200 g', packageSize: 200, unit: UNITS.GRAM, price: 2.45, shortName: 'feta' }),
  defineProduct({ id: 'fromage-blanc', name: 'Fromage blanc 0 %', brand: 'Envia', aisle: AISLES.DAIRY, packageLabel: 'pot 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 1.79, shortName: 'fromage blanc 0 %' }),
  defineProduct({ id: 'ricotta', name: 'Ricotta', brand: 'Italiamo', aisle: AISLES.DAIRY, packageLabel: 'pot 250 g', packageSize: 250, unit: UNITS.GRAM, price: 1.39, shortName: 'ricotta' }),
  defineProduct({ id: 'chevre', name: 'Bûche de chèvre Sainte-Maure', brand: 'Soignon', aisle: AISLES.DAIRY, packageLabel: 'bûche 200 g', packageSize: 200, unit: UNITS.GRAM, price: 2.18, shortName: 'chèvre' }),
  defineProduct({ id: 'tofu', name: 'Tofu nature', brand: 'Vemondo', aisle: AISLES.CHILLED, packageLabel: 'bloc 180 g', packageSize: 180, unit: UNITS.GRAM, price: 1.59, shortName: 'tofu' }),

  defineProduct({ id: 'pain-complet', name: 'Pain de mie complet grandes tranches', brand: 'Maître Jean Pierre', aisle: AISLES.BAKERY, packageLabel: 'sachet 750 g', packageSize: 750, unit: UNITS.GRAM, price: 1.6, shortName: 'pain complet' }),
  defineProduct({ id: 'pate-brisee', name: 'Pâte brisée', brand: 'Toque du Chef', aisle: AISLES.CHILLED, packageLabel: 'rouleau 230 g', packageSize: 1, unit: UNITS.PIECE, price: 0.65, shortName: 'pâte brisée', pieceNames: ['rouleau de pâte brisée', 'rouleaux de pâte brisée'] }),
  defineProduct({ id: 'pate-feuilletee', name: 'Pâte feuilletée', brand: 'Toque du Chef', aisle: AISLES.CHILLED, packageLabel: 'rouleau 230 g', packageSize: 1, unit: UNITS.PIECE, price: 1.14, shortName: 'pâte feuilletée', pieceNames: ['rouleau de pâte feuilletée', 'rouleaux de pâte feuilletée'] }),
  defineProduct({ id: 'houmous', name: 'Houmous nature', brand: 'Saladinettes', aisle: AISLES.CHILLED, packageLabel: 'pot 200 g', packageSize: 200, unit: UNITS.GRAM, price: 1.43, shortName: 'houmous' }),
  defineProduct({ id: 'falafels', name: 'Falafels', brand: 'Vemondo', aisle: AISLES.CHILLED, packageLabel: 'barquette 200 g', packageSize: 200, unit: UNITS.GRAM, price: 1.99, shortName: 'falafels' }),
  defineProduct({ id: 'gnocchi', name: 'Gnocchis frais de pommes de terre', brand: 'Toque du Chef', aisle: AISLES.CHILLED, packageLabel: 'sachet 380 g', packageSize: 380, unit: UNITS.GRAM, price: 1.09, shortName: 'gnocchi' }),
  defineProduct({ id: 'tortilla', name: 'Tortilla wraps', brand: 'Snack Day', aisle: AISLES.WORLD, packageLabel: 'sachet de 6', packageSize: 6, unit: UNITS.PIECE, price: 1.95, shortName: 'tortilla', pieceNames: ['tortilla', 'tortillas'] }),
  defineProduct({ id: 'pain-pita', name: 'Pains pita', aisle: AISLES.BAKERY, packageLabel: 'sachet de 3', packageSize: 3, unit: UNITS.PIECE, price: 1.39, shortName: 'pain pita', pieceNames: ['pain pita', 'pains pita'] }),
  defineProduct({ id: 'pain-burger', name: 'Pains burger', brand: 'Maître Jean Pierre', aisle: AISLES.BAKERY, packageLabel: 'sachet de 6', packageSize: 6, unit: UNITS.PIECE, price: 0.82, shortName: 'pain burger', pieceNames: ['pain burger', 'pains burger'] }),

  defineProduct({ id: 'flocons-avoine', name: "Flocons d'avoine", brand: 'Crownfield', aisle: AISLES.BREAKFAST, packageLabel: 'sachet 500 g', packageSize: 500, unit: UNITS.GRAM, price: 0.84, shortName: "flocons d'avoine" }),
  defineProduct({ id: 'amandes', name: 'Amandes décortiquées', brand: 'Alesto', aisle: AISLES.BREAKFAST, packageLabel: 'sachet 200 g', packageSize: 200, unit: UNITS.GRAM, price: 2.79, shortName: 'amandes' }),
  defineProduct({ id: 'spaghetti', name: 'Spaghetti', brand: 'Combino', aisle: AISLES.STARCHES, packageLabel: 'paquet 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 0.88, shortName: 'spaghetti' }),
  defineProduct({ id: 'penne', name: 'Penne rigate', brand: 'Combino', aisle: AISLES.STARCHES, packageLabel: 'paquet 500 g', packageSize: 500, unit: UNITS.GRAM, price: 0.55, shortName: 'penne' }),
  defineProduct({ id: 'riz', name: 'Riz basmati', brand: 'Golden Sun', aisle: AISLES.STARCHES, packageLabel: 'paquet 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 2.49, shortName: 'riz basmati' }),
  defineProduct({ id: 'semoule', name: 'Couscous grain moyen', brand: 'Golden Sun', aisle: AISLES.STARCHES, packageLabel: 'paquet 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 1.05, shortName: 'semoule' }),
  defineProduct({ id: 'nouilles', name: 'Nouilles aux œufs', brand: 'Vitasia', aisle: AISLES.WORLD, packageLabel: 'paquet 250 g', packageSize: 250, unit: UNITS.GRAM, price: 1.29, shortName: 'nouilles' }),
  defineProduct({ id: 'boulgour', name: 'Boulgour', aisle: AISLES.STARCHES, packageLabel: 'sachet 500 g', packageSize: 500, unit: UNITS.GRAM, price: 1.29, shortName: 'boulgour' }),
  defineProduct({ id: 'quinoa', name: 'Quinoa', aisle: AISLES.STARCHES, packageLabel: 'sachet 400 g', packageSize: 400, unit: UNITS.GRAM, price: 2.49, shortName: 'quinoa' }),
  defineProduct({ id: 'lentilles-corail', name: 'Lentilles corail', brand: 'Golden Sun', aisle: AISLES.STARCHES, packageLabel: 'sachet 450 g', packageSize: 450, unit: UNITS.GRAM, price: 1.55, shortName: 'lentilles corail' }),
  defineProduct({ id: 'lentilles-vertes', name: 'Lentilles vertes', brand: 'Golden Sun', aisle: AISLES.STARCHES, packageLabel: 'sachet 500 g', packageSize: 500, unit: UNITS.GRAM, price: 1.64, shortName: 'lentilles vertes' }),
  defineProduct({ id: 'pois-chiches', name: 'Pois chiches', brand: 'Freshona', aisle: AISLES.CANS, packageLabel: 'boîte 400 g (265 g égouttés)', packageSize: 265, unit: UNITS.GRAM, price: 0.69, shortName: 'pois chiches égouttés' }),
  defineProduct({ id: 'haricots-rouges', name: 'Haricots rouges', brand: 'Freshona', aisle: AISLES.CANS, packageLabel: 'boîte 400 g (250 g égouttés)', packageSize: 250, unit: UNITS.GRAM, price: 0.78, shortName: 'haricots rouges égouttés' }),
  defineProduct({ id: 'mais', name: 'Maïs doux', brand: 'Freshona', aisle: AISLES.CANS, packageLabel: 'boîte 285 g égouttés', packageSize: 285, unit: UNITS.GRAM, price: 0.89, shortName: 'maïs' }),
  defineProduct({ id: 'tomates-concassees', name: 'Tomates concassées', brand: 'Freshona', aisle: AISLES.CANS, packageLabel: 'boîte 400 g', packageSize: 400, unit: UNITS.GRAM, price: 0.65, shortName: 'tomates concassées' }),
  defineProduct({ id: 'sardines', name: "Sardines à l'huile d'olive", brand: 'Nixe', aisle: AISLES.CANS, packageLabel: 'boîte 135 g (90 g égouttés)', packageSize: 90, unit: UNITS.GRAM, price: 1.1, shortName: 'sardines égouttées' }),
  defineProduct({ id: 'maquereau', name: 'Filets de maquereau à la tomate', brand: 'Nixe', aisle: AISLES.CANS, packageLabel: 'boîte 169 g', packageSize: 169, unit: UNITS.GRAM, price: 1.05, shortName: 'maquereau à la tomate' }),
  defineProduct({ id: 'haricots-blancs', name: 'Haricots blancs', brand: 'Freshona', aisle: AISLES.CANS, packageLabel: 'boîte 400 g (250 g égouttés)', packageSize: 250, unit: UNITS.GRAM, price: 0.79, shortName: 'haricots blancs égouttés' }),
  defineProduct({ id: 'lentilles-boite', name: 'Lentilles vertes au naturel', brand: 'Freshona', aisle: AISLES.CANS, packageLabel: 'boîte 400 g (265 g égouttés)', packageSize: 265, unit: UNITS.GRAM, price: 0.89, shortName: 'lentilles cuites égouttées' }),
  defineProduct({ id: 'coulis', name: 'Purée de tomates', brand: 'Baresa', aisle: AISLES.CANS, packageLabel: 'brique 500 g', packageSize: 500, unit: UNITS.GRAM, price: 0.66, shortName: 'coulis de tomate' }),
  defineProduct({ id: 'lait-coco', name: 'Lait de coco', brand: 'Freshona', aisle: AISLES.WORLD, packageLabel: 'boîte 400 ml', packageSize: 400, unit: UNITS.MILLILITER, price: 1.38, shortName: 'lait de coco' }),
  defineProduct({ id: 'pesto', name: 'Pesto alla genovese', brand: 'Kania', aisle: AISLES.CANS, packageLabel: 'bocal 190 g', packageSize: 190, unit: UNITS.GRAM, price: 1.85, shortName: 'pesto' }),

  defineProduct({ id: 'epinards', name: 'Épinards en branches', aisle: AISLES.FROZEN, packageLabel: 'sachet 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 1.79, shortName: 'épinards surgelés' }),
  defineProduct({ id: 'haricots-verts', name: 'Haricots verts extra-fins', brand: 'Freshona', aisle: AISLES.FROZEN, packageLabel: 'sachet 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 1.85, shortName: 'haricots verts surgelés' }),
  defineProduct({ id: 'petits-pois', name: 'Petits pois extra-fins', aisle: AISLES.FROZEN, packageLabel: 'sachet 1 kg', packageSize: 1000, unit: UNITS.GRAM, price: 1.79, shortName: 'petits pois surgelés' }),
  defineProduct({ id: 'brocoli-surgele', name: 'Fleurettes de brocoli', brand: 'Freshona', aisle: AISLES.FROZEN, packageLabel: 'sachet 750 g', packageSize: 750, unit: UNITS.GRAM, price: 1.79, shortName: 'brocoli surgelé' }),
  defineProduct({ id: 'poelee-legumes', name: 'Poêlée de légumes méridionale', aisle: AISLES.FROZEN, packageLabel: 'sachet 750 g', packageSize: 750, unit: UNITS.GRAM, price: 1.99, shortName: 'poêlée de légumes surgelée' }),
  defineProduct({ id: 'colin', name: "Filets de colin d'Alaska", aisle: AISLES.FROZEN, packageLabel: 'étui 400 g', packageSize: 400, unit: UNITS.GRAM, price: 3.49, shortName: 'colin surgelé' }),

  defineProduct({ id: 'huile-olive', name: "Huile d'olive vierge extra", brand: 'Primadonna', aisle: AISLES.PANTRY, packageLabel: 'bouteille 1 L', packageSize: 1000, unit: UNITS.MILLILITER, price: 7.89, shortName: "huile d'olive", isPantryStaple: true }),
  defineProduct({ id: 'vinaigre', name: 'Vinaigre balsamique de Modène', brand: 'Kania', aisle: AISLES.PANTRY, packageLabel: 'bouteille 350 ml', packageSize: 350, unit: UNITS.MILLILITER, price: 1.57, shortName: 'vinaigre balsamique', isPantryStaple: true }),
  defineProduct({ id: 'moutarde', name: 'Moutarde de Dijon', brand: 'Kania', aisle: AISLES.PANTRY, packageLabel: 'bocal 440 g', packageSize: 440, unit: UNITS.GRAM, price: 0.9, shortName: 'moutarde', isPantryStaple: true }),
  defineProduct({ id: 'sauce-soja', name: 'Sauce soja', brand: 'Vitasia', aisle: AISLES.WORLD, packageLabel: 'bouteille 250 ml', packageSize: 250, unit: UNITS.MILLILITER, price: 1.39, shortName: 'sauce soja', isPantryStaple: true }),
  defineProduct({ id: 'bouillon', name: 'Bouillon de légumes', aisle: AISLES.PANTRY, packageLabel: 'boîte de 12 cubes', packageSize: 12, unit: UNITS.PIECE, price: 0.99, shortName: 'cube de bouillon', pieceNames: ['cube de bouillon', 'cubes de bouillon'], isPantryStaple: true }),
  defineProduct({ id: 'curry', name: 'Curry en poudre', brand: 'Kania', aisle: AISLES.PANTRY, packageLabel: 'pot 47 g', packageSize: 47, unit: UNITS.GRAM, price: 0.61, shortName: 'curry', isPantryStaple: true }),
  defineProduct({ id: 'paprika', name: 'Paprika doux', brand: 'Kania', aisle: AISLES.PANTRY, packageLabel: 'pot 50 g', packageSize: 50, unit: UNITS.GRAM, price: 0.59, shortName: 'paprika', isPantryStaple: true }),
  defineProduct({ id: 'cumin', name: 'Cumin moulu', brand: 'Kania', aisle: AISLES.PANTRY, packageLabel: 'pot 45 g', packageSize: 45, unit: UNITS.GRAM, price: 0.83, shortName: 'cumin', isPantryStaple: true }),
  defineProduct({ id: 'herbes', name: 'Herbes de Provence', brand: 'Kania', aisle: AISLES.PANTRY, packageLabel: 'pot 20 g', packageSize: 20, unit: UNITS.GRAM, price: 0.49, shortName: 'herbes de Provence', isPantryStaple: true }),
  defineProduct({ id: 'poivre', name: 'Poivre noir moulu', brand: 'Kania', aisle: AISLES.PANTRY, packageLabel: 'pot 50 g', packageSize: 50, unit: UNITS.GRAM, price: 0.7, shortName: 'poivre', isPantryStaple: true }),
]);

export const PRODUCTS_BY_ID = new Map(PRODUCTS.map((product) => [product.id, product]));
