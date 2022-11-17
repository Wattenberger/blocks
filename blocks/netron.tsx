import { FileBlockProps } from "@githubnext/blocks";

export default function ({ context }: FileBlockProps) {

  const url = `https://netron.app/?url=https://media.githubusercontent.com/media/${context.owner}/${context.repo}/${context.sha}/${context.path}`

  return (
    <iframe
      style={{
        width: "100%",
        height: "100%",
        border: "none",
      }}
      src={url}
    />
  );
}