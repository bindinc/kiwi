export function registerAcwDispositionSlice(actionRouter, runtime) {
    if (!actionRouter || typeof actionRouter.registerMany !== 'function' || !runtime) {
        return;
    }

    actionRouter.registerMany({
        'acw.manual-finish'() {
            runtime.manualFinishACW();
        },
        'disposition.update-outcomes'() {
            runtime.updateDispositionOutcomes();
        },
        'disposition.toggle-follow-up'() {
            runtime.toggleFollowUpSection();
        },
        'disposition.cancel'() {
            runtime.cancelDisposition();
        },
        'disposition.save'() {
            runtime.saveDisposition();
        }
    });
}
