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
    const { signal } = this.#listenersController;
    window.addEventListener('hashchange', () => this.#showTabFromAddress(), { signal });
    window.addEventListener('popstate', () => this.#showTabFromAddress(), { signal });
    // L'écran change dès l'appui, sans attendre l'événement « hashchange » qui arrive un peu plus tard.
    for (const link of this.#links) {
      link.addEventListener('click', (clickEvent) => {
        clickEvent.preventDefault();
        this.open(link.dataset.tabLink);
      }, { signal });
    }
    this.#showTabFromAddress();
  }

  open(tab) {
    if (!this.#views.has(tab)) {
      return;
    }
    if (window.location.hash !== `#${tab}`) {
      window.history.pushState(null, '', `#${tab}`);
    }
    this.#show(tab);
  }

  destroy() {
    this.#listenersController.abort();
  }

  #showTabFromAddress() {
    const requestedTab = window.location.hash.slice(1);
    const tab = this.#views.has(requestedTab) ? requestedTab : this.#defaultTab;
    if (tab !== this.#currentTab) {
      this.#show(tab);
    }
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
