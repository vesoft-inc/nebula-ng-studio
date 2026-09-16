import { useStore } from '@studio/stores';
import { Chip, Tooltip } from '@mui/material';
import { hexToRgba } from '@vesoft-inc/utils';
import { observer } from 'mobx-react-lite';

function EntityLabelList({ labels, mb }: { labels: string[]; mb?: number }) {
  const {
    explorerStore: { graphWorkspace },
  } = useStore();
  return labels.map((label, index) => {
    const color = graphWorkspace.labelColorPicker.whichColor(label);
    return (
      <Tooltip title={label} key={index} placement="bottom" arrow>
        <Chip
          label={label}
          sx={{
            maxWidth: 100,
            height: 22,
            borderRadius: 1,
            border: `1px solid ${color}`,
            backgroundColor: hexToRgba(color, 0.1),
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            mb,
            '&:not(:last-child)': {
              mr: 1,
            },
          }}
        />
      </Tooltip>
    );
  });
}

export default observer(EntityLabelList);
