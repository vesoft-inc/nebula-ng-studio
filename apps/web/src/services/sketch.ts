import { SketchListItem, ISketchItem } from '@studio/interfaces';
import { fetcher } from './fetcher';

export const createSketch = async (payload: ISketchItem) => {
  const res = await fetcher.post<{ id: number }>('/sketch/create', payload);
  return res.data;
};

export const deleteSketch = async (id: number) => {
  const res = await fetcher.delete<number>(`/sketch/delete/${id}`);
  return res.data;
};

export const getSketchList = async (payload: { keyword?: string; page?: number; pageSize?: number }) => {
  const res = await fetcher.get<SketchListItem>(`/sketch/list`, payload);
  return res.data;
};

export const getSketchById = async (sketchId: number) => {
  const res = await fetcher.get<{ item: ISketchItem }>(`/sketch/${sketchId}`);
  return res.data;
};

export const getSketchListTotal = async () => {
  const res = await fetcher.get<{ total: number }>(`/sketch/total`);
  return res.data;
};

export const udpateSketch = async (payload: ISketchItem) => {
  const res = await fetcher.put(`/sketch/update`, payload);
  return res.data;
};
