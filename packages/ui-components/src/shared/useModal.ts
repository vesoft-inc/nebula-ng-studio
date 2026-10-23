import { useUi } from '../provider';
export function useModal() {
  return useUi().modalStore;
}
