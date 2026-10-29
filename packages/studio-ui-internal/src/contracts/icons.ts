export enum IconGroupType {
  SVG = 'svg',
  Img = 'img',
}

/** Service record. Metadata may be omitted by adapters that only supply catalog content. */
export interface IconItemRecord {
  id: string;
  name: string;
  icon: string;
  groupId: string;
  create_time?: number;
}

export interface IconGroupRecord {
  id: string;
  name: string;
  type?: string;
  create_time?: number;
  update_time?: number;
}

/** Plain catalog display data, enriched from service records by IconCatalog. */
export interface IconItemData extends IconItemRecord {
  category: string;
  categoryCN?: string;
}

export interface IconGroupData extends IconGroupRecord {
  nameCN?: string;
  icons: readonly IconItemData[];
  editable: boolean;
}
