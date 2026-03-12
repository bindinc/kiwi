import { registerAcwDispositionSlice } from './acw-disposition-slice.js';
import { registerAgentStatusSlice } from './agent-status-slice.js';
import { createCallAgentRuntimeClient } from './call-agent-runtime-client.js';
import { registerCallSessionSlice } from './call-session-slice.js';
import { registerDebugSlice } from './debug-slice.js';
import { registerQueueSlice } from './queue-slice.js';

export function registerCallQueueAgentStatusSlices(actionRouter, options = {}) {
    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    const runtime = createCallAgentRuntimeClient(options);
    registerAgentStatusSlice(actionRouter, runtime);
    registerCallSessionSlice(actionRouter, runtime);
    registerQueueSlice(actionRouter, runtime);
    registerAcwDispositionSlice(actionRouter, runtime);
    registerDebugSlice(actionRouter, runtime);
}
