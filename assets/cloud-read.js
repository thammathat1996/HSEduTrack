/* Start an online read before the main UI initializes. Scores stay in RAM only. */
(() => {
    const endpoint = document.currentScript?.dataset.sheetUrl;
    let initial = null;
    let initialController = null;
    if (endpoint && !window.HSInitialCloudReadStarted && window.HSCloudTransport) {
        window.HSInitialCloudReadStarted = true;
        const url = new URL(endpoint);
        url.searchParams.set('action', 'sync');
        initialController = new AbortController();
        initial = window.HSCloudTransport.read(url.toString(), {signal: initialController.signal});
    }
    window.HSCloudReader = {
        read: (...args) => window.HSCloudTransport.read(...args),
        takeInitial(expectedEndpoint, {signal} = {}) {
            if (expectedEndpoint !== endpoint || !initial) return null;
            const pending = initial;
            const controller = initialController;
            initial = null;
            initialController = null;
            const cancel = () => controller.abort();
            signal?.addEventListener('abort', cancel, {once: true});
            if (signal?.aborted) cancel();
            return pending.finally(() => signal?.removeEventListener('abort', cancel));
        }
    };
})();
