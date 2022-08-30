import { FileBlockProps } from "@githubnext/blocks";
import { Button, TextInput } from "@primer/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { tw } from "twind";
import { parse } from "comment-parser";
import Editor from "./editor/index"
import { ErrorBoundary } from "./ErrorBoundary";
import { SearchIcon } from "@primer/octicons-react";
import methods from "console-feed/lib/definitions/Methods";


export default function (props: FileBlockProps) {
  const { content, context, onRequestGitHubData } = props;
  const [editedContent, setEditedContent] = useState(content);
  useEffect(() => { setEditedContent(content); }, [content]);

  const [modules, setModules] = useState<Module>([]);
  const [methodsById, setMethodsById] = useState<Record<string, Method>>({});
  const [version, setVersion] = useState<string>("");
  const [activeMethodId, setActiveMethodId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const updateContent = async () => {
    setIsLoading(true)
    const versionRes = await onRequestGitHubData(`https://api.github.com/repos/processing/p5.js/releases/latest`,)
    let version = versionRes.tag_name.replace("v", "");
    try {
      const packageJson = await onRequestGitHubData(`/repos/${context.owner}/${context.repo}/contents/package.json`, {
        ref: context.sha,
      });
      const decodedPackageJson = atob(packageJson.content);
      const packageJsonContent = JSON.parse(decodedPackageJson);
      version = packageJsonContent.version;
    } catch (e) {
      console.log("Could not find package.json, using latest release version");
    }
    setVersion(version);
    const sourceCodeUrl = `https://cdnjs.cloudflare.com/ajax/libs/p5.js/${version}/p5.js`
    const sourceCode = await fetch(sourceCodeUrl)
      .then(res => res.text())

    const comments = sourceCode.match(/\/\*\*[\s\S]*?\*\//g)
    let modules = {}
    let runningModule = []
    let runningModuleIndex = 0
    let methodsById = {}
    comments.forEach(comment => {
      const info = parse(comment, { spacing: "preserve" })[0]
      if (!info) return
      const moduleTag = info.tags.find(tag => tag.tag === "module")
      if (moduleTag) {
        const module = moduleTag.name + (moduleTag.description ? ` ${moduleTag.description}` : "")
        const submoduleTag = info.tags.find(tag => tag.tag === "submodule")
        const submodule = (submoduleTag.name || "") + (submoduleTag.description ? ` ${submoduleTag.description}` : "")
        runningModule = [module, submodule]
        if (!modules[runningModule[0]]) modules[runningModule[0]] = {}
        if (!modules[runningModule[0]][runningModule[1]]) modules[runningModule[0]][runningModule[1]] = []
        return
      }
      const method = info.tags.find(tag => tag.tag === "method")
      if (!method?.name) return
      if (method.name[0] === "_") return
      if (info.tags.find(tag => tag.tag === "private")) return
      const params = info.tags.filter(tag => tag.tag === "param").map(param => ({
        name: param.name,
        description: param.description
      }))
      const existingMethod = modules[runningModule[0]]?.[runningModule[1]]?.find(m => m.name === method.name)
      if (existingMethod) {
        existingMethod.params = [...existingMethod.params, ...params].filter(d => d.description)
        return
      }
      const exampleTag = info.tags.filter(tag => tag.tag === "example")[0]
      const examples = exampleTag ? exampleTag.description
        ?.split("<div")
        .map(example => ({
          noRender: example.includes("norender"),
          code: example
            .slice(example.indexOf(">") + 1)
            .replace(/<\/{0,1}(div|code)>?/gm, '')
            .replace(/[^\n]*\/\/\s*prettier-ignore.*\r?\n/g, '')
            .trim()

        })).filter(d => d?.code?.length > 3) : []
      if (!examples.length) return
      const newMethod = {
        id: runningModuleIndex++,
        name: method.name,
        description: info.description,
        examples,
        params,
        module: runningModule,
        return: info.tags.find(tag => tag.tag === "return")?.description
      }
      if (!modules[runningModule[0]]?.[runningModule[1]]) return
      methodsById[newMethod.id] = newMethod
      modules[runningModule[0]][runningModule[1]].push(newMethod)
    })
    const methodsArray = Object.entries(modules).map(([moduleName, module]) => {
      const submodules = Object.entries(module).map(([submoduleName, submodule]) => ({
        name: submoduleName,
        methods: submodule
      })).filter(d => d.methods.length)
      return {
        name: moduleName,
        submodules
      }
    }).filter(d => d.submodules.length)

    setModules(methodsArray)
    setMethodsById(methodsById)
    setActiveMethodId(activeMethodId || Object.keys(methodsById)[0])
    setIsLoading(false)

    eval(sourceCode)
    Object.keys(window.p5.prototype).forEach(key => {
      window[key] = window.p5.prototype[key]
    })
  }
  useEffect(() => {
    updateContent()
  }, [context.sha])

  const { diagnosticMethods, keywords } = useMemo(() => {
    let diagnosticMethods = []
    let keywords = []
    modules.forEach(module => {
      module.submodules.forEach(submodule => {
        submodule.methods.forEach(method => {
          diagnosticMethods.push({
            name: method.name,
            message: `<h3><strong>${method.name}</strong></h3>\n${method.description}`,
          })
          keywords.push({
            label: method.name,
            type: "property",
            detail: "p5: " + method.description.split(". ")[0]
              // remove html tags
              .replace(/<[^>]*>?/gm, '')
          })
        })
      })
    })
    return { diagnosticMethods, keywords }
  }, [modules])

  return (
    <div className={tw("flex w-full h-full overflow-hidden")}>
      {isLoading ? (
        <p className={tw("flex w-full h-[60%] items-center justify-center text-center text-gray-500 italic py-20")}>
          Loading...
        </p>
      ) : (
        <Sandbox code={editedContent} version={version} diagnosticMethods={diagnosticMethods} keywords={keywords} />
      )}
    </div>
  );
}

type Code = {
  noRender: boolean
  code: string
}
type Method = {
  name: string
  description: string
  examples: Code[]
  params: { name: string, description: string }[]
  module: string[]
  return: string
}
type Module = {
  name: string
  submodules: {
    name: string
    methods: Method[]
  }[]
}

const MethodItem = ({ item, isSelected, onSelect }: {
  item: Method
  isSelected: boolean
  onSelect: () => void
}) => {
  return (
    <Button id={item.name} onClick={onSelect} variant={isSelected ? "primary" : "invisible"}
      active={isSelected}
      className={tw`font-mono font-light`}
      sx={{
        color: isSelected ? "white" : "textMuted",
        border: isSelected ? "1px solid" : "1px solid transparent",
        borderColor: "transparent",
        // backgroundColor: isSelected ? "accent.fg" : "transparent",
        lineHeight: "1.5em",
        padding: "0.5em 1em",
      }}>
      {item.name}
    </Button>
  )
}

const Sandbox = ({ code, diagnosticMethods, keywords, version }: {
  code: string
  diagnosticMethods?: { name: string; message: string }[]
  keywords?: string[]
  version?: string
}) => {
  const [editedCode, setEditedCode] = useState(code || "")

  useEffect(() => {
    setEditedCode(code || "")
  }, [code])

  return (
    <div className={tw`w-full h-full flex items-start justify-center`}>
      <ErrorBoundary errorKey={editedCode}>
        <ExampleRunner code={editedCode} version={version} />
      </ErrorBoundary>
      <div className={tw`flex-1 p-7 pt-0 h-full flex-1 overflow-auto`}>
        <Editor
          code={editedCode}
          onUpdateCode={setEditedCode}
          language="javascript"
          diagnosticMethods={diagnosticMethods}
          keywords={keywords}
        />
      </div>
    </div >
  )
}
const ExampleRunner = ({ code, version = "1.4.2" }: {
  code: string
  version?: string
}) => {
  const sketchElement = useRef<HTMLDivElement>(null)

  const iframeContent = useMemo(() => {
    return `
<html>
  <head>
    <script src="https://cdn.jsdelivr.net/npm/p5@${version}/lib/p5.js"></script>
    <script type="text/javascript">
      ${code
        .replace(/assets\//g, "https://raw.githubusercontent.com/processing/p5.js-website/main/src/data/examples/assets/")
      }
    </script>
  </head>
  <body>
    <main>
    </main>
  </body>
</html>
`
  }, [code])


  useEffect(() => {
    if (!sketchElement.current) return
    sketchElement.current.src = "data:text/html;charset=utf-8," + escape(iframeContent);
  }, [iframeContent])

  return (
    <iframe className={tw`flex-1 h-full pt-3 pr-7 min-w-[100px] overflow-auto`} ref={sketchElement} />
  )
}
