import { Feature } from '@common-stack/client-react';

import Common from './common';
import ApolloCounter from './apollo-server-n-client';
import ConnectedReactRouter, { Counter } from './connected-react-router';
import Fela from './fela';
import { ElectronTrayModule, ElectronMainModule } from './connected-react-router/index.electron';

export default new Feature(Common, ConnectedReactRouter, ApolloCounter, Fela);
export { ElectronTrayModule, ElectronMainModule, Counter };
