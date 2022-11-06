import { tw } from "twind";
import { useMemo } from "react";
import { FileBlockProps } from "@githubnext/blocks";

export default function (props: FileBlockProps) {
  return <Wrapper {...props} />;
}

function Wrapper({ content, context }: FileBlockProps) {
  const { colors, fonts } = useMemo(() => {
    const colorVarsRegex = /^ *--color-([\w]+)\-?([\w]+)?:\s*(.+);$/gm
    const colorsMap = {};
    let match;
    while ((match = colorVarsRegex.exec(content)) !== null) {
      const [, color, shade = "100", value] = match;
      colorsMap[color] = colorsMap[color] || {};
      colorsMap[color][shade] = value;
    }
    const colors = Object.entries(colorsMap).map(([color]) => {
      return [color, Object.entries(colorsMap[color]).map(([shade, value]) => value)]
    })

    const fontRegex = /^ *--font-([\w\-]+): ['"](.+)['"];$/gm
    const fonts = [];
    while ((match = fontRegex.exec(content)) !== null) {
      const [, name, value] = match;
      fonts.push([name, value])
    }
    return { colors, fonts };
  }, [content]);

  if (!colors.length || !fonts.length) return (
    <div className={tw(`text-center text-gray-500 py-20`)}>
      No styles found in <pre className={tw(`inline-block bg-gray-100 p-1 rounded`)}>{context.path}</pre>
    </div>
  )

  return (
    <div
      className={tw(`p-8 mt-10 grid grid-cols-1 lg:grid-cols-2 gap-20`)}
    >
      <div className={tw(``)}>
        <style dangerouslySetInnerHTML={{ __html: content }} />
        <h1 className={tw(`text-6xl font-medium mb-4`)}>Colors</h1>
        <div className={tw(`grid grid-cols-2 lg:grid-cols-3 min-w-[27em] max-w-[50em] mt-6`)}>
          {colors.map(([color, shades]) => {
            const isSingleShade = shades.length === 1
            const mainShade = isSingleShade ? shades[0] : shades[4]
            return (
              <div className={tw(`flex-1 flex flex-col my-2 ml-0 mr-3`)}>
                {/* <h2 className={tw(`text-md font-medium`)}>{color}</h2> */}
                <div className={tw(``)}>
                  <div className={tw(`w-full h-40`)} style={{ backgroundColor: mainShade }} />
                  <div className={tw(`w-full h-12 flex flex-wrap mt-4`)}>
                    {!isSingleShade && shades.map((shade) => {
                      return (
                        <div className={tw(`w-[20%] h-[50%]`)} style={{ backgroundColor: shade }}></div>
                      )
                    })}
                  </div>
                </div>
                <div className={tw(`text-sm mt-2 font-mono`)}>{color}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className={tw(`w-full flex flex-col m-2`)}>
        <h2 className={tw(`text-6xl font-medium mb-4`)}>Fonts</h2>
        <div className={tw(`flex flex-wrap`)}>
          {fonts.map(([name, value]) => {
            return (
              <div className={tw(`flex-1 flex flex-col my-2 mr-10 max-w-[20em]`)}>
                <div className={tw(`text-sm font-mono`)}>{name}</div>
                <div className={tw(`text-3xl mt-3`)} style={{
                  fontFamily: value,
                }}>{value}</div>
                <p className={tw(`flex flex-wrap mt-1 text-xl mt-2`)} style={{
                  fontFamily: value,
                }}>
                  {letters.map(char => (
                    <span className={tw(`mx-1`)}>{char.toUpperCase()}{char}</span>
                  ))}
                </p>
                <p className={tw(`flex flex-wrap mt-1 text-sm mt-2`)} style={{
                  fontFamily: value,
                }}>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Est velit egestas dui id ornare. Interdum posuere lorem ipsum dolor sit amet consectetur adipiscing. Nulla aliquet enim tortor at auctor urna nunc. Quis enim lobortis scelerisque fermentum dui faucibus in. Nulla aliquet porttitor lacus luctus accumsan tortor posuere ac. At risus viverra adipiscing at in tellus integer. Ac placerat vestibulum lectus mauris ultrices eros. Quis hendrerit dolor magna eget est. Ipsum consequat nisl vel pretium lectus quam.

                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const selectorsToNotRender = ["*", "body"];
const TreeItem = ({
  selector = "",
  attributes = {},
  inheritedAttributes = {},
}: {
  selector?: string;
  attributes?: Record<string, string>;
  inheritedAttributes?: Record<string, string>;
}) => {
  const attributeNames = Object.keys(attributes || {});
  const cssVariableNames = attributeNames.filter((name) =>
    name.startsWith("--")
  );
  if (selectorsToNotRender.includes(selector) && !cssVariableNames.length) {
    return null;
  }

  return (
    <div className={tw(`py-3 flex`)}>
      <div className={tw(`font-mono w-40 sticky top-2 pt-2 h-8 flex-none`)}>
        {selector}
      </div>
      <div>
        {cssVariableNames.map((variable) => {
          return (
            <div className={tw(`flex items-center text-xs m-1`)} key={variable}>
              <div className={tw(`font-mono flex-none w-60`)}>{variable}</div>
              <Attribute value={attributes[variable]} />
            </div>
          );
        })}
      </div>

      <ItemRenderer
        selector={selector}
        attributes={{ ...inheritedAttributes, ...attributes }}
      />
    </div>
  );
};

const Attribute = ({ value }: { value: string }) => {
  const isColor = value.startsWith("#");
  if (isColor)
    return (
      <div
        className={tw(`h-6 w-6 rounded`)}
        style={{
          backgroundColor: value,
        }}
      />
    );
  return (
    <div className={tw(`p-1 bg-gray-100 rounded text-gray-800 font-mono`)}>
      {value}
    </div>
  );
};

const ItemRenderer = ({
  selector,
  attributes,
}: {
  selector: string;
  attributes: any;
}) => {
  const Component = selector;
  if (selectorsToNotRender.includes(selector)) return null;
  if (selector === "p")
    return (
      <p style={attributes}>
        This is what a paragraph looks like. Lorem ipsum dolor sit amet
        consectetur adipisicing elit. Inventore rem non consectetur.
      </p>
    );
  return (
    // @ts-ignore
    <Component style={attributes}>This is a {selector}</Component>
  );
};

const letters = "abcdefghijklmnopqrstuvwxyz".split("");