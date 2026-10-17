import { PRODUCTS_BY_ID } from './catalog.js';
import { createElement, replaceChildrenWithFragment } from './dom.js';
import { formatQuantity } from './format.js';

// Trois choix par produit plutôt qu'une saisie au gramme : on ne pèse pas ses restes d'une main,
// on sait juste s'il en reste autant que prévu, à peu près la moitié, ou plus rien.
const LEFTOVER_CHOICES = Object.freeze([
  { key: 'tout', share: 1 },
  { key: 'moitie', share: 0.5, label: 'La moitié' },
  { key: 'rien', share: 0, label: 'Rien' },
]);
const NOTHING_KEY = 'rien';

// Les restes calculés supposent que rien n'a été jeté, mangé à côté ou n'a tourné :
// on les montre avant de s'en servir, pour que chaque quantité soit validée à la main.
export class LeftoversDialog {
  #dialog;
  #elements;
  #onConfirm = null;
  #listenersController = new AbortController();

  constructor(dialogElement) {
    this.#dialog = dialogElement;
    this.#elements = {
      title: dialogElement.querySelector('[data-leftovers="title"]'),
      list: dialogElement.querySelector('[data-leftovers="list"]'),
      confirmButton: dialogElement.querySelector('[data-leftovers="confirm"]'),
      cancelButton: dialogElement.querySelector('[data-leftovers="cancel"]'),
      noneButton: dialogElement.querySelector('[data-leftovers="none"]'),
    };
    const { signal } = this.#listenersController;
    this.#elements.confirmButton.addEventListener('click', () => this.#confirm(), { signal });
    this.#elements.cancelButton.addEventListener('click', () => this.#dialog.close(), { signal });
    this.#elements.noneButton.addEventListener('click', () => this.#chooseEverywhere(NOTHING_KEY), { signal });
    this.#elements.list.addEventListener('change', (changeEvent) => this.#markRow(changeEvent.target.closest('.leftover-row')), { signal });
  }

  // Sans aucun reste, la feuille sert seulement à confirmer le passage à la semaine suivante.
  open(stock, { title, confirmLabel, onConfirm }) {
    this.#onConfirm = onConfirm;
    this.#elements.title.textContent = title;
    this.#elements.confirmButton.textContent = confirmLabel;
    const rows = Object.entries(stock)
      .map(([productId, quantity]) => [PRODUCTS_BY_ID.get(productId), quantity])
      .filter(([product]) => product !== undefined)
      .sort(([firstProduct], [secondProduct]) => firstProduct.name.localeCompare(secondProduct.name, 'fr'))
      .map(([product, quantity]) => this.#buildRow(product, quantity));
    replaceChildrenWithFragment(this.#elements.list, rows);
    this.#elements.list.hidden = rows.length === 0;
    this.#elements.noneButton.hidden = rows.length === 0;
    this.#dialog.showModal();
  }

  destroy() {
    this.#listenersController.abort();
    if (this.#dialog.open) {
      this.#dialog.close();
    }
    this.#onConfirm = null;
  }

  #buildRow(product, quantity) {
    const groupName = `leftover-${product.id}`;
    const choiceElements = LEFTOVER_CHOICES.flatMap(({ key, label }) => {
      const choiceId = `${groupName}-${key}`;
      const inputAttributes = { type: 'radio', id: choiceId, name: groupName, value: key };
      if (key === LEFTOVER_CHOICES[0].key) {
        inputAttributes.checked = '';
      }
      return [
        createElement('input', { attributes: inputAttributes }),
        createElement('label', { attributes: { for: choiceId }, text: label ?? formatQuantity(quantity, product.unit) }),
      ];
    });
    return createElement('li', {
      className: 'leftover-row',
      attributes: { 'data-product-id': product.id, 'data-estimated-quantity': String(quantity) },
    }, [
      createElement('p', { className: 'leftover-name' }, [
        product.name,
        createElement('span', { className: 'leftover-package', text: product.packageLabel }),
      ]),
      createElement('div', { className: 'segmented leftover-choices', attributes: { role: 'radiogroup', 'aria-label': `Reste de ${product.name}` } }, choiceElements),
    ]);
  }

  #chooseEverywhere(choiceKey) {
    for (const row of this.#elements.list.querySelectorAll('.leftover-row')) {
      const choiceInput = row.querySelector(`input[value="${choiceKey}"]`);
      if (choiceInput) {
        choiceInput.checked = true;
      }
      this.#markRow(row);
    }
  }

  #markRow(row) {
    row?.classList.toggle('is-empty', row.querySelector('input:checked')?.value === NOTHING_KEY);
  }

  #readStock() {
    return Object.fromEntries([...this.#elements.list.querySelectorAll('.leftover-row')]
      .map((row) => {
        const chosenKey = row.querySelector('input:checked')?.value;
        const share = LEFTOVER_CHOICES.find((choice) => choice.key === chosenKey)?.share ?? 1;
        return [row.dataset.productId, Number(row.dataset.estimatedQuantity) * share];
      })
      .filter(([, quantity]) => Number.isFinite(quantity) && quantity > 0));
  }

  #confirm() {
    const confirmedStock = this.#readStock();
    const onConfirm = this.#onConfirm;
    this.#dialog.close();
    onConfirm?.(confirmedStock);
  }
}
