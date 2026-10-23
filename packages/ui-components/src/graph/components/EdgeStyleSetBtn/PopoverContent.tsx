import { observer } from 'mobx-react-lite';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import ColorPicker from '../ColorPicker/index';
import { Button, ButtonGroup, FormControl, styled } from '@mui/material';
import { RadioGroup, FormControlLabel, Radio, Typography } from '@mui/material';
import type { GraphWorkspaceStore } from '../../stores/workspace';

export interface ISetProps {
  explorerItem: GraphWorkspaceStore;
  afterChange?: () => void;
  currentColor: string;
  entityType: string;
}

const TabPaneBox = styled(Box)`
  padding: 0 ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(1.5)};
`;

export const EdgeSizeOptions = [
  { label: 0.25, lineWidth: 1 },
  { label: 0.5, lineWidth: 2 },
  { label: 1, lineWidth: 3 },
  { label: 1.5, lineWidth: 4 },
  { label: 2, lineWidth: 7 },
  { label: 3, lineWidth: 10 },
];

const defaultLineWidth = EdgeSizeOptions[0].lineWidth;

function PopoverContent(props: ISetProps) {
  const { entityType, explorerItem } = props;
  const { graph } = explorerItem;
  const [tagType, setTagType] = useState('color');
  const { t } = useTranslation(['common']);
  const { linkColorPicker, linksSelected, changeLinksSelectedColor, changeLinksSelectedSize } = graph;
  const onColorChange = useCallback(
    (color: string) => {
      changeLinksSelectedColor({ color });
      linkColorPicker.setColor(entityType, color);
    },
    [entityType]
  );
  const onSizeChange = useCallback((lineWidth: number) => {
    changeLinksSelectedSize({ lineWidth: lineWidth });
    setCurSize(lineWidth);
  }, []);

  const size = (() => {
    if (linksSelected.size < 1) {
      return undefined;
    }
    const [firstLink, ...otherLinks] = linksSelected;
    const firstLineWidth = (firstLink.lineWidth as number) || defaultLineWidth;
    return otherLinks.every((link) => firstLineWidth === (link.lineWidth || defaultLineWidth))
      ? firstLineWidth
      : undefined;
  })();

  const [curSize, setCurSize] = useState(size);

  const items = useMemo(
    () => [
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
                {EdgeSizeOptions.map((item) => (
                  <FormControlLabel
                    key={item.label}
                    value={item.lineWidth}
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
                        <Typography width={30}>{item.label}</Typography>
                        <Box
                          component="div"
                          sx={{
                            width: 125,
                            flex: 1,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <Box
                            sx={{
                              width: 80,
                              height: item.lineWidth + 'px',
                              backgroundColor: props.currentColor,
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
    ],
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
            sx={{ height: 24, flex: 1 }}
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
