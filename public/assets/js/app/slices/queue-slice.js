export function registerQueueSlice(actionRouter, runtime) {
    if (!actionRouter || typeof actionRouter.registerMany !== 'function' || !runtime) {
        return;
    }

    actionRouter.registerMany({
        'queue.accept-next'() {
            runtime.acceptNextCall();
        },
        'queue.debug-generate'() {
            runtime.debugGenerateQueue();
        },
        'queue.debug-clear'() {
            runtime.debugClearQueue();
        }
    });
}
