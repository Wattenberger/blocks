import { FolderBlockProps, getNestedFileTree } from "@githubnext/blocks";
import { useEffect, useMemo, useState } from "react";
import { tw } from "twind";

export default function (props: FolderBlockProps) {
  const { tree, context, onRequestGitHubData } = props;
  const [searchTerm, setSearchTerm] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  const onUpdateHistory = async () => {
    const res = await onRequestGitHubData(
      `/repos/${context.owner}/${context.repo}/commits`, {
      path: context.path,
    }
    )
    console.log(res)
  }

  useEffect(() => {
    console.log(context)
    onUpdateHistory()
  }, [context.repo, context.owner, context.sha])

  return (
    <div className={tw("p-3")}>
      hi
    </div>
  );
}
