import { observer } from 'mobx-react-lite';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { styled } from '@mui/material/styles';
import ColorPicker from '@studio/components/GraphWorkbench/ColorPicker';
import { Button, ButtonGroup, FormControl, Box } from '@mui/material';
import { RadioGroup, FormControlLabel, Radio, Typography } from '@mui/material';
import { NODE_AREA } from '@studio/utils/graph/base';
import { IconGroupType } from '@studio/utils/explorer/constant';
import CategoryIconGroup from './CategoryIconGroup';
import type { GraphWorkspaceStore } from '@studio/stores/graph/workspace';

export interface ISetProps {
  afterChange?: () => void;
  // mode: 'normal' | 'filter' | string;
  currentColor: string;
  entityType: string;
  explorerItem: GraphWorkspaceStore;
  allowRemoteIconManagement?: boolean;
}

const TabPaneBox = styled('div')`
  padding: 0 ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(1.5)};
`;

const NODE_SIZES = [
  {
    value: 0.25,
    label: 0.3,
  },
  {
    value: 0.5,
    label: 0.5,
  },
  {
    value: 1,
    label: 0.7,
  },
  {
    value: 1.5,
    label: 0.9,
  },
  {
    value: 2,
    label: 1.2,
  },
];

function PopoverContent(props: ISetProps) {
  const { entityType, explorerItem } = props;
  const [tagType, setTagType] = useState('color');
  const { graph } = explorerItem;
  const { nodesSelected } = graph;
  const { t } = useTranslation(['common']);
  const {
    // nodesSelected,
    changeNodesSelectedColor,
    changeNodesSelectedSize,
    changeNodesSelectedIcon,
    changeNodesSelectedImage,
    nodeColorPicker,
  } = graph;
  const onColorChange = useCallback(
    (color: string) => {
      changeNodesSelectedColor({ color });
      nodeColorPicker.setColor(entityType, color);
    },
    [entityType]
  );
  const onSizeChange = useCallback((size: number) => {
    changeNodesSelectedSize({ size });
    setCurSize(size);
  }, []);
  const onIconChange = useCallback(
    ({ iconId, icon }: { iconId: string; icon: string }) => changeNodesSelectedIcon({ iconId, icon }),
    []
  );
  const onImageChange = useCallback((img?: HTMLImageElement) => changeNodesSelectedImage({ img }), []);

  const size = (() => {
    if (nodesSelected.size < 1) {
      return undefined;
    }
    const [firstNode, ...otherNodes] = nodesSelected;
    const firstNodeArea = (firstNode.nodeArea as number) || NODE_AREA;
    return otherNodes.every((node) => firstNodeArea === (node.nodeArea || NODE_AREA))
      ? firstNodeArea / NODE_AREA
      : undefined;
  })();

  const [curSize, setCurSize] = useState(size);

  const items = useMemo(
    () =>
      [
        {
          key: 'color',
          label: t('color', { ns: 'common' }),
          children: (
            <Box width="100%" component="div">
              <ColorPicker onChangeComplete={onColorChange} color={props.currentColor} />
            </Box>
          ),
        },
        {
          key: 'size',
          label: t('size', { ns: 'common' }),
          children: (
            <TabPaneBox>
              <FormControl
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  e.stopPropagation();
                  const value = e.target.value;
                  if (value) {
                    onSizeChange(Number(value));
                  }
                }}
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <RadioGroup defaultValue={size} value={curSize}>
                  {NODE_SIZES.map((item) => (
                    <FormControlLabel
                      key={item.value}
                      value={item.value}
                      control={<Radio />}
                      label={
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            height: '40px',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Typography width={30}>{item.value}</Typography>
                          <Box
                            component="div"
                            sx={{
                              width: '125px',
                              flex: 1,
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <Box
                              component="span"
                              sx={{
                                width: `${20 * item.label}px`,
                                height: `${20 * item.label}px`,
                                borderRadius: '50%',
                                backgroundColor: props.currentColor,
                                display: 'inline-block',
                              }}
                            />
                          </Box>
                        </Box>
                      }
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            </TabPaneBox>
          ),
        },
        {
          key: 'icon',
          label: t('icon', { ns: 'common' }),
          children: (
            <TabPaneBox sx={{ padding: 0, width: '100%' }}>
              <CategoryIconGroup
                onIconSelect={onIconChange}
                type={IconGroupType.SVG}
                allowRemoteIconManagement={props.allowRemoteIconManagement}
              />
            </TabPaneBox>
          ),
        },
        props.allowRemoteIconManagement
          ? {
              key: 'image',
              label: t('image', { ns: 'common' }),
              children: (
                <TabPaneBox sx={{ padding: 0 }}>
                  <CategoryIconGroup onImgSelect={onImageChange} type={IconGroupType.Img} allowRemoteIconManagement />
                </TabPaneBox>
              ),
            }
          : null,
      ].filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [t, curSize, props.currentColor]
  );

  return (
    <Box
      component="div"
      padding={1.5}
      borderRadius={`6px`}
      width={242}
      border={(theme) => `1px solid ${theme.palette.vesoft.v2.border2}`}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <ButtonGroup variant="outlined" sx={{ mb: 1, display: 'flex' }}>
        {items.map((item) => (
          <Button
            key={item.key}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setTagType(item.key);
            }}
            sx={{ height: 24, flex: 1, whiteSpace: 'nowrap' }}
            variant={tagType === item.key ? 'contained' : 'outlined'}
          >
            {item.label.replace(/^\S/, (s) => s.toUpperCase())}
          </Button>
        ))}
      </ButtonGroup>
      {items.find((item) => item.key === tagType)?.children}
    </Box>
  );
}

export default observer(PopoverContent);
