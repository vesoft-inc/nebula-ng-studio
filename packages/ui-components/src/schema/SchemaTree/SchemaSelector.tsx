import React, { useRef, useState } from 'react';
import { Box, Divider, List, ListItemButton, Popover, Typography } from '@mui/material';
import { NonCollapsibleHeader, SiderItemHeader } from './styles';
import { MenuUp, MenuDown, SitemapOutline } from '@vesoft-inc/icons';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ISchemaItem } from '../types';
import CreateSchemaModal from '../CreateSchemaDialog/index';

export interface SchemaSelectorProps {
  paperWidth: number;
  schemaLabel?: string;
  schemas: ISchemaItem[];
  collapsed: boolean;
  switching?: boolean;
  onSwitchSchema: (schema: ISchemaItem) => Promise<boolean>;
  onCreateSchema: (path: string) => Promise<boolean>;
  onViewAllSchemas: () => void;
}

const popoverId = 'schema-selector';

function SchemaSelector(props: SchemaSelectorProps) {
  const {
    paperWidth,
    schemaLabel,
    schemas,
    collapsed,
    switching = false,
    onSwitchSchema,
    onCreateSchema,
    onViewAllSchemas,
  } = props;
  const { t } = useTranslation(['common']);
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [pending, setPending] = useState(false);
  const switchingRef = useRef(false);
  const open = Boolean(anchorEl);
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleChangeSchema = (schema: ISchemaItem) => async () => {
    if (switching || switchingRef.current) return;
    switchingRef.current = true;
    setPending(true);
    try {
      const switched = await onSwitchSchema(schema);
      if (switched) handleClose();
    } catch {
      // The host presents transport errors; a cancelled switch must leave the selector usable.
    } finally {
      switchingRef.current = false;
      setPending(false);
    }
  };

  const handleCreateSchema = async (path: string) => {
    const created = await onCreateSchema(path);
    if (created) setCreateModalOpen(false);
  };

  return (
    <>
      {!collapsed ? (
        <SiderItemHeader
          variant="text"
          disabled={switching || pending}
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
              {schemaLabel}
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
              <ListItemButton key={schema.path} disabled={switching || pending} onClick={handleChangeSchema(schema)}>
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
              onClick={onViewAllSchemas}
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
