import { observable } from 'mobx';
import cloneDeep from 'lodash/cloneDeep';
import type { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import type { SnapshotPayload } from '../../contracts/snapshot';
import type { GraphRuntimeState } from './types';

const createBrowserImage = (src: string) => {
  const image = new Image();
  image.src = src;
  return image;
};

/** The only restore boundary that creates observable collections and browser image instances. */
export function materializeSnapshot(
  payload: SnapshotPayload,
  createImage: (src: string) => HTMLImageElement = createBrowserImage
) {
  const nowDataMap = new Map<string, NodeObject | LinkObject>(
    Object.entries(cloneDeep(payload.nowDataMap)).map(([id, entity]) => {
      // Commands and the renderer share the serialized index's string identity.
      entity.id = id;
      return [id, entity as NodeObject | LinkObject];
    })
  );
  const nodesFor = (ids: (string | number)[]) =>
    ids.map((id) => nowDataMap.get(String(id)) as NodeObject).filter(Boolean);
  const linksFor = (ids: (string | number)[]) =>
    ids.map((id) => nowDataMap.get(String(id)) as LinkObject).filter(Boolean);
  const links = new Set(linksFor(payload.links));
  links.forEach((link) => {
    link.source = (nowDataMap.get(String(link.source)) || {}) as NodeObject;
    link.target = (nowDataMap.get(String(link.target)) || {}) as NodeObject;
  });
  return {
    version: payload.version,
    filterType: payload.filterType,
    nowDataMap,
    nodes: observable.set(nodesFor(payload.nodes), { deep: false }),
    links: observable.set(links, { deep: false }),
    nodesSelected: observable.set(nodesFor(payload.nodesSelected), { deep: false }),
    linksSelected: observable.set(linksFor(payload.linksSelected), { deep: false }),
    displayedNodePropertyItems: observable.array(payload.displayedNodePropertyItems, { deep: false }),
    displayedEdgePropertyItems: observable.array(payload.displayedEdgePropertyItems, { deep: false }),
    filterList: observable.array(payload.filterList, { deep: false }),
    imagesCache: (payload.imagesCache ?? [])
      .filter((item) => Array.isArray(item) && item.length === 2)
      .map(([key, src]): [string, HTMLImageElement] => [key, createImage(src)]),
  } satisfies GraphRuntimeState;
}
