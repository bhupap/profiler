"use client";

import { Editor, OnMount, BeforeMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useEffect, useRef } from "react";
import type { Hotspot, SupportedLanguage } from "@/lib/types";

type Props = {
  value: string;
  onChange: (v: string) => void;
  language: SupportedLanguage;
  hotspots: Hotspot[];
  activeHotspotIndex: number | null;
};

const SEVERITY_CLASS: Record<Hotspot["severity"], { line: string; glyph: string }> = {
  high:   { line: "hotspot-high",   glyph: "hotspot-glyph-high"   },
  medium: { line: "hotspot-med",    glyph: "hotspot-glyph-med"    },
  low:    { line: "hotspot-low",    glyph: "hotspot-glyph-low"    },
};

export default function CodeEditor({
  value,
  onChange,
  language,
  hotspots,
  activeHotspotIndex,
}: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);

  // Define the palette-matched theme before the editor mounts (no vs-dark flash).
  const handleBeforeMount: BeforeMount = (monaco) => {
    monaco.editor.defineTheme("profiler", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "5A6472", fontStyle: "italic" },
        { token: "keyword", foreground: "5CD6E8" },
        { token: "string", foreground: "7FE3C4" },
        { token: "number", foreground: "FBBF24" },
        { token: "type", foreground: "8EE7F3" },
        { token: "identifier", foreground: "C7D0DD" },
        { token: "delimiter", foreground: "9AA4B4" },
      ],
      colors: {
        "editor.background": "#0B0D12",
        "editor.foreground": "#E7ECF3",
        "editorLineNumber.foreground": "#3A4250",
        "editorLineNumber.activeForeground": "#9AA4B4",
        "editor.selectionBackground": "#173A44",
        "editorCursor.foreground": "#5CD6E8",
        "editor.lineHighlightBackground": "#0E1116",
        "editorIndentGuide.background": "#161B23",
        "editorIndentGuide.activeBackground": "#242C38",
        "editorGutter.background": "#0B0D12",
        "editorWidget.background": "#0E1116",
        "editorWidget.border": "#1D222C",
        "editorHoverWidget.background": "#0E1116",
        "editorHoverWidget.border": "#2C3542",
        "scrollbarSlider.background": "#232A3588",
        "scrollbarSlider.hoverBackground": "#37414F",
        "scrollbarSlider.activeBackground": "#37414F",
      },
    });
  };

  const handleMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;
    monacoRef.current = monaco;
    decorationsRef.current = ed.createDecorationsCollection([]);
  };

  // Recompute decorations whenever hotspots or active selection changes.
  useEffect(() => {
    const monaco = monacoRef.current;
    const collection = decorationsRef.current;
    if (!monaco || !collection) return;

    const decorations: editor.IModelDeltaDecoration[] = hotspots.map((hs, i) => {
      const cls = SEVERITY_CLASS[hs.severity];
      const isActive = i === activeHotspotIndex;
      return {
        range: new monaco.Range(hs.startLine, 1, hs.endLine, 1),
        options: {
          isWholeLine: true,
          className: isActive ? "hotspot-active" : cls.line,
          linesDecorationsClassName: cls.glyph,
          hoverMessage: { value: `**${hs.issue}** — ${hs.explanation}` },
        },
      };
    });

    collection.set(decorations);
  }, [hotspots, activeHotspotIndex]);

  // Scroll to the active hotspot when the user clicks a card.
  useEffect(() => {
    if (activeHotspotIndex == null) return;
    const ed = editorRef.current;
    const hs = hotspots[activeHotspotIndex];
    if (!ed || !hs) return;
    ed.revealLineInCenter(hs.startLine);
  }, [activeHotspotIndex, hotspots]);

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={language}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        theme="profiler"
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        options={{
          fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 13.5,
          lineHeight: 22,
          letterSpacing: 0.2,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderLineHighlight: "none",
          padding: { top: 18, bottom: 18 },
          glyphMargin: true,
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          fontLigatures: true,
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
          overviewRulerLanes: 0,
        }}
      />
    </div>
  );
}
