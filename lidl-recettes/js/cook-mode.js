import { createElement, replaceChildrenWithFragment } from './dom.js';
import { formatProductQuantity } from './format.js';
import { PRODUCTS_BY_ID } from './catalog.js';
import { computeCookedQuantity, getPortionQuantities } from './nutrition.js';
import { createScreenWakeLock } from './wake-lock.js';

const MINUTES_PATTERN = /(\d+)\s*min/;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const TIMER_TICK_MILLISECONDS = 500;
// Alarme de fin : trois bips forts, répétés jusqu'à ce qu'on appuie sur « OK »,
// pour l'entendre depuis une autre pièce. Elle s'arrête seule au bout de 3 minutes.
const ALARM_REPEAT_MILLISECONDS = 1500;
const ALARM_MAX_DURATION_MILLISECONDS = 3 * 60 * 1000;
const ALARM_BEEP_FREQUENCIES_HERTZ = [880, 1175, 880];
const ALARM_BEEP_SECONDS = 0.18;
const ALARM_BEEP_GAP_SECONDS = 0.08;
const ALARM_VOLUME = 0.6;
const ALARM_VIBRATION_PATTERN = [400, 150, 400, 150, 400];

export function findStepMinutes(stepText) {
  const match = MINUTES_PATTERN.exec(stepText);
  return match ? Number(match[1]) : null;
}

