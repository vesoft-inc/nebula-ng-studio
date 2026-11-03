import { useNavigate } from '@tanstack/react-router';
import { SchemaEditor } from '@vesoft-inc/studio-ui-internal/schema-editor';
import { GraphTypeBuildMode } from '@vesoft-inc/studio-ui-internal/schema/types';
export function EditorPage(props: { mode: GraphTypeBuildMode; graphTypeName?: string; sketchId?: number }) {
  const navigate = useNavigate();
  const list = () => {
    void navigate({ to: '/schema-manager/graphtype' });
  };
  return (
    <SchemaEditor
      {...props}
      onSaved={list}
      onBack={list}
      onEdit={(graphTypeName) =>
        void navigate({ to: '/schema-manager/graphtype/edit/$graphTypeName', params: { graphTypeName } })
      }
      onView={(graphTypeName) =>
        void navigate({ to: '/schema-manager/graphtype/view/$graphTypeName', params: { graphTypeName } })
      }
    />
  );
}
