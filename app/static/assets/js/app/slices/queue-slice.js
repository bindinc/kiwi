export function registerQueueSlice(actionRouter, bridge) {
    if (!actionRouter || typeof actionRouter.registerMany !== 'function' || !bridge) {
        return;
    }

    actionRouter.registerMany({
        'queue.accept-next'() {
            bridge.invoke('acceptNextCall');
        },
        'queue.debug-generate'() {
            bridge.invoke('debugGenerateQueue');
        },
        'queue.debug-clear'() {
            bridge.invoke('debugClearQueue');
        }
    });
}
