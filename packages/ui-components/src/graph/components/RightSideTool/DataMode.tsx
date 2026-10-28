import { GraphEntityType } from '@vesoft-inc/studio-core/contracts';
import { observer } from 'mobx-react-lite';

function DataMode({ entityType }: { entityType: GraphEntityType | 'all' }) {
  return (
    <div>
      <h1>{entityType}</h1>
    </div>
  );
}

export default observer(DataMode);
