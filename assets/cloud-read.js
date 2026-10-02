/* Start the online read while the HTML and presentation assets are loading.
 * This keeps scores only in this tab's memory. No browser score cache is used.
 */
(() => {
    const endpoint = document.currentScript?.dataset.sheetUrl;
    const READ_TIMEOUT_MS = 20000;
    const RETRY_TIMEOUT_MS = 12000;
    const RETRY_DELAY_MS = 500;
    async function read(url) {
        for (let attempt = 0; attempt < 2; attempt++) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), attempt === 0 ? READ_TIMEOUT_MS : RETRY_TIMEOUT_MS);
            try {
                const freshURL = new URL(url);
                // If the optimized endpoint fails, retry the original Sheet read.
                // This also works with older Apps Script deployments.
                if (attempt > 0) {
                    freshURL.searchParams.delete('action');
                    freshURL.searchParams.delete('knownSha');
                }
                freshURL.searchParams.set('_refresh', Date.now().toString());
                const response = await fetch(freshURL.toString(), {
                    method: 'GET', redirect: 'follow', cache: 'no-store', signal: controller.signal
                });
                if (!response.ok) {
                    const error = new Error('Load HTTP ' + response.status);
                    error.retryable = response.status === 408 || response.status === 429 || response.status >= 500;
                    throw error;
                }
                const data = await response.json();
                const hasClasses = data && Array.isArray(data.classes) && data.classes.every(c =>
                    c && typeof c.id === 'string' && typeof c.name === 'string' &&
                    Array.isArray(c.students) && Array.isArray(c.assignments));
                const unchanged = data?.unchanged === true && data.success === true &&
                    data.readFormat === 'EDUTRACK_FAST_READ_V1' &&
                    data.storageFormat === 'EDUTRACK_CHUNKS_V1' &&
                    freshURL.searchParams.has('knownSha') &&
                    data.sha256 === freshURL.searchParams.get('knownSha');
                if (!hasClasses && !unchanged) {
                    const error = new Error('Invalid online score response');
                    error.retryable = true;
                    throw error;
                }
                return {data};
            } catch (error) {
                const retryable = error.retryable === true || error.name === 'AbortError' || error instanceof TypeError || error instanceof SyntaxError;
                if (!retryable || attempt === 1 || navigator.onLine === false) return {error};
            } finally {
                clearTimeout(timer);
            }
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }
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
            return pending; // Do not discard a completed read just because page assets were slow.
        }
    };
})();
