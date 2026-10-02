/* Start the online read while the HTML and presentation assets are loading.
 * This keeps scores only in this tab's memory. No browser score cache is used.
 */
(() => {
    const endpoint = document.currentScript?.dataset.sheetUrl;
    const READ_TIMEOUT_MS = 12000;
    const RETRY_DELAY_MS = 500;
    async function read(url) {
        for (let attempt = 0; attempt < 2; attempt++) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);
            try {
                const freshURL = new URL(url);
                freshURL.searchParams.set('_refresh', Date.now().toString());
                const response = await fetch(freshURL.toString(), {
                    method: 'GET', redirect: 'follow', cache: 'no-store', signal: controller.signal
                });
                if (!response.ok) {
                    const error = new Error('Load HTTP ' + response.status);
                    error.retryable = response.status === 408 || response.status === 429 || response.status >= 500;
                    throw error;
                }
                return {data: await response.json()};
            } catch (error) {
                const retryable = error.retryable === true || error.name === 'AbortError' || error instanceof TypeError;
                if (!retryable || attempt === 1 || navigator.onLine === false) return {error};
            } finally {
                clearTimeout(timer);
            }
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }
    const startedAt = Date.now();
    let initial = null;
    if (endpoint && !window.HSInitialCloudReadStarted) {
        const url = new URL(endpoint);
        url.searchParams.set('action', 'sync');
        initial = read(url.toString()); // Always resolves, including network failures.
    }
    window.HSCloudReader = {
        read,
        takeInitial(expectedEndpoint) {
            if (expectedEndpoint !== endpoint || !initial) return null;
            const pending = initial;
            initial = null; // Release the bootstrap's reference after the app takes it.
            return Date.now() - startedAt <= 15000 ? pending : null;
        }
    };
})();
