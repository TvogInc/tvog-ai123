import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CodeBlockProps {
  code: string;
  language?: string;
}

export const CodeBlock = ({ code, language = "code" }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

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
      <div className="p-4 font-mono text-xs leading-relaxed overflow-x-auto">
        <pre className="text-foreground/90">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};
