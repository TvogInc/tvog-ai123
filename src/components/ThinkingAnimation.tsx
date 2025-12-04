const ThinkingAnimation = () => {
  return (
    <div className="flex items-start gap-3 p-4">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-glow flex-shrink-0">
        <div className="w-4 h-4 relative">
          <div className="absolute inset-0 rounded-full bg-primary-foreground/80 animate-ping opacity-75" />
          <div className="absolute inset-1 rounded-full bg-primary-foreground" />
        </div>
      </div>
      
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-foreground">Thinking</span>
          <div className="flex gap-0.5">
            <span className="w-1 h-1 rounded-full bg-primary animate-pulse [animation-delay:0ms]" />
            <span className="w-1 h-1 rounded-full bg-primary animate-pulse [animation-delay:150ms]" />
            <span className="w-1 h-1 rounded-full bg-primary animate-pulse [animation-delay:300ms]" />
          </div>
        </div>
        
        {/* Animated wave bars */}
        <div className="flex items-end gap-0.5 h-4">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-gradient-to-t from-primary to-primary/40 rounded-full animate-wave"
              style={{
                animationDelay: `${i * 80}ms`,
                height: '100%',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ThinkingAnimation;
