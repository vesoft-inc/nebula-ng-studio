import { useUi } from '../../../provider';
import { useIconCatalog } from '../../resources';
import { IconGroupType } from '../../constants';
import { Language } from '../../../locales/index';
import { Box, Button, IconButton, styled, Tab, Tabs, Tooltip } from '@mui/material';
import { AddFilled, CheckboxBlankOffOutline, CloseFilled } from '@vesoft-inc/icons';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import EditableText from '../EditableText/index';
import { EMPTY_ICON } from '../../utils/base/index';

const IconTab = styled(Tab)`
  padding: ${({ theme }) => theme.spacing(0)};
`;

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

interface TabPanelProps {
  children?: React.ReactNode;
  groupId: string;
  currentGroupId: string;
}

const IconSize = 36;
const TabWidth = 54;

function TabPanel(props: TabPanelProps) {
  const { children, currentGroupId, groupId, ...other } = props;

  return (
    <Box
      component="div"
      role="tabpanel"
      hidden={currentGroupId !== groupId}
      id={`vertical-tabpanel-${groupId}`}
      aria-labelledby={`vertical-tab-${groupId}`}
      flex={1}
      sx={{
        height: '100%',
        overflowY: 'auto',
      }}
      {...other}
    >
      {currentGroupId === groupId && <Box pl={0.5}>{children}</Box>}
    </Box>
  );
}

function a11yProps(groupId: string) {
  return {
    id: `vertical-tab-${groupId}`,
    'aria-controls': `vertical-tabpanel-${groupId}`,
  };
}

interface IProps {
  onIconSelect?: (param: { iconId: string; icon: string }) => void;
  onImgSelect?: (img?: HTMLImageElement) => void;
  type: IconGroupType;
  allowRemoteIconManagement?: boolean;
}

