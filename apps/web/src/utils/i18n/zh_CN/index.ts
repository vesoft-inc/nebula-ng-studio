import type { Resource } from '../en_US';
import common from './common';
import login from './login';
import graphtype from './graphtype';
import route from './route';
import console from './console';
import graph from './graph';
import explain from './explain';

import explorerCommon from './explorerCommon';
import explorer from './explorer';

const resource: Resource = {
  common: { ...explorerCommon, ...common },
  login,
  graphtype,
  route,
  console,
  graph,
  explain,
  explorer,
};

export default resource;
