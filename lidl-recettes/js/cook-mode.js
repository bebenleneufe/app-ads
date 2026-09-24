import { createElement, replaceChildrenWithFragment } from './dom.js';
import { formatProductQuantity } from './format.js';
import { PRODUCTS_BY_ID } from './catalog.js';
import { getPortionQuantities } from './nutrition.js';
import { createScreenWakeLock } from './wake-lock.js';

const MINUTES_PATTERN = /(\d+)\s*min/;
const SECONDS_PER_MINUTE = 60;
const TIMER_TICK_MILLISECONDS = 1000;
const ALERT_FREQUENCY_HERTZ = 880;
const ALERT_DURATION_SECONDS = 0.6;

export function findStepMinutes(stepText) {
  const match = MINUTES_PATTERN.exec(stepText);
  return match ? Number(match[1]) : null;
}

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// Mode cuisine : les ingrédients puis une étape à la fois, en grand, avec un minuteur
// quand l'étape annonce une durée. Tout est nettoyé à la fermeture (minuteur, écouteurs, écran).
export class CookMode {
  #dialog;
  #elements;
  #steps = [];
  #stepIndex = 0;
  #remainingSeconds = 0;
  #timerIntervalId = null;
  #openController = null;
  #audioContext = null;
  #wakeLock = createScreenWakeLock();

  constructor(dialogElement) {
    this.#dialog = dialogElement;
    this.#elements = {
      title: dialogElement.querySelector('[data-cook="title"]'),
      counter: dialogElement.querySelector('[data-cook="counter"]'),
      content: dialogElement.querySelector('[data-cook="content"]'),
      timer: dialogElement.querySelector('[data-cook="timer"]'),
      clock: dialogElement.querySelector('[data-cook="clock"]'),
      timerButton: dialogElement.querySelector('[data-cook="timer-button"]'),
      previousButton: dialogElement.querySelector('[data-cook="previous"]'),
      nextButton: dialogElement.querySelector('[data-cook="next"]'),
      closeButton: dialogElement.querySelector('[data-cook="close"]'),
    };
  }

  open(recipe, servingCount, settings) {
    this.#openController?.abort();
    this.#openController = new AbortController();
    const { signal } = this.#openController;
    const ingredientLines = getPortionQuantities(recipe.id, settings)
      .map(([productId, quantity]) => formatProductQuantity(PRODUCTS_BY_ID.get(productId), quantity * servingCount));
    this.#steps = [{ ingredientLines }, ...recipe.steps.map((text) => ({ text }))];
    this.#stepIndex = 0;
    this.#elements.title.textContent = recipe.name;

    this.#elements.previousButton.addEventListener('click', () => this.#goToStep(this.#stepIndex - 1), { signal });
    this.#elements.nextButton.addEventListener('click', () => this.#handleNext(), { signal });
    this.#elements.closeButton.addEventListener('click', () => this.close(), { signal });
    this.#elements.timerButton.addEventListener('click', () => this.#toggleTimer(), { signal });
    this.#dialog.addEventListener('close', () => this.#cleanUp(), { signal });

    this.#goToStep(0);
    this.#dialog.showModal();
    this.#wakeLock.enable();
  }

  close() {
    if (this.#dialog.open) {
      this.#dialog.close();
    }
  }

  destroy() {
    this.close();
    this.#cleanUp();
    this.#audioContext?.close().catch((closeError) => console.info('Son déjà fermé.', closeError));
    this.#audioContext = null;
  }

  #cleanUp() {
    this.#stopTimer();
    this.#openController?.abort();
    this.#openController = null;
    this.#wakeLock.disable();
  }

  #handleNext() {
    if (this.#stepIndex >= this.#steps.length - 1) {
      this.close();
      return;
    }
    this.#goToStep(this.#stepIndex + 1);
  }

  #goToStep(stepIndex) {
    this.#stepIndex = Math.min(Math.max(stepIndex, 0), this.#steps.length - 1);
    this.#stopTimer();
    const step = this.#steps[this.#stepIndex];
    const isIngredientStep = this.#stepIndex === 0;
    this.#elements.counter.textContent = isIngredientStep
      ? 'Ingrédients'
      : `Étape ${this.#stepIndex} sur ${this.#steps.length - 1}`;
    const contentChildren = isIngredientStep
      ? [createElement('ul', { className: 'cook-ingredients' }, step.ingredientLines.map((line) => createElement('li', { text: line })))]
      : [createElement('p', { className: 'cook-step', text: step.text })];
    replaceChildrenWithFragment(this.#elements.content, contentChildren);

    const stepMinutes = isIngredientStep ? null : findStepMinutes(step.text);
    this.#elements.timer.hidden = stepMinutes === null;
    this.#remainingSeconds = (stepMinutes ?? 0) * SECONDS_PER_MINUTE;
    this.#renderTimer();
    this.#elements.previousButton.disabled = this.#stepIndex === 0;
    this.#elements.nextButton.textContent = this.#stepIndex === this.#steps.length - 1 ? 'Terminé' : 'Suivant';
  }

  #toggleTimer() {
    if (this.#timerIntervalId !== null) {
      this.#stopTimer();
      this.#renderTimer();
      return;
    }
    if (this.#remainingSeconds <= 0) {
      return;
    }
    // Le son ne peut démarrer qu'après un geste de l'utilisateur : on le prépare ici, au clic.
    this.#audioContext ??= new AudioContext();
    this.#timerIntervalId = setInterval(() => this.#tick(), TIMER_TICK_MILLISECONDS);
    this.#renderTimer();
  }

  #tick() {
    this.#remainingSeconds = Math.max(0, this.#remainingSeconds - 1);
    if (this.#remainingSeconds === 0) {
      this.#stopTimer();
      this.#playAlert();
    }
    this.#renderTimer();
  }

  #stopTimer() {
    clearInterval(this.#timerIntervalId);
    this.#timerIntervalId = null;
  }

  #renderTimer() {
    const isRunning = this.#timerIntervalId !== null;
    this.#elements.clock.textContent = this.#remainingSeconds === 0 && !this.#elements.timer.hidden
      ? 'C’est prêt'
      : formatClock(this.#remainingSeconds);
    this.#elements.timerButton.textContent = isRunning ? 'Pause' : 'Lancer le minuteur';
    this.#elements.timerButton.disabled = this.#remainingSeconds === 0;
  }

  #playAlert() {
    try {
      const oscillator = this.#audioContext.createOscillator();
      oscillator.frequency.value = ALERT_FREQUENCY_HERTZ;
      oscillator.connect(this.#audioContext.destination);
      oscillator.start();
      oscillator.stop(this.#audioContext.currentTime + ALERT_DURATION_SECONDS);
    } catch (audioError) {
      console.info('Alerte sonore indisponible.', audioError);
    }
    navigator.vibrate?.([200, 100, 200]);
  }
}
