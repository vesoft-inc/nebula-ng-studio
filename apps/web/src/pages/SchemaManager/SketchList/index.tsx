import { Box, Container, Divider, IconButton, Stack, Typography, useTheme } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown } from '@vesoft-inc/ui-components';
import { DeleteOutline, MoreHorizFilled } from '@vesoft-inc/icons';
import { useNavigate } from 'react-router-dom';

import { useModal, useStore } from '@studio/stores';
import Empty from '@studio/components/Empty';
import { deleteSketch } from '@studio/services';
import { SketchItemCard } from './styles';

function SketchList() {
  const { graphtypeStore } = useStore();

  const { sketchListItem } = graphtypeStore;
  const { t } = useTranslation(['graphtype']);
  const theme = useTheme();
  useEffect(() => {
    graphtypeStore.fetchSketchList();
  }, []);
  const { message } = useModal();

  const navigate = useNavigate();

  const handleDeleteSketch = async (id: number) => {
    const res = await deleteSketch(id);
    if (res.code === 0) {
      message.success(t('sketchDeleteSuccess', { ns: 'graphtype' }));
      graphtypeStore.fetchSketchList();
      return;
    }
  };

  return (
    <Container maxWidth="xl">
      <Box>
        <Typography
          variant="h3"
          fontSize={20}
          fontWeight={500}
          lineHeight={'36px'}
          sx={{ color: (theme) => theme.palette.vesoft.textColor1 }}
        >
          {t('sketchTitle', { ns: 'graphtype' })}
        </Typography>
      </Box>
      <Divider sx={{ mt: 3, mb: 3 }} />
      <Stack spacing={{ xs: 5, sm: 5 }} direction="row" useFlexGap flexWrap="wrap">
        {sketchListItem.items.length > 0 ? (
          sketchListItem.items.map((item) => (
            <SketchItemCard key={item.id} sx={{ width: `calc(25% - ${theme.spacing(5)})`, height: 250 }}>
              <Box
                width="100%"
                height={140}
                display={'flex'}
                padding={2}
                justifyContent="center"
                sx={{ backgroundColor: theme.palette.grey[100] }}
              >
                <img
                  onClick={() => {
                    navigate(`${item.id}`);
                  }}
                  style={{ objectFit: 'cover' }}
                  src={item.snapshot}
                />
              </Box>
              <Box padding={2}>
                <Typography fontSize={20} sx={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {`${t('sketch', { ns: 'graphtype' })} - ${item.name} - ${item.id}`}
                </Typography>
              </Box>
              <Box paddingRight={2} display="flex" justifyContent="flex-end">
                <Dropdown
                  items={[
                    {
                      icon: <DeleteOutline color="error" />,
                      label: <Typography color="error">{t('delete', { ns: 'graphtype' })}</Typography>,
                      key: 'delete',
                      onClick: (e) => {
                        e.stopPropagation();
                        handleDeleteSketch(item.id!);
                      },
                    },
                  ]}
                >
                  <IconButton onClick={(e) => e.stopPropagation()}>
                    <MoreHorizFilled fontSize="medium" />
                  </IconButton>
                </Dropdown>
              </Box>
            </SketchItemCard>
          ))
        ) : (
          <Box width="100%" height={300} mt={10}>
            <Empty />
          </Box>
        )}
      </Stack>
    </Container>
  );
}

export default observer(SketchList);
