import { useCallback, useState } from 'react';
import { SketchPicker } from 'react-color';
import { debounce } from 'lodash';
import { FORCEGRAPH_COLOR_PICK_LIST } from '@vesoft-inc/ui-components/theme';

interface ColorPickerProps {
  color?: string;
  onChangeComplete?: (color: string) => void;
}

function ColorPicker(props: ColorPickerProps) {
  const { color, onChangeComplete } = props;
  const [curColor, setCurColor] = useState<string | undefined>(color);

  const onColorChange = useCallback(
    debounce((color: string) => onChangeComplete?.(color), 100),
    []
  );

  return (
    <SketchPicker
      disableAlpha={true}
      color={curColor || undefined}
      width="auto"
      onChange={(color, event) => {
        event.stopPropagation();
        event.preventDefault();
        setCurColor(color.hex);
      }}
      onChangeComplete={(color, event) => {
        event.stopPropagation();
        event.preventDefault();
        onColorChange(color.hex);
      }}
      styles={{
        picker: {},
      }}
      presetColors={FORCEGRAPH_COLOR_PICK_LIST}
    />
  );
}

export default ColorPicker;
