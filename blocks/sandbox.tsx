import { SandpackCodeEditor, SandpackPreview, SandpackProvider } from "@codesandbox/sandpack-react";
import { useMemo } from "react";
import "./sandbox.css"

export default ({
  content,
  dependencies,
}: {
  content: string;
  dependencies?: string[];
}) => {
  const files = useMemo(
    () => ({
      "/public/code.js": { code: content },
      "/public/index.html": {
        code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
  </head>
  <body>
    <div id="root"></div>
    <script src="/code.js"></script>
  </body>
</html>` },
      "/App.js": {
        code: `import { Console, Hook, Unhook } from "console-feed"
import { useEffect, useState } from "react"
import "./styles.css"

// load code.js
document.body.appendChild(document.createElement("script")).src = "/code.js"

export default function App() {
  const [logs, setLogs] = useState([])

  // run once!
  useEffect(() => {
    Hook(
      window.console,
      (log) => setLogs((currLogs) => [...currLogs, log]),
      false
    )
    return () => Unhook(window.console)
  }, [])
  const [logValue, setLogValue] = useState("")

  return (
    <div className="App">
      <div className="console">
        <Console logs={logs} variant="light" />
      </div>
      <form
        onSubmit={(e) => {
          e.stopPropagation()
          e.preventDefault()
          console.log(eval(logValue))
          setLogValue("")
          setTimeout(() => {
            document.scrollingElement.scrollTo({
              top: document.body.clientHeight + window.innerHeight,
              behavior: "smooth"
            })
          }, 100)
        }}
      >
        <input
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
` },
      "/styles.css": {
        code: `.App {
  font-family: sans-serif;
  width: calc(100%-2em);
  padding: 0 1em;
}
form {
  position: sticky;
  z-index: 100;
  bottom: 0;
  padding: 1em 0;
  background: #fff;
  border-top: 1px solid rgb(236,236,236);
  margin-top: -1px;
}
input {
  width: calc(100% - 2em);
  padding: 0.6em 1em;
  border: none;
  background: #eee;
}
input:focus {
  outline: none;
}
.css-fw7ao3 {
  padding: 0.5em;
}` },
    }),
    [content]
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
      }}
    >
      <SandpackProvider
        template="react"
        customSetup={{
          dependencies: { "console-feed": "latest", ...dependencies },
          files,
        }}
        autorun
      >
        <SandpackCodeEditor
          showLineNumbers
          showTabs
        />
        <SandpackPreview
          showOpenInCodeSandbox
        />
      </SandpackProvider>
    </div>
  );
};

const parseDependencies = (dependencies: string[]): Record<string, string> => {
  let res = {};
  dependencies.forEach((dep) => {
    const [name, version = "latest"] = dep.split("@");
    // @ts-ignore
    res[name] = version;
  });
  return res;
};
