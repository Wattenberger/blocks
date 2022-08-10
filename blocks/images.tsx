import { FolderBlockProps, getNestedFileTree } from "@githubnext/blocks";
import { SearchIcon } from "@primer/octicons-react";
import { FormControl, TextInput } from "@primer/react";
import { useMemo, useState } from "react";
import { tw } from "twind";

export default function (props: FolderBlockProps) {
  const { tree, context } = props;
  const [searchTerm, setSearchTerm] = useState("");

  const nestedTree = useMemo(
    () => getNestedFileTree(tree)?.[0]?.children || [],
    [tree]
  );
  const filteredTree = useMemo(() => {
    const searchTermLower = searchTerm.toLowerCase();
    const filterItem = (item: File) => {
      const isFolder = item.type === "tree";
      if (!isFolder) {
        if (searchTerm && !item.path.toLowerCase().includes(searchTermLower)) return false
        const extension = item.name.split(".").pop() || "";
        return imageExtensions.includes(extension);
      }
      return item.children?.some((item) => filterItem(item));
    };
    return nestedTree.filter((item) => filterItem(item));
  }, [nestedTree, searchTerm]);
  console.log(filteredTree)

  return (
    <div className={tw("p-3")}>
      <div className={tw("relative")}>
        <TextInput
          className={tw("w-[calc(100%-1rem)] mb-2 mx-2")}
          leadingVisual={SearchIcon}
          size="large"
          aria-label="Search images"
          placeholder="Search images"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className={tw("flex w-full justify-center flex-wrap")}>
        {!filteredTree.length && (
          <p className={tw("flex w-full h-full items-center justify-center text-center text-gray-500 italic py-20")}>
            No images found{searchTerm ? ` that include ${searchTerm}` : ""}
          </p>
        )}
        {filteredTree.map((item) => (
          <Item
            key={item.name}
            item={item}
            searchTerm={searchTerm.toLowerCase()}
            rootPath={`https://raw.githubusercontent.com/${context.owner}/${context.repo
              }/${context.sha || "HEAD"}/`}
            linkRootPath={`https://github.com/${context.owner}/${context.repo
              }/blob/${context.sha || "HEAD"}/`}
          />
        ))}
      </div>
    </div>
  );
}

type FileTree = ReturnType<typeof getNestedFileTree>;
type File = FileTree[0];

const maxDepth = 3;
const imageExtensions = ["png", "jpg", "jpeg", "gif", "svg"];
const Item = ({
  item,
  rootPath,
  linkRootPath,
  searchTerm,
  depth = 0,
}: {
  item: File;
  rootPath: string;
  linkRootPath: string;
  searchTerm: string;
  depth?: number;
}) => {
  const { name, path, type } = item;

  const isFolder = type === "tree";

  if (!isFolder)
    return (
      <a
        href={`${linkRootPath}${path}`}
        className={tw("block p-3 flex flex-col items-center hover:bg-gray-100")}
        target="_blank"
        rel="noopener noreferrer"
      >
        <div className={tw("flex-1 flex items-center")}>
          <img
            className={tw("max-w-[20em] max-h-[20em] block")}
            src={`${rootPath}${path}`}
            alt={name}
          />
        </div>
        <div
          className={tw(
            "flex-none pt-1 text-xs text-gray-500 font-mono w-full text-center truncate"
          )}
        >
          {name}
        </div>
      </a>
    );


  if (depth >= maxDepth) return null

  return (
    <div
      className={tw(
        "p-2 m-2 flex flex-wrap justify-center border border-gray-200 rounded-lg"
      )}
    >
      <h3
        className={tw(
          "font-mono w-full flex items-center justify-center my-1 mx-1"
        )}
      >
        <svg
          viewBox="0 0 16 16"
          width="16"
          height="16"
          className={tw("mr-[0.3em] mb-[0.2em] text-gray-400 fill-current")}
        >
          <path d="M1.75 2.5a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25v-8.5a.25.25 0 00-.25-.25H7.5c-.55 0-1.07-.26-1.4-.7l-.9-1.2a.25.25 0 00-.2-.1H1.75zM0 2.75C0 1.784.784 1 1.75 1H5c.55 0 1.07.26 1.4.7l.9 1.2a.25.25 0 00.2.1h6.75c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75z"></path>
        </svg>
        {name}
      </h3>
      {item.children?.map((item) => (
        <Item
          key={item.name}
          item={item}
          rootPath={rootPath}
          linkRootPath={linkRootPath}
          searchTerm={searchTerm}
          depth={depth + 1}
        />
      ))}
    </div>
  );
};
