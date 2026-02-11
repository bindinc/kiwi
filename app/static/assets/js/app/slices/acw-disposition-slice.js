export function registerAcwDispositionSlice(actionRouter, bridge) {
    if (!actionRouter || typeof actionRouter.registerMany !== 'function' || !bridge) {
        return;
    }

    actionRouter.registerMany({
        'acw.manual-finish'() {
            bridge.invoke('manualFinishACW');
        },
        'disposition.update-outcomes'() {
            bridge.invoke('updateDispositionOutcomes');
        },
        'disposition.toggle-follow-up'() {
            bridge.invoke('toggleFollowUpSection');
        },
        'disposition.cancel'() {
            bridge.invoke('cancelDisposition');
        },
        'disposition.save'() {
            bridge.invoke('saveDisposition');
        }
    });
}
