import React from "react";
import { tw } from "twind";
import "./style.css";

import { snippetCompletion, ifNotIn, completeFromList } from '@codemirror/autocomplete';
import {
  autocompletion, closeBrackets,
  closeBracketsKeymap, completionKeymap
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  bracketMatching, foldGutter,
  foldKeymap, indentOnInput,
  LanguageDescription, syntaxTree
} from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { Diagnostic, linter, lintKeymap } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, Transaction } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  EditorView, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars,
  keymap
} from "@codemirror/view";
import { indentationMarkers } from "@replit/codemirror-indentation-markers";
import interact from "@replit/codemirror-interact";
import { vim } from "@replit/codemirror-vim";
import { theme } from "./theme";

const languageCompartment = new Compartment();
const vimModeCompartment = new Compartment();

const extensions = [
  // lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  foldGutter(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  theme,
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  // rectangularSelection(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  indentationMarkers(),
  interact({
    rules: [
      // dragging numbers
      {
        regexp: /-?\b\d+\.?\d*\b/g,
        cursor: "ew-resize",
        onDrag: (text, setText, e) => {
          const newVal = Number(text) + e.movementX;
          if (isNaN(newVal)) return;
          setText(newVal.toString());
        },
      },
    ],
  }),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...lintKeymap,
  ]),

  languageCompartment.of([]),
];
type DiagnosticMethod = {
  name: string;
  message: string;
}

export default function ({
  code, onUpdateCode, language = "javascript", diagnosticMethods = [], keywords = []
}: {
  code: string;
  onUpdateCode: (code: string) => void;
  language?: string;
  diagnosticMethods?: DiagnosticMethod[];
  keywords?: string[];
}) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView>();
  const [isUsingVim, setIsUsingVim] = React.useState(false);

  React.useEffect(() => {
    if (viewRef.current || !editorRef.current) return;

    const customLinter = linter(view => {
      let diagnostics: Diagnostic[] = []
      syntaxTree(view.state).cursor().iterate(node => {
        const text = view.state.sliceDoc(node.from, node.to)
        const method = diagnosticMethods.find(method => method.name === text)
        if (method) {
          diagnostics.push({
            from: node.from,
            to: node.to,
            severity: "info",
            message: method.message,
            renderMessage: () => {
              const node = document.createElement("div")
              node.style.padding = "0.3em 1em"
              node.innerHTML = method.message
              return node
            }
          })
        }
      })
      return diagnostics
    })

    const state = EditorState.create({
      doc: code,
      extensions: [
        vimModeCompartment.of(isUsingVim ? vim() : []),
        extensions,
        customLinter,
        EditorView.updateListener.of((v) => {
          if (
            !v.docChanged ||
            v.transactions.every((t) => t.annotation(Transaction.remote))
          )
            return;
          onUpdateCode(v.state.doc.sliceString(0));
        }),
      ],
    });
    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;
  }, []);

  React.useEffect(() => {
    if (!viewRef.current) return;
    const view = viewRef.current;

    const doc = view.state.doc.sliceString(0);
    if (doc !== code) {
      view.dispatch({
        changes: { from: 0, to: doc.length, insert: code },
        // mark the transaction remote so we don't call `onUpdateCode` for it below
        annotations: Transaction.remote.of(true),
      });
    }
  }, [code]);

  React.useEffect(() => {
    if (!viewRef.current) return;
    const view = viewRef.current;

    const languageDescription = LanguageDescription.matchLanguageName(languages, language);

    if (languageDescription) {
      languageDescription.load().then((lang) => {
        const dontComplete = [
          "RegExp",
        ];
        const newExtension = lang.language.data.of({
          autocomplete: ifNotIn(dontComplete, completeFromList(keywords))
        })

        view.dispatch({
          effects: languageCompartment.reconfigure([lang, newExtension]),
        });
      });
    }
  }, [language]);

  return (
    <div className={tw("relative w-full h-full")}>
      <button
        className={tw`absolute top-3 right-3 z-50 appearance-none`}
        style={{
          opacity: isUsingVim ? 1 : 0.5,
          filter: isUsingVim ? "" : "grayscale(100%)",
        }}
        title={isUsingVim ? "Disable Vim Mode" : "Enable Vim Mode"}
        onClick={() => {
          const newIsUsingVim = !isUsingVim;
          setIsUsingVim(newIsUsingVim);
          if (!viewRef.current) return;
          viewRef.current.dispatch({
            effects: vimModeCompartment.reconfigure(
              newIsUsingVim ? vim() : []
            ),
          });
          viewRef.current.focus();
        }}
      >
        {/* the vim logo */}
        <svg width="2em" viewBox="0 0 544.8642 544.8642">
          <g transform="translate(-69.980994,-160.33288) matrix(1.532388,0,0,1.3939671,-54.912136,-41.792396)">
            <path
              d="M 260.50744,170.69515 105.98412,340.79094 259.8636,510.178 414.38691,340.08221 260.50744,170.69515 z"
              fill="#019833"
            ></path>
            <path
              transform="matrix(0.90138601,0,0,0.99222542,-437.42287,-185.30615)"
              d="m 828.9375,369.5 -4.28125,4.28125 0,15.71875 3.75,3.75 19.8125,0 0,15.1875 -131.0625,132.84375 0,-147.84375 21.78125,0 4.46875,-4.46875 0,-15.90625 -4.125,-3.1875 -114.625,0 -3.75,3.75 0,16.25 3.8125,3.8125 19.9375,0 0,272.25 3.75,3.75 22.65625,0 274.65625,-283.40625 0,-12.5 -4.28125,-4.28125 -112.5,0 z"
              fill="#cccccc"
            ></path>
          </g>
        </svg>
      </button>

      <div
        className={tw(`relative w-full h-full overflow-auto`)}
        ref={editorRef}
      />
    </div>
  );
}
