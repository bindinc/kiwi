import { registerAcwDispositionSlice } from './acw-disposition-slice.js';
import { registerAgentStatusSlice } from './agent-status-slice.js';
import { registerCallSessionSlice } from './call-session-slice.js';
import { registerDebugSlice } from './debug-slice.js';
import { createLegacyBridge } from './legacy-bridge.js';
import { registerQueueSlice } from './queue-slice.js';

export function registerCallQueueAgentStatusSlices(actionRouter, options = {}) {
    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    const bridge = createLegacyBridge(options);
    registerAgentStatusSlice(actionRouter, bridge);
    registerCallSessionSlice(actionRouter, bridge);
    registerQueueSlice(actionRouter, bridge);
    registerAcwDispositionSlice(actionRouter, bridge);
    registerDebugSlice(actionRouter, bridge);
}
