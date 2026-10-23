import EntityLabelList from '../../../graph/components/EntityLabelList/index';
import EntityTypeLabel from '../../../graph/components/EntityTypeLabel/index';
import { RawEntityType } from '../../../graph/types/index';
import { useExplorerStore } from '../../context';
import {
  autocompleteClasses,
  type AutocompleteRenderOptionState,
  Box,
  Chip,
  ListItem,
  Popper,
  styled,
  Typography,
  useTheme,
} from '@mui/material';
import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import { KeyVariant } from '@vesoft-inc/icons';
import { observer } from 'mobx-react-lite';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { VariableSizeList, ListChildComponentProps } from 'react-window';
const LISTBOX_PADDING = 8; // px
function renderRow(props: ListChildComponentProps) {
  const { data, index, style } = props;
  const dataSet = data[index];
  const inlineStyle = {
    ...style,
    top: (style.top as number) + LISTBOX_PADDING,
  };

  const { key, ...optionProps } = dataSet[0];

  return (
    <Typography
      key={key}
      component="span"
      {...optionProps}
      style={inlineStyle}
      sx={{
        padding: (theme) => `${theme.spacing(1)} ${theme.spacing(1)}`,
        '&:not(:last-child)': {
          borderBottom: (theme) => `1px solid ${theme.palette.vesoft.v2.divider1}`,
        },
      }}
    >
      {dataSet[1]}
    </Typography>
  );
}

function useResetCache(data: number) {
  const ref = React.useRef<VariableSizeList>(null);
  React.useEffect(() => {
    if (ref.current != null) {
      ref.current.resetAfterIndex(0, true);
    }
  }, [data]);
  return ref;
}

const OuterElementContext = React.createContext({});

const OuterElementType = React.forwardRef<HTMLDivElement>((props, ref) => {
  const outerProps = React.useContext(OuterElementContext);
  return <div ref={ref} {...props} {...outerProps} />;
});

export const ListboxComponent = observer(
  React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLElement>>(function ListboxComponent(props, ref) {
    const { children, ...other } = props;
    const explorerStore = useExplorerStore();
    const { graphWorkspace } = explorerStore;
    const itemData: React.ReactElement[] = [];
    (children as React.ReactElement[]).forEach((item: React.ReactElement & { children?: React.ReactElement[] }) => {
      itemData.push(item);
      itemData.push(...(item.children || []));
    });
    const itemCount = itemData.length;
    const itemSize = 96;

    const getChildSize = (child: unknown): number => {
      const children = child as React.ReactElement[];
      if (!children[1]) return 0;
      const item = (children[1].props as { item: NodeObject | LinkObject }).item;
      if (item.data.type === RawEntityType.EDGE) {
        const multiKeys = graphWorkspace.edgeTypeMultiEdgeKeyMap.get(item.data.value.type);
        if (multiKeys === 'Unique' || multiKeys === 'Auto') {
          return Object.keys(item.data.value.properties).length > 0 ? 72 : 45;
        } else {
          const primaryKeys = graphWorkspace.nodeTypePrimaryKeysMap.get(item.data.value.type);
          return Object.keys(item.data.value.properties).filter((key) => !primaryKeys?.includes(key)).length > 0
            ? 96
            : 72;
        }
      } else if (item.data.type === RawEntityType.NODE) {
        const primaryKeys = graphWorkspace.nodeTypePrimaryKeysMap.get(item.data.value.type);
        return Object.keys(item.data.value.properties).filter((key) => !primaryKeys?.includes(key)).length > 0
          ? 96
          : 72;
      }
      return 0;
    };

    const getHeight = () => {
      if (itemCount > 8) {
        return 8 * itemSize;
      }
      return itemData.map(getChildSize).reduce((a, b) => a + b, 0);
    };

    const gridRef = useResetCache(itemCount);

    return (
      <div ref={ref}>
        <OuterElementContext.Provider value={other}>
          <VariableSizeList
            itemData={itemData}
            height={getHeight() + 2 * LISTBOX_PADDING}
            width="100%"
            ref={gridRef}
            innerElementType={'ul'}
            outerElementType={OuterElementType}
            itemSize={(index: number) => getChildSize(itemData[index])}
            overscanCount={10}
            itemCount={itemCount}
            style={{ maxHeight: 300, overflowY: 'auto' }}
          >
            {renderRow}
          </VariableSizeList>
        </OuterElementContext.Provider>
      </div>
    );
  })
);

