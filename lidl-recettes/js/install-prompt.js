// Bouton « Installer l'appli » : Chrome (Android, ordinateur) annonce qu'il peut installer la page
// comme une vraie application ; on garde cette proposition pour la déclencher au clic.
// Hors de Chrome, ou une fois l'appli installée, le bouton reste caché.
export function setUpInstallButton(installButton) {
  const listenersController = new AbortController();
  const { signal } = listenersController;
  let deferredInstallPrompt = null;

  const isRunningAsApp = () => window.matchMedia('(display-mode: standalone)').matches;
  const hideButton = () => {
    installButton.hidden = true;
    deferredInstallPrompt = null;
  };

  window.addEventListener('beforeinstallprompt', (installEvent) => {
    installEvent.preventDefault();
    deferredInstallPrompt = installEvent;
    installButton.hidden = isRunningAsApp();
  }, { signal });

  window.addEventListener('appinstalled', hideButton, { signal });

  installButton.addEventListener('click', async () => {
    if (!deferredInstallPrompt) {
      return;
    }
    const installPrompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        hideButton();
      }
    } catch (installError) {
      console.info('Installation annulée ou indisponible.', installError);
    }
  }, { signal });

  return () => listenersController.abort();
}
