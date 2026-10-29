import { RawEntityType } from '../../types/index';
import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import { Chip, Typography, type ChipProps, type TypographyProps } from '@mui/material';

interface IProps {
  item: NodeObject | LinkObject;
  sx?: TypographyProps['sx'] | ChipProps['sx'];
}
function EntityTypeLabel(props: IProps) {
  const { item, sx = {} } = props;

  if (item.data.type === RawEntityType.EDGE) {
    return (
      <Typography
        fontWeight="bold"
        sx={{
          ...sx,
        }}
      >
        - {item.data.value.type} -
      </Typography>
    );
  }

  return (
    <Chip
      label={item.data.value.type}
      sx={{
        backgroundColor: item.color as string,
        borderRadius: 4,
        minWidth: 54,
        height: 22,
        textOverflow: 'ellipsis',
        overflow: 'hidden',
        color: (theme) => theme.palette.vesoft.v2.text1,
        fontWeight: 'bold',
        ...sx,
      }}
    />
  );
}

export default EntityTypeLabel;
