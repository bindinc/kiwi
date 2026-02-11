export function registerAgentStatusSlice(actionRouter, bridge) {
    if (!actionRouter || typeof actionRouter.registerMany !== 'function' || !bridge) {
        return;
    }

    actionRouter.registerMany({
        'agent-status.toggle-menu'(_payload, context) {
            bridge.invoke('toggleStatusMenu', [context.event]);
        },
        'agent-status.set'(payload, context) {
            const statusFromElement = context.element?.dataset?.statusOption;
            const requestedStatus = payload.status || statusFromElement;
            if (!requestedStatus) {
                return;
            }

            bridge.invoke('setAgentStatus', [requestedStatus]);
        }
    });
}
