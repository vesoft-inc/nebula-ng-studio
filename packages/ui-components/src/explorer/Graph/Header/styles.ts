import { Autocomplete, IconButton, type AutocompleteProps } from '@mui/material';
import { styled } from '@mui/material/styles';
import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';

export const ToolIconButton = styled(IconButton)`
  width: 36px;
  height: 36px;
  padding: 6px;
  flex-shrink: 0;

  &:hover {
    color: ${({ theme }) => theme.palette.vesoft.themeColor1};
  }
`;

export const OpenableSearchInput = styled(Autocomplete)<AutocompleteProps<NodeObject | LinkObject, false, false, true>>(
  {
    width: 320,
    flexShrink: 0,
  }
);
