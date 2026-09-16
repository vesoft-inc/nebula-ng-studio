import { EyeOff, RemoveRedeyeFilled } from '@vesoft-inc/icons';
export const renderPasswordIcon = (isVisible: boolean) => {
  return isVisible ? <EyeOff /> : <RemoveRedeyeFilled />;
};
