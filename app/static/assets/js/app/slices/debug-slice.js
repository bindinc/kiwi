export function registerDebugSlice(actionRouter, bridge) {
    if (!actionRouter || typeof actionRouter.registerMany !== 'function' || !bridge) {
        return;
    }

    actionRouter.registerMany({
        'debug.close-modal'() {
            bridge.invoke('closeDebugModal');
        },
        'debug.toggle-known-caller'() {
            bridge.invoke('toggleKnownCallerSelect');
        },
        'debug.start-call'() {
            bridge.invoke('debugStartCall');
        },
        'debug.end-call'() {
            bridge.invoke('debugEndCall');
        },
        'debug.full-reset'() {
            bridge.invoke('fullReset');
        }
    });
}
