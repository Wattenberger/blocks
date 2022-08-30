import { FileBlockProps } from "@githubnext/blocks";
import { Button, TextInput } from "@primer/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Scrollama, Step } from 'react-scrollama';
import ReactMarkdown from "react-markdown";
import rehypeHighlight from 'rehype-highlight'
import { tw } from "twind";
import { parse } from "comment-parser";
import Editor from "./editor/index"
import { ErrorBoundary } from "./ErrorBoundary";
import "./github-markdown.css"

export default function (props: FileBlockProps) {
  const { content, context, onRequestGitHubData } = props;
  const [modules, setModules] = useState<Module>([]);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [activeMethodId, setActiveMethodId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const sections = useMemo(() => {
    return content.split("---").map((section) => {
      const codeBlockRegex = /```(.*?)\n([\s\S]*?)\n```/g;
      const codeBlocks = section.match(codeBlockRegex);
      const code = codeBlocks?.pop()?.replace(codeBlockRegex, "$2") || ""
      return {
        content: section.replace(codeBlockRegex, ""),
        code,
      }
    })
  }, [content])

  const code = sections[activeSectionIndex]?.code || "";

  return (
    <div className={tw("flex w-full h-full overflow-hidden")}>
      <div className={tw("flex-[1.2] h-full overflow-auto pb-60")}>
        <Steps sections={sections} activeSectionIndex={activeSectionIndex} setActiveSectionIndex={setActiveSectionIndex} />
      </div>
      <div className={tw("flex-1 h-full overflow-auto shadow bg-gray-50")}>
        {isLoading ? (
          <p className={tw("flex w-full h-[60%] items-center justify-center text-center text-gray-500 italic py-20")}>
            Loading...
          </p>
        ) : (
          <Sandbox code={code} diagnosticMethods={diagnosticMethods} keywords={keywords} />
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

const Steps = ({ sections, activeSectionIndex, setActiveSectionIndex }: {
  sections: any[],
  activeSectionIndex: number,
  setActiveSectionIndex: (section: number) => void
}) => {
  return (
    <Scrollama
      offset={0.5}
      onStepEnter={({ data }) => {
        setActiveSectionIndex(data.index)
      }}>
      {sections.map((section, index) => (
        <Step data={{ ...section, index }} key={index}>
          <div className={tw("px-6 py-10 mb-20 min-h-[100vh]") + " markdown-body"}>
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
              {section.content}
            </ReactMarkdown>
          </div>
        </Step>
      ))}
    </Scrollama>
  )
}
const Sandbox = ({ code, diagnosticMethods, keywords }: {
  code: string
  diagnosticMethods?: { name: string; message: string }[]
  keywords?: string[]
}) => {
  const [editedCode, setEditedCode] = useState(code || "")

  useEffect(() => {
    setEditedCode(code || "")
  }, [code])

  return (
    <div className={tw`w-full h-full flex flex-col items-start justify-center`}>
      <ErrorBoundary errorKey={editedCode}>
        <ExampleRunner code={editedCode} />
      </ErrorBoundary>
      <div className={tw`flex-1 text-sm w-full flex-[1.5] overflow-auto`}>
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
      let prefixedCode = `var width = 700; var height = 500; let img;\n`
        + code
          // prefix all p5 methods with `p.`
          .replace(new RegExp(`(^|\n|[ ()])(${methods.join("|")})([ .(])`, "g"), "$1p.$2$3")
          .replace(new RegExp(`(function )(${[...methods, ...p5Functions].join("|")})([ (])`, "g"), "p.$2 = function $3")
          .replace(/((\n|\s)let |\sconst )/g, "\nvar ")
          .replace(/assets\//g, "https://raw.githubusercontent.com/processing/p5.js-website/main/src/data/examples/assets/")
      if (!noRender && !["p.draw =", "p.preload =", "p.setup ="].some(prefix => prefixedCode.includes(prefix))) {
        prefixedCode = `p.draw = function() {\n${prefixedCode}\n}`
      }
      p.preload = typeof p.preload === 'function' ? p.preload : function () { };
      p.setup = typeof p.setup === 'function' ? p.setup : function () {
        p.createCanvas(100, 100);
        p.background(200);
      };
      prefixedCode += `\nwindow.removeSketch = function() { p.remove() }`
      eval(prefixedCode);
    };

    try {
      new window.p5(sketchFunction, sketchElement.current)
    } catch (e) {
      console.log(e);
    }

    return () => {
      window.removeSketch?.()
    }
  }, [code])

  return (
    <div className={tw`flex-1 w-full flex items-center justify-center p-3 overflow-auto`} ref={sketchElement} />
  )
}