function CategoryIconGroup(props: IProps) {
  const iconGroupStore = useIconCatalog();
  const { onIconSelect, onImgSelect, type } = props;
  const allowRemoteIconManagement = !!props.allowRemoteIconManagement && !!iconGroupStore.service;
  const { initIconGroupList, addNewGroup, deleteGroup, updateGroupName, selectGroup, addIcon, deleteIcon } =
    iconGroupStore;
  const { t, i18n } = useTranslation(['explorer']);
  const typeGroupKey = `${type}Group` as const;
  const { message } = useUi().modalStore;
  // const fileInputRef = useRef<HTMLInputElement>(null);
  // const localStorageKey = `${typeGroupKey}TipsHide` as const;
  const { officalGroupList, serverGroupList, currentGroupId } = iconGroupStore[typeGroupKey];

  const isSVGType = type === IconGroupType.SVG;
  useEffect(() => {
    initIconGroupList(type);
    currentGroupId && selectGroup({ type, groupId: currentGroupId });
  }, [type]);

  const updateSelectedGroup = (groupId: string) => {
    selectGroup({ type, groupId });
  };

  const handleChange = (e: React.SyntheticEvent, groupId: string) => {
    e.stopPropagation();
    selectGroup({ type, groupId });
  };

  const beforeImgSelect = useCallback(
    (base64Img: string) => {
      const img = new Image();
      img.src = base64Img;
      onImgSelect?.(img);
    },
    [type]
  );

  const beforeSVGUpload = useCallback((file: File) => {
    if (file.type !== 'image/svg+xml') {
      message.error(t('iconGroupAddSVGTips', { ns: 'explorer' }));
      return;
    } else if (file.size > 1 << 10) {
      message.error(t('iconGroupAddSVGLarge', { ns: 'explorer' }));
      return;
    }

    file.text().then((svgText) => {
      const svgDomEle = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
      const isValidSVG = svgDomEle.nodeName === 'svg' && !!svgDomEle.getAttribute('viewBox');
      if (!isValidSVG) {
        message.error(t('iconGroupAddSVGParseError', { ns: 'explorer' }));
        return;
      }

      const group = iconGroupStore.svgGroup.serverGroupList.find(
        (item) => item.id === iconGroupStore.svgGroup.currentGroupId
      );
      if (group) {
        addIcon({ group, name: file.name.trim().slice(0, 30), icon: svgText });
      }
    });
  }, []);

  const beforeImgUpload = useCallback((rcFile: File) => {
    const fileReader = new FileReader();
    fileReader.onload = (file) => {
      const base64Img = file.target?.result as string;

      const img = new Image();
      img.onload = () => {
        if (img.width > 200 || img.height > 200) {
          message.error(t('iconGroupAddImgTips', { ns: 'explorer' }));
          return;
        }

        /** clip circle image: r = 100 */
        const shadowCanvas = document.createElement('canvas');
        const canvasSize = Math.max(img.width, img.height);
        shadowCanvas.width = canvasSize;
        shadowCanvas.height = canvasSize;
        const shadowCtx = shadowCanvas.getContext('2d');
        if (shadowCtx) {
          shadowCtx.arc(canvasSize / 2, canvasSize / 2, canvasSize / 2, 0, Math.PI * 2);
          shadowCtx.clip();
          shadowCtx.drawImage(img, 0, 0, canvasSize, canvasSize);
        }

        const base64Radius = shadowCanvas.toDataURL();
        const radiusImg = new Image();
        radiusImg.src = base64Radius;
        const group = iconGroupStore.imgGroup.serverGroupList.find(
          (item) => item.id === iconGroupStore.imgGroup.currentGroupId
        );
        if (group) {
          addIcon({
            group,
            name: rcFile.name.trim().slice(0, 30),
            icon: base64Radius,
          });
        }
      };
      img.src = base64Img;
    };
    fileReader.readAsDataURL(rcFile);

    return;
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (isSVGType) {
      files && beforeSVGUpload(files[0]);
    } else {
      files && beforeImgUpload(files[0]);
    }
  };

  const clearNodesIcon = useCallback(() => {
    if (type === IconGroupType.SVG) {
      onIconSelect?.({ iconId: EMPTY_ICON, icon: '' });
      return;
    }
    onImgSelect?.();
  }, [type]);

  const removeTips =
    type === IconGroupType.Img ? t('imgClear', { ns: 'explorer' }) : t('iconClear', { ns: 'explorer' });

  return (
    <Box
      sx={{
        flexGrow: 1,
        bgcolor: 'background.paper',
        display: 'flex',
        height: 400,
      }}
    >
      <Tabs
        orientation="vertical"
        variant="scrollable"
        scrollButtons="auto"
        value={currentGroupId}
        onChange={handleChange}
        sx={{
          borderRight: 1,
          borderColor: 'divider',
          width: TabWidth + 18,
          marginBottom: 2,
          '.MuiButtonBase-root': {
            height: 24,
            width: '100%',
            textAlign: 'center',
          },
        }}
      >
        {officalGroupList.concat(serverGroupList).map((group) => (
          <IconTab
            sx={{
              height: 36,
              minHeight: 36,
              minWidth: TabWidth,
            }}
            key={group.id}
            wrapped
            disableRipple
            value={group.id}
            label={
              <EditableText
                text={i18n.language === Language.EN_US ? group.name : group.nameCN || group.name}
                editable={group.editable}
                onComplete={async (name) => {
                  await updateGroupName({ group, name });
                  message.success(t('updateSuccess', { ns: 'explorer' }));
                }}
                onDelete={async () => {
                  await deleteGroup({ type, group });
                  updateSelectedGroup(group.id);
                  message.success(t('deleteSuccess', { ns: 'explorer' }));
                }}
              />
            }
            {...a11yProps(group.id)}
          />
        ))}
      </Tabs>
      {officalGroupList.concat(serverGroupList).map((group) => (
        <TabPanel currentGroupId={currentGroupId!} groupId={group.id} key={group.id}>
          <Box
            sx={{
              maxHeight: '100%',
              overflowY: 'auto',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'flex-start',
              paddingTop: '6px',
            }}
          >
            {group.editable && (
              <IconButton aria-label="CloseFilled" component="label">
                <AddFilled />
                <VisuallyHiddenInput
                  type="file"
                  accept={isSVGType ? 'image/svg+xml' : '.jpg, .jpeg, .png'}
                  hidden
                  onChange={handleFileChange}
                />
              </IconButton>
            )}
            <Tooltip title={removeTips}>
              <IconButton sx={{ width: IconSize, height: IconSize }} onClick={clearNodesIcon}>
                <CheckboxBlankOffOutline color="error" />
              </IconButton>
            </Tooltip>
            {group.icons.map((item) => (
              <Box
                component="div"
                key={item.id}
                sx={{
                  width: IconSize,
                  height: IconSize,
                  padding: 1,
                  cursor: 'pointer',
                  transition: 'color 0.3s',
                  position: 'relative',
                  borderRadius: 1,
                  '&:hover': {
                    color: (theme) => theme.palette.vesoft.v2.primary3,
                    border: (theme) => `1px solid ${theme.palette.vesoft.v2.primary3}`,
                  },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  '.deleteIcon': {
                    display: 'none',
                  },
                  '&:hover .deleteIcon': {
                    display: 'block',
                  },
                }}
                onClick={() => {
                  type === IconGroupType.Img
                    ? beforeImgSelect(item.icon)
                    : onIconSelect?.({
                        iconId: `${item.category}_${item.id}_${item.name}`,
                        icon: item.icon,
                      });
                }}
              >
                {type === IconGroupType.Img ? (
                  <Box component="img" src={item.icon} alt="img" width="100%" height="100%" />
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      height: '100',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    dangerouslySetInnerHTML={{ __html: item.icon }}
                  />
                )}
                {group.editable && (
                  <CloseFilled
                    className="deleteIcon"
                    sx={{
                      borderRadius: '50%',
                      fontSize: '12px',
                      backgroundColor: '#d8d8d8',
                      color: '#fff',
                      cursor: 'pointer',
                      position: 'absolute',
                      right: '-5px',
                      top: '-5px',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteIcon({ group, icon: item });
                    }}
                  />
                )}
              </Box>
            ))}
          </Box>
        </TabPanel>
      ))}
      {allowRemoteIconManagement && (
        <Button
          variant="text"
          onClick={async () => {
            const groupId = await addNewGroup(type);
            if (groupId) {
              updateSelectedGroup(groupId);
            }
          }}
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: 30,
            '.MuiButton-startIcon': {
              marginRight: 0,
            },
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'none',
            },
          }}
          startIcon={<AddFilled />}
        >
          {t('addGroup', { ns: 'explorer' })}
        </Button>
      )}
    </Box>
  );
}

export default observer(CategoryIconGroup);
