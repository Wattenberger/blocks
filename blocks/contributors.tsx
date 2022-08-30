import { FileBlockProps } from "@githubnext/blocks";
import { SearchIcon } from "@primer/octicons-react";
import { Box, Text, TextInput } from "@primer/react";
import { useMemo, useState } from "react";
import { tw } from "twind";

export default (props: FileBlockProps) => {
  const { content } = props;

  const [search, setSearch] = useState("");
  const lowerSearch = search.toLowerCase();

  const info = useMemo(() => {
    try {
      return JSON.parse(content);
    } catch (e) {
      return null
    }
  }, [content]);

  if (!info) return <Box p={10}>Could not parse content</Box>

  return (
    <Box p={3} width="100%">
      <TextInput
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search for a contributor"
        sx={{ width: "100%", mb: 3 }}
        size="large"
        leadingVisual={SearchIcon}
      />
      <Box style={{
        display: "grid",
        gridTemplateColumns: `repeat(${info.contributorsPerLine || 5}, 1fr)`,
        gridGap: 10,
      }}>
        {info.contributors.map(contributor => {
          if (search && !contributor.name.toLowerCase().includes(lowerSearch)) return null
          return (
            <a href={`http://github.com/${contributor.login}`} key={contributor.username} className={tw`flex flex-col items-center p-6 text-center text-sm`}>
              <img src={contributor.avatar_url} style={{ marginBottom: "1em", width: info.imageSize || 100, height: info.imageSize || 100, borderRadius: "50%" }} />
              <Text>{contributor.name}</Text>
            </a>
          )
        })}
      </Box>
    </Box>
  )
}

const chunk = (arr = [], size = 1) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}