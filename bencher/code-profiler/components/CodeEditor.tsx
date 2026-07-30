"use client";

import { Editor, OnMount } from "@monaco-editor/react";
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
        theme="vs-dark"
        onMount={handleMount}
        options={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 13,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderLineHighlight: "none",
          padding: { top: 12 },
          glyphMargin: true,
          smoothScrolling: true,
        }}
      />
    </div>
  );
}