function formatClock(remainingMilliseconds) {
  const totalSeconds = Math.ceil(remainingMilliseconds / MILLISECONDS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// Le minuteur garde son heure de fin plutôt que de compter des tops : un téléphone en veille
// ou une appli en arrière-plan espace les tops, mais l'heure de fin, elle, reste juste.
class StepTimer {
  #endTime = null;
  #pausedRemainingMilliseconds = 0;
  #intervalId = null;
  #onTick;
  #onFinish;
  #visibilityController = null;

  constructor({ durationMilliseconds, onTick, onFinish }) {
    this.#pausedRemainingMilliseconds = durationMilliseconds;
    this.#onTick = onTick;
    this.#onFinish = onFinish;
  }

  get isRunning() {
    return this.#endTime !== null;
  }

  get remainingMilliseconds() {
    return this.isRunning ? Math.max(0, this.#endTime - Date.now()) : this.#pausedRemainingMilliseconds;
  }

  start() {
    if (this.isRunning || this.#pausedRemainingMilliseconds <= 0) {
      return;
    }
    this.#endTime = Date.now() + this.#pausedRemainingMilliseconds;
    this.#intervalId = setInterval(() => this.#tick(), TIMER_TICK_MILLISECONDS);
    this.#visibilityController = new AbortController();
    // Au retour sur l'appli, on recalcule tout de suite sans attendre le prochain top.
    document.addEventListener('visibilitychange', () => this.#tick(), { signal: this.#visibilityController.signal });
  }

  pause() {
    if (!this.isRunning) {
      return;
    }
    this.#pausedRemainingMilliseconds = this.remainingMilliseconds;
    this.#clearTicking();
  }

  stop() {
    this.#pausedRemainingMilliseconds = 0;
    this.#clearTicking();
  }

  #clearTicking() {
    this.#endTime = null;
    clearInterval(this.#intervalId);
    this.#intervalId = null;
    this.#visibilityController?.abort();
    this.#visibilityController = null;
  }

  #tick() {
    if (!this.isRunning) {
      return;
    }
    if (this.remainingMilliseconds === 0) {
      this.stop();
      this.#onFinish();
      return;
    }
    this.#onTick();
  }
}

// Mode cuisine : les ingrédients puis une étape à la fois, en grand, avec un minuteur
// quand l'étape annonce une durée. Le minuteur continue quand on change d'étape :
// on peut lire la suite pendant que ça cuit.
export class CookMode {
  #dialog;
  #elements;
  #recipeId = null;
  #steps = [];
  #stepIndex = 0;
  #timer = null;
  #timerStepIndex = null;
  #isTimerFinished = false;
  #openController = null;
  #lastOpenArguments = null;
  #onFinish = null;
  #alarmIntervalId = null;
  #alarmStopTimeoutId = null;
  #audioContext = null;
  #wakeLock = createScreenWakeLock();

  constructor(dialogElement) {
    this.#dialog = dialogElement;
    this.#elements = {
      title: dialogElement.querySelector('[data-cook="title"]'),
      counter: dialogElement.querySelector('[data-cook="counter"]'),
      content: dialogElement.querySelector('[data-cook="content"]'),
      timer: dialogElement.querySelector('[data-cook="timer"]'),
      timerLabel: dialogElement.querySelector('[data-cook="timer-label"]'),
      clock: dialogElement.querySelector('[data-cook="clock"]'),
      timerButton: dialogElement.querySelector('[data-cook="timer-button"]'),
      timerStopButton: dialogElement.querySelector('[data-cook="timer-stop"]'),
      previousButton: dialogElement.querySelector('[data-cook="previous"]'),
      nextButton: dialogElement.querySelector('[data-cook="next"]'),
      closeButton: dialogElement.querySelector('[data-cook="close"]'),
    };
  }

  // onFinish : appelé quand on termine la dernière étape (le plat est alors marqué cuisiné).
  open(recipe, servingCount, settings, { onFinish = null } = {}) {
    this.#lastOpenArguments = [recipe, servingCount, settings, { onFinish }];
    this.#onFinish = onFinish;
    this.#openController?.abort();
    this.#openController = new AbortController();
    const { signal } = this.#openController;
    // Rouvrir la même recette retrouve son minuteur ; une autre recette repart de zéro.
    if (recipe.id !== this.#recipeId) {
      this.#clearTimer();
      this.#stepIndex = 0;
    }
    this.#recipeId = recipe.id;
    const ingredientLines = getPortionQuantities(recipe.id, settings)
      .map(([productId, quantity]) => formatProductQuantity(PRODUCTS_BY_ID.get(productId), computeCookedQuantity(productId, quantity, servingCount)));
    this.#steps = [{ ingredientLines }, ...recipe.steps.map((text) => ({ text }))];
    this.#elements.title.textContent = recipe.name;

    this.#elements.previousButton.addEventListener('click', () => this.#goToStep(this.#stepIndex - 1), { signal });
    this.#elements.nextButton.addEventListener('click', () => this.#handleNext(), { signal });
    this.#elements.closeButton.addEventListener('click', () => this.close(), { signal });
    this.#elements.timerButton.addEventListener('click', () => this.#toggleTimer(), { signal });
    this.#elements.timerStopButton.addEventListener('click', () => this.#dismissTimer(), { signal });
    this.#dialog.addEventListener('close', () => this.#handleClose(), { signal });

    this.#goToStep(this.#stepIndex);
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
    this.#handleClose();
    this.#clearTimer();
    this.#lastOpenArguments = null;
    this.#onFinish = null;
    this.#audioContext?.close().catch((closeError) => console.info('Son déjà fermé.', closeError));
    this.#audioContext = null;
  }

  // Fermer la fenêtre ne coupe pas un minuteur lancé : il sonnera quand même.
  // Fermer pendant que l'alarme sonne, en revanche, vaut « OK ».
  #handleClose() {
    if (this.#isTimerFinished) {
      this.#clearTimer();
    }
    this.#openController?.abort();
    this.#openController = null;
    this.#wakeLock.disable();
  }

  #handleNext() {
    if (this.#stepIndex >= this.#steps.length - 1) {
      this.#onFinish?.();
      this.close();
      return;
    }
    this.#goToStep(this.#stepIndex + 1);
  }

  #goToStep(stepIndex) {
    this.#stepIndex = Math.min(Math.max(stepIndex, 0), this.#steps.length - 1);
    const step = this.#steps[this.#stepIndex];
    const isIngredientStep = this.#stepIndex === 0;
    this.#elements.counter.textContent = isIngredientStep
      ? 'Ingrédients'
      : `Étape ${this.#stepIndex} sur ${this.#steps.length - 1}`;
    const contentChildren = isIngredientStep
      ? [createElement('ul', { className: 'cook-ingredients' }, step.ingredientLines.map((line) => createElement('li', { text: line })))]
      : [createElement('p', { className: 'cook-step', text: step.text })];
    replaceChildrenWithFragment(this.#elements.content, contentChildren);
    this.#elements.previousButton.disabled = this.#stepIndex === 0;
    this.#elements.nextButton.textContent = this.#stepIndex === this.#steps.length - 1 ? 'Terminé' : 'Suivant';
    this.#renderTimer();
  }

  #getStepMilliseconds(stepIndex) {
    const step = this.#steps[stepIndex];
    const stepMinutes = stepIndex === 0 || !step ? null : findStepMinutes(step.text);
    return stepMinutes === null ? null : stepMinutes * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
  }

  #toggleTimer() {
    if (this.#timer?.isRunning) {
      this.#timer.pause();
      this.#renderTimer();
      return;
    }
    if (!this.#timer) {
      const durationMilliseconds = this.#getStepMilliseconds(this.#stepIndex);
      if (durationMilliseconds === null) {
        return;
      }
      this.#timer = new StepTimer({
        durationMilliseconds,
        onTick: () => this.#renderTimer(),
        onFinish: () => this.#finishTimer(),
      });
      this.#timerStepIndex = this.#stepIndex;
      this.#isTimerFinished = false;
    }
    this.#prepareSound();
    this.#timer.start();
    this.#renderTimer();
  }

  // La fenêtre se rouvre si elle était fermée : le bouton « OK » qui coupe l'alarme est sous la main.
  #finishTimer() {
    this.#isTimerFinished = true;
    if (!this.#dialog.open && this.#lastOpenArguments) {
      this.open(...this.#lastOpenArguments);
    }
    this.#renderTimer();
    this.#startAlarm();
  }

  #startAlarm() {
    this.#stopAlarm();
    this.#playAlarmBurst();
    this.#alarmIntervalId = setInterval(() => this.#playAlarmBurst(), ALARM_REPEAT_MILLISECONDS);
    this.#alarmStopTimeoutId = setTimeout(() => this.#stopAlarm(), ALARM_MAX_DURATION_MILLISECONDS);
  }

  #stopAlarm() {
    clearInterval(this.#alarmIntervalId);
    clearTimeout(this.#alarmStopTimeoutId);
    this.#alarmIntervalId = null;
    this.#alarmStopTimeoutId = null;
    navigator.vibrate?.(0);
  }

  #dismissTimer() {
    this.#clearTimer();
    this.#renderTimer();
  }

  #clearTimer() {
    this.#stopAlarm();
    this.#timer?.stop();
    this.#timer = null;
    this.#timerStepIndex = null;
    this.#isTimerFinished = false;
  }

  #renderTimer() {
    const { timer, timerLabel, clock, timerButton, timerStopButton } = this.#elements;
    const hasTimer = this.#timer !== null;
    const currentStepMilliseconds = this.#getStepMilliseconds(this.#stepIndex);
    timer.hidden = !hasTimer && currentStepMilliseconds === null;
    if (timer.hidden) {
      return;
    }
    const isOtherStep = hasTimer && this.#timerStepIndex !== this.#stepIndex;
    timerLabel.textContent = isOtherStep ? `Minuteur de l’étape ${this.#timerStepIndex}` : '';
    if (this.#isTimerFinished) {
      clock.textContent = 'C’est prêt';
    } else {
      clock.textContent = formatClock(hasTimer ? this.#timer.remainingMilliseconds : currentStepMilliseconds);
    }
    timerButton.hidden = this.#isTimerFinished;
    timerButton.textContent = this.#describeTimerButton();
    timerStopButton.hidden = !hasTimer;
    timerStopButton.textContent = this.#isTimerFinished ? 'OK, arrêter l’alarme' : 'Arrêter';
    timerStopButton.className = this.#isTimerFinished ? 'primary-button' : 'quiet-button';
    timer.classList.toggle('is-ringing', this.#isTimerFinished);
  }

  #describeTimerButton() {
    if (!this.#timer) {
      return 'Lancer le minuteur';
    }
    return this.#timer.isRunning ? 'Pause' : 'Reprendre';
  }

  // Le son ne peut démarrer qu'après un geste de l'utilisateur : on le prépare ici, au clic.
  #prepareSound() {
    try {
      this.#audioContext ??= new AudioContext();
    } catch (audioError) {
      console.info('Son indisponible : seule la vibration préviendra.', audioError);
    }
  }

  async #playAlarmBurst() {
    navigator.vibrate?.(ALARM_VIBRATION_PATTERN);
    if (!this.#audioContext) {
      return;
    }
    try {
      // Après un passage en arrière-plan, le navigateur suspend le son : il faut le réveiller.
      if (this.#audioContext.state === 'suspended') {
        await this.#audioContext.resume();
      }
      const volume = this.#audioContext.createGain();
      volume.gain.value = ALARM_VOLUME;
      volume.connect(this.#audioContext.destination);
      const burstStart = this.#audioContext.currentTime;
      ALARM_BEEP_FREQUENCIES_HERTZ.forEach((frequency, beepIndex) => {
        const oscillator = this.#audioContext.createOscillator();
        // Un son carré porte bien plus loin qu'un son pur à volume égal.
        oscillator.type = 'square';
        oscillator.frequency.value = frequency;
        oscillator.connect(volume);
        const beepStart = burstStart + beepIndex * (ALARM_BEEP_SECONDS + ALARM_BEEP_GAP_SECONDS);
        oscillator.start(beepStart);
        oscillator.stop(beepStart + ALARM_BEEP_SECONDS);
      });
    } catch (audioError) {
      console.info('Alerte sonore indisponible.', audioError);
    }
  }
}
