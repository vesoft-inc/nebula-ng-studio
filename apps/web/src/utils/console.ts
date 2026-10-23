// Compatibility facade; implementation lives in ui-components.
export {
  type GraphColorUsage,
  type GraphCandidate,
  type ConsoleHandoffPayload,
  CONSOLE_SNAPSHOT_NAME_PREFIX,
  CONSOLE_SNAPSHOT_NAME_MAX_LENGTH,
  CONSOLE_SNAPSHOT_GQL_MAX_LENGTH,
  rankGraphCandidates,
  pickGraphType,
  buildSnapshotName,
  ensureSnapshotSchemaPath,
  buildHandoffPayload,
} from '@vesoft-inc/ui-components/console/model';
