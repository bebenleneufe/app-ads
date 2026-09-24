// Bouton « Installer l'appli » : toujours visible hors de l'appli installée.
// Si Chrome a annoncé qu'il peut installer la page (beforeinstallprompt), le bouton lance
// l'installation ; sinon (autre navigateur, annonce pas encore reçue), il affiche la marche à suivre.
let deferredInstallPrompt = null;

// Écouté dès le chargement du module : Chrome peut faire son annonce très tôt.
window.addEventListener('beforeinstallprompt', (installEvent) => {
  installEvent.preventDefault();
  deferredInstallPrompt = installEvent;
});

function isRunningAsApp() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function setUpInstallButton({ installButton, installHelp }) {
  const listenersController = new AbortController();
  const { signal } = listenersController;

  const hideAll = () => {
    installButton.hidden = true;
    installHelp.hidden = true;
  };

  if (isRunningAsApp()) {
    hideAll();
    return () => listenersController.abort();
  }
  installButton.hidden = false;

  window.addEventListener('appinstalled', hideAll, { signal });

  installButton.addEventListener('click', async () => {
    if (!deferredInstallPrompt) {
      installHelp.hidden = !installHelp.hidden;
      installButton.setAttribute('aria-expanded', String(!installHelp.hidden));
      return;
    }
    const installPrompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        hideAll();
      }
    } catch (installError) {
      console.info('Installation annulée ou indisponible.', installError);
      installHelp.hidden = false;
    }
  }, { signal });

  return () => listenersController.abort();
}
