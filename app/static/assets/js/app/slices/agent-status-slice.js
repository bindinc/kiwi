export function registerAgentStatusSlice(actionRouter, runtime) {
    if (!actionRouter || typeof actionRouter.registerMany !== 'function' || !runtime) {
        return;
    }

    actionRouter.registerMany({
        'agent-status.toggle-menu'(_payload, context) {
            runtime.toggleStatusMenu(context.event);
        },
        'agent-status.set'(payload, context) {
            const statusFromElement = context.element?.dataset?.statusOption;
            const requestedStatus = payload.status || statusFromElement;
            if (!requestedStatus) {
                return;
            }

            runtime.setAgentStatus(requestedStatus);
        }
    });
}
