import { FileBlockProps } from "@githubnext/blocks";
import { useMemo, useState } from "react";
import { hsl, rgb } from "d3-color";
import { tw } from "twind";

export default function (props: FileBlockProps) {
  const { content, onRequestUpdateContent } = props;
  const [selectedColor, setSelectedColor] = useState(["", 0]);
  const [modifiedColors, setModifiedColors] = useState([]);
  const [isDirty, setIsDirty] = useState(false);

  // starts with scale = {
  // ends with }
  const colorsObjectRegex = /scale\s*=\s*\{([\s\S][^\}])*/;
  const colors = useMemo(() => {
    const colorsString = (colorsObjectRegex.exec(content)?.[0] || "").split(
      "{"
    )[1];
    const colors = eval(`window.colors={${colorsString}}`) || {};
    setModifiedColors(colors);
    setIsDirty(false);
    return colors;
  }, [content]);

  const onUpdateContent = () => {
    const newContent = content.replace(
      colorsObjectRegex,
      `scale = ${JSON.stringify(modifiedColors, null, 2).slice(0, -2)}`
    );
    onRequestUpdateContent(newContent);
    setIsDirty(false);
  };

  const selectedColorValue =
    typeof modifiedColors[selectedColor[0]] === "string"
      ? modifiedColors[selectedColor[0]]
      : modifiedColors[selectedColor[0]]?.[selectedColor[1]];

  return (
    <div className={tw(`Box relative`)}>
      <div className={tw(`Box-body overflow-auto`)}>
        {isDirty && (
          <button
            className={tw(`absolute right-2 top-2 btn btn-primary`)}
            onClick={() => {
              onUpdateContent();
            }}
          >
            Save changes
          </button>
        )}
        {Object.keys(modifiedColors).map((key) => (
          <div className={tw(`flex items-center`)} key={key}>
            <div
              className={tw(`p-3 w-20`)}
              style={{ flex: 0, minWidth: "5rem" }}
            >
              {key}
            </div>
            <div className={tw(`flex`)} style={{ flex: 1 }}>
              {(Array.isArray(modifiedColors[key])
                ? modifiedColors[key]
                : [modifiedColors[key]]
              ).map((value: string, index: number) => {
                const originalColor =
                  typeof colors[key] === "string"
                    ? colors[key]
                    : colors[key]?.[index];
                return (
                  <Color
                    value={value}
                    key={index}
                    onChange={(newColor) => {
                      const newModifiedColors = { ...modifiedColors };
                      const isArray = Array.isArray(newModifiedColors[key]);
                      if (isArray) {
                        newModifiedColors[key] = [...newModifiedColors[key]];
                        newModifiedColors[key][index] = newColor;
                      } else {
                        newModifiedColors[key] = newColor;
                      }
                      setModifiedColors(newModifiedColors);
                      setIsDirty(true);
                    }}
                    selectedColor={selectedColorValue}
                    originalColor={originalColor}
                    onSelect={() => setSelectedColor([key, index])}
                    onDeselect={() => setSelectedColor(["", 0])}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const getLuminance = (color: string) => {
  const rgbValue = rgb(color);
  if (
    Number.isNaN(rgbValue.r) ||
    Number.isNaN(rgbValue.g) ||
    Number.isNaN(rgbValue.b)
  )
    return 0;
  const r = rgbValue.r / 255;
  const R = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const g = rgbValue.g / 255;
  const G = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const b = rgbValue.b / 255;
  const B = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
  const luminance = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  return luminance;
};
const getContrast = (color1: string, color2: string) => {
  const luminance1 = getLuminance(color1);
  const luminance2 = getLuminance(color2);
  return luminance1 > luminance2
    ? (luminance1 + 0.05) / (luminance2 + 0.05)
    : (luminance2 + 0.05) / (luminance1 + 0.05);
};
const getLevel = (contrast: number) => {
  return contrast > 7.1 ? "AAA" : contrast > 4.5 ? "AA" : "";
};
const getOffsetColor = (color: string) => {
  const hslValue = hsl(color);
  if (Number.isNaN(hslValue.l)) return color;
  if (hslValue.l > 0.5) {
    hslValue.l -= 0.33;
    hslValue.s -= 0.2;
    hslValue.h += 0.1;
  } else {
    hslValue.l += 0.33;
    hslValue.s += 0.1;
    hslValue.h += 0.1;
  }
  return hslValue.formatHex();
};

const Color = ({
  value,
  onChange,
  selectedColor,
  originalColor,
  onSelect,
  onDeselect,
}: {
  value: string;
  onChange: (newColor: string) => void;
  originalColor: string;
  selectedColor: string;
  onSelect: () => void;
  onDeselect: () => void;
}) => {
  const contrast = +getContrast(selectedColor, value).toFixed(2);
  const contrastLevel = getLevel(contrast);
  const textColor = getOffsetColor(value);
  return (
    <div
      className={tw(
        "relative border-2 border-transparent m-[-2px] focus-within:border-black focus-within:z-10"
      )}
      style={{
        background: value,
        fontFamily: "Fira code",
      }}
    >
      {originalColor && originalColor !== value && (
        <div className={tw("absolute left-[2px] top-[2px] w-3 h-3")}>
          <svg viewBox="0 0 1 1" width="100%" height="100%">
            <path d="M 0 0 L 1 0 L 0 1 Z" fill={originalColor} />
          </svg>
        </div>
      )}
      <input
        className={tw(
          `relative w-28 h-20 p-2 text-xs text-right pt-6 bg-transparent focus:outline-none`
        )}
        style={{ color: textColor }}
        onClick={() => onSelect()}
        onFocus={() => onSelect()}
        onBlur={() => onDeselect()}
        onChange={(e) => {
          const newValue = e.target.value;
          onChange(newValue);
        }}
        value={value}
      />
      {selectedColor && (
        <div
          className={tw(
            "absolute right-[0.6rem] top-2 text-[0.66em] font-bold tracking-widest"
          )}
          style={{
            color: selectedColor,
          }}
        >
          {contrastLevel}
        </div>
      )}
    </div>
  );
};
