import { PRODUCTS_BY_ID, UNITS } from './catalog.js';
import { createElement, replaceChildrenWithFragment } from './dom.js';

const UNIT_LABELS = Object.freeze({ [UNITS.GRAM]: 'g', [UNITS.MILLILITER]: 'ml', [UNITS.PIECE]: 'pc' });

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
    this.#elements.noneButton.addEventListener('click', () => this.#setAllToZero(), { signal });
    this.#elements.list.addEventListener('click', (clickEvent) => this.#handleRowClick(clickEvent), { signal });
    this.#elements.list.addEventListener('input', (inputEvent) => this.#markRow(inputEvent.target), { signal });
  }

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
    const inputId = `leftover-${product.id}`;
    const step = product.unit === UNITS.PIECE ? '0.5' : '1';
    const roundedQuantity = product.unit === UNITS.PIECE ? Math.round(quantity * 2) / 2 : Math.round(quantity);
    return createElement('li', { className: 'leftover-row', attributes: { 'data-product-id': product.id } }, [
      createElement('label', { className: 'leftover-name', attributes: { for: inputId } }, [
        product.name,
        createElement('span', { className: 'leftover-package', text: product.packageLabel }),
      ]),
      createElement('span', { className: 'leftover-quantity' }, [
        createElement('input', {
          attributes: {
            id: inputId, type: 'number', inputmode: 'decimal', min: '0', step, value: String(roundedQuantity),
          },
        }),
        createElement('span', { className: 'leftover-unit', text: UNIT_LABELS[product.unit] ?? '' }),
      ]),
      createElement('button', {
        className: 'leftover-none',
        text: '✕',
        attributes: { type: 'button', 'aria-label': `Plus de ${product.name}`, title: 'Plus rien' },
      }),
    ]);
  }

  #handleRowClick(clickEvent) {
    const noneButton = clickEvent.target.closest('.leftover-none');
    if (!noneButton) {
      return;
    }
    const input = noneButton.closest('.leftover-row').querySelector('input');
    input.value = '0';
    this.#markRow(input);
  }

  #setAllToZero() {
    for (const input of this.#elements.list.querySelectorAll('input')) {
      input.value = '0';
      this.#markRow(input);
    }
  }

  #markRow(input) {
    input.closest('.leftover-row')?.classList.toggle('is-empty', Number.parseFloat(input.value) <= 0 || input.value === '');
  }

  #readStock() {
    return Object.fromEntries([...this.#elements.list.querySelectorAll('.leftover-row')]
      .map((row) => [row.dataset.productId, Number.parseFloat(row.querySelector('input').value.replace(',', '.'))])
      .filter(([, quantity]) => Number.isFinite(quantity) && quantity > 0));
  }

  #confirm() {
    const confirmedStock = this.#readStock();
    const onConfirm = this.#onConfirm;
    this.#dialog.close();
    onConfirm?.(confirmedStock);
  }
}
