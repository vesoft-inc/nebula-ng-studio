import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  type PopoverProps,
  Stack,
  styled,
  Typography,
  useTheme,
} from '@mui/material';
import { DeleteOutline, EditOutlined, MoreHorizFilled } from '@vesoft-inc/icons';
import { DateTimeFormat } from '../../../shared/constants';
import { Dropdown } from '../../../shared/index';

import EmptyCardImage from '../../../assets/images/empty-card-content.svg?url';
import EmptyCardDarkImage from '../../../assets/images/empty-card-content-dark.svg?url';
import type { SnapshotMetadata } from '../../../contracts/snapshot';
import { useModal } from '../../../shared/useModal';

const GraphCard = styled(Card)`
  background-color: ${({ theme }) => theme.palette.vesoft.background.paper};
  border-color: ${({ theme }) => theme.palette.vesoft.v2.divider1};
  border-radius: 10px;
  padding: 1px;
  position: relative;
  box-sizing: border-box;
  &:hover {
    border: 2px solid ${({ theme }) => theme.palette.vesoft.themeColor1};
    cursor: pointer;
    padding: 0;
  }
`;

interface IProps {
  item: SnapshotMetadata;
  onOpen?: () => void;
  onDelete: () => void;
  onEdit: () => void;
  isDeleted?: boolean;
}

function SnapshotCard(props: IProps) {
  const { item, isDeleted, onDelete, onEdit, onOpen } = props;
  const { t } = useTranslation(['explorer', 'common']);
  const modalStore = useModal();
  const theme = useTheme();
  const hasPreviewInfo = item.thumbnail!;
  const isDarkMode = theme.palette.mode === 'dark';

  return (
    <GraphCard
      variant="outlined"
      sx={{
        borderRadius: '10px',
        position: 'relative',
        bgcolor: ({ palette }) => palette.vesoft.v2.bg1,
      }}
    >
      <Box
        component="button"
        onClick={onOpen}
        aria-label={item.name}
        sx={{ display: 'block', width: '100%', border: 0, padding: 0, background: 'none' }}
      >
        <CardMedia
          sx={{
            height: 140,
            backgroundSize: hasPreviewInfo ? 'cover' : 'auto',
            backgroundPositionY: hasPreviewInfo ? '8px' : undefined,
            backgroundColor: hasPreviewInfo ? undefined : (theme) => theme.palette.vesoft.v2.bg1,
            cursor: 'pointer',
          }}
          image={item.thumbnail || (isDarkMode ? EmptyCardDarkImage : EmptyCardImage)}
          title="preview"
        />
      </Box>
      <CardContent>
        <Typography
          gutterBottom
          variant="h6"
          component="div"
          overflow="hidden"
          textOverflow="ellipsis"
          title={item.name}
          display="-webkit-box"
          sx={{
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {item.name}
        </Typography>
        <Stack spacing={1}>
          <Box display="flex" alignItems="center" fontSize={14} color="text.secondary">
            {t('graphName', { ns: 'explorer' })}
            <Typography
              ml={1}
              // flex={1}
              sx={{
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                maxWidth: 200,
              }}
            >
              {item.graph}
            </Typography>
            {isDeleted && (
              <Chip
                label={t('deleted', { ns: 'common' })}
                sx={{
                  width: 64,
                  textOverflow: 'ellipsis',
                  height: 16,
                  overflow: 'hidden',
                  borderRadius: 0.5,
                  marginLeft: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  lineHeight: 16,
                  textTransform: 'capitalize',
                  color: (theme) => theme.palette.vesoft.v2.text6,
                  backgroundColor: (theme) => theme.palette.vesoft.v2.unknown2,
                }}
              />
            )}
          </Box>
          <Typography fontSize={14} color="text.secondary">
            {t('lastUpdate', { ns: 'common' })}
            {dayjs(item.updated_at).format(DateTimeFormat)}
          </Typography>
        </Stack>
      </CardContent>
      <Box position="absolute" right={16} bottom={10}>
        <Dropdown
          items={[
            {
              icon: <EditOutlined />,
              label: <Typography>{t('edit', { ns: 'common' })}</Typography>,
              key: 'edit',
              onClick: onEdit,
            },
            {
              icon: <DeleteOutline color="error" />,
              label: <Typography color="error">{t('deleteExplorer', { ns: 'explorer' })}</Typography>,
              key: 'delete',
              onClick: () => {
                modalStore.severity({
                  title: t('deleteExplorer', { ns: 'explorer' }),
                  content: t('confirmDeleteSnapshot', { ns: 'common' }),
                  onOk: onDelete,
                  okText: t('delete', { ns: 'common' }),
                  cancelText: t('cancel', { ns: 'common' }),
                });
              },
            },
          ]}
          slotProps={{
            popover: {
              onMouseDown: (e) => e.stopPropagation(),
              onClick: (e) => {
                e.stopPropagation();
                e.preventDefault();
              },
            } as PopoverProps,
          }}
        >
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <MoreHorizFilled
              fontSize="medium"
              sx={{
                color: theme.palette.text.secondary,
              }}
            />
          </IconButton>
        </Dropdown>
      </Box>
    </GraphCard>
  );
}

export default SnapshotCard;
