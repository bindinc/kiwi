export function registerDebugSlice(actionRouter, runtime) {
    if (!actionRouter || typeof actionRouter.registerMany !== 'function' || !runtime) {
        return;
    }

    actionRouter.registerMany({
        'debug.close-modal'() {
            runtime.closeDebugModal();
        },
        'debug.toggle-known-caller'() {
            runtime.toggleKnownCallerSelect();
        },
        'debug.start-call'() {
            runtime.debugStartCall();
        },
        'debug.end-call'() {
            runtime.debugEndCall();
        },
        'debug.full-reset'() {
            runtime.fullReset();
        }
    });
}
