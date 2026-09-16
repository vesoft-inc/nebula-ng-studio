import { useCallback, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { AddFilled, SearchFilled, SettingsFilled } from '@vesoft-inc/icons';
import { FormContainer, TextFieldElement, useForm, AutocompleteElement } from 'react-hook-form-mui';
import { Container, IconButton, MenuItem, Pagination, Stack, Tooltip } from '@mui/material';
import { Button, Typography, Grid, Box, Fade } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';

import SnapshotCard from '@studio/pages/Explorer/Snapshots/SnapshotCard';
import { useModal, useStore } from '@studio/stores';
import EmptySnapShotDarkSvg from '@studio/images/snapshot-empty-dark.svg?url';
import EmptySnapShotLightSvg from '@studio/images/snapshot-empty-light.svg?url';
import PageLoading from '@studio/components/GraphWorkbench/PageLoading';
import EditSnapshotModal from '@studio/pages/Explorer/Snapshots/SnapshotCard/EditSnapshotModal';
import { Snapshot } from '@studio/interfaces/explorer';
import CreateSnapshotModal from '@studio/pages/Explorer/Snapshots/SnapshotCard/CreateSnapshotModal';
import EmptyCardImage from '@studio/images/empty-card-content.svg?url';
import EmptyCardDarkImage from '@studio/images/empty-card-content-dark.svg?url';
import ExplorerSchemaSelector from '../SchemaSelector';
import SnapshotSettingsDrawer from './Drawer';
import { useExplorerSettingsDrawer } from './hook';

const NewExplorerButton = observer(function NewExplorerButtonComp({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState<boolean>(false);
  const navigate = useNavigate();
  const { explorerStore } = useStore();
  const { graphItems, addSnapshot } = explorerStore;
  const graphs = graphItems.slice();
  const { t } = useTranslation(['explorer', 'common']);
  const [loading, setLoading] = useState<boolean>(false);
  const onSubmit = useCallback(
    async (data: { name: string; graph: string }) => {
      setLoading(true);
      const graph_type = graphs.find((g) => g.name === data.graph)?.graph_type;
      const resData = await addSnapshot({ ...data, graph_type: graph_type! });
      setLoading(false);
      if (resData?.id) {
        navigate(`/explorer/snapshots/${resData.id}`);
      }
    },
    [graphs]
  );

  return (
    <>
      <Button
        startIcon={<AddFilled />}
        variant="contained"
        disabled={disabled}
        onClick={() => {
          explorerStore.getGraphItems();
          setOpen(true);
        }}
      >
        {t('newExplorer', { ns: 'explorer' })}
      </Button>
      <CreateSnapshotModal
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        loading={loading}
        graphs={graphs}
      />
    </>
  );
});

type SearchForm = {
  graph?: string;
  name?: string;
};

const NoSnapShot = observer(function NoSnapShot() {
  const { t } = useTranslation(['common']);
  const { themeStore } = useStore();
  const isDarkMode = themeStore.mode === 'dark';
  return (
    <Box className="w-full pt-10 flex flex-col items-center">
      <img src={isDarkMode ? EmptySnapShotDarkSvg : EmptySnapShotLightSvg} />
      <Typography fontSize={24} mt={2} fontWeight={600}>
        {t('noSnapshotTip1', { ns: 'common' })}
      </Typography>
      <Typography fontSize={14} my={2} fontWeight={400}>
        {t('noSnapshotTip2', { ns: 'common' })}
      </Typography>
    </Box>
  );
});

function Snapshots() {
  const { explorerStore, themeStore } = useStore();
  const navigate = useNavigate();
  const settingsDrawer = useExplorerSettingsDrawer();
  const { loading, graphItems, currentSchema } = explorerStore;
  const { snapshots, total, getSnapshots, currentPage, pageSize } = explorerStore;
  const [editSnapShot, setEditSnapShot] = useState<Snapshot | undefined>(undefined);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [switchingSchema, setSwitchingSchema] = useState(false);
  const isDarkMode = themeStore.mode === 'dark';
  const editModalOpen = editSnapShot !== undefined;
  const totalPage = Math.ceil(total / pageSize);
  useEffect(() => {
    if (currentSchema?.path) {
      getSnapshots(currentPage);
    }
  }, [currentPage, currentSchema?.path]);

  const { t } = useTranslation(['explorer', 'common']);
  const graphs = graphItems.slice();
  const form = useForm<SearchForm>();
  const modal = useModal();
  const showEmpty = snapshots.length === 0 && !hasSearched && !loading;

  const handleSchemaChanged = async () => {
    explorerStore.updateGraphWorkspace(undefined);
    explorerStore.updatePage(1);
    form.reset();
    setHasSearched(false);
    navigate('/explorer/snapshots', { replace: true });
    await explorerStore.getGraphItems();
  };

  const handleFilter = debounce(() => {
    const values = form.getValues();
    const graph = values.graph ? values.graph : undefined;
    const name = values.name ? values.name : undefined;
    setHasSearched(true);
    getSnapshots(1, { graph, name });
  }, 200);

  const handleDelete = async (id: string) => {
    form.reset();
    const flag = await explorerStore.deleteSnapshot(id);
    if (flag) {
      modal.message.success(t('success', { ns: 'common' }));
    }
    modal.hide();
    const newTotal = total > 1 ? total - 1 : total;
    const totalPage = Math.ceil(newTotal / pageSize);
    getSnapshots(currentPage > totalPage ? totalPage : currentPage);
  };

  const handleEditSnapShot = async ({ name }: { name: string }, cb: () => void) => {
    if (!editSnapShot) return;
    if (editSnapShot) {
      const res = await explorerStore.editSnapshot({
        ...editSnapShot,
        name,
      });
      if (res.code === 0) {
        modal.message.success(t('success', { ns: 'common' }));
        setEditSnapShot(undefined);
        getSnapshots(currentPage);
      }
      cb();
    }
  };

  const renderFormContainer = () => {
    return (
      <FormContainer formContext={form}>
        <Box display="flex" flexWrap="wrap" columnGap={1} rowGap={2} mb={2}>
          <Box sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <ExplorerSchemaSelector onSchemaChanged={handleSchemaChanged} onSwitchingChange={setSwitchingSchema} />
          </Box>
          <AutocompleteElement
            label={t('graph', { ns: 'explorer' })}
            name="graph"
            autocompleteProps={{
              autoSelect: true,
              size: 'small',
              sx: { width: 240, maxWidth: '100%', flexShrink: 0 },
              handleHomeEndKeys: true,
              onChange: (_) => {
                handleFilter();
              },
              renderOption: (props, option: string) => (
                <MenuItem {...props} key={option}>
                  <Typography ml={2}>{option}</Typography>
                </MenuItem>
              ),
              isOptionEqualToValue: (option: string, value: string) => option === value,
            }}
            options={graphs.map((g) => g.name)}
          />
          <TextFieldElement
            label={t('searchName', { ns: 'explorer' })}
            name="name"
            size="small"
            sx={{ ml: 'auto' }}
            onChange={() => handleFilter()}
            InputProps={{
              fullWidth: true,
              sx: { minWidth: 200, maxWidth: 300 },
              // onChange: () => handleFilter(),
              endAdornment: (
                <IconButton>
                  <SearchFilled />
                </IconButton>
              ),
            }}
          />
        </Box>
      </FormContainer>
    );
  };

  const renderNodata = () => {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '30vh',
          width: '100%',
        }}
      >
        <Box
          component="img"
          src={isDarkMode ? EmptyCardDarkImage : EmptyCardImage}
          sx={{
            width: 85,
            height: 65,
          }}
        />
        <Box sx={{ color: (theme) => theme.palette.vesoft.v2.text3, mt: 2 }}>
          {t('noMatchingExplorations', { ns: 'explorer' })}
        </Box>
      </Box>
    );
  };

  return (
    <>
      <Container className="container mx-auto min-h-full flex flex-col">
        <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2} py={3}>
          <Typography fontWeight={500} fontSize={24}>
            {t('exploreList', { ns: 'explorer' })}
          </Typography>
          <Stack direction="row" alignItems="center" gap="10px" sx={{ ml: 'auto' }}>
            <Tooltip title={t('explorerSettings', { ns: 'explorer' })}>
              <IconButton
                aria-label={t('explorerSettings', { ns: 'explorer' })}
                onClick={() => settingsDrawer.toggle(true)}
                size="small"
                sx={{ p: 2 }}
              >
                <SettingsFilled />
              </IconButton>
            </Tooltip>
            <NewExplorerButton disabled={!currentSchema?.path || switchingSchema} />
          </Stack>
        </Box>
        {renderFormContainer()}
        {showEmpty && !switchingSchema ? (
          <NoSnapShot />
        ) : (
          <>
            <Box className="flex-grow py-4 relative">
              {loading || switchingSchema ? (
                <PageLoading
                  containerSx={{
                    minHeight: 500,
                  }}
                />
              ) : total === 0 ? (
                renderNodata()
              ) : (
                <>
                  <Grid container spacing={2}>
                    {snapshots.map((s, idx) => (
                      <Fade key={s.id} in timeout={idx * 300}>
                        <Grid size={{ xs: 6, sm: 4, md: 4, lg: 4, xl: 3 }}>
                          <SnapshotCard
                            isDeleted={!graphItems.find((g) => g.name === s.graph)}
                            item={s}
                            onDelete={() => handleDelete(s.id)}
                            onEdit={() => setEditSnapShot(s)}
                          />
                        </Grid>
                      </Fade>
                    ))}
                  </Grid>
                  <Box className="mt-2 flex justify-end w-full">
                    {totalPage > 1 && (
                      <Pagination
                        page={currentPage}
                        count={totalPage}
                        size="medium"
                        hidePrevButton
                        hideNextButton
                        showFirstButton
                        showLastButton
                        onChange={(_, page) => explorerStore.updatePage(page)}
                      />
                    )}
                  </Box>
                </>
              )}
            </Box>
            <EditSnapshotModal
              open={editModalOpen}
              data={editSnapShot}
              onOk={handleEditSnapShot}
              onCancel={() => setEditSnapShot(undefined)}
            />
          </>
        )}
      </Container>
      <SnapshotSettingsDrawer open={settingsDrawer.isOpen} onClose={() => settingsDrawer.toggle(false)} />
    </>
  );
}

const observedSnapshots = observer(Snapshots);

export default observedSnapshots;
