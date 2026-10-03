import { PRODUCTS } from './catalog.js';

// Articles ajoutés à la main à la liste de courses : un produit du catalogue (rangé dans son
// rayon, avec son prix) ou un texte libre (« lessive »), rangé dans « Autres articles ».
const MAX_LABEL_LENGTH = 60;
const MAX_PACKAGE_COUNT = 20;
const MAX_EXTRA_ITEMS = 50;
const EXTRA_ID_PREFIX = 'extra-';

function normalizeText(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function findCatalogProduct(label) {
  const searchedText = normalizeText(label);
  return PRODUCTS.find((product) => normalizeText(product.name) === searchedText || normalizeText(product.shortName) === searchedText) ?? null;
}

function createExtraId() {
  return `${EXTRA_ID_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeExtraItem(savedItem) {
  const label = typeof savedItem?.label === 'string' ? savedItem.label.trim().slice(0, MAX_LABEL_LENGTH) : '';
  const hasValidId = typeof savedItem?.id === 'string' && savedItem.id.startsWith(EXTRA_ID_PREFIX);
  if (!label || !hasValidId) {
    return null;
  }
  const packageCount = Number.isInteger(savedItem.packageCount)
    ? Math.min(Math.max(savedItem.packageCount, 1), MAX_PACKAGE_COUNT)
    : 1;
  return { id: savedItem.id, label, productId: findCatalogProduct(label)?.id ?? null, packageCount };
}

export function normalizeExtraItems(savedItems) {
  return Array.isArray(savedItems)
    ? savedItems.map(normalizeExtraItem).filter(Boolean).slice(0, MAX_EXTRA_ITEMS)
    : [];
}

// Ajouter deux fois le même article augmente la quantité plutôt que de doubler la ligne.
export function addExtraItem(extraItems, typedLabel) {
  const label = typedLabel.trim().slice(0, MAX_LABEL_LENGTH);
  if (!label || extraItems.length >= MAX_EXTRA_ITEMS) {
    return extraItems;
  }
  const catalogProduct = findCatalogProduct(label);
  const sameItem = extraItems.find((item) => (catalogProduct
    ? item.productId === catalogProduct.id
    : normalizeText(item.label) === normalizeText(label)));
  if (sameItem) {
    return extraItems.map((item) => (item === sameItem
      ? { ...item, packageCount: Math.min(item.packageCount + 1, MAX_PACKAGE_COUNT) }
      : item));
  }
  return [...extraItems, {
    id: createExtraId(),
    label: catalogProduct?.name ?? label,
    productId: catalogProduct?.id ?? null,
    packageCount: 1,
  }];
}

export function removeExtraItem(extraItems, extraId) {
  return extraItems.filter((item) => item.id !== extraId);
}

// Un article ajouté mais pas encore acheté reste sur la liste de la semaine suivante.
export function keepUnboughtExtraItems(extraItems, checkedLineKeys) {
  return extraItems.filter((item) => !checkedLineKeys.has(item.id));
}
