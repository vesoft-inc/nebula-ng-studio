import { ConsoleController, type ConsoleServices } from '@vesoft-inc/studio-ui-internal/console/model';
import { execConsoleGql, execGql } from '@studio/services';

export const studioConsoleServices: ConsoleServices = { execute: execConsoleGql, query: execGql };

/** Studio owns the transport and session; the controller owns Console behavior. */
export default class ConsoleStore extends ConsoleController {
  constructor() {
    super(studioConsoleServices);
  }
}
