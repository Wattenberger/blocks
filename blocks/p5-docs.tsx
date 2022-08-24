import { FolderBlockProps } from "@githubnext/blocks";
import { Button, TextInput } from "@primer/react";
import { useEffect, useRef, useState } from "react";
import { tw } from "twind";
// import Sandbox from "./sandbox";
import { parse } from "comment-parser";
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import Editor from 'react-simple-code-editor';
import { ErrorBoundary } from "./ErrorBoundary";
// import 'prismjs/themes/prism-tomorrow.css'; //Example style, you can use another
import "./prism-github.css";
import { SearchIcon } from "@primer/octicons-react";


export default function (props: FolderBlockProps) {
  const { tree, context, onRequestGitHubData } = props;
  const [modules, setModules] = useState<Module>([]);
  const [methodsById, setMethodsById] = useState<Record<string, Method>>({});
  const [version, setVersion] = useState<string>("");
  const [activeMethodId, setActiveMethodId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const activeMethod = methodsById[activeMethodId || ""] || null;

  const lowerSearch = searchTerm.toLowerCase()
  const filteredModules = searchTerm ? modules.map((module) => {
    return {
      ...module,
      submodules: module.submodules.map((submodule) => {
        return {
          ...submodule,
          methods: submodule.methods.filter((method) => {
            return method.name.toLowerCase().includes(lowerSearch);
          })
        }
      }).filter((submodule) => submodule.methods.length > 0)
    }
  }).filter((module) => module.submodules.length > 0) : modules;



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
  }, [tree, context.sha])

  const scrollingElement = useRef<HTMLDivElement>(null);

  return (
    <div className={tw("flex w-full h-[calc(100vh-3em)] overflow-hidden")}>
      <div ref={scrollingElement} className={tw("flex-1 p-5 h-full overflow-auto")}>
        <h1 className={tw("text-2xl font-bold mt-3 px-5")}>Methods in p5.js v{version}</h1>
        <TextInput
          className={tw("w-[calc(100%-2.5rem)] mb-2 mx-5 mt-3 mb-4")}
          leadingVisual={SearchIcon}
          size="large"
          aria-label="Search methods"
          placeholder="Search methods"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {isLoading && (
          <p className={tw("flex w-full h-[60%] items-center justify-center text-center text-gray-500 italic py-20")}>
            Loading...
          </p>
        )}
        {!isLoading && !filteredModules.length && (
          <p className={tw("flex w-full h-[60%] items-center justify-center text-center text-gray-500 italic py-20")}>
            No methods found{searchTerm ? ` that include ${searchTerm}` : ""}
          </p>
        )}
        {!isLoading && filteredModules.map(module => (
          <div className={tw`pt-4 pb-2 px-5`} key={module.name}>
            <h2 className={tw`text-3xl font-bold mb-2`} id={module.name}>{module.name}</h2>
            {module.submodules.map(submodule => (
              <div className={tw`py-3`} key={submodule.name}>
                {submodule.name !== module.name && (
                  <h3 className={tw`text-lg font-bold`} id={submodule.name}>{submodule.name}</h3>
                )}
                <div className={tw`flex flex-wrap py-2`}>
                  {submodule.methods.map(method => (
                    <MethodItem
                      key={method.id}
                      item={method}
                      isSelected={activeMethodId == method.id}
                      onSelect={() => {
                        setActiveMethodId(method.id)
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className={tw("w-[min(50em,50%)] pb-40 shadow-xl border-l border-gray-200 h-full overflow-auto")} key={activeMethodId}>
        {activeMethod && (
          <>
            <ActiveMethodInfo method={activeMethod} />
            <h3 className={tw("text-xl font-bold mt-5 mb-0 px-9")}>Examples</h3>
            {activeMethod?.examples?.map((example, i) => (
              <Sandbox code={example} key={i} />
            ))}
          </>
        )}
      </div>
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

const Sandbox = ({ code }: {
  code: Code
}) => {
  const [editedCode, setEditedCode] = useState(code.code || "")

  useEffect(() => {
    setEditedCode(code.code || "")
  }, [code])

  return (
    <div className={tw`w-full px-9 py-5 flex items-start justify-center`}>
      <ErrorBoundary errorKey={editedCode}>
        <ExampleRunner code={editedCode} noRender={code.noRender} />
      </ErrorBoundary>
      <div className={tw`pr-7 flex-1 overflow-auto`}>
        <Editor
          value={editedCode}
          onValueChange={code => setEditedCode(code)}
          highlight={code => highlight(code, languages.js, 'js')}
          padding={10}
          style={{
            fontFamily: "ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace",
            fontSize: 16,
          }}
        />
      </div>
    </div >
  )
}
const ExampleRunner = ({ code, noRender }: {
  code: string
  noRender: boolean
}) => {
  const sketchElement = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sketchElement.current || !code) return
    sketchElement.current.innerHTML = "";

    const sketchFunction = function (p) {
      const methods = [...Object.keys(p), ...Object.keys(Object.getPrototypeOf(p))].filter(key => key !== "constructor")
      const p5Functions = [
        "mousePressed",
        "mouseReleased",
        "mouseClicked",
        "mouseMoved",
        "mouseDragged",
        "mouseWheel",
        "doubleClicked",
        "touchStarted",
        "touchMoved",
        "touchEnded",
        "keyPressed",
        "keyReleased",
        "keyTyped",
        "deviceMoved",
        "deviceTurned",
        "deviceShaken",
        "preload",
        "setup",
        "draw",
        "windowResized",
      ]
      let prefixedCode = code
        // prefix all p5 methods with `p.`
        .replace(new RegExp(`(^|\n|[ ()])(${methods.join("|")})([ .(])`, "g"), "$1p.$2$3")
        .replace(new RegExp(`(function )(${[...methods, ...p5Functions].join("|")})([ (])`, "g"), "p.$2 = function $3")
        .replace(/((\n|\s)let |\sconst )/g, "\nvar ")
        .replace(/assets\//g, "https://raw.githubusercontent.com/processing/p5.js/main/docs/yuidoc-p5-theme/assets/")
      if (!noRender && !["p.draw =", "p.preload =", "p.setup ="].some(prefix => prefixedCode.includes(prefix))) {
        prefixedCode = `p.draw = function() {\n${prefixedCode}\n}`
      }
      p.preload = typeof p.preload === 'function' ? p.preload : function () { };
      p.setup = typeof p.setup === 'function' ? p.setup : function () {
        p.createCanvas(100, 100);
        p.background(200);
      };
      eval(prefixedCode);
    };

    try {
      new window.p5(sketchFunction, sketchElement.current)
    } catch (e) {
      console.log(e);
    }
  }, [code])

  return (
    <div className={tw`flex-none sticky top-0 h-auto ${noRender ? "hidden" : "pt-3 pr-7 min-w-[100px]"}`} ref={sketchElement} />
  )
}

const ActiveMethodInfo = ({ method }: { method: Method }) => {
  return (
    <div className={tw`pt-7 pb-3 px-9 border-b border-gray-200`}>
      <h2 className={tw("text-2xl font-bold mb-3")}>{method.name}</h2>
      <p className={tw("text-gray-700")} dangerouslySetInnerHTML={{ __html: method.description }} />
      <div className={tw("space-y-2 py-4")}>
        {method.params?.map(({ name, description }) => {
          return (
            <div key={name} className={tw(" mt-2")}>
              <div className={tw("flex space-x-2")}>
                <span className={tw("font-semibold w-[6em] flex-none")}>{name}</span>
                <div className={tw("space-y-2")}>
                  <p className={tw("text-sm")} dangerouslySetInnerHTML={{ __html: description }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}