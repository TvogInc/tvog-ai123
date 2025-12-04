import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Send, LogOut, Plus, Sparkles, Search, User, Paperclip, Download, FileIcon, Image as ImageIcon, Wand2, Mic, MicOff, FileSearch } from "lucide-react";
import { CodeBlock } from "@/components/CodeBlock";
import { z } from "zod";
import ThinkingAnimation from "@/components/ThinkingAnimation";
import { useVoiceInput } from "@/hooks/useVoiceInput";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

const messageSchema = z.object({
  content: z.string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(4000, "Message must be less than 4000 characters")
});

const MAX_MESSAGE_LENGTH = 4000;

const Chat = () => {
  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { isListening, isSupported: voiceSupported, toggleListening } = useVoiceInput({
    onTranscript: (transcript) => {
      setInput((prev) => prev + (prev ? ' ' : '') + transcript);
    },
    onError: (error) => {
      toast({
        title: "Voice Input Error",
        description: error,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      loadConversations(session.user.id);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          navigate("/auth");
        } else {
          setUser(session.user);
        }
      }
    );

    checkAuth();

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadConversations = async (userId: string) => {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error loading conversations:", error);
      return;
    }

    setConversations(data || []);
  };

  const loadMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading messages:", error);
      return;
    }

    setMessages((data || []) as Message[]);
  };

  const createNewConversation = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: "New Chat" })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create conversation",
        variant: "destructive",
      });
      return;
    }

    setCurrentConversation(data.id);
    setMessages([]);
    loadConversations(user.id);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 10MB",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const uploadFile = async (file: File, conversationId: string): Promise<{ url: string; name: string; type: string; size: number } | null> => {
    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${conversationId}/${crypto.randomUUID()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      return {
        url: fileName,
        name: file.name,
        type: file.type,
        size: file.size,
      };
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isLoading || isUploading) return;

    // Require either message or file
    if (!input.trim() && !selectedFile) {
      toast({
        title: "Cannot send empty message",
        description: "Please enter a message or attach a file",
        variant: "destructive",
      });
      return;
    }

    // Validate message input if provided
    if (input.trim()) {
      try {
        messageSchema.parse({ content: input });
      } catch (error) {
        if (error instanceof z.ZodError) {
          toast({
            title: "Invalid message",
            description: error.errors[0].message,
            variant: "destructive",
          });
          return;
        }
      }
    }

    let conversationId = currentConversation;

    if (!conversationId) {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, title: input.slice(0, 50) })
        .select()
        .single();

      if (error) {
        toast({
          title: "Error",
          description: "Failed to create conversation",
          variant: "destructive",
        });
        return;
      }

      conversationId = data.id;
      setCurrentConversation(conversationId);
      loadConversations(user.id);
    }

    // Upload file if selected
    let fileData: { url: string; name: string; type: string; size: number } | null = null;
    if (selectedFile) {
      fileData = await uploadFile(selectedFile, conversationId);
      if (!fileData) return; // Upload failed
    }

    const userMessage = { 
      role: "user" as const, 
      content: input || (fileData ? `Sent file: ${fileData.name}` : ""),
      file_url: fileData?.url,
      file_name: fileData?.name,
      file_type: fileData?.type,
      file_size: fileData?.size,
    };
    
    const { error: insertError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role: userMessage.role,
        content: userMessage.content,
        file_url: userMessage.file_url,
        file_name: userMessage.file_name,
        file_type: userMessage.file_type,
        file_size: userMessage.file_size,
      });

    if (insertError) {
      toast({
        title: "Error",
        description: "Failed to save message",
        variant: "destructive",
      });
      return;
    }

    setInput("");
    setSelectedFile(null);
    setIsLoading(true);

    await loadMessages(conversationId);

    try {
      const allMessages = [...messages, userMessage];
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ messages: allMessages }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";

      if (!reader) throw new Error("No response stream");

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantMessage += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantMessage } : m
                  );
                }
                return [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: assistantMessage,
                    created_at: new Date().toISOString(),
                  },
                ];
              });
            }
          } catch (e) {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: assistantMessage,
      });

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      loadConversations(user.id);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const renderMessageContent = (content: string) => {
    const parts: JSX.Element[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        const textBefore = content.slice(lastIndex, match.index);
        parts.push(
          <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
            {textBefore}
          </span>
        );
      }

      // Add code block
      const language = match[1] || "code";
      const code = match[2];
      parts.push(
        <CodeBlock key={`code-${match.index}`} code={code} language={language} />
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      const remainingText = content.slice(lastIndex);
      parts.push(
        <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
          {remainingText}
        </span>
      );
    }

    return parts.length > 0 ? parts : <span className="whitespace-pre-wrap">{content}</span>;
  };

  const downloadFile = async (fileUrl: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('chat-files')
        .download(fileUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const analyzeFile = async (message: Message) => {
    if (!message.file_url || !currentConversation) return;
    
    setIsAnalyzingFile(true);
    
    try {
      // Get the signed URL for the file
      const { data: signedUrlData } = await supabase.storage
        .from('chat-files')
        .createSignedUrl(message.file_url, 3600);

      if (!signedUrlData?.signedUrl) {
        throw new Error("Could not get file URL");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-file`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            fileUrl: signedUrlData.signedUrl,
            fileType: message.file_type,
            fileName: message.file_name,
            prompt: `Analyze this ${message.file_type?.startsWith('image/') ? 'image' : 'file'} and provide detailed insights.`
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze file");
      }

      const { analysis } = await response.json();

      // Save analysis as assistant message
      await supabase.from("messages").insert({
        conversation_id: currentConversation,
        role: "assistant",
        content: `**File Analysis: ${message.file_name}**\n\n${analysis}`,
      });

      await loadMessages(currentConversation);

      toast({
        title: "Analysis Complete",
        description: "File has been analyzed successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzingFile(false);
    }
  };

  const renderFileAttachment = (message: Message) => {
    if (!message.file_url || !message.file_name) return null;

    const isImage = message.file_type?.startsWith('image/');
    const fileSize = message.file_size ? `${(message.file_size / 1024).toFixed(1)} KB` : '';

    return (
      <div className="mt-2">
        {isImage ? (
          <div className="space-y-2">
            <div className="relative group cursor-pointer" onClick={() => downloadFile(message.file_url!, message.file_name!)}>
              <div className="rounded-lg overflow-hidden border border-border max-w-sm">
                <img 
                  src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/chat-files/${message.file_url}`}
                  alt={message.file_name}
                  className="w-full h-auto"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    supabase.storage.from('chat-files').createSignedUrl(message.file_url!, 3600).then(({ data }) => {
                      if (data) img.src = data.signedUrl;
                    });
                  }}
                />
              </div>
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                <Download className="w-8 h-8 text-white" />
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => analyzeFile(message)}
              disabled={isAnalyzingFile}
              className="text-xs"
            >
              <FileSearch className="w-3 h-3 mr-1" />
              {isAnalyzingFile ? "Analyzing..." : "Analyze Image"}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => downloadFile(message.file_url!, message.file_name!)}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/50 hover:bg-secondary transition-colors w-full"
            >
              <FileIcon className="w-8 h-8 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">{message.file_name}</p>
                {fileSize && <p className="text-xs text-muted-foreground">{fileSize}</p>}
              </div>
              <Download className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => analyzeFile(message)}
              disabled={isAnalyzingFile}
              className="text-xs"
            >
              <FileSearch className="w-3 h-3 mr-1" />
              {isAnalyzingFile ? "Analyzing..." : "Analyze File"}
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border space-y-3">
          <Button
            onClick={createNewConversation}
            className="w-full bg-gradient-primary hover:opacity-90"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
          
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          {conversations
            .filter((conv) =>
              conv.title.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  setCurrentConversation(conv.id);
                  loadMessages(conv.id);
                }}
                className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
                  currentConversation === conv.id
                    ? "bg-secondary"
                    : "hover:bg-secondary/50"
                }`}
              >
                <p className="truncate text-sm">{conv.title}</p>
              </button>
            ))}
          {conversations.filter((conv) =>
            conv.title.toLowerCase().includes(searchQuery.toLowerCase())
          ).length === 0 && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              {searchQuery ? "No conversations found" : "No conversations yet"}
            </p>
          )}
        </ScrollArea>

        <div className="p-4 border-t border-border space-y-2">
          <Button
            onClick={() => navigate("/profile")}
            variant="outline"
            className="w-full"
          >
            <User className="w-4 h-4 mr-2" />
            Profile
          </Button>
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="w-full"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">Tvog AI</h1>
          </div>
        </div>

        <ScrollArea className="flex-1 p-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <Sparkles className="w-10 h-10 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Welcome to Tvog AI</h2>
                <p className="text-muted-foreground">Start a conversation to get started</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((message, index) => {
                const isLastMessage = index === messages.length - 1;
                const isStreaming = isLoading && isLastMessage && message.role === "assistant";
                
                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === "user" ? "justify-end" : ""
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                    <div
                      className={`rounded-2xl p-4 max-w-[80%] ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border border-border"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <div className={isStreaming ? "typing-cursor" : ""}>
                          {renderMessageContent(message.content)}
                        </div>
                      ) : (
                        <>
                          {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}
                          {renderFileAttachment(message)}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <ThinkingAnimation />
              )}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t border-border bg-card">
          <form onSubmit={sendMessage} className="max-w-3xl mx-auto space-y-2">
            {selectedFile && (
              <div className="flex items-center gap-2 p-2 bg-secondary rounded-lg">
                <FileIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
                <span className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                  className="h-6 w-6 p-0"
                >
                  ×
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleFileSelect}
                accept="*/*"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => document.getElementById('file-upload')?.click()}
                disabled={isLoading || isUploading}
                className="h-[60px] w-[60px] flex-shrink-0"
              >
                <Paperclip className="w-5 h-5" />
              </Button>
              {voiceSupported && (
                <Button
                  type="button"
                  variant={isListening ? "destructive" : "outline"}
                  size="icon"
                  onClick={toggleListening}
                  disabled={isLoading}
                  className={`h-[60px] w-[60px] flex-shrink-0 ${isListening ? 'animate-pulse' : ''}`}
                  title={isListening ? "Stop listening" : "Start voice input"}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>
              )}
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? "Listening..." : "Message Tvog AI..."}
                className="min-h-[60px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e);
                  }
                }}
                maxLength={MAX_MESSAGE_LENGTH}
              />
              <Button
                type="submit"
                disabled={isLoading || isUploading || (!input.trim() && !selectedFile)}
                className="bg-gradient-primary hover:opacity-90 h-[60px] px-6"
              >
                {isUploading ? (
                  <span className="text-xs">Uploading...</span>
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground text-right">
              {input.length} / {MAX_MESSAGE_LENGTH} characters
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;
