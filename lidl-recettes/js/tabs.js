// Un écran par onglet, choisi par l'adresse (#semaine, #courses…) : le bouton retour
// du téléphone revient à l'onglet précédent au lieu de quitter l'appli.
export class TabNavigator {
  #views;
  #links;
  #defaultTab;
  #onChange;
  #currentTab = null;
  #listenersController = new AbortController();

  constructor({ rootDocument, defaultTab, onChange = () => {} }) {
    this.#views = new Map([...rootDocument.querySelectorAll('[data-tab]')].map((view) => [view.dataset.tab, view]));
    this.#links = [...rootDocument.querySelectorAll('[data-tab-link]')];
    this.#defaultTab = defaultTab;
    this.#onChange = onChange;
  }

  get currentTab() {
    return this.#currentTab;
  }

  start() {
    const rootWindow = this.#links[0]?.ownerDocument.defaultView ?? window;
    rootWindow.addEventListener('hashchange', () => this.#showTabFromAddress(), { signal: this.#listenersController.signal });
    this.#showTabFromAddress();
  }

  open(tab) {
    if (!this.#views.has(tab)) {
      return;
    }
    if (window.location.hash === `#${tab}`) {
      this.#show(tab);
      return;
    }
    window.location.hash = tab;
  }

  destroy() {
    this.#listenersController.abort();
  }

  #showTabFromAddress() {
    const requestedTab = window.location.hash.slice(1);
    this.#show(this.#views.has(requestedTab) ? requestedTab : this.#defaultTab);
  }

  #show(tab) {
    const isNewTab = tab !== this.#currentTab;
    this.#currentTab = tab;
    for (const [viewTab, view] of this.#views) {
      view.hidden = viewTab !== tab;
    }
    for (const link of this.#links) {
      if (link.dataset.tabLink === tab) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    }
    // Chaque écran s'ouvre en haut, comme dans une appli : pas au milieu de l'écran précédent.
    if (isNewTab) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    this.#onChange(tab);
  }
}
