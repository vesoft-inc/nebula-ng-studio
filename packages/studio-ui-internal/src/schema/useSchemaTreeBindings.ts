import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SchemaItemType } from '../shared/constants';
import { useModal } from '../shared/useModal';
import type SchemaController from './SchemaController';
import type { SchemaTreeProps } from './SchemaTree';

export interface SchemaTreeBindingsOptions {
  controller: SchemaController;
  showDetail?: boolean;
  collapsed?: boolean;
  /** Override the controller's label, for example while session metadata is still loading. */
  schemaLabel?: string;
  onSchemaChange?: (path: string) => void;
  /** Called after a successful creation and attempted list refresh while the binding is still active. */
  onSchemaCreated?: (path: string) => void;
  onCreateGraphType?: () => void;
  onViewAllSchemas: () => void;
}

type BoundSchemaTreeProps = SchemaTreeProps & {
  selector: SchemaTreeProps['selector'] & Pick<SchemaTreeBindingsOptions, 'onViewAllSchemas'>;
};

/** Shared tree actions. The caller owns initial loading and navigation; UiProvider supplies messages. */
export function useSchemaTreeBindings({
  controller,
  showDetail = true,
  collapsed = false,
  schemaLabel,
  onSchemaChange,
  onSchemaCreated,
  onCreateGraphType,
  onViewAllSchemas,
}: SchemaTreeBindingsOptions): BoundSchemaTreeProps {
  const { t } = useTranslation('common');
  const { message } = useModal();
  const lifecycle = useRef<{ controller: SchemaController; active: boolean } | null>(null);

  useEffect(() => {
    // A fresh scope keeps pending work invalidated when effects restart or the controller changes.
    const scope = { controller, active: true };
    lifecycle.current = scope;
    return () => {
      scope.active = false;
    };
  }, [controller]);

  return {
    schema: controller.currentSchema,
    showDetail,
    onLoadNode: async ({ rawData }) => {
      try {
        switch (rawData?.type) {
          case SchemaItemType.GraphType:
            await controller.updateGraphTypesBySchema();
            break;
          case SchemaItemType.Graph:
            await controller.updateGraphsBySchema();
            break;
          case SchemaItemType.GraphTypeDescItem:
            if (showDetail && rawData.graphType) {
              await controller.updateGraphTypeDetailBySchema(rawData.graphType.graph_type);
            }
            break;
          case SchemaItemType.EntityTypeDescItem:
            if (showDetail && rawData.entity) {
              await controller.updateEntityTypeDescsBySchema(rawData.entity.graph_type_name, rawData.entity.type_name);
            }
            break;
        }
      } catch (error) {
        // An invalidated catalog read still completes the tree's loading interaction.
        if (!error || typeof error !== 'object' || !('name' in error) || error.name !== 'AbortError') throw error;
      }
    },
    onCreateGraphType,
    onCreateGraph: () => controller.updateCreateGraphModalInfo({ visible: true }),
    selector: {
      schemas: controller.schemas,
      schemaLabel: schemaLabel ?? controller.currentSchema.path.split('/').pop(),
      collapsed,
      switching: controller.switchingSchema,
      onSwitchSchema: async (schema) => {
        const result = await controller.switchSchema(schema.path);
        if (result.code !== 0) return false;
        onSchemaChange?.(schema.path);
        message.success(t('switchSchemaSuccess'));
        return true;
      },
      onCreateSchema: async (path) => {
        const scope = lifecycle.current;
        if (!scope?.active || scope.controller !== controller) return false;
        const result = await controller.createSchema(path);
        if (result.code !== 0) return false;
        if (!scope.active) return true;
        try {
          await controller.getSchemas();
        } catch {
          // Refreshing the catalog must not turn an already successful creation into a failure.
        }
        if (scope.active) onSchemaCreated?.(path);
        return true;
      },
      onViewAllSchemas,
    },
  };
}
