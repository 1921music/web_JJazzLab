"use strict";

{
    const installButton = document.querySelector("#install-app");
    let installPrompt;
    window.addEventListener("beforeinstallprompt", event => {
        event.preventDefault();
        installPrompt = event;
        installButton.hidden = false;
    });
    window.addEventListener("appinstalled", () => {
        installPrompt = undefined;
        installButton.hidden = true;
    });
    installButton.onclick = async () => {
        const prompt = installPrompt;
        if (!prompt) return;
        installPrompt = undefined;
        installButton.hidden = true;
        try { await prompt.prompt(); }
        catch (error) { console.warn("App installation could not start.", error); }
    };
    if ("serviceWorker" in navigator && window.isSecureContext && /^https?:$/u.test(location.protocol)) {
        navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" })
            .catch(error => console.warn("Offline support could not start.", error));
    }
}
