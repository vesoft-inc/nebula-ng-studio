import React, { useState } from 'react';
import { Box, Divider, List, ListItemButton, Popover, Typography } from '@mui/material';
import { NonCollapsibleHeader, SiderItemHeader } from './styles';
import { MenuUp, MenuDown, SitemapOutline } from '@vesoft-inc/icons';
import { observer } from 'mobx-react-lite';
import { useModal, useStore } from '@studio/stores';
import { useTranslation } from 'react-i18next';
import { ISchemaItem } from '@studio/interfaces';
import { useLocation, useNavigate } from 'react-router-dom';
import CreateSchemaModal from '@studio/components/CreateSchemaModal';
import { isGuiTarget } from '@studio/utils';

interface IProps {
  paperWidth: number;
  onSchemaChanged?: (schema: ISchemaItem) => void | Promise<void>;
}

const popoverId = 'schema-selector';

function SchemaSelector(props: IProps) {
  const { paperWidth, onSchemaChanged } = props;
  const { schemaStore, commonStore } = useStore();
  const { userInfo } = commonStore;
  const { schemas, switchSchema } = schemaStore;
  const { t } = useTranslation(['common']);
  const { pathname } = useLocation();
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);
  const message = useModal().message;
  const navigate = useNavigate();
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleChangeSchema = (schema: ISchemaItem) => async () => {
    const res = await switchSchema(schema.path);
    if (res.code === 0) {
      schemaStore.updateCurrentSchame(schema);
      message.success(t('switchSchemaSuccess', { ns: 'common' }));
      if (onSchemaChanged) {
        handleClose();
        await onSchemaChanged(schema);
        return;
      }
      if (pathname.includes('console')) {
        navigate('/console', { replace: true });
      } else {
        navigate('/schema-manager/graphtype', { replace: true });
      }
      navigate(0);
    }
  };

  const handleCreateSchema = async (path: string) => {
    const res = await schemaStore.createSchema(path);
    if (res.code === 0) {
      setCreateModalOpen(false);
      schemaStore.getSchemas();
      navigate('/schema-list');
    }
  };

  return (
    <>
      {!isGuiTarget ? (
        <SiderItemHeader
          variant="text"
          sx={{
            fontSize: 16,
            lineHeight: 24,
            textTransform: 'none',
            textDecoration: 'none',
          }}
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            setAnchorEl(e.currentTarget);
          }}
        >
          <Box
            display="flex"
            justifyContent="space-between"
            width={'100%'}
            height="100%"
            alignItems={'center'}
            padding={(theme) => `${theme.spacing(0.5)} ${theme.spacing(0)}`}
          >
            <Box display="flex" alignItems="center">
              <SitemapOutline sx={{ mr: 1 }} />
              {userInfo?.curSchemaPath.split('/').pop()}
            </Box>
            {<>{open ? <MenuUp fontSize="medium" /> : <MenuDown fontSize="medium" />}</>}
          </Box>
        </SiderItemHeader>
      ) : (
        <NonCollapsibleHeader>
          <SitemapOutline sx={{ mr: 1 }} />
          {t('schema', { ns: 'common' })}
        </NonCollapsibleHeader>
      )}
      <Popover
        id={popoverId}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        slotProps={{
          paper: {
            sx: {
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              pb: 1,
            },
          },
        }}
      >
        <>
          <List
            sx={{
              width: paperWidth,
            }}
          >
            {schemas.map((schema) => (
              <ListItemButton key={schema.path} onClick={handleChangeSchema(schema)}>
                <Typography sx={{ fontSize: 14, fontWeight: 'bold' }}>{schema.path}</Typography>
              </ListItemButton>
            ))}
          </List>
          <Divider sx={{ mb: 1 }} />
          <Box>
            <ListItemButton
              sx={{
                fontWeight: 'bold',
                color: (theme) => theme.palette.vesoft.v2.primary3,
              }}
              onClick={() => {
                navigate('/schema-list');
              }}
            >
              {t('viewAllSchemas', { ns: 'common' })}
            </ListItemButton>
            <ListItemButton
              onClick={() => setCreateModalOpen(true)}
              sx={{
                fontWeight: 'bold',
                color: (theme) => theme.palette.vesoft.v2.primary3,
              }}
            >
              {t('createSchema', { ns: 'common' })}
            </ListItemButton>
          </Box>
          <CreateSchemaModal
            open={createModalOpen}
            onCancel={() => setCreateModalOpen(false)}
            onOk={handleCreateSchema}
          />
        </>
      </Popover>
    </>
  );
}

export default observer(SchemaSelector);
