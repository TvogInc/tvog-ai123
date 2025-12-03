import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Play, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CodeBlockProps {
  code: string;
  language?: string;
}

const PREVIEWABLE_LANGUAGES = ["html", "css", "javascript", "js", "jsx", "tsx", "react"];

export const CodeBlock = ({ code, language = "code" }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  const isPreviewable = PREVIEWABLE_LANGUAGES.includes(language.toLowerCase());

  const previewContent = useMemo(() => {
    if (!showPreview) return "";
    
    const lang = language.toLowerCase();
    
    if (lang === "html") {
      return code;
    }
    
    if (lang === "css") {
      return `<!DOCTYPE html>
<html>
<head><style>${code}</style></head>
<body><div class="preview">CSS Preview - Add HTML to see styles</div></body>
</html>`;
    }
    
    if (["javascript", "js"].includes(lang)) {
      return `<!DOCTYPE html>
<html>
<head></head>
<body>
<div id="output"></div>
<script>
const originalLog = console.log;
console.log = (...args) => {
  const output = document.getElementById('output');
  output.innerHTML += args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : a).join(' ') + '<br>';
  originalLog(...args);
};
try {
${code}
} catch(e) {
  document.getElementById('output').innerHTML = '<span style="color:red">Error: ' + e.message + '</span>';
}
</script>
</body>
</html>`;
    }
    
    if (["jsx", "tsx", "react"].includes(lang)) {
      return `<!DOCTYPE html>
<html>
<head>
<script src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>body { font-family: system-ui, sans-serif; padding: 16px; }</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
${code}
const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
try {
  // Try to find and render the component
  const componentMatch = \`${code}\`.match(/(?:function|const|class)\\s+(\\w+)/);
  if (componentMatch) {
    const ComponentName = eval(componentMatch[1]);
    if (typeof ComponentName === 'function') {
      root.render(React.createElement(ComponentName));
    }
  }
} catch(e) {
  rootElement.innerHTML = '<span style="color:red">Error: ' + e.message + '</span>';
}
</script>
</body>
</html>`;
    }
    
    return code;
  }, [code, language, showPreview]);

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Code snippet copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg overflow-hidden border border-border/50 bg-muted/30 shadow-soft my-3">
      <div className="bg-muted/50 px-4 py-2 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-destructive/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-primary/60" />
          </div>
          <span className="text-xs text-muted-foreground font-mono">{language}</span>
        </div>
        <div className="flex items-center gap-1">
          {isPreviewable && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowPreview(!showPreview)}
              className="h-6 px-2 hover:bg-primary/10"
            >
              {showPreview ? (
                <X className="w-3 h-3" />
              ) : (
                <Play className="w-3 h-3" />
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={copyCode}
            className="h-6 px-2 hover:bg-primary/10"
          >
            {copied ? (
              <Check className="w-3 h-3 text-primary" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>
      
      {showPreview && (
        <div className="border-b border-border/50">
          <div className="bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground font-medium">
            Live Preview
          </div>
          <div className="bg-background p-2 min-h-[100px] max-h-[300px] overflow-auto">
            <iframe
              srcDoc={previewContent}
              className="w-full min-h-[100px] border-0 bg-white rounded"
              sandbox="allow-scripts"
              title="Code Preview"
            />
          </div>
        </div>
      )}
      
      <div className="p-4 font-mono text-xs leading-relaxed overflow-x-auto">
        <pre className="text-foreground/90">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};
