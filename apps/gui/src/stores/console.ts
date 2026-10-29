import { ConsoleController } from '@vesoft-inc/studio-ui-internal/console/model';
import { guiConsoleServices } from '../services/console';

export const consoleStore = new ConsoleController(guiConsoleServices);