export const StyledPopper = styled(Popper)({
  [`& .${autocompleteClasses.listbox}`]: {
    boxSizing: 'border-box',
    '& ul': {
      padding: 0,
      margin: 0,
    },
  },
});

interface HighlightProps {
  text: string;
  highlight?: string;
}

export const Highlight: React.FC<HighlightProps> = ({ text, highlight }) => {
  if (!highlight?.trim()) {
    return <span>{text}</span>;
  }

  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);
  return (
    <Box component="span" sx={{ fontWeight: 'bold' }}>
      {parts.map((part, index) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <Box
            component="span"
            key={index}
            sx={{
              color: (theme) => theme.palette.vesoft.v2.warning2,
            }}
          >
            {part}
          </Box>
        ) : (
          part
        )
      )}
    </Box>
  );
};

export const OptionItem = observer((props: { item: NodeObject | LinkObject; state: AutocompleteRenderOptionState }) => {
  const { item, state } = props;
  const theme = useTheme();
  const explorerStore = useExplorerStore();
  const { graphWorkspace } = explorerStore;
  const inputValue = state?.inputValue?.trim();
  const primaryKeys = graphWorkspace.nodeTypePrimaryKeysMap.get(item.data.value.type);
  const { t } = useTranslation(['explorer']);
  const renderPrimaryKeyInfo = () => {
    if (item.data.type === RawEntityType.EDGE) {
      const mulitiKey = graphWorkspace.edgeTypeMultiEdgeKeyMap.get(item.data.value.type);
      if (!mulitiKey) return;
      if (mulitiKey === 'Unique') {
        return;
      }
      if (mulitiKey === 'Auto') {
        return;
      }
      return (
        <Typography mt={1} display="flex" alignItems="center">
          {(mulitiKey as string[])?.map((key) => (
            <Box component="span" key={key}>
              {key}:
              <Highlight key={key} text={`${item.data.value.properties[key] as string}`} highlight={inputValue} />
            </Box>
          ))}
          <Chip
            size="small"
            label={t('muiltiEdgeKeyLabel', { ns: 'explorer' })}
            sx={{
              ml: 1,
              borderRadius: 1,
              backgroundColor: theme.palette.vesoft.v2.bg7,
            }}
          />
        </Typography>
      );
    }
    return (
      <Typography mt={1} display="flex" alignItems="center">
        {primaryKeys?.map((key) => (
          <Box component="span" key={key}>
            {key}:
            <Highlight key={key} text={`${item.data.value.properties[key] as string}`} highlight={inputValue} />
          </Box>
        ))}
        <KeyVariant
          fontSize="small"
          sx={{
            ml: 1,
            color: (theme) => theme.palette.vesoft.v2.text3,
          }}
        />
      </Typography>
    );
  };

  const renderMatchProperties = () => {
    return (
      <Typography mt={1} display="flex" alignItems="center">
        {Object.entries(item.data.value.properties)
          .filter(([key, value]) => !primaryKeys?.includes(key) && value?.toString().includes(inputValue))
          .map(([key, value]) => (
            <Box component="span" key={key} mr={1}>
              {key}:
              <Highlight key={key} text={`${value as string}`} highlight={inputValue} />
            </Box>
          ))}
      </Typography>
    );
  };

  return (
    <ListItem
      key={item.id}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        overflowX: 'auto',
      }}
    >
      <Box display="flex" alignItems="center">
        <EntityTypeLabel item={item} sx={{ mr: 1 }} />
        <EntityLabelList workspace={graphWorkspace} labels={item.data.value.labels} />
      </Box>
      <Box>
        {renderPrimaryKeyInfo()}
        {renderMatchProperties()}
      </Box>
    </ListItem>
  );
});
