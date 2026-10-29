import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import { SketchListItem, ISketchItem } from '@vesoft-inc/studio-ui-internal/schema/types';
import { fetcher } from './fetcher';

export const createSketch = async (payload: ISketchItem) => {
  const res = await fetcher.post<ServerResponse<{ id: number }>>('/sketch/create', payload);
  return res.data;
};

export const deleteSketch = async (id: number) => {
  const res = await fetcher.delete<ServerResponse<number>>(`/sketch/delete/${id}`);
  return res.data;
};

export const getSketchList = async (payload: { keyword?: string; page?: number; pageSize?: number }) => {
  const res = await fetcher.get<ServerResponse<SketchListItem>>(`/sketch/list`, { params: payload });
  return res.data;
};

export const getSketchById = async (sketchId: number) => {
  const res = await fetcher.get<ServerResponse<{ item: ISketchItem }>>(`/sketch/${sketchId}`);
  return res.data;
};

export const getSketchListTotal = async () => {
  const res = await fetcher.get<ServerResponse<{ total: number }>>(`/sketch/total`);
  return res.data;
};

export const udpateSketch = async (payload: ISketchItem) => {
  const res = await fetcher.put<ServerResponse>(`/sketch/update`, payload);
  return res.data;
};
