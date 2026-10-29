export interface ConsoleSettingsForm {
  // 查询超时时间
  queryTimeout?: number;
  // 节点数量展示限制
  maxNodesLimit4Graph: number;

  [key: string]: unknown;
}

export interface ExplorerSettings {
  appConfigForm: {
    // 查询超时时间
    queryTimeout: number;
    // 返回结果条数上限
    maxRowsLimit: number;
    // 一度邻居最大数量
    maxNeighborsLimit: number;

    [key: string]: unknown;
  };
  personalConfigForm: {
    // 悬停时展示属性信息
    displayPropertiesOnHover: boolean;
    // 悬停时高亮一度邻居
    highlightNeighborsOnHover: boolean;

    [key: string]: unknown;
  };
}

export type ExplorerSettingsForm = ExplorerSettings['appConfigForm'] | ExplorerSettings['personalConfigForm'];

export const CONSOLE_DEFAULT_LOCAL_SETTINGS: ConsoleSettingsForm = {
  queryTimeout: 120,
  maxNodesLimit4Graph: 1000,
};

export const EXPLORER_DEFAULT_SETTINGS: ExplorerSettings = {
  appConfigForm: {
    queryTimeout: 120,
    maxRowsLimit: 100,
    maxNeighborsLimit: 100,
  },
  personalConfigForm: {
    displayPropertiesOnHover: true,
    highlightNeighborsOnHover: true,
  },
};

export type Settings4GraphStore = Partial<
  ConsoleSettingsForm & ExplorerSettings['appConfigForm'] & ExplorerSettings['personalConfigForm']
>;
