const UNDO_DURATION_MILLISECONDS = 6000;

// Bandeau « Annuler » : une seule action annulable à la fois, proposée quelques secondes.
export class UndoToast {
  #elements;
  #undoAction = null;
  #timeoutId = null;
  #listenersController = new AbortController();

  constructor({ toast, message, button }) {
    this.#elements = { toast, message, button };
    button.addEventListener('click', () => this.#undo(), { signal: this.#listenersController.signal });
  }

  offer(message, undoAction) {
    clearTimeout(this.#timeoutId);
    this.#undoAction = undoAction;
    this.#elements.message.textContent = message;
    this.#elements.toast.hidden = false;
    this.#timeoutId = setTimeout(() => this.close(), UNDO_DURATION_MILLISECONDS);
  }

  close() {
    clearTimeout(this.#timeoutId);
    this.#timeoutId = null;
    this.#undoAction = null;
    this.#elements.toast.hidden = true;
  }

  destroy() {
    this.close();
    this.#listenersController.abort();
  }

  #undo() {
    const undoAction = this.#undoAction;
    this.close();
    undoAction?.();
  }
}
