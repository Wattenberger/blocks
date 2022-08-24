import { FolderBlockProps } from "@githubnext/blocks";
import { SearchIcon } from "@primer/octicons-react";
import { Button, TextInput } from "@primer/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { tw } from "twind";
// import Sandbox from "./sandbox";
import { Console, Hook, Unhook } from "console-feed";
import SyntaxHighlighter from "react-syntax-highlighter";
import { ErrorBoundary } from "./ErrorBoundary";
import syntaxHighlighterStyle from "react-syntax-highlighter/dist/esm/styles/hljs/atom-one-dark";


export default function (props: FolderBlockProps) {
  const { tree, context, onRequestGitHubData } = props;
  const [searchTerm, setSearchTerm] = useState("");
  const [code, setCode] = useState("");
  const [methods, setMethods] = useState<Method>([]);
  const [isLoading, setIsLoading] = useState(false);

  const updateContent = async () => {
    setCode("")
    setMethods([])
    setIsLoading(true)
    const methodFiles = tree.filter(item => {
      if (item.type !== "blob") return false
      if (item.path.startsWith(".")) return false
      if (item.path.includes("/")) return false
      if (!item.path?.endsWith(".js")) return false
      return true
    })
    const methods = (await Promise.all(methodFiles.map(async item => {
      const contents = await onRequestGitHubData(`/repos/${context.owner}/${context.repo}/contents/${item.path}`)
      const content = atob(contents.content)
      const name = (/\nexport default [^\n]*/.exec(content)?.[0]?.replace("export default ", "") || "").trim()
      const methodData = getMethodData(content)
      if (!name || !methodData.code) return
      return {
        id: name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase(),
        name,
        content,
        data: methodData
      }
    }))).filter(Boolean)
    const internalMethodFiles = tree.filter(item => {
      if (item.type !== "blob") return false
      if (!item.path.startsWith(".internal/")) return false
      if (item.path.startsWith(".internal/.")) return false
      if (!item.path?.endsWith(".js")) return false
      return true
    })
    const internalMethods = (await Promise.all(internalMethodFiles.map(async item => {
      const contents = await onRequestGitHubData(`/repos/${context.owner}/${context.repo}/contents/${item.path}`)
      const content = atob(contents.content)
      const name = (/\nexport default [^\n]*/.exec(content)?.[0]?.replace("export default ", "") || "").trim()
      if (!name) return
      return { name, content, isInternalMethod: true }
    }))).filter(Boolean)
    setMethods(methods)

    const fullCode = `var root = {};\n` + [...internalMethods, ...methods].reduce((acc, item) => {
      let code = item.content?.split("\n")
        .filter(line => !line.startsWith("import") && !line.startsWith("export"))
        .join("\n")
      // if (item.isInternalMethod) {
      // take out global consts to prevent from errors when defined multiple times
      code = code
        .replace(/(^|\n)\s*const toString [^\n]*/g, "\n")
        .replace(/(^|\n)\s*const /g, "\nvar ")
      // .replace(/\n\s*var /g, "\nvar ")
      // }
      return `${acc}\n${code}`
    }, "")
      + methods.reduce((acc, item) => {
        return `${acc}\nwindow.${item.name} = ${item.name}`
      }, "")
    setCode(fullCode)
    setIsLoading(false)
  }
  useEffect(() => {
    updateContent()
  }, [tree, context.sha])

  const scrollingElement = useRef<HTMLDivElement>(null);

  const filteredMethods = useMemo(() => {
    if (!searchTerm) return methods
    return methods.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [methods, searchTerm])

  return (
    <div className={tw("flex w-full h-[calc(100vh-3em)] overflow-hidden")}>
      <Sidebar
        methods={filteredMethods}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onMethodClick={method => {
          if (!scrollingElement.current) return
          const element = scrollingElement.current.querySelector(`#${method.id}`)
          if (!element) return
          const top = element.getBoundingClientRect().top + scrollingElement.current.scrollTop
          scrollingElement.current.scrollTo({ top, behavior: "smooth" })
        }}
      />
      <div ref={scrollingElement} className={tw("flex-1 h-full space-y-10 overflow-auto")}>
        {!isLoading && !filteredMethods.length && (
          <p className={tw("flex w-full h-full items-center justify-center text-center text-gray-500 italic py-20")}>
            No methods found{searchTerm ? ` that include ${searchTerm}` : ""}
          </p>
        )}
        {isLoading && (
          <p className={tw("flex w-full h-full items-center justify-center text-center text-gray-500 italic py-20")}>
            Loading...
          </p>
        )}
        {filteredMethods.map((item) => (
          <MethodItem
            key={item.name}
            item={item}
          />
        ))}
      </div>
      <div className={tw("w-[30em] shadow-xl h-full overflow-hidden")}>
        {!!code && (
          <Sandbox content={code} />
        )}
      </div>
    </div>
  );
}

type Method = {
  name: string
  content: string
  data: MethodData
}
type MethodData = {
  description: string
  attributes: MethodDataAttributes
  code: string
}
const attributeName = ["alias", "since", "category", "param", "returns", "example"]
type MethodDataAttributes = Record<typeof attributeName[number], string>


const getMethodData = (content) => {
  const metadataLinesRaw = ((content.match(/\/\*[\s\S]*?\*\//g) || [])
    .filter(d => d.includes("@"))[0] || "")
    .replaceAll("\n/**", "").replaceAll("*/", "")
  const code = content.split("*/").pop()
  const metadataLines = metadataLinesRaw.slice(1).split("\n").map(line => line.split("* ")[1]?.trim()).filter(Boolean)
  const metadataLinesText = metadataLines.join("\n")
  const description = metadataLinesText.split("\n@")[0]
  let attributes = {}
  attributeName.forEach(name => {
    const attributeRegex = new RegExp(`@${name}[^@]*`, "g")
    const attributeTextMatches = metadataLinesText.match(attributeRegex)
    const values = attributeTextMatches?.map(match => match.replace(`@${name}`, "").trim())
    const value = name === "param" ? values : values?.[0] || ""
    attributes[name] = value
  })
  return {
    description,
    attributes,
    code,
  }
}
const Sidebar = ({ methods, searchTerm, setSearchTerm, onMethodClick }: {
  methods: Method[]
  searchTerm: string
  setSearchTerm: (value: string) => void
  onMethodClick: (method: Method) => void
}) => {
  const categories = useMemo(() => {
    const categories = new Set()
    methods.forEach(item => {
      categories.add(item.data.attributes.category)
    })
    return [...categories].filter(Boolean).sort().map(category => {
      return {
        category,
        methods: methods.filter(item => item.data.attributes.category === category)
      }
    })
  }, [methods])

  return (
    <div className={tw("w-64 h-full overflow-hidden flex flex-col border-r border-gray-200")}>
      <div className={tw("relative flex-none pt-3 px-3")}>
        <TextInput
          className={tw("w-[calc(100%-1rem)] mb-2 mx-2")}
          leadingVisual={SearchIcon}
          size="large"
          aria-label="Search methods"
          placeholder="Search methods"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className={tw("flex flex-col space-y-12 flex-1 overflow-auto px-3")}>
        {categories.map((category) => (
          <div key={category.category} className={tw("flex flex-col space-y-2 mt-5")}>
            <h3 className={tw("text-sm text-gray-500 sticky top-0 bg-white uppercase tracking-wide py-1 px-2 border-b border-gray-200")}>
              {category.category}
            </h3>
            <div className={tw("flex flex-col space-y-2")}>
              {category.methods.map((item) => (
                <button
                  key={item.name}
                  className={tw("flex items-center w-full space-x-2 px-2")}
                  onClick={() => onMethodClick(item)}>
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const MethodItem = ({ item }: {
  item: Method
}) => {
  return (
    <div className={tw("w-full p-6")} id={item.id}>
      <h2 className={tw("text-xl font-bold mb-2")}>{item.name}</h2>
      <p className={tw("")}>{item.data.description}</p>
      <div className={tw("space-y-2 py-4")}>
        {["since", "param", "returns"].map(name => {
          let value = item.data.attributes[name]
          if (!Array.isArray(value)) value = [value]
          if (!value) return null
          return (
            <div key={name} className={tw(" mt-2")}>
              <div className={tw("flex space-x-2")}>
                <span className={tw("font-semibold w-[6em] flex-none")}>{name === "param" ? "param" : name}</span>
                <div className={tw("space-y-2")}>
                  {value.map((value, index) => (
                    <div key={index} className={tw("text-gray-700")}>{value}</div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {!!item.data.attributes.example && (
        <div className={tw("relative mt-6")}>
          <SyntaxHighlighter
            language="javascript"
            showLineNumbers={false}
            className={tw(`!py-5 !px-8 !rounded-xl`)}
            wrapLines
            wrapLongLines
            style={syntaxHighlighterStyle}
          >
            {item.data.attributes.example || ""}
          </SyntaxHighlighter>

          <Button className={tw("mt-2 absolute top-2 right-4")}
            onClick={() => {
              const command = item.data.attributes.example.replace(/\n\/\/[^\n]*/g, "")
              console.log(`%c${command}`, "color: #0969da; background: #ddf4ff; padding: 0.6em 1em")
              // @esbuild-plugin-typescript-ignore
              const res = eval(command)
              console.log(res)
            }}>
            Run
          </Button>
        </div>
      )}
    </div>
  )
}

const Sandbox = ({ content }: {
  content: string
}) => {
  const [logValue, setLogValue] = useState("")
  const [submitIteration, setSubmitIteration] = useState(0)
  const scrollingElement = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // @esbuild-plugin-typescript-ignore
    eval(content)
    console.log(chunk)
  }, [])

  const onNewLog = () => {
    scrollingElement.current?.scrollTo({
      top: scrollingElement.current?.scrollHeight,
      behavior: "smooth"
    })
  }

  return (
    <div className={tw("w-full h-full flex flex-col overflow-hidden")}>
      <div ref={scrollingElement} className={tw("w-full text-lg overflow-auto flex-1")}>
        <ErrorBoundary errorKey={logValue}>
          <ConsoleLog currentLog={logValue} submitIteration={submitIteration} onNewLog={onNewLog} />
        </ErrorBoundary>
      </div>
      <form
        className={tw("flex-none p-3 bg-white border-t border-gray-200")}
        onSubmit={(e) => {
          e.stopPropagation()
          e.preventDefault()
          setSubmitIteration(submitIteration + 1)
          setTimeout(() => {
            setLogValue("")
            onNewLog()
          }, 100)
        }}
      >
        <TextInput
          className={tw("w-full")}
          value={logValue}
          onChange={(e) => {
            setLogValue(e.target.value)
          }}
          placeholder=">"
        />
      </form>
    </div>
  )
}


const ConsoleLog = ({ currentLog, submitIteration, onNewLog }: {
  currentLog: string
  submitIteration: number
  onNewLog: () => void
}) => {
  const [logs, setLogs] = useState([])
  const [iteration, setIteration] = useState(0)

  useEffect(() => {
    try {
      // @esbuild-plugin-typescript-ignore
      const res = eval(currentLog)
      console.log(`%c${currentLog}`, "color: #0969da; background: #ddf4ff; padding: 0.6em 1em")
      console.log(res)
    } catch (e) {
      console.error(e)
    }
  }, [submitIteration])

  // run once!
  useEffect(() => {
    Hook(
      window.console,
      (log) => {
        // console.log(log)
        setIteration(i => i + 1)
        setLogs((currLogs) => [...currLogs, log])
        setTimeout(() => {
          onNewLog()
        }, 100)
      },
      false
    )
    return () => Unhook(window.console)
  }, [])

  return (
    <>
      <ErrorBoundary errorKey={iteration} onError={() => setLogs([{
        method: "info",
        data: ["Error: There was an error! Clearing the console for a clean start"]
      }])}>
        <Console
          logFilter={(log) => log.method === "log"}
          logs={logs}
          variant="light"
          styles={{
            BASE_FONT_SIZE: "1rem"
          }}
        />
      </ErrorBoundary>
    </>
  )
}